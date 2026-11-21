'use strict';

require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { promisify } = require('util');
const dns = require('dns').promises;
const tls = require('tls');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');

const scrypt = promisify(crypto.scrypt);

// ============================================================================
// CONFIGURATION (variables d'environnement — voir .env.example)
// ============================================================================
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const FICHIER_CLIENTS = path.join(DATA_DIR, 'clients.json');
const FICHIER_DONNEES = path.join(DATA_DIR, 'donnees.json');
const FICHIER_SESSIONS = path.join(DATA_DIR, 'sessions.json');

const EST_TEST = process.env.NODE_ENV === 'test';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200')
  .split(',').map(s => s.trim()).filter(Boolean);
// En développement uniquement : autorise la surveillance de localhost / réseau privé.
const autoriserCiblesPrivees = () => process.env.ALLOW_PRIVATE_TARGETS === 'true';

const SEUIL_LENTEUR_MS = 1500;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const INTERVALLE_MIN_S = 10;
const INTERVALLE_MAX_S = 86_400;
const INTERVALLE_DEFAUT_S = 30;
const MAX_SITES_PAR_UTILISATEUR = 50;
const MAX_CHECKS_BRUTS_PAR_SITE = 200;   // détail récent (liste + courbe 1h)
const MAX_EVENTS_PAR_UTILISATEUR = 60;
const MS_HEURE = 3_600_000;
const MS_30_JOURS = 30 * 24 * MS_HEURE;
const MAX_REDIRECTIONS = 5;

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_COOLDOWN_MS = 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// OUTILS GÉNÉRAUX
// ============================================================================
const nouvelId = prefix => `${prefix}-${crypto.randomUUID()}`;
const echapperHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normaliserEmail = e => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const emailValide = e => e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);

// ============================================================================
// PERSISTANCE — cache mémoire + écriture atomique (.tmp puis rename)
// Le cache est l'unique source de vérité : on ne relit jamais le disque pendant
// l'exécution, donc plus de "lecture → await → écriture" qui écrasait les
// modifications faites entre-temps (course critique de l'ancienne version).
// ============================================================================
function ecrireAtomique(fichier, contenu) {
  const tmp = `${fichier}.tmp`;
  fs.writeFileSync(tmp, contenu);
  fs.renameSync(tmp, fichier);
}

function lireJson(fichier, parDefaut) {
  if (!fs.existsSync(fichier)) return parDefaut();
  try {
    return JSON.parse(fs.readFileSync(fichier, 'utf-8'));
  } catch {
    // Fichier corrompu : on le met de côté au lieu de l'écraser silencieusement.
    const copie = `${fichier}.corrompu-${Date.now()}`;
    try { fs.renameSync(fichier, copie); } catch { /* ignore */ }
    console.error(`⚠️  ${path.basename(fichier)} illisible, sauvegardé dans ${path.basename(copie)}.`);
    return parDefaut();
  }
}

const ecrituresEnAttente = new Map(); // fichier -> { timer, getter }
function planifierEcriture(fichier, getter) {
  if (ecrituresEnAttente.has(fichier)) return;
  const timer = setTimeout(() => {
    ecrituresEnAttente.delete(fichier);
    ecrireAtomique(fichier, JSON.stringify(getter(), null, 2));
  }, 300);
  timer.unref();
  ecrituresEnAttente.set(fichier, { timer, getter });
}
function viderEcritures() {
  for (const [fichier, { timer, getter }] of ecrituresEnAttente) {
    clearTimeout(timer);
    ecrireAtomique(fichier, JSON.stringify(getter(), null, 2));
  }
  ecrituresEnAttente.clear();
}

// ---- Clients ---------------------------------------------------------------
let clientsCache = null;
function lireClients() {
  if (!clientsCache) {
    const brut = lireJson(FICHIER_CLIENTS, () => []);
    clientsCache = Array.isArray(brut) ? brut : [];
  }
  return clientsCache;
}
function sauverClients() {
  ecrireAtomique(FICHIER_CLIENTS, JSON.stringify(lireClients(), null, 2));
}
const trouverClientParEmail = email => lireClients().find(c => String(c.email).toLowerCase() === email);

// ---- Données de supervision ------------------------------------------------
let donneesCache = null;
const donneesVides = () => ({ sites: [], checks: {}, incidents: [], events: [], diagnostics: {}, hourly: {} });

function lireDonnees() {
  if (donneesCache) return donneesCache;
  let brut = lireJson(FICHIER_DONNEES, donneesVides);
  if (!brut || Array.isArray(brut) || typeof brut !== 'object') brut = donneesVides();
  for (const [cle, valeur] of Object.entries(donneesVides())) {
    if (!brut[cle]) brut[cle] = valeur;
  }
  // Migration : reconstruit les agrégats horaires à partir des anciens contrôles bruts.
  for (const site of brut.sites) {
    if (!brut.hourly[site.id] && (brut.checks[site.id] || []).length) {
      for (const c of brut.checks[site.id]) enregistrerStat(brut, site.id, c);
    }
  }
  donneesCache = brut;
  return donneesCache;
}
function sauverDonnees() {
  planifierEcriture(FICHIER_DONNEES, () => donneesCache);
}

// ============================================================================
// SESSIONS — jetons aléatoires, stockés hachés (SHA-256) et persistés sur disque
// (elles survivent donc à un redémarrage du serveur)
// ============================================================================
let sessionsCache = null;
const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');

