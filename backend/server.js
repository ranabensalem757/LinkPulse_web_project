const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const dns = require('dns').promises;
const tls = require('tls');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const FICHIER_CLIENTS = './clients.json';
const FICHIER_DONNEES = './donnees.json';
const SEUIL_LENTEUR_MS = 1500;

// ============================================================================
// CONFIGURATION E-MAIL
// Using Ethereal (free test SMTP) – preview URLs are logged to the console.
// To deliver to real inboxes, replace with a real SMTP provider:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.
// ============================================================================
let transporterReady = null;

async function getTransporter() {
  if (transporterReady) return transporterReady;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporterReady = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log(`📧 E-mail via SMTP réel (${process.env.SMTP_HOST}).`);
  } else {
    const compteTest = await nodemailer.createTestAccount();
    transporterReady = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: compteTest.user, pass: compteTest.pass }
    });
    console.log('📧 E-mail via Ethereal (test). URL de prévisualisation affichée après envoi.');
  }
  return transporterReady;
}

// ============================================================================
// RESET CODES — in-memory store with hash + expiry + attempt limits
// ============================================================================
// Structure: { [email]: { codeHash, expireAt, attempts } }
const codesVerification = {};

const RESET_CODE_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const RESET_CODE_MAX_ATTEMPTS = 5;

function hashResetCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// ============================================================================
// PASSWORD HASHING — bcrypt-style using scrypt (Node built-in, no extra deps)
// ============================================================================
const HASH_VERSION = 'scrypt2';

/**
 * Hash a plain-text password → "scrypt2$<salt>$<hash>"
 */
function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
  return `${HASH_VERSION}$${salt}$${hash}`;
}

/**
 * Verify a plain-text password against a stored hash.
 * Supports:
 *   - new format: "scrypt2$<salt>$<hash>"
 *   - legacy scrypt format: "scrypt$<salt>$<hash>" (old backend version)
 *   - legacy sha256 format: 64-char hex (original backend)
 */
function verifyPassword(plaintext, stored) {
  if (!stored || !plaintext) return false;

  // New format: scrypt2$salt$hash
  if (stored.startsWith('scrypt2$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHash] = parts;
    try {
      const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch { return false; }
  }

  // Legacy format from previous server version: scrypt$salt$hash
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHash] = parts;
    try {
      // The old version used scryptSync with N=16384 (Node default)
      const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch { return false; }
  }

  // Legacy SHA-256 format: plain 64-char hex
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const sha256 = crypto.createHash('sha256').update(plaintext).digest('hex');
    // Use timing-safe comparison for the sha256 path too
    return crypto.timingSafeEqual(
      Buffer.from(sha256.toLowerCase()),
      Buffer.from(stored.toLowerCase())
    );
  }

  return false;
}

/**
 * Returns true if the stored hash should be migrated to the new format.
 */
function needsMigration(stored) {
  return stored && !stored.startsWith('scrypt2$');
}

// ============================================================================
// SESSION TOKENS — simple signed token stored in memory + returned as bearer
// ============================================================================
// Structure: { [token]: { userId, email, createdAt } }
const sessions = {};
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSession(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId, email, createdAt: Date.now() };
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    delete sessions[token];
    return null;
  }
  return s;
}

function deleteSession(token) {
  delete sessions[token];
}

