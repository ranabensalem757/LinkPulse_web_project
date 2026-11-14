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

`npm start` redirige les requêtes `/api` vers `http://127.0.0.1:3000` via le fichier `proxy.conf.json`. Démarrez l'API d'authentification Express avec `cd backend && npm start` pour la connexion et l'inscription. Le mode démonstration hors ligne public ne nécessite pas le backend.

```powershell
npm run build        # compilation de production (environment.prod.ts)
npx ng test --watch=false   # tests unitaires (Vitest, exécution unique)
```

La connexion et l'inscription appellent le véritable backend Express (`POST /api/connexion`, `POST /api/inscription`). L'utilisateur retourné est persisté dans le `localStorage` sous la clé `lp_user`. Les mots de passe sont stockés sous forme de hachages scrypt salés ; les anciens hachages SHA-256 continuent de fonctionner et sont automatiquement mis à niveau après une connexion réussie.

---

## 2. Routes

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/login` | Connexion / Inscription | — | E-mail + mot de passe, afficher/masquer, validation, état de chargement, message d'erreur API |
| `/` | Page d'accueil publique | — | Accueil marketing |
| `/demo` | Démonstration hors ligne | — | Redirige vers `/demo/dashboard` ; données d'exemple statiques, sans authentification ni API |
| `/demo/dashboard` | Tableau de bord de démo | — | Statistiques statiques, graphique de latence et journal d'événements |
| `/demo/sites` | Sites surveillés de démo | — | Sites statiques, filtres locaux ; modifications désactivées |
| `/demo/sites/:id` | Détails de site de démo | — | Contrôles statiques et historique de latence ; vérifications en direct désactivées |
| `/demo/incidents` | Incidents de démo | — | Incidents et preuves statiques |
| `/dashboard` | Tableau de bord | `authGuard` | Statistiques, graphique de latence, état des services, journal d'événements |
| `/sites` | Sites surveillés | `authGuard` | Liste, filtres, recherche, ajout, pause, suppression |
| `/sites/:id` | Détails du site | `authGuard` | Paramètre de route, métriques, graphique de latence, contrôles, incidents associés |
| `/incidents` | Incidents | `authGuard` | Statistiques, sévérité/statut, filtres, recherche, preuves, rapport PDF |
| `/diagnostic` | Diagnostic | `authGuard` | Diagnostic immédiat DNS / HTTP / TLS |
| `**` | Repli sur l'accueil public | — | Les chemins inconnus conservent leur URL et utilisent le titre d'onglet par défaut |

La navigation utilise `routerLink` / `routerLinkActive` dans la barre latérale (*sidebar*), la barre supérieure (*topbar*) et l'en-tête public. L'actualisation d'un lien profond fonctionne car le serveur de développement et l'hôte de production redirigent vers `index.html` (réécriture standard SPA).

`withComponentInputBinding()` associe `/sites/:id` à l'entrée `id` de `SiteDetailsComponent` ; le composant se recharge via un `effect` lorsque l'entrée change.

---

## 3. Architecture

```text
src/
  app/
    app.config.ts              # routeur, hydratation, provideHttpClient(withFetch())
    app.routes.ts              # routes paresseuses + authGuard
    core/
      demo/demo-mode.ts        # marqueur de mode démo délimité aux routes
      guards/auth.guard.ts     # redirige vers /login?returnUrl=…
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
        auth.service.ts        # connexion/inscription réelles, session localStorage
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
- Signaux (`signal`, `computed`, `effect`) pour la gestion de l'état ; aucune mutation directe de signal.
- Interfaces fortement typées pour chaque charge utile d'API.
- Utilisation de `inject()` à la place de l'injection par constructeur.
- Flux de contrôle natif (`@if`, `@for`, `@switch`) ; pas de `ngClass`/`ngStyle`.
- États de chargement / vide / erreur sur chaque page affichant des données.
- Aucune manipulation directe du DOM, à l'exception des utilitaires de téléchargement CSV/PDF.
- Les services en direct utilisent l'API. Les jeux de données de démonstration sont isolés dans `app/demo` et fournis uniquement aux routes `/demo`.

---

## 4. Fonctionnalités

### Connexion (`/login`)
E-mail/mot de passe avec option afficher/masquer, validation par Reactive Forms, indicateur de chargement, message d'erreur API, onglet d'inscription. En cas de succès, l'utilisateur est redirigé vers `/dashboard` (ou selon le paramètre de requête `returnUrl`).

