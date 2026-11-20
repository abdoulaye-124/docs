# Journal des évolutions — TERANGA ÉDUCATION

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
