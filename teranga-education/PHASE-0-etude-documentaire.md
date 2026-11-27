# TERANGA ÉDUCATION — Phase 0 : étude documentaire et cadrage

> Centre d'accompagnement, de remédiation et de réussite scolaire, du CI au CM2 (Sénégal)
>
> Version 0.1, 20 novembre 2026. Document de travail soumis à la validation du promoteur.
> **Aucune ligne de code applicatif n'a été écrite.**

---

## 0. Avertissement sur la méthode (à lire en premier)

Pour être transparent sur ce qui a été vérifié et ce qui ne l'a pas été :

1. La recherche a été faite avec un moteur de recherche web. Les sites suivants sont **bloqués par la configuration réseau de l'environnement de développement** : `education.sn`, `vie-publique.sn`, `lecouloirdusavoir.com`, `editsoftsenegal.com`. Je n'ai donc **pas pu ouvrir et lire intégralement** les documents. J'ai seulement vu leurs titres, leurs extraits et leurs métadonnées.
2. Par conséquent, **aucun document n'est marqué « vérifié »** dans ce rapport. Le statut maximal attribué est « repéré ». Un document passera à « vérifié » quand une personne habilitée (le promoteur ou le futur responsable pédagogique) l'aura obtenu d'une source officielle et contrôlé.
3. Plusieurs guides pédagogiques circulent sur des sites tiers (Scribd, PDFCoffee, blogs d'enseignants). **Un document hébergé par un tiers n'est pas une source officielle**, même s'il porte l'en-tête « République du Sénégal ». Il faut le comparer à l'exemplaire remis par l'IEF, l'Inspection d'Académie ou le ministère.
4. Le curriculum est **en cours de révision** (voir §2.4). Tout ce qui suit doit donc être pensé pour pouvoir changer.

Légende des statuts utilisés plus bas :

| Statut | Signification |
|---|---|
| 🟢 Officiel en ligne | Publié sur un site gouvernemental (`.sn` officiel) |
| 🟡 Copie tierce | Document d'origine apparemment officielle, hébergé par un tiers : à authentifier |
| 🔵 Information secondaire | Presse, blog, site d'école : sert à orienter la recherche, jamais de référence |
| 🔴 Manquant | Recherché, non trouvé |

---

## 1. Analyse du projet

### 1.1 Ce que le projet est réellement

TERANGA ÉDUCATION n'est pas une bibliothèque de cours. C'est un **logiciel de gestion de centre** auquel on greffe un **moteur de suivi des compétences**. Le cœur de la valeur se trouve dans la boucle suivante, et c'est elle que le prototype doit démontrer :

```
Évaluer → diagnostiquer → remédier → réévaluer → informer le parent
```

Les autres éléments (leçons, audio wolof, IA, CFEE) servent cette boucle.

### 1.2 Points forts du projet

- Un vrai besoin : les apprentissages fondamentaux (lecture, calcul) conditionnent toute la suite de la scolarité. La remédiation précoce est la stratégie la plus rentable.
- La langue complémentaire (wolof) est en phase avec la politique nationale : le ministère généralise l'enseignement bilingue (MOHEBS, voir §2.5).
- Le modèle mixte (présentiel et distance) est réaliste au Sénégal grâce au smartphone Android.

### 1.3 Risques identifiés et réponses proposées

| Risque | Gravité | Réponse |
|---|---|---|
| Référentiels officiels non accessibles ou en cours de révision | **Élevée** | Référentiel versionné, avec statut de validation, et contenus rattachés à une version précise (§7) |
| Réforme du CFEE en 2026, arrêtés d'application non retrouvés | Élevée | Espace CFEE paramétrable (épreuves, coefficients, barèmes en base, pas dans le code) |
| Données d'enfants | **Élevée** | Cloisonnement strict par rôle au niveau de la base (RLS), journal d'audit, consentement parental (§8.4) |
| Connexion faible ou coûteuse | Moyenne | PWA légère, audio compressé, mode hors-ligne pour les élèves (§8) |
| Wolof généré par IA de qualité inégale | Moyenne | Enregistrements humains en priorité ; tout texte wolof issu de l'IA passe par une validation humaine |
| Périmètre trop large | **Élevée** | MVP strictement limité au scénario de validation T (§9) |
| Jeunes élèves (CI-CP) peu autonomes sur écran | Moyenne | Connexion par code-image, interface audio, mode « accompagné par le parent » |

---

## 2. Référentiels officiels sénégalais retrouvés

### 2.1 Cadre général : le Curriculum de l'Éducation de Base (CEB)

Ce qui ressort de manière concordante des sources :

- Le référentiel en vigueur à l'élémentaire est le **Curriculum de l'Éducation de Base (CEB)**.
- Il repose sur l'**Approche par les compétences (APC)** et sur la **pédagogie de l'intégration**.
- L'élémentaire compte **6 années réparties en 3 étapes de 2 ans** :
  - Étape 1 : CI, CP
  - Étape 2 : CE1, CE2
  - Étape 3 : CM1, CM2
- Le cycle est sanctionné par le **CFEE**.
- Les apprentissages sont organisés en **4 domaines** (source secondaire, à confirmer dans les guides) :
  1. Langue et communication
  2. Mathématiques
  3. Éducation à la Science et à la Vie Sociale (ESVS)
  4. Éducation Physique, Sportive et Artistique (EPSA)

> ⚠️ Le découpage exact en **sous-domaines et disciplines** (par exemple lecture, production d'écrit, activités numériques, géométrie, mesure, histoire, géographie, IST, etc.), ainsi que la chaîne « compétence de base → palier → objectif d'apprentissage → objectif spécifique », **n'a pas pu être vérifié**. Ces intitulés doivent être recopiés depuis les guides officiels. Je ne les ai pas inscrits dans le modèle de données pour ne pas les inventer.

### 2.2 Documents repérés

| # | Document | Émetteur présumé | Date | Statut | Lien |
|---|---|---|---|---|---|
| R1 | Page « Programme élémentaire » | Ministère de l'Éducation nationale | n.c. | 🟢 Officiel en ligne (non lu, accès bloqué) | https://www.education.sn/pages/elementaire |
| R2 | Guide pédagogique CEB, **Étape 1** (CI-CP), « version finale », 390 pages | MEN | n.c. (fichier daté « vendredi 25 août ») | 🟡 Copie tierce | https://lecouloirdusavoir.com/Guide%20p%C3%A9dagogique_%C3%A9tape%201.pdf |
| R2b | Même guide, autre copie | MEN | n.c. | 🟡 Copie tierce | https://pdfcoffee.com/guide-version-finale-pdf-free.html |
| R3 | Guide pédagogique CEB, **Étape 2** (CE1-CE2), avec planification des apprentissages ESVS au CE1 | MEN | n.c. | 🟡 Copie tierce | https://lecouloirdusavoir.com/Guide%20p%C3%A9dagogique_%C3%A9tape%202.pdf |
| R4 | Guide pédagogique CEB, **Étape 3** (CM1-CM2), 413 pages (« BAT ») | MEN | n.c. | 🟡 Copie tierce | https://www.scribd.com/document/724792702/BAT-GUIDE-PEDAGOGIQUE-ETAPE-3-IMP |
| R5 | Présentation du guide CEB 1re étape (diaporama) | n.c. | n.c. | 🔵 Secondaire | https://www.scribd.com/presentation/472514802/guide-CEB-powerpoint-pptx |
| R6 | Index des guides CEB (éditions récentes et anciennes) | Site d'enseignants | n.c. | 🔵 Secondaire | https://lecouloirdusavoir.com/ressources.html |
| R7 | Espace enseignants, IA de Dakar | Inspection d'Académie de Dakar | n.c. | 🟢 Officiel en ligne | http://iadakar.education.sn/espace-enseignants |

### 2.3 CFEE : un changement réglementaire majeur en 2026

| # | Document | Date | Statut | Lien |
|---|---|---|---|---|
| C1 | **Décret n° 2026-1112** portant création du Certificat de fin d'études élémentaires (CFEE) et suppression du concours d'entrée en Sixième | 21 mai 2026 | 🟢 Officiel en ligne (non lu en intégralité, accès bloqué) | https://www.vie-publique.sn/documents/11719/decret-2026-1112-creation-cfee-suppression-concours-sixieme-education-nationale |
| C2 | Guide du CFEE (organisation de l'examen) | Juin 2018 | 🟡 Copie tierce, **antérieure à la réforme 2026** | https://editsoftsenegal.com/download/guide-du-cfee.pdf |
| C3 | Démarche d'inscription au CFEE | n.c. | 🟢 Officiel (portail des services) | https://senegalservices.sn/demarche/sinscrire-a-lexamen-du-certificat-de-fin-detudes-elementaires-cfee |
| C4 | Dossier explicatif CFEE et passage en 6e | n.c. | 🔵 Secondaire | https://www.sencampus.com/dossiers/le-bfem-et-apres/le-cfee-et-le-passage-au-college |

Ce que les résumés du décret C1 indiquent (**à confirmer sur le texte intégral**) :

- le concours d'entrée en Sixième est supprimé ;
- le CFEE comporte deux options, **Français** et **Franco-arabe**, et d'autres options pourront être ajoutées ;
- l'admission se ferait avec une moyenne minimale de **5/10** sur l'ensemble des épreuves ;
- plusieurs modalités, dont les **conditions de passage en 6e** (article 20), sont **renvoyées à des arrêtés**. Ces arrêtés n'ont pas été retrouvés.

**Conséquence pour le logiciel** : la liste des épreuves, les coefficients et les barèmes du CFEE ne seront **jamais codés en dur**. Ils seront saisis dans l'application à partir des textes officiels, avec la référence du texte.

### 2.4 Révision du curriculum en cours

| # | Information | Statut | Lien |
|---|---|---|---|
| V1 | Conseil interministériel de la rentrée 2025/26 : cadre d'orientation curriculaire prévu fin 2025, puis réécriture des programmes et guides, formation et manuels vers mi-2026 | 🟢 Document gouvernemental (hébergé par un tiers) | https://kaay-jang.com/uploads/videos/CIM_Bilan_Rentree_Scolaire_25-26.pdf |
| V2 | Installation d'un Comité scientifique chargé des nouveaux programmes (22 juillet) | 🔵 Presse | https://www.agenceecofin.com/actualites-services/2307-140431-le-senegal-mise-sur-la-continuite-de-l-etat-pour-sa-refondation-scolaire |
| V3 | Annonce de la révision des programmes scolaires | 🔵 Presse | https://www.pressafrik.com/Vers-la-revision-des-programmes-scolaires-au-Senegal_a252877.html |
| V4 | Circulaire n° 9597 (26/09/2025) : période transitoire 2025-2026 et 2026-2027 | 🟡 Copie tierce (Scribd), non authentifiée | https://fr.scribd.com/document/924808396/Circulaire-9597 |

Les calendriers annoncés ne concordent pas entre les sources. **Il est donc probable que les nouveaux programmes arrivent pendant la vie de l'application.** C'est la raison principale du choix d'un référentiel versionné (§7.2).

### 2.5 Langues nationales et enseignement bilingue (wolof)

| # | Document / information | Statut | Lien |
|---|---|---|---|
| L1 | MOHEBS (Modèle harmonisé d'enseignement bilingue au Sénégal), piloté par la Direction de l'Enseignement élémentaire : validation d'une stratégie nationale de plaidoyer pour sa mise à l'échelle | 🔵 Presse | https://senego.com/a-diamniadio-le-ministere-valide-la-strategie-nationale-de-plaidoyer-pour-la-mise-a-lechelle-du-mohebs_2001453.html |
| L2 | Introduction de langues nationales, formation des agents des IA et IEF | 🔵 Presse | https://www.dakaractu.com/Thies-Enseignement-bilingue-au-Senegal-8-langues-introduites-les-agents-des-IA-et-IEF-outilles_a266914.html |
| L3 | Rapport d'évaluation du programme *Ndaw Wune* (mars 2026) | 🔵 Évaluation indépendante (AIR) | https://air.org/sites/default/files/2026-03/Ndaw-Wune-Evaluation-Final-Report-French-March-03-2026.pdf |
| L4 | Rapport BUILD Sénégal sur la langue d'enseignement (mars 2026) | 🔵 Évaluation indépendante (AIR) | https://air.org/sites/default/files/2026-03/Blueprint-Use-of-Evidence-in-Language-of-Instruction-Decisions-BUILD-Senegal-Report-March-2026.pdf |
| L5 | Projet SENTERMINO : plus de 5 000 fiches terminologiques en wolof, pulaar et seereer | 🔵 Presse | https://fr.allafrica.com/stories/202611040503.html |

> Remarque : le wolof du MOHEBS est une **langue d'enseignement** dans les écoles bilingues. Dans TERANGA ÉDUCATION, conformément à votre cahier des charges, le wolof est une **langue d'accompagnement** (explications, consignes). Les deux approches sont compatibles. Il faudra toutefois utiliser l'**orthographe officielle du wolof** et, si possible, la **terminologie scolaire** (SENTERMINO) pour que les mots employés soient les mêmes qu'à l'école.

### 2.6 Protection des données

| # | Document | Statut | Lien |
|---|---|---|---|
| P1 | Loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel | 🟢 Officiel | https://www.vie-publique.sn/documents/438/loi-protection-donnees-a-caractere-personnel |
| P1b | Même texte (WIPO Lex) | 🟢 Copie institutionnelle | https://www.wipo.int/wipolex/edocs/lexdocs/laws/fr/sn/sn009fr.pdf |
| P2 | Formation de la CDP sur les données des enfants (avril 2026) | 🔵 Presse | https://osiris.sn/protection-des-donnees-des-enfants-au-senegal-la-cdp-offre-son-expertise-au-sos.html |
| P3 | Débat sur la modernisation de la loi face à l'IA (mars 2026) | 🔵 Presse | https://fr.allafrica.com/stories/202603280054.html |

D'après les sources trouvées, la **loi 2008-12 reste en vigueur** en novembre 2026. Une réforme est en projet depuis plusieurs années, mais je n'ai trouvé aucune trace de son adoption. L'autorité compétente est la **Commission de Protection des Données Personnelles (CDP)**.

### 2.7 Ressources techniques pour l'audio wolof (non pédagogiques)

Plusieurs modèles de synthèse vocale wolof existent : Oolel Voices, ADIA_TTS (CONCREE), xTTS-v2-wolof (GalsenAI), SpeechT5 wolof, ainsi que des services commerciaux. Leur qualité varie, notamment sur les nombres et les mots français insérés, ce qui pose problème en mathématiques.

- https://huggingface.co/CONCREE/Adia_TTS
- https://huggingface.co/galsenai/xTTS-v2-wolof
- https://huggingface.co/Laurentmd5/Oolel-Voices
- https://arxiv.org/pdf/2509.15362 (état de l'art, parole et wolof)

**Recommandation** : en priorité, des **enregistrements réalisés par les encadreurs**. La synthèse vocale ne servira que de secours, après écoute et validation.

---

## 3. Documents manquants (à obtenir auprès de l'IEF, de l'Inspection d'Académie, de la DEE ou de l'INEADE)

| # | Document manquant | Pourquoi il est indispensable | Priorité |
|---|---|---|---|
| M1 | **Exemplaires officiels authentifiés** des guides CEB étapes 1, 2 et 3 (édition en vigueur, date, numéro d'édition) | Remplacer les copies tierces R2 à R4 | **P0, bloquant pour la phase 3** |
| M2 | Liste officielle des **domaines, sous-domaines et disciplines** par étape | Structure du référentiel | **P0** |
| M3 | **Compétences de base, paliers et objectifs** par niveau et par discipline | Rattacher chaque exercice à une compétence | **P0** |
| M4 | **Progressions / planifications annuelles** par niveau | Ordonner les séquences et calculer les prérequis | P1 |
| M5 | **Volumes horaires** hebdomadaires officiels | Aide à l'emploi du temps (facultatif pour un centre) | P2 |
| M6 | Modalités officielles d'**évaluation** CEB (critères, grilles, seuils de maîtrise) | Faire correspondre « non acquis / en cours / acquis » à la pratique officielle | P1 |
| M7 | **Texte intégral** du décret 2026-1112 et **arrêtés d'application** du CFEE (épreuves, durées, coefficients, barèmes, passage en 6e) | Espace CM2/CFEE | **P0 pour le module CFEE** |
| M8 | **Sujets officiels** du CFEE des sessions récentes (droits de réutilisation à vérifier) | Examens blancs | P1 |
| M9 | Nouveaux **programmes révisés** (cadre d'orientation curriculaire, nouveaux guides) et calendrier officiel d'entrée en vigueur | Version 2 du référentiel | Veille |
| M10 | Texte en vigueur sur l'**orthographe officielle du wolof** et lexiques scolaires (MOHEBS, SENTERMINO) | Qualité des contenus wolof | P1 |
| M11 | Guides ou manuels MOHEBS en wolof | Cohérence des explications wolof avec l'école | P2 |
| M12 | Formalités CDP applicables (déclaration ou autorisation, transfert de données hors du Sénégal) | Conformité avant la mise en production | **P0 avant le déploiement** |
| M13 | Statut juridique du centre et éventuelle autorisation administrative d'ouverture | Mentions légales, contrats parents | P1 |

**Action proposée au promoteur** : rassembler M1, M2, M3, M7 et M12 par voie officielle (IEF de rattachement, Inspection d'Académie, CDP). Je peux préparer les courriers de demande.

---

## 4. Proposition d'organisation du centre

### 4.1 Organigramme et rôles applicatifs

```
Directeur / Administrateur  (1)
        │
Coordinateur pédagogique    (1, peut être la même personne au démarrage)
        │
Encadreurs                  (N)  ── chacun référent de plusieurs élèves
        │
Élèves CI → CM2             ── groupe principal + groupes de remédiation
        │
Parents / tuteurs           ── un compte, plusieurs enfants
```

Un même utilisateur peut cumuler plusieurs rôles (par exemple directeur et coordinateur). Ce cumul doit être explicite et tracé.

### 4.2 Règles de cloisonnement

| Qui | Voit | Ne voit pas |
|---|---|---|
| Directeur | Tout le centre | — |
| Coordinateur | Tous les dossiers pédagogiques, emplois du temps, bilans | Paramètres techniques, sauvegardes |
| Encadreur | Élèves **affectés** (référent ou membre d'un groupe qu'il anime), et uniquement pendant la durée de l'affectation | Les autres élèves, sauf autorisation temporaire tracée |
| Parent | Ses enfants **officiellement liés** (lien validé par l'administration) | Tous les autres enfants, les autres parents |
| Élève | Son propre espace | Les résultats des autres, la messagerie libre |

### 4.3 Groupes

- **Groupe principal** : un groupe par niveau (CI à CM2), éventuellement subdivisé (CE2-A, CE2-B).
- **Groupes de remédiation transversaux** : rattachés à une compétence (lecture, calcul, compréhension, expression écrite, préparation CFEE). Ils ont une date de début et une date de fin. L'élève y est inscrit pour une durée limitée, puis réévalué.
- **Séance** : un créneau, un encadreur, un ou plusieurs groupes (ou des élèves individuels), une matière, un lieu ou un lien de connexion, des présences et des observations. Le système détecte automatiquement les conflits d'horaire (encadreur, salle, élève).

### 4.4 Rythme type proposé (à ajuster selon votre réalité)

- **Diagnostic d'entrée** à l'inscription : lecture et calcul selon le niveau.
- **Séances** : 2 à 3 par semaine et par élève, de 60 à 90 minutes, en petits groupes (6 à 10 élèves maximum).
- **Bilan** court au parent chaque mois, bilan complet chaque trimestre.
- **Point de coordination** hebdomadaire sur la liste des élèves en alerte, générée automatiquement.

---

## 5. Modèle pédagogique

### 5.1 Hiérarchie : adapter la vôtre au CEB sans rien inventer

Votre hiérarchie (Niveau → Matière → Compétence → Objectif → Séquence → Leçon → Activité → Exercice → Évaluation) mélange deux choses :

1. **Le référentiel officiel** (ce que l'État exige) : il vient des guides, il est versionné et il n'est validé que par le responsable pédagogique.
2. **Les ressources du centre** (ce que vos encadreurs produisent) : séquences, leçons, activités, exercices, évaluations.

Je propose de les **séparer** dans la base :

```
RÉFÉRENTIEL (officiel, versionné, en lecture seule pour les encadreurs)
  Version du référentiel (ex. « CEB, édition XXXX »)
   └─ Étape (1, 2, 3) → Niveau (CI … CM2)
       └─ Nœuds hiérarchiques typés, de profondeur libre :
          Domaine → Sous-domaine / Discipline → Compétence → Palier → Objectif …
          (les types et intitulés sont saisis depuis les guides, et non codés)

RESSOURCES DU CENTRE (créées par les encadreurs, validées par le coordinateur)
  Séquence → Leçon → Activité → Exercice
  Évaluation (diagnostique, formative, sommative, CFEE blanc)
  Chaque ressource est rattachée à un ou plusieurs objectifs du référentiel.
```

Pourquoi un arbre « de profondeur libre » ? Parce que je n'ai pas pu vérifier le nombre exact de niveaux de la hiérarchie CEB (M2, M3). Cette structure accepte le découpage officiel, quel qu'il soit, et accueillera aussi le futur curriculum révisé sans modifier le code.

### 5.2 Fiche ressource (contenu minimal)

Niveau · matière · **référence du programme** (nœud, version et page du guide) · compétence · objectif · prérequis (liens vers d'autres objectifs) · explication (FR, audio FR, aide wolof facultative) · exemples contextualisés · activités · exercices progressifs (3 paliers de difficulté) · corrigé · évaluation · piste de remédiation · **statut** (brouillon / à valider / validé / archivé) · auteur · validateur · date.

### 5.3 Mesure de la maîtrise

- Trois niveaux, comme demandé : **Non acquis · En cours d'acquisition · Acquis**.
- Le niveau est **calculé par objectif**, à partir des dernières tentatives. Proposition par défaut, modifiable dans les paramètres : moins de 50 % de réussite = non acquis, de 50 à 79 % = en cours, 80 % et plus sur au moins deux évaluations distinctes = acquis.
- **L'encadreur peut toujours corriger** le niveau calculé. Il doit alors saisir une justification, qui est tracée. La machine propose, l'humain décide.
- Historique complet : niveau initial (diagnostic), niveaux intermédiaires, niveau récent, courbe de progression.

> Ces seuils sont une proposition technique **et non une norme officielle**. Ils seront alignés sur M6 dès que ce document sera obtenu.

### 5.4 Remédiation (exemple : division au CE2)

1. Les résultats en division sont sous le seuil → **alerte**.
2. Le système remonte les **prérequis** déclarés (soustraction, tables de multiplication, sens du partage) et vérifie leur niveau de maîtrise.
3. Il propose un **diagnostic** : « Le blocage semble venir des tables de multiplication (non acquis), pas de la division elle-même. »
4. Il propose un **plan** : exercices ciblés sur le prérequis, puis retour progressif sur la division. Ces exercices sont pris dans la banque validée, ou générés par l'IA et marqués « à valider ».
5. **L'encadreur valide, modifie ou refuse.**
6. Il inscrit l'élève dans un groupe de remédiation ou lui assigne un travail individuel.
7. Une évaluation après remédiation est enregistrée, et la progression avant/après est affichée.
8. Le parent reçoit un résumé en langage simple.

### 5.5 Contextualisation sénégalaise

Les situations d'apprentissage s'appuieront sur la vie quotidienne : le marché et les prix en francs CFA, le transport (car rapide, Ndiaga Ndiaye), les mesures de la cuisine, les distances entre villes, les fêtes, l'agriculture et la pêche. Elles seront rédigées par les encadreurs, ou générées puis validées.

### 5.6 Français et wolof

- **Français** : langue de la leçon, de l'exercice et de l'évaluation.
- **Wolof** : bouton « Ma ci wax » (« Explique-moi », intitulé à valider par un locuteur) sur une consigne, un mot ou une notion. Ce bouton ouvre un texte et un audio.
- **Règle stricte** : une évaluation marquée « en français obligatoire » (et toujours les CFEE blancs) **masque** l'aide wolof pendant l'épreuve.
- Tout contenu wolof porte un statut : *enregistré par un humain*, *généré et validé*, ou *généré et non validé*. Ce dernier statut n'est **jamais montré aux élèves**.

---

## 6. Modèle de données envisagé (PostgreSQL)

Vue d'ensemble des tables, regroupées par domaine. Les champs sont indicatifs ; le schéma détaillé sera livré en phase 1.

### 6.1 Identité et accès

| Table | Rôle | Champs clés |
|---|---|---|
| `profiles` | Toute personne qui se connecte | id (= compte d'authentification), nom, prénom, téléphone, langue préférée, actif |
| `user_roles` | Rôles cumulables | user_id, role (`admin`, `coordinateur`, `encadreur`, `parent`, `eleve`) |
| `audit_log` | Traçabilité | qui, quand, table, enregistrement, action, anciennes et nouvelles valeurs |
| `consents` | Consentement parental | élève, responsable, type (inscription, audio, photo, IA), date, version du texte, retrait |

### 6.2 Centre et organisation

| Table | Champs clés |
|---|---|
| `school_years` | libellé, dates |
| `levels` | CI, CP, CE1, CE2, CM1, CM2, étape |
| `subjects` | matière du centre, rattachée à un nœud du référentiel |
| `students` | identifiant unique (ex. TE-2026-0001), nom, prénom, date de naissance, niveau, établissement et classe d'origine, difficultés initiales, date d'inscription, encadreur référent, profile_id (compte élève, facultatif) |
| `guardians` / `student_guardians` | lien parent-enfant, lien de parenté, **contact autorisé**, validé par, date |
| `staff` | encadreurs et coordinateurs : spécialités, niveaux |
| `groups` | type (`principal` / `remediation`), niveau, objectif ciblé, dates |
| `group_members` | élève, groupe, du/au |
| `group_staff` | encadreur, groupe, du/au |
| `rooms` | lieux (pour la détection des conflits) |
| `sessions` | début, fin, matière, lieu ou lien, encadreur, statut |
| `session_participants` | séance ↔ groupe ou élève |
| `attendance` | séance, élève, présent / absent / retard / excusé, motif |
| `session_notes` | observations |
| `documents` | fichiers (stockage privé), propriétaire, visibilité |

### 6.3 Référentiel (versionné)

| Table | Champs clés |
|---|---|
| `curriculum_sources` | titre, émetteur, date, édition, URL, empreinte du fichier, **statut** (repéré / authentifié / en vigueur / abrogé), validé par |
| `curriculum_versions` | nom, source(s), date d'entrée en vigueur, statut |
| `curriculum_node_types` | types de nœuds (domaine, sous-domaine, compétence, palier, objectif…), saisis et non codés |
| `curriculum_nodes` | version, parent, type, niveau, code, intitulé, **référence (page, section)** |
| `node_prerequisites` | objectif → objectif prérequis |

### 6.4 Ressources pédagogiques

| Table | Champs clés |
|---|---|
| `sequences`, `lessons`, `activities` | contenu, niveau, statut, auteur, validateur |
| `resource_objectives` | ressource ↔ objectif(s) du référentiel |
| `exercises` | type (QCM, réponse courte, glisser-déposer, oral, production libre, photo du cahier), difficulté 1 à 3, corrigé, barème |
| `media` | audio et vidéo, langue (`fr` / `wo`), origine (`humain` / `tts` / `ia`), statut de validation |
| `wolof_explanations` | cible (consigne, mot, notion), texte, audio, statut, validateur |
| `assessments` | type (diagnostique, formative, sommative, CFEE blanc), français obligatoire (oui/non) |
| `assessment_items` | évaluation ↔ exercices, ordre, coefficient |
| `publications` | ressource publiée vers un groupe ou un élève, date, échéance |

### 6.5 Résultats et suivi

| Table | Champs clés |
|---|---|
| `submissions` | élève, exercice ou devoir, réponse, fichier, date, **synchronisé** (hors-ligne) |
| `corrections` | correcteur, note, commentaire, date |
| `mastery_records` | élève, objectif, niveau (`non_acquis` / `en_cours` / `acquis`), source (`calcul` / `encadreur`), justification, date : **historique, jamais écrasé** |
| `observations` | remarques des encadreurs |
| `reports` | bilans périodiques (brouillon / validé / envoyé) |
| `remediation_plans` | élève, objectif, diagnostic, origine (`ia` / `encadreur`), **validé par**, statut, dates |
| `remediation_steps` | ressources du plan, ordre, résultat |

### 6.6 CFEE

| Table | Champs clés |
|---|---|
| `exam_frameworks` | examen, texte de référence (lien vers `curriculum_sources`), option (Français / Franco-arabe) |
| `exam_subjects` | épreuve, durée, coefficient, barème, **saisis depuis les arrêtés** |
| `mock_exams` / `mock_exam_results` | examens blancs et résultats |

### 6.7 Communication

| Table | Champs clés |
|---|---|
| `conversations` | toujours rattachée à **un élève** ; participants = encadreur(s) affecté(s) + parent(s) lié(s) ; coordinateur en lecture |
| `messages` | auteur, texte, pièce jointe, lu |
| `notifications` | destinataire, type, lien, lue, canal (`app` / `push` / `sms` / `whatsapp` futur) |
| `help_requests` | l'élève demande de l'aide sur un exercice → file de l'encadreur |

### 6.8 Sécurité au niveau de la base

Toutes les tables sont protégées par **Row Level Security** (RLS). Concrètement, c'est la base de données elle-même qui refuse de renvoyer une ligne interdite, même si l'interface comporte un bug. Exemples de règles :

- un encadreur ne lit un élève que s'il existe une affectation active (`group_staff` + `group_members`, ou encadreur référent) ;
- un parent ne lit un élève que via un `student_guardians` validé ;
- un élève ne lit que ses propres lignes ;
- les écritures sensibles (niveaux de maîtrise, liens parent-enfant) alimentent automatiquement `audit_log`.

Chacune de ces règles fera l'objet de **tests automatisés** : par exemple, un test vérifiera qu'un « parent A » ne peut pas voir l'enfant du « parent B ».

---

## 7. Architecture technique recommandée

### 7.1 Choix et raisons (en langage simple)

| Brique | Choix | Pourquoi |
|---|---|---|
| Interface | **React + TypeScript + Vite** | Standard du marché, nombreux développeurs disponibles au Sénégal. TypeScript détecte beaucoup d'erreurs avant la mise en ligne. |
| Mise en forme | **Tailwind CSS** | Interface rapide à construire, légère à charger, facile à adapter au téléphone. |
| Base de données | **PostgreSQL** via **Supabase** | Base relationnelle robuste (bien adaptée aux relations élève-groupe-encadreur-parent), avec authentification, stockage de fichiers et RLS intégrés. Supabase est open source, donc on peut l'héberger soi-même plus tard si la loi ou les coûts l'exigent. |
| Authentification | Supabase Auth | Personnel : e-mail ou téléphone + mot de passe. Parents : **téléphone + mot de passe** (SMS de vérification dans une seconde étape, car il a un coût). Jeunes élèves : identifiant court + **code-image** (choix de 3 images), créés par le centre et utilisables en mode accompagné. |
| Fichiers | Supabase Storage, **dossiers privés** | Devoirs photographiés et audios. Accès par liens temporaires, jamais publics. |
| Logique serveur | **Edge Functions** (fonctions serveur) | Appels à l'IA, export Excel/PDF, notifications. **Les clés API restent sur le serveur.** |
| Application mobile | **PWA** (Progressive Web App) | Une seule application pour Android et PC, installable depuis le navigateur, sans Play Store ni double développement. |
| Hors-ligne | Service Worker + **IndexedDB** (bibliothèque Dexie) | Leçons et audios téléchargés à l'avance ; les réponses de l'élève sont stockées sur le téléphone puis envoyées au retour du réseau. |
| Excel | Bibliothèque SheetJS | Import et export des listes d'élèves. |
| PDF | Génération côté serveur | Bilans imprimables. |
| IA | Fournisseur interchangeable, derrière une fonction serveur unique | Changer de fournisseur sans réécrire l'application. Tout résultat est enregistré avec le statut « à valider ». |
| Tests | Vitest (logique), Playwright (parcours complets, téléphone et PC), tests SQL des règles RLS | « Pas de fonctionnalité achevée sans test. » |
| Hébergement de l'interface | Hébergeur statique avec HTTPS (Vercel, Netlify ou Cloudflare Pages) | Peu coûteux, rapide, HTTPS automatique. |

### 7.2 Points d'architecture importants

1. **Versionnement du référentiel** : chaque ressource et chaque niveau de maîtrise pointe vers une version précise du référentiel. À l'arrivée du nouveau curriculum, on crée la version 2 et on établit les correspondances. L'historique des élèves n'est pas perdu.
2. **Mode hors-ligne limité volontairement** : uniquement pour l'élève (consulter, écouter, répondre). L'administration et la correction exigent une connexion, ce qui évite les conflits de données difficiles à résoudre.
3. **Poids des pages** : objectif inférieur à 300 Ko au premier chargement sur mobile, audio en Opus/AAC à bas débit (environ 24 kb/s), vidéos téléchargeables à la demande uniquement.
4. **Localisation des données** : Supabase cloud n'a pas de région au Sénégal. Un hébergement hors du Sénégal est un **transfert international** au sens de la loi 2008-12. Il faut vérifier les formalités CDP (M12). Deux options : hébergement cloud (UE) avec formalités CDP, ou Supabase auto-hébergé sur un serveur au Sénégal. Recommandation : commencer en cloud pour le prototype **avec des données fictives uniquement**, puis décider avant la mise en production.
5. **WhatsApp Business** : prévu comme un « canal » de notification parmi d'autres. Il ne sera branché qu'après validation de l'accès à l'API WhatsApp Business par Meta et l'accord des parents.

### 7.3 Schéma

```
 Téléphone / PC (PWA React)
   │  cache hors-ligne (IndexedDB) ── file d'envoi différé
   ▼ HTTPS
 Supabase
   ├─ Auth (comptes, rôles)
   ├─ PostgreSQL + RLS + journal d'audit
   ├─ Storage privé (devoirs, audios)
   └─ Edge Functions ──► API IA (clé secrète côté serveur)
                     ──► Exports Excel / PDF
                     ──► Notifications (app, push ; SMS/WhatsApp plus tard)
```

### 7.4 Protection des enfants (dispositions concrètes)

- Consentement parental enregistré, versionné et révocable, avant toute création de compte élève.
- Aucune page publique, aucun profil d'enfant visible, aucun classement entre élèves, aucune publicité, aucun traceur publicitaire.
- Messagerie toujours rattachée à un élève, jamais entre élèves, avec le coordinateur en lecture.
- Minimisation : pas de photo d'identité, pas d'adresse précise par défaut.
- IA : on n'envoie **ni nom, ni date de naissance, ni identifiant réel** au fournisseur. L'élève est pseudonymisé (« Élève CE2 #A ») avant l'appel.
- Sauvegardes quotidiennes automatiques, avec un test de restauration prévu en phase 7.
- Droits d'accès, de rectification et de suppression (loi 2008-12) : procédure dans l'interface administrateur.

---

## 8. Fonctionnalités prioritaires du MVP

Le MVP correspond **exactement** au scénario de validation T, rien de plus :

| # | Étape du scénario | Fonctionnalités nécessaires |
|---|---|---|
| 1 | L'admin inscrit un élève de CE2 | Connexion, rôles, fiche élève, identifiant unique |
| 2 | Il crée le compte parent | Compte parent, lien parent-enfant validé, consentement |
| 3 | Il affecte l'élève à un groupe | Groupes principal et remédiation, appartenance |
| 4 | Il affecte un encadreur | Encadreur référent et encadreur du groupe |
| 5 | L'encadreur publie une leçon | Mini-référentiel (quelques objectifs de mathématiques CE2 saisis **et étiquetés « provisoires, à valider »**), éditeur de leçon, publication vers le groupe |
| 6 | L'élève consulte la leçon | Espace élève simplifié |
| 7 | Il écoute l'explication en wolof | Upload d'un enregistrement audio par l'encadreur, lecteur audio |
| 8 | Il réalise un exercice | QCM et réponse courte |
| 9 | L'encadreur corrige | File de correction, note et commentaire |
| 10 | Le dossier est actualisé | Calcul du niveau de maîtrise et historique |
| 11 | Le parent consulte | Espace parent (résultats, compétences) |
| 12 | L'encadreur identifie une difficulté | Alerte sous le seuil, vue des prérequis |
| 13 | Une remédiation est proposée | Plan de remédiation (règles simples ; IA en phase 6), validation par l'encadreur |
| 14 | Résultats après remédiation | Nouvelle évaluation, affichage avant/après |

Plus, de manière transversale : RLS et ses tests, journal d'audit, PWA installable, interface en français.

**Hors MVP** (phases suivantes) : calendrier complet avec détection de conflits, imports Excel, mode hors-ligne, assistant IA, TTS wolof, espace CFEE, exports PDF, messagerie riche, notifications push.

> Remarque : votre phase 2 (gestion des séances) et le scénario T (leçon, exercice, remédiation) se recoupent partiellement. Je propose de construire le **scénario T de bout en bout en priorité**, avec des séances et présences simples, puis d'enrichir le calendrier. Cela permet de démontrer la boucle de valeur plus tôt. **Décision à valider.**

---

## 9. Calendrier prévisionnel

Hypothèse : un développeur (moi) avec vos retours chaque semaine. Les durées sont indicatives et dépendent surtout de **la rapidité d'obtention des documents officiels** et de vos validations.

| Phase | Contenu | Durée estimée | Livrable / critère de fin |
|---|---|---|---|
| 0 | Étude documentaire (ce document) | ✅ Fait | Votre validation |
| 1 | Cahier des charges, parcours utilisateurs, schéma SQL détaillé, règles RLS, maquettes d'écrans | 1 à 2 semaines | Spécification validée |
| 2 | Socle : connexion, rôles, élèves, parents, encadreurs, groupes, séances et présences simples | 2 à 3 semaines | Étapes T1 à T4 testées |
| 3 | Référentiel versionné, leçons, exercices, corrections | 3 semaines | Étapes T5, T6, T8, T9 testées |
| 4 | Dossier pédagogique, maîtrise, alertes, remédiation | 2 à 3 semaines | Étapes T10 à T14 testées : **scénario T complet** |
| 5 | Audio FR/WO, explications wolof, circuit de validation | 2 semaines | T7 testée, bibliothèque audio |
| 6 | Assistant IA (encadreurs, élèves, parents), pseudonymisation | 2 à 3 semaines | Générations « à valider », tests |
| 6 bis | Espace CFEE (quand M7 sera disponible) | 2 semaines | Examens blancs paramétrés |
| 7 | Tests Android et PC, sécurité, rôles, sauvegarde/restauration, hors-ligne ; déploiement HTTPS | 2 semaines | Mise en production pilote |

Total estimé : environ **4 à 5 mois** jusqu'à un pilote en conditions réelles. Le scénario T complet serait atteint vers la **8e à 10e semaine**.

---

## 10. Décisions attendues du promoteur

1. **Validez-vous ce document** (ou quelles corrections) ?
2. **Ordre du MVP** : scénario T de bout en bout d'abord (recommandé), ou gestion administrative complète d'abord ?
3. **Documents officiels** : pouvez-vous obtenir M1, M2, M3 et M7 auprès de votre IEF ou de l'Inspection d'Académie ? Souhaitez-vous que je rédige les courriers ?
4. **Hébergement** : accord pour un prototype Supabase cloud **avec des données fictives** uniquement, la décision définitive étant prise avant la production ?
5. **Validation wolof** : qui, dans l'équipe, relira et enregistrera les contenus wolof ?
6. **Taille prévue du centre** au démarrage (élèves, encadreurs) ? Cela influe sur les coûts d'hébergement.
7. **Connexion des parents** : téléphone + mot de passe au départ, SMS de vérification plus tard. D'accord ?
8. **Fournisseur IA** : avez-vous une préférence ou un budget ? (Décision nécessaire seulement en phase 6.)

---

## Annexe : journal de recherche

- Date de la recherche : 20 novembre 2026.
- Outils : moteur de recherche web. Lecture directe des sites `.sn` impossible depuis l'environnement (blocage réseau), à refaire depuis un poste ordinaire ou après ouverture de ces domaines.
- Requêtes principales : curriculum CEB et guides pédagogiques ; modalités du CFEE et décret 2026 ; programmes de l'élémentaire par domaine ; révision du curriculum (INEADE) ; MOHEBS et wolof ; loi 2008-12 et CDP ; synthèse vocale wolof.
- Aucune information de ce document ne provient du programme scolaire d'un autre pays.
