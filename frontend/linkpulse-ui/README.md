# LinkPulse — Frontend Angular

Professional, responsive monitoring console for **LinkPulse**, built with Angular 22
(standalone components, signals, lazy routes, Reactive Forms) and aligned with the
`Objectif 2` design specification.

> **Design note:** the six prototype images in `Objectif 2` could not be read by the
> development model (image input unsupported). The UI was therefore implemented from the
> written specification (`groupe_3_linkpulse_projet_web_objectif_2.md`) and the design
> tokens declared there (Background `#051424`, Surface `#0D1C2D`, Input `#010F1F`,
> Action `#0267B8`, Accent `#ADC6FF`, Online `#4EDEA3`, Offline `#FFB4AB`, Text `#D9E9FF`,
> Manrope + JetBrains Mono). A pixel-level comparison against the images is still required.

---

## 1. Quick start

**Prerequisites:** Node.js 22+ and npm.

```powershell
cd frontend/linkpulse-ui
npm install
npm start            # dev server on http://localhost:4200
```

`npm start` proxies `/api` to `http://127.0.0.1:3000` using `proxy.conf.json`. Start the
Express auth API with `cd backend && npm start` for login and registration. The public
offline demo does not need the backend.

```powershell
npm run build        # production build (environment.prod.ts)
npx ng test --watch=false   # unit tests (Vitest, single run)
```

Login and registration call the real Express backend (`POST /api/connexion`,
`POST /api/inscription`). The returned user is persisted in `localStorage` under `lp_user`.
Passwords are stored as salted scrypt hashes; legacy SHA-256 hashes still work and are
upgraded after a successful login.

---

## 2. Routes

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/login` | Login / registration | — | Email + password, show/hide, validation, loading, API error |
| `/` | Public landing | — | Marketing home |
| `/demo` | Offline demo | — | Redirects to `/demo/dashboard`; static sample data, no auth or API |
| `/demo/dashboard` | Demo dashboard | — | Static stats, latency chart and event journal |
| `/demo/sites` | Demo monitored sites | — | Static sites, local filters; mutations disabled |
| `/demo/sites/:id` | Demo site details | — | Static checks and latency history; live tests disabled |
| `/demo/incidents` | Demo incidents | — | Static incidents and evidence |
| `/dashboard` | Dashboard | `authGuard` | Statistics, latency chart, service states, event journal |
| `/sites` | Monitored sites | `authGuard` | List, filters, search, add, pause, delete |
| `/sites/:id` | Site details | `authGuard` | Route param, metrics, latency chart, checks, related incidents |
| `/incidents` | Incidents | `authGuard` | Stats, severity/status, filters, search, evidence, PDF report |
| `/diagnostic` | Diagnostic | `authGuard` | DNS / HTTP / TLS immediate diagnostic |
| `**` | Public landing fallback | — | Unknown paths keep their URL and use the default tab title |

Navigation uses `routerLink` / `routerLinkActive` in the sidebar, topbar and public header.
Refreshing a deep link works because the dev server and production host fall back to
`index.html` (standard SPA rewrite).

`withComponentInputBinding()` binds `/sites/:id` to the `id` input of `SiteDetailsComponent`;
the component reloads via an `effect` when the input changes.

---

## 3. Architecture

```
src/
  app/
    app.config.ts              # router, hydration, provideHttpClient(withFetch())
    app.routes.ts              # lazy routes + authGuard
    core/
      demo/demo-mode.ts        # route-scoped demo marker
      guards/auth.guard.ts     # redirects to /login?returnUrl=…
      models/
        site.model.ts          # Site, CheckResult, LatencyPoint, LatencySeries, AddSitePayload
        user.model.ts          # User, LoginRequest, RegisterRequest, AuthResponse
        dashboard.model.ts     # DashboardSummary, LatencySeries, RecentEvent, DiagnosticResult
        incident.model.ts      # Incident, IncidentDetail, evidence, stats
      services/
        dashboard.service.ts
        sites.service.ts
        incidents.service.ts
        diagnostics.service.ts
        auth.service.ts        # real login/register, localStorage session
    layout/
      console-layout/          # sidebar + topbar + router-outlet (guarded)
      demo-layout/             # separate shell; no auth topbar
      public-layout/           # public header/footer
      sidebar/ topbar/
    demo/
      demo-services.ts         # static providers scoped to /demo
    pages/
      auth/ dashboard/ monitored-sites/ site-details/ incidents/ diagnostic/ home/
    shared/
      loading-state/ empty-state/ error-state/
  environments/
    environment.ts             # dev: apiBaseUrl '/api'
    environment.prod.ts        # prod: apiBaseUrl '/api'
  styles.scss                  # design tokens, resets, a11y helpers
