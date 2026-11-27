# TERANGA ÉDUCATION — Phase 6 : assistant pédagogique (intelligence artificielle)

> Version 0.6, 27 novembre 2026. Données de test **fictives**.
> **Tous les tests ont été faits en mode « simulation »** : réponses fabriquées, sans IA réelle ni coût, marquées « [Simulation] ». Le branchement vers l'IA réelle est écrit et vérifié par le compilateur, mais **n'a pas encore été essayé avec une vraie clé**. C'est la première chose à faire lors de la mise en ligne (§ 4).

## 1. Ce que fait l'assistant

| Pour qui | Fonction | Ce qui est enregistré |
|---|---|---|
| Encadreur | **Proposer un plan de leçon** (explication, exemples, activité, à retenir) | Inséré dans l'éditeur, non enregistré tant que l'encadreur ne sauvegarde pas |
| Encadreur | **Proposer des exercices** (1 à 5, difficulté choisie) : QCM ou réponse courte, avec corrigé et correction expliquée | Exercices en **brouillon**, marqués « proposé par l'IA ». Invisibles pour les élèves tant qu'un humain ne les a pas validés |
| Encadreur | **Analyser les résultats** d'un élève (constats, hypothèses, pistes), y compris dans le diagnostic d'un objectif | Rien : simple avis affiché |
| Encadreur | **Pré-remplir un bilan** | Brouillon dans le formulaire ; l'encadreur relit et décide d'envoyer |
| Encadreur, relecteur | **Assistant bilingue** : reformulation en français simple, puis proposition en wolof | Explication wolof **« à relire »** : passage obligatoire par le relecteur (règle de la base, Phase 5) |
| Élève | **Un indice** sur un exercice d'entraînement (2 au maximum par exercice, réglable) | Jamais pendant une évaluation, et **jamais la réponse** (voir § 2) |
| Parent | **Comprendre les résultats et aider mon enfant** : explication simple et conseils pour la maison | Rien : simple avis affiché |

Chaque proposition apparaît dans un cadre violet « ✨ Proposition de l'assistant » qui rappelle : *« Proposition automatique, à vérifier. Aucune décision n'est prise par l'assistant. »*

## 2. Protections

| Protection | Comment | Testée |
|---|---|---|
| **Aucun nom d'enfant envoyé** | Prénoms, noms, téléphones et e-mails sont retirés avant l'envoi, y compris dans les observations. Une **vérification finale bloque l'envoi** si un nom subsiste | ✅ unitaires + parcours (contrôle du texte réellement prévu pour l'envoi) |
| **Transparence** | Le journal conserve le texte exact transmis au fournisseur ; la direction peut le consulter | ✅ |
| **Pas de réponse dans un indice** | Consigne explicite donnée à l'IA, **puis filtre automatique** : si l'indice contient le résultat (« 4 », « quatre »…), il est remplacé par un indice générique | ✅ unitaires |
| **Pas d'indice en évaluation** | La base refuse tout indice sur un exercice faisant partie d'une évaluation publiée à l'élève | ✅ SQL |
| **Rien de publié sans humain** | Exercices en brouillon, wolof « à relire », bilans en brouillon | ✅ parcours |
| **Droits** | L'assistant lit les données **avec les droits de l'utilisateur** : un encadreur n'analyse que ses élèves, un parent que son enfant | ✅ |
| **Réponses vérifiées** | Format imposé à l'IA (réponse structurée), puis contrôle : un QCM sans bonne réponse ou un exercice incohérent est écarté | ✅ unitaires |
| **Budget maîtrisé** | Quotas quotidiens par personne selon le rôle, réglables par la direction ; désactivation complète possible ; statistiques d'utilisation sur 30 jours | ✅ parcours (quota parent atteint) |
| **Clé secrète** | Uniquement sur le serveur, jamais dans le navigateur | ✅ (architecture) |
| **Journal** | Chaque appel est noté : qui, quoi, quand, durée, jetons consommés, échec éventuel. Les utilisateurs ne peuvent ni écrire ni modifier ce journal | ✅ SQL |

## 3. Choix techniques

