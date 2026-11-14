# LinkPulse — Frontend Angular

Console de supervision professionnelle et réactive pour **LinkPulse**, développée avec **Angular 22** (composants autonomes *standalone*, signaux, routes chargées paresseusement *lazy loading*, formulaires réactifs *Reactive Forms*) et conforme aux spécifications de conception de l'**Objectif 2**.

---

## 1. Démarrage rapide

**Prérequis :** Node.js 22+ et npm.

```powershell
cd frontend/linkpulse-ui
npm install
npm start            # serveur de développement sur http://localhost:4200
```

`npm start` redirige automatiquement les requêtes `/api` vers le backend Express sur `http://127.0.0.1:3000` via le fichier `proxy.conf.json`. Démarrez le backend avec `cd backend && npm start`. Le mode démonstration hors ligne public ne nécessite pas le backend.

```powershell
npm run build        # compilation de production (environment.prod.ts)
npx ng test --watch=false   # tests unitaires (Vitest, exécution unique)
```

La connexion, l'inscription, la réinitialisation de mot de passe et l'authentification SSO appellent le véritable backend Express (`/api/connexion`, `/api/inscription`, `/api/oauth`, etc.). Les informations de session (`lp_user`) ainsi que le jeton d'authentification Bearer (`lp_token`) sont persistés dans le `localStorage`. Les mots de passe sont hachés de manière sécurisée en `scrypt` salé (`scrypt2`), les anciens hachages SHA-256 sont pris en charge et mis à niveau automatiquement après connexion.

---

## 2. Routes

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/login` | Connexion / Inscription | — | E-mail + mot de passe, afficher/masquer, validation, état de chargement, message d'erreur API, réinitialisation par code e-mail (mode récupération), connexion SSO (OAuth Google / GitHub), redirection intelligente vers `/dashboard` ou `returnUrl` |
| `/connexion` | Alias de connexion | — | Redirige vers `/login` |
| `/accueil` | Page d'accueil publique | — | Accueil marketing |
| `/` | Page d'accueil publique | — | Accueil marketing (`pathMatch: 'full'`) |
| `/demo` | Démonstration hors ligne | — | Redirige vers `/demo/dashboard` ; données d'exemple statiques, sans authentification ni API |
| `/demo/dashboard` | Tableau de bord de démo | — | Statistiques statiques, graphique de latence et journal d'événements |
| `/demo/sites` | Sites surveillés de démo | — | Sites statiques, filtres locaux ; modifications désactivées |
| `/demo/sites/:id` | Détails de site de démo | — | Contrôles statiques et historique de latence ; vérifications en direct désactivées |
| `/demo/incidents` | Incidents de démo | — | Incidents et preuves statiques |
| `/dashboard` | Tableau de bord | `authGuard` | Statistiques, graphique de latence, état des services, journal d'événements (données en direct, isolées par utilisateur) |
| `/sites` | Sites surveillés | `authGuard` | Liste, filtres, recherche, ajout, pause, suppression (données en direct, isolées par utilisateur) |
| `/sites/:id` | Détails du site | `authGuard` | Paramètre de route, métriques, graphique de latence, contrôles, incidents associés (données en direct, isolées par utilisateur) |
| `/incidents` | Incidents | `authGuard` | Statistiques, sévérité/statut, filtres, recherche, preuves, rapport PDF (données en direct, isolées par utilisateur) |
| `/diagnostic` | Diagnostic | `authGuard` | Diagnostic immédiat DNS / HTTP / TLS (données en direct, isolées par utilisateur) |
| `**` | Repli sur l'accueil public | — | Les chemins inconnus conservent leur URL et utilisent le titre d'onglet par défaut |

La navigation utilise `routerLink` / `routerLinkActive` dans la barre latérale (*sidebar*), la barre supérieure (*topbar*) et l'en-tête public. L'actualisation d'un lien profond fonctionne car le serveur de développement et l'hôte de production redirigent vers `index.html` (réécriture standard SPA).

`withComponentInputBinding()` associe `/sites/:id` à l'entrée `id` de `SiteDetailsComponent` ; le composant se recharge via un `effect` lorsque l'entrée change.

---

## 3. Architecture

```text
src/
  app/
    app.config.ts              # routeur, hydratation, provideHttpClient(withFetch(), withInterceptors([authInterceptor]))
    app.routes.ts              # routes paresseuses + authGuard
    core/
      demo/demo-mode.ts        # marqueur de mode démo délimité aux routes
      guards/
        auth.guard.ts          # capture state.url et redirige vers /login?returnUrl=…
      interceptors/
        auth.interceptor.ts    # injecte automatiquement l'en-tête Authorization: Bearer <token>
      models/
        site.model.ts          # Site, CheckResult, LatencyPoint, LatencySeries, AddSitePayload
        user.model.ts          # User, CurrentUser, LoginRequest, RegisterRequest, AuthResponse
        dashboard.model.ts     # DashboardSummary, LatencySeries, RecentEvent, DiagnosticResult
        incident.model.ts      # Incident, IncidentDetail, evidence, stats
      services/
        dashboard.service.ts   # résumé, séries de latence, événements, export CSV
        sites.service.ts       # CRUD des sites, pause, exécution de sondes, historique
        incidents.service.ts   # statistiques, liste des incidents, détails et preuves
        diagnostics.service.ts # diagnostic DNS / TLS / HTTP immédiat
        auth.service.ts        # authentification, gestion du token Bearer, session localStorage
    layout/
      console-layout/          # barre latérale + barre supérieure + router-outlet (protégé)
      demo-layout/             # enveloppe distincte ; pas de barre supérieure avec auth
      public-layout/           # en-tête / pied de page publics
      sidebar/ topbar/
    demo/
      demo-services.ts         # fournisseurs statiques délimités à /demo
    pages/
      auth/ dashboard/ monitored-sites/ site-details/ incidents/ diagnostic/ home/
    shared/
      loading-state/ empty-state/ error-state/
  environments/
    environment.ts             # dev : apiBaseUrl '/api'
    environment.prod.ts        # prod : apiBaseUrl '/api'
  styles.scss                  # jetons de design, réinitialisations, utilitaires d'accessibilité (a11y)