```

**Conventions**

- Standalone components only (no NgModules).
- Signals (`signal`, `computed`, `effect`) for state; no mutation of signals.
- Strongly typed interfaces for every API payload.
- `inject()` instead of constructor injection.
- Native control flow (`@if`, `@for`, `@switch`); no `ngClass`/`ngStyle`.
- Loading / empty / error states on every data page.
- No direct DOM manipulation except the CSV/PDF download helpers.
- Live-user services use the API. Demo fixtures are isolated in `app/demo` and only
  provided to `/demo` routes.

---

## 4. Features

### Login (`/login`)
Email/password with show/hide, Reactive Forms validation, loading state, API error message,
registration tab. On success the user is redirected to `/dashboard` (or the `returnUrl`
query param).

### Dashboard (`/dashboard`)
- Four metric cards (availability, average response, monitored sites, open incidents).
- Active-incident banner when the summary reports one.
- Latency chart driven by `GET /api/dashboard/latency?range=1h|24h|7d`, threshold line.
- Service state list linking to each site detail.
- Recent events journal with CSV export.
- Loads `summary`, `latency`, `events` and `sites` in parallel; any failure shows the error
  state.

### Monitored sites (`/sites`)
- Table with URL, status, response time, 30-day availability and last check.
- Client-side status tabs and text search (name/URL).
- "Add site" modal with Reactive Forms validation → `POST /api/sites`.
- Pause/resume → `PATCH /api/sites/:id`; delete → `DELETE /api/sites/:id`.
- Each row links to `/sites/:id`.

### Site details (`/sites/:id`)
- Route-parameter driven; reloads when the id changes.
- Availability, average response time, TLS expiry and last HTTP check.
- 24-hour latency chart with threshold.
- Recent check history table (HTTP code, latency, probe, result).
- Related incidents table linking to the register.
- "Run immediate check" → `POST /api/sites/:id/checks/run`.

### Incidents (`/incidents`)
- Stats cards: total/open/resolved, MTTR, 24-hour availability.
- Status tabs (all / ongoing / resolved) and text search.
- Register with severity markers and status.
- Evidence sheet: HTTP code, outage duration, probe, impact, timestamped evidence timeline.
- Raw trace toggle, client-side PDF report.

### Diagnostic (`/diagnostic`)
- Site selector, DNS / HTTP / TLS / probe results, anomaly summary, links to incidents and
  site details. `GET /api/diagnostics/sites/:id/latest` and
  `POST /api/diagnostics/sites/:id/run`.

### Offline demo (`/demo`)
- The landing-page “Voir la démo” link opens `/demo/dashboard` without login.
- Dashboard, sites, details and incidents reuse the existing pages with route-scoped static
  providers. Sample hostnames use the reserved `.example` domain.
- A persistent `DEMO` banner identifies the fictional data. Demo routes make no API calls,
  do not use `AuthService` or `localStorage`, and do not alter real-user records.
- Site creation, edits, deletion, real checks and diagnostics are disabled with an
  explanation. Charts, filters, incident evidence and local report/export actions remain
  available. “Quitter la démo” returns to `/`.

### Shared
`LoadingStateComponent`, `EmptyStateComponent`, `ErrorStateComponent`.

---

## 5. Services, models and endpoints

### Services
| Service | Responsibility |
|---|---|
| `DashboardService` | summary, latency series, events, CSV export |
| `SitesService` | list/get/add/update/delete sites, pause, checks, latency |
| `IncidentsService` | stats, list, detail/evidence |
| `DiagnosticsService` | latest and on-demand diagnostic |
| `AuthService` | real login/register/logout, localStorage session |
| `Demo*Service` | static dashboard, sites and incidents; provided only under `/demo` |

### API endpoints used by the UI

All paths are prefixed with `environment.apiBaseUrl` (`/api`). Full payloads and models are
in `../../API_CONTRACT.md`.

| Method | Path | UI usage |
|---|---|---|
| POST | `/connexion` | Login |
| POST | `/inscription` | Registration |
| GET | `/dashboard/summary` | Dashboard metrics |
| GET | `/dashboard/latency?range=` | Dashboard chart |
| GET | `/dashboard/events` | Dashboard journal |
| GET | `/dashboard/export.csv` | CSV export |
| GET | `/sites` | Sites list |
| POST | `/sites` | Add site |
| GET | `/sites/:id` | Site details |
| PATCH | `/sites/:id` | Pause / resume |
| DELETE | `/sites/:id` | Delete site |
| POST | `/sites/:id/checks/run` | Immediate check |
| GET | `/sites/:id/checks` | Check history |
| GET | `/sites/:id/latency?range=` | Site latency chart |
| GET | `/incidents` | Incident register |
| GET | `/incidents/stats` | Incident metrics |
| GET | `/incidents/:id` | Incident evidence |
| GET | `/diagnostics/sites/:id/latest` | Latest diagnostic |
| POST | `/diagnostics/sites/:id/run` | Run diagnostic |

### Backend status

Implemented now (Express, `backend/server.js`, port 3000):

```http
GET  /api/health
GET  /api/clients            (no password hashes)
POST /api/inscription
POST /api/connexion
```

The monitoring endpoints above are **pending**. There is no mock interceptor: until the
backend implements them, those pages show empty/error states.

The FastAPI skeleton (`backend/app/main.py`) only exposes `GET /health` and is not the auth
backend.

### Switching the API location

- Development: `proxy.conf.json` forwards `/api` to `http://127.0.0.1:3000`.
- Production: serve the SPA and API from the same origin, or set
  `environment.prod.ts` `apiBaseUrl` to the API origin and enable CORS.

