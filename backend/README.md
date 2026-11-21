# LinkPulse — Backend Node.js / Express

API de supervision de **LinkPulse** (Node.js 20+, Express 5) : sondes DNS / TLS / HTTP, incidents, statistiques, authentification et données cloisonnées par utilisateur.

---

## 1. Démarrage rapide

```powershell
cd backend
npm install
copy .env.example .env      # puis adaptez les valeurs (voir ci-dessous)
npm start                   # http://localhost:3000
```

Les sondes tournent en arrière-plan (cycle toutes les 15 s ; chaque site a son propre intervalle, 10 s minimum).

### Tests

```powershell
npm test
```
La suite (`test/api.test.js`, 16 tests, `node:test` + `supertest`) démarre l'application en mémoire avec un dossier de données temporaire : **aucun serveur à lancer, aucun accès Internet requis**. Elle couvre l'authentification, l'isolation entre utilisateurs, l'anti-SSRF, la validation, la réinitialisation de mot de passe, les courbes de latence et la course critique « site supprimé pendant un contrôle ».

### Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `PORT` | Port de l'API (défaut `3000`) |
| `CORS_ORIGIN` | Origines autorisées, séparées par des virgules (défaut `http://localhost:4200`) |
| `DATA_DIR` | Dossier des fichiers de données (défaut : `backend/`) |
| `ALLOW_PRIVATE_TARGETS` | `true` autorise localhost/réseau privé comme cibles — **développement uniquement** |
| `TRUST_PROXY` | Nombre de reverse proxys de confiance (pour les limites de débit) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | E-mails réels. Sans SMTP : compte de test **Ethereal** (URL de prévisualisation dans la console) |

---

## 2. Endpoints