```

**Conventions**

- Composants autonomes uniquement (*standalone*, aucun NgModule).
- Signaux (`signal`, `computed`, `effect`) pour la gestion réactive de l'état ; aucune mutation directe de signal.
- Intercepteur HTTP global (`authInterceptor`) pour attacher automatiquement le jeton Bearer sur toutes les requêtes `/api/`.
- Interfaces fortement typées pour chaque charge utile d'API (`user.model.ts`, `site.model.ts`, etc.).
- Utilisation de `inject()` à la place de l'injection par constructeur.
- Flux de contrôle natif (`@if`, `@for`, `@switch`) ; pas de `ngClass`/`ngStyle`.
- États de chargement / vide / erreur sur chaque page affichant des données.
- Aucune manipulation directe du DOM, à l'exception des utilitaires de téléchargement CSV/PDF.
- Les services en direct utilisent l'API via Angular `HttpClient`. Les jeux de données de démonstration sont isolés dans `app/demo` et fournis uniquement aux routes `/demo`.

---

## 4. Fonctionnalités

### Authentification & Connexion (`/login`)
- **Onglets Connexion & Inscription** : Formulaires réactifs (`ReactiveFormsModule`) avec validation stricte (format e-mail, longueur minimale de mot de passe, confirmation identique).
- **Afficher / Masquer le mot de passe** : Bascule interactive du type de champ mot de passe avec icône dédiée.
- **Récupération de mot de passe (Mode Récupération)** :
  - Saisie de l'adresse e-mail et demande de code à 6 chiffres via l'API (`POST /api/send-reset-code`).
  - Validation du code reçu par e-mail et définition sécurisée du nouveau mot de passe (`POST /api/verify-reset-code`).
  - Protection contre les abus : expiration à 10 minutes, code à usage unique, limite stricte de 5 tentatives et limitation de fréquence.
- **Connexion rapide SSO (OAuth)** : Prise en charge des boutons Google et GitHub pour une connexion/création de compte instantanée (`POST /api/oauth`).
- **Redirection intelligente après authentification** :
  - Préserve l'URL initialement demandée (`returnUrl` capturé par `authGuard` via `state.url`).
  - Redirige automatiquement vers `/dashboard` si l'utilisateur provient de la page d'accueil (`/` ou `/accueil`) ou d'une connexion directe.
  - Bloque les redirections ouvertes externes non sécurisées (commençant par `//`).
  - Si un utilisateur déjà connecté visite `/login`, il est immédiatement redirigé vers son tableau de bord (`ngOnInit`).