function lireSessions() {
  if (!sessionsCache) {
    const brut = lireJson(FICHIER_SESSIONS, () => ({}));
    sessionsCache = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
    purgerSessionsExpirees();
  }
  return sessionsCache;
}
function sauverSessions() {
  ecrireAtomique(FICHIER_SESSIONS, JSON.stringify(lireSessions()));
}
function purgerSessionsExpirees() {
  const sessions = sessionsCache;
  let change = false;
  for (const [h, s] of Object.entries(sessions)) {
    if (Date.now() - s.createdAt > SESSION_TTL_MS) { delete sessions[h]; change = true; }
  }
  if (change) sauverSessions();
}
function createSession(userId, email) {
  const jeton = crypto.randomBytes(32).toString('hex');
  lireSessions()[hashJeton(jeton)] = { userId, email, createdAt: Date.now() };
  sauverSessions();
  return jeton;
}
function getSession(jeton) {
  if (!jeton) return null;
  const sessions = lireSessions();
  const h = hashJeton(jeton);
  const s = sessions[h];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    delete sessions[h];
    sauverSessions();
    return null;
  }
  return s;
}
function deleteSession(jeton) {
  const sessions = lireSessions();
  const h = hashJeton(jeton);
  if (sessions[h]) { delete sessions[h]; sauverSessions(); }
}
function supprimerSessionsUtilisateur(userId) {
  const sessions = lireSessions();
  let change = false;
  for (const [h, s] of Object.entries(sessions)) {
    if (s.userId === userId) { delete sessions[h]; change = true; }
  }
  if (change) sauverSessions();
}
function extraireJeton(req) {
  const entete = req.headers['authorization'] || '';
  return entete.startsWith('Bearer ') ? entete.slice(7) : null;
}
function requireAuth(req, res, next) {
  const session = getSession(extraireJeton(req));
  if (!session) {
    return res.status(401).json({ succes: false, message: 'Non authentifié. Veuillez vous connecter.' });
  }
  req.session = session;
  next();
}

// ============================================================================
// MOTS DE PASSE — scrypt asynchrone (ne bloque plus la boucle d'événements)
// ============================================================================
const HASH_VERSION = 'scrypt2';

async function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(plaintext, salt, 64)).toString('hex');
  return `${HASH_VERSION}$${salt}$${hash}`;
}

function egalSecurise(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

/** Formats acceptés : scrypt2$salt$hash, scrypt$salt$hash (ancien) et SHA-256 hexadécimal (très ancien). */
async function verifyPassword(plaintext, stored) {
  if (!stored || !plaintext) return false;
  try {
    if (stored.startsWith('scrypt2$') || stored.startsWith('scrypt$')) {
      const parts = stored.split('$');
      if (parts.length !== 3) return false;
      const hash = (await scrypt(plaintext, parts[1], 64)).toString('hex');
      return egalSecurise(hash, parts[2]);
    }
    if (/^[0-9a-f]{64}$/i.test(stored)) {
      const sha = crypto.createHash('sha256').update(plaintext).digest('hex');
      return egalSecurise(sha, stored.toLowerCase());
    }
  } catch { /* hash mal formé */ }
  return false;
}
const needsMigration = stored => Boolean(stored) && !stored.startsWith('scrypt2$');

/** Dépense le même temps CPU qu'une vraie vérification (évite de deviner si un e-mail existe). */
async function fausseVerification(plaintext) {
  try { await scrypt(String(plaintext), 'linkpulse-dummy-salt', 64); } catch { /* ignore */ }
}

// ============================================================================
// E-MAIL
// ============================================================================
let transporterReady = null;
async function getTransporter() {
  if (transporterReady) return transporterReady;

  if (EST_TEST || process.env.MAIL_TRANSPORT === 'json') {
    transporterReady = nodemailer.createTransport({ jsonTransport: true });
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
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
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: compteTest.user, pass: compteTest.pass }
    });
    console.log('📧 E-mail via Ethereal (test). URL de prévisualisation affichée après envoi.');
  }
  return transporterReady;
}

// Codes de réinitialisation : { [email]: { codeHash, expireAt, attempts, sentAt } }
const codesVerification = {};
const hashResetCode = code => crypto.createHash('sha256').update(code).digest('hex');

async function envoyerCodeReset(client, code) {
  const nom = echapperHtml(client.name);
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: '"LinkPulse Sécurité" <noreply@linkpulse.app>',
    to: client.email,
    subject: 'Code de réinitialisation de votre mot de passe LinkPulse',
    text: `Bonjour ${client.name},\n\nVotre code de réinitialisation est : ${code}\n\nIl est valable 10 minutes et ne peut être utilisé qu'une seule fois.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.\n\n— L'équipe LinkPulse`,
    html: `<p>Bonjour <strong>${nom}</strong>,</p><p>Votre code de réinitialisation est : <strong style="font-size:1.5em;letter-spacing:4px">${code}</strong></p><p>Il est valable <strong>10 minutes</strong> et ne peut être utilisé qu'une seule fois.</p><p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.</p>`
  });
  if (EST_TEST) app.locals.dernierEmail = info.message;
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`\n📩 Prévisualisation e-mail (Ethereal) : ${previewUrl}\n`);
  else if (!EST_TEST) console.log(`📩 E-mail de réinitialisation envoyé à ${client.email}.`);
}

// ============================================================================
// SÉCURITÉ DES CIBLES (anti-SSRF)
// Une URL surveillée ne doit jamais viser le réseau interne du serveur.
// ============================================================================
function estIpPrivee(adresse) {
  let ip = String(adresse).toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip === '::' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('ff');
  }
  return true;
}

class CibleInterdite extends Error {}

