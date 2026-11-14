# LinkPulse — Plateforme de Supervision & Observabilité Web

Plateforme full-stack de surveillance continue de disponibilité, de latence et de santé réseau (DNS, HTTP, TLS) développée avec **Angular 22** et **Node.js / Express** (avec architecture cible préparée pour **FastAPI**).

---

## 1. Prochains objectifs & axes d'amélioration (Semaines à venir)

* **Filtrage temporel réel des graphiques (`1H`, `24H`, `7J`)** : Filtrer les mesures en base selon leur horodatage réel (`checkedAt`) plutôt que par nombre fixe de points, et calculer une moyenne agrégée par tranche horaire sur la courbe globale du tableau de bord.
* **Migration vers base de données relationnelle & FastAPI** : Remplacer le stockage local JSON (`donnees.json` et `clients.json`) par **SQLite / SQL Server** avec **SQLAlchemy** et **Alembic**, et finaliser la bascule vers le moteur asynchrone **FastAPI** (`backend/app/main.py`).
* **Isolation multi-utilisateurs & authentification JWT** : Cloisonner les sites surveillés, historiques et incidents par utilisateur connecté via des jetons **JWT** et intégrer les fournisseurs **OAuth 2.0** complets (Google / GitHub).
* **Sondes multi-régions & alertes automatiques** : Déployer plusieurs points de contrôle géographiques (Tunisie, Europe, Amérique du Nord) et déclencher l'envoi automatique d'alertes par e-mail lors de l'ouverture ou de la résolution d'un incident critique.

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
* **Persistance atomique (`donnees.json`)** : Écriture sécurisée via fichier temporaire (`.tmp`) et renommage atomique pour éviter toute corruption de données.

### Authentification & sécurité (`backend/server.js`)
* **Inscription & connexion (`/api/inscription`, `/api/connexion`)** : Validation des comptes et hachage des mots de passe en **SHA-256** dans `clients.json`.
* **Connexion SSO rapide (`/api/oauth`)** : Création ou connexion immédiate via e-mail pour les boutons Google / GitHub.
* **Réinitialisation par code e-mail (`/api/send-reset-code`, `/api/verify-reset-code`)** : Génération d'un code à 6 chiffres valable 10 minutes envoyé via **Nodemailer** (compte SMTP de test Ethereal intégré).

### Console web Angular (`frontend/linkpulse-ui/`)
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
│   ├── app/                  # Squelette FastAPI prévu pour la migration Python
│   ├── clients.json          # Persistance locale des comptes utilisateurs
│   ├── donnees.json          # Persistance atomique des sites, mesures, incidents et diagnostics
│   ├── package.json          # Dépendances Node.js (express, cors, nodemailer)
│   ├── requirements.txt      # Dépendances Python préparées pour la suite (FastAPI, SQLAlchemy...)
│   └── server.js             # Serveur Express unifié (Authentification + Supervision temps réel)
├── frontend/
│   └── linkpulse-ui/         # Application Angular 22 (Signals, Standalone Components, Proxy API)
└── README.md
```

---

## 4. Installation et lancement en local

### Prérequis
* **Node.js** 20+ et **npm**
* **Angular CLI** (`npm install -g @angular/cli`)

### Étape 1 : Démarrer le Backend (`port 3000`)
```powershell
cd backend
npm install
node server.js
```

### Étape 2 : Démarrer le Frontend (`port 4200`)
Dans un second terminal :
```powershell
cd frontend/linkpulse-ui
npm install
npm start
```
L'interface est accessible sur **`http://localhost:4200`** (les requêtes `/api` sont automatiquement redirigées vers `http://127.0.0.1:3000` via `proxy.conf.json`).

---

## 5. Routes API principales

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/inscription` | Création d'un compte utilisateur |
| `POST` | `/api/connexion` | Authentification par e-mail et mot de passe |
| `POST` | `/api/send-reset-code` | Envoi d'un code de réinitialisation à 6 chiffres |
| `POST` | `/api/verify-reset-code` | Validation du code et mise à jour du mot de passe |
| `GET` | `/api/dashboard/summary` | Métriques globales du tableau de bord |
| `GET` | `/api/dashboard/latency` | Série de mesures de latence (`?range=1h\|24h\|7d`) |
| `GET` | `/api/dashboard/events` | Journal des événements récents |
| `GET` | `/api/dashboard/export.csv` | Export CSV du journal d'événements |
| `GET` / `POST` | `/api/sites` | Liste des sites ou ajout d'un nouveau site avec sonde initiale |
| `PATCH` / `DELETE` | `/api/sites/:id` | Mise en pause/reprise ou suppression d'un site |
| `POST` | `/api/sites/:id/checks/run` | Exécution d'un contrôle manuel immédiat |
| `GET` | `/api/incidents` | Liste des incidents (`stats` et `/:id` pour les preuves) |
| `POST` | `/api/diagnostics/sites/:id/run` | Lancement d'un diagnostic complet DNS / HTTP / TLS |