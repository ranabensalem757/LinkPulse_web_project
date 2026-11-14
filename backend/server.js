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
// CONFIGURATION E-MAIL AUTOMATIQUE (ETHEREAL)
// ============================================================================
const transporterPromise = nodemailer.createTestAccount().then(compteTest => {
  console.log('📧 Service d’envoi d’e-mails prêt.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: compteTest.user, pass: compteTest.pass }
  });
});

const codesVerification = {};

app.use(cors());
app.use(express.json());

if (!fs.existsSync(FICHIER_CLIENTS)) {
  fs.writeFileSync(FICHIER_CLIENTS, JSON.stringify([], null, 2));
}

function securiserMotDePasse(mdp) {
  return crypto.createHash('sha256').update(mdp).digest('hex');
}

// ============================================================================
// GESTION SÉCURISÉE DES DONNÉES (ÉCRITURE ATOMIQUE)
// ============================================================================
function creerDonneesInitiales() {
  const maintenant = new Date().toISOString();
  return {
    sites: [
      {
        id: 'site-1',
        name: 'Portail Sup’Com',
        url: 'https://www.supcom.tn',
        status: 'unknown',
        responseTimeMs: 0,
        availability30d: 100,
        lastCheckedAt: maintenant,
        checkIntervalSeconds: 30,
        consecutiveFailures: 0,
        isEnabled: true,
        region: 'tn-tunis-1'
      },
      {
        id: 'site-2',
        name: 'Google',
        url: 'https://www.google.com',
        status: 'unknown',
        responseTimeMs: 0,
        availability30d: 100,
        lastCheckedAt: maintenant,
        checkIntervalSeconds: 30,
        consecutiveFailures: 0,
        isEnabled: true,
        region: 'eu-west-1'
      }
    ],
    checks: {},
    incidents: [],
    events: [],
    diagnostics: {}
  };
}

function lireDonnees() {
  try {
    if (!fs.existsSync(FICHIER_DONNEES)) {
      const init = creerDonneesInitiales();
      sauverDonnees(init);
      return init;
    }
    const brut = JSON.parse(fs.readFileSync(FICHIER_DONNEES, 'utf-8'));
    if (Array.isArray(brut) || !brut.sites) {
      const init = creerDonneesInitiales();
      sauverDonnees(init);
      return init;
    }
    return brut;
  } catch {
    const init = creerDonneesInitiales();
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
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ valid: false, expiry: null });
    });
  });
}

async function executerSondeReelle(site) {
  const urlObj = new URL(site.url);

  // 1. Résolution DNS chronométrée
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

  // 2. Vérification certificat TLS (HTTPS uniquement)
  let tlsInfo = { valid: null, expiry: null };
  if (urlObj.protocol === 'https:' && dnsResolved) {
    tlsInfo = await verifierCertificatTls(urlObj.hostname);
  }

  // 3. Requête HTTP légère (HEAD puis repli automatique sur GET si 405/501)
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

  return {
    dnsResolved,
    dnsLatencyMs,
    httpStatus,
    httpResponseTimeMs,
    tlsValid: tlsInfo.valid,
    tlsExpiry: tlsInfo.expiry,
    success,
    result,
    errorCategory,
    methodeUtilisee
  };
}

