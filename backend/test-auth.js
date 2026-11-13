const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');

const { hashPassword, verifyPassword, needsRehash } = require('./server.js');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('password helpers: scrypt and legacy SHA-256', () => {
  const hash = hashPassword('CorrectHorse1');
  assert.match(hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(verifyPassword('CorrectHorse1', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
  assert.equal(needsRehash(hash), false);

  const legacy = sha256('LegacyPass1');
  assert.equal(verifyPassword('LegacyPass1', legacy), true);
  assert.equal(verifyPassword('wrong-password', legacy), false);
  assert.equal(needsRehash(legacy), true);
});

test('registration, duplicate rejection, login and legacy migration', { timeout: 30_000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpulse-auth-'));
  const clientsFile = path.join(dir, 'clients.json');
  fs.writeFileSync(
    clientsFile,
    JSON.stringify(
      [
        {
          id: 'legacy-1',
          email: 'Legacy@Example.com',
          name: 'legacy',
          password: sha256('LegacyPass1'),
          dateInscription: '01/01/2026 00:00:00',
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(port), CLIENTS_FILE: clientsFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });

  t.after(async () => {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {
      // server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start. Logs:\n${logs}`);

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  // Legacy account can still log in, with a different email case.
  const legacyLogin = await postJson(`${base}/api/connexion`, {
    email: 'LEGACY@example.com',
    password: 'LegacyPass1',
  });
  assert.equal(legacyLogin.status, 200);
  assert.equal(legacyLogin.body.succes, true);
  assert.equal(legacyLogin.body.client.id, 'legacy-1');

  // The hash is transparently upgraded to scrypt, without changing the record.
  let stored = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'legacy-1');
  assert.equal(stored[0].email, 'Legacy@Example.com');
  assert.match(stored[0].password, /^scrypt\$/);
  assert.equal(verifyPassword('LegacyPass1', stored[0].password), true);

  // The upgraded hash still works on the next login.
  const legacyLoginAgain = await postJson(`${base}/api/connexion`, {
    email: 'legacy@example.com',
    password: 'LegacyPass1',
  });
  assert.equal(legacyLoginAgain.status, 200);

  // Wrong password is rejected and does not leak the account state.
  const wrong = await postJson(`${base}/api/connexion`, {
    email: 'legacy@example.com',
    password: 'WrongPass1',
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.succes, false);
  assert.match(wrong.body.message, /incorrect/i);

  // New account registration.
  const registered = await postJson(`${base}/api/inscription`, {
    email: 'New.User@Example.com',
    password: 'NewPass1!',
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.succes, true);
  assert.equal(registered.body.client.email, 'new.user@example.com');

  stored = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
  assert.equal(stored.length, 2);
  const created = stored.find(client => client.email === 'new.user@example.com');
  assert.ok(created);
  assert.match(created.password, /^scrypt\$/);
  assert.equal(created.password.includes('NewPass1!'), false);

  // Duplicate email is rejected, including a different case.
  const duplicate = await postJson(`${base}/api/inscription`, {
    email: 'NEW.USER@example.com',
    password: 'AnotherPass1',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.succes, false);

  // New account can log in.
  const newLogin = await postJson(`${base}/api/connexion`, {
    email: 'new.user@example.com',
    password: 'NewPass1!',
  });
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.body.client.email, 'new.user@example.com');

  // Weak password is rejected by the server.
  const weak = await postJson(`${base}/api/inscription`, {
    email: 'weak@example.com',
    password: 'short',
  });
  assert.equal(weak.status, 400);

  // The listing endpoint never exposes password hashes.
  const listResponse = await fetch(`${base}/api/clients`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.length, 2);
  for (const client of list) {
    assert.equal(Object.prototype.hasOwnProperty.call(client, 'password'), false);
  }

  const logMarker = 'AUTH_LOG_SENTINEL';
  const malformed = await fetch(`${base}/api/connexion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: `{"password":"${logMarker}"}x`,
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { succes: false, message: 'Requête invalide.' });
  assert.equal(logs.includes(logMarker), false);

  // Unknown API routes still return JSON.
  const missing = await fetch(`${base}/api/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('content-type').includes('application/json'), true);
});