Préfixe `/api`. Les routes protégées exigent `Authorization: Bearer <token>`.

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | État du service |
| `POST` | `/inscription` | — | Création de compte (e-mail normalisé, mot de passe 8–128 car.) |
| `POST` | `/connexion` | — | Connexion (message d'erreur identique si le compte n'existe pas) |
| `POST` | `/oauth` | — | **Désactivé (501)** tant qu'un vrai flux OAuth 2.0 n'existe pas |
| `POST` | `/logout` | — | Révoque le jeton courant |
| `GET` | `/me` | ✔ | Profil de l'utilisateur connecté |
| `POST` | `/send-reset-code` | — | Code à 6 chiffres par e-mail (réponse identique que le compte existe ou non) |
| `POST` | `/verify-reset-code` | — | Valide le code (5 essais max, usage unique), change le mot de passe, révoque les sessions |
| `GET` | `/dashboard/summary` | ✔ | Indicateurs globaux |
| `GET` | `/dashboard/latency?range=1h\|24h\|7d` | ✔ | Courbe de latence réelle, moyennée par tranche de temps |
| `GET` | `/dashboard/events` | ✔ | Journal d'événements (60 max par utilisateur) |
| `GET` | `/dashboard/export.csv` | ✔ | Export CSV (protégé contre l'injection de formules) |
| `GET` `POST` | `/sites` | ✔ | Liste (`?status=`, `?q=`) / ajout (50 sites max, URL validée) |
| `GET` `PATCH` `DELETE` | `/sites/:id` | ✔ | Détail / `name`, `isEnabled`, `checkIntervalSeconds` / suppression |
| `POST` | `/sites/:id/checks/run` | ✔ | Contrôle manuel immédiat |
| `GET` | `/sites/:id/checks` | ✔ | 200 derniers contrôles |
| `GET` | `/sites/:id/latency?range=` | ✔ | Courbe de latence du site |
| `GET` | `/incidents`, `/incidents/stats`, `/incidents/:id` | ✔ | Incidents, MTTR, disponibilité 24 h réelle |
| `GET` `POST` | `/diagnostics/sites/:id/latest` · `/run` | ✔ | Diagnostic DNS / HTTP / TLS |

> `GET /api/clients` (liste publique des comptes) et l'ancien `/api/oauth` (connexion sans mot de passe) ont été supprimés : c'étaient des failles.

---

## 3. Architecture

```text
backend/
├── app/                  # Squelette FastAPI — NON utilisé (migration future, voir §6)
├── test/api.test.js      # Tests d'intégration (npm test)
├── server.js             # Serveur Express (sécurité + supervision)
├── .env.example          # Modèle de configuration
├── donnees.example.json  # Structure vide du fichier de données
├── clients.json          # (généré, ignoré par Git) comptes
├── donnees.json          # (généré, ignoré par Git) sites, contrôles, incidents, agrégats
└── sessions.json         # (généré, ignoré par Git) sessions (jetons hachés)
```

**Persistance.** Les données vivent en mémoire (cache) et sont écrites atomiquement (`.tmp` puis `rename`). Le serveur ne relit jamais le disque en cours d'exécution : il n'y a donc plus de « lecture → attente réseau → écriture » qui écrasait les changements faits entre-temps (ajout, suppression, pause pendant une sonde). Les écritures de `donnees.json` sont regroupées (300 ms) et vidées à l'arrêt du serveur. Un fichier JSON corrompu est mis de côté (`.corrompu-<date>`) au lieu d'être écrasé.

**Statistiques.** En plus des 200 derniers contrôles bruts par site, des agrégats **horaires conservés 30 jours** alimentent la disponibilité sur 30 jours et les courbes 24 h / 7 j (1 h utilise les contrôles bruts).

---

## 4. Sécurité

- **Mots de passe** : scrypt asynchrone (`scrypt2$sel$hash`), comparaison à temps constant, migration automatique des anciens hachages (SHA-256, `scrypt$`) à la connexion suivante.
- **Sessions** : jetons aléatoires de 256 bits, stockés **hachés** dans `sessions.json` (survivent au redémarrage), durée 24 h, révoquées à la déconnexion et après une réinitialisation de mot de passe.
- **Anti-énumération** : même réponse pour compte inconnu / mauvais mot de passe, et pour la demande de code de réinitialisation.
- **Anti-SSRF** : seules les URL `http(s)` sans identifiants sont acceptées ; l'adresse résolue ne doit pas être locale/privée (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7, …) ; les redirections sont suivies manuellement (5 max) et **chaque saut est revalidé**. Limite connue : un attaquant contrôlant un DNS pourrait tenter un *DNS rebinding* entre la validation et la requête.
- **Validation** : intervalle entier 10–86 400 s, nom 1–80 car., `isEnabled` booléen ; le **statut du site est décidé par le serveur**, jamais par le client.
- **Durcissement HTTP** : `helmet`, CORS restreint, corps JSON limité à 50 ko, limitation de débit (connexion/inscription, réinitialisation, contrôles manuels).

---

## 5. Supervision

- Sondes parallèles par lots de 20, `HEAD` avec repli `GET` (405/501), délai 6 s, mesure `performance.now()`.
- DNS chronométré, certificat TLS vérifié sur le port réel de l'URL.
- **3 échecs consécutifs** (ou 1 échec en contrôle manuel) → incident critique ; clôture automatique avec durée (MTTR) à la reprise.
- Un site en pause n'est pas sondé et son statut reste `paused`, même après un contrôle manuel.

---

## 6. Limitations connues

- Stockage JSON : adapté à un projet étudiant / démo, pas à une forte charge. Étape suivante : SQLite ou PostgreSQL (SQLAlchemy/Alembic avec FastAPI, ou `better-sqlite3` en restant sur Express). Choisissez **un seul** backend : le squelette FastAPI de `app/` n'est pas branché.
- Le jeton est conservé par le frontend dans `localStorage` ; un cookie `httpOnly` + protection CSRF serait plus robuste.
- Une seule sonde (« Tunis · Auto ») : pas encore de sondes multi-régions ni d'alertes e-mail automatiques.
