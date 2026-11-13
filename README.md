# LinkPulse — Web Project

Monitoring console for **LinkPulse**, built with **Angular 22** (standalone components,
signals, lazy routes, Reactive Forms) and an **Express** auth API. The FastAPI folder is a
skeleton and is **not** the auth backend.

The frontend is a responsive SPA. **All data comes from real API calls**: there is no mock
interceptor, in-memory store or seed data.

---

## 1. Requirements

- **Node.js 22+** and npm
- Git

```powershell
node --version
npm --version
```

---

## 2. Run the application

### Backend (auth API)

```powershell
cd backend
npm install
npm start            # http://localhost:3000
```

The auth API is `backend/server.js` (Express). It stores users in `backend/clients.json`.
`PORT` and `CLIENTS_FILE` can be overridden with environment variables.

### Frontend

```powershell
cd frontend/linkpulse-ui
npm install
npm start            # http://localhost:4200
```

The Angular dev server proxies `/api` to `http://127.0.0.1:3000` (`proxy.conf.json`).
Open **http://localhost:4200**.

In production, serve the SPA and the API from the same origin (reverse proxy), or change
`apiBaseUrl` and enable CORS. `apiBaseUrl` is `/api` in both
`src/environments/environment.ts` and `environment.prod.ts`.

---

## 3. Pages

| Page | URL |
|---|---|
| Landing | http://localhost:4200/ |
| Login / registration | http://localhost:4200/login |
| Dashboard | http://localhost:4200/dashboard |
| Monitored sites | http://localhost:4200/sites |
| Site details (example) | http://localhost:4200/sites/site-1 |
| Incidents | http://localhost:4200/incidents |
| Diagnostic | http://localhost:4200/diagnostic |

> Do **not** open `.html` files with `file://`. Routing and the API base URL only work
> through the dev server / production host.

### Authentication

- `POST /api/connexion` — login.
- `POST /api/inscription` — registration.
- The returned user is stored in `localStorage` under `lp_user`.
- Protected routes redirect to `/login?returnUrl=…` when no session exists.
- Logout clears `lp_user` and returns to the home page.
- There is **no JWT or bearer token**: the backend returns the user object only.
- Passwords are hashed with **scrypt**. Legacy unsalted SHA-256 hashes are still accepted
  for login and are transparently upgraded to scrypt after a successful login. Existing
  accounts and IDs are preserved.

---

## 4. What you can test

- **Login / registration:** validation, show/hide password, loading, backend error
  messages, duplicate-email rejection, logout, session restore after refresh.
- **Dashboard:** availability, response time, incidents, range switch, service states,
  event journal, CSV export.
- **Monitored sites:** filters, search, add, pause/resume, delete.
- **Site details:** route parameter, metrics, latency chart, checks, related incidents.
- **Incidents:** status tabs, search, evidence timeline, PDF report.
- **Diagnostic:** DNS / HTTP / TLS analysis.

Every data page handles loading, empty and error states. The monitoring endpoints are still
pending, so those pages show empty/error states until implemented.

---

## 5. Project structure

```
LinkPulse/
  API_CONTRACT.md                 API endpoints, payloads and models
  DEVELOPMENT_STATUS.md           what is done, what is pending
  backend/
    server.js                     Express auth API (port 3000)
    clients.json                  user records (scrypt hashes)
    clients.backup-*.json         timestamped backup
    test-auth.js                  backend auth tests
  frontend/linkpulse-ui/          Angular application
    src/app/
      core/                       guards, models, services
      layout/                     console layout, public layout, sidebar, topbar
      pages/                      auth, dashboard, monitored-sites, site-details, incidents, diagnostic, home
      shared/                     loading/empty/error state components
    src/environments/             apiBaseUrl
    proxy.conf.json               /api → http://127.0.0.1:3000
    README.md                     detailed frontend documentation
  backend/app/main.py             FastAPI skeleton (only GET /health)
```

---

## 6. Build and tests

```powershell
# Backend
cd backend
npm test

# Frontend
cd frontend/linkpulse-ui
npm run build
npx ng test --watch=false
```

Current results:

| Check | Result |
|---|---|
| Backend auth tests | 2 tests passed |
| Frontend unit tests | 56 tests passed (11 files) |
| Production build | Pass, 0 errors / 0 warnings |

There is no `lint` script in either package.

---

## 7. Backend / API status

Implemented now (Express, port 3000):

```http
GET  /api/health
GET  /api/clients            (no password hashes)
POST /api/inscription
POST /api/connexion
```

Pending (no FastAPI implementation yet): all monitoring endpoints in `API_CONTRACT.md`
(`/api/sites`, `/api/dashboard/*`, `/api/incidents/*`, `/api/diagnostics/*`). The FastAPI
skeleton in `backend/app/main.py` only exposes `GET /health`.

Data:

- Users live in `backend/clients.json`.
- A backup was created before the auth changes:
  `backend/clients.backup-20261113-223542.json`.
- Only **one** existing account was found in `clients.json` (`oussema@gmail.com`), not two.

---

## 8. Notes

- Design tokens: `#051424`, `#0D1C2D`, `#0267B8`, `#ADC6FF`, `#4EDEA3`, `#FFB4AB`,
  Manrope + JetBrains Mono.
- A pixel-by-pixel comparison against the six prototype images is still pending.
- No mock/demo data exists in the application sources.