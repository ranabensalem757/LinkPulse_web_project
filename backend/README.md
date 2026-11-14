# LinkPulse — Backend Node.js / Express

Moteur d'observabilité et de supervision haute performance et sécurisé pour **LinkPulse**, développé avec **Node.js** et **Express 5**. Le backend assure la surveillance réseau en temps réel (DNS / TLS / HTTP), la gestion automatisée du cycle de vie des incidents, une authentification cryptographiquement sûre avec migration automatique des anciens hachages, ainsi qu'un cloisonnement strict des données multi-utilisateurs.

---

## 1. Démarrage rapide

**Prérequis :** Node.js 20+ et npm.

### Démarrage du serveur
```powershell
cd backend
npm install
npm start            # démarre Express sur http://localhost:3000
```
*(Alternative : `node server.js`)*

Le serveur démarre l'API REST sur le port `3000` et lance immédiatement la boucle de sondes de surveillance en arrière-plan (exécutée toutes les 15 secondes).

### Exécution des tests du serveur
Lancer la suite complète de tests d'intégration (29 assertions automatisées) :
```powershell
node test-auth.js
```

### Configuration de l'envoi réel d'e-mails
Par défaut, le backend utilise **Ethereal** (compte SMTP de test généré automatiquement). Les e-mails de vérification sont capturés et une URL de prévisualisation est affichée dans la console.

