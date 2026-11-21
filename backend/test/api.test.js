'use strict';
// Tests d'intégration : `npm test` (aucun serveur à lancer, aucun accès réseau externe).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpulse-test-'));
delete process.env.ALLOW_PRIVATE_TARGETS;

const request = require('supertest');
const { app, estIpPrivee, viderEcritures } = require('../server');

let cible, urlCible;
const unique = Date.now();
const A = { email: `A-${unique}@linkpulse.test`, password: 'motdepasse-A1' };
const B = { email: `b-${unique}@linkpulse.test`, password: 'motdepasse-B1' };
let tokenA, tokenB;
const auth = t => ({ Authorization: `Bearer ${t}` });
const dormir = ms => new Promise(r => setTimeout(r, ms));
const autoriserLocal = v => { process.env.ALLOW_PRIVATE_TARGETS = v ? 'true' : 'false'; };

before(async () => {
  // Petit site local à surveiller (/lent répond après 400 ms)
  cible = http.createServer((req, res) => {
    const delai = req.url === '/lent' ? 400 : 0;
    setTimeout(() => { res.statusCode = 200; res.end('ok'); }, delai);
  });
  await new Promise(r => cible.listen(0, '127.0.0.1', r));
  urlCible = `http://127.0.0.1:${cible.address().port}`;
});

