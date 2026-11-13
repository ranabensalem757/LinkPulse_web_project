# École Supérieure des Communications de Tunis (Sup'Com)

**Projet Web — Objectif 1**  
**Définition du projet web et cadrage fonctionnel**

## LinkPulse — Application web de supervision de sites web

* **Membres :** Rana Ben Salem, Mohammed Oussema Chihi
* **Responsable du cours :** Dr. Maroua Nouioua
* **Année universitaire :** 2026/2027

---

## Plan du document

1. **Titre du projet** (Page 2)
2. **Type de site et justification du choix** (Page 2)
   * 2.1 Type de site
   * 2.2 Justification
3. **Objectifs principaux** (Page 2)
   * 3.1 Quel problème résout le site ?
   * 3.2 Quels besoins utilisateurs souhaitons-nous satisfaire ?
   * 3.3 Quelle est la proposition de valeur principale ?
   * 3.4 Comment le succès du site sera-t-il mesuré ?
4. **Description du public cible** (Page 3)
5. **Idées initiales de fonctionnalités** (Page 3)
   * 5.1 Pages du site
   * 5.2 Fonctionnalités
   * 5.3 Pistes techniques envisagées (provisoires)
6. **Inspirations visuelles** (Page 4)
   * 6.1 Premier prototype de notre tableau de bord
   * 6.2 Démonstration vidéo : exemple d'UptimeRobot
7. **En résumé** (Page 7)
8. **Références** (Page 7)

---

## 1. Titre du projet

**LinkPulse** est une application web de supervision réseau qui mesure la disponibilité et le temps de réponse de sites web, enregistre ces mesures et signale les pannes ou les lenteurs sous forme d'incidents sur un tableau de bord.

---

## 2. Type de site et justification du choix

### 2.1 Type de site
Application web de supervision (*monitoring*) : un tableau de bord interactif alimenté par des mesures collectées automatiquement, et protégé par une page de connexion.

### 2.2 Justification
Un site web peut devenir indisponible ou lent sans que son propriétaire le sache. Nous avons choisi ce sujet pour trois raisons :
* Il répond à un besoin réel et facile à comprendre ;
* Il couvre l'ensemble d'un projet web : interface (HTML, CSS, JavaScript), serveur, base de données et authentification des utilisateurs ;
* Il est réaliste dans le temps imparti : le noyau du projet est limité et chaque étape produit un résultat visible.

---

## 3. Objectifs principaux

### 3.1 Quel problème résout le site ?
Le propriétaire d'un site découvre souvent une panne par ses utilisateurs, trop tard, et sans historique pour comprendre ce qui s'est passé.

### 3.2 Quels besoins utilisateurs souhaitons-nous satisfaire ?
* Savoir rapidement si ses sites fonctionnent ;
* Suivre l'évolution du temps de réponse ;
* Être alerté d'un problème, avec des preuves à l'appui ;
* Consulter l'historique des pannes et des lenteurs.

### 3.3 Quelle est la proposition de valeur principale ?
Un outil simple et léger qui surveille automatiquement des sites web et transforme des mesures brutes en incidents compréhensibles, sans configuration complexe.

### 3.4 Comment le succès du site sera-t-il mesuré ?
* La boucle complète fonctionne : connexion, ajout d'un site, vérification automatique, enregistrement, affichage, incident ;
* Un incident est ouvert après trois échecs consécutifs et clôturé dès la reprise du site, sans doublon ;
* Peu de fausses alertes sur des sites de test ;
* Le tableau de bord se met à jour sans rechargement manuel ;
* Un utilisateur ne voit que ses propres sites.

---

## 4. Description du public cible

| Critère | Détails |
| :--- | :--- |
| **Profil** | Étudiants et développeurs juniors qui hébergent leurs projets ; petits propriétaires de sites (associations, commerces locaux, portfolios). |
| **Attentes** | Lire l'état de ses sites d'un coup d'œil ; recevoir des messages clairs, sans jargon réseau ; disposer d'un historique fiable ; prendre l'outil en main rapidement. |
| **Conséquences sur le design** | Interface sobre ; codes couleur d'état (vert, orange, rouge) ; cartes de synthèse en haut du tableau de bord ; parcours de connexion simple ; affichage adapté aux écrans d'ordinateur et de téléphone. |

---

## 5. Idées initiales de fonctionnalités

### 5.1 Pages du site
1. **Connexion :** formulaire (e-mail, mot de passe), avec possibilité de créer un compte ;
2. **Tableau de bord :** nombre de sites sains, dégradés ou en panne, incidents récents, graphique de synthèse ;
3. **Sites surveillés :** liste avec état, ajout, mise en pause et suppression ;
4. **Détail d'un site :** courbe du temps de réponse et dernières mesures ;
5. **Incidents :** problèmes détectés, début, fin, gravité et preuves.

