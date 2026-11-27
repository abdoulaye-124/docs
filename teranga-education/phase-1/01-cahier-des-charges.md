# TERANGA ÉDUCATION — Phase 1.1 : cahier des charges fonctionnel

> Version 1.0, 20 novembre 2026. Fait suite à la Phase 0, validée par le promoteur.
> Documents liés : [02 — Modèle de données](02-modele-de-donnees.md) · [03 — Architecture et sécurité](03-architecture-et-securite.md)

---

## 0. Décisions retenues par défaut

Vous avez validé la Phase 0 sans répondre aux questions de sa section 10. J'ai donc appliqué les options recommandées. **Chacune reste modifiable** :

| # | Sujet | Décision par défaut | Impact si vous changez d'avis |
|---|---|---|---|
| D1 | Ordre de construction | Scénario de validation T de bout en bout d'abord, puis enrichissement administratif | Faible : seul l'ordre des tâches change |
| D2 | Hébergement du prototype | Supabase cloud, **données fictives uniquement** | Aucun : le schéma est du PostgreSQL standard |
| D3 | Connexion des parents | Téléphone + mot de passe ; SMS de vérification plus tard | Faible |
| D4 | Connexion des jeunes élèves | Identifiant court + code-image, comptes créés par le centre | Faible |
| D5 | Validation des contenus | L'auteur humain d'une leçon peut la valider ; la coordination peut tout revoir ; **tout contenu IA ou de synthèse vocale exige une validation humaine** | Moyen : on peut imposer la validation par la coordination via un paramètre |
| D6 | Seuils de maîtrise | < 50 % non acquis · 50 à 79 % en cours · ≥ 80 % sur au moins 2 évaluations = acquis (5 dernières corrections) | Aucun : réglable dans les paramètres |

**Questions toujours ouvertes** (non bloquantes pour la Phase 2) : qui valide le wolof ; la taille du centre au démarrage ; l'obtention des documents officiels M1, M2, M3, M7 et M12.

---

## 1. Périmètre fonctionnel

Priorité : **MVP** = prototype de validation (scénario T) · **V1** = première version en service · **V2** = évolutions.

| Code | Module | Contenu | Priorité |
|---|---|---|---|
| F01 | Comptes et rôles | Connexion, 5 rôles cumulables, désactivation, réinitialisation du mot de passe par l'admin | MVP |
| F02 | Inscriptions et dossiers élèves | Fiche élève, identifiant TE-AAAA-NNNN, encadreur référent, archivage | MVP |
| F03 | Parents | Compte parent, lien parent-enfant **validé**, contact autorisé, consentements | MVP |
| F04 | Encadreurs | Fiche, spécialités, niveaux | MVP |
| F05 | Groupes | Groupes principaux (1 par élève) et groupes de remédiation (durée limitée) | MVP |
| F06 | Séances et présences | Création, participants, lieu ou lien, présences, observations, **détection des conflits** | MVP (simple) puis V1 (calendrier complet) |
| F07 | Référentiel | Sources documentaires avec statut, versions, arbre de compétences, prérequis | MVP (saisie provisoire) puis V1 (référentiel authentifié) |
| F08 | Leçons et exercices | Éditeur de leçons en blocs, exercices (QCM, réponse courte, production libre, oral, photo du cahier), corrigés protégés, publication | MVP |
| F09 | Évaluations et corrections | Évaluations diagnostiques, formatives et sommatives ; file de correction ; score automatique proposé | MVP |
| F10 | Dossier pédagogique | Historique de maîtrise, tableau de progression, observations, bilans | MVP (maîtrise) puis V1 (bilans PDF) |
| F11 | Remédiation | Alerte, prérequis, plan proposé puis validé, étapes, mesure avant/après | MVP |
| F12 | Français / wolof | Audio FR, explications wolof (texte et audio), circuit de validation | MVP (audio enregistré) puis V1 (bibliothèque) puis V2 (synthèse vocale) |
| F13 | Messagerie encadrée | Conversations rattachées à un élève, entre parents et encadreurs affectés | V1 |
| F14 | Notifications | Dans l'application (MVP), push (V1), SMS / WhatsApp Business (V2) | MVP / V1 / V2 |
| F15 | Tableaux de bord | Direction, encadreur, parent, élève | MVP (simples) puis V1 |
| F16 | Assistant IA | Préparation, génération d'exercices, analyse, bilans, aide wolof ; tout « à valider » | V1 (phase 6) |
| F17 | Espace CFEE | Cadre d'examen paramétré, examens blancs, statistiques | V1, **dès réception des arrêtés (M7)** |
| F18 | Imports et exports | Import et export Excel des élèves ; bilans PDF | V1 |
| F19 | Mode hors-ligne | Leçons, audios et exercices disponibles hors connexion ; envoi différé | V1 |
| F20 | Administration | Paramètres, journal d'audit, sauvegardes, droits d'accès et d'effacement | MVP (audit) puis V1 |