- **Déconnexion sécurisée** : Appel asynchrone à `POST /api/logout` pour révoquer le jeton côté serveur, nettoyage complet du `localStorage` (`lp_user`, `lp_token`) et redirection vers la page d'accueil.

### Tableau de bord (`/dashboard`) — Données réelles & isolées
- Quatre cartes de métriques en direct : disponibilité globale, temps de réponse moyen, sites surveillés actifs, incidents ouverts.
- Bannière d'incident actif dynamique lorsque le backend signale une panne en cours.
- Graphique de latence interactif alimenté par `GET /api/dashboard/latency?range=1h|24h|7d`, avec ligne de seuil d'alerte (1500 ms).
- Liste de l'état de santé de la flotte de services reliant directement aux détails de chaque site.
- Journal des événements récents avec bouton d'export CSV instantané (`GET /api/dashboard/export.csv`).
- Cloisonnement strict : chaque utilisateur connecté n'accède qu'à ses propres métriques et événements.

### Sites surveillés (`/sites`) — Données réelles & isolées
- Tableau réactif : URL, statut (en ligne, hors ligne, en pause, inconnu), temps de réponse HTTP en ms, disponibilité sur 30 jours et date du dernier contrôle.
- Filtrage rapide par onglets d'état (Tous, En ligne, Hors ligne, En pause) et recherche textuelle instantanée (nom/URL).
- Modal « Ajouter un site » avec validation d'URL et déclenchement d'une sonde immédiate côté backend (`POST /api/sites`).
- Actions directes par ligne : mise en pause / reprise de la surveillance (`PATCH /api/sites/:id`) et suppression définitive (`DELETE /api/sites/:id`).
- Lien direct depuis chaque ligne vers la page de détails du site.

### Détails du site (`/sites/:id`) — Données réelles & isolées
- Piloté par paramètre d'URL dynamique avec mise à jour réactive via `withComponentInputBinding()`.
- Cartes de performance : disponibilité 30j, temps de réponse moyen, statut et date d'expiration du certificat SSL/TLS, date de dernier contrôle.
- Graphique de latence sur 24 heures spécifique au site sélectionné.
- Tableau de l'historique des vérifications récentes (code HTTP, latence de sonde en ms, sonde d'origine, résultat).
- Tableau des incidents associés avec lien vers le registre d'incidents.
- Bouton d'action « Lancer un contrôle immédiat » exécutant une sonde réseau DNS/HTTP/TLS en direct (`POST /api/sites/:id/checks/run`).

### Registre d'incidents (`/incidents`) — Données réelles & isolées
- Cartes de statistiques globales : total d'incidents, incidents en cours, résolus, MTTR (temps moyen de résolution) et disponibilité sur 24 heures.
- Onglets de filtrage par état (Tous, En cours, Résolus) et recherche textuelle (nom de site, identifiant d'incident, code d'erreur).
- Registre détaillé avec puces de sévérité (critique, avertissement) et durée d'indisponibilité calculée.
- Volet de preuves horodatées (*evidence sheet*) : code HTTP relevé, sonde émettrice, chronologie des événements d'ouverture et de clôture.
- Générateur de rapport PDF côté client pour l'archivage ou la communication d'incident.

