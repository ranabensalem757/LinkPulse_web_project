# LinkPulse — Plateforme de Supervision & Observabilité Web

Plateforme full-stack de surveillance continue de disponibilité, de latence et de santé réseau (DNS, HTTP, TLS) développée avec **Angular 22** et **Node.js / Express** (avec architecture cible préparée pour **FastAPI**).

---

## 1. Prochains objectifs & axes d'amélioration

* **Migration vers une base relationnelle** : remplacer le stockage JSON (`donnees.json`, `clients.json`) par **SQLite / PostgreSQL** (SQLAlchemy + Alembic avec FastAPI, ou `better-sqlite3` en restant sur Express). Un seul backend à terme : le dossier `backend/app/` (FastAPI) n'est pas encore branché.
* **Vrai OAuth 2.0 (Google / GitHub)** : la route `/api/oauth` est volontairement désactivée (501) tant qu'aucun flux sécurisé n'existe.
* **Sondes multi-régions & alertes automatiques** : plusieurs points de contrôle géographiques et alertes e-mail à l'ouverture / résolution d'un incident critique.
* **Jeton en cookie `httpOnly`** (+ protection CSRF) à la place de `localStorage`.

---

## 2. Fonctionnalités actuellement implémentées

### Moteur de supervision & diagnostic temps réel (`backend/server.js`)
* **Exécution parallèle des sondes (`Promise.allSettled`)** : Vérification simultanée de tous les sites actifs toutes les 15 secondes sans blocage séquentiel en cas de panne ou de délai dépassé.
* **Requêtes HTTP optimisées & chronométrage haute précision** : Envoi de requêtes légères `HEAD` (avec repli automatique sur `GET` si le serveur renvoie `405` ou `501`), en-tête `User-Agent: LinkPulse-Monitor/1.0`, délai d'expiration de 6 secondes et mesure via `perf_hooks` (`performance.now()`).
* **Diagnostic réseau complet (DNS / HTTP / TLS)** :
  * Résolution DNS réelle (`dns.promises.lookup`) avec mesure de latence en millisecondes.
  * Vérification directe du certificat SSL/TLS sur le port `443` (validité et date exacte d'expiration).
  * Détection et catégorisation des erreurs (`DNS_RESOLUTION_FAILED`, `TIMEOUT`, `HTTP_4xx/5xx`).
* **Gestion intelligente des incidents (Règle des 3 échecs consécutifs)** :
  * Ouverture automatique d'un incident critique après **3 échecs consécutifs** en surveillance automatique (ou immédiatement lors d'un contrôle manuel).
  * Clôture automatique dès la reprise du service avec calcul de la durée d'indisponibilité (`MTTR`) et journalisation des preuves horodatées.
* **Persistance atomique** : cache mémoire + écriture via fichier temporaire (`.tmp`) et renommage atomique ; aucune relecture du disque en cours d'exécution, donc aucune modification perdue pendant une sonde.
* **Statistiques réelles** : disponibilité sur 30 jours et courbes `1h` / `24h` / `7j` calculées à partir des horodatages (agrégats horaires conservés 30 jours).
* **Protection anti-SSRF** : les cibles locales / privées et les redirections vers celles-ci sont refusées (sauf `ALLOW_PRIVATE_TARGETS=true` en développement).

### Authentification & sécurité (`backend/server.js`)
* **Inscription & connexion** (`/api/inscription`, `/api/connexion`) : e-mail normalisé, mot de passe 8 caractères minimum, hachage **scrypt** asynchrone, messages d'erreur identiques pour éviter de deviner quels comptes existent.
* **Sessions persistantes** : jetons aléatoires stockés hachés dans `sessions.json` (valables 24 h, révoqués à la déconnexion et après un changement de mot de passe).
* **Réinitialisation par code e-mail** (`/api/send-reset-code`, `/api/verify-reset-code`) : code à 6 chiffres, 10 minutes, usage unique, 5 essais maximum, via **Nodemailer** (SMTP réel ou compte de test Ethereal).
* **Durcissement** : `helmet`, CORS restreint, limitation de débit, validation de toutes les entrées.