function calculerDisponibilite(checks = []) {
  if (!checks.length) return 100;
  const reussis = checks.filter(c => c.success).length;
  return Number(((reussis / checks.length) * 100).toFixed(2));
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

  const incidentActif = data.incidents.find(i => i.siteId === site.id && i.status === 'ongoing');

  if (sonde.success) {
    site.status = 'online';
    site.consecutiveFailures = 0;

    if (incidentActif) {
      incidentActif.status = 'resolved';
      incidentActif.endedAt = maintenant;
      incidentActif.durationMinutes = Math.max(
        1,
        Math.round((Date.now() - new Date(incidentActif.startedAt).getTime()) / 60_000)
      );
      incidentActif.evidence.push({
        id: `ev-${Date.now()}`,
        eventTime: maintenant,
        evidenceType: 'incident_closed',
        summary: `Reprise confirmée (HTTP ${sonde.httpStatus} en ${sonde.httpResponseTimeMs} ms).`,
        httpStatus: sonde.httpStatus,
        responseTimeMs: sonde.httpResponseTimeMs,
        probe: sourceProbe
      });
      data.events.unshift({
        id: `evt-${Date.now()}`,
        timestamp: maintenant,
        type: 'incident_closed',
        message: `Incident clôturé après reprise de ${site.name}.`,
        siteName: site.name,
        severity: 'success'
      });
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
          summary: ouvrirDesPremierEchec
            ? `Échec immédiat détecté (${sonde.errorCategory || sonde.result}).`
            : `Trois échecs consécutifs détectés (${sonde.errorCategory || sonde.result}).`,
          evidence: [
            {
              id: `ev-${Date.now()}`,
              eventTime: maintenant,
              evidenceType: 'incident_opened',
              summary: `Anomalie confirmée : ${sonde.errorCategory || sonde.result}.`,
              httpStatus: sonde.httpStatus,
              responseTimeMs: sonde.httpResponseTimeMs,
              probe: sourceProbe
            }
          ]
        });
        data.events.unshift({
          id: `evt-${Date.now()}`,
          timestamp: maintenant,
          type: 'incident_opened',
          message: `Incident ouvert sur ${site.name} (${sonde.errorCategory || sonde.result}).`,
          siteName: site.name,
          severity: 'critical'
        });
      } else {
        incidentActif.lastSeenAt = maintenant;
      }
    }
  }

  data.events = data.events.slice(0, 60);
  return check;
}

// ============================================================================
// CONTRÔLE PARALLÈLE DE TOUS LES SITES ACTIFS
// ============================================================================
let cycleEnCours = false;

async function executerCycleParallele(forcerTous = false) {
  if (cycleEnCours) return;
  cycleEnCours = true;

  try {
    const data = lireDonnees();
    const aVerifier = data.sites.filter(site => {
      if (!site.isEnabled) return false;
      if (forcerTous || site.status === 'unknown') return true;
      const dernier = site.lastCheckedAt ? new Date(site.lastCheckedAt).getTime() : 0;
      const intervalleMs = (site.checkIntervalSeconds || 30) * 1000;
      return Date.now() - dernier >= intervalleMs;
    });

    if (!aVerifier.length) return;

    const debutCycle = performance.now();
    // Exécution simultanée en parallèle (Promise.allSettled)
    const resultats = await Promise.allSettled(
      aVerifier.map(async site => ({
        siteId: site.id,
        sonde: await executerSondeReelle(site)
      }))
    );

    for (const r of resultats) {
      if (r.status === 'fulfilled') {
        const site = data.sites.find(s => s.id === r.value.siteId);
        if (site) {
          appliquerResultatSonde(data, site, r.value.sonde, 'Tunis · Auto', false);
        }
      }
    }

    sauverDonnees(data);
    const dureeTotale = Math.round(performance.now() - debutCycle);
    console.log(`⚡ Cycle parallèle terminé : ${aVerifier.length} site(s) vérifié(s) en ${dureeTotale} ms`);
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
    return {
      range: range || '24h',
      thresholdMs: SEUIL_LENTEUR_MS,
      points: mesuresValides.map(c => ({
        timestamp: c.checkedAt,
        valueMs: c.responseTimeMs
      }))
    };
  }

  // Si le site vient d'être ajouté (1 seule mesure), affiche la mesure réelle sans inventer de fausses variations
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
// ROUTES AUTHENTIFICATION (INCHANGÉES)
// ============================================================================
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
  } catch {
    res.status(500).json({ succes: false, message: "Erreur interne du serveur." });
  }
});

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
  } catch {
    res.status(500).json({ succes: false, message: "Erreur interne du serveur." });
  }
});

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
  } catch {
    res.status(500).json({ succes: false, message: "Erreur lors de la connexion SSO." });
  }
});

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
    codesVerification[email] = { code, expireAt: Date.now() + 10 * 60 * 1000 };

    const transporter = await transporterPromise;
    const info = await transporter.sendMail({
      from: '"LinkPulse Sécurité" <noreply@linkpulse.app>',
      to: email,
      subject: 'Code de réinitialisation de votre mot de passe LinkPulse',
      html: `<p>Bonjour <strong>${clientExiste.name}</strong>, votre code est : <strong>${code}</strong></p>`
    });
    console.log(`\n📩 E-mail envoyé à ${email} : ${nodemailer.getTestMessageUrl(info)}\n`);
    res.json({ succes: true, message: `Un code à 6 chiffres a été envoyé à ${email}.` });
  } catch {
    res.status(500).json({ succes: false, message: "Impossible d'envoyer l'e-mail de vérification." });
  }
});

