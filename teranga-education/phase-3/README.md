# TERANGA ÉDUCATION — Phase 3 : module pédagogique

> Version 0.3, 20 novembre 2026. Données de test **fictives**. Référentiel **provisoire, non officiel** (option 1 validée par le promoteur).

## 1. Ce qui a été livré

| Module | Fonctionnalités | Rôles |
|---|---|---|
| **Référentiel** | Versions, niveaux de hiérarchie libres (tels qu'ils figurent dans le guide), éléments en arbre, prérequis, sources documentaires et leur statut. Bandeau d'avertissement tant que des éléments sont provisoires | Direction (modification), personnel (lecture) |
| **Leçons** | Bibliothèque partagée (filtres), éditeur en blocs (explication, exemple, activité, consigne, à retenir), objectifs du référentiel, prérequis, piste de remédiation, statuts brouillon → à valider → validée, publication vers un groupe ou un élève avec échéance | Personnel |
| **Exercices** | QCM (une ou plusieurs bonnes réponses), réponse courte (plusieurs réponses acceptées), production libre. Difficulté 1 à 3, barème, **correction expliquée**, objectifs. Contrôle de complétude avant validation | Personnel |
| **Évaluations** | Diagnostiques, formatives et sommatives, composées d'exercices validés, option « français obligatoire », publication | Personnel |
| **Corrections** | File des copies à corriger, réponse de l'élève, réponse attendue, **note automatique proposée**, note et commentaire, validation groupée des notes automatiques | Encadreur (ses élèves), direction |
| **Espace élève** | Mes leçons (lecture audio en français de chaque bloc), Mes exercices (une question par écran, grands boutons), évaluations question par question, Mes résultats avec correction expliquée | Élève |
| **Parent** | Résultats récents dans le dossier de l'enfant, commentaire de l'encadreur, correction expliquée | Parent |

Le dossier de compétences se met à jour **automatiquement** à chaque correction (règle de la Phase 1). Exemple vérifié : l'objectif P-M-03 passe de *non acquis* (0 %) à *en cours* (50 %, puis 75 %). Les écrans de suivi de la progression arrivent en Phase 4.

## 2. Référentiel provisoire

Fichier : `supabase/seed/referentiel-provisoire-demo.sql`. Il contient 5 objectifs de mathématiques (CE1-CE2) **rédigés par le centre pour les tests**, avec deux prérequis pour la division.

Garde-fous :
- la version s'appelle « PROVISOIRE — démonstration (non officiel) » ;
- la source porte le statut « repérée », avec une note explicite ;
- chaque objectif est marqué **provisoire** ; l'interface l'affiche partout, avec un bandeau d'avertissement ;
- **nouvelle règle imposée par la base (RG14)** : un objectif ne peut être marqué « vérifié » que s'il cite une source **authentifiée**. Une source n'est authentifiée qu'après confirmation explicite par la direction, avec son nom et la date.

Quand les guides officiels seront disponibles, il faudra :
1. enregistrer la source et l'authentifier ;
2. créer la version officielle avec ses vrais niveaux (domaine, compétence, palier, objectif…) ;
3. saisir les intitulés **sans les reformuler** ;
4. rattacher les leçons aux nouveaux objectifs.

Les leçons ne sont pas perdues : seuls leurs rattachements changent.

## 3. Règles de sécurité ajoutées (migration 4)

| Règle | Où elle s'applique |
|---|---|
| L'élève et le parent ne voient la **correction expliquée qu'après la correction**, via une fonction contrôlée (`correction_feedback`) | Base de données |
| Un autre parent n'y a jamais accès | Base de données |
| Toute modification d'un corrigé est **journalisée** | Base de données |
| Un objectif sans source authentifiée reste provisoire | Base de données |
| Seul un contenu **validé** peut être publié, et seulement vers ses propres groupes ou élèves (règle de la Phase 1, désormais utilisée par l'interface) | Base de données |
| Un brouillon n'est jamais visible par l'élève | Base de données |

## 4. Résultats des tests

| Niveau | Contenu | Résultat |
|---|---|---|
| Base de données (SQL) | Scénario T1-T14, cloisonnement, règles de la Phase 3 | **58 / 58** ✅ |
| Logique (Vitest) | Identifiants, export CSV, contrôle de complétude des exercices | **32 / 32** ✅ |
| Parcours complets (Playwright, PC et Android) | Phase 2 (4 tests) + Phase 3 (1 scénario complet) | **10 / 10** ✅, deux exécutions consécutives |

Le scénario de la Phase 3, rejoué dans le navigateur, couvre les étapes **T5, T6, T8, T9, T10 et T11** :
1. Le référentiel affiche l'avertissement « provisoire ». Marquer un objectif comme vérifié sans source authentifiée est **refusé**.
2. **T5** : l'encadreur crée la leçon « La division » (3 blocs, objectif P-M-03) et la valide. Il ajoute un QCM, dont la validation est d'abord refusée faute de bonne réponse, puis une réponse courte. Il publie la leçon vers le groupe. Un brouillon reste invisible pour l'élève.
3. **T6 / T8** : l'élève lit la leçon, avec les boutons d'écoute, puis répond faux au QCM et juste à la réponse courte (« Cinq »). Le corrigé n'apparaît **pas** avant la correction.
4. **T9** : l'encadreur voit la réponse et la note automatique proposée, corrige et commente.
5. **T11** : le parent voit 0 / 1, le commentaire et la correction expliquée. Un autre parent ne voit rien.
6. L'évaluation diagnostique est créée, publiée à l'élève et passée question par question. Les notes automatiques sont ensuite validées en une fois.

### Défauts trouvés et corrigés

| Défaut | Correction |
|---|---|
| Une fenêtre rouverte très vite (par exemple « + Exercice » juste après un enregistrement) pouvait se refermer seule, surtout sur téléphone | Le composant fenêtre ignore désormais la fermeture différée qui ne vient pas de l'utilisateur |
| Le message « Leçon validée » disparaissait lors du passage à l'adresse de la nouvelle leçon | Le message suit la redirection (même correctif pour les évaluations) |

## 5. Limites connues

| Sujet | Détail | Suite |
|---|---|---|
| Note automatique visible par l'API | L'élève ne voit jamais sa note automatique dans l'interface avant la correction. Elle reste toutefois lisible par un appel technique direct à l'API. Le corrigé et la correction expliquée, eux, restent protégés | Masquage complet en Phase 7 (revue de sécurité) |
| Correction groupée | Quand plusieurs notes sont validées en une fois, l'historique de compétences enregistre le même pourcentage pour chacune. Le niveau final est juste | Sans conséquence pratique ; à affiner en Phase 4 |
| Exercices « photo du cahier » et « oral » | Prévus dans le modèle, mais pas encore dans l'interface : ils demandent le stockage de fichiers | Phase 5 (audio) |
| Aide en wolof | Le bouton n'existe pas encore ; l'option « français obligatoire » est déjà enregistrée sur les évaluations | Phase 5 |
| Lecture audio | Utilise la voix française du téléphone. La qualité dépend de l'appareil, et certains Android n'ont pas de voix française installée | Enregistrements humains en Phase 5 |

## 6. Prochaine étape : Phase 4 (suivi et remédiation)

Dossier pédagogique complet, tableau de progression visuel (niveau initial, intermédiaire et récent), liste des élèves en difficulté, diagnostic par les prérequis, et plans de remédiation validés par l'encadreur. Cela couvre les étapes **T12 à T14** du scénario.