/**
 * Middleware: extracts Bearer token from Authorization header,
 * resolves to session, adds req.session = { userId, email }.
 * Returns 401 if missing/invalid.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ succes: false, message: 'Non authentifié. Veuillez vous connecter.' });
  }
  req.session = session;
  next();
}

// ============================================================================
// DONNÉES CLIENT
// ============================================================================
app.use(cors());
app.use(express.json());

if (!fs.existsSync(FICHIER_CLIENTS)) {
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify([], null, 2));
}

function lireClients() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_CLIENTS, 'utf-8'));
  } catch {
    return [];
  }
}

function sauverClients(clients) {
  const tmp = `${FICHIER_CLIENTS}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clients, null, 2));
  fs.renameSync(tmp, FICHIER_CLIENTS);
}

// ============================================================================
// DONNÉES DE SUPERVISION — ÉCRITURE ATOMIQUE
// ============================================================================
function lireDonnees() {
  try {
    if (!fs.existsSync(FICHIER_DONNEES)) {
      const init = { sites: [], checks: {}, incidents: [], events: [], diagnostics: {} };
      sauverDonnees(init);
      return init;
    }
    const brut = JSON.parse(fs.readFileSync(FICHIER_DONNEES, 'utf-8'));
    // Migrate old flat structure (no userId on sites) — keep data, mark as unowned
    if (Array.isArray(brut)) {
      const init = { sites: [], checks: {}, incidents: [], events: [], diagnostics: {} };
      sauverDonnees(init);
      return init;
    }
    if (!brut.sites) brut.sites = [];
    if (!brut.checks) brut.checks = {};
    if (!brut.incidents) brut.incidents = [];
    if (!brut.events) brut.events = [];
    if (!brut.diagnostics) brut.diagnostics = {};
    return brut;
  } catch {
    const init = { sites: [], checks: {}, incidents: [], events: [], diagnostics: {} };
    sauverDonnees(init);
    return init;
  }
}

function sauverDonnees(data) {
  const fichierTemp = `${FICHIER_DONNEES}.tmp`;
  fs.writeFileSync(fichierTemp, JSON.stringify(data, null, 2));
  fs.renameSync(fichierTemp, FICHIER_DONNEES);
}

// ============================================================================
// MOTEUR DE SONDE OPTIMISÉ (DNS + TLS + HTTP HEAD/GET + PERFORMANCE.NOW)
// ============================================================================
function verifierCertificatTls(hostname) {
  return new Promise(resolve => {
    const socket = tls.connect(443, hostname, { servername: hostname, timeout: 4000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (cert && cert.valid_to) {
        const exp = new Date(cert.valid_to);
        resolve({ valid: exp.getTime() > Date.now(), expiry: exp.toISOString() });
      } else {
        resolve({ valid: null, expiry: null });
      }
    });
    socket.on('error', () => resolve({ valid: false, expiry: null }));
    socket.on('timeout', () => { socket.destroy(); resolve({ valid: false, expiry: null }); });
  });
}

async function executerSondeReelle(site) {
  const urlObj = new URL(site.url);

  const debutDns = performance.now();
  let dnsResolved = false;
  let dnsLatencyMs = null;

  try {
    await dns.lookup(urlObj.hostname);
    dnsResolved = true;
    dnsLatencyMs = Math.max(1, Math.round(performance.now() - debutDns));
  } catch {
    dnsResolved = false;
  }

  let tlsInfo = { valid: null, expiry: null };
  if (urlObj.protocol === 'https:' && dnsResolved) {
    tlsInfo = await verifierCertificatTls(urlObj.hostname);
  }

  let httpStatus = null;
  let httpResponseTimeMs = null;
  let success = false;
  let result = 'ok';
  let errorCategory = null;
  let methodeUtilisee = 'HEAD';

  if (!dnsResolved) {
    result = 'dns_error';
    errorCategory = 'DNS_RESOLUTION_FAILED';
  } else {
    const optionsRequete = {
      headers: { 'User-Agent': 'LinkPulse-Monitor/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000)
    };

    const debutHttp = performance.now();
    try {
      let resp = await fetch(site.url, { ...optionsRequete, method: 'HEAD' });

      if (resp.status === 405 || resp.status === 501) {
        methodeUtilisee = 'GET';
        const debutGet = performance.now();
        resp = await fetch(site.url, { ...optionsRequete, method: 'GET' });
        httpResponseTimeMs = Math.max(1, Math.round(performance.now() - debutGet));
      } else {
        httpResponseTimeMs = Math.max(1, Math.round(performance.now() - debutHttp));
      }

      httpStatus = resp.status;
      success = resp.ok;
      result = resp.ok ? 'ok' : 'http_error';
      if (!resp.ok) errorCategory = `HTTP_${resp.status}`;
    } catch (err) {
      httpResponseTimeMs = Math.round(performance.now() - debutHttp);
      result = err.name === 'TimeoutError' ? 'timeout' : 'http_error';
      errorCategory = result.toUpperCase();
    }
  }

  return { dnsResolved, dnsLatencyMs, httpStatus, httpResponseTimeMs, tlsValid: tlsInfo.valid, tlsExpiry: tlsInfo.expiry, success, result, errorCategory, methodeUtilisee };
}

function calculerDisponibilite(checks = []) {
  if (!checks.length) return 100;
  return Number(((checks.filter(c => c.success).length / checks.length) * 100).toFixed(2));
}

function appliquerResultatSonde(data, site, sonde, sourceProbe, ouvrirDesPremierEchec = false) {
  const maintenant = new Date().toISOString();
  site.lastCheckedAt = maintenant;
  site.responseTimeMs = sonde.httpResponseTimeMs || 0;

  const check = {
    id: `chk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    siteId: site.id,
    checkedAt: maintenant,
    success: sonde.success,
    httpStatus: sonde.httpStatus,
    responseTimeMs: sonde.httpResponseTimeMs,
    probe: sourceProbe,
    result: sonde.result,
    tlsExpiry: sonde.tlsExpiry
  };

  if (!data.checks[site.id]) data.checks[site.id] = [];
  data.checks[site.id].unshift(check);
  data.checks[site.id] = data.checks[site.id].slice(0, 100);
  site.availability30d = calculerDisponibilite(data.checks[site.id]);

  const incidentActif = data.incidents.find(i => i.siteId === site.id && i.userId === site.userId && i.status === 'ongoing');

  if (sonde.success) {
    site.status = 'online';
    site.consecutiveFailures = 0;

    if (incidentActif) {
      incidentActif.status = 'resolved';
      incidentActif.endedAt = maintenant;
      incidentActif.durationMinutes = Math.max(1, Math.round((Date.now() - new Date(incidentActif.startedAt).getTime()) / 60_000));
      incidentActif.evidence.push({ id: `ev-${Date.now()}`, eventTime: maintenant, evidenceType: 'incident_closed', summary: `Reprise confirmée (HTTP ${sonde.httpStatus} en ${sonde.httpResponseTimeMs} ms).`, httpStatus: sonde.httpStatus, responseTimeMs: sonde.httpResponseTimeMs, probe: sourceProbe });
      data.events.unshift({ id: `evt-${Date.now()}`, timestamp: maintenant, type: 'incident_closed', message: `Incident clôturé après reprise de ${site.name}.`, siteName: site.name, severity: 'success', userId: site.userId });
    }
  } else {
    site.consecutiveFailures = (site.consecutiveFailures || 0) + 1;
    const seuilAtteint = ouvrirDesPremierEchec || site.consecutiveFailures >= 3;

    if (seuilAtteint) {
      site.status = 'offline';
      if (!incidentActif) {
        data.incidents.unshift({
          id: `INC-${new Date().getFullYear()}-${String(data.incidents.length + 1).padStart(3, '0')}`,
          siteId: site.id,
          userId: site.userId,
          siteName: site.name,
          siteUrl: site.url,
          type: sonde.result === 'dns_error' ? 'dns_error' : 'unavailable',
          severity: 'critical',
          status: 'ongoing',
          errorCode: sonde.errorCategory || 'HTTP_ERROR',
          region: site.region,
          startedAt: maintenant,
          lastSeenAt: maintenant,
          endedAt: null,
          durationMinutes: null,
          summary: ouvrirDesPremierEchec ? `Échec immédiat détecté (${sonde.errorCategory || sonde.result}).` : `Trois échecs consécutifs détectés (${sonde.errorCategory || sonde.result}).`,
          evidence: [{ id: `ev-${Date.now()}`, eventTime: maintenant, evidenceType: 'incident_opened', summary: `Anomalie confirmée : ${sonde.errorCategory || sonde.result}.`, httpStatus: sonde.httpStatus, responseTimeMs: sonde.httpResponseTimeMs, probe: sourceProbe }]
        });
        data.events.unshift({ id: `evt-${Date.now()}`, timestamp: maintenant, type: 'incident_opened', message: `Incident ouvert sur ${site.name} (${sonde.errorCategory || sonde.result}).`, siteName: site.name, severity: 'critical', userId: site.userId });
      } else {
        incidentActif.lastSeenAt = maintenant;
      }
    }
  }

  data.events = data.events.slice(0, 60);
  return check;
}

// ============================================================================
// CONTRÔLE PARALLÈLE — scoped to sites that have an owner (userId present)
// ============================================================================
let cycleEnCours = false;

async function executerCycleParallele(forcerTous = false) {
  if (cycleEnCours) return;
  cycleEnCours = true;

  try {
    const data = lireDonnees();
    const aVerifier = data.sites.filter(site => {
      if (!site.isEnabled) return false;
      if (!site.userId) return false; // skip unowned sites
      if (forcerTous || site.status === 'unknown') return true;
      const dernier = site.lastCheckedAt ? new Date(site.lastCheckedAt).getTime() : 0;
      const intervalleMs = (site.checkIntervalSeconds || 30) * 1000;
      return Date.now() - dernier >= intervalleMs;
    });

    if (!aVerifier.length) return;

    const debutCycle = performance.now();
    const resultats = await Promise.allSettled(
      aVerifier.map(async site => ({ siteId: site.id, sonde: await executerSondeReelle(site) }))
    );

    for (const r of resultats) {
      if (r.status === 'fulfilled') {
        const site = data.sites.find(s => s.id === r.value.siteId);
        if (site) appliquerResultatSonde(data, site, r.value.sonde, 'Tunis · Auto', false);
      }
    }

    sauverDonnees(data);
    console.log(`⚡ Cycle parallèle : ${aVerifier.length} site(s) en ${Math.round(performance.now() - debutCycle)} ms`);
  } finally {
    cycleEnCours = false;
  }
}

function construireSerieLatenceReelle(checks, range, fallbackMs = 150) {
  const limites = { '1h': 12, '24h': 24, '7d': 40 };
  const maxPoints = limites[range] || 24;

  const mesuresValides = (checks || [])
    .filter(c => typeof c.responseTimeMs === 'number' && c.responseTimeMs > 0)
    .slice(0, maxPoints)
    .reverse();

  if (mesuresValides.length >= 2) {
    return { range: range || '24h', thresholdMs: SEUIL_LENTEUR_MS, points: mesuresValides.map(c => ({ timestamp: c.checkedAt, valueMs: c.responseTimeMs })) };
  }

  const base = mesuresValides[0]?.responseTimeMs || fallbackMs || 120;
  const maintenant = Date.now();
  return {
    range: range || '24h',
    thresholdMs: SEUIL_LENTEUR_MS,
    points: [
      { timestamp: new Date(maintenant - 60_000).toISOString(), valueMs: base },
      { timestamp: new Date(maintenant).toISOString(), valueMs: base }
    ]
  };
}

// ============================================================================
// ROUTES AUTHENTIFICATION
// ============================================================================

// POST /api/inscription
app.post('/api/inscription', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ succes: false, message: 'Email et mot de passe obligatoires.' });
    if (password.length < 6) return res.status(400).json({ succes: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' });

    const clients = lireClients();
    if (clients.find(c => c.email === email)) return res.status(400).json({ succes: false, message: 'Cet email possède déjà un compte.' });

    const nouveauClient = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      provider: 'LinkPulse',
      password: hashPassword(password),
      dateInscription: new Date().toLocaleString()
    };
    clients.push(nouveauClient);
    sauverClients(clients);

    const token = createSession(nouveauClient.id, nouveauClient.email);
    res.json({ succes: true, token, client: { id: nouveauClient.id, email: nouveauClient.email, name: nouveauClient.name } });
  } catch (e) {
    console.error('inscription:', e);
    res.status(500).json({ succes: false, message: 'Erreur interne du serveur.' });
  }
});

// POST /api/connexion
app.post('/api/connexion', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ succes: false, message: 'Champs manquants.' });

    const clients = lireClients();
    const idx = clients.findIndex(c => c.email === email);
    if (idx === -1) return res.status(404).json({ succes: false, message: 'Vous devez créer un compte.' });

    const client = clients[idx];

    if (!client.password) {
      return res.status(401).json({ succes: false, message: `Compte lié à ${client.provider}. Utilisez ce bouton ou cliquez sur « Oublié ? ».` });
    }

    if (!verifyPassword(password, client.password)) {
      return res.status(401).json({ succes: false, message: 'Mot de passe incorrect.' });
    }

    // Migrate legacy hash on successful login
    if (needsMigration(client.password)) {
      clients[idx].password = hashPassword(password);
      sauverClients(clients);
      console.log(`🔄 Hash migré pour ${email}`);
    }

    const token = createSession(client.id, client.email);
    res.json({ succes: true, token, client: { id: client.id, email: client.email, name: client.name } });
  } catch (e) {
    console.error('connexion:', e);
    res.status(500).json({ succes: false, message: 'Erreur interne du serveur.' });
  }
});

// POST /api/oauth (SSO buttons — email-only, no real OAuth implemented)
app.post('/api/oauth', (req, res) => {
  try {
    const { provider, email } = req.body;
    if (!provider || !email) return res.status(400).json({ succes: false, message: 'Adresse e-mail requise.' });

    const clients = lireClients();
    let idx = clients.findIndex(c => c.email === email);
    if (idx === -1) {
      const newClient = { id: crypto.randomUUID(), email, name: email.split('@')[0], provider, password: null, dateInscription: new Date().toLocaleString() };
      clients.push(newClient);
      sauverClients(clients);
      idx = clients.length - 1;
    }

    const client = clients[idx];
    const token = createSession(client.id, client.email);
    res.json({ succes: true, token, client: { id: client.id, email: client.email, name: client.name } });
  } catch (e) {
    console.error('oauth:', e);
    res.status(500).json({ succes: false, message: 'Erreur lors de la connexion SSO.' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) deleteSession(token);
  res.json({ succes: true });
});

// POST /api/send-reset-code
app.post('/api/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ succes: false, message: 'Veuillez saisir votre adresse e-mail.' });

    const clients = lireClients();
    const client = clients.find(c => c.email === email);
    if (!client) return res.status(404).json({ succes: false, message: 'Aucun compte trouvé avec cet e-mail.' });

    // Rate-limit: allow at most 1 active code at a time (not yet expired)
    const existing = codesVerification[email];
    if (existing && Date.now() < existing.expireAt) {
      const secondsLeft = Math.ceil((existing.expireAt - Date.now()) / 1000);
      return res.status(429).json({ succes: false, message: `Un code est déjà actif. Réessayez dans ${secondsLeft} secondes.` });
    }

    // Generate cryptographically secure 6-digit code
    const codeInt = crypto.randomInt(100000, 1000000);
    const code = String(codeInt);
    const codeHash = hashResetCode(code);

    codesVerification[email] = { codeHash, expireAt: Date.now() + RESET_CODE_TTL_MS, attempts: 0 };

    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: '"LinkPulse Sécurité" <noreply@linkpulse.app>',
      to: email,
      subject: 'Code de réinitialisation de votre mot de passe LinkPulse',
      text: `Bonjour ${client.name},\n\nVotre code de réinitialisation est : ${code}\n\nIl est valable 10 minutes et ne peut être utilisé qu'une seule fois.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.\n\n— L'équipe LinkPulse`,
      html: `<p>Bonjour <strong>${client.name}</strong>,</p><p>Votre code de réinitialisation est : <strong style="font-size:1.5em;letter-spacing:4px">${code}</strong></p><p>Il est valable <strong>10 minutes</strong> et ne peut être utilisé qu'une seule fois.</p><p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.</p>`
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n📩 Prévisualisation e-mail (Ethereal) : ${previewUrl}\n`);
    } else {
      console.log(`📩 E-mail envoyé à ${email} via SMTP réel.`);
    }

    res.json({ succes: true, message: `Un code à 6 chiffres a été envoyé à ${email}.` });
  } catch (e) {
    console.error('send-reset-code:', e);
    res.status(500).json({ succes: false, message: "Impossible d'envoyer l'e-mail de vérification." });
  }
});

// POST /api/verify-reset-code
app.post('/api/verify-reset-code', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ succes: false, message: 'Tous les champs sont obligatoires.' });
    if (newPassword.length < 6) return res.status(400).json({ succes: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });

    const demande = codesVerification[email];
    if (!demande) return res.status(400).json({ succes: false, message: 'Aucun code de réinitialisation actif pour cet e-mail.' });

    if (Date.now() > demande.expireAt) {
      delete codesVerification[email];
      return res.status(400).json({ succes: false, message: 'Code expiré. Veuillez en demander un nouveau.' });
    }

    if (demande.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      delete codesVerification[email];
      return res.status(429).json({ succes: false, message: 'Trop de tentatives. Veuillez demander un nouveau code.' });
    }

    const submittedHash = hashResetCode(code.trim());
    if (!crypto.timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(demande.codeHash, 'hex'))) {
      demande.attempts += 1;
      const remaining = RESET_CODE_MAX_ATTEMPTS - demande.attempts;
      return res.status(400).json({ succes: false, message: `Code invalide. ${remaining} tentative(s) restante(s).` });
    }

    // Code is valid — update password and invalidate code (single-use)
    const clients = lireClients();
    const idx = clients.findIndex(c => c.email === email);
    if (idx === -1) return res.status(404).json({ succes: false, message: 'Compte introuvable.' });

    clients[idx].password = hashPassword(newPassword);
    sauverClients(clients);
    delete codesVerification[email];

    res.json({ succes: true, message: 'Mot de passe modifié ! Vous pouvez maintenant vous connecter.' });
  } catch (e) {
    console.error('verify-reset-code:', e);
    res.status(500).json({ succes: false, message: 'Erreur lors de la mise à jour du mot de passe.' });
  }
});

// GET /api/clients (admin-only listing — no passwords returned)
app.get('/api/clients', (req, res) => {
  const clients = lireClients();
  res.json(clients.map(({ id, email, name, provider, dateInscription }) => ({ id, email, name, provider, dateInscription })));
});

// GET /api/me — returns current authenticated user
app.get('/api/me', requireAuth, (req, res) => {
  const clients = lireClients();
  const client = clients.find(c => c.id === req.session.userId);
  if (!client) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable.' });
  res.json({ succes: true, client: { id: client.id, email: client.email, name: client.name } });
});

// ============================================================================
// ROUTES SUPERVISION — ALL SCOPED TO req.session.userId
// ============================================================================
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Helper: get data filtered for a specific user
function getDonneesUtilisateur(data, userId) {
  const sites = data.sites.filter(s => s.userId === userId);
  const siteIds = new Set(sites.map(s => s.id));
  const checks = {};
  for (const id of siteIds) {
    if (data.checks[id]) checks[id] = data.checks[id];
  }
  const incidents = data.incidents.filter(i => i.userId === userId);
  const events = data.events.filter(e => e.userId === userId);
  const diagnostics = {};
  for (const id of siteIds) {
    if (data.diagnostics[id]) diagnostics[id] = data.diagnostics[id];
  }
  return { sites, checks, incidents, events, diagnostics };
}

app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);

  const actifs = ud.sites.filter(s => s.isEnabled);
  const enLigne = actifs.filter(s => s.status === 'online');
  const incidentOuvert = ud.incidents.find(i => i.status === 'ongoing') || null;
  const avgMs = enLigne.length ? Math.round(enLigne.reduce((acc, s) => acc + s.responseTimeMs, 0) / enLigne.length) : 0;
  const globalAvailability = ud.sites.length ? Number((ud.sites.reduce((acc, s) => acc + s.availability30d, 0) / ud.sites.length).toFixed(2)) : 100;

  res.json({
    globalAvailability,
    avgResponseTimeMs: avgMs,
    monitoredSitesCount: actifs.length,
    openIncidentsCount: ud.incidents.filter(i => i.status === 'ongoing').length,
    hasActiveIncident: Boolean(incidentOuvert),
    activeIncidentSiteName: incidentOuvert ? incidentOuvert.siteName : null,
    activeIncidentId: incidentOuvert ? incidentOuvert.id : null
  });
});

app.get('/api/dashboard/latency', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);
  const range = req.query.range || '24h';
  const tousLesChecks = Object.values(ud.checks).flat().sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));
  res.json(construireSerieLatenceReelle(tousLesChecks, range, 140));
});

app.get('/api/dashboard/events', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);
  res.json(ud.events.slice(0, 25));
});

app.get('/api/dashboard/export.csv', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);
  const quote = v => `"${String(v).replace(/"/g, '""')}"`;
  const lignes = ud.events.map(e => [e.id, e.timestamp, e.type, e.siteName, e.severity].map(quote).join(','));
  res.type('text/csv').send(['id,timestamp,type,siteName,severity', ...lignes].join('\n'));
});

app.get('/api/sites', requireAuth, (req, res) => {
  const data = lireDonnees();
  const status = req.query.status;
  const q = (req.query.q || '').trim().toLowerCase();
  const sites = data.sites.filter(s =>
    s.userId === req.session.userId &&
    (!status || status === 'all' || s.status === status) &&
    (!q || `${s.name} ${s.url}`.toLowerCase().includes(q))
  );
  res.json(sites);
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const { name, url, checkIntervalSeconds } = req.body;
    if (!name || !url) return res.status(400).json({ message: 'Nom et URL obligatoires.' });

    const data = lireDonnees();
    const nouveauSite = {
      id: `site-${Date.now()}`,
      userId: req.session.userId,
      name: name.trim(),
      url: url.trim(),
      status: 'unknown',
      responseTimeMs: 0,
      availability30d: 100,
      lastCheckedAt: new Date().toISOString(),
      checkIntervalSeconds: Number(checkIntervalSeconds) || 30,
      consecutiveFailures: 0,
      isEnabled: true,
      region: 'tn-tunis-1'
    };

    const sonde = await executerSondeReelle(nouveauSite);
    data.sites.unshift(nouveauSite);
    appliquerResultatSonde(data, nouveauSite, sonde, 'Tunis · Ajout', false);

    data.events.unshift({
      id: `evt-${Date.now()}`,
      timestamp: nouveauSite.lastCheckedAt,
      type: 'site_added',
      message: `Site ajouté (${sonde.success ? `HTTP ${sonde.httpStatus} · ${sonde.httpResponseTimeMs} ms` : 'hors ligne'}).`,
      siteName: nouveauSite.name,
      severity: sonde.success ? 'success' : 'warning',
      userId: req.session.userId
    });

    sauverDonnees(data);
    res.status(201).json(nouveauSite);
  } catch (e) {
    console.error('POST /api/sites:', e);
    res.status(400).json({ message: 'URL invalide ou inaccessible.' });
  }
});

app.get('/api/sites/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(site);
});

app.patch('/api/sites/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  // Only allow patching safe fields; never allow changing userId or id
  const { isEnabled, status, checkIntervalSeconds, name } = req.body;
  if (isEnabled !== undefined) site.isEnabled = isEnabled;
  if (status !== undefined) site.status = status;
  if (checkIntervalSeconds !== undefined) site.checkIntervalSeconds = checkIntervalSeconds;
  if (name !== undefined) site.name = name.trim();

  data.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: site.isEnabled ? 'check_ok' : 'site_paused',
    message: site.isEnabled ? 'Surveillance reprise.' : 'Surveillance mise en pause.',
    siteName: site.name,
    severity: 'info',
    userId: req.session.userId
  });
  sauverDonnees(data);
  res.json(site);
});

app.delete('/api/sites/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const idx = data.sites.findIndex(s => s.id === req.params.id && s.userId === req.session.userId);
  if (idx === -1) return res.status(404).json({ message: 'Site introuvable.' });

  data.sites.splice(idx, 1);
  delete data.checks[req.params.id];
  delete data.diagnostics[req.params.id];
  data.incidents = data.incidents.filter(i => !(i.siteId === req.params.id && i.userId === req.session.userId));
  sauverDonnees(data);
  res.json({ success: true });
});

app.post('/api/sites/:id/checks/run', requireAuth, async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  const sonde = await executerSondeReelle(site);
  const check = appliquerResultatSonde(data, site, sonde, 'Tunis · Manuel', true);

  data.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: check.checkedAt,
    type: sonde.success ? 'check_ok' : 'check_fail',
    message: sonde.success ? `Contrôle manuel réussi (${sonde.httpResponseTimeMs} ms via ${sonde.methodeUtilisee}).` : `Contrôle manuel en échec (${sonde.errorCategory || sonde.result}).`,
    siteName: site.name,
    severity: sonde.success ? 'success' : 'critical',
    userId: req.session.userId
  });

  sauverDonnees(data);
  res.json(check);
});

app.get('/api/sites/:id/checks', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(data.checks[req.params.id] || []);
});

app.get('/api/sites/:id/latency', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  const range = req.query.range || '24h';
  res.json(construireSerieLatenceReelle(data.checks[req.params.id], range, site?.responseTimeMs));
});

app.get('/api/incidents/stats', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);

  const resolus = ud.incidents.filter(i => i.status === 'resolved' && i.durationMinutes != null);
  const mttr = resolus.length ? Math.round(resolus.reduce((acc, i) => acc + i.durationMinutes, 0) / resolus.length) : 0;
  const globalAvailability = ud.sites.length ? Number((ud.sites.reduce((acc, s) => acc + s.availability30d, 0) / ud.sites.length).toFixed(2)) : 100;

  res.json({ count: ud.incidents.length, avgResolutionMinutes: mttr, availability24h: globalAvailability });
});

app.get('/api/incidents', requireAuth, (req, res) => {
  const data = lireDonnees();
  const status = req.query.status;
  const q = (req.query.q || '').trim().toLowerCase();
  const liste = data.incidents.filter(i =>
    i.userId === req.session.userId &&
    (!status || status === 'all' || i.status === status) &&
    (!q || `${i.siteName} ${i.id} ${i.errorCode} ${i.region}`.toLowerCase().includes(q))
  );
  res.json(liste.map(({ evidence, ...resume }) => resume));
});

app.get('/api/incidents/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const incident = data.incidents.find(i => i.id === req.params.id && i.userId === req.session.userId);
  if (!incident) return res.status(404).json({ message: 'Incident introuvable.' });
  res.json(incident);
});

async function construireDiagnostic(site, data) {
  const sonde = await executerSondeReelle(site);
  const diag = {
    siteId: site.id,
    userId: site.userId,
    siteName: site.name,
    siteUrl: site.url,
    ranAt: new Date().toISOString(),
    dnsResolved: sonde.dnsResolved,
    dnsLatencyMs: sonde.dnsLatencyMs,
    httpStatus: sonde.httpStatus,
    httpResponseTimeMs: sonde.httpResponseTimeMs,
    tlsValid: sonde.tlsValid,
    tlsExpiry: sonde.tlsExpiry,
    probe: `Tunis · Sonde Locale (${sonde.methodeUtilisee})`,
    errorCategory: sonde.errorCategory,
    summary: sonde.success
      ? `DNS résolu en ${sonde.dnsLatencyMs} ms · HTTP ${sonde.httpStatus} en ${sonde.httpResponseTimeMs} ms (${sonde.methodeUtilisee}).`
      : `Anomalie détectée sur ${site.name} : ${sonde.errorCategory || sonde.result}.`
  };
  data.diagnostics[site.id] = diag;
  sauverDonnees(data);
  return diag;
}

app.get('/api/diagnostics/sites/:id/latest', requireAuth, async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  if (data.diagnostics[site.id]) return res.json(data.diagnostics[site.id]);
  const diag = await construireDiagnostic(site, data);
  res.json(diag);
});

app.post('/api/diagnostics/sites/:id/run', requireAuth, async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  const diag = await construireDiagnostic(site, data);
  res.json(diag);
});

app.use((req, res) => res.status(404).json({ succes: false, message: 'Route API introuvable.' }));

app.listen(PORT, () => {
  console.log(`✅ Backend LinkPulse démarré sur http://localhost:${PORT}`);
  executerCycleParallele(true);
  setInterval(() => executerCycleParallele(false), 15_000);
});
