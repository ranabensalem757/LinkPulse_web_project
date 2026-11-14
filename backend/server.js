const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const FICHIER_CLIENTS = './clients.json';

// ==========================================
// CONFIGURATION E-MAIL AUTOMATIQUE (SANS GMAIL)
// ==========================================
const transporterPromise = nodemailer.createTestAccount().then(compteTest => {
  console.log('📧 Service d’envoi d’e-mails prêt.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: compteTest.user,
      pass: compteTest.pass
    }
  });
});

// Stockage temporaire des codes envoyés (valables 10 minutes)
const codesVerification = {};

app.use(cors());
app.use(express.json());

if (!fs.existsSync(FICHIER_CLIENTS)) {
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify([], null, 2));
}

function securiserMotDePasse(mdp) {
  return crypto.createHash('sha256').update(mdp).digest('hex');
}

// API 1 : CRÉER UN COMPTE
app.post('/api/inscription', (req, res) => {
  try {
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
      email,
      name: email.split('@')[0],
      provider: 'LinkPulse',
      password: securiserMotDePasse(password),
      dateInscription: new Date().toLocaleString()
    };

    clients.push(nouveauClient);
    fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify(clients, null, 2));

    res.json({
      succes: true,
      client: { id: nouveauClient.id, email: nouveauClient.email, name: nouveauClient.name }
    });
  } catch (err) {
    res.status(500).json({ succes: false, message: "Erreur interne du serveur." });
  }
});

// API 2 : SE CONNECTER
app.post('/api/connexion', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ succes: false, message: "Champs manquants." });
    }

    const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
    const clientExiste = clients.find(c => c.email === email);

    if (!clientExiste) {
      return res.status(404).json({ succes: false, message: "Vous devez créer un compte." });
    }

    if (!clientExiste.password) {
      return res.status(401).json({
        succes: false,
        message: `Compte lié à ${clientExiste.provider}. Utilisez ce bouton ou cliquez sur « Oublié ? ».`
      });
    }

    if (clientExiste.password !== securiserMotDePasse(password)) {
      return res.status(401).json({ succes: false, message: "Mot de passe incorrect." });
    }

    res.json({
      succes: true,
      client: { id: clientExiste.id, email: clientExiste.email, name: clientExiste.name }
    });
  } catch (err) {
    res.status(500).json({ succes: false, message: "Erreur interne du serveur." });
  }
});

// API 3 : CONNEXION GOOGLE / GITHUB (OAuth)
app.post('/api/oauth', (req, res) => {
  try {
    const { provider, email } = req.body;
    if (!provider || !email) {
      return res.status(400).json({ succes: false, message: "Adresse e-mail requise." });
    }

    const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
    let client = clients.find(c => c.email === email);

    if (!client) {
      client = {
        id: String(Date.now()),
        email,
        name: email.split('@')[0],
        provider,
        password: null,
        dateInscription: new Date().toLocaleString()
      };
      clients.push(client);
      fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify(clients, null, 2));
    }

    res.json({
      succes: true,
      client: { id: client.id, email: client.email, name: client.name }
    });
  } catch (err) {
    res.status(500).json({ succes: false, message: "Erreur lors de la connexion SSO." });
  }
});

// API 4.A : ENVOYER LE CODE DE VÉRIFICATION À N'IMPORTE QUEL UTILISATEUR
app.post('/api/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ succes: false, message: "Veuillez saisir votre adresse e-mail." });
    }

    const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
    const clientExiste = clients.find(c => c.email === email);

    if (!clientExiste) {
      return res.status(404).json({ succes: false, message: "Aucun compte trouvé avec cet e-mail." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    codesVerification[email] = {
      code,
      expireAt: Date.now() + 10 * 60 * 1000
    };

    const transporter = await transporterPromise;
    const info = await transporter.sendMail({
      from: '"LinkPulse Sécurité" <noreply@linkpulse.app>',
      to: email,
      subject: 'Code de réinitialisation de votre mot de passe LinkPulse',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Réinitialisation de mot de passe</h2>
          <p>Bonjour <strong>${clientExiste.name}</strong>,</p>
          <p>Voici votre code de vérification à recopier sur le site LinkPulse :</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; background: #0f172a; color: #38bdf8; display: inline-block; border-radius: 8px;">
            ${code}
          </div>
          <p style="color: #64748b; margin-top: 16px;">Ce code est valable pendant 10 minutes.</p>
        </div>
      `
    });

    const lienApercu = nodemailer.getTestMessageUrl(info);
    console.log(`\n📩 E-mail envoyé à ${email}`);
    console.log(`🔗 Cliquez ici pour ouvrir l'e-mail reçu : ${lienApercu}\n`);

    res.json({
      succes: true,
      message: `Un code à 6 chiffres a été envoyé à ${email}.`
    });
  } catch (err) {
    console.error("Erreur envoi mail :", err);
    res.status(500).json({
      succes: false,
      message: "Impossible d'envoyer l'e-mail de vérification."
    });
  }
});

// API 4.B : VÉRIFIER LE CODE ET CHANGER LE MOT DE PASSE
app.post('/api/verify-reset-code', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ succes: false, message: "Tous les champs sont obligatoires." });
    }

    const demande = codesVerification[email];
    if (!demande) {
      return res.status(400).json({ succes: false, message: "Aucun code demandé pour cet e-mail." });
    }

    if (Date.now() > demande.expireAt) {
      delete codesVerification[email];
      return res.status(400).json({ succes: false, message: "Code expiré. Demandez-en un nouveau." });
    }

    if (demande.code !== code.trim()) {
      return res.status(400).json({ succes: false, message: "Code de vérification incorrect." });
    }

    const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
    const index = clients.findIndex(c => c.email === email);

    if (index === -1) {
      return res.status(404).json({ succes: false, message: "Compte introuvable." });
    }

    clients[index].password = securiserMotDePasse(newPassword);
    fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify(clients, null, 2));
    delete codesVerification[email];

    res.json({ succes: true, message: "Mot de passe modifié ! Vous pouvez maintenant vous connecter." });
  } catch (err) {
    res.status(500).json({ succes: false, message: "Erreur lors de la mise à jour du mot de passe." });
  }
});

// API 5 : LISTE DES CLIENTS
app.get('/api/clients', (req, res) => {
  const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
  res.json(clients);
});

app.use((req, res) => {
  res.status(404).json({ succes: false, message: "Route API introuvable." });
});

app.listen(PORT, () => {
  console.log(`✅ Backend LinkPulse démarré sur http://localhost:${PORT}`);
});