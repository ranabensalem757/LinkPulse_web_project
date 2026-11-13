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

The development build enables the in-browser mock API, so every page works without the
FastAPI backend.

```powershell
npm run build        # production build (uses environment.prod.ts, mock API disabled)
npm test             # unit tests (Vitest, single run)
npx ng test --watch=false
```

Demo login: any valid email + an 8-character password. Authentication is mocked
(`AuthService`) and the session is persisted in `localStorage` under `lp_user`.

---

## 2. Routes

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/login` | Login / registration | — | Email + password, show/hide, validation, loading, error |
| `/` | Public landing | — | Marketing home |
| `/dashboard` | Dashboard | `authGuard` | Statistics, latency chart, service states, event journal |
| `/sites` | Monitored sites | `authGuard` | List, filters, search, add, pause, delete |
| `/sites/:id` | Site details | `authGuard` | Route param, metrics, latency chart, checks, related incidents |
| `/incidents` | Incidents | `authGuard` | Stats, severity/status, filters, search, evidence, PDF report |
| `/diagnostic` | Diagnostic | `authGuard` | DNS / HTTP / TLS immediate diagnostic |
| `**` | Redirect | — | Unknown paths → home / dashboard |

Navigation uses `routerLink` / `routerLinkActive` in the sidebar, topbar and public header.
Refreshing any deep link works because the dev server and production host must fall back to
`index.html` (standard SPA rewrite).

`withComponentInputBinding()` binds `/sites/:id` to the `id` input of `SiteDetailsComponent`.

---

## 3. Architecture

```
src/
  app/
    app.config.ts              # providers, router, HttpClient, mock interceptor switch
    app.routes.ts              # lazy routes + guard
    core/
      guards/auth.guard.ts
      interceptors/
        mock-api.interceptor.ts
        mock-handlers.ts       # in-memory API + seed data
      models/
        site.model.ts          # Site, CheckResult, LatencyPoint, LatencySeries, AddSitePayload
        incident.model.ts      # Incident, IncidentDetail, evidence, stats
        dashboard.model.ts     # DashboardSummary, RecentEvent, DiagnosticResult
      services/
        dashboard.service.ts
        sites.service.ts
        incidents.service.ts
        diagnostics.service.ts
        auth.service.ts        # mock authentication (localStorage)
    layout/
      console-layout/          # sidebar + topbar + router-outlet (guarded)
      public-layout/           # public header/footer
      sidebar/ topbar/
    pages/
      auth/ dashboard/ monitored-sites/ site-details/ incidents/ diagnostic/ home/
    shared/
      loading-state/ empty-state/ error-state/ status-badge/ metric-card/
  environments/
    environment.ts             # dev: apiBaseUrl '/api', useMockApi true
    environment.prod.ts        # prod: apiBaseUrl '/api', useMockApi false
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

---

## 4. Features

### Login (`/login`)
Email/password with show/hide, Reactive Forms validation, loading state, error message,
registration tab, SSO notices, "forgot password" notice. On success the user is redirected to
`/dashboard` (or the `returnUrl` query param).

### Dashboard (`/dashboard`)
- Four interactive metric cards (availability, average response, monitored sites, open
  incidents) linking to `/sites` or `/incidents`.
- Active-incident banner when the summary reports one.
- Latency chart driven by `GET /api/dashboard/latency` with `1H / 24H / 7J` ranges, threshold
  line and min/median/max stats.
- Service state list (online / offline / paused) linking to each site detail.
- Recent events journal with CSV export.

### Monitored sites (`/sites`)
- Table with URL, status, response time sparkline, 30-day availability and last check.
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
- Chronological register with severity markers and status.
- Evidence sheet: HTTP code, outage duration, probe, impact, timestamped evidence timeline.
- Raw trace toggle, client-side PDF report, 24-hour incident distribution chart.

### Diagnostic (`/diagnostic`)
- Site selector, DNS / HTTP / TLS / probe results, anomaly summary, links to incidents and
  site details.

### Shared
`LoadingStateComponent`, `EmptyStateComponent`, `ErrorStateComponent`, `StatusBadgeComponent`,
`MetricCardComponent`.

---

## 5. Services, models and endpoints

