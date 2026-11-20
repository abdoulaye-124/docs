# TERANGA ÉDUCATION

Plateforme de gestion d'un centre d'accompagnement, de remédiation et de réussite scolaire, du CI au CM2 (Sénégal).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0 | Étude documentaire | ✅ Validée par le promoteur |
| 1 | Cahier des charges et architecture | ✅ Validée par le promoteur |
| 2 | Premier prototype (comptes, élèves, parents, groupes, séances) | ✅ Validé par le promoteur |
| 3 à 7 | Pédagogie, suivi, wolof, IA, tests et déploiement | À venir |

## Documents

- [Phase 0 : étude documentaire](PHASE-0-etude-documentaire.md)
- [Phase 1.1 : cahier des charges fonctionnel](phase-1/01-cahier-des-charges.md)
- [Phase 1.2 : modèle de données](phase-1/02-modele-de-donnees.md)
- [Phase 1.3 : architecture technique et sécurité](phase-1/03-architecture-et-securite.md)
- [Phase 2 : premier prototype](phase-2/README.md)
- [Journal des évolutions](CHANGELOG.md)

## Code

- `app/` : application web installable (React, TypeScript, Tailwind, PWA).
- `supabase/functions/` : fonctions serveur (création sécurisée des comptes).
- `shared/` : règles communes à l'application et au serveur (téléphones, identifiants).
- `dev/` : environnement local identique à Supabase (voir [Phase 2 §3](phase-2/README.md)).

## Base de données

- `supabase/migrations/` : schéma (54 tables), règles de sécurité (RLS) et évolutions.
- `supabase/tests/` : tests du scénario de validation et des droits d'accès (51 vérifications).

```bash
cd supabase && ./tests/run_tests.sh   # PostgreSQL 15+ local requis
```

> Toutes les données de test sont **fictives**. Aucun élément du référentiel n'est présenté comme officiel tant qu'il n'a pas été vérifié sur un document authentifié.
