# TERANGA ÉDUCATION — Phase 1.3 : architecture technique et sécurité

> Version 1.0, 20 novembre 2026.

---

## 1. Vue d'ensemble

```
                 ┌──────────────────────────────────────────┐
 Téléphone       │  Application web installable (PWA)       │
 Android / PC    │  React + TypeScript + Tailwind           │
                 │  ├─ Service Worker (cache, hors-ligne)   │
                 │  └─ IndexedDB : leçons, audios, file     │
                 │     d'envois en attente                  │
                 └───────────────┬──────────────────────────┘
                                 │ HTTPS uniquement
                 ┌───────────────▼──────────────────────────┐
                 │  Supabase                                │
                 │  ├─ Auth : comptes, sessions             │
                 │  ├─ PostgreSQL : 54 tables + RLS + audit │
                 │  ├─ Storage privé : audios, copies       │
                 │  └─ Edge Functions (serveur) :           │
                 │       • création des comptes (admin)     │
                 │       • passerelle IA  ──► fournisseur IA│
                 │       • exports Excel / PDF              │
                 │       • notifications push / SMS (V2)    │
                 └──────────────────────────────────────────┘
```

**Principe directeur** : l'application dans le navigateur n'est jamais digne de confiance. Toute règle importante (droits, notes, validation, conflits) est vérifiée **sur le serveur ou dans la base**.

## 2. Choix techniques confirmés

| Brique | Choix | Version cible | Pourquoi (en clair) |
|---|---|---|---|
| Langage | TypeScript | 5.x | Le code est vérifié avant d'être exécuté ; moins de bugs en production |
| Interface | React + Vite | React 18, Vite 5 | Écosystème le plus répandu ; démarrage rapide de l'application |
| Style | Tailwind CSS | 3.x | Pages légères, adaptées au téléphone |
| Navigation | React Router | 6.x | Écrans distincts par rôle |
| Données côté client | TanStack Query + client Supabase | 5.x / 2.x | Cache et rechargement automatiques ; moins d'appels réseau |
| Formulaires | Composants maison + contrôles côté base | — | Retenu en Phase 2 : moins de dépendances ; la validation de référence reste dans la base |
| Hors-ligne | vite-plugin-pwa (Workbox) + Dexie (IndexedDB) | — | Standard du marché pour les PWA |
| Base et services | Supabase (PostgreSQL 15+) | — | Base, authentification, fichiers et fonctions serveur intégrés ; open source, donc auto-hébergeable |
| Excel | SheetJS | — | Import et export `.xlsx` |
| PDF | Génération côté serveur | — | Bilans identiques sur tous les appareils |
| Tests | Vitest, Playwright, tests SQL | — | Logique, parcours complets, droits d'accès |
| Intégration continue | GitHub Actions | — | Tests lancés automatiquement à chaque modification |

## 3. Organisation du code (à créer en Phase 2)

```
teranga-education/
├─ app/                       # application React (PWA)
│  ├─ src/
│  │  ├─ features/            # un dossier par module : eleves, groupes, seances,
│  │  │                       # lecons, corrections, suivi, remediation, messages…
│  │  ├─ espaces/             # mises en page par rôle : direction, encadreur,
│  │  │                       # parent, eleve
│  │  ├─ lib/                 # client Supabase, file hors-ligne, i18n
│  │  └─ textes/fr.ts         # tous les textes de l'interface
│  └─ tests/e2e/              # parcours Playwright (dont le scénario T)
├─ supabase/
│  ├─ migrations/             # schéma et sécurité (déjà écrits et testés)
│  ├─ functions/              # fonctions serveur (Edge Functions)
│  └─ tests/                  # tests SQL des droits
├─ phase-0/ … phase-1/        # documentation
└─ CHANGELOG.md               # journal des évolutions
```

## 4. Authentification