### Tableau de bord (`/dashboard`)
- Quatre cartes de métriques (disponibilité, temps de réponse moyen, sites surveillés, incidents ouverts).
- Bannière d'incident actif lorsque le résumé en signale un.
- Graphique de latence alimenté par `GET /api/dashboard/latency?range=1h|24h|7d`, ligne de seuil.
- Liste de l'état des services avec lien vers le détail de chaque site.
- Journal des événements récents avec export CSV.
- Chargement en parallèle de `summary`, `latency`, `events` et `sites` ; tout échec affiche l'état d'erreur.

### Sites surveillés (`/sites`)
- Tableau avec URL, statut, temps de réponse, disponibilité sur 30 jours et dernier contrôle.
- Onglets de statut côté client et recherche textuelle (nom/URL).
- Fenêtre modale « Ajouter un site » avec validation par Reactive Forms → `POST /api/sites`.
- Mettre en pause/reprendre → `PATCH /api/sites/:id` ; supprimer → `DELETE /api/sites/:id`.
- Chaque ligne comporte un lien vers `/sites/:id`.

### Détails du site (`/sites/:id`)
- Piloté par paramètre de route ; se recharge dès que l'identifiant change.
- Disponibilité, temps de réponse moyen, expiration TLS et dernière vérification HTTP.
- Graphique de latence sur 24 heures avec seuil d'alerte.
- Tableau de l'historique des vérifications récentes (code HTTP, latence, sonde, résultat).
- Tableau des incidents associés avec lien vers le registre.
- « Lancer un contrôle immédiat » → `POST /api/sites/:id/checks/run`.

### Incidents (`/incidents`)
- Cartes de statistiques : total / en cours / résolus, MTTR, disponibilité sur 24 heures.
- Onglets de statut (tous / en cours / résolus) et recherche textuelle.
- Registre avec indicateurs de sévérité et statut.
- Fiche de preuves : code HTTP, durée d'indisponibilité, sonde, impact, chronologie horodatée des preuves.
- Bascule pour afficher la trace brute, rapport PDF généré côté client.

### Diagnostic (`/diagnostic`)
- Sélecteur de site, résultats DNS / HTTP / TLS / sonde, résumé des anomalies, liens vers les incidents et les détails du site. `GET /api/diagnostics/sites/:id/latest` et `POST /api/diagnostics/sites/:id/run`.

### Démonstration hors ligne (`/demo`)
- Le lien « Voir la démo » de la page d'accueil ouvre `/demo/dashboard` sans nécessiter de connexion.
- Le tableau de bord, les sites, les détails et les incidents réutilisent les pages existantes avec des fournisseurs statiques limités à la route. Les noms d'hôtes fictifs utilisent le domaine réservé `.example`.
- Une bannière permanente `DEMO` identifie clairement les données simulées. Les routes de démo n'effectuent aucun appel d'API, n'utilisent ni `AuthService` ni `localStorage`, et n'altèrent aucun enregistrement d'utilisateur réel.
- La création, l'édition, la suppression de sites, ainsi que les vérifications et diagnostics réels sont désactivés avec un message explicatif. Les graphiques, filtres, preuves d'incidents et actions de téléchargement de rapports/exports locaux restent disponibles. « Quitter la démo » redirige vers `/`.

### Composants partagés
`LoadingStateComponent`, `EmptyStateComponent`, `ErrorStateComponent`.

---

## 5. Services, modèles et points de terminaison

### Services
| Service | Responsabilité |
|---|---|
| `DashboardService` | résumé, série de latence, événements, export CSV |
| `SitesService` | liste/lecture/ajout/mise à jour/suppression de sites, pause, vérifications, latence |
| `IncidentsService` | statistiques, liste, détail/preuves |
| `DiagnosticsService` | dernier diagnostic et diagnostic à la demande |
| `AuthService` | connexion/inscription/déconnexion réelles, session localStorage |
| `Demo*Service` | tableau de bord, sites et incidents statiques ; fournis uniquement sous `/demo` |

### Points de terminaison API utilisés par l'interface utilisateur

Tous les chemins sont préfixés par `environment.apiBaseUrl` (`/api`). Les charges utiles complètes et les modèles sont décrits dans `../../API_CONTRACT.md`.