app.post('/api/verify-reset-code', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ succes: false, message: "Tous les champs sont obligatoires." });
    }
    const demande = codesVerification[email];
    if (!demande || Date.now() > demande.expireAt || demande.code !== code.trim()) {
      return res.status(400).json({ succes: false, message: "Code invalide ou expiré." });
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
  } catch {
    res.status(500).json({ succes: false, message: "Erreur lors de la mise à jour du mot de passe." });
  }
});

app.get('/api/clients', (req, res) => {
  const clients = JSON.parse(fs.readFileSync(FICHIER_CLIENTS));
  res.json(clients.map(({ id, email, name, provider, dateInscription }) => ({
    id, email, name, provider, dateInscription
  })));
});

// ============================================================================
// ROUTES SUPERVISION : DASHBOARD, SITES, INCIDENTS & DIAGNOSTIC
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/dashboard/summary', (req, res) => {
  const data = lireDonnees();
  const actifs = data.sites.filter(s => s.isEnabled);
  const enLigne = actifs.filter(s => s.status === 'online');
  const incidentOuvert = data.incidents.find(i => i.status === 'ongoing') || null;
  const avgMs = enLigne.length
    ? Math.round(enLigne.reduce((acc, s) => acc + s.responseTimeMs, 0) / enLigne.length)
    : 0;
  const globalAvailability = data.sites.length
    ? Number((data.sites.reduce((acc, s) => acc + s.availability30d, 0) / data.sites.length).toFixed(2))
    : 100;

  res.json({
    globalAvailability,
    avgResponseTimeMs: avgMs,
    monitoredSitesCount: actifs.length,
    openIncidentsCount: data.incidents.filter(i => i.status === 'ongoing').length,
    hasActiveIncident: Boolean(incidentOuvert),
    activeIncidentSiteName: incidentOuvert ? incidentOuvert.siteName : null,
    activeIncidentId: incidentOuvert ? incidentOuvert.id : null
  });
});

app.get('/api/dashboard/latency', (req, res) => {
  const data = lireDonnees();
  const range = req.query.range || '24h';
  const tousLesChecks = Object.values(data.checks)
    .flat()
    .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));
  res.json(construireSerieLatenceReelle(tousLesChecks, range, 140));
});

app.get('/api/dashboard/events', (req, res) => {
  const data = lireDonnees();
  res.json(data.events.slice(0, 25));
});

app.get('/api/dashboard/export.csv', (req, res) => {
  const data = lireDonnees();
  const quote = v => `"${String(v).replace(/"/g, '""')}"`;
  const lignes = data.events.map(e =>
    [e.id, e.timestamp, e.type, e.siteName, e.severity].map(quote).join(',')
  );
  res.type('text/csv').send(['id,timestamp,type,siteName,severity', ...lignes].join('\n'));
});

app.get('/api/sites', (req, res) => {
  const data = lireDonnees();
  const status = req.query.status;
  const q = (req.query.q || '').trim().toLowerCase();
  const filtrés = data.sites.filter(s =>
    (!status || status === 'all' || s.status === status) &&
    (!q || `${s.name} ${s.url}`.toLowerCase().includes(q))
  );
  res.json(filtrés);
});

app.post('/api/sites', async (req, res) => {
  try {
    const { name, url, checkIntervalSeconds } = req.body;
    if (!name || !url) {
      return res.status(400).json({ message: 'Nom et URL obligatoires.' });
    }
    const data = lireDonnees();
    const nouveauSite = {
      id: `site-${Date.now()}`,
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
      severity: sonde.success ? 'success' : 'warning'
    });

    sauverDonnees(data);
    res.status(201).json(nouveauSite);
  } catch {
    res.status(400).json({ message: 'URL invalide ou inaccessible.' });
  }
});