| Profil | Identifiant | Secret | Création du compte |
|---|---|---|---|
| Direction, coordination, encadreurs | E-mail **ou** téléphone | Mot de passe (12 caractères minimum) | Par l'admin, via une fonction serveur |
| Parents | Téléphone (+221…) | Mot de passe ; code SMS en V2 | Par l'admin, à l'inscription de l'enfant |
| Élèves CE-CM | Identifiant court (ex. `awa.n7`) | Mot de passe simple ou code-image | Par l'admin, après consentement « compte élève » |
| Élèves CI-CP | Identifiant court | **Code-image** (3 images parmi 9) | Idem, et usage recommandé en mode accompagné |

Le code-image est transformé en mot de passe avant d'être envoyé au serveur. Il n'est jamais stocké en clair. Après plusieurs essais infructueux, la connexion est bloquée (limitation d'Auth) et un encadreur doit débloquer le compte.

**Pourquoi une fonction serveur pour créer les comptes ?** Créer un compte demande la clé « administrateur » de Supabase. Cette clé ne doit jamais se trouver dans l'application. La fonction vérifie que l'appelant est bien admin, crée le compte, attribue le rôle et journalise l'opération.

## 5. Mode hors-ligne (V1)

| Élément | Hors-ligne | Raison |
|---|---|---|
| Consulter leçons, audios, exercices déjà téléchargés | ✅ | Usage principal à la maison, avec une connexion irrégulière |
| Répondre aux exercices | ✅, mis en file d'attente | Chaque envoi porte un identifiant unique (`client_id`) : un renvoi ne crée pas de doublon (testé, RG16) |
| Voir sa note | Dernière note connue | — |
| Corriger, administrer, publier | ❌ connexion requise | Évite les conflits entre deux personnes modifiant la même donnée |

Le téléchargement des audios et vidéos se fait **à la demande** (bouton « Télécharger pour plus tard »), pour ne pas consommer le forfait des familles sans leur accord.

## 6. Passerelle d'intelligence artificielle (Phase 6)

```
Encadreur ──► Edge Function « ia » ──► fournisseur IA (clé secrète côté serveur)
                 │
                 ├─ 1. vérifie le rôle et le quota
                 ├─ 2. PSEUDONYMISE : aucun nom, aucune date de naissance,
                 │     aucun identifiant ; « Élève CE2 #A »
                 ├─ 3. ajoute le contexte : objectif, niveau, extrait du
                 │     référentiel VALIDÉ (jamais d'invention de programme)
                 ├─ 4. enregistre la demande dans ai_requests
                 └─ 5. renvoie un résultat marqué « à valider »
```

- Le fournisseur est **interchangeable** : un seul fichier serveur à adapter.
- Tout ce qui sort de l'IA (exercice, explication wolof, diagnostic, bilan) est enregistré avec `origin = 'ia'`. Ce contenu **reste invisible** pour l'élève et le parent tant qu'un humain ne l'a pas validé. Les tests le vérifient déjà pour le wolof.
- Pour l'élève, l'IA ne donne que des **indices** : jamais la réponse d'un exercice noté.

## 7. Sécurité et protection des enfants

### 7.1 Défense en profondeur

| Couche | Mesure |
|---|---|
| Transport | HTTPS obligatoire (HSTS) |
| Authentification | Mots de passe robustes pour le personnel ; sessions expirantes ; limitation des tentatives |
| Autorisation | **RLS sur 100 % des tables** (54 tables, 126 règles), vérifiée par des tests ; fonctions d'autorisation centralisées |
| Données sensibles | Corrigés dans une table séparée ; notes calculées côté serveur ; historique de maîtrise verrouillé |
| Fichiers | Compartiments privés ; liens temporaires (quelques minutes) ; chemins organisés par élève pour appliquer les mêmes règles que les tables |
| Secrets | Clés « administrateur » et clés IA **uniquement** dans les fonctions serveur ; jamais dans le dépôt Git |
| Traçabilité | `audit_log` alimenté automatiquement sur 16 tables sensibles ; lisible par l'admin seul |
| Sauvegardes | Quotidiennes (offre Supabase payante, ou `pg_dump` planifié) ; **test de restauration** en Phase 7 |

### 7.2 Mesures spécifiques aux enfants

- Aucun profil public, aucune page publique, aucun classement entre élèves, aucune publicité, **aucun traceur tiers** (pas de Google Analytics ni de pixel publicitaire).
- Les élèves n'ont **pas de messagerie libre** : seulement « J'ai besoin d'aide », qui va à l'encadreur.
- Les échanges sont toujours rattachés à un élève et lisibles par la coordination.
- Les enregistrements de voix d'élèves (exercices oraux) nécessitent le consentement `audio_voix`.

### 7.3 Liste de contrôle « loi 2008-12 / CDP » (avant toute donnée réelle)

| # | Point | Statut |
|---|---|---|
| L1 | Identifier le responsable de traitement (le centre) et désigner un référent données | À faire (promoteur) |
| L2 | Accomplir les formalités préalables auprès de la CDP (déclaration ou autorisation : à confirmer auprès d'elle, document M12) | À faire |
| L3 | Choisir l'hébergement définitif ; si hors du Sénégal, vérifier le régime du **transfert international** | À décider avant la production |
| L4 | Rédiger la notice d'information aux parents et les textes de consentement (versionnés dans `consents.text_version`) | Phase 2 (je fournis un projet, à faire relire par un juriste) |
| L5 | Procédure d'accès, de rectification et d'effacement | Phase 2 (suppression en cascade prévue dans le schéma) |
| L6 | Durées de conservation (par exemple : dossier conservé N années après le départ de l'élève, puis anonymisé) | À décider |
| L7 | Contrats avec les sous-traitants (hébergeur, fournisseur IA, SMS) | Avant la production |
| L8 | Registre des traitements | Phase 7 |

> Je ne suis pas juriste : cette liste sert à préparer l'échange avec la CDP ou un conseil, elle ne le remplace pas.

## 8. Environnements

| Environnement | Données | Usage |
|---|---|---|
| Local (développeur) | Fictives, générées par script | Développement et tests automatiques |
| Démonstration | Fictives | Démonstrations au promoteur, tests sur téléphones réels |
| Production | Réelles | **Uniquement après** la Phase 7 et la liste de contrôle CDP |

## 9. Stratégie de test

| Niveau | Outil | Exemple | Quand |
|---|---|---|---|
| Base de données | SQL (`supabase/tests`) | « Le parent 2 ne voit pas l'enfant du parent 1 » | ✅ déjà en place, 51 vérifications |
| Logique | Vitest | Calcul de l'identifiant, file hors-ligne | Dès la Phase 2 |
| Parcours | Playwright, profils téléphone et PC | Scénario T rejoué dans l'interface | Dès la Phase 2 |
| Accessibilité / performance | axe-core, Lighthouse | Poids de page, contrastes | Phases 2 à 7 |
| Sécurité | Revue de code, tests d'accès croisés | Tentatives d'accès entre rôles | Phase 7 |

## 10. Plan de la Phase 2 (prochaine étape)

1. Initialiser l'application (React, TypeScript, Tailwind, PWA) et l'intégration continue.
2. Créer le projet Supabase de démonstration et y appliquer les migrations testées.
3. Écrire la fonction serveur de création des comptes.
4. Écrans de connexion (3 variantes) et tableaux de bord vides par rôle.
5. Gestion des élèves, des parents (avec liens et consentements), des encadreurs et des groupes.
6. Séances et présences simples.
7. Tests Playwright des étapes T1 à T4 sur téléphone et sur PC.

**Pour démarrer la Phase 2, j'aurai besoin de** : un compte Supabase (gratuit pour le prototype) dont vous gardez la propriété. Je vous guiderai pas à pas pour le créer, et vous me donnerez ensuite accès au projet de façon sécurisée, **jamais en collant une clé dans la conversation**.