No component or service changes are required when the backend is implemented.

---

## 6. Design system

Tokens live in `src/styles.scss`:

```scss
--clr-bg: #051424;        --clr-surface: #0d1c2d;
--clr-input: #010f1f;     --clr-action: #0267b8;
--clr-accent: #adc6ff;    --clr-online: #4edea3;
--clr-offline: #ffb4ab;   --clr-text: #d9e9ff;
--font-sans: 'Manrope';   --font-mono: 'JetBrains Mono';
```

Manrope and JetBrains Mono are loaded from Google Fonts in `src/index.html`. Component SCSS
files use these variables. Layouts include breakpoints at 480/700/800/900/980/1100 px;
tables scroll inside their cards to avoid page overflow.

Accessibility: skip link, landmarks, `aria-label`/`aria-pressed`/`aria-expanded`,
`routerLinkActive`, visible focus ring, status roles for loading/error notices.

---

## 7. Verification performed

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | Pass, 0 errors / 0 warnings |
| Unit tests | `npx ng test --watch=false` | Pass, 12 files / 58 tests |
| Offline demo | Browser with backend stopped | Demo pages load and refresh; no `/api` requests |
| Demo isolation | Angular integration tests | No auth session, API requests, or demo mutations |
| Visual pixel audit | — | Not possible: prototype images unsupported by the model |

Manual checks still recommended in a browser: keyboard navigation, mobile menu at ≤980 px,
add/pause/delete site flows, range switching, PDF/CSV downloads — once the backend exists.

---

## 8. Known limitations

- Authentication endpoints are implemented; the monitoring endpoints are not, so live
  dashboard/sites/incidents data is not available yet.
- No request interceptor: the backend returns the user object only and `AuthService`
  persists it in `localStorage`. Add an `Authorization` interceptor if token auth is
  required later.
- PDF reports are generated client-side.
- The visual comparison against the six prototype images is outstanding because the images
  could not be read; tokens and layout were derived from the written spec.
- No `lint` script; `npm run build` and `npx ng test --watch=false` are the gates.