after(() => {
  cible.close();
  viderEcritures();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('inscription : mot de passe trop court refusé, e-mail invalide refusé', async () => {
  let r = await request(app).post('/api/inscription').send({ email: A.email, password: '1234567' });
  assert.equal(r.status, 400);
  r = await request(app).post('/api/inscription').send({ email: 'pas-un-email', password: A.password });
  assert.equal(r.status, 400);
});

test('inscription + connexion (e-mail insensible à la casse)', async () => {
  let r = await request(app).post('/api/inscription').send(A);
  assert.equal(r.status, 201);
  tokenA = r.body.token;
  r = await request(app).post('/api/inscription').send(B);
  tokenB = r.body.token;
  assert.ok(tokenA && tokenB);

  r = await request(app).post('/api/connexion').send({ email: A.email.toUpperCase(), password: A.password });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);

  r = await request(app).post('/api/inscription').send(A);
  assert.equal(r.status, 409);
});

test('connexion : même réponse pour mauvais mot de passe et compte inconnu', async () => {
  const mauvais = await request(app).post('/api/connexion').send({ email: A.email, password: 'faux-faux-faux' });
  const inconnu = await request(app).post('/api/connexion').send({ email: 'inconnu@linkpulse.test', password: 'faux-faux-faux' });
  assert.equal(mauvais.status, 401);
  assert.equal(inconnu.status, 401);
  assert.equal(mauvais.body.message, inconnu.body.message);
});

test('/api/oauth ne crée plus de session (prise de compte impossible)', async () => {
  const r = await request(app).post('/api/oauth').send({ provider: 'Google', email: A.email });
  assert.equal(r.status, 501);
  assert.equal(r.body.token, undefined);
});

test('/api/clients n’est plus exposé', async () => {
  const r = await request(app).get('/api/clients');
  assert.equal(r.status, 404);
});

test('routes protégées : 401 sans jeton', async () => {
  assert.equal((await request(app).get('/api/sites')).status, 401);
  assert.equal((await request(app).get('/api/me')).status, 401);
});

test('anti-SSRF : localhost, réseau privé et schémas dangereux refusés', async () => {
  autoriserLocal(false);
  for (const url of ['http://127.0.0.1:9999', 'http://localhost:3000', 'http://169.254.169.254/latest', 'http://10.0.0.5', 'http://[::1]/', 'file:///etc/passwd', 'ftp://example.com']) {
    const r = await request(app).post('/api/sites').set(auth(tokenA)).send({ name: 'x', url });
    assert.equal(r.status, 400, `${url} aurait dû être refusée`);
  }
  assert.equal(estIpPrivee('127.0.0.1'), true);
  assert.equal(estIpPrivee('::ffff:192.168.1.10'), true);
  assert.equal(estIpPrivee('172.20.0.1'), true);
  assert.equal(estIpPrivee('8.8.8.8'), false);
  assert.equal(estIpPrivee('2606:4700:4700::1111'), false);
});

let siteA;
test('ajout de site : validation + isolation entre utilisateurs', async () => {
  autoriserLocal(true); // le site de test est sur 127.0.0.1

  let r = await request(app).post('/api/sites').set(auth(tokenA)).send({ name: 'ok', url: urlCible, checkIntervalSeconds: 0 });
  assert.equal(r.status, 400, 'intervalle 0 refusé');
  r = await request(app).post('/api/sites').set(auth(tokenA)).send({ name: '', url: urlCible });
  assert.equal(r.status, 400);

  r = await request(app).post('/api/sites').set(auth(tokenA)).send({ name: '=SOMME(A1)', url: urlCible, checkIntervalSeconds: 30 });
  assert.equal(r.status, 201);
  siteA = r.body;
  assert.equal(siteA.lastHttpStatus, 200);
  assert.match(siteA.id, /^site-[0-9a-f-]{36}$/);

  r = await request(app).get('/api/sites').set(auth(tokenB));
  assert.deepEqual(r.body, []);
  r = await request(app).delete(`/api/sites/${siteA.id}`).set(auth(tokenB));
  assert.equal(r.status, 404);
  r = await request(app).get(`/api/sites/${siteA.id}`).set(auth(tokenB));
  assert.equal(r.status, 404);
});

test('PATCH : validation, statut décidé par le serveur', async () => {
  let r = await request(app).patch(`/api/sites/${siteA.id}`).set(auth(tokenA)).send({ checkIntervalSeconds: 0 });
  assert.equal(r.status, 400);
  r = await request(app).patch(`/api/sites/${siteA.id}`).set(auth(tokenA)).send({ isEnabled: 'oui' });
  assert.equal(r.status, 400);

  r = await request(app).patch(`/api/sites/${siteA.id}`).set(auth(tokenA)).send({ isEnabled: false, status: 'online' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'paused', 'le statut envoyé par le client est ignoré');

  r = await request(app).patch(`/api/sites/${siteA.id}`).set(auth(tokenA)).send({ isEnabled: true });
  assert.equal(r.body.status, 'unknown');
  assert.equal(r.body.userId, siteA.userId);
});

test('courbe de latence : filtrée par durée réelle, plage inconnue = 24h', async () => {
  let r = await request(app).get('/api/dashboard/latency?range=1h').set(auth(tokenA));
  assert.equal(r.body.range, '1h');
  assert.ok(r.body.points.length >= 1);
  for (const p of r.body.points) assert.ok(Date.now() - Date.parse(p.timestamp) < 3_600_000 + 300_000);

  r = await request(app).get('/api/dashboard/latency?range=nimporte').set(auth(tokenA));
  assert.equal(r.body.range, '24h');

  r = await request(app).get(`/api/sites/${siteA.id}/latency?range=7d`).set(auth(tokenA));
  assert.equal(r.body.range, '7d');

  r = await request(app).get('/api/incidents/stats').set(auth(tokenA));
  assert.equal(typeof r.body.availability24h, 'number');
});

test('export CSV : neutralise l’injection de formules', async () => {
  const r = await request(app).get('/api/dashboard/export.csv').set(auth(tokenA));
  assert.equal(r.status, 200);
  assert.ok(r.text.includes(`"'=SOMME(A1)"`));
  assert.ok(!r.text.includes(`,"=SOMME(A1)"`));
});

test('course critique : un site supprimé pendant un contrôle n’est pas ressuscité', async () => {
  const r0 = await request(app).post('/api/sites').set(auth(tokenA)).send({ name: 'lent', url: `${urlCible}/lent` });
  const id = r0.body.id;
  const controle = request(app).post(`/api/sites/${id}/checks/run`).set(auth(tokenA)).then(r => r);
  await dormir(100);
  const suppression = await request(app).delete(`/api/sites/${id}`).set(auth(tokenA));
  assert.equal(suppression.status, 200);
  const resultat = await controle;
  assert.equal(resultat.status, 404);
  const liste = await request(app).get('/api/sites').set(auth(tokenA));
  assert.ok(!liste.body.some(s => s.id === id));
});

test('réinitialisation : réponse identique si compte inconnu, code à usage unique', async () => {
  app.locals.dernierEmail = null;
  const inconnu = await request(app).post('/api/send-reset-code').send({ email: 'personne@linkpulse.test' });
  assert.equal(inconnu.status, 200);
  assert.equal(app.locals.dernierEmail, null, 'aucun e-mail envoyé');

  const connu = await request(app).post('/api/send-reset-code').send({ email: B.email });
  assert.equal(connu.status, 200);
  assert.equal(typeof connu.body.message, 'string');
  const code = /est : (\d{6})/.exec(JSON.parse(app.locals.dernierEmail).text)[1];

  let r = await request(app).post('/api/verify-reset-code').send({ email: B.email, code: '000000', newPassword: 'nouveau-mdp-B2' });
  assert.equal(r.status, 400);

  r = await request(app).post('/api/verify-reset-code').send({ email: B.email, code, newPassword: 'court' });
  assert.equal(r.status, 400, 'nouveau mot de passe trop court');

  r = await request(app).post('/api/verify-reset-code').send({ email: B.email, code, newPassword: 'nouveau-mdp-B2' });
  assert.equal(r.status, 200);

  r = await request(app).post('/api/verify-reset-code').send({ email: B.email, code, newPassword: 'autre-mdp-B3' });
  assert.equal(r.status, 400, 'code à usage unique');

  assert.equal((await request(app).get('/api/me').set(auth(tokenB))).status, 401, 'anciennes sessions révoquées');
  r = await request(app).post('/api/connexion').send({ email: B.email, password: 'nouveau-mdp-B2' });
  assert.equal(r.status, 200);
});

test('verrouillage du code après 5 essais ratés', async () => {
  await request(app).post('/api/send-reset-code').send({ email: A.email });
  let dernier;
  for (let i = 0; i < 6; i++) {
    dernier = await request(app).post('/api/verify-reset-code').send({ email: A.email, code: '111111', newPassword: 'nouveau-mdp-A2' });
  }
  assert.equal(dernier.status, 429);
});

test('déconnexion : le jeton est invalidé', async () => {
  const r = await request(app).post('/api/connexion').send({ email: A.email, password: A.password });
  const t = r.body.token;
  assert.equal((await request(app).get('/api/me').set(auth(t))).status, 200);
  await request(app).post('/api/logout').set(auth(t));
  assert.equal((await request(app).get('/api/me').set(auth(t))).status, 401);
});

test('JSON invalide : 400 propre', async () => {
  const r = await request(app).post('/api/connexion').set('Content-Type', 'application/json').send('{pas du json');
  assert.equal(r.status, 400);
});
