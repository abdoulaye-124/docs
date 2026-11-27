# TERANGA ÉDUCATION — Phase 4 : suivi et remédiation

> Version 0.4, 20 novembre 2026. Données de test **fictives**. Référentiel **provisoire, non officiel**.
> Avec cette phase, **les 14 étapes du scénario de validation (T1 à T14) fonctionnent**, à l'exception de T7 (wolof, Phase 5).

## 1. Ce qui a été livré

| Module | Fonctionnalités | Rôles |
|---|---|---|
| **Dossier pédagogique** | Synthèse (acquises, en cours, non acquises, **au départ / maintenant**), présences, **tableau de progression** par objectif : niveau initial, frise de toutes les évaluations, niveau récent, tendance (progrès, stable, recul) | Personnel affecté, parent |
| **Ajustement du niveau** | L'encadreur peut corriger le niveau calculé, avec **justification obligatoire**. L'ajustement s'ajoute à l'historique (rien n'est effacé) et apparaît cerclé de bleu sur la frise | Encadreur, direction |
| **Observations** | Internes au centre, ou **partagées avec les parents** (case à cocher) | Encadreur (rédaction), parent (observations partagées) |
| **Bilans** | Période, synthèse, points forts, difficultés, recommandations pour la maison. Compétences et assiduité **pré-remplies**. Brouillon ou envoi au parent, avec notification. **Figé une fois envoyé**. Impression ou PDF | Encadreur (rédaction), parent (lecture) |
| **Élèves en difficulté** | Tous les objectifs non acquis ou en cours, du plus faible au moins faible, avec un lien vers le diagnostic ou le programme existant | Personnel |
| **Diagnostic** | Niveau actuel, derniers exercices sur l'objectif, **vérification des prérequis** (jusqu'à 5 niveaux) et une piste explicative | Personnel |
| **Programme de remédiation** | Proposé automatiquement à partir des prérequis (règles transparentes, sans IA). L'encadreur **modifie le diagnostic, retire des étapes, valide ou refuse**, puis lance le programme : les exercices sont publiés à l'élève. Les étapes se cochent quand l'élève rend son travail. Clôture avec mesure **avant / après** | Encadreur (décision), parent (programme validé) |
| **Tableaux de bord** | Direction : élèves en difficulté, remédiations en cours. Encadreur : objectifs en alerte. Parent : **notifications** (programme mis en place, bilan disponible, nouvelles leçons) | Selon le rôle |
| **Élève** | « Mes progrès » : 1 à 3 étoiles par objectif, **sans aucun classement** entre élèves | Élève |

### Comment le système propose un programme (règles lisibles)

1. Il prend l'objectif en difficulté, par exemple « Diviser… ».
2. Il remonte ses prérequis dans le référentiel, par exemple « Tables de multiplication » et « Sens du partage ».
3. Chaque prérequis **non acquis, en cours ou jamais évalué** devient une étape, avec jusqu'à 2 exercices validés, du plus facile au plus difficile.
4. Le programme se termine par l'objectif lui-même : **d'abord les exercices que l'élève a ratés**, puis d'autres exercices.
5. Le diagnostic rédigé explique chaque choix. **Rien n'est transmis à l'élève avant la validation par un encadreur.**

## 2. Règles ajoutées dans la base (migration 5)

| Règle | Testée |
|---|---|
| Seul un encadreur **affecté** à l'élève peut proposer un programme | ✅ |
| Il ne peut y avoir **qu'un seul programme ouvert** par élève et par objectif | ✅ |
| Un programme ne peut être **lancé** qu'après validation par un humain identifié | ✅ |
| Une étape est **cochée automatiquement** quand l'élève rend l'exercice | ✅ |
| La mesure **avant / après** compare le niveau au moment de la proposition et le niveau actuel | ✅ |
| Le parent est **notifié** quand un programme est validé et quand un bilan est envoyé (y compris un envoi direct sans brouillon) | ✅ |
| Un bilan en brouillon est invisible pour le parent ; un bilan envoyé est **figé et daté** | ✅ |
| Un autre parent ne voit ni le bilan ni le programme | ✅ |

## 3. Résultats des tests

| Niveau | Résultat |
|---|---|
| Base de données (SQL) | **74 / 74** ✅ |
| Logique (Vitest), dont les calculs de progression | **38 / 38** ✅ |
| Parcours complets (Playwright, PC + Android), phases 2, 3 et 4 | **12 / 12** ✅, deux exécutions consécutives |

Le scénario de la Phase 4, rejoué dans le navigateur :
- **T12** : après deux copies ratées, l'élève apparaît dans « Élèves en difficulté » (P-M-03, non acquis, 0 %). Le diagnostic montre que les tables de multiplication et le sens du partage n'ont jamais été évalués.
- **T13** : le programme proposé commence par la table de 3, puis reprend les deux divisions ratées. L'encadreur retire les étapes qu'il juge inutiles, complète le diagnostic (« confond partage et soustraction »), valide, puis lance le programme. Le parent est notifié.
- L'élève fait les exercices du programme, et les étapes se cochent au fur et à mesure.
- **T14** : l'encadreur corrige, puis clôture : **avant non acquis (0 %) → maintenant en cours d'acquisition (50 %)**. Le tableau de progression indique « ↗ progrès ».
- L'encadreur écrit une observation interne et une observation partagée, puis envoie un bilan.
- Le parent voit la progression, le programme terminé, l'observation partagée (**pas** l'interne), le bilan et les notifications.
- L'élève voit ses étoiles.

### À savoir sur le calcul du niveau

Un objectif réussi à 100 % **une seule fois** reste « en cours ». La règle retenue en Phase 1 exige au moins **2 évaluations** pour déclarer un objectif « acquis ». Ce seuil est modifiable dans les paramètres, et l'encadreur peut toujours ajuster le niveau avec une justification.

### Défauts trouvés et corrigés pendant cette phase

| Défaut | Correction |
|---|---|
| Le programme proposé pouvait piocher n'importe quel exercice de la bibliothèque, et le résultat variait selon son contenu | Priorité aux exercices **ratés par l'élève**, et possibilité pour l'encadreur de **retirer des étapes** |
| Un exercice déjà fait n'était pas reproposé quand l'encadreur l'envoyait à nouveau dans un programme | Un exercice republié redevient « à faire » |
| Un bilan envoyé directement, sans brouillon, ne déclenchait pas de notification et n'était pas daté | Règle corrigée en base, avec un test ajouté |

## 4. Limites connues

| Sujet | Suite |
|---|---|
| Les notifications sont visibles dans l'application seulement : ni push, ni SMS, ni WhatsApp | Notifications push en V1 ; SMS et WhatsApp Business en V2, après autorisation |
| Pas de groupe de remédiation créé automatiquement : le programme est individuel. La direction peut toujours créer un groupe de remédiation | Selon les retours du terrain |
| Le PDF du bilan passe par l'impression du navigateur | Génération serveur en Phase 7 si nécessaire |
| L'assistant IA ne participe pas encore aux diagnostics | Phase 6 : il proposera, l'encadreur validera |

## 5. Prochaine étape : Phase 5 (français / wolof)

Enregistrements audio réalisés par les encadreurs (français et wolof), explications complémentaires en wolof sur les consignes, les mots et les notions, circuit de validation humaine, et masquage pendant les évaluations « français obligatoire ». Cela couvre l'étape **T7**, la dernière du scénario.

**Question pour vous** : qui, dans votre équipe, relira et enregistrera les explications en wolof ? Il faut au moins une personne pour la validation.
