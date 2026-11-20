# Journal des évolutions — TERANGA ÉDUCATION

## 2026-11-20 — Phase 2 : premier prototype (v0.2.0)

- Application web installable (React 18, TypeScript, Tailwind, PWA) : connexion en 3 modes (personnel, parent par téléphone, élève par code-image), tableaux de bord par rôle, élèves, parents et consentements, personnel, comptes élèves, groupes, séances avec détection des conflits, présences, paramètres.
- Fonction serveur `admin-users` : création et gestion des comptes, clé secrète côté serveur uniquement.
- Migration 3 : identifiant de connexion de l'élève (`students.login_id`).
- Environnement local identique à Supabase (PostgreSQL, GoTrue, PostgREST, passerelle Deno).
- Tests : 24 tests unitaires, 8 parcours navigateur (PC et Android), 51 tests SQL ; intégration continue GitHub Actions (SQL, types, tests unitaires, compilation).
- Corrigé : redémarrage incomplet de la passerelle locale ; tableau des présences tronqué.

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
