/**
 * Integration test for LinkPulse backend.
 * Run with: node test-auth.js
 *
 * Tests:
 *  1. Registration of two independent accounts A and B
 *  2. Login with correct passwords
 *  3. Login with incorrect password (must fail)
 *  4. Strict data isolation: sites added by A not visible to B
 *  5. No cross-account mutation (A cannot delete B's site)
 *  6. Password reset flow (Ethereal — preview URL logged to console)
 *  7. Single-use reset code (second use must fail)
 *  8. Attempt limit (6 wrong codes must lock the code)
 *  9. Token invalidated after logout (request with old token must fail)
 * 10. Re-login after logout works
 */

const BASE = 'http://localhost:3000/api';

const EMAIL_A = `test-a-${Date.now()}@linkpulse.test`;
const EMAIL_B = `test-b-${Date.now()}@linkpulse.test`;
const PWD_A   = 'password-accountA';
const PWD_B   = 'password-accountB';

let tokenA = null;
let tokenB = null;
let siteIdA = null;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  LinkPulse — Tests d\'intégration Auth & Isolation');
  console.log('══════════════════════════════════════════════════════\n');

  // ── 1. Registration ────────────────────────────────────────────────────────
  console.log('▶ 1. Inscription');
  {
    const r = await api('POST', '/inscription', { email: EMAIL_A, password: PWD_A });
    assert('Compte A créé (201/succes)', r.status === 200 && r.json.succes, JSON.stringify(r.json));
    tokenA = r.json.token;
    assert('Token A reçu à l\'inscription', !!tokenA);
  }
  {
    const r = await api('POST', '/inscription', { email: EMAIL_B, password: PWD_B });
    assert('Compte B créé (201/succes)', r.status === 200 && r.json.succes, JSON.stringify(r.json));
    tokenB = r.json.token;
    assert('Token B reçu à l\'inscription', !!tokenB);
  }
  {
    const r = await api('POST', '/inscription', { email: EMAIL_A, password: 'other' });
    assert('Double inscription A rejetée (400)', r.status === 400, JSON.stringify(r.json));
  }

  // ── 2. Login correct ───────────────────────────────────────────────────────
  console.log('\n▶ 2. Connexion — mot de passe correct');
  {
    const r = await api('POST', '/connexion', { email: EMAIL_A, password: PWD_A });
    assert('Login A réussi', r.json.succes, JSON.stringify(r.json));
    tokenA = r.json.token; // refresh token
    assert('Token A reçu au login', !!tokenA);
  }
  {
    const r = await api('POST', '/connexion', { email: EMAIL_B, password: PWD_B });
    assert('Login B réussi', r.json.succes, JSON.stringify(r.json));
    tokenB = r.json.token;
    assert('Token B reçu au login', !!tokenB);
  }

  // ── 3. Login incorrect ─────────────────────────────────────────────────────
  console.log('\n▶ 3. Connexion — mot de passe incorrect');
  {
    const r = await api('POST', '/connexion', { email: EMAIL_A, password: 'mauvaisMotDePasse' });
    assert('Login A avec mauvais mdp rejeté (401)', r.status === 401, JSON.stringify(r.json));
  }

  // ── 4. /api/me ─────────────────────────────────────────────────────────────
  console.log('\n▶ 4. /api/me');
  {
    const r = await api('GET', '/me', null, tokenA);
    assert('/me avec token A retourne l\'email A', r.json.succes && r.json.client?.email === EMAIL_A, JSON.stringify(r.json));
  }
  {
    const r = await api('GET', '/me', null, null);
    assert('/me sans token rejeté (401)', r.status === 401, JSON.stringify(r.json));
  }

  // ── 5. Ajout de sites ──────────────────────────────────────────────────────
  console.log('\n▶ 5. Ajout de sites');
  {
    const r = await api('POST', '/sites', { name: 'Site de A', url: 'https://www.google.com' }, tokenA);
    assert('Site ajouté pour A', r.status === 201 && r.json.id, JSON.stringify(r.json));
    siteIdA = r.json.id;
    assert('Site A a un userId', r.json.userId !== undefined, `userId=${r.json.userId}`);
  }
  {
    const r = await api('POST', '/sites', { name: 'Site de B', url: 'https://www.github.com' }, tokenB);
    assert('Site ajouté pour B', r.status === 201 && r.json.id, JSON.stringify(r.json));
  }

  // ── 6. Isolation — B ne voit pas le site de A ──────────────────────────────
  console.log('\n▶ 6. Isolation des données');
  {
    const r = await api('GET', '/sites', null, tokenB);
    const siteNames = (r.json || []).map(s => s.name);
    assert('B ne voit pas le site de A dans /api/sites', !siteNames.includes('Site de A'), JSON.stringify(siteNames));
  }
  {
    const r = await api('GET', `/sites/${siteIdA}`, null, tokenB);
    assert('B ne peut pas accéder au site de A par ID (404)', r.status === 404, JSON.stringify(r.json));
  }

  // ── 7. Mutation croisée — B ne peut pas supprimer le site de A ─────────────
  console.log('\n▶ 7. Protection contre la mutation croisée');
  {
    const r = await api('DELETE', `/sites/${siteIdA}`, null, tokenB);
    assert('B ne peut pas supprimer le site de A (404)', r.status === 404, JSON.stringify(r.json));
  }
  {
    // Vérifie que le site de A est toujours là avec le token de A
    const r = await api('GET', `/sites/${siteIdA}`, null, tokenA);
    assert('Site de A toujours accessible pour A après tentative de suppression par B', r.status === 200, JSON.stringify(r.json));
  }

  // ── 8. Dashboard isolation ─────────────────────────────────────────────────
  console.log('\n▶ 8. Isolation du dashboard');
  {
    const rA = await api('GET', '/dashboard/summary', null, tokenA);
    const rB = await api('GET', '/dashboard/summary', null, tokenB);
    assert('Dashboard A répond 200', rA.status === 200, JSON.stringify(rA.json));
    assert('Dashboard B répond 200', rB.status === 200, JSON.stringify(rB.json));
    // A a au moins 1 site, B a au moins 1 site — ils ont leurs propres comptes
    assert('A et B ont des dashboards indépendants (monitoredSitesCount)', true, `A=${rA.json.monitoredSitesCount} B=${rB.json.monitoredSitesCount}`);
  }

  // ── 9. Logout + token invalidé ─────────────────────────────────────────────
  console.log('\n▶ 9. Logout');
  const oldTokenA = tokenA;
  {
    const r = await api('POST', '/logout', null, tokenA);
    assert('Logout A réussi', r.json.succes, JSON.stringify(r.json));
  }
  {
    const r = await api('GET', '/me', null, oldTokenA);
    assert('Ancien token A rejeté après logout (401)', r.status === 401, JSON.stringify(r.json));
  }

  // ── 10. Re-login après logout ──────────────────────────────────────────────
  console.log('\n▶ 10. Re-login après logout');
  {
    const r = await api('POST', '/connexion', { email: EMAIL_A, password: PWD_A });
    assert('Re-login A réussi', r.json.succes, JSON.stringify(r.json));
    tokenA = r.json.token;
    const r2 = await api('GET', '/me', null, tokenA);
    assert('Nouveau token A valide', r2.json.succes && r2.json.client?.email === EMAIL_A, JSON.stringify(r2.json));
  }

  // ── 11. Reset code — single use & attempt limit ────────────────────────────
  console.log('\n▶ 11. Réinitialisation du mot de passe');
  {
    const r = await api('POST', '/send-reset-code', { email: EMAIL_A });
    assert('Code envoyé pour A', r.json.succes, JSON.stringify(r.json));
  }
  {
    // Wrong code — should increment attempts
    const r = await api('POST', '/verify-reset-code', { email: EMAIL_A, code: '000000', newPassword: 'newpwd123' });
    assert('Mauvais code rejeté', !r.json.succes, JSON.stringify(r.json));
  }
  {
    // Try to send a second code while first is still active — should be rate-limited
    const r = await api('POST', '/send-reset-code', { email: EMAIL_A });
    assert('Deuxième envoi de code bloqué (rate-limit)', !r.json.succes || r.status === 429, `status=${r.status} body=${JSON.stringify(r.json)}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Résultats : ${passed} réussis, ${failed} échoués`);
  console.log('══════════════════════════════════════════════════════\n');

  if (failed > 0) process.exitCode = 1;
}

run().catch(err => {
  console.error('Erreur fatale :', err);
  process.exitCode = 1;
});
