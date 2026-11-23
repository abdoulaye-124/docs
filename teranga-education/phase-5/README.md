# TERANGA ÉDUCATION — Phase 5 : module français / wolof

> Version 0.5, 23 novembre 2026. Données de test **fictives**.
> **Important : aucun texte en wolof n'a été rédigé par l'assistant de développement.** Les tests utilisent des marqueurs « [wolof] … », qui ne sont pas du wolof. Les vrais contenus seront écrits ou enregistrés par l'équipe, puis relus.
> Avec cette phase, **les 14 étapes du scénario de validation fonctionnent**, y compris T7.

## 1. Ce qui a été livré

| Fonctionnalité | Détail | Rôles |
|---|---|---|
| **Lecture de la leçon en français** | L'encadreur enregistre sa voix au micro (téléphone ou PC) ou dépose un fichier. L'élève entend la **voix de son encadreur** ; à défaut, la voix de synthèse du téléphone | Encadreur, élève |
| **Explications complémentaires en wolof** | Sur une **notion**, un **mot difficile**, une **consigne** ou un **problème** : texte en wolof et/ou enregistrement. Sur la leçon ou sur un exercice précis | Encadreur (rédaction) |
| **Relecture obligatoire** | Tout contenu wolof passe par la file « Relecture » : écoute, **correction du texte**, validation ou refus. Seuls le **relecteur wolof** et la coordination peuvent valider | Relecteur wolof, coordination, direction |
| **Rôle « Relecteur wolof »** | Créé par la direction (Personnel › Nouveau compte › Fonction). Le relecteur voit les leçons et les exercices pour le contexte, **jamais les dossiers d'élèves** | Direction |
| **Aide en wolof pour l'élève** | Bouton jaune « 🗣 Aide en wolof » sous la leçon et sous chaque exercice d'entraînement : texte et bouton « Écouter en wolof » | Élève |
| **Français obligatoire** | Aucune aide wolof pendant une évaluation. Pour un exercice qui fait partie d'une évaluation « français obligatoire » publiée à l'élève, l'aide est **masquée aussi en entraînement**, pour qu'elle ne puisse pas servir pendant l'épreuve | Élève |
| **Audio économe** | Enregistrement en Opus à 24 kb/s : environ 3 Ko par seconde, 3 minutes au maximum. Le fichier n'est téléchargé **que si l'on appuie sur « Écouter »** | Tous |

## 2. Règles de sécurité (migrations 6 et 7)

| Règle | Testée |
|---|---|
| Un encadreur **ne peut pas valider seul** un contenu en wolof | ✅ SQL |
| Une voix de synthèse ou un contenu IA, quelle que soit la langue, exige un relecteur | ✅ SQL |
| L'encadreur peut valider **sa propre lecture en français** (comme pour une leçon) | ✅ SQL |
| Une explication **modifiée après validation repasse « à relire »** | ✅ SQL |
| Toute modification d'un contenu linguistique est **journalisée** | ✅ (audit) |
| L'élève ne voit que les contenus **validés** et liés à ce qui lui est publié | ✅ SQL + navigateur |
| L'aide wolof est masquée pour un exercice d'évaluation « français obligatoire » | ✅ SQL + navigateur |
| Le relecteur n'accède à **aucun dossier d'élève** | ✅ SQL + navigateur |
| Fichiers audio **privés** : dépôt uniquement dans son propre dossier ; lecture par lien temporaire (10 min) uniquement si la fiche audio est visible ; un élève ne dépose rien | ✅ SQL + service de stockage réel |

## 3. Résultats des tests

| Niveau | Résultat |
|---|---|
| Base de données (SQL) | **86 / 86** ✅ |
| Logique (Vitest), dont les règles audio | **48 / 48** ✅ |
| Parcours complets (Playwright, PC + Android), phases 2 à 5 | **14 / 14** ✅, deux exécutions consécutives |

Le scénario de la Phase 5, rejoué dans le navigateur avec un **micro simulé** :
1. L'encadreur enregistre la lecture de la leçon : un vrai fichier audio est créé et stocké.
2. Il ajoute une explication en wolof sur le mot « partager » (texte et fichier audio), puis une aide sur la consigne de l'exercice. Les deux sont « à relire ». La page de relecture lui est refusée.
3. L'élève entend la voix de l'encadreur. **Aucune aide wolof n'apparaît encore.**
4. Le relecteur écoute l'enregistrement, corrige le texte et valide les deux contenus. La liste des élèves lui est refusée.
5. **T7** : l'élève ouvre « Aide en wolof », lit le texte corrigé et écoute l'enregistrement. L'aide apparaît aussi sur l'exercice.
6. Une évaluation « français obligatoire » contenant cet exercice est publiée : l'aide disparaît de l'évaluation **et** de l'exercice. L'aide sur la leçon reste disponible.

## 4. Mise en ligne (complément)

La migration 7 crée le compartiment privé « audio » dans Supabase Storage, avec ses règles d'accès. Sur Supabase hébergé, rien à faire de plus. L'environnement local intègre désormais le service officiel de stockage (`supabase/storage-api`).

## 5. Limites et décisions

| Sujet | Détail |
|---|---|
| **Assistant bilingue (IA)** | Il fait partie de la Phase 6 (intelligence artificielle). Tout est prêt pour l'accueillir : ce que produira l'IA sera enregistré avec l'origine « IA » et passera **obligatoirement** par la relecture wolof. La base l'impose déjà et c'est testé |
| **Synthèse vocale en wolof** | Non activée. Les modèles repérés en Phase 0 sont de qualité inégale, notamment sur les nombres et les mots français. Les **enregistrements humains** restent la règle |
| Orthographe et terminologie | À la charge des relecteurs (orthographe officielle du wolof ; terminologie scolaire du projet SENTERMINO, documents M10 et M11 de la Phase 0) |
| Enregistrement sur iPhone | Pris en charge (format mp4) mais pas testé sur un appareil réel. Le public visé utilise surtout Android, qui est testé |
| Les boutons 🔊 de chaque bloc | Utilisent encore la voix de synthèse. L'enregistrement de l'encadreur couvre la leçon entière |

## 6. Prochaine étape : Phase 6 (intelligence artificielle)

Elle comprendra :
- un assistant pédagogique pour les encadreurs : préparation de leçons, d'exercices et d'évaluations, analyse des résultats, aide au diagnostic, brouillons de bilans ;
- un assistant bilingue : explication en français, puis proposition en wolof **soumise à la relecture** ;
- des indices pour les élèves, **sans jamais donner la réponse** ;
- des conseils pour les parents.

La clé de l'API restera sur le serveur, et le nom des enfants ne sera jamais envoyé au fournisseur d'IA. **Décision à prendre : le fournisseur d'IA**, avec le budget associé.
