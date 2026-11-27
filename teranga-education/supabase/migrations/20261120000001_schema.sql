-- =============================================================================
-- TERANGA ÉDUCATION — Migration 1 : schéma de données
-- Phase 1 (cahier des charges et architecture). Cible : PostgreSQL 15+ / Supabase.
--
-- Principes :
--   * Le RÉFÉRENTIEL officiel (versionné) est séparé des RESSOURCES du centre.
--   * Aucun intitulé de programme officiel n'est codé ici : il sera saisi depuis
--     les guides authentifiés (voir Phase 0, documents M1 à M3).
--   * Les niveaux de maîtrise sont un HISTORIQUE (jamais écrasé).
--   * Les corrigés des exercices sont dans une table séparée, illisible par
--     les élèves.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- 1. Types énumérés
-- -----------------------------------------------------------------------------
create type app_role          as enum ('admin', 'coordinateur', 'encadreur', 'parent', 'eleve');
create type level_code        as enum ('CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2');
create type group_kind        as enum ('principal', 'remediation');
create type mastery_level     as enum ('non_acquis', 'en_cours', 'acquis');
create type mastery_source    as enum ('calcul', 'encadreur', 'diagnostic');
create type validation_status as enum ('brouillon', 'a_valider', 'valide', 'archive');
create type source_status     as enum ('repere', 'authentifie', 'en_vigueur', 'abroge');
create type attendance_status as enum ('present', 'absent', 'retard', 'excuse');
create type session_status    as enum ('planifiee', 'realisee', 'annulee');
create type lang_code         as enum ('fr', 'wo');
create type media_origin      as enum ('humain', 'tts', 'ia');
create type assessment_kind   as enum ('diagnostique', 'formative', 'sommative', 'cfee_blanc');
create type exercise_kind     as enum ('qcm', 'reponse_courte', 'production_libre', 'oral', 'photo_cahier');
create type submission_status as enum ('soumis', 'corrige', 'a_refaire');
create type plan_origin       as enum ('regles', 'ia', 'encadreur');
create type remediation_status as enum ('proposee', 'validee', 'en_cours', 'terminee', 'refusee');
create type consent_kind      as enum ('inscription', 'compte_eleve', 'audio_voix', 'assistant_ia', 'notifications');
create type wolof_target      as enum ('consigne', 'mot', 'notion', 'probleme');
create type report_status     as enum ('brouillon', 'valide', 'envoye');
create type help_status       as enum ('ouverte', 'prise_en_charge', 'resolue');
create type notification_channel as enum ('app', 'push', 'sms', 'whatsapp');

-- -----------------------------------------------------------------------------
-- 2. Fonction utilitaire : horodatage de mise à jour
-- -----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Identité, rôles, paramètres
-- -----------------------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  phone          text,
  preferred_lang lang_code not null default 'fr',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

