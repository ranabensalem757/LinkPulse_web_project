const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const FICHIER_CLIENTS = './clients.json';

app.use(cors());
app.use(express.json());

// Crée automatiquement clients.json s'il n'existe pas
if (!fs.existsSync(FICHIER_CLIENTS)) {
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify([], null, 2));
}

function securiserMotDePasse(mdp) {
  return crypto.createHash('sha256').update(mdp).digest('hex');
}

// API 1 : CRÉER UN COMPTE
app.post('/api/inscription', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ succes: false, message: "Email et mot de passe obligatoires." });
  }

  const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));

  if (clients.find(c => c.email === email)) {
    return res.status(400).json({ succes: false, message: "Cet email possède déjà un compte." });
  }

  const nouveauClient = {
    id: String(Date.now()),
    email: email,
    name: email.split('@')[0],
    password: securiserMotDePasse(password),
    dateInscription: new Date().toLocaleString()
  };

  clients.push(nouveauClient);
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify(clients, null, 2));

  res.json({
    succes: true,
    client: { id: nouveauClient.id, email: nouveauClient.email, name: nouveauClient.name }
  });
});

// API 2 : SE CONNECTER
app.post('/api/connexion', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ succes: false, message: "Champs manquants." });
  }

  const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
  const mdpSecurise = securiserMotDePasse(password);

  const clientTrouve = clients.find(c => c.email === email && c.password === mdpSecurise);

  if (!clientTrouve) {
    return res.status(401).json({ succes: false, message: "Email ou mot de passe incorrect." });
  }

  res.json({
    succes: true,
    client: { id: clientTrouve.id, email: clientTrouve.email, name: clientTrouve.name }
  });
});

// API 3 : VOIR TOUS LES CLIENTS INSCRITS
app.get('/api/clients', (req, res) => {
  const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
  res.json(clients);
});

// Garantit que toute erreur renvoie du JSON (et jamais du HTML)
app.use((req, res) => {
  res.status(404).json({ succes: false, message: "Route API introuvable sur le serveur." });
});

app.listen(PORT, () => {
  console.log(`✅ Backend LinkPulse démarré sur http://localhost:${PORT}`);
});