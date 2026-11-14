# LinkPulse — Backend Node.js / Express

High-performance, secure observability and monitoring engine for **LinkPulse**, built with **Node.js** and **Express 5**. The backend provides real-time DNS/TLS/HTTP network probing, automated incident lifecycle management, cryptographically secure authentication with legacy hash migration, and strict multi-tenant data isolation.

---

## 1. Quick start

**Prerequisites:** Node.js 20+ and npm.

### Starting the server
```powershell
cd backend
npm install
npm start            # starts Express on http://localhost:3000
```
*(Alternatively: `node server.js`)*

The server starts the REST API on port `3000` and immediately begins the background monitoring probe loop (executing every 15 seconds).

### Testing the server
Run the comprehensive integration test suite (29 automated assertions):
```powershell
node test-auth.js
```

### Configuring real email delivery
By default, the backend uses **Ethereal** (test SMTP account generated automatically). Verification emails are captured, and a preview URL is logged in the console.

To enable delivery to real email inboxes, provide standard SMTP environment variables before launching:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your-email@gmail.com"
$env:SMTP_PASS = "your-app-password"
$env:SMTP_SECURE = "false"
node server.js
```

---

## 2. API Endpoints

All endpoints are served under `/api`. Protected routes require the `Authorization: Bearer <token>` header obtained via login, registration, or OAuth.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Service health check (`{ "status": "ok" }`) |
| `POST` | `/inscription` | Public | Account registration (scrypt2 hash, returns Bearer token) |
| `POST` | `/connexion` | Public | Password login (supports legacy migration, returns Bearer token) |
| `POST` | `/oauth` | Public | Rapid SSO login/registration (Google, GitHub) |
| `POST` | `/logout` | `requireAuth` | Revokes the active session token on the server |
| `GET` | `/me` | `requireAuth` | Retrieves the profile of the authenticated user |
| `POST` | `/send-reset-code` | Public | Generates & emails a secure 6-digit code (rate-limited) |
| `POST` | `/verify-reset-code` | Public | Validates code, enforces max 5 attempts, updates password |
| `GET` | `/clients` | Public | List registered users without password hashes (administrative) |
| `GET` | `/dashboard/summary` | `requireAuth` | Aggregated user metrics (availability, avg latency, incidents) |
| `GET` | `/dashboard/latency` | `requireAuth` | User-scoped latency time-series (`?range=1h\|24h\|7d`) |
| `GET` | `/dashboard/events` | `requireAuth` | Journal of recent events for the user's sites |
| `GET` | `/dashboard/export.csv` | `requireAuth` | CSV export of the user's event history |
| `GET` | `/sites` | `requireAuth` | List sites owned by the user (`?status=`, `?q=`) |
| `POST` | `/sites` | `requireAuth` | Add a new site and run an immediate initial probe |
| `GET` | `/sites/:id` | `requireAuth` | Retrieve detailed configuration of a site |
| `PATCH` | `/sites/:id` | `requireAuth` | Update site settings or pause/resume monitoring |
| `DELETE` | `/sites/:id` | `requireAuth` | Delete site and clean up associated checks and incidents |
| `POST` | `/sites/:id/checks/run` | `requireAuth` | Trigger an immediate manual probe on a site |
| `GET` | `/sites/:id/checks` | `requireAuth` | Retrieve check execution history (last 100 runs) |
| `GET` | `/sites/:id/latency` | `requireAuth` | Retrieve latency graph points for a specific site |
| `GET` | `/incidents` | `requireAuth` | List user's incidents (`?status=`, `?q=`) |
| `GET` | `/incidents/stats` | `requireAuth` | Calculate user-specific MTTR and 24h availability |
| `GET` | `/incidents/:id` | `requireAuth` | Retrieve incident details with timestamped evidence |
| `GET` | `/diagnostics/sites/:id/latest` | `requireAuth` | Fetch latest diagnostic or execute if absent |
| `POST` | `/diagnostics/sites/:id/run` | `requireAuth` | Execute an on-demand complete DNS/TLS/HTTP diagnostic |

---

## 3. Architecture & Data Persistence

```text
backend/
├── app/                  # FastAPI skeleton (prepared for Python migration)
├── clients.json          # Persistent user accounts and password hashes
├── clients.json.tmp      # Ephemeral file for atomic writes
├── donnees.json          # Persistent sites, checks, incidents, events, and diagnostics
├── donnees.json.tmp      # Ephemeral file for atomic writes
├── package.json          # Node dependencies (express, cors, nodemailer)
├── server.js             # Unified Express server (engine + security + supervision)
└── test-auth.js          # Automated end-to-end integration test suite
```

### Architectural Principles

1. **Atomic File Persistence**: All disk writes (`clients.json` and `donnees.json`) write to a `.tmp` file before performing an atomic `fs.renameSync()`. This guarantees zero data corruption during power interruptions or concurrent operations.
2. **Strict User Scoping**: No entity (site, check, incident, event, diagnostic) is exposed across user boundaries. Every query derives identity from `req.session.userId` (from the verified Bearer token), never from client-submitted parameters.
3. **Zero Heavy External Dependencies**: Built using standard Node.js built-ins (`crypto`, `dns.promises`, `tls`, `perf_hooks`, `fs`) alongside lightweight `express`, `cors`, and `nodemailer`.

---

## 4. Features

### Authentication & Sessions
- **Multi-Format Password Engine**: Uses `scrypt` with a 16-byte cryptographically random salt (`scrypt2$<salt>$<hash>`).
- **Seamless Hash Migration**: Automatically and transparently upgrades legacy `SHA-256` or older `scrypt$` hashes to the modern `scrypt2$` standard upon a user's next successful login.
- **Timing-Safe Comparison**: All credential verifications use `crypto.timingSafeEqual()` to mitigate timing-based side-channel attacks.
- **Server-Side Session Store**: Issues 32-byte cryptographically random Bearer tokens stored in-memory with a 24-hour expiration. Revocation occurs instantly on `POST /api/logout`.

### Password Recovery
- **Cryptographically Secure Codes**: Generates random 6-digit codes via `crypto.randomInt(100000, 1000000)`.
- **Hashed Memory Storage**: The raw verification code is never stored in plaintext; only its SHA-256 hash is held in memory.
- **Strict Controls**: Enforces a 10-minute expiration, single-use invalidation, a maximum of 5 attempts before locking, and rate limiting to prevent spamming.

### Strict User Data Isolation
- Every site created is automatically associated with `req.session.userId`.
- Attempts to query, modify, or delete another user's site by altering the URL ID return `404 Not Found`.
- Background monitoring tasks ignore orphaned or unassigned records.

### Network Supervision Engine
- **Parallel Probing (`Promise.allSettled`)**: Concurrently tests all active sites every 15 seconds without blocking on slow or unresponsive targets.
- **Dual-Phase HTTP Requests**: Issues lightweight `HEAD` requests with a `User-Agent: LinkPulse-Monitor/1.0` and a 6-second timeout, automatically falling back to `GET` if the target returns `405 Method Not Allowed` or `501 Not Implemented`.
- **DNS Resolution Timing**: Measures real DNS lookup duration in milliseconds using `dns.promises.lookup()`.
- **TLS Certificate Validation**: Directly connects over port 443 with SNI (`tls.connect`) to verify certificate expiration date and validity.

### Incident Management (3-Consecutive-Failure Rule)
- Automatically marks a site as `offline` and creates a critical incident after **3 consecutive probe failures** during automatic cycles (or immediately on manual checks).
- Upon service restoration, automatically resolves the incident, logs recovery evidence, and calculates the **MTTR** (Mean Time To Recovery).

---

## 5. Security & Cryptography

- **Hash Scheme**: `scrypt2$<salt-hex>$<hash-hex>` (N=16384, r=8, p=1, length=64).
- **Session Tokens**: 256-bit entropy (`crypto.randomBytes(32).toString('hex')`).
- **Code Hashes**: `SHA-256` hex digest compared via `crypto.timingSafeEqual`.
- **Sanitized Updates**: `PATCH /api/sites/:id` only allows modification of safe fields (`name`, `isEnabled`, `status`, `checkIntervalSeconds`), disallowing modification of `id` or `userId`.

---

## 6. Verification performed

Run tests from the `backend/` directory:

| Test / Check | Command | Result |
|---|---|---|
| Full Integration Suite | `node test-auth.js` | **Pass (29/29 assertions passed)** |
| Registration Flow | `node test-auth.js` | Account creation, duplicate rejection |
| Authentication | `node test-auth.js` | Valid login, invalid password rejection (401) |
| Session & Logout | `node test-auth.js` | Token creation, revocation, re-login |
| Cross-Tenant Isolation | `node test-auth.js` | User B cannot view or delete User A's sites (404) |
| Dashboard Scoping | `node test-auth.js` | Independent metric summaries for distinct users |
| Password Recovery | `node test-auth.js` | Code generation, invalid code rejection, rate-limiting |
| Health Check | `Invoke-RestMethod http://localhost:3000/api/health` | HTTP 200 `{ "status": "ok" }` |

---

## 7. Known limitations & Roadmap

- **In-Memory Session Store**: Active sessions reset upon server restart. (Future target: Redis or signed JWTs).
- **Relational DB & FastAPI Migration**: Storage is currently local JSON (`clients.json` and `donnees.json`). Architecture is designed for planned transition to PostgreSQL / SQLite via FastAPI and SQLAlchemy (`backend/app/main.py`).
- **Multi-Region Probes**: Currently operates from a primary probe (`Tunis · Auto`). Distributed multi-region probe dispatching is planned in future objectives.
