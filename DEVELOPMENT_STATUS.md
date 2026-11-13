# LinkPulse — Development Status

Last updated: 2026-11-13

## Summary

Authentication is fixed end-to-end. The Angular dev proxy was pointing at the wrong port
(8000) while the working auth API is the Express server on port 3000. The proxy now targets
3000, the backend uses salted scrypt with transparent migration of the existing SHA-256
hash, and the login form no longer prefills demo credentials.

The monitoring endpoints (`/api/sites`, `/api/dashboard/*`, `/api/incidents/*`,
`/api/diagnostics/*`) are still not implemented.

## Root causes found

1. **Wrong proxy target.** `frontend/linkpulse-ui/proxy.conf.json` forwarded `/api` to
   `http://127.0.0.1:8000`, but the auth API is `backend/server.js` on port **3000**.
   `backend/app/main.py` (FastAPI) only exposes `GET /health`. Every login/registration
   request from the UI failed before reaching the auth logic.
2. **Backend file path depended on the current directory.** `server.js` used
   `./clients.json`; starting it from the repository root would read/create a different
   file from `backend/clients.json`. It now resolves the file relative to `__dirname`.
3. **Weak password storage.** Registration/login used unsalted SHA-256. The existing record
   is still SHA-256, so a compatible verification path was required.
4. **Case-sensitive email matching.** `oussema@gmail.com` and `Oussema@gmail.com` were
   treated as different accounts. Emails are now normalized (trim + lowercase).
5. **Raw HTTP errors in the UI.** A 401/409 rejection surfaced as an Angular
   `HttpErrorResponse` message instead of the backend's `message`. `AuthService` now maps
   HTTP/network errors to readable messages.
6. **Prefilled demo credentials.** The login form defaulted to
   `nom@infrastructure.corp` / `LinkPulse1`, which is fake data and could be mistaken for a
   real account. The defaults are removed; login only requires a non-empty password.
7. **Password hashes exposed.** `GET /api/clients` returned the stored hashes. It now
   returns only `id`, `email`, `name`, `dateInscription`.

## Fixes implemented

### Backend (`backend/server.js`)

- `PORT` and `CLIENTS_FILE` environment overrides; default port 3000; clients file resolved
  from `__dirname`.
- Email normalization and format validation.
- Registration password policy (8–200 characters).
- Duplicate detection is case-insensitive and returns `409`.
- New password format: `scrypt$<salt-hex>$<hash-hex>`.
- Legacy SHA-256 (64 hex) verification is retained.
- On a successful legacy login, the password is re-hashed with scrypt and the record is
  rewritten atomically; `id`, `email`, `name` and `dateInscription` are preserved.
- `GET /api/clients` no longer returns password hashes.
- JSON 404 and JSON 500 handlers; request bodies are never logged.
- `GET /api/health`.

### Frontend

- `proxy.conf.json`: `/api` → `http://127.0.0.1:3000`.
- `auth.ts`: removed prefilled credentials; login password only requires a value.
- `auth.service.ts`: maps HTTP error bodies and network failures to readable messages.
- `auth.html`: login password validation message updated.
- `environment.ts`: example URL updated to 3000.

### Data

- Backed up `backend/clients.json` to
  `backend/clients.backup-20261113-223542.json` before changes.
- The existing record (`oussema@gmail.com`, id `1794588820582`) is unchanged in the real
  file.
- Only **one** account was found in `backend/clients.json`, not two. No account was
  deleted, recreated or reset.

## Tests

### Backend (`backend/test-auth.js`)

```
cd backend
npm test
```

Result: **2 tests passed**.

Covered: scrypt hash/verify, legacy SHA-256 verify, registration, duplicate rejection
(case-insensitive), login, legacy hash upgrade without changing the record, wrong password,
weak password, sanitized client listing, JSON 404.

### Frontend

```
cd frontend/linkpulse-ui
npx ng test --watch=false
```

Result: **56 tests passed** across 11 files.

Covered: login, registration, duplicate-email 409, HTTP 401 message, unreachable backend,
logout, session restore from `localStorage`, form validation.

### End-to-end through the Angular proxy

A temporary copy of the user data was used, then deleted. Through
`http://localhost:4200/api`:

| Request | Result |
|---|---|
| `GET /api/health` | 200 `{status:"ok"}` |
| `GET /api/clients` | 200, no password field |
| Wrong password (legacy account) | 401 `Email ou mot de passe incorrect.` |
| Register `e2e@example.com` | 201 |
| Duplicate `E2E@example.com` | 409 `Cet email possède déjà un compte.` |
| Login `E2E@example.com` / `E2ePass1!` | 200 |
| Wrong password for new account | 401 |

The temporary file was removed; `backend/clients.json` was not modified.

### Build

```
cd frontend/linkpulse-ui
npm run build
```

Pass, 0 errors / 0 warnings.

## Remaining issues

1. **Monitoring endpoints are not implemented.** The dashboard, sites, incidents and
   diagnostic pages will show empty/error states until the `/api/*` monitoring routes exist.
2. **No real session token.** The backend returns the user object only; the frontend
   persists it in `localStorage`. If token-based auth is required later, add an
   `Authorization` interceptor and a backend session/token endpoint.
3. **No browser-console capture.** The checks above used HTTP requests and unit tests; a
   manual browser pass is still recommended.
4. **Angular hydration warning** (`NG0505`) is logged by the dev server because
   `provideClientHydration()` is configured without SSR. It does not block auth; remove the
   provider or add SSR if desired.
5. **Pixel audit** against the six prototype images is still pending.

## Run

```powershell
# Terminal 1 — auth backend
cd backend
npm install
npm start

# Terminal 2 — frontend
cd frontend/linkpulse-ui
npm install
npm start
```

Open http://localhost:4200/login. The proxy forwards `/api` to port 3000.

## Backup

`backend/clients.backup-20261113-223542.json` (created before any data change).