### 5.2 Fonctionnalités

| Fonctionnalité | Description | Priorité |
| :--- | :--- | :--- |
| **Authentification** | Page de connexion, création de compte, déconnexion ; pages du tableau de bord réservées aux utilisateurs connectés ; mots de passe stockés sous forme hachée ; chaque utilisateur ne voit que ses sites. | Essentielle |
| **Gestion des sites** | Ajouter, mettre en pause, reprendre et supprimer un site à surveiller, avec une fréquence de vérification réglable. | Essentielle |
| **Vérification automatique** | Requête HTTP périodique : code de statut et temps de réponse ; un échec est enregistré avec sa cause (délai dépassé, erreur serveur, etc.). | Essentielle |
| **Enregistrement** | Chaque mesure est enregistrée avec sa date dans une base de données. | Essentielle |
| **Détection d'incidents** | Règles simples : trois échecs consécutifs (site indisponible) ; temps de réponse moyen trop élevé (site lent). Un incident est clôturé automatiquement à la reprise. | Essentielle |
| **Visualisation** | Tableau de bord, graphique du temps de réponse, liste des incidents. | Essentielle |
| **Mode clair / sombre** | Choix du thème de l'interface. | Souhaitable |
| **Export des données** | Téléchargement de l'historique au format JSON. | Souhaitable |
| **Analyse par IA** | Détection d'anomalies et rapport d'explication d'un incident (Python). | Extension |
| **Déploiement** | Mise en ligne de l'application. | Extension |

### 5.3 Pistes techniques envisagées (provisoires)
L'interface sera développée avec **Angular** (HTML, CSS, JavaScript) et le serveur avec **Python (FastAPI)**. Les données seront stockées dans **Microsoft SQL Server**. Angular communiquera avec le serveur par une **API REST**, et l'accès aux pages sera protégé par une connexion.

---

## 6. Inspirations visuelles

Nous nous inspirons d'outils de supervision existants pour la lisibilité et les codes couleur, et non pour leur fonctionnement interne.

* **Figure 1 — Outils de supervision dont nous nous inspirons :**
  * Capture : *Uptime Kuma* (tableau de bord — *Quick Stats : Up, Down, Maintenance, Unknown, Pause*)
  * Capture : *Uptime Kuma* (détail d'un moniteur — *Google DNS, Ping, Avg. Ping, Uptime*)
  * Capture : *Grafana* (graphique de latence — *Visualization Examples*)
  * Capture : *Better Stack* (page d'incidents)

| Référence | Ce que nous retenons |
| :--- | :--- |
| **Uptime Kuma** [1] | Cartes de synthèse en haut de page ; codes couleur d'état ; graphique du temps de réponse par site. |
| **UptimeRobot** [2] | Liste claire des sites avec leur état et leur disponibilité. |
| **Better Stack** [3] | Présentation d'un incident : début, durée, gravité. |
| **Grafana** [4] | Lecture d'une courbe dans le temps et affichage d'un seuil d'alerte. |

### 6.1 Premier prototype de notre tableau de bord
* **Figure 2 — Prototype visuel du tableau de bord (données de démonstration) :** maquette générique de départ (*Network overview*, métriques, graphique d'évolution et liste des alertes), avec nom et données provisoires, qui sera adaptée à LinkPulse.

### 6.2 Démonstration vidéo : exemple d'UptimeRobot
* **Figure 3 — Vidéo de l'interface d'UptimeRobot :** Une courte vidéo présente l'interface d'UptimeRobot, l'une de nos inspirations. Nous nous en inspirons pour la lisibilité de la liste des sites (*Monitors*) et des codes couleur d'état (*Last 24 hours*).

---

## 7. En résumé

* **Pourquoi ce site ?** Parce qu'une panne non détectée coûte du temps et de la confiance.
* **Pour qui ?** Pour les étudiants, développeurs juniors et petits propriétaires de sites.
* **Pour quoi faire ?** Surveiller automatiquement des sites web, conserver l'historique des mesures et signaler clairement les incidents, dans un espace personnel protégé par une connexion.

---

## Références

1. **Uptime Kuma** — outil de supervision auto-hébergé. Site officiel : <https://uptime.kuma.pet> ; dépôt du projet : <https://github.com/louislam/uptime-kuma>. Consulté en 2026.
2. **UptimeRobot** — service de supervision de sites web. <https://uptimerobot.com>. Consulté en 2026.
3. **Better Stack (Uptime)** — supervision et gestion des incidents. <https://betterstack.com/uptime>. Consulté en 2026.
4. **Grafana** — tableaux de bord et visualisation de métriques. <https://grafana.com>. Consulté en 2026.