### Diagnostic réseau à la demande (`/diagnostic`)
- Sélecteur déroulant des sites surveillés de l'utilisateur.
- Diagnostic en direct : résolution DNS (avec mesure du temps de résolution en ms), validation du certificat TLS (validité et date d'expiration), code de retour et temps de réponse HTTP (méthode `HEAD` avec repli automatique sur `GET`).
- Résumé synthétique de l'anomalie détectée en langage clair sans jargon technique.
- Appels aux points de terminaison `GET /api/diagnostics/sites/:id/latest` et `POST /api/diagnostics/sites/:id/run`.

### Démonstration hors ligne (`/demo`)
- Le lien « Voir la démo » de la page d'accueil ouvre `/demo/dashboard` sans nécessiter de connexion.
- Le tableau de bord, les sites, les détails et les incidents réutilisent les composants existants avec des fournisseurs statiques limités à la route. Les noms d'hôtes fictifs utilisent le domaine réservé `.example`.
- Une bannière permanente `DEMO` identifie clairement les données simulées. Les routes de démo n'effectuent aucun appel d'API, n'utilisent ni `AuthService` ni `localStorage`, et n'altèrent aucun enregistrement d'utilisateur réel.
- Les actions de modification réelle sont désactivées avec un message explicatif. Les graphiques, filtres, preuves d'incidents et téléchargements locaux restent disponibles. « Quitter la démo » redirige vers `/`.

### Composants partagés
- `LoadingStateComponent` : Indicateur visuel pendant le chargement des données asynchrones.
- `EmptyStateComponent` : Message explicatif et bouton d'action contextuel lorsqu'aucune donnée n'est disponible.
- `ErrorStateComponent` : Affichage convivial des erreurs réseau avec option de nouvelle tentative (*retry*).

---

## 5. Services, modèles et points de terminaison

### Services
| Service | Responsabilité |
|---|---|
| `DashboardService` | Résumé des métriques, série temporelle de latence, journal des événements, export CSV |
| `SitesService` | Liste, détails, ajout, mise à jour, suppression, pause/reprise, sondes immédiates et historique |
| `IncidentsService` | Statistiques globales, registre des incidents, détails et preuves horodatées |
| `DiagnosticsService` | Récupération du dernier diagnostic et exécution de diagnostics complets à la demande |
| `AuthService` | Inscription, connexion, OAuth SSO, réinitialisation de mot de passe, déconnexion, gestion du jeton Bearer et session localStorage |
| `Demo*Service` | Données statiques de démonstration pour le tableau de bord, les sites et les incidents (fournis uniquement sous `/demo`) |

### Points de terminaison API connectés à l'interface

Toutes les requêtes sont préfixées par `environment.apiBaseUrl` (`/api`). Les routes protégées incluent automatiquement le jeton Bearer via `authInterceptor`.

| Méthode | Chemin | Authentification | Utilisation dans l'interface |
|---|---|---|---|
| `POST` | `/connexion` | Public | Authentification par e-mail et mot de passe |
| `POST` | `/inscription` | Public | Création d'un nouveau compte utilisateur |
| `POST` | `/oauth` | Public | Connexion / inscription rapide SSO (Google, GitHub) |
| `POST` | `/logout` | `Bearer token` | Révocation de la session active sur le serveur |
| `GET` | `/me` | `Bearer token` | Profil de l'utilisateur authentifié |
| `POST` | `/send-reset-code` | Public | Envoi du code de réinitialisation à 6 chiffres par e-mail |
| `POST` | `/verify-reset-code` | Public | Validation du code et mise à jour du mot de passe |
| `GET` | `/dashboard/summary` | `Bearer token` | Métriques globales du tableau de bord (cloisonnées) |
| `GET` | `/dashboard/latency?range=` | `Bearer token` | Graphique de latence agrégée (`1h`, `24h`, `7d`) |
| `GET` | `/dashboard/events` | `Bearer token` | Journal des événements récents |
| `GET` | `/dashboard/export.csv` | `Bearer token` | Téléchargement du journal au format CSV |
| `GET` | `/sites` | `Bearer token` | Liste des sites surveillés de l'utilisateur (`?status=`, `?q=`) |
| `POST` | `/sites` | `Bearer token` | Ajout d'un nouveau site avec sonde initiale automatique |
| `GET` | `/sites/:id` | `Bearer token` | Détails et configuration d'un site |
| `PATCH` | `/sites/:id` | `Bearer token` | Mise en pause / reprise ou modification d'un site |
| `DELETE` | `/sites/:id` | `Bearer token` | Suppression d'un site et nettoyage des données liées |
| `POST` | `/sites/:id/checks/run` | `Bearer token` | Déclenchement d'un contrôle manuel immédiat |
| `GET` | `/sites/:id/checks` | `Bearer token` | Historique des contrôles récents d'un site |
| `GET` | `/sites/:id/latency?range=` | `Bearer token` | Série de latence propre à un site spécifique |
| `GET` | `/incidents` | `Bearer token` | Registre des incidents de l'utilisateur (`?status=`, `?q=`) |
| `GET` | `/incidents/stats` | `Bearer token` | Métriques d'incidents (total, résolus, MTTR, disponibilité 24h) |
| `GET` | `/incidents/:id` | `Bearer token` | Détails complets et preuves d'un incident |
| `GET` | `/diagnostics/sites/:id/latest` | `Bearer token` | Dernier diagnostic réseau enregistré |
| `POST` | `/diagnostics/sites/:id/run` | `Bearer token` | Lancement d'un diagnostic complet immédiat |

### État du backend & Intégration

Le backend Node.js / Express (`backend/server.js`, port 3000) implémente l'ensemble de ces points de terminaison. Toutes les pages de la console affichent désormais des données réelles, actualisées en temps réel et strictement cloisonnées par compte utilisateur.

### Configuration de l'environnement API

- **Développement** : Le fichier `proxy.conf.json` redirige les appels `/api` du port `4200` vers `http://127.0.0.1:3000`.
- **Production** : Déployer le frontend et l'API sur la même origine, ou définir `apiBaseUrl` dans `src/environments/environment.prod.ts` vers l'URL absolue de l'API avec les en-têtes CORS activés.

---

## 6. Système de design

Les jetons de conception sont définis dans `src/styles.scss` :

```scss
--clr-bg: #051424;        --clr-surface: #0d1c2d;
--clr-input: #010f1f;     --clr-action: #0267b8;
--clr-accent: #adc6ff;    --clr-online: #4edea3;
--clr-offline: #ffb4ab;   --clr-text: #d9e9ff;
--font-sans: 'Manrope';   --font-mono: 'JetBrains Mono';
```

- Polices **Manrope** et **JetBrains Mono** importées via Google Fonts dans `src/index.html`.
- Mises en page responsives avec points de rupture à 480 / 700 / 800 / 900 / 980 / 1100 px ; tableaux avec défilement horizontal interne pour préserver la lisibilité mobile.
- Accessibilité : lien d'évitement (*skip link*), points de repère structurants (*landmarks*), gestion d'attributs ARIA (`aria-label`, `aria-pressed`, `aria-expanded`), `routerLinkActive`, anneau de focus contrasté, rôles de statut pour les bandeaux de chargement et d'erreur.

---

## 7. Vérifications effectuées

| Vérification | Commande | Résultat |
|---|---|---|
| Compilation de production | `npm run build` | **Succès (0 erreur / 0 avertissement)** |
| Tests unitaires d'authentification | `npx ng test --watch=false --include="**/auth.spec.ts"` | **Succès (19/19 tests réussis)** |
| Tests unitaires du guard | `npx ng test --watch=false --include="**/auth.guard.spec.ts"` | **Succès (3/3 tests réussis)** |
| Tests unitaires de routage | `npx ng test --watch=false --include="**/app.routes.spec.ts"` | **Succès (4/4 tests réussis)** |
| Tests unitaires de la barre supérieure | `npx ng test --watch=false --include="**/topbar.spec.ts"` | **Succès (2/2 tests réussis)** |
| Tests unitaires de la page d'accueil | `npx ng test --watch=false --include="**/home.spec.ts"` | **Succès (11/11 tests réussis)** |
| Tests d'intégration Angular | `npx ng test --watch=false --include="**/app.integration.spec.ts"` | **Succès (3/3 tests réussis)** |
| Démonstration hors ligne | Navigation dans le navigateur avec backend arrêté | **Succès** (données d'exemple chargées sans aucune requête `/api`) |
| Suite d'intégration backend | `node test-auth.js` (dans `/backend`) | **Succès (29/29 assertions réussies)** |

---

## 8. Limitations connues & Évolutions prévues

- **Génération des rapports PDF** : Les rapports d'incident au format PDF sont générés côté client dans le navigateur.
- **Persistance des sessions** : Les sessions serveur sont actuellement stockées en mémoire vive dans Express (invalidées en cas de redémarrage du backend). Une migration vers des jetons JWT auto-contenus ou un stockage Redis est planifiée pour la haute disponibilité.
- **Migration vers base relationnelle & FastAPI** : Le stockage local repose actuellement sur les fichiers JSON (`clients.json`, `donnees.json`). L'architecture cible prévoit la bascule vers PostgreSQL / SQLite avec FastAPI et SQLAlchemy.
- **Scripts de vérification** : `npm run build` et `npx ng test --watch=false` constituent les garde-fous de validation du code.
