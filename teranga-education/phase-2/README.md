# TERANGA ÉDUCATION — Phase 2 : premier prototype

> Version 0.2, 20 novembre 2026. Toutes les données utilisées sont **fictives**.

## 1. Ce qui a été livré

| Module | Fonctionnalités | Rôles |
|---|---|---|
| Connexion | 3 modes : **personnel** (e-mail ou téléphone), **parent** (téléphone sénégalais), **élève** (identifiant + code de 4 images) | Tous |
| Tableaux de bord | Direction : effectifs par niveau, encadreurs, séances, taux de présence, **points d'attention** (élèves sans groupe, sans référent, sans parent). Encadreur : élèves affectés, séances, appels à saisir. Parent : enfants, présences, prochaines séances. Élève : accueil à grandes tuiles avec lecture audio | Selon le rôle |
| Élèves | Liste filtrable, inscription, fiche, modification, archivage, référent, **export Excel (CSV)** | Admin (inscription), direction, encadreur (lecture de ses élèves) |
| Parents | Création du compte, **association validée** à l'enfant, **consentements** versionnés, contact autorisé | Admin |
| Personnel | Création des comptes, réinitialisation du mot de passe, désactivation | Admin |
| Compte élève | Identifiant court + code-image tiré au hasard, carte imprimable, nouveau code, **soumis au consentement parental** | Admin |
| Groupes | Groupes principaux et de remédiation, ajout et retrait d'élèves et d'encadreurs (historique daté conservé), règle « un seul groupe principal » | Direction |
| Séances | Programmation (salle ou lien à distance), **refus automatique des conflits**, appel (présent, retard, absent, excusé), observations, annulation | Direction, encadreur de la séance |
| Paramètres | Salles, année scolaire | Direction |
| PWA | Application installable sur Android et PC (manifeste, icônes, Service Worker). Le mode hors-ligne complet est prévu en V1 | — |

**Fonction serveur `admin-users`** : création des comptes avec la clé secrète **côté serveur uniquement**. Elle vérifie que l'appelant est administrateur, enregistre le profil avec ses droits (donc soumis aux règles RLS et au journal d'audit) et annule la création si une étape échoue.

## 2. Résultats des tests

| Niveau | Contenu | Résultat |
|---|---|---|
| Base de données (SQL) | Scénario T1 à T14 + cloisonnement | **51 / 51** ✅ |
| Logique (Vitest) | Téléphones sénégalais, identifiants, code-image, export CSV (dont la protection contre les formules Excel) | **24 / 24** ✅ |
| Parcours complets (Playwright) | Scénario Phase 2 sur **PC** et sur **téléphone Android (Pixel 7)** : 4 tests × 2 appareils | **8 / 8** ✅ |
| Compilation | TypeScript strict, compilation de production | ✅ |
| Poids | Premier chargement : **146 Ko** compressés (objectif < 300 Ko) | ✅ |

Le parcours testé dans le navigateur :
1. L'admin se connecte, crée une salle, un encadreur et deux parents.
2. **T1** : il inscrit une élève de CE2 (identifiant TE-AAAA-NNNN généré).
3. **T2** : il associe le parent. Le consentement obligatoire est exigé.
4. **T3** : il crée le groupe CE2 et y ajoute l'élève. Un second groupe principal est refusé.
5. **T4** : il affecte l'encadreur au groupe et le désigne comme référent.
6. Il crée le compte élève et obtient son code-image.
7. Il programme une séance. Une séance qui se chevauche est **refusée**.
8. L'encadreur ne voit que son élève, se voit refuser la page « Parents » et fait l'appel.
9. Le parent voit son enfant, la séance et la présence, mais pas les observations internes.
10. Un **autre parent ne voit rien**, même en tapant l'adresse du dossier.
11. L'élève se connecte avec ses 4 images.

Vérifié en plus : aucune page interne n'est accessible sans connexion, un code-image erroné est refusé, et aucune page ne défile horizontalement, ni sur téléphone ni sur PC.