app.get('/api/sites/:id', (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(site);
});

app.patch('/api/sites/:id', (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  Object.assign(site, req.body);
  data.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: site.isEnabled ? 'check_ok' : 'site_paused',
    message: site.isEnabled ? 'Surveillance reprise.' : 'Surveillance mise en pause.',
    siteName: site.name,
    severity: 'info'
  });
  sauverDonnees(data);
  res.json(site);
});

app.delete('/api/sites/:id', (req, res) => {
  const data = lireDonnees();
  data.sites = data.sites.filter(s => s.id !== req.params.id);
  delete data.checks[req.params.id];
  delete data.diagnostics[req.params.id];
  data.incidents = data.incidents.filter(i => i.siteId !== req.params.id);
  sauverDonnees(data);
  res.json({ success: true });
});

app.post('/api/sites/:id/checks/run', async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  const sonde = await executerSondeReelle(site);
  const check = appliquerResultatSonde(data, site, sonde, 'Tunis · Manuel', true);

  data.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: check.checkedAt,
    type: sonde.success ? 'check_ok' : 'check_fail',
    message: sonde.success
      ? `Contrôle manuel réussi (${sonde.httpResponseTimeMs} ms via ${sonde.methodeUtilisee}).`
      : `Contrôle manuel en échec (${sonde.errorCategory || sonde.result}).`,
    siteName: site.name,
    severity: sonde.success ? 'success' : 'critical'
  });

  sauverDonnees(data);
  res.json(check);
});

app.get('/api/sites/:id/checks', (req, res) => {
  const data = lireDonnees();
  res.json(data.checks[req.params.id] || []);
});

app.get('/api/sites/:id/latency', (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  const range = req.query.range || '24h';
  res.json(construireSerieLatenceReelle(data.checks[req.params.id], range, site?.responseTimeMs));
});

app.get('/api/incidents/stats', (req, res) => {
  const data = lireDonnees();
  const resolus = data.incidents.filter(i => i.status === 'resolved' && i.durationMinutes != null);
  const mttr = resolus.length
    ? Math.round(resolus.reduce((acc, i) => acc + i.durationMinutes, 0) / resolus.length)
    : 0;
  const globalAvailability = data.sites.length
    ? Number((data.sites.reduce((acc, s) => acc + s.availability30d, 0) / data.sites.length).toFixed(2))
    : 100;

  res.json({
    count: data.incidents.length,
    avgResolutionMinutes: mttr,
    availability24h: globalAvailability
  });
});

app.get('/api/incidents', (req, res) => {
  const data = lireDonnees();
  const status = req.query.status;
  const q = (req.query.q || '').trim().toLowerCase();
  const liste = data.incidents.filter(i =>
    (!status || status === 'all' || i.status === status) &&
    (!q || `${i.siteName} ${i.id} ${i.errorCode} ${i.region}`.toLowerCase().includes(q))
  );
  res.json(liste.map(({ evidence, ...resume }) => resume));
});

app.get('/api/incidents/:id', (req, res) => {
  const data = lireDonnees();
  const incident = data.incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident introuvable.' });
  res.json(incident);
});

async function construireDiagnostic(site, data) {
  const sonde = await executerSondeReelle(site);
  const diag = {
    siteId: site.id,
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

app.get('/api/diagnostics/sites/:id/latest', async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  if (data.diagnostics[site.id]) {
    return res.json(data.diagnostics[site.id]);
  }
  const diag = await construireDiagnostic(site, data);
  res.json(diag);
});

app.post('/api/diagnostics/sites/:id/run', async (req, res) => {
  const data = lireDonnees();
  const site = data.sites.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  const diag = await construireDiagnostic(site, data);
  res.json(diag);
});

app.use((req, res) => {
  res.status(404).json({ succes: false, message: "Route API introuvable." });
});

app.listen(PORT, () => {
  console.log(`✅ Backend LinkPulse optimisé démarré sur http://localhost:${PORT}`);
  executerCycleParallele(true);
  setInterval(() => executerCycleParallele(false), 15_000);
});