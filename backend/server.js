const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FICHIER_CLIENTS = process.env.CLIENTS_FILE
  ? path.resolve(process.env.CLIENTS_FILE)
  : path.join(__dirname, 'clients.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Crée automatiquement le fichier clients s'il n'existe pas.
if (!fs.existsSync(FICHIER_CLIENTS)) {
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify([], null, 2), 'utf8');
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const right = Buffer.isBuffer(b) ? b : Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Nouveau format : scrypt$<sel hex>$<hash hex>
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

// Vérifie le nouveau format scrypt, l'ancien format sha256$... et le hash
// historique SHA-256 sans sel (64 hex) afin de préserver les comptes existants.
function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !stored) {
    return false;
  }

  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length || SCRYPT_KEYLEN);
      return safeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  if (stored.startsWith('sha256$')) {
    const expected = stored.slice('sha256$'.length);
    return /^[a-f0-9]{64}$/i.test(expected) && safeEqual(sha256(password), expected);
  }

  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return safeEqual(sha256(password), stored);
  }

  return false;
}

function needsRehash(stored) {
  return typeof stored !== 'string' || !stored.startsWith(`${SCRYPT_PREFIX}$`);
}

function readClients() {
  const parsed = JSON.parse(fs.readFileSync(FICHIER_CLIENTS, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Le fichier clients ne contient pas une liste.');
  }
  return parsed;
}

function writeClients(clients) {
  const tmp = `${FICHIER_CLIENTS}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clients, null, 2), 'utf8');
  fs.renameSync(tmp, FICHIER_CLIENTS);
}

function publicClient(client) {
  return {
    id: client.id,
    email: client.email,
    name: client.name,
    createdAt: client.dateInscription,
  };
}

// API 1 : CRÉER UN COMPTE
app.post('/api/inscription', (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ succes: false, message: 'Email et mot de passe obligatoires.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ succes: false, message: 'Adresse e-mail invalide.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        succes: false,
        message: `Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`,
      });
    }

    const clients = readClients();
    if (clients.some(c => normalizeEmail(c.email) === email)) {
      return res.status(409).json({ succes: false, message: 'Cet email possède déjà un compte.' });
    }

    const nouveauClient = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      password: hashPassword(password),
      dateInscription: new Date().toLocaleString('fr-FR'),
    };

    clients.push(nouveauClient);
    writeClients(clients);

    return res.status(201).json({ succes: true, client: publicClient(nouveauClient) });
  } catch (err) {
    return next(err);
  }
});

// API 2 : SE CONNECTER
app.post('/api/connexion', (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ succes: false, message: 'Champs manquants.' });
    }

    const clients = readClients();
    const clientTrouve = clients.find(c => normalizeEmail(c.email) === email);

    if (!clientTrouve || !verifyPassword(password, clientTrouve.password)) {
      return res.status(401).json({ succes: false, message: 'Email ou mot de passe incorrect.' });
    }

    // Migration transparente : un ancien hash SHA-256 est remplacé par scrypt
    // après une connexion réussie, sans changer l'identifiant du compte.
    if (needsRehash(clientTrouve.password)) {
      clientTrouve.password = hashPassword(password);
      writeClients(clients);
    }

    return res.json({ succes: true, client: publicClient(clientTrouve) });
  } catch (err) {
    return next(err);
  }
});

// API 3 : LISTER LES CLIENTS (sans hash de mot de passe)
app.get('/api/clients', (req, res, next) => {
  try {
    const clients = readClients().map(c => ({
      id: c.id,
      email: c.email,
      name: c.name,
      dateInscription: c.dateInscription,
    }));
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Garantit que toute erreur renvoie du JSON (et jamais du HTML)
app.use((req, res) => {
  res.status(404).json({ succes: false, message: 'Route API introuvable sur le serveur.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // Error messages can include request-body excerpts, so log only the error class.
  console.error(`[${new Date().toISOString()}] Erreur API (${req.method}):`, err instanceof Error ? err.name : 'UnknownError');
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  const message = status < 500 ? 'Requête invalide.' : 'Erreur serveur inattendue.';
  res.status(status).json({ succes: false, message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Backend LinkPulse démarré sur http://localhost:${PORT}`);
  });
}

module.exports = { app, hashPassword, verifyPassword, needsRehash };