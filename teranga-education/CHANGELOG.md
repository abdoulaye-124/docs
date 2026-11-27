# Journal des évolutions — TERANGA ÉDUCATION

## 2026-11-27 — Phase 7 : tests, sécurité et préparation de la mise en ligne (v0.7.0)

- Cadre zéro frais : assistant IA désactivé sans clé (boutons masqués), connexion par téléphone sans SMS (identifiant technique), hébergement gratuit prévu (Supabase Free, Cloudflare Pages).
- Sécurité : note automatique illisible par élèves et parents (migration 9, `auto_scores`), contrôles globaux RLS / droits anonymes / search_path, en-têtes de sécurité, React Router 7.18.5 (0 vulnérabilité), audit des dépendances en intégration continue.
- Mode hors connexion pour les élèves : cache local, file d'envoi sans doublon, bandeau, ouverture sans réseau de l'application installée.
- Accessibilité : analyse axe-core WCAG A/AA sur 13 écrans (PC et Android), 0 violation grave.
- Sauvegarde chiffrée et restauration (base + audio), testées de bout en bout ; procédure de déploiement manuelle (GitHub Actions) ; code partagé dans `supabase/functions/_shared`.
- Tests : 101 SQL, 75 unitaires, 20 parcours navigateur ; vérification de la version de production.

## 2026-11-27 — Phase 6 : assistant pédagogique (v0.6.0) — validée par le promoteur

- Fonction serveur `assistant-ia` : plan de leçon, exercices proposés (brouillon), analyse de résultats, brouillon de bilan, assistant bilingue (wolof en relecture), indices aux élèves (sans réponse, hors évaluation), conseils aux parents.
- Pseudonymisation avec blocage de l'envoi si un nom subsiste ; texte envoyé conservé au journal ; quotas quotidiens par rôle ; activation et statistiques dans Paramètres.
- Fournisseur interchangeable : Anthropic (Claude Opus 5.5 par défaut, kit officiel, réponses structurées, repli automatique) ou simulation (par défaut sans clé, utilisée pour tous les tests).
- Migration 8 : journal enrichi (non modifiable par les utilisateurs), réglages IA, `family_hint_allowed`, `ai_usage_today`.
- Corrigé : débordement horizontal sur téléphone (champs groupés et tableaux dans les grilles), test anti-débordement étendu à 16 pages ; détection des e-mails ; contexte de leçon dans la relecture wolof.
- Tests : 92 SQL, 64 unitaires, 16 parcours navigateur (PC et Android).

## 2026-11-23 — Phase 5 : français / wolof (v0.5.0) — validée par le promoteur

- Enregistrement audio au micro ou dépôt de fichier (Opus 24 kb/s, 3 min max), stockage privé, lecture à la demande par lien temporaire.
- Lecture de la leçon par la voix de l'encadreur ; explications complémentaires en wolof (notion, mot, consigne, problème) sur leçons et exercices.
- Rôle « relecteur wolof » ; file de relecture avec correction du texte ; validation réservée au relecteur et à la coordination.
- Aide en wolof pour l'élève ; masquage en évaluation et pour les exercices d'évaluations « français obligatoire ».
- Migrations 6 (rôle) et 7 (règles audio et wolof, compartiment de stockage « audio ») ; service de stockage officiel ajouté à l'environnement local.
- Tests : 86 SQL, 48 unitaires, 14 parcours navigateur (PC et Android, micro simulé).

## 2026-11-20 — Phase 4 : suivi et remédiation (v0.4.0) — validée par le promoteur

- Dossier pédagogique : synthèse au départ / maintenant, tableau de progression (frise, tendance), ajustement justifié du niveau, observations internes ou partagées, bilans (pré-remplis, envoyés, figés, imprimables).
- Élèves en difficulté, diagnostic par les prérequis, programmes de remédiation proposés par règles, modifiables, validés par l'encadreur, lancés, suivis et clôturés avec mesure avant / après.
- Notifications aux familles (programme validé, bilan envoyé) ; étoiles de progrès pour l'élève.
- Migration 5 : `propose_remediation`, `start_remediation`, `remediation_outcome`, étapes cochées automatiquement, notifications, gel des bilans envoyés.
- Tests : 74 SQL, 38 unitaires, 12 parcours navigateur (PC et Android).
- Corrigé : sélection des exercices de remédiation, exercice republié non reproposé, bilan envoyé directement non notifié.

## 2026-11-20 — Phase 3 : module pédagogique (v0.3.0) — validée par le promoteur

- Référentiel : versions, hiérarchie libre, prérequis, sources et authentification ; référentiel provisoire de démonstration (5 objectifs de mathématiques, non officiels).
- Leçons en blocs, exercices (QCM, réponse courte, production libre) avec correction expliquée, évaluations, publication, file de correction avec notes automatiques proposées.
- Espace élève : leçons avec lecture audio, exercices et évaluations, résultats. Parent : résultats et corrections expliquées.
- Migration 4 : `correction_feedback` (correction expliquée visible seulement après correction), audit des corrigés, règle RG14 (pas d'objectif « vérifié » sans source authentifiée).
- Tests : 58 SQL, 32 unitaires, 10 parcours navigateur (PC et Android).
- Corrigé : fenêtre modale refermée par erreur lors d'une réouverture rapide ; message de confirmation perdu après redirection.

## 2026-11-20 — Phase 2 : premier prototype (v0.2.0)

- Application web installable (React 18, TypeScript, Tailwind, PWA) : connexion en 3 modes (personnel, parent par téléphone, élève par code-image), tableaux de bord par rôle, élèves, parents et consentements, personnel, comptes élèves, groupes, séances avec détection des conflits, présences, paramètres.
- Fonction serveur `admin-users` : création et gestion des comptes, clé secrète côté serveur uniquement.
- Migration 3 : identifiant de connexion de l'élève (`students.login_id`).
- Environnement local identique à Supabase (PostgreSQL, GoTrue, PostgREST, passerelle Deno).
- Tests : 24 tests unitaires, 8 parcours navigateur (PC et Android), 51 tests SQL ; intégration continue GitHub Actions (SQL, types, tests unitaires, compilation).
- Corrigé : redémarrage incomplet de la passerelle locale ; tableau des présences tronqué.
- Validée par le promoteur.

## 2026-11-20 — Phase 1 : cahier des charges et architecture

- Cahier des charges : 20 modules priorisés, matrice des droits, 16 règles de gestion, parcours par rôle, maquettes basse fidélité, exigences non fonctionnelles.
- Modèle de données : migrations PostgreSQL / Supabase (54 tables, 126 politiques RLS, audit automatique, calcul de maîtrise, détection des conflits de séances).
- Tests SQL : scénario de validation T (14 étapes) et cloisonnement, 51 vérifications réussies.
- Défauts trouvés par les tests et corrigés :
  - politiques de lecture des publications et conversations incompatibles avec `INSERT … RETURNING` ;
  - ordre ambigu de l'historique de maîtrise pour des enregistrements simultanés (ajout de `seq`).
- Décisions par défaut D1 à D6 consignées (cahier des charges §0).

## 2026-11-20 — Phase 0 : étude documentaire

- Inventaire des référentiels repérés, des documents manquants (M1 à M13), et propositions d'organisation, de modèle pédagogique et d'architecture.
- Validée par le promoteur.