### Défauts trouvés et corrigés pendant cette phase

| Défaut | Correction |
|---|---|
| Au redémarrage local, l'ancien serveur de fonctions restait actif : les tests tournaient avec une version périmée du code | Arrêt fiable de la passerelle et vérification au démarrage. Un test contrôle désormais que l'identifiant de l'élève est bien enregistré |
| Tableau des présences tronqué sur la fiche élève (PC) | Carte élargie |

## 3. Lancer le prototype sur un poste de développement

Prérequis : PostgreSQL 15+, Docker, Node.js 22.

```bash
cd teranga-education/dev
./local-stack.sh reset      # base neuve + services d'authentification et d'API
cd ../app && npm install && npm run dev
# → http://127.0.0.1:5173   admin de démonstration : admin@demo.teranga.invalid / Admin-demo-2026
```

Tests :
```bash
cd teranga-education/supabase && ./tests/run_tests.sh   # base de données
cd teranga-education/app && npm test                    # logique
cd teranga-education/app && npm run e2e                 # parcours (réinitialise la base locale)
```

L'environnement local reproduit Supabase avec ses composants officiels : PostgreSQL, **GoTrue** (authentification) et **PostgREST** (API). Le même code fonctionnera donc sur Supabase hébergé.

## 4. Mise en ligne sur Supabase (quand vous serez prêt)

Ces étapes seront faites **ensemble**. Ne transmettez jamais une clé secrète dans la conversation.

1. Créez un compte sur supabase.com et un projet (région la plus proche ; choix définitif selon la liste CDP de la Phase 1).
2. Dans *Authentication › Providers* : activez *Email* et *Phone* et **désactivez les inscriptions libres** (seul le centre crée les comptes).
3. Appliquez les migrations du dossier `supabase/migrations` (avec la CLI Supabase : `supabase db push`).
4. Déployez la fonction `admin-users`. Le dossier `shared/` doit être copié dans `supabase/functions/_shared/` au déploiement ; cette étape sera automatisée.
5. Créez le premier compte administrateur depuis le tableau de bord Supabase, puis ajoutez son profil et son rôle.
6. Hébergez l'application (Vercel, Netlify ou Cloudflare Pages) avec deux variables : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé **publique**).

## 5. Points d'attention

| Sujet | Explication | Suite |
|---|---|---|
| **Robustesse du code-image** | 4 images parmi 12, soit 20 736 combinaisons. C'est suffisant contre un essai au hasard, mais pas contre des milliers d'essais automatisés. Le service d'authentification limite le nombre de tentatives, et un compte élève ne donne accès qu'aux données de l'élève lui-même | Pour CI-CP, privilégier le **mode accompagné** (téléphone du parent). Ajout d'un blocage temporaire après plusieurs échecs en Phase 7 |
| Textes de consentement | **Projets** (version `v0-prototype`) | À faire relire par un juriste avant de vraies inscriptions |
| Import Excel | L'export est fait ; l'import est prévu en V1 | Phase 3 ou 4, selon votre priorité |
| SMS de vérification des parents | Non activé : un fournisseur SMS est nécessaire | V2 |
| Tests de bout en bout dans l'intégration continue | Les tests de base de données et d'application tournent sur GitHub à chaque modification ; les parcours navigateur tournent en local | À ajouter lors de la mise en place de Supabase |
| Textes de l'interface | Rédigés directement dans les écrans, et pas encore regroupés dans un fichier unique | À regrouper avant l'ajout du wolof dans l'interface (Phase 5) |

## 6. Prochaine étape : Phase 3 (module pédagogique)

Référentiel (saisie depuis les guides authentifiés), leçons, exercices, évaluations et corrections. **Prérequis** : les guides officiels du CEB (documents M1 à M3 de la Phase 0), ou à défaut votre accord pour saisir quelques objectifs **marqués provisoires** afin de construire et tester les écrans.
