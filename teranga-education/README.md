# TERANGA ÉDUCATION

Plateforme de gestion d'un centre d'accompagnement, de remédiation et de réussite scolaire, du CI au CM2 (Sénégal).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0 | Étude documentaire | ✅ Validée par le promoteur |
| 1 | Cahier des charges et architecture | ✅ Validée par le promoteur |
| 2 | Premier prototype (comptes, élèves, parents, groupes, séances) | ✅ Validé par le promoteur |
| 3 | Module pédagogique (référentiel, leçons, exercices, évaluations, corrections) | ✅ Validé par le promoteur |
| 4 | Suivi et remédiation (dossier, progression, diagnostic, programmes, bilans) | ✅ Validé par le promoteur |
| 5 | Français / wolof (audio, explications, relecture) | ✅ Validé par le promoteur |
| 6 | Assistant pédagogique (IA) | ✅ Validé par le promoteur (testé en simulation) |
| 7 | Tests, sécurité, hors connexion, sauvegardes, préparation de la mise en ligne (zéro frais) | ✅ Livré, en attente de validation ; mise en ligne à faire ensemble |

## Documents

- [Phase 0 : étude documentaire](PHASE-0-etude-documentaire.md)
- [Phase 1.1 : cahier des charges fonctionnel](phase-1/01-cahier-des-charges.md)
- [Phase 1.2 : modèle de données](phase-1/02-modele-de-donnees.md)
- [Phase 1.3 : architecture technique et sécurité](phase-1/03-architecture-et-securite.md)
- [Phase 2 : premier prototype](phase-2/README.md)
- [Phase 3 : module pédagogique](phase-3/README.md)
- [Phase 4 : suivi et remédiation](phase-4/README.md)
- [Phase 5 : français / wolof](phase-5/README.md)
- [Phase 6 : assistant pédagogique (IA)](phase-6/README.md)
- [Phase 7 : tests, sécurité et mise en ligne](phase-7/README.md)
- [Journal des évolutions](CHANGELOG.md)

## Code

- `app/` : application web installable (React, TypeScript, Tailwind, PWA).
- `supabase/functions/` : fonctions serveur (création sécurisée des comptes, assistant IA).
- `supabase/functions/_shared/` : règles communes à l'application et au serveur (identifiants, assistant IA).
- `dev/` : environnement local identique à Supabase (voir [Phase 2 §3](phase-2/README.md)) et tests de sauvegarde.
- `ops/` : sauvegarde chiffrée, restauration, premier administrateur (voir [Phase 7](phase-7/README.md)).

## Base de données

- `supabase/migrations/` : schéma (54 tables), règles de sécurité (RLS) et évolutions.
- `supabase/seed/` : référentiel **provisoire, non officiel** de démonstration.
- `supabase/tests/` : tests du scénario de validation et des droits d'accès (101 vérifications).

```bash
cd supabase && ./tests/run_tests.sh   # PostgreSQL 15+ local requis
```

> Toutes les données de test sont **fictives**. Aucun élément du référentiel n'est présenté comme officiel tant qu'il n'a pas été vérifié sur un document authentifié.