Pour activer l'envoi réel vers de véritables boîtes de réception, définissez les variables d'environnement SMTP avant le lancement :

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "votre-email@gmail.com"
$env:SMTP_PASS = "votre-mot-de-passe-application"
$env:SMTP_SECURE = "false"
node server.js
```

---

## 2. Points de terminaison de l'API (Endpoints)

Tous les points de terminaison sont servis sous le préfixe `/api`. Les routes protégées nécessitent l'en-tête `Authorization: Bearer <token>` obtenu lors de la connexion, de l'inscription ou de l'authentification OAuth.

| Méthode | Endpoint | Authentification | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Vérification de l'état du service (`{ "status": "ok" }`) |
| `POST` | `/inscription` | Public | Inscription d'un compte (hachage scrypt2, renvoie un jeton Bearer) |
| `POST` | `/connexion` | Public | Connexion par mot de passe (migration transparente, renvoie un jeton Bearer) |
| `POST` | `/oauth` | Public | Connexion / inscription rapide SSO (Google, GitHub) |
| `POST` | `/logout` | `requireAuth` | Révoque le jeton de session actif sur le serveur |
| `GET` | `/me` | `requireAuth` | Récupère le profil de l'utilisateur authentifié |
| `POST` | `/send-reset-code` | Public | Génère et envoie par e-mail un code sécurisé à 6 chiffres (limité en fréquence) |
| `POST` | `/verify-reset-code` | Public | Valide le code, applique la limite de 5 essais et met à jour le mot de passe |
| `GET` | `/clients` | Public | Liste les utilisateurs inscrits sans les hachages de mots de passe (administration) |
| `GET` | `/dashboard/summary` | `requireAuth` | Métriques agrégées de l'utilisateur (disponibilité, latence moyenne, incidents) |
| `GET` | `/dashboard/latency` | `requireAuth` | Série temporelle de latence cloisonnée à l'utilisateur (`?range=1h\|24h\|7d`) |
| `GET` | `/dashboard/events` | `requireAuth` | Journal des événements récents des sites de l'utilisateur |
| `GET` | `/dashboard/export.csv` | `requireAuth` | Export CSV de l'historique des événements de l'utilisateur |
| `GET` | `/sites` | `requireAuth` | Liste des sites appartenant à l'utilisateur (`?status=`, `?q=`) |
| `POST` | `/sites` | `requireAuth` | Ajoute un nouveau site et exécute une sonde initiale immédiate |
| `GET` | `/sites/:id` | `requireAuth` | Récupère la configuration détaillée d'un site |
| `PATCH` | `/sites/:id` | `requireAuth` | Met à jour les paramètres d'un site ou active/met en pause la surveillance |
| `DELETE` | `/sites/:id` | `requireAuth` | Supprime un site et nettoie les contrôles et incidents associés |
| `POST` | `/sites/:id/checks/run` | `requireAuth` | Déclenche un contrôle manuel immédiat sur un site |
| `GET` | `/sites/:id/checks` | `requireAuth` | Récupère l'historique des contrôles exécutés (100 derniers) |
| `GET` | `/sites/:id/latency` | `requireAuth` | Récupère les points du graphique de latence d'un site spécifique |
| `GET` | `/incidents` | `requireAuth` | Liste des incidents de l'utilisateur (`?status=`, `?q=`) |
| `GET` | `/incidents/stats` | `requireAuth` | Calcule le MTTR et la disponibilité sur 24h spécifiques à l'utilisateur |
| `GET` | `/incidents/:id` | `requireAuth` | Récupère les détails d'un incident avec les preuves horodatées |
| `GET` | `/diagnostics/sites/:id/latest` | `requireAuth` | Récupère le dernier diagnostic ou en exécute un s'il est absent |
| `POST` | `/diagnostics/sites/:id/run` | `requireAuth` | Exécute à la demande un diagnostic complet DNS / TLS / HTTP |

---

## 3. Architecture & Persistance des données

```text
backend/
├── app/                  # Squelette FastAPI (préparé pour la migration Python)
├── clients.json          # Comptes utilisateurs et hachages des mots de passe persistants
├── clients.json.tmp      # Fichier temporaire pour écritures atomiques
├── donnees.json          # Sites, vérifications, incidents, événements et diagnostics persistants
├── donnees.json.tmp      # Fichier temporaire pour écritures atomiques
├── package.json          # Dépendances Node.js (express, cors, nodemailer)
├── server.js             # Serveur Express unifié (moteur + sécurité + supervision)
└── test-auth.js          # Suite de tests d'intégration de bout en bout automatisée
```

### Principes architecturaux

1. **Persistance atomique des fichiers** : Toutes les écritures sur disque (`clients.json` et `donnees.json`) écrivent d'abord dans un fichier `.tmp` avant d'effectuer un renommage atomique via `fs.renameSync()`. Cela garantit une absence totale de corruption de données en cas de coupure de courant ou d'opérations concurrentes.
2. **Cloisonnement strict par utilisateur** : Aucune entité (site, vérification, incident, événement, diagnostic) n'est exposée au-delà des limites de l'utilisateur. Chaque requête dérive son identité depuis `req.session.userId` (issu du jeton Bearer vérifié), jamais à partir de paramètres transmis par le client.
3. **Zéro dépendance externe superflue** : Conçu à partir des modules natifs standards de Node.js (`crypto`, `dns.promises`, `tls`, `perf_hooks`, `fs`) associés aux dépendances légères `express`, `cors` et `nodemailer`.

---

## 4. Fonctionnalités

### Authentification & Sessions
- **Moteur de hachage multi-format** : Utilise l'algorithme `scrypt` avec un sel de 16 octets cryptographiquement aléatoire (`scrypt2$<sel>$<hachage>`).
- **Migration transparente des hachages** : Met à niveau de façon automatique et transparente les anciens hachages `SHA-256` ou les anciens formats `scrypt$` vers le standard moderne `scrypt2$` lors de la prochaine connexion réussie de l'utilisateur.
- **Comparaison à temps constant** : Toutes les vérifications d'identifiants utilisent `crypto.timingSafeEqual()` pour prévenir les attaques temporelles par canal auxiliaire (*timing attacks*).
- **Gestionnaire de sessions côté serveur** : Émet des jetons Bearer de 32 octets aléatoires conservés en mémoire avec une durée de validité de 24 heures. La révocation est immédiate lors de l'appel à `POST /api/logout`.

### Récupération de mot de passe
- **Codes cryptographiquement sécurisés** : Génération de codes aléatoires à 6 chiffres via `crypto.randomInt(100000, 1000000)`.
- **Stockage mémoire haché** : Le code de vérification brut n'est jamais stocké en clair ; seul son hachage SHA-256 est conservé en mémoire.
- **Contrôles stricts** : Expiration en 10 minutes, invalidation à usage unique, maximum de 5 tentatives avant verrouillage et limitation de débit pour éviter les abus.

### Cloisonnement strict des données utilisateurs
- Chaque site créé est automatiquement associé à `req.session.userId`.
- Toute tentative de consultation, modification ou suppression d'un site appartenant à un autre utilisateur en modifiant l'ID dans l'URL renvoie une erreur `404 Not Found`.
- Les tâches de surveillance en arrière-plan ignorent les enregistrements orphelins ou non assignés.

### Moteur de supervision réseau
- **Sondes parallèles (`Promise.allSettled`)** : Teste simultanément tous les sites actifs toutes les 15 secondes sans blocage séquentiel en cas de cible lente ou indisponible.
- **Requêtes HTTP en deux phases** : Envoi de requêtes légères `HEAD` avec l'en-tête `User-Agent: LinkPulse-Monitor/1.0` et un délai d'attente de 6 secondes, avec repli automatique sur `GET` si la cible répond par `405 Method Not Allowed` ou `501 Not Implemented`.
- **Chronométrage de la résolution DNS** : Mesure précise de la durée de résolution DNS en millisecondes via `dns.promises.lookup()`.
- **Validation du certificat TLS** : Connexion directe sur le port 443 avec SNI (`tls.connect`) pour vérifier la validité et la date exacte d'expiration du certificat.

### Gestion des incidents (Règle des 3 échecs consécutifs)
- Marque automatiquement un site comme `offline` et ouvre un incident critique après **3 échecs consécutifs** lors des cycles automatiques (ou immédiatement lors d'un contrôle manuel).
- Dès le rétablissement du service, l'incident est automatiquement clôturé, les preuves de reprise sont consignées et la durée d'indisponibilité (**MTTR**) est calculée.

---

## 5. Sécurité & Cryptographie

- **Schéma de hachage** : `scrypt2$<sel-hex>$<hachage-hex>` (N=16384, r=8, p=1, longueur=64).
- **Jetons de session** : Entropie de 256 bits (`crypto.randomBytes(32).toString('hex')`).
- **Hachage des codes** : Empreinte hexadécimale `SHA-256` comparée via `crypto.timingSafeEqual`.
- **Mises à jour assainies** : `PATCH /api/sites/:id` autorise uniquement la modification des champs sûrs (`name`, `isEnabled`, `status`, `checkIntervalSeconds`), interdisant formellement l'altération de `id` ou `userId`.

---

## 6. Vérifications effectuées

Exécuter les tests depuis le répertoire `backend/` :

| Test / Vérification | Commande | Résultat |
|---|---|---|
| Suite complète d'intégration | `node test-auth.js` | **Succès (29/29 assertions réussies)** |
| Flux d'inscription | `node test-auth.js` | Création de compte, rejet des doublons |
| Authentification | `node test-auth.js` | Connexion valide, rejet de mot de passe incorrect (401) |
| Session & Déconnexion | `node test-auth.js` | Création de jeton, révocation, reconnexion |
| Isolation multi-utilisateurs | `node test-auth.js` | L'utilisateur B ne peut ni voir ni supprimer les sites de l'utilisateur A (404) |
| Cloisonnement du tableau de bord | `node test-auth.js` | Métriques et résumés indépendants par utilisateur |
| Réinitialisation de mot de passe | `node test-auth.js` | Génération de code, rejet de code invalide, limitation de débit |
| Contrôle de santé (Health Check) | `Invoke-RestMethod http://localhost:3000/api/health` | HTTP 200 `{ "status": "ok" }` |

---

## 7. Limitations connues & Feuille de route

- **Sessions en mémoire** : Les sessions actives sont réinitialisées en cas de redémarrage du serveur (cible future : Redis ou jetons JWT signés).
- **Migration base relationnelle & FastAPI** : Le stockage actuel repose sur des fichiers JSON locaux (`clients.json` et `donnees.json`). L'architecture est préparée pour la transition vers PostgreSQL / SQLite via FastAPI et SQLAlchemy (`backend/app/main.py`).
- **Sondes multi-régions** : Fonctionne actuellement depuis une sonde principale locale (`Tunis · Auto`). Le déploiement de sondes distribuées sur plusieurs régions géographiques est prévu dans les prochains objectifs.