| Élément | Choix | Pourquoi |
|---|---|---|
| Fournisseur par défaut | **Anthropic (Claude)**, via le kit officiel `@anthropic-ai/sdk` | Réponses structurées garanties, repli automatique en cas de refus |
| Modèle par défaut | **Claude Opus 5.5** (`claude-opus-5-5`) | Le plus fiable pour du contenu pédagogique et du wolof. **Modifiable sans toucher au code** (variable `TERANGA_IA_MODELE`) |
| Repli automatique | Activé (`fallbacks: "default"`) | Si les filtres de sécurité déclinent une demande, un autre modèle reprend automatiquement |
| Effort de réflexion | Faible pour les indices et les conseils aux parents, moyen pour le reste | Rapidité et coût là où la tâche est simple |
| Interchangeable | Tout passe par un seul fichier (`supabase/functions/assistant-ia/fournisseurs.ts`) | Changer de fournisseur ne touche pas le reste de l'application |
| Mode simulation | Par défaut sans clé ; obligatoire en local | Développer et tester sans coût ni donnée envoyée |

### Ordre de grandeur des coûts (estimation, à confirmer par l'usage réel)

Une demande type compte environ 1 500 jetons envoyés et 1 000 reçus, réflexion comprise ; c'est une estimation qui peut varier.

| Modèle | Prix (envoyés / reçus, par million de jetons) | Coût estimé d'une demande | 1 000 demandes par mois |
|---|---|---|---|
| Claude Opus 5.5 (par défaut) | 4 $ / 20 $ | ≈ 0,026 $ (≈ 16 F CFA) | ≈ 26 $ |
| Claude Haiku 5.5 (plus économique) | 0,10 $ / 0,50 $ | ≈ 0,0007 $ | < 1 $ |

**Le choix du modèle vous appartient.** Je recommande de démarrer avec Opus 5.5 pour juger la qualité, notamment en wolof, puis de mesurer avant de passer à un modèle moins cher. Les quotas protègent le budget dans tous les cas.

## 4. Activer l'IA réelle (lors de la mise en ligne)

1. Créer un compte sur la console Anthropic et une clé d'API. **Ne jamais la coller dans une conversation.**
2. Dans Supabase › Edge Functions › Secrets, ajouter `ANTHROPIC_API_KEY` (la clé) et `TERANGA_IA_FOURNISSEUR=anthropic`. Facultatif : `TERANGA_IA_MODELE`.
3. Déployer la fonction `assistant-ia` ; le dossier `shared/` est à copier comme pour `admin-users`.
4. Dans Paramètres › Assistant IA, vérifier que le fournisseur affiché est « Anthropic (Claude) », puis faire un essai de chaque fonction **avec des données fictives**.
5. Faire relire par votre relecteur wolof une dizaine de propositions, pour juger leur qualité avant tout usage avec des élèves.

**Données personnelles** : le fournisseur d'IA est un sous-traitant. Les données envoyées sont pseudonymisées, mais il faut l'inscrire dans la liste de contrôle CDP de la Phase 1 (point L7 : contrats avec les sous-traitants ; point L3 : transfert hors du Sénégal).

## 5. Résultats des tests

| Niveau | Résultat |
|---|---|
| Base de données (SQL) | **92 / 92** ✅ |
| Logique (Vitest), dont pseudonymisation, filtre d'indices, vérification des réponses de l'IA | **64 / 64** ✅ |
| Parcours complets (PC + Android), phases 2 à 6 | **16 / 16** ✅, deux exécutions consécutives |
| Vérification des types des fonctions serveur (dont le kit Anthropic) | ✅ |

### Défauts trouvés et corrigés pendant cette phase

| Défaut | Correction |
|---|---|
| La détection des e-mails avalait le point final d'une phrase | Expression corrigée, avec un test |
| **Sur téléphone, la page Paramètres débordait horizontalement**, à cause des champs groupés et des tableaux dans les grilles | Correctif global ; le test anti-débordement couvre maintenant **16 pages** au lieu de 6 |
| La file de relecture wolof n'indiquait pas la leçon d'une aide sur un exercice | Titre de la leçon affiché |

## 6. Limites

- **IA réelle non testée** : voir l'avertissement en tête et le § 4.
- La qualité du **wolof produit par l'IA** est inconnue tant qu'elle n'a pas été évaluée par votre relecteur. C'est pourquoi la relecture est obligatoire.
- Les indices ne sont pas lus à voix haute ; le bouton 🔊 de la consigne reste disponible.
- Pas d'assistant en conversation libre : par choix de sécurité pour les enfants, l'assistant ne répond qu'à des demandes encadrées.

## 7. Prochaine étape : Phase 7 (tests et déploiement)

Elle couvrira :
- des tests sur de vrais téléphones Android et de vrais PC ;
- une revue de sécurité, dont le masquage de la note automatique avant correction, repéré en Phase 3 ;
- des tests de sauvegarde et de restauration ;
- le mode hors connexion ;
- le blocage temporaire après des erreurs répétées de code-image ;
- la mise en ligne en HTTPS sur Supabase, avec votre compte.