---

## 2. Matrice des droits

✅ autorisé · 👁 lecture seule · ◐ limité à son périmètre · ❌ interdit

| Action | Admin | Coordinateur | Encadreur | Parent | Élève |
|---|---|---|---|---|---|
| Créer les comptes, attribuer les rôles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inscrire / supprimer un élève | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier un dossier administratif, changer le référent | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lier un parent à un enfant (validation) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Enregistrer / retirer un consentement | ✅ | ❌ | ❌ | ◐ ses enfants | ❌ |
| Créer groupes, affectations, séances | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir un dossier élève | ✅ | ✅ | ◐ élèves affectés | ◐ ses enfants | ◐ le sien |
| Saisir les présences | ✅ | ✅ | ◐ ses séances | ❌ | ❌ |
| Modifier le référentiel officiel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Créer leçons et exercices | ✅ | ✅ | ✅ | ❌ | ❌ |
| Lire les corrigés | ✅ | ✅ | ✅ | ❌ | ❌ |
| Publier | ✅ | ✅ | ◐ vers ses groupes / élèves, contenu validé | ❌ | ❌ |
| Répondre à un exercice | ❌ | ❌ | ◐ saisie d'une copie papier | ❌ | ◐ exercices publiés pour lui |
| Corriger, fixer un niveau de maîtrise | ✅ | ✅ | ◐ élèves affectés (justification obligatoire) | ❌ | ❌ |
| Proposer / valider une remédiation | ✅ | ✅ | ◐ élèves affectés | 👁 une fois validée | 👁 une fois validée |
| Bilans | ✅ | ✅ | ◐ rédaction | 👁 une fois envoyés | 👁 une fois envoyés |
| Messagerie | 👁 tout | 👁 tout | ◐ parents de ses élèves | ◐ encadreurs de ses enfants | ❌ (demande d'aide uniquement) |
| Journal d'audit | 👁 | ❌ | ❌ | ❌ | ❌ |

Toutes ces règles sont **appliquées par la base de données** et vérifiées par des tests automatiques (voir §6 et le document 02).

---

## 3. Règles de gestion

| Code | Règle |
|---|---|
| RG01 | Un élève a **un seul groupe principal actif** à une date donnée, et autant de groupes de remédiation que nécessaire. |
| RG02 | Un encadreur n'accède à un élève que s'il en est le **référent** ou s'il **anime un groupe actif** dont l'élève est membre actif. L'accès cesse avec la fin de l'affectation. |
| RG03 | Un parent n'accède à un enfant que lorsque l'administration a **validé** le lien. |
| RG04 | Un contenu n'est visible par un élève que s'il est **validé** et **publié** pour lui ou pour son groupe. |
| RG05 | Un contenu produit par l'IA ou par la synthèse vocale porte son origine et n'est **jamais montré à un élève** sans validation humaine nominative. |
| RG06 | Une évaluation « français obligatoire » (et toujours un CFEE blanc) **masque l'aide wolof** pendant l'épreuve. |
| RG07 | Le score automatique d'un QCM ou d'une réponse courte est calculé **sur le serveur**. L'élève ne peut pas le fixer. Il n'est qu'une proposition : la note retenue est celle de la correction. |
| RG08 | Chaque correction recalcule le niveau de maîtrise des objectifs concernés et **ajoute** une ligne à l'historique, sans jamais l'écraser. |
| RG09 | Un encadreur peut corriger un niveau calculé, à condition de saisir une **justification**. Ce choix est tracé. |
| RG10 | Un plan de remédiation proposé (par les règles ou l'IA) n'a d'effet qu'après **validation par un humain identifié**. Le parent ne le voit qu'une fois validé. |
| RG11 | Une séance ne peut pas chevaucher une autre séance du **même encadreur** ou dans la **même salle**. |
| RG12 | Toute conversation porte sur **un élève**. Seuls peuvent y participer la direction, la coordination, les parents validés et autorisés, et les encadreurs affectés. |
| RG13 | Les modifications sensibles (inscriptions, liens parentaux, consentements, rôles, affectations, présences, corrections, maîtrise, remédiation, bilans, référentiel, CFEE) sont **journalisées** avec leur auteur. |
| RG14 | Un élément du référentiel reste marqué **provisoire** tant qu'il n'a pas été vérifié sur une source authentifiée. |
| RG15 | Les épreuves, coefficients et barèmes du CFEE ne peuvent être **validés** que s'ils citent leur texte officiel. |
| RG16 | Un envoi effectué hors connexion et renvoyé plusieurs fois n'est enregistré **qu'une fois**. |

---

## 4. Parcours utilisateurs

### 4.1 Scénario de validation T, et où il est traité

| Étape | Qui | Écran | Ce qui se passe dans la base |
|---|---|---|---|
| T1 | Admin | Élèves › Inscrire | `students` (code TE-AAAA-NNNN généré) |
| T2 | Admin | Parents › Nouveau, puis lier à l'élève | `profiles`, `user_roles`, `student_guardians` validé, `consents` |
| T3 | Admin | Groupes › CE2 › Ajouter | `group_members` (RG01 contrôlée) |
| T4 | Admin | Élève › Référent ; Groupe › Encadreurs | `students.referent_staff_id`, `group_staff` |
| T5 | Encadreur | Leçons › Nouvelle › Valider › Publier | `lessons`, `exercises`, `exercise_keys`, `media`, `wolof_explanations`, `publications` + notification |
| T6 | Élève | Accueil › Mes leçons | lecture filtrée par RG04 |
| T7 | Élève | Leçon › bouton wolof | `wolof_explanations` / `media` validés uniquement |
| T8 | Élève | Exercice › Valider | fonction `submit_answer()` (RG07, RG16) |
| T9 | Encadreur | À corriger | `corrections` |
| T10 | Système | — | `mastery_records` (RG08) |
| T11 | Parent | Mon enfant › Résultats | lecture filtrée par RG03 |
| T12 | Encadreur | Tableau de bord › Élèves en difficulté | vue `students_at_risk`, fonction `prerequisite_status()` |
| T13 | Encadreur | Remédiation › Proposer › Valider | `remediation_plans`, `remediation_steps`, `publications` |
| T14 | Élève + Encadreur | Exercices de remédiation, correction | nouvelles lignes `mastery_records` : non acquis → en cours → acquis |

**Ce scénario est déjà testé au niveau de la base** : voir [`supabase/tests`](../supabase/tests), 51 vérifications réussies.

### 4.2 Parcours par rôle

**Direction**
1. Première connexion : paramètres du centre, année scolaire, salles, matières.
2. Création des comptes du personnel.
3. Inscription des élèves (à l'unité ou par import Excel en V1), création et liaison des parents, enregistrement des consentements.
4. Tableau de bord : effectifs, présences, élèves en alerte, résultats par matière.
5. Administration : journal, sauvegardes, demandes d'accès ou d'effacement.

**Coordination**
1. Constitution des groupes, affectation des encadreurs, planification des séances (conflits signalés).
2. Saisie du référentiel depuis les guides authentifiés, avec les prérequis.
3. Revue des contenus « à valider ».
4. Point hebdomadaire : élèves en alerte, remédiations en cours, résultats après remédiation.

**Encadreur**
1. Accueil : séances du jour, copies à corriger, élèves en alerte, demandes d'aide.
2. Séance : appel (présences), observations.
3. Préparation : leçon (blocs), exercices progressifs, audio FR, explication wolof enregistrée, validation, publication.
4. Correction : file d'attente, score automatique proposé, note et commentaire.
5. Suivi : dossier de l'élève, prérequis, remédiation, bilan.
6. Messagerie avec les parents de ses élèves.

**Parent**
1. Connexion par téléphone. Choix de l'enfant s'il en a plusieurs.
2. Vue de l'enfant : prochaines séances, devoirs à faire, présences, compétences (3 couleurs), derniers bilans.
3. Notifications : nouvelle leçon, absence, bilan.
4. Messages avec l'encadreur.
5. Mode accompagné : il ouvre l'espace élève de son enfant sur son téléphone.

**Élève (CI-CP, très guidé ; CE-CM, plus autonome)**
1. Connexion : identifiant + 3 images, ou ouverture depuis le téléphone du parent.
2. Accueil : 4 grandes tuiles avec pictogramme et audio : *Mes leçons · Mes exercices · Mes progrès · J'ai besoin d'aide*.
3. Leçon : texte court, bouton 🔊 (français), bouton « wolof » (si disponible et autorisé).
4. Exercice : une question par écran, réponse, encouragement immédiat (sans afficher le corrigé avant la correction).
5. Mes progrès : étoiles ou couleurs par compétence, **sans aucun classement entre élèves**.

---

## 5. Écrans (maquettes basse fidélité)

Ces maquettes servent à valider l'organisation des écrans, pas leur aspect graphique. Le graphisme sera proposé en Phase 2.

### 5.1 Élève, accueil (téléphone)

```
┌─────────────────────────────┐
│  Bonjour Awa 👋        🔊    │
├──────────────┬──────────────┤
│     📖       │     ✏️       │
│  Mes leçons  │ Mes exercices│
│      (2)     │      (3)     │
├──────────────┼──────────────┤
│     ⭐       │     🙋       │
│  Mes progrès │ J'ai besoin  │
│              │   d'aide     │
└──────────────┴──────────────┘
```

### 5.2 Élève, leçon avec aide wolof

```
┌─────────────────────────────┐
│ ← La division          🔊 FR │
├─────────────────────────────┤
│ Partager 12 mangues entre   │
│ 3 enfants…                  │
│  [image]                    │
│                             │
│  ┌───────────────────────┐  │
│  │ 🗣  Wolof : ma ci wax │  │  ← masqué pendant une évaluation
│  └───────────────────────┘  │     « français obligatoire »
│                             │
│        [ Je m'exerce ▶ ]    │
└─────────────────────────────┘
```

### 5.3 Encadreur, tableau de bord (PC)

```
┌──────────────────────────────────────────────────────────────┐
│ TERANGA ÉDUCATION     Encadreur : M. Diop        🔔 3   ⎋    │
├───────────────┬──────────────────────────────────────────────┤
│ Accueil       │ Séances du jour        À corriger    Alertes │
│ Mes élèves    │ 16h00 CE2 (Salle 1)       7 copies       2   │
│ Séances       ├──────────────────────────────────────────────┤
│ Leçons        │ Élèves en difficulté                         │
│ À corriger    │ ┌────────┬───────────────────┬──────┬──────┐ │
│ Remédiation   │ │ Élève  │ Objectif          │ %    │ Act. │ │
│ Messages      │ │ Awa N. │ Division (CE2)    │ 0 %  │ [▶]  │ │
│               │ └────────┴───────────────────┴──────┴──────┘ │
└───────────────┴──────────────────────────────────────────────┘
```

### 5.4 Parent, suivi de l'enfant (téléphone)

```
┌─────────────────────────────┐
│ Awa (CE2)           ▼ autre │
├─────────────────────────────┤
│ Prochaine séance : mar. 16h │
│ Présences : 11/12           │
├─────────────────────────────┤
│ Compétences                 │
│ 🟢 Lecture …                │
│ 🟡 Division  (en cours)     │
│ 🔴 …                        │
├─────────────────────────────┤
│ Dernier bilan (nov.)   [PDF]│
│ 💬 Écrire à l'encadreur     │
└─────────────────────────────┘
```

Liste complète des écrans du MVP : connexion (3 variantes) · tableaux de bord (4 rôles) · élèves (liste, fiche, inscription) · parents · personnel · groupes · séances et présences · référentiel (sources, versions, arbre) · leçons (liste, éditeur, aperçu élève) · exercices · file de correction · dossier élève (progression) · remédiation · notifications · paramètres · journal.

---

## 6. Exigences non fonctionnelles

| Domaine | Exigence | Mesure de vérification |
|---|---|---|
| Langue | Interface entièrement en français ; textes regroupés dans un fichier unique, prêt pour d'autres langues | Revue |
| Appareils | Android 8+ (Chrome), PC (Chrome, Edge, Firefox récents), écrans à partir de 360 px de large | Tests Playwright mobile et ordinateur |
| Réseau faible | Premier chargement < 300 Ko compressés ; écran utilisable en < 5 s en 3G lente simulée | Mesure Lighthouse et Playwright |
| Hors-ligne (V1) | Leçons téléchargées consultables ; réponses mises en file et envoyées au retour du réseau, sans doublon | Test automatisé « mode avion » |
| Accessibilité | Zones tactiles ≥ 48 px pour les élèves ; contrastes suffisants ; audio sur les consignes CI-CP | Audit axe-core |
| Sécurité | RLS sur 100 % des tables ; clés secrètes uniquement côté serveur ; HTTPS ; journal d'audit | Tests SQL des droits ; revue de sécurité en Phase 7 |
| Données personnelles | Minimisation, consentement, droits d'accès et d'effacement, pseudonymisation avant l'IA | Liste de contrôle CDP (doc 03 §7) |
| Fiabilité | Sauvegarde quotidienne ; restauration testée | Test de restauration en Phase 7 |
| Qualité | Aucune fonctionnalité déclarée terminée sans test automatisé associé | Intégration continue |

---

## 7. Définition de « terminé »

Une fonctionnalité est terminée lorsque :
1. elle répond à la règle de gestion correspondante ;
2. ses droits d'accès sont couverts par un test SQL (accès autorisé **et** accès refusé) ;
3. son parcours principal est couvert par un test de bout en bout (à partir de la Phase 2) ;
4. elle fonctionne sur téléphone (360 px) et sur PC ;
5. elle est décrite dans le journal des évolutions.
