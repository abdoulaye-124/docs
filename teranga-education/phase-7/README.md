# TERANGA ÉDUCATION — Phase 7 : tests, sécurité et préparation de la mise en ligne

> Version 0.7, 27 novembre 2026.
> **Condition du promoteur : aucun frais en plus de l'abonnement Claude Pro.** Toute la phase a été construite dans ce cadre.

## 1. Zéro frais : ce que cela implique

| Poste | Solution gratuite retenue | Limite à connaître |
|---|---|---|
| **Intelligence artificielle** | **Assistant désactivé en production.** L'abonnement Claude Pro **ne comprend pas l'API** : son usage par une application est facturé à part. Sans clé, l'application masque tous les boutons de l'assistant, au lieu d'afficher de fausses réponses | Activable plus tard (Phase 6 § 4), si un budget est décidé |
| **Base de données, connexion, fichiers** | Offre **gratuite** de Supabase | 500 Mo de base, 1 Go de fichiers (environ 90 h d'audio), **pas de sauvegarde automatique**, **mise en pause après 7 jours sans activité** (réactivation gratuite depuis le tableau de bord). À vérifier sur supabase.com/pricing, les conditions évoluent |
| **Connexion des parents par téléphone** | **Sans SMS.** Supabase exige un fournisseur de SMS payant pour la connexion par téléphone. Le numéro est donc converti en identifiant technique : **le parent tape toujours son numéro et son mot de passe**, rien ne change pour lui | Mot de passe oublié : réinitialisation par la direction (déjà en place), pas par SMS |
| **Hébergement de l'application** | **Cloudflare Pages**, offre gratuite (trafic illimité pour un site statique) | Adresse en `….pages.dev` ; un nom de domaine propre serait payant (facultatif) |
| **Sauvegardes** | **Script de sauvegarde chiffrée**, à lancer chaque semaine depuis l'ordinateur du centre | Demande un peu de discipline (§ 5) |
| **Déploiement** | GitHub Actions (gratuit pour cet usage) | — |

## 2. Ce qui a été fait

### Sécurité
| Mesure | Testée |
|---|---|
| **Note automatique invisible pour l'élève et le parent**, même par un appel direct à l'API (point relevé en Phase 3) ; seul le personnel affecté la lit | ✅ SQL |
| Contrôle que **toutes les tables** ont des règles d'accès, qu'**un visiteur non connecté n'a aucun droit**, et que toutes les fonctions à privilèges sont protégées contre le détournement | ✅ SQL |
| **En-têtes de sécurité** du site : interdiction d'intégration dans une autre page, sources autorisées, micro limité au site | ✅ version de production |
| **Dépendances** : une faille de React Router signalée (redirection malveillante) ; mise à jour vers la version 7 corrigée. **0 vulnérabilité** | ✅ `npm audit` + 20 parcours rejoués |
| Contrôle des dépendances ajouté à l'intégration continue | — |

### Mode hors connexion (élèves)
- Les leçons et exercices déjà ouverts restent **consultables sans réseau**.
- L'application installée **s'ouvre sans réseau, même après un redémarrage du téléphone**.
- Une réponse donnée hors connexion est **gardée sur le téléphone**, puis **envoyée automatiquement** au retour du réseau, **sans doublon**.
- Un bandeau indique l'état : « Hors connexion », puis « N réponse(s) en attente d'envoi ».
- *Non couvert : les fichiers audio ne sont pas disponibles hors connexion.*

### Accessibilité
Analyse automatique axe-core (normes WCAG A et AA) de **13 écrans**, sur PC et Android. Deux défauts corrigés :
- un texte trop pâle sur l'accueil de l'élève ;
- des tableaux défilants inaccessibles au clavier.

Résultat : **aucune violation grave**.

### Sauvegarde et restauration
- `ops/sauvegarder.sh` : base de données et fichiers audio, **chiffrés** (AES-256, phrase secrète), avec empreinte de contrôle.
- `ops/restaurer.sh` : restauration dans un projet neuf.
- **Testé de bout en bout** : sauvegarde, puis restauration dans une base vide ; **73 tables comparées, 0 écart** ; fichier audio supprimé puis restauré **à l'identique** ; refus d'une mauvaise phrase secrète et d'un fichier modifié.

### Préparation du déploiement
- Code partagé déplacé dans `supabase/functions/_shared` : les fonctions se déploient sans manipulation manuelle.
- `supabase/config.toml`, et procédure de déploiement **lancée à la main** depuis GitHub (`teranga-deploiement.yml`) : elle exige de taper « DEPLOYER ».
- `ops/premier-admin.sql` : création du premier compte administrateur.

## 3. Résultats des tests

| Niveau | Résultat |
|---|---|
| Base de données (SQL) | **101 / 101** ✅ |
| Logique (Vitest) | **75 / 75** ✅ |
| Parcours complets (Playwright, PC + Android) : phases 2 à 7, dont le hors connexion et l'accessibilité | **20 / 20** ✅ |
| Version de production : en-têtes de sécurité, ouverture sans réseau après rechargement | ✅ |
| Sauvegarde et restauration | ✅ |
| Vulnérabilités connues des dépendances | **0** ✅ |

### Défauts trouvés et corrigés pendant cette phase
| Défaut | Correction |
|---|---|
| **Rechargement sans réseau : écran « Chargement… » pendant 7 secondes**, car le kit Supabase réessaie avant d'abandonner | Si le téléphone sait qu'il n'a pas de réseau, les données gardées sont utilisées immédiatement |
| La connexion par téléphone aurait exigé un fournisseur de SMS payant | Identifiant technique dérivé du numéro (§ 1) |
| Faille connue de React Router | Version 7.18.5 |
| Texte trop pâle ; tableaux inaccessibles au clavier | Corrigés |
| L'environnement de développement ne redémarrait pas ses services après une coupure | Relance automatique |

## 4. Mise en ligne pas à pas (à faire ensemble, tout est gratuit)

Ne collez **jamais** une clé, un mot de passe ou un jeton dans une conversation.

1. **Supabase** : créez un compte sur supabase.com, puis un projet (choisissez la région la plus proche). Notez le mot de passe de la base dans un endroit sûr.
2. **Authentification** (Supabase › Authentication) :
   - **désactivez les inscriptions libres** ;
   - laissez le fournisseur E-mail actif ;
   - mettez la longueur minimale des mots de passe à 8 ;
   - réglez la limite des tentatives de connexion par adresse IP à 30 par 5 minutes (protection du code-image des élèves).
3. **GitHub** (Settings › Secrets › Actions) : ajoutez `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` et `SUPABASE_DB_PASSWORD`. Puis, dans Actions › « TERANGA ÉDUCATION — déploiement Supabase », lancez la procédure en tapant `DEPLOYER`.
4. **Premier administrateur** : suivez `ops/premier-admin.sql`.
5. **Référentiel provisoire** (facultatif) : collez `supabase/seed/referentiel-provisoire-demo.sql` dans l'éditeur SQL. Il reste marqué « provisoire, non officiel ».
6. **Cloudflare Pages** (compte gratuit) : « Connect to Git », choisissez ce dépôt, puis :
   - dossier racine `teranga-education/app` ;
   - commande de construction `npm ci && npm run build` ;
   - dossier de sortie `dist` ;
   - variables `NODE_VERSION=22`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé **publique**, Supabase › Settings › API).
