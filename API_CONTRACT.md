# LinkPulse API Contract

The Angular frontend consumes the endpoints below through `environment.apiBaseUrl`.

## Base URL

| Environment | `apiBaseUrl` | How it reaches the backend |
|---|---|---|
| Development | `/api` | `frontend/linkpulse-ui/proxy.conf.json` proxies `/api` to `http://127.0.0.1:3000` (Angular dev server only). |
| Production | `/api` | Serve the SPA and the API from the same origin (reverse proxy), or change `apiBaseUrl` and enable CORS. |

The auth API is `backend/server.js` (Express, default port 3000). The FastAPI file
`backend/app/main.py` is a skeleton with only `GET /health` and is **not** used by the
frontend.

## Implemented endpoints

### Health

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |

### Authentication

| Method | Path | Request body | Success | Errors |
|---|---|---|---|---|
| POST | `/inscription` | `{ "email": string, "password": string }` | `201` + `AuthResponse` | `400` invalid/weak, `409` duplicate |
| POST | `/connexion` | `{ "email": string, "password": string }` | `200` + `AuthResponse` | `400` missing, `401` invalid credentials |

```ts
interface AuthResponse {
  succes: boolean;          // spelling used by the backend
  message?: string;         // error message when `succes` is false
  client: User;
}

interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;       // mapped from the stored `dateInscription`
}
```

Rules:

- Email is trimmed and lowercased before duplicate checks, storage and login.
- Password must be 8–200 characters at registration.
- Registration rejects an existing email with `409` and a message.
- Login returns `401` with `Email ou mot de passe incorrect.` for unknown email or wrong
  password. The same message is used for both to avoid account enumeration.
- There is **no JWT or bearer token**. The frontend persists only the returned user object
  in `localStorage` under `lp_user`.

### Clients listing

| Method | Path | Response |
|---|---|---|
| GET | `/clients` | Array of `{ id, email, name, dateInscription }` |

Password hashes are never returned by this endpoint.

## Password storage

- New accounts: `scrypt$<salt-hex>$<hash-hex>` (16-byte random salt, 64-byte derived key,
  `crypto.scryptSync`, timing-safe comparison).
- Legacy accounts: the original unsalted SHA-256 hash (64 hex characters) is still
  accepted.
- On a successful login with a legacy hash, the record is rewritten with a scrypt hash.
  The user `id`, `email`, `name` and `dateInscription` are preserved.
- Plaintext passwords are never stored or logged.

## Pending monitoring endpoints

The following contract is consumed by the Angular services but is **not implemented yet**.
The UI shows loading/empty/error states until the endpoints exist.

### Sites

| Method | Path | Request / query | Response |
|---|---|---|---|
| GET | `/sites` | `status?`, `q?` | `Site[]` |
| POST | `/sites` | `AddSitePayload` | `Site` |
| GET | `/sites/:id` | — | `Site` |
| PATCH | `/sites/:id` | `Partial<Site>` | `Site` |
| DELETE | `/sites/:id` | — | `{ "success": boolean }` |
| POST | `/sites/:id/checks/run` | `{}` | `CheckResult` |
| GET | `/sites/:id/checks` | — | `CheckResult[]` |
| GET | `/sites/:id/latency` | `range=1h\|24h\|7d` | `LatencySeries` |

```ts
type StatusType = 'online' | 'offline' | 'paused' | 'unknown';

interface Site {
  id: string;
  name: string;
  url: string;
  status: StatusType;
  responseTimeMs: number;
  availability30d: number;
  lastCheckedAt: string;
  checkIntervalSeconds: number;
  isEnabled: boolean;
  region: string;
}

interface AddSitePayload {
  name: string;
  url: string;
  checkIntervalSeconds: number;
}

interface CheckResult {
  id: string;
  siteId: string;
  checkedAt: string;
  success: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  probe: string;
  result: 'ok' | 'timeout' | 'http_error' | 'dns_error' | 'tls_error';
  tlsExpiry: string | null;
}

interface LatencyPoint {
  timestamp: string;
  valueMs: number;
}

interface LatencySeries {
  range: '1h' | '24h' | '7d';
  points: LatencyPoint[];
  thresholdMs: number;
}
```

Pause/resume is `PATCH /sites/:id` with `{ "isEnabled": false, "status": "paused" }`
(resume: `isEnabled: true`, `status: "unknown"`).

### Dashboard

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/dashboard/summary` | — | `DashboardSummary` |
| GET | `/dashboard/latency` | `range=1h\|24h\|7d` | `LatencySeries` |
| GET | `/dashboard/events` | — | `RecentEvent[]` |
| GET | `/dashboard/export.csv` | — | `text/csv` |

```ts
interface DashboardSummary {
  globalAvailability: number;
  avgResponseTimeMs: number;
  monitoredSitesCount: number;
  openIncidentsCount: number;
  hasActiveIncident: boolean;
  activeIncidentSiteName: string | null;
  activeIncidentId: string | null;
}

interface RecentEvent {
  id: string;
  timestamp: string;
  type: 'incident_opened' | 'incident_closed' | 'check_ok' | 'check_fail' | 'site_added' | 'site_paused';
  message: string;
  siteName: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}
```

### Incidents

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/incidents` | `status?`, `q?` | `Incident[]` |
| GET | `/incidents/stats` | — | `DailyIncidentStats` |
| GET | `/incidents/:id` | — | `IncidentDetail` |

```ts
type IncidentStatus = 'ongoing' | 'resolved';
type IncidentSeverity = 'critical' | 'warning' | 'info';

interface Incident {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  type: 'unavailable' | 'slow_response' | 'tls_error' | 'dns_error';
  severity: IncidentSeverity;
  status: IncidentStatus;
  errorCode: string;
  region: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  summary: string;
}

interface IncidentEvidenceEvent {
  id: string;
  eventTime: string;
  evidenceType: 'check_failure' | 'check_recovery' | 'incident_opened' | 'incident_closed' | 'confirmation';
  summary: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  probe: string;
}

interface IncidentDetail extends Incident {
  evidence: IncidentEvidenceEvent[];
}

interface DailyIncidentStats {
  count: number;
  avgResolutionMinutes: number;
  availability24h: number;
}
```

### Diagnostics

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/diagnostics/sites/:id/latest` | — | `DiagnosticResult` |
| POST | `/diagnostics/sites/:id/run` | `{}` | `DiagnosticResult` |

```ts
interface DiagnosticResult {
  siteId: string;
  siteName: string;
  siteUrl: string;
  ranAt: string;
  dnsResolved: boolean;
  dnsLatencyMs: number | null;
  httpStatus: number | null;
  httpResponseTimeMs: number | null;
  tlsValid: boolean | null;
  tlsExpiry: string | null;
  probe: string;
  errorCategory: string | null;
  summary: string;
}
```

## Error handling

- Non-2xx auth responses carry `{ "succes": false, "message": "…" }`. The Angular
  `AuthService` maps the body to an `Error`, so the login page shows the backend message
  instead of a raw Angular HTTP error.
- Network failures are reported as
  `Serveur injoignable. Vérifiez que le backend LinkPulse est démarré.`
- Monitoring pages show their own localized error state when a request fails.
- Malformed JSON requests return `400` with `{ "succes": false, "message": "Requête invalide." }`.
- Server error logs record only the error class, never the request body or raw error message.