create table user_roles (
  user_id    uuid not null references profiles (id) on delete cascade,
  role       app_role not null,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table staff_profiles (
  profile_id  uuid primary key references profiles (id) on delete cascade,
  specialties text[] not null default '{}',
  levels      level_code[] not null default '{}',
  notes       text
);

-- Paramètres du centre (seuils de maîtrise, etc.) : modifiables sans code.
create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references profiles (id),
  updated_at  timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('mastery_thresholds',
   '{"en_cours_min_pct": 50, "acquis_min_pct": 80, "acquis_min_evaluations": 2, "window": 5}',
   'Proposition technique (non officielle) : seuils de calcul du niveau de maîtrise. '
   'À aligner sur les modalités d''évaluation officielles du CEB (document M6).'),
  ('center_name', '"TERANGA ÉDUCATION"', 'Nom affiché du centre');

-- -----------------------------------------------------------------------------
-- 4. Organisation du centre
-- -----------------------------------------------------------------------------
create table school_years (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,          -- ex. « 2026-2027 »
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  check (ends_on > starts_on)
);
create unique index one_current_school_year on school_years (is_current) where is_current;

-- Les 6 niveaux de l'élémentaire et leur étape CEB (fait établi, Phase 0 §2.1).
create table levels (
  code       level_code primary key,
  label      text not null,
  stage      smallint not null check (stage between 1 and 3),
  sort_order smallint not null unique
);
insert into levels (code, label, stage, sort_order) values
  ('CI',  'Cours d''initiation',        1, 1),
  ('CP',  'Cours préparatoire',         1, 2),
  ('CE1', 'Cours élémentaire 1re année', 2, 3),
  ('CE2', 'Cours élémentaire 2e année',  2, 4),
  ('CM1', 'Cours moyen 1re année',       3, 5),
  ('CM2', 'Cours moyen 2e année',        3, 6);

create sequence student_code_seq;

create table students (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,   -- identifiant lisible TE-AAAA-NNNN
  first_name            text not null,
  last_name             text not null,
  birth_date            date not null,
  level_code            level_code not null references levels (code),
  origin_school         text,
  origin_class          text,
  initial_difficulties  text,
  enrolled_on           date not null default current_date,
  referent_staff_id     uuid references profiles (id),
  profile_id            uuid unique references profiles (id),  -- compte de connexion élève (facultatif)
  is_active             boolean not null default true,
  created_by            uuid references profiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (birth_date > date '2005-01-01')
);
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

create or replace function set_student_code() returns trigger
language plpgsql as $$
begin
  if new.code is null then
    new.code := 'TE-' || to_char(coalesce(new.enrolled_on, current_date), 'YYYY')
                || '-' || lpad(nextval('student_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger trg_students_code before insert on students
  for each row execute function set_student_code();

-- Lien parent ⇄ enfant. N'ouvre l'accès QUE lorsqu'il est validé.
create table student_guardians (
  student_id            uuid not null references students (id) on delete cascade,
  guardian_id           uuid not null references profiles (id) on delete cascade,
  relationship          text not null,            -- mère, père, tuteur…
  is_legal_guardian     boolean not null default true,
  is_authorized_contact boolean not null default true,
  validated_by          uuid references profiles (id),
  validated_at          timestamptz,
  created_at            timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

create table consents (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  guardian_id  uuid not null references profiles (id),
  kind         consent_kind not null,
  text_version text not null,        -- version du texte de consentement présenté
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  recorded_by  uuid references profiles (id)
);
create index on consents (student_id, kind);

create table rooms (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  capacity smallint check (capacity > 0)
);

create table subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                 -- libellé interne du centre
  level_code level_code references levels (code),
  curriculum_node_id uuid,                  -- FK ajoutée après création du référentiel
  is_active  boolean not null default true,
  unique (name, level_code)
);

-- -----------------------------------------------------------------------------
-- 5. Référentiel officiel versionné
-- -----------------------------------------------------------------------------
create table curriculum_sources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  issuer       text not null,
  published_on date,
  edition      text,
  url          text,
  file_path    text,                  -- copie stockée (Storage privé)
  file_sha256  text,                  -- empreinte pour prouver l'intégrité
  status       source_status not null default 'repere',
  notes        text,
  verified_by  uuid references profiles (id),
  verified_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (status = 'repere' or verified_by is not null)
);

create table curriculum_versions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,        -- ex. « CEB — édition à préciser »
  description    text,
  effective_from date,
  status         validation_status not null default 'brouillon',
  validated_by   uuid references profiles (id),
  validated_at   timestamptz,
  created_at     timestamptz not null default now(),
  check (status <> 'valide' or validated_by is not null)
);

create table curriculum_version_sources (
  version_id uuid not null references curriculum_versions (id) on delete cascade,
  source_id  uuid not null references curriculum_sources (id),
  primary key (version_id, source_id)
);

-- Types de nœuds (domaine, sous-domaine, compétence, palier, objectif…) :
-- SAISIS depuis les guides, pas codés, car la hiérarchie exacte reste à confirmer.
create table curriculum_node_types (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references curriculum_versions (id) on delete cascade,
  code        text not null,
  label       text not null,
  depth       smallint not null check (depth >= 0),
  is_assessable boolean not null default false,  -- vrai pour le niveau « objectif » évalué
  unique (version_id, code)
);

create table curriculum_nodes (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references curriculum_versions (id) on delete cascade,
  parent_id     uuid references curriculum_nodes (id) on delete cascade,
  node_type_id  uuid not null references curriculum_node_types (id),
  level_code    level_code references levels (code),
  code          text,
  label         text not null,
  source_id     uuid references curriculum_sources (id),
  source_ref    text,              -- page / section du guide
  is_provisional boolean not null default true,  -- vrai tant que non vérifié sur source authentifiée
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index on curriculum_nodes (version_id, parent_id);
create index on curriculum_nodes (level_code);

alter table subjects
  add constraint subjects_curriculum_node_fk
  foreign key (curriculum_node_id) references curriculum_nodes (id) on delete set null;

create table node_prerequisites (
  node_id         uuid not null references curriculum_nodes (id) on delete cascade,
  prerequisite_id uuid not null references curriculum_nodes (id) on delete cascade,
  primary key (node_id, prerequisite_id),
  check (node_id <> prerequisite_id)
);

-- -----------------------------------------------------------------------------
-- 6. Groupes et séances
-- -----------------------------------------------------------------------------
create table groups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           group_kind not null,
  level_code     level_code references levels (code),
  target_node_id uuid references curriculum_nodes (id),  -- compétence visée (remédiation)
  school_year_id uuid references school_years (id),
  starts_on      date not null default current_date,
  ends_on        date,
  is_active      boolean not null default true,
  created_by     uuid references profiles (id),
  created_at     timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (kind = 'remediation' or level_code is not null)
);

create table group_members (
  group_id   uuid not null references groups (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  from_date  date not null default current_date,
  to_date    date,
  added_by   uuid references profiles (id),
  primary key (group_id, student_id, from_date),
  check (to_date is null or to_date >= from_date)
);
create index on group_members (student_id);

create table group_staff (
  group_id  uuid not null references groups (id) on delete cascade,
  staff_id  uuid not null references profiles (id) on delete cascade,
  from_date date not null default current_date,
  to_date   date,
  primary key (group_id, staff_id, from_date),
  check (to_date is null or to_date >= from_date)
);
create index on group_staff (staff_id);

-- Un élève n'a qu'UN groupe principal actif à la fois.
create or replace function check_single_principal_group() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select kind from groups where id = new.group_id) = 'principal'
     and exists (
       select 1 from group_members gm join groups g on g.id = gm.group_id
       where gm.student_id = new.student_id
         and g.kind = 'principal'
         and gm.group_id <> new.group_id
         and daterange(gm.from_date, gm.to_date, '[]') && daterange(new.from_date, new.to_date, '[]')
     ) then
    raise exception 'L''élève a déjà un groupe principal sur cette période'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_single_principal before insert or update on group_members
  for each row execute function check_single_principal_group();

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subject_id  uuid references subjects (id),
  staff_id    uuid not null references profiles (id),
  room_id     uuid references rooms (id),
  online_url  text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      session_status not null default 'planifiee',
  notes       text,
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (room_id is not null or online_url is not null),
  -- Détection des conflits : un encadreur ne peut pas animer deux séances
  -- qui se chevauchent ; une salle ne peut pas accueillir deux séances.
  constraint no_staff_overlap exclude using gist
    (staff_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'annulee'),
  constraint no_room_overlap exclude using gist
    (room_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'annulee' and room_id is not null)
);
create index on sessions (starts_at);

create table session_participants (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  group_id   uuid references groups (id) on delete cascade,
  student_id uuid references students (id) on delete cascade,
  check ((group_id is null) <> (student_id is null))
);
create unique index on session_participants (session_id, group_id) where group_id is not null;
create unique index on session_participants (session_id, student_id) where student_id is not null;

create table attendance (
  session_id  uuid not null references sessions (id) on delete cascade,
  student_id  uuid not null references students (id) on delete cascade,
  status      attendance_status not null,
  reason      text,
  recorded_by uuid references profiles (id),
  recorded_at timestamptz not null default now(),
  primary key (session_id, student_id)
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references students (id) on delete cascade,
  owner_id     uuid not null references profiles (id),
  title        text not null,
  storage_path text not null,
  mime_type    text,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Ressources pédagogiques du centre
-- -----------------------------------------------------------------------------
create table sequences (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  level_code  level_code not null references levels (code),
  subject_id  uuid references subjects (id),
  description text,
  status      validation_status not null default 'brouillon',
  author_id   uuid references profiles (id),
  created_at  timestamptz not null default now()
);

-- Le contenu d'une leçon est structuré en blocs (jsonb) :
-- explication, exemples, activités, résumé… (format défini en phase 3).
create table lessons (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid references sequences (id) on delete set null,
  title         text not null,
  level_code    level_code not null references levels (code),
  subject_id    uuid references subjects (id),
  prerequisites text,
  content       jsonb not null default '[]',
  remediation_hint text,
  status        validation_status not null default 'brouillon',
  author_id     uuid references profiles (id),
  validated_by  uuid references profiles (id),
  validated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_lessons_updated before update on lessons
  for each row execute function set_updated_at();

create table lesson_objectives (
  lesson_id uuid not null references lessons (id) on delete cascade,
  node_id   uuid not null references curriculum_nodes (id),
  primary key (lesson_id, node_id)
);

create table exercises (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid references lessons (id) on delete set null,
  level_code  level_code not null references levels (code),
  kind        exercise_kind not null,
  prompt      text not null,               -- consigne (en français)
  choices     jsonb,                       -- options de QCM, SANS l'indication de la bonne réponse
  difficulty  smallint not null default 1 check (difficulty between 1 and 3),
  max_points  numeric(5,2) not null default 1 check (max_points > 0),
  status      validation_status not null default 'brouillon',
  origin      plan_origin not null default 'encadreur',  -- 'ia' si généré
  author_id   uuid references profiles (id),
  validated_by uuid references profiles (id),
  created_at  timestamptz not null default now()
);

-- Corrigés séparés : un élève ne peut JAMAIS les lire (voir RLS).
create table exercise_keys (
  exercise_id  uuid primary key references exercises (id) on delete cascade,
  answer_key   jsonb not null,             -- ex. {"correct": ["b"]} ou {"accepted": ["12"]}
  explanation  text                        -- correction expliquée, montrée après correction
);

create table exercise_objectives (
  exercise_id uuid not null references exercises (id) on delete cascade,
  node_id     uuid not null references curriculum_nodes (id),
  primary key (exercise_id, node_id)
);

create table media (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  mime_type    text not null,
  duration_s   integer,
  lang         lang_code not null,
  origin       media_origin not null,
  status       validation_status not null default 'a_valider',
  lesson_id    uuid references lessons (id) on delete cascade,
  exercise_id  uuid references exercises (id) on delete cascade,
  recorded_by  uuid references profiles (id),
  validated_by uuid references profiles (id),
  created_at   timestamptz not null default now(),
  check (status <> 'valide' or validated_by is not null)
);

create table wolof_explanations (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid references lessons (id) on delete cascade,
  exercise_id  uuid references exercises (id) on delete cascade,
  target_kind  wolof_target not null,
  target_text  text not null,          -- passage français expliqué
  text_wo      text,                   -- explication écrite en wolof
  media_id     uuid references media (id) on delete set null,
  origin       media_origin not null,
  status       validation_status not null default 'a_valider',
  author_id    uuid references profiles (id),
  validated_by uuid references profiles (id),
  created_at   timestamptz not null default now(),
  check (lesson_id is not null or exercise_id is not null),
  check (text_wo is not null or media_id is not null),
  check (status <> 'valide' or validated_by is not null)
);

create table assessments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        assessment_kind not null,
  level_code  level_code not null references levels (code),
  french_only boolean not null default false,  -- masque l'aide wolof pendant l'épreuve
  status      validation_status not null default 'brouillon',
  author_id   uuid references profiles (id),
  created_at  timestamptz not null default now(),
  check (kind <> 'cfee_blanc' or french_only)
);

create table assessment_items (
  assessment_id uuid not null references assessments (id) on delete cascade,
  exercise_id   uuid not null references exercises (id),
  position      smallint not null,
  weight        numeric(5,2) not null default 1 check (weight > 0),
  primary key (assessment_id, exercise_id)
);

-- Publication d'une leçon ou d'une évaluation vers un groupe OU un élève.
create table publications (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid references lessons (id) on delete cascade,
  assessment_id uuid references assessments (id) on delete cascade,
  exercise_id   uuid references exercises (id) on delete cascade,
  group_id      uuid references groups (id) on delete cascade,
  student_id    uuid references students (id) on delete cascade,
  published_by  uuid not null references profiles (id),
  published_at  timestamptz not null default now(),
  due_at        timestamptz,
  message       text,
  check (num_nonnulls(lesson_id, assessment_id, exercise_id) = 1),
  check ((group_id is null) <> (student_id is null))
);
create index on publications (group_id);
create index on publications (student_id);

-- -----------------------------------------------------------------------------
-- 8. Résultats et suivi
-- -----------------------------------------------------------------------------
create table submissions (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid unique,           -- identifiant généré hors-ligne : évite les doublons à la synchro
  student_id     uuid not null references students (id) on delete cascade,
  exercise_id    uuid not null references exercises (id),
  assessment_id  uuid references assessments (id),
  publication_id uuid references publications (id) on delete set null,
  answer         jsonb,
  file_path      text,
  auto_score     numeric(5,2),          -- calculé côté serveur pour les QCM / réponses courtes
  status         submission_status not null default 'soumis',
  submitted_at   timestamptz not null default now(),
  synced_at      timestamptz not null default now()
);
create index on submissions (student_id, exercise_id);

create table corrections (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity unique,  -- ordre strict (plusieurs corrections peuvent partager le même horodatage)
  submission_id uuid not null unique references submissions (id) on delete cascade,
  corrector_id  uuid not null references profiles (id),
  score         numeric(5,2) not null check (score >= 0),
  max_score     numeric(5,2) not null check (max_score > 0),
  comment       text,
  corrected_at  timestamptz not null default now(),
  check (score <= max_score)
);

-- HISTORIQUE des niveaux de maîtrise : on ajoute, on n'écrase jamais.
create table mastery_records (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity unique,  -- ordre strict d'enregistrement
  student_id    uuid not null references students (id) on delete cascade,
  node_id       uuid not null references curriculum_nodes (id),
  level         mastery_level not null,
  source        mastery_source not null,
  score_pct     numeric(5,2),
  evidence      jsonb,                 -- corrections ayant servi au calcul
  justification text,
  recorded_by   uuid references profiles (id),
  recorded_at   timestamptz not null default now(),
  check (source <> 'encadreur' or justification is not null)
);
create index on mastery_records (student_id, node_id, seq desc);

create or replace function forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'La table % est en ajout seul (historique)', tg_table_name
    using errcode = 'P0001';
end $$;
-- (La suppression reste possible par cascade, pour le droit à l'effacement ;
--  aucune politique RLS ne l'autorise aux utilisateurs.)
create trigger trg_mastery_append_only before update on mastery_records
  for each row execute function forbid_update_delete();

-- Niveau courant = dernier enregistrement par élève et objectif.
create view current_mastery with (security_invoker = true) as
  select distinct on (student_id, node_id)
         student_id, node_id, level, source, score_pct, recorded_at
  from mastery_records
  order by student_id, node_id, seq desc;

create table observations (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  author_id  uuid not null references profiles (id),
  body       text not null,
  visible_to_parents boolean not null default false,
  created_at timestamptz not null default now()
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  body         jsonb not null default '{}',
  status       report_status not null default 'brouillon',
  author_id    uuid references profiles (id),
  validated_by uuid references profiles (id),
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (period_end >= period_start)
);

create table remediation_plans (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  target_node_id uuid not null references curriculum_nodes (id),
  diagnosis      text not null,
  origin         plan_origin not null,
  status         remediation_status not null default 'proposee',
  group_id       uuid references groups (id) on delete set null,
  proposed_by    uuid references profiles (id),
  validated_by   uuid references profiles (id),
  validated_at   timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  -- L'IA ou les règles proposent ; seul un humain valide.
  check (status in ('proposee', 'refusee') or validated_by is not null)
);

create table remediation_steps (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references remediation_plans (id) on delete cascade,
  position      smallint not null,
  node_id       uuid references curriculum_nodes (id),   -- prérequis travaillé
  lesson_id     uuid references lessons (id),
  exercise_id   uuid references exercises (id),
  assessment_id uuid references assessments (id),
  done_at       timestamptz,
  unique (plan_id, position)
);

-- -----------------------------------------------------------------------------
-- 9. CFEE (paramétré depuis les textes officiels, jamais codé en dur)
-- -----------------------------------------------------------------------------
create table exam_frameworks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  option     text not null,                      -- ex. Français, Franco-arabe (décret 2026-1112)
  source_id  uuid references curriculum_sources (id),
  session_year smallint,
  status     validation_status not null default 'brouillon',
  validated_by uuid references profiles (id),
  check (status <> 'valide' or (validated_by is not null and source_id is not null))
);

create table exam_subjects (
  id               uuid primary key default gen_random_uuid(),
  framework_id     uuid not null references exam_frameworks (id) on delete cascade,
  name             text not null,
  duration_minutes integer check (duration_minutes > 0),
  coefficient      numeric(4,2),
  max_score        numeric(5,2),
  source_ref       text
);

create table mock_exams (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid not null references exam_frameworks (id),
  title         text not null,
  held_on       date,
  created_by    uuid references profiles (id)
);

create table mock_exam_results (
  mock_exam_id    uuid not null references mock_exams (id) on delete cascade,
  student_id      uuid not null references students (id) on delete cascade,
  exam_subject_id uuid not null references exam_subjects (id),
  score           numeric(5,2) not null,
  recorded_by     uuid references profiles (id),
  primary key (mock_exam_id, student_id, exam_subject_id)
);

-- -----------------------------------------------------------------------------
-- 10. Communication
-- -----------------------------------------------------------------------------
-- Toute conversation porte sur UN élève : pas de messagerie libre.
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  subject    text not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  author_id       uuid not null references profiles (id),
  body            text not null check (length(body) between 1 and 4000),
  attachment_path text,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

create table message_reads (
  message_id uuid not null references messages (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  kind       text not null,            -- nouvelle_lecon, rappel_devoir, absence, bilan, message…
  title      text not null,
  body       text,
  link       text,
  channel    notification_channel not null default 'app',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at);

create table help_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students (id) on delete cascade,
  lesson_id   uuid references lessons (id),
  exercise_id uuid references exercises (id),
  message     text,
  status      help_status not null default 'ouverte',
  handled_by  uuid references profiles (id),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 11. Traçabilité
-- -----------------------------------------------------------------------------
create table audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  table_name text not null,
  row_pk     text,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb
);
create index on audit_log (table_name, at desc);

-- Journal des appels à l'IA (aucune donnée nominative n'est envoyée).
create table ai_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references profiles (id),
  purpose       text not null,           -- generer_exercices, diagnostic, bilan, explication_wo…
  provider      text,
  input_summary text,                    -- résumé pseudonymisé
  output        jsonb,
  outcome       validation_status not null default 'a_valider',
  reviewed_by   uuid references profiles (id),
  created_at    timestamptz not null default now()
);

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pk text;
begin
  pk := coalesce(
          (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
          (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'student_id');
  insert into audit_log (actor_id, table_name, row_pk, action, old_data, new_data)
  values (auth.uid(), tg_table_name, pk, tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Tables sensibles auditées.
do $$
declare t text;
begin
  foreach t in array array[
    'students', 'student_guardians', 'consents', 'user_roles', 'group_members', 'group_staff',
    'attendance', 'corrections', 'mastery_records', 'remediation_plans', 'reports',
    'curriculum_sources', 'curriculum_versions', 'curriculum_nodes', 'exam_frameworks', 'exam_subjects'
  ] loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on %1$I
         for each row execute function audit_trigger()', t);
  end loop;
end $$;