| Méthode | Chemin | Utilisation dans l'interface |
|---|---|---|
| POST | `/connexion` | Connexion |
| POST | `/inscription` | Inscription |
| GET | `/dashboard/summary` | Métriques du tableau de bord |
| GET | `/dashboard/latency?range=` | Graphique du tableau de bord |
| GET | `/dashboard/events` | Journal du tableau de bord |
| GET | `/dashboard/export.csv` | Export CSV |
| GET | `/sites` | Liste des sites |
| POST | `/sites` | Ajouter un site |
| GET | `/sites/:id` | Détails d'un site |
| PATCH | `/sites/:id` | Pause / reprise |
| DELETE | `/sites/:id` | Supprimer un site |
| POST | `/sites/:id/checks/run` | Contrôle immédiat |
| GET | `/sites/:id/checks` | Historique des contrôles |
| GET | `/sites/:id/latency?range=` | Graphique de latence du site |
| GET | `/incidents` | Registre des incidents |
| GET | `/incidents/stats` | Métriques des incidents |
| GET | `/incidents/:id` | Preuves de l'incident |
| GET | `/diagnostics/sites/:id/latest` | Dernier diagnostic |
| POST | `/diagnostics/sites/:id/run` | Lancer un diagnostic |

### État du backend

Implémenté actuellement (Express, `backend/server.js`, port 3000) :

```http
GET  /api/health
GET  /api/clients            (sans les hachages de mots de passe)
POST /api/inscription
POST /api/connexion
```

Les points de terminaison de supervision ci-dessus sont **en attente**. Il n'y a pas d'intercepteur factice : tant que le backend ne les implémente pas, ces pages affichent les états vides ou d'erreur.

Le squelette FastAPI (`backend/app/main.py`) expose uniquement `GET /health` et ne constitue pas le backend d'authentification.

### Changement d'emplacement de l'API

- Développement : `proxy.conf.json` redirige `/api` vers `http://127.0.0.1:3000`.
- Production : servir la SPA et l'API depuis la même origine, ou définir `apiBaseUrl` dans `environment.prod.ts` vers l'origine de l'API et activer CORS.

Aucune modification de composant ou de service n'est requise lorsque le backend est déployé.

---

## 6. Système de design

Les jetons de conception se trouvent dans `src/styles.scss` :

```scss
--clr-bg: #051424;        --clr-surface: #0d1c2d;
--clr-input: #010f1f;     --clr-action: #0267b8;
--clr-accent: #adc6ff;    --clr-online: #4edea3;
--clr-offline: #ffb4ab;   --clr-text: #d9e9ff;
--font-sans: 'Manrope';   --font-mono: 'JetBrains Mono';
```

Manrope et JetBrains Mono sont chargées depuis Google Fonts dans `src/index.html`. Les fichiers SCSS des composants utilisent ces variables. Les mises en page intègrent des points de rupture à 480/700/800/900/980/1100 px ; les tableaux défilent à l'intérieur de leurs cartes pour éviter tout débordement de page.

Accessibilité : lien d'évitement (*skip link*), points de repère structurants (*landmarks*), `aria-label`/`aria-pressed`/`aria-expanded`, `routerLinkActive`, anneau de focus visible, rôles de statut pour les messages de chargement et d'erreur.

---

## 7. Vérifications effectuées

| Vérification | Commande | Résultat |
|---|---|---|
| Compilation de production | `npm run build` | Succès, 0 erreur / 0 avertissement |
| Tests unitaires | `npx ng test --watch=false` | Succès, 12 fichiers / 58 tests |
| Démonstration hors ligne | Navigateur avec backend arrêté | Les pages de démo se chargent et s'actualisent ; aucune requête `/api` |
| Isolation de la démo | Tests d'intégration Angular | Aucune session d'authentification, requête d'API ou mutation de démo |
| Audit visuel au pixel près | — | Non réalisable : images prototypes non prises en charge par le modèle |

Vérifications manuelles toujours recommandées dans un navigateur : navigation au clavier, menu mobile à ≤ 980 px, flux d'ajout/pause/suppression de sites, bascule des plages temporelles, téléchargements PDF/CSV — dès que le backend est en place.

---

## 8. Limitations connues

- Les points de terminaison d'authentification sont implémentés ; les points de terminaison de supervision ne le sont pas encore, de sorte que les données en direct du tableau de bord, des sites et des incidents ne sont pas encore disponibles.
- Aucun intercepteur de requête : le backend renvoie uniquement l'objet utilisateur et `AuthService` le persiste dans `localStorage`. Ajouter un intercepteur `Authorization` si une authentification par jeton est requise ultérieurement.
- Les rapports PDF sont générés côté client.
- La comparaison visuelle avec les six images prototypes reste en suspens car les images ne pouvaient pas être lues ; les jetons et la mise en page ont été déduits de la spécification écrite.
- Aucun script `lint` ; `npm run build` et `npx ng test --watch=false` constituent les étapes de validation.