### Console web Angular (`frontend/linkpulse-ui/`)
* **Rafraîchissement automatique** : le tableau de bord, la liste des sites, le détail d'un site et les incidents se mettent à jour toutes les 15 s ; une session expirée (401) renvoie proprement vers `/login`.
* **Interface responsive & accessible** : navigation latérale en tiroir et menu public mobile sous 768 px, tableaux défilants horizontalement, lien d'évitement, focus visible, attributs ARIA et prise en compte de `prefers-reduced-motion`.
* **États visuels animés** : squelettes shimmer au chargement, transitions de disponibilité, effets au survol et révélation progressive des sections de la page d'accueil.
* **Tableau de bord (`/dashboard`)** : Indicateurs clés en temps réel (disponibilité globale, latence moyenne, sites surveillés, incidents actifs), courbe de latence, état des services et export CSV du journal d'événements.
* **Sites surveillés (`/sites` & `/sites/:id`)** : Ajout d'URL avec test immédiat, mise en pause/reprise, suppression, historique détaillé des contrôles et courbe de latence par site.
* **Registre d'incidents (`/incidents`)** : Filtrage par statut, calcul du MTTR, chronologie des preuves horodatées et génération de rapport PDF côté client.
* **Diagnostic à la demande (`/diagnostic`)** : Analyse instantanée DNS, HTTP et TLS pour n'importe quel site enregistré.
* **Mode démonstration autonome (`/demo`)** : Navigation complète avec données simulées isolées sans appel au backend.

---

## 3. Structure du projet

```text
LinkPulse_web_project/
├── backend/
│   ├── app/                  # Squelette FastAPI (futur, non utilisé)
│   ├── test/api.test.js      # Tests d'intégration (npm test)
│   ├── server.js             # Serveur Express (authentification + supervision)
│   ├── .env.example          # Modèle de configuration
│   └── donnees.example.json  # Structure vide du fichier de données
├── frontend/
│   └── linkpulse-ui/         # Application Angular 22 (Signals, composants standalone, proxy API)
└── README.md
```
`clients.json`, `donnees.json` et `sessions.json` sont générés au premier lancement et **ignorés par Git**.

---

## 4. Installation et lancement en local

### Prérequis
* **Node.js** 20+ et **npm**
* **Angular CLI** (`npm install -g @angular/cli`)

### Étape 1 : Backend (`port 3000`)
```powershell
cd backend
npm install
copy .env.example .env     # optionnel : adapter la configuration
npm start
```
> Pour surveiller un site local pendant le développement (ex. `http://localhost:8080`), mettez `ALLOW_PRIVATE_TARGETS=true` dans `.env`.

### Étape 2 : Frontend (`port 4200`)
Dans un second terminal :
```powershell
cd frontend/linkpulse-ui
npm install
npm start
```
L'interface est accessible sur **`http://localhost:4200`** (`/api` est redirigé vers `http://127.0.0.1:3000` via `proxy.conf.json`).

### Tests
```powershell
cd backend && npm test                      # 16 tests d'intégration de l'API
cd frontend/linkpulse-ui && npm test        # tests unitaires Angular (Vitest)
```

---

## 5. Routes API principales

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/inscription` | Création d'un compte utilisateur |
| `POST` | `/api/connexion` | Authentification par e-mail et mot de passe |
| `POST` | `/api/send-reset-code` | Envoi d'un code de réinitialisation à 6 chiffres (réponse identique si le compte n'existe pas) |
| `POST` | `/api/verify-reset-code` | Validation du code et mise à jour du mot de passe |
| `GET` | `/api/dashboard/summary` | Métriques globales du tableau de bord |
| `GET` | `/api/dashboard/latency` | Série de mesures de latence (`?range=1h\|24h\|7d`) |
| `GET` | `/api/dashboard/events` | Journal des événements récents |
| `GET` | `/api/dashboard/export.csv` | Export CSV du journal d'événements |
| `GET` / `POST` | `/api/sites` | Liste des sites ou ajout d'un site (URL validée, 50 max) avec sonde initiale |
| `PATCH` / `DELETE` | `/api/sites/:id` | Pause/reprise (`isEnabled`), renommage, intervalle, ou suppression d'un site |
| `POST` | `/api/sites/:id/checks/run` | Exécution d'un contrôle manuel immédiat |
| `GET` | `/api/incidents` | Liste des incidents (`stats` et `/:id` pour les preuves) |
| `POST` | `/api/diagnostics/sites/:id/run` | Lancement d'un diagnostic complet DNS / HTTP / TLS |

Pour le détail complet de l'API et de la sécurité, voir [`backend/README.md`](backend/README.md).