7. Dans Supabase › Authentication › URL Configuration, indiquez l'adresse `….pages.dev` obtenue.
8. **Recette sur vos appareils** (§ 6), **avec des données fictives d'abord**.
9. Avant de vraies familles : la liste de contrôle CDP de la Phase 1 (déclaration, textes de consentement relus, transfert hors du Sénégal).

> **Non encore exécuté** : la procédure de déploiement GitHub et l'installation chez Cloudflare n'ont pas pu être essayées ici (aucun compte). Ce sera fait avec vous à l'étape 3. Un point sera vérifié dès la création du premier compte : que Supabase hébergé accepte les identifiants techniques en `.invalid`. Sinon, il suffit de changer le domaine dans `_shared/identifiants.ts`.

## 5. Sauvegardes : la routine

- **Chaque semaine** (et avant chaque mise à jour) : `ops/sauvegarder.sh`, depuis l'ordinateur du centre.
- Il faut installer gratuitement le client PostgreSQL, en version égale ou supérieure à celle du projet Supabase.
- Les réglages vont dans `ops/.env.sauvegarde`, qui n'est jamais publié.
- Copiez le fichier `.tar.enc` sur **deux supports** (clé USB et disque, par exemple). Il est chiffré : sans la phrase secrète, il est illisible.
- **Gardez la phrase secrète hors de l'ordinateur**, par exemple sur papier dans un coffre. **Sans elle, la sauvegarde est perdue.**
- Une fois par trimestre, faites un essai de restauration sur un **second projet gratuit**.

## 6. Recette sur de vrais appareils (à faire par vous, 30 minutes)

Les tests automatiques simulent un téléphone Android et un PC ; rien ne remplace un vrai appareil.

| # | Sur… | Vérifier |
|---|---|---|
| 1 | Téléphone Android (Chrome) | L'adresse s'ouvre ; « Ajouter à l'écran d'accueil » installe l'application ; l'icône apparaît |
| 2 | Android | Connexion élève avec les 4 images ; tuiles lisibles ; lecture audio (🔊) avec la voix française du téléphone |
| 3 | Android | Encadreur : enregistrer une lecture au micro, puis l'écouter |
| 4 | Android, **mode avion** | Rouvrir l'application installée ; relire une leçon déjà ouverte ; répondre ; repasser en ligne et voir le bandeau disparaître |
| 5 | Android, réseau 3G ou faible | Temps d'ouverture acceptable (quelques secondes) |
| 6 | PC (Chrome ou Edge) | Direction : inscrire un élève, créer un parent, une séance, faire l'appel |
| 7 | PC | Imprimer un bilan en PDF |
| 8 | iPhone (si le centre en a) | Connexion, leçons, audio (non testé jusqu'ici) |

## 7. Limites et risques restants

| Sujet | Risque | Réponse |
|---|---|---|
| Code-image des jeunes élèves (20 736 combinaisons) | Essais en série | Limite de tentatives réglée côté Supabase (§ 4.2) + mode accompagné pour CI-CP. Le blocage par compte demanderait une option payante de Supabase |
| Pause du projet gratuit après 7 jours sans activité (vacances) | Application indisponible jusqu'à réactivation | Réactivation gratuite en un clic (tableau de bord Supabase) |
| Pas de sauvegarde automatique | Perte de données si la routine n'est pas suivie | § 5 ; l'offre payante de Supabase (environ 25 $ par mois) les automatiserait, si le centre grandit |
| Audio hors connexion | Non disponible | Évolution possible |
| Déploiement réel | Non exécuté | À faire ensemble (§ 4) |
