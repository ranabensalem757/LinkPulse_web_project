# LinkPulse — Web Project

Monitoring console for **LinkPulse**, built with **Angular 22** (standalone components,
signals, lazy routes, Reactive Forms) and a **FastAPI** backend skeleton.

The frontend is a complete, responsive SPA with a mocked API so every page works before the
backend endpoints exist.

---

## 1. Requirements

- **Node.js 22+** and npm
- Git

Check your versions:

```powershell
node --version
npm --version
```

---

## 2. Run the frontend

All commands run from the Angular project folder:

```powershell
cd frontend/linkpulse-ui
npm install
npm start
```

Open **http://localhost:4200** in your browser.

The first `npm install` can take a few minutes. `npm start` compiles the app and keeps it
running; edit files and the browser refreshes automatically.

---

## 3. Pages to open

| Page | URL |
|---|---|
| Landing | http://localhost:4200/ |
| Login | http://localhost:4200/login |
| Dashboard | http://localhost:4200/dashboard |
| Monitored sites | http://localhost:4200/sites |
| Site details (example) | http://localhost:4200/sites/site-1 |
| Incidents | http://localhost:4200/incidents |
| Diagnostic | http://localhost:4200/diagnostic |

> Do **not** open the `.html` files directly with `file://`. Angular routing and the mock API
> only work through the dev server.

### Demo login

Authentication is mocked. Use any valid e-mail and a password of at least 8 characters:

```
Email:    ops@linkpulse.io
Password: LinkPulse1
```

The session is stored in `localStorage` (`lp_user`). Protected pages (`/dashboard`, `/sites`,
`/incidents`, `/diagnostic`) redirect to `/login` until you sign in.

---

## 4. What you can test

- **Login / registration:** validation, show/hide password, loading state, error handling.
- **Dashboard:** availability, average response time, open incidents, range switch
  (`1H / 24H / 7J`), service states, event journal, CSV export.
- **Monitored sites:** status filters, text search, add site, pause/resume, delete, open detail.
- **Site details:** route parameter (`/sites/:id`), availability, latency chart, check history,
  related incidents, immediate check.
- **Incidents:** status tabs, search, severity/status, evidence timeline, PDF report.
- **Diagnostic:** DNS / HTTP / TLS analysis for a selected site.

Every data page handles **loading**, **empty**, and **error** states.

---

## 5. Project structure

```
LinkPulse/
  backend/                     FastAPI skeleton (only GET /health today)
  frontend/linkpulse-ui/       Angular application
    src/app/
      core/                    guards, interceptors, models, services
      layout/                  console layout, public layout, sidebar, topbar
      pages/                   auth, dashboard, monitored-sites, site-details, incidents, diagnostic, home
      shared/                  loading/empty/error states, status badge, metric card
    src/environments/          API base URL + mock API switch
    README.md                  detailed frontend documentation
```

---

## 6. Build and tests

```powershell
cd frontend/linkpulse-ui
npm run build                  # production build
npx ng test --watch=false      # unit tests
```

Expected: production build succeeds with 0 errors / 0 warnings; 58 unit tests pass.

To preview the production build:

```powershell
npm run build
npx serve -s dist/linkpulse-ui/browser
```

---

## 7. Backend / API status

The current FastAPI backend only exposes:

```http
GET /health -> {"status": "ok"}
```

All `/api/*` endpoints used by the UI are **mocked in development** by an Angular HTTP
interceptor. In production the mock is disabled via `src/environments/environment.prod.ts`.

To connect the real backend:

1. Implement the documented endpoints in FastAPI.
2. Set `useMockApi: false` in `src/environments/environment.ts` (or use the production config).
3. Point `apiBaseUrl` at the backend and enable CORS.

See `frontend/linkpulse-ui/README.md` for the full endpoint list and architecture details.

---

## 8. Notes

- The UI follows the design tokens from the `Objectif 2` written specification
  (`#051424`, `#0D1C2D`, `#0267B8`, `#ADC6FF`, `#4EDEA3`, `#FFB4AB`, Manrope + JetBrains Mono).
- A pixel-by-pixel comparison against the six prototype images is still pending: the images
  could not be read by the development model.
- `frontend/linkpulse-ui/src/app/core/demo-store.ts` is legacy and no longer used by the pages.