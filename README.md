# LinkPulse — Console d'Observabilité & Supervision

> **⚠️ Note importante (README temporaire) :**  
> Ce document est **temporaire** et couvre uniquement la première étape du projet (**module d'authentification et gestion des comptes utilisateurs**). L'objectif final de **LinkPulse** dépasse largement l'authentification (supervision de clusters, collecte de métriques d'infrastructure en temps réel, tableaux de bord analytiques et alertes). Ce `README.md` sera mis à jour une fois l'ensemble du backend complet finalisé.

---

## 1. Fonctionnalités actuellement implémentées

### Backend (`Node.js` / `Express`)
* **Inscription (`/api/inscription`)** : Création de compte avec vérification d'unicité de l'adresse e-mail, hachage sécurisé des mots de passe en **SHA-256** (module natif `crypto`) et sauvegarde dans `clients.json`.
* **Connexion (`/api/connexion`)** : Vérification des identifiants et du mot de passe haché.
* **Connexion SSO simplifiée (`/api/oauth`)** : Connexion rapide via e-mail pour les boutons *GitHub* et *Google SSO* avec création automatique du profil s'il n'existe pas encore (sans configuration Google Cloud / GitHub OAuth externe pour le moment).
* **Récupération de mot de passe par code e-mail (`/api/send-reset-code` & `/api/verify-reset-code`)** :
  * Génération d'un **code aléatoire à 6 chiffres** valable **10 minutes**.
  * Envoi automatique par e-mail via **Nodemailer** et un compte de test **Ethereal** généré dynamiquement (aucun mot de passe d'application Gmail requis ; un lien d'aperçu de l'e-mail reçu s'affiche directement dans le terminal backend).
  * Vérification du code et mise à jour du mot de passe haché dans `clients.json`.
* **Consultation des utilisateurs (`/api/clients`)** : Route GET permettant de lister les comptes enregistrés.

### Frontend (`Angular`)
* **Interface d'authentification (`auth.ts`, `auth.html`, `auth.scss`)** :
  * Bascule dynamique entre **Se connecter** et **Créer un compte**.
  * Formulaire de récupération de mot de passe en deux étapes (*Oublié ?* $\rightarrow$ envoi du code à 6 chiffres $\rightarrow$ saisie du code et du nouveau mot de passe).
  * Affichage/masquage du mot de passe et gestion réactive des états (`signal`, `computed`, `ReactiveFormsModule`).
* **Service d'authentification (`auth.service.ts`)** : Communication avec l'API REST (`http://localhost:3000/api`) via `fetch` et persistance de la session utilisateur dans le `localStorage` (`lp_user`).

---

## 2. Prérequis et bibliothèques à installer

### Prérequis système
* **Node.js** (version 18 ou supérieure recommandée) et **npm**
* **Angular CLI** (`npm install -g @angular/cli`)

### Bibliothèques Backend (`backend/`)
* **`express`** : Framework web pour créer le serveur HTTP et les routes REST (`/api/...`).
* **`cors`** : Middleware permettant d'autoriser les requêtes entre le frontend Angular (`localhost:4200`) et le backend (`localhost:3000`).
* **`nodemailer`** : Envoi des e-mails de réinitialisation de mot de passe (avec compte SMTP de test Ethereal intégré).
* *Modules natifs Node.js utilisés (aucune installation requise)* : `fs` (lecture/écriture de `clients.json`) et `crypto` (hachage SHA-256).

### Bibliothèques Frontend (`frontend/linkpulse-ui/`)
Toutes les dépendances Angular sont listées dans `package.json` et s'installent automatiquement avec `npm install` :
* **`@angular/core`**, **`@angular/common`**, **`@angular/platform-browser`** : Cœur du framework Angular et gestion des Signals.
* **`@angular/forms`** : Formulaires réactifs (`FormBuilder`, `ReactiveFormsModule`, `Validators`).
* **`@angular/router`** : Navigation entre la page d'authentification (`/login`) et le tableau de bord (`/dashboard`).
* **`rxjs`**, **`tslib`**, **`zone.js`** : Dépendances d'exécution standard d'Angular.

---

## 3. Structure actuelle du projet

```text
LinkPulse_web_project/
├── backend/
│   ├── clients.json          # Base de données locale JSON des utilisateurs
│   ├── package.json          # Dépendances Node.js (express, cors, nodemailer)
│   └── server.js             # Serveur Express & routes API d'authentification
├── frontend/
│   └── linkpulse-ui/
│       └── src/app/
│           ├── core/services/
│           │   └── auth.service.ts   # Appels API et gestion de session
│           └── pages/auth/
│               ├── auth.html         # Template de connexion / inscription / reset
│               ├── auth.scss         # Styles du composant d'authentification
│               └── auth.ts           # Logique du composant Angular
└── README.md
```

---

## 4. Installation et lancement en local

### Étape 1 : Installer et démarrer le Backend
Ouvrir un premier terminal dans le dossier `backend` :

```powershell
cd backend
npm install express cors nodemailer
node server.js
```

Le serveur démarre sur **`http://localhost:3000`** et affiche `📧 Service d’envoi d’e-mails prêt.`.

### Étape 2 : Installer et démarrer le Frontend
Ouvrir un second terminal dans le dossier `frontend/linkpulse-ui` :

```powershell
cd frontend/linkpulse-ui
npm install
npm start -- -o
```

L'application s'ouvre automatiquement dans le navigateur sur **`http://localhost:4200`**.

---

## 5. Récapitulatif des routes API

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/inscription` | Crée un nouveau compte utilisateur dans `clients.json` |
| `POST` | `/api/connexion` | Authentifie un utilisateur via e-mail et mot de passe |
| `POST` | `/api/oauth` | Connexion ou création automatique de compte via SSO (e-mail) |
| `POST` | `/api/send-reset-code` | Génère et envoie un code de vérification à 6 chiffres par e-mail |
| `POST` | `/api/verify-reset-code` | Vérifie le code reçu et enregistre le nouveau mot de passe |
| `GET` | `/api/clients` | Retourne la liste des utilisateurs enregistrés |

---

## 6. Évolution prévue (Prochaines étapes)

Ce README sera complété au fur et à mesure de l'avancement du backend global :
* Gestion complète des clusters, serveurs et sondes de monitoring par utilisateur.
* Collecte et historisation des métriques système en temps réel (CPU, RAM, réseau, latence, disponibilité).
* Système d'alertes et de notifications sur dépassement de seuils.
* Migration éventuelle vers une base de données dédiée et authentification OAuth 2.0 complète.