### Services
| Service | Responsibility |
|---|---|
| `DashboardService` | summary, latency series, events, CSV export |
| `SitesService` | list/get/add/update/delete sites, pause, checks, latency |
| `IncidentsService` | stats, list, detail/evidence |
| `DiagnosticsService` | latest and on-demand diagnostic |
| `AuthService` | mock login/register/logout, localStorage session |

### API endpoints used by the UI

All paths are prefixed with `environment.apiBaseUrl` (`/api`).

| Method | Path | UI usage | Status |
|---|---|---|---|
| GET | `/dashboard/summary` | Dashboard metrics | Mocked |
| GET | `/dashboard/latency?range=` | Dashboard chart | Mocked |
| GET | `/dashboard/events` | Dashboard journal | Mocked |
| GET | `/dashboard/export.csv` | CSV export | Mocked |
| GET | `/sites` | Sites list | Mocked |
| POST | `/sites` | Add site | Mocked |
| GET | `/sites/:id` | Site details | Mocked |
| PATCH | `/sites/:id` | Pause / resume | Mocked |
| DELETE | `/sites/:id` | Delete site | Mocked |
| POST | `/sites/:id/checks/run` | Immediate check | Mocked |
| GET | `/sites/:id/checks` | Check history | Mocked |
| GET | `/sites/:id/latency?range=` | Site latency chart | Mocked |
| GET | `/incidents` | Incident register | Mocked |
| GET | `/incidents/stats` | Incident metrics | Mocked |
| GET | `/incidents/:id` | Incident evidence | Mocked |
| GET | `/diagnostics/sites/:id/latest` | Latest diagnostic | Mocked |
| POST | `/diagnostics/sites/:id/run` | Run diagnostic | Mocked |

### Backend status (FastAPI)

The current backend (`backend/app/main.py`) exposes only:

```http
GET /health -> {"status": "ok"}
```

Therefore **all `/api/*` endpoints above are pending** and served by the mock interceptor in
development. There is also **no real authentication endpoint**; `AuthService` is a local mock.

### Switching from mock to FastAPI

1. Implement the endpoints above in FastAPI.
2. Set `useMockApi: false` in `src/environments/environment.ts` (development) or rely on
   `environment.prod.ts` for production.
3. Point `apiBaseUrl` at the backend (for example `http://127.0.0.1:8000/api`) and enable CORS
   for the Angular origin, or serve the SPA behind the same origin/proxy.

No component or service changes are required: the UI already consumes these typed contracts.

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
files use these variables (hardcoded colours were normalised). Layouts include breakpoints at
480/700/800/900/980/1100 px; tables scroll inside their cards to avoid page overflow.

Accessibility: skip link, landmarks, `aria-label`/`aria-pressed`/`aria-expanded`,
`routerLinkActive`, visible focus ring, status roles for loading/error notices.

---

## 7. Verification performed

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | ✅ success, 0 errors, 0 warnings |
| Unit tests | `npx ng test --watch=false` | ✅ 14 files, 58 tests passed |
| Route guard | integration test | ✅ unauthenticated `/dashboard` → `/login?returnUrl=…` |
| Route param | integration test | ✅ `/sites/site-1` renders `Portfolio personnel` |
| Forms | unit tests | ✅ login validation/persistence, add-site modal submission |
| Dev server smoke | `Invoke-WebRequest` | ✅ `/`, `/dashboard`, `/sites/site-1` → HTTP 200 |
| Design tokens | built CSS inspection | ✅ `#051424`, `#0267b8`, `#4edea3`, `Manrope` present |
| Visual pixel audit | — | ⚠️ not possible: prototype images unsupported by the model |

Manual checks still recommended in a browser: keyboard navigation, mobile menu at ≤980 px,
add/pause/delete site flows, range switching, PDF/CSV downloads.

---

## 8. Known limitations

- No real backend or authentication; data is mocked in development.
- PDF reports are generated client-side (minimal PDF writer), not by the backend.
- The visual comparison against the six prototype images is outstanding because the images
  could not be read; tokens and layout were derived from the written spec.
- `demo-store.ts` is legacy and no longer used by pages; it can be removed once the mock API is
  replaced by FastAPI.