/** Valide l'URL (schéma, identifiants, adresse résolue). Retourne l'objet URL ou lève CibleInterdite. */
async function validerCible(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new CibleInterdite('URL invalide.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new CibleInterdite('Seules les URL http:// et https:// sont acceptées.');
  if (u.username || u.password) throw new CibleInterdite("L'URL ne doit pas contenir d'identifiants.");

  const hote = u.hostname.replace(/^\[|\]$/g, '');
  let adresses;
  try {
    adresses = net.isIP(hote) ? [{ address: hote }] : await dns.lookup(hote, { all: true });
  } catch {
    return u; // DNS en échec : la sonde le signalera comme DNS_RESOLUTION_FAILED
  }
  if (!autoriserCiblesPrivees() && adresses.some(a => estIpPrivee(a.address))) {
    throw new CibleInterdite('Adresse non autorisée (localhost ou réseau privé).');
  }
  return u;
}

// ============================================================================
// MOTEUR DE SONDE (DNS + TLS + HTTP HEAD/GET + performance.now)
// ============================================================================
function verifierCertificatTls(hostname, port) {
  return new Promise(resolve => {
    const socket = tls.connect(port, hostname, { servername: hostname, timeout: 4000 }, () => {
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

/** Requête HEAD (repli GET) en suivant manuellement les redirections, chacune revalidée. */
async function requeteSecurisee(urlDepart, methode, signal) {
  let url = urlDepart;
  for (let saut = 0; saut <= MAX_REDIRECTIONS; saut++) {
    const resp = await fetch(url, {
      method: methode,
      headers: { 'User-Agent': 'LinkPulse-Monitor/1.0' },
      redirect: 'manual',
      signal
    });
    const location = resp.headers.get('location');
    if (resp.status >= 300 && resp.status < 400 && location) {
      resp.body?.cancel().catch(() => {});
      const suivante = new URL(location, url);
      await validerCible(suivante.href);
      url = suivante.href;
      continue;
    }
    return resp;
  }
  const err = new Error('Trop de redirections');
  err.name = 'TooManyRedirects';
  throw err;
}

async function executerSondeReelle(site) {
  const base = { dnsResolved: false, dnsLatencyMs: null, httpStatus: null, httpResponseTimeMs: null, tlsValid: null, tlsExpiry: null, success: false, result: 'ok', errorCategory: null, methodeUtilisee: 'HEAD' };

  let urlObj;
  try {
    urlObj = await validerCible(site.url);
  } catch (e) {
    if (e instanceof CibleInterdite) return { ...base, result: 'blocked', errorCategory: 'TARGET_NOT_ALLOWED' };
    return { ...base, result: 'http_error', errorCategory: 'INVALID_URL' };
  }

  const debutDns = performance.now();
  const hote = urlObj.hostname.replace(/^\[|\]$/g, '');
  try {
    if (!net.isIP(hote)) await dns.lookup(hote);
    base.dnsResolved = true;
    base.dnsLatencyMs = Math.max(1, Math.round(performance.now() - debutDns));
  } catch {
    return { ...base, result: 'dns_error', errorCategory: 'DNS_RESOLUTION_FAILED' };
  }

  if (urlObj.protocol === 'https:') {
    const tlsInfo = await verifierCertificatTls(hote, Number(urlObj.port) || 443);
    base.tlsValid = tlsInfo.valid;
    base.tlsExpiry = tlsInfo.expiry;
  }

  const signal = AbortSignal.timeout(6000);
  const debut = performance.now();
  try {
    let resp = await requeteSecurisee(urlObj.href, 'HEAD', signal);
    let debutMesure = debut;
    if (resp.status === 405 || resp.status === 501) {
      base.methodeUtilisee = 'GET';
      debutMesure = performance.now();
      resp = await requeteSecurisee(urlObj.href, 'GET', signal);
    }
    resp.body?.cancel().catch(() => {});
    base.httpResponseTimeMs = Math.max(1, Math.round(performance.now() - debutMesure));
    base.httpStatus = resp.status;
    base.success = resp.ok;
    base.result = resp.ok ? 'ok' : 'http_error';
    if (!resp.ok) base.errorCategory = `HTTP_${resp.status}`;
  } catch (err) {
    base.httpResponseTimeMs = Math.round(performance.now() - debut);
    if (err instanceof CibleInterdite) {
      base.result = 'blocked';
      base.errorCategory = 'TARGET_NOT_ALLOWED';
    } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      base.result = 'timeout';
      base.errorCategory = 'TIMEOUT';
    } else if (err.name === 'TooManyRedirects') {
      base.result = 'http_error';
      base.errorCategory = 'TOO_MANY_REDIRECTS';
    } else {
      base.result = 'http_error';
      base.errorCategory = 'HTTP_ERROR';
    }
  }
  return base;
}

// ============================================================================
// STATISTIQUES — agrégats horaires conservés 30 jours (taux de disponibilité
// et courbes 24h / 7j réels, sans stocker des milliers de contrôles bruts)
// ============================================================================
const cleHeure = ts => new Date(Math.floor(ts / MS_HEURE) * MS_HEURE).toISOString();
const latenceExploitable = c => typeof c.responseTimeMs === 'number' && c.responseTimeMs > 0 && c.result !== 'timeout';

function enregistrerStat(data, siteId, check) {
  const parHeure = (data.hourly[siteId] ||= {});
  const bucket = (parHeure[cleHeure(Date.parse(check.checkedAt))] ||= { t: 0, ok: 0, ms: 0, n: 0 });
  bucket.t += 1;
  if (check.success) bucket.ok += 1;
  if (latenceExploitable(check)) { bucket.ms += check.responseTimeMs; bucket.n += 1; }

  const limite = Date.now() - MS_30_JOURS;
  for (const cle of Object.keys(parHeure)) {
    if (Date.parse(cle) < limite) delete parHeure[cle];
  }
}

function disponibilite(parHeure = {}, dureeMs) {
  const depuis = Date.now() - dureeMs;
  let t = 0, ok = 0;
  for (const [cle, b] of Object.entries(parHeure)) {
    if (Date.parse(cle) + MS_HEURE > depuis) { t += b.t; ok += b.ok; }
  }
  return t ? Number(((ok / t) * 100).toFixed(2)) : 100;
}

const CONFIG_SERIES = {
  '1h':  { duree: MS_HEURE,          pas: 5 * 60_000,     source: 'bruts' },
  '24h': { duree: 24 * MS_HEURE,     pas: MS_HEURE,       source: 'horaires' },
  '7d':  { duree: 7 * 24 * MS_HEURE, pas: 6 * MS_HEURE,   source: 'horaires' }
};

/** Courbe de latence réelle : filtrée par horodatage et moyennée par tranche de temps. */
function construireSerieLatence(data, siteIds, rangeDemande) {
  const range = CONFIG_SERIES[rangeDemande] ? rangeDemande : '24h';
  const { duree, pas, source } = CONFIG_SERIES[range];
  const depuis = Date.now() - duree;
  const tranches = new Map();
  const ajouter = (ts, somme, n) => {
    const debut = Math.floor(ts / pas) * pas;
    const t = tranches.get(debut) || { somme: 0, n: 0 };
    t.somme += somme; t.n += n;
    tranches.set(debut, t);
  };

  for (const id of siteIds) {
    if (source === 'bruts') {
      for (const c of data.checks[id] || []) {
        const ts = Date.parse(c.checkedAt);
        if (ts >= depuis && latenceExploitable(c)) ajouter(ts, c.responseTimeMs, 1);
      }
    } else {
      for (const [cle, b] of Object.entries(data.hourly[id] || {})) {
        const ts = Date.parse(cle);
        if (ts + MS_HEURE > depuis && b.n > 0) ajouter(ts, b.ms, b.n);
      }
    }
  }

  const points = [...tranches.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([debut, t]) => ({ timestamp: new Date(debut).toISOString(), valueMs: Math.round(t.somme / t.n) }));
  return { range, thresholdMs: SEUIL_LENTEUR_MS, points };
}

// ============================================================================
// LOGIQUE DE SUPERVISION
// ============================================================================
function ajouterEvenement(data, evt) {
  data.events.unshift({ id: nouvelId('evt'), ...evt });
  let n = 0;
  data.events = data.events.filter(e => e.userId !== evt.userId || ++n <= MAX_EVENTS_PAR_UTILISATEUR);
}

function appliquerResultatSonde(data, site, sonde, sourceProbe, ouvrirDesPremierEchec = false) {
  const maintenant = new Date().toISOString();
  site.lastCheckedAt = maintenant;
  site.responseTimeMs = sonde.httpResponseTimeMs || 0;
  site.lastHttpStatus = sonde.httpStatus ?? null;
  const majStatut = statut => { if (site.isEnabled) site.status = statut; };

  const check = {
    id: nouvelId('chk'),
    siteId: site.id,
    checkedAt: maintenant,
    success: sonde.success,
    httpStatus: sonde.httpStatus,
    responseTimeMs: sonde.httpResponseTimeMs,
    probe: sourceProbe,
    result: sonde.result,
    tlsExpiry: sonde.tlsExpiry
  };

  data.checks[site.id] = [check, ...(data.checks[site.id] || [])].slice(0, MAX_CHECKS_BRUTS_PAR_SITE);
  enregistrerStat(data, site.id, check);
  site.availability30d = disponibilite(data.hourly[site.id], MS_30_JOURS);

  const incidentActif = data.incidents.find(i => i.siteId === site.id && i.userId === site.userId && i.status === 'ongoing');

  if (sonde.success) {
    majStatut('online');
    site.consecutiveFailures = 0;

    if (incidentActif) {
      incidentActif.status = 'resolved';
      incidentActif.endedAt = maintenant;
      incidentActif.durationMinutes = Math.max(1, Math.round((Date.now() - new Date(incidentActif.startedAt).getTime()) / 60_000));
      incidentActif.evidence.push({ id: nouvelId('ev'), eventTime: maintenant, evidenceType: 'incident_closed', summary: `Reprise confirmée (HTTP ${sonde.httpStatus} en ${sonde.httpResponseTimeMs} ms).`, httpStatus: sonde.httpStatus, responseTimeMs: sonde.httpResponseTimeMs, probe: sourceProbe });
      ajouterEvenement(data, { timestamp: maintenant, type: 'incident_closed', message: `Incident clôturé après reprise de ${site.name}.`, siteName: site.name, severity: 'success', userId: site.userId });
    }
  } else {
    site.consecutiveFailures = (site.consecutiveFailures || 0) + 1;
    const seuilAtteint = ouvrirDesPremierEchec || site.consecutiveFailures >= 3;

    if (seuilAtteint) {
      majStatut('offline');
      const motif = sonde.errorCategory || sonde.result;
      if (!incidentActif) {
        data.incidents.unshift({
          id: `INC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          siteId: site.id,
          userId: site.userId,
          siteName: site.name,
          siteUrl: site.url,
          type: sonde.result === 'dns_error' ? 'dns_error' : 'unavailable',
          severity: 'critical',
          status: 'ongoing',
          errorCode: motif || 'HTTP_ERROR',
          region: site.region,
          startedAt: maintenant,
          lastSeenAt: maintenant,
          endedAt: null,
          durationMinutes: null,
          summary: ouvrirDesPremierEchec ? `Échec immédiat détecté (${motif}).` : `Trois échecs consécutifs détectés (${motif}).`,
          evidence: [{ id: nouvelId('ev'), eventTime: maintenant, evidenceType: 'incident_opened', summary: `Anomalie confirmée : ${motif}.`, httpStatus: sonde.httpStatus, responseTimeMs: sonde.httpResponseTimeMs, probe: sourceProbe }]
        });
        ajouterEvenement(data, { timestamp: maintenant, type: 'incident_opened', message: `Incident ouvert sur ${site.name} (${motif}).`, siteName: site.name, severity: 'critical', userId: site.userId });
      } else {
        incidentActif.lastSeenAt = maintenant;
      }
    }
  }
  return check;
}

async function executerParLots(elements, tailleLot, fn) {
  const resultats = [];
  for (let i = 0; i < elements.length; i += tailleLot) {
    resultats.push(...await Promise.allSettled(elements.slice(i, i + tailleLot).map(fn)));
  }
  return resultats;
}

let cycleEnCours = false;
async function executerCycleParallele(forcerTous = false) {
  if (cycleEnCours) return;
  cycleEnCours = true;
  try {
    const aVerifier = lireDonnees().sites.filter(site => {
      if (!site.isEnabled || !site.userId) return false;
      if (forcerTous || site.status === 'unknown') return true;
      const dernier = site.lastCheckedAt ? new Date(site.lastCheckedAt).getTime() : 0;
      return Date.now() - dernier >= (site.checkIntervalSeconds || INTERVALLE_DEFAUT_S) * 1000;
    });
    if (!aVerifier.length) return;

    const debutCycle = performance.now();
    const resultats = await executerParLots(aVerifier, 20, async site => ({ siteId: site.id, sonde: await executerSondeReelle(site) }));

    // Pendant les sondes, l'utilisateur a pu supprimer ou mettre en pause un site :
    // on retrouve donc chaque site dans l'état courant avant d'appliquer le résultat.
    const data = lireDonnees();
    for (const r of resultats) {
      if (r.status !== 'fulfilled') continue;
      const site = data.sites.find(s => s.id === r.value.siteId);
      if (site && site.isEnabled) appliquerResultatSonde(data, site, r.value.sonde, 'Tunis · Auto', false);
    }
    sauverDonnees();
    console.log(`⚡ Cycle parallèle : ${aVerifier.length} site(s) en ${Math.round(performance.now() - debutCycle)} ms`);
  } catch (e) {
    console.error('Cycle de supervision :', e);
  } finally {
    cycleEnCours = false;
  }
}

function getDonneesUtilisateur(data, userId) {
  const sites = data.sites.filter(s => s.userId === userId);
  return {
    sites,
    siteIds: sites.map(s => s.id),
    incidents: data.incidents.filter(i => i.userId === userId),
    events: data.events.filter(e => e.userId === userId)
  };
}

const trouverSite = (data, req) => data.sites.find(s => s.id === req.params.id && s.userId === req.session.userId);

// ============================================================================
// APPLICATION EXPRESS
// ============================================================================
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '50kb' }));

const limiteur = (fenetreMin, max, message, cle) => rateLimit({
  windowMs: fenetreMin * 60_000,
  limit: max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => EST_TEST,
  ...(cle ? { keyGenerator: cle } : {}),
  message: { succes: false, message }
});
const limiteAuth = limiteur(15, 20, 'Trop de tentatives. Réessayez dans quelques minutes.');
const limiteReset = limiteur(15, 10, 'Trop de demandes. Réessayez dans quelques minutes.');
const limiteSondes = limiteur(1, 30, 'Trop de contrôles manuels. Patientez une minute.', req => req.session.userId);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ----------------------------------------------------------------------------
// AUTHENTIFICATION
// ----------------------------------------------------------------------------
app.post('/api/inscription', limiteAuth, async (req, res) => {
  try {
    const { password } = req.body ?? {};
    const email = normaliserEmail(req.body?.email);
    if (!email || typeof password !== 'string' || !password) return res.status(400).json({ succes: false, message: 'Email et mot de passe obligatoires.' });
    if (!emailValide(email)) return res.status(400).json({ succes: false, message: 'Adresse e-mail invalide.' });
    if (password.length < MIN_PASSWORD) return res.status(400).json({ succes: false, message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` });
    if (password.length > MAX_PASSWORD) return res.status(400).json({ succes: false, message: `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD} caractères.` });

    if (trouverClientParEmail(email)) return res.status(409).json({ succes: false, message: 'Cet email possède déjà un compte.' });

    const nouveauClient = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      provider: 'LinkPulse',
      password: await hashPassword(password),
      dateInscription: new Date().toISOString()
    };
    lireClients().push(nouveauClient);
    sauverClients();

    const token = createSession(nouveauClient.id, nouveauClient.email);
    res.status(201).json({ succes: true, token, client: { id: nouveauClient.id, email: nouveauClient.email, name: nouveauClient.name } });
  } catch (e) {
    console.error('inscription:', e);
    res.status(500).json({ succes: false, message: 'Erreur interne du serveur.' });
  }
});

app.post('/api/connexion', limiteAuth, async (req, res) => {
  try {
    const { password } = req.body ?? {};
    const email = normaliserEmail(req.body?.email);
    if (!email || typeof password !== 'string' || !password || password.length > MAX_PASSWORD) {
      return res.status(400).json({ succes: false, message: 'Champs manquants.' });
    }

    const client = trouverClientParEmail(email);
    // Même message et même durée de calcul que le compte existe ou non.
    if (!client || !client.password) {
      await fausseVerification(password);
      return res.status(401).json({ succes: false, message: 'E-mail ou mot de passe incorrect.' });
    }
    if (!(await verifyPassword(password, client.password))) {
      return res.status(401).json({ succes: false, message: 'E-mail ou mot de passe incorrect.' });
    }

    if (needsMigration(client.password)) {
      client.password = await hashPassword(password);
      sauverClients();
    }

    const token = createSession(client.id, client.email);
    res.json({ succes: true, token, client: { id: client.id, email: client.email, name: client.name } });
  } catch (e) {
    console.error('connexion:', e);
    res.status(500).json({ succes: false, message: 'Erreur interne du serveur.' });
  }
});

// L'ancienne route /api/oauth créait une session pour n'importe quel e-mail, SANS preuve
// d'identité (prise de contrôle de compte possible). Désactivée tant qu'un vrai flux
// OAuth 2.0 (Google / GitHub) n'est pas implémenté.
app.post('/api/oauth', (req, res) => {
  res.status(501).json({ succes: false, message: 'Connexion SSO non disponible pour le moment.' });
});

app.post('/api/logout', (req, res) => {
  const jeton = extraireJeton(req);
  if (jeton) deleteSession(jeton);
  res.json({ succes: true });
});

app.post('/api/send-reset-code', limiteReset, async (req, res) => {
  try {
    const email = normaliserEmail(req.body?.email);
    if (!email) return res.status(400).json({ succes: false, message: 'Veuillez saisir votre adresse e-mail.' });
    if (!emailValide(email)) return res.status(400).json({ succes: false, message: 'Adresse e-mail invalide.' });

    // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
    const reponse = { succes: true, message: `Si un compte existe pour ${email}, un code à 6 chiffres vient d'être envoyé (valable 10 minutes).` };

    const client = trouverClientParEmail(email);
    const existant = codesVerification[email];
    const enAttente = existant && Date.now() - existant.sentAt < RESET_CODE_COOLDOWN_MS;

    if (client && !enAttente) {
      const code = String(crypto.randomInt(100000, 1000000));
      codesVerification[email] = { codeHash: hashResetCode(code), expireAt: Date.now() + RESET_CODE_TTL_MS, attempts: 0, sentAt: Date.now() };
      const envoi = envoyerCodeReset(client, code).catch(e => console.error('send-reset-code (e-mail):', e));
      if (EST_TEST) await envoi;
    }
    res.json(reponse);
  } catch (e) {
    console.error('send-reset-code:', e);
    res.status(500).json({ succes: false, message: "Impossible d'envoyer l'e-mail de vérification." });
  }
});

app.post('/api/verify-reset-code', limiteReset, async (req, res) => {
  try {
    const email = normaliserEmail(req.body?.email);
    const { code, newPassword } = req.body ?? {};
    if (!email || typeof code !== 'string' || typeof newPassword !== 'string' || !code || !newPassword) {
      return res.status(400).json({ succes: false, message: 'Tous les champs sont obligatoires.' });
    }
    if (newPassword.length < MIN_PASSWORD) return res.status(400).json({ succes: false, message: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` });
    if (newPassword.length > MAX_PASSWORD) return res.status(400).json({ succes: false, message: `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD} caractères.` });

    const invalide = { succes: false, message: 'Code invalide ou expiré. Veuillez en demander un nouveau.' };
    const demande = codesVerification[email];
    if (!demande) return res.status(400).json(invalide);

    if (Date.now() > demande.expireAt) {
      delete codesVerification[email];
      return res.status(400).json(invalide);
    }
    if (demande.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      delete codesVerification[email];
      return res.status(429).json({ succes: false, message: 'Trop de tentatives. Veuillez demander un nouveau code.' });
    }

    if (!egalSecurise(hashResetCode(code.trim()), demande.codeHash)) {
      demande.attempts += 1;
      const restant = RESET_CODE_MAX_ATTEMPTS - demande.attempts;
      return res.status(400).json({ succes: false, message: `Code invalide. ${restant} tentative(s) restante(s).` });
    }

    const client = trouverClientParEmail(email);
    if (!client) { delete codesVerification[email]; return res.status(400).json(invalide); }

    client.password = await hashPassword(newPassword);
    sauverClients();
    delete codesVerification[email];
    supprimerSessionsUtilisateur(client.id); // un mot de passe réinitialisé déconnecte tous les appareils

    res.json({ succes: true, message: 'Mot de passe modifié ! Vous pouvez maintenant vous connecter.' });
  } catch (e) {
    console.error('verify-reset-code:', e);
    res.status(500).json({ succes: false, message: 'Erreur lors de la mise à jour du mot de passe.' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  const client = lireClients().find(c => c.id === req.session.userId);
  if (!client) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable.' });
  res.json({ succes: true, client: { id: client.id, email: client.email, name: client.name } });
});

// ----------------------------------------------------------------------------
// TABLEAU DE BORD
// ----------------------------------------------------------------------------
app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  const ud = getDonneesUtilisateur(lireDonnees(), req.session.userId);
  const actifs = ud.sites.filter(s => s.isEnabled);
  const enLigne = actifs.filter(s => s.status === 'online');
  const incidentOuvert = ud.incidents.find(i => i.status === 'ongoing') || null;
  const avgMs = enLigne.length ? Math.round(enLigne.reduce((acc, s) => acc + (s.responseTimeMs || 0), 0) / enLigne.length) : 0;
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
  res.json(construireSerieLatence(data, ud.siteIds, req.query.range));
});

app.get('/api/dashboard/events', requireAuth, (req, res) => {
  res.json(getDonneesUtilisateur(lireDonnees(), req.session.userId).events.slice(0, 25));
});

app.get('/api/dashboard/export.csv', requireAuth, (req, res) => {
  const ud = getDonneesUtilisateur(lireDonnees(), req.session.userId);
  // Neutralise l'injection de formules (=, +, -, @) lors de l'ouverture dans Excel.
  const quote = v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lignes = ud.events.map(e => [e.id, e.timestamp, e.type, e.siteName, e.severity].map(quote).join(','));
  res.type('text/csv').send(['id,timestamp,type,siteName,severity', ...lignes].join('\n'));
});

// ----------------------------------------------------------------------------
// SITES
// ----------------------------------------------------------------------------
function lireIntervalle(valeur) {
  if (valeur === undefined || valeur === null || valeur === '') return { ok: true, valeur: INTERVALLE_DEFAUT_S };
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < INTERVALLE_MIN_S || n > INTERVALLE_MAX_S) {
    return { ok: false, message: `L'intervalle doit être un entier entre ${INTERVALLE_MIN_S} et ${INTERVALLE_MAX_S} secondes.` };
  }
  return { ok: true, valeur: n };
}
function lireNom(valeur) {
  const nom = typeof valeur === 'string' ? valeur.trim() : '';
  return nom && nom.length <= 80 ? nom : null;
}

app.get('/api/sites', requireAuth, (req, res) => {
  const status = req.query.status;
  const q = String(req.query.q || '').trim().toLowerCase();
  const sites = lireDonnees().sites.filter(s =>
    s.userId === req.session.userId &&
    (!status || status === 'all' || s.status === status) &&
    (!q || `${s.name} ${s.url}`.toLowerCase().includes(q))
  );
  res.json(sites);
});

app.post('/api/sites', requireAuth, limiteSondes, async (req, res) => {
  try {
    const data = lireDonnees();
    const nom = lireNom(req.body?.name);
    const urlSaisie = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!nom || !urlSaisie) return res.status(400).json({ message: 'Nom (80 caractères max.) et URL obligatoires.' });
    if (urlSaisie.length > 2048) return res.status(400).json({ message: 'URL trop longue.' });

    const intervalle = lireIntervalle(req.body?.checkIntervalSeconds);
    if (!intervalle.ok) return res.status(400).json({ message: intervalle.message });

    if (data.sites.filter(s => s.userId === req.session.userId).length >= MAX_SITES_PAR_UTILISATEUR) {
      return res.status(400).json({ message: `Limite de ${MAX_SITES_PAR_UTILISATEUR} sites atteinte.` });
    }

    let urlValide;
    try { urlValide = await validerCible(urlSaisie); }
    catch (e) {
      if (e instanceof CibleInterdite) return res.status(400).json({ message: e.message });
      throw e;
    }

    const nouveauSite = {
      id: nouvelId('site'),
      userId: req.session.userId,
      name: nom,
      url: urlValide.href,
      status: 'unknown',
      responseTimeMs: 0,
      availability30d: 100,
      lastCheckedAt: new Date().toISOString(),
      lastHttpStatus: null,
      checkIntervalSeconds: intervalle.valeur,
      consecutiveFailures: 0,
      isEnabled: true,
      region: 'tn-tunis-1'
    };

    const sonde = await executerSondeReelle(nouveauSite);
    // Aucune lecture disque entre ici et la sauvegarde : l'état en mémoire est toujours à jour.
    data.sites.unshift(nouveauSite);
    appliquerResultatSonde(data, nouveauSite, sonde, 'Tunis · Ajout', false);
    ajouterEvenement(data, {
      timestamp: nouveauSite.lastCheckedAt,
      type: 'site_added',
      message: `Site ajouté (${sonde.success ? `HTTP ${sonde.httpStatus} · ${sonde.httpResponseTimeMs} ms` : 'hors ligne'}).`,
      siteName: nouveauSite.name,
      severity: sonde.success ? 'success' : 'warning',
      userId: req.session.userId
    });
    sauverDonnees();
    res.status(201).json(nouveauSite);
  } catch (e) {
    console.error('POST /api/sites:', e);
    res.status(500).json({ message: "Impossible d'ajouter ce site." });
  }
});

app.get('/api/sites/:id', requireAuth, (req, res) => {
  const site = trouverSite(lireDonnees(), req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(site);
});

app.patch('/api/sites/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  const { isEnabled, checkIntervalSeconds, name } = req.body ?? {};
  if (isEnabled !== undefined && typeof isEnabled !== 'boolean') return res.status(400).json({ message: '« isEnabled » doit être un booléen.' });
  let intervalle;
  if (checkIntervalSeconds !== undefined) {
    intervalle = lireIntervalle(checkIntervalSeconds);
    if (!intervalle.ok) return res.status(400).json({ message: intervalle.message });
  }
  let nom;
  if (name !== undefined) {
    nom = lireNom(name);
    if (!nom) return res.status(400).json({ message: 'Nom invalide (1 à 80 caractères).' });
  }

  if (intervalle) site.checkIntervalSeconds = intervalle.valeur;
  if (nom) site.name = nom;
  // Le statut est déterminé par le serveur, jamais par le client.
  if (isEnabled !== undefined && isEnabled !== site.isEnabled) {
    site.isEnabled = isEnabled;
    site.status = isEnabled ? 'unknown' : 'paused';
    ajouterEvenement(data, {
      timestamp: new Date().toISOString(),
      type: isEnabled ? 'check_ok' : 'site_paused',
      message: isEnabled ? 'Surveillance reprise.' : 'Surveillance mise en pause.',
      siteName: site.name,
      severity: 'info',
      userId: req.session.userId
    });
  }
  sauverDonnees();
  res.json(site);
});

app.delete('/api/sites/:id', requireAuth, (req, res) => {
  const data = lireDonnees();
  const idx = data.sites.findIndex(s => s.id === req.params.id && s.userId === req.session.userId);
  if (idx === -1) return res.status(404).json({ message: 'Site introuvable.' });

  const id = data.sites[idx].id;
  data.sites.splice(idx, 1);
  delete data.checks[id];
  delete data.diagnostics[id];
  delete data.hourly[id];
  data.incidents = data.incidents.filter(i => !(i.siteId === id && i.userId === req.session.userId));
  sauverDonnees();
  res.json({ success: true });
});

app.post('/api/sites/:id/checks/run', requireAuth, limiteSondes, async (req, res) => {
  const initial = trouverSite(lireDonnees(), req);
  if (!initial) return res.status(404).json({ message: 'Site introuvable.' });

  const sonde = await executerSondeReelle(initial);

  // Le site a pu être supprimé pendant la sonde : on le retrouve dans l'état courant.
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });

  const check = appliquerResultatSonde(data, site, sonde, 'Tunis · Manuel', true);
  ajouterEvenement(data, {
    timestamp: check.checkedAt,
    type: sonde.success ? 'check_ok' : 'check_fail',
    message: sonde.success ? `Contrôle manuel réussi (${sonde.httpResponseTimeMs} ms via ${sonde.methodeUtilisee}).` : `Contrôle manuel en échec (${sonde.errorCategory || sonde.result}).`,
    siteName: site.name,
    severity: sonde.success ? 'success' : 'critical',
    userId: req.session.userId
  });
  sauverDonnees();
  res.json(check);
});

app.get('/api/sites/:id/checks', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(data.checks[site.id] || []);
});

app.get('/api/sites/:id/latency', requireAuth, (req, res) => {
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(construireSerieLatence(data, [site.id], req.query.range));
});

// ----------------------------------------------------------------------------
// INCIDENTS
// ----------------------------------------------------------------------------
app.get('/api/incidents/stats', requireAuth, (req, res) => {
  const data = lireDonnees();
  const ud = getDonneesUtilisateur(data, req.session.userId);
  const resolus = ud.incidents.filter(i => i.status === 'resolved' && i.durationMinutes != null);
  const mttr = resolus.length ? Math.round(resolus.reduce((acc, i) => acc + i.durationMinutes, 0) / resolus.length) : 0;
  const dispo24h = ud.sites.length
    ? Number((ud.sites.reduce((acc, s) => acc + disponibilite(data.hourly[s.id], 24 * MS_HEURE), 0) / ud.sites.length).toFixed(2))
    : 100;
  res.json({ count: ud.incidents.length, avgResolutionMinutes: mttr, availability24h: dispo24h });
});

app.get('/api/incidents', requireAuth, (req, res) => {
  const status = req.query.status;
  const q = String(req.query.q || '').trim().toLowerCase();
  const liste = lireDonnees().incidents.filter(i =>
    i.userId === req.session.userId &&
    (!status || status === 'all' || i.status === status) &&
    (!q || `${i.siteName} ${i.id} ${i.errorCode} ${i.region}`.toLowerCase().includes(q))
  );
  res.json(liste.map(({ evidence, ...resume }) => resume));
});

app.get('/api/incidents/:id', requireAuth, (req, res) => {
  const incident = lireDonnees().incidents.find(i => i.id === req.params.id && i.userId === req.session.userId);
  if (!incident) return res.status(404).json({ message: 'Incident introuvable.' });
  res.json(incident);
});

// ----------------------------------------------------------------------------
// DIAGNOSTICS
// ----------------------------------------------------------------------------
async function construireDiagnostic(siteInitial, data) {
  const sonde = await executerSondeReelle(siteInitial);
  const diag = {
    siteId: siteInitial.id,
    userId: siteInitial.userId,
    siteName: siteInitial.name,
    siteUrl: siteInitial.url,
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
      : `Anomalie détectée sur ${siteInitial.name} : ${sonde.errorCategory || sonde.result}.`
  };
  // Le site a pu disparaître pendant le diagnostic : on ne stocke rien dans ce cas.
  if (data.sites.some(s => s.id === siteInitial.id)) {
    data.diagnostics[siteInitial.id] = diag;
    sauverDonnees();
  }
  return diag;
}

app.get('/api/diagnostics/sites/:id/latest', requireAuth, limiteSondes, async (req, res) => {
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  if (data.diagnostics[site.id]) return res.json(data.diagnostics[site.id]);
  res.json(await construireDiagnostic(site, data));
});

app.post('/api/diagnostics/sites/:id/run', requireAuth, limiteSondes, async (req, res) => {
  const data = lireDonnees();
  const site = trouverSite(data, req);
  if (!site) return res.status(404).json({ message: 'Site introuvable.' });
  res.json(await construireDiagnostic(site, data));
});

// ----------------------------------------------------------------------------
// ERREURS
// ----------------------------------------------------------------------------
app.use((req, res) => res.status(404).json({ succes: false, message: 'Route API introuvable.' }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ succes: false, message: 'Corps JSON invalide.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ succes: false, message: 'Requête trop volumineuse.' });
  console.error('Erreur non gérée :', err);
  res.status(500).json({ succes: false, message: 'Erreur interne du serveur.' });
});

// ============================================================================
// DÉMARRAGE
// ============================================================================
function demarrer(port = PORT) {
  lireClients();
  lireDonnees();
  lireSessions();
  const serveur = app.listen(port, () => {
    console.log(`✅ Backend LinkPulse démarré sur http://localhost:${port}`);
    if (autoriserCiblesPrivees()) console.log('⚠️  ALLOW_PRIVATE_TARGETS=true : cibles locales/privées autorisées (développement uniquement).');
    executerCycleParallele(true);
  });
  setInterval(() => executerCycleParallele(false), 15_000).unref();
  setInterval(purgerSessionsExpirees, MS_HEURE).unref();

  const arreter = () => { viderEcritures(); serveur.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
  return serveur;
}

process.on('exit', viderEcritures);

if (require.main === module) demarrer();

module.exports = { app, demarrer, estIpPrivee, viderEcritures };
