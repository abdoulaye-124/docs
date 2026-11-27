-- =============================================================================
-- TEST : scénario de validation T (14 étapes) + cloisonnement RLS
--
-- TOUTES LES DONNÉES CI-DESSOUS SONT FICTIVES ET SERVENT UNIQUEMENT AU TEST.
-- Les intitulés « OBJECTIF FICTIF » ne sont PAS des objectifs du programme
-- officiel sénégalais.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- -----------------------------------------------------------------------------
-- Outils de test
-- -----------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated;

create table tests.ids (k text primary key, v uuid not null);
grant select, insert, update on tests.ids to authenticated;

create function tests.id(p text) returns uuid language sql stable as $$ select v from tests.ids where k = p $$;
create function tests.keep(p text, v uuid) returns uuid language sql as $$
  insert into tests.ids values (p, v) on conflict (k) do update set v = excluded.v returning v $$;

create function tests.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p)::text, false)
$$;

create function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'ÉCHEC : %', label;
  end if;
  raise notice 'OK  : %', label;
end $$;

create function tests.fails(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'OK  : % (refusé : %)', label, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC : % (aurait dû être refusé)', label;
end $$;

-- Lecture de contrôle de la note automatique (le test vérifie le calcul serveur,
-- que les utilisateurs ne peuvent plus lire directement depuis la Phase 7).
create function tests.note_auto(p uuid) returns numeric language sql security definer as $$
  select auto_score from public.submissions where id = p $$;

grant execute on all functions in schema tests to authenticated;

-- -----------------------------------------------------------------------------
-- Comptes fictifs (en production : créés par une fonction serveur de l'admin)
-- -----------------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- admin
  ('00000000-0000-0000-0000-0000000000a2'),  -- coordinateur
  ('00000000-0000-0000-0000-0000000000b1'),  -- encadreur 1 (affecté)
  ('00000000-0000-0000-0000-0000000000b2'),  -- encadreur 2 (non affecté)
  ('00000000-0000-0000-0000-0000000000c1'),  -- parent 1
  ('00000000-0000-0000-0000-0000000000c2'),  -- parent 2 (autre famille)
  ('00000000-0000-0000-0000-0000000000d1'),  -- compte élève 1 (CE2)
  ('00000000-0000-0000-0000-0000000000d2');  -- compte élève 2 (autre famille)

insert into profiles (id, first_name, last_name, phone) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin',   'FICTIF', null),
  ('00000000-0000-0000-0000-0000000000a2', 'Coord',   'FICTIF', null),
  ('00000000-0000-0000-0000-0000000000b1', 'Encadreur1', 'FICTIF', null),
  ('00000000-0000-0000-0000-0000000000b2', 'Encadreur2', 'FICTIF', null),
  ('00000000-0000-0000-0000-0000000000c1', 'Parent1', 'FICTIF', '+221700000001'),
  ('00000000-0000-0000-0000-0000000000c2', 'Parent2', 'FICTIF', '+221700000002'),
  ('00000000-0000-0000-0000-0000000000d1', 'Eleve1',  'FICTIF', null),
  ('00000000-0000-0000-0000-0000000000d2', 'Eleve2',  'FICTIF', null);

insert into user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'coordinateur'),
  ('00000000-0000-0000-0000-0000000000b1', 'encadreur'),
  ('00000000-0000-0000-0000-0000000000b2', 'encadreur'),
  ('00000000-0000-0000-0000-0000000000c1', 'parent'),
  ('00000000-0000-0000-0000-0000000000c2', 'parent'),
  ('00000000-0000-0000-0000-0000000000d1', 'eleve'),
  ('00000000-0000-0000-0000-0000000000d2', 'eleve');

select tests.keep('admin',  '00000000-0000-0000-0000-0000000000a1'),
       tests.keep('coord',  '00000000-0000-0000-0000-0000000000a2'),
       tests.keep('enc1',   '00000000-0000-0000-0000-0000000000b1'),
       tests.keep('enc2',   '00000000-0000-0000-0000-0000000000b2'),
       tests.keep('par1',   '00000000-0000-0000-0000-0000000000c1'),
       tests.keep('par2',   '00000000-0000-0000-0000-0000000000c2'),
       tests.keep('acc1',   '00000000-0000-0000-0000-0000000000d1'),
       tests.keep('acc2',   '00000000-0000-0000-0000-0000000000d2');

-- À partir d'ici, tout s'exécute comme un utilisateur ordinaire, soumis à RLS.
set role authenticated;

-- Utilisateur non connecté : rien.
select tests.login(null);
select tests.ok((select count(*) from students) = 0, 'Sans connexion, aucun élève visible');

-- =============================================================================
-- Préparation par la direction : référentiel PROVISOIRE de test
-- =============================================================================
select tests.login(tests.id('coord'));
with insert_v as (
  insert into curriculum_versions (name, description)
  values ('TEST — référentiel provisoire', 'Données fictives de test, non officielles')
  returning id)
select tests.keep('version', insert_v.id) from insert_v;
with t as (
  insert into curriculum_node_types (version_id, code, label, depth, is_assessable)
  values (tests.id('version'), 'objectif', 'Objectif (type fictif de test)', 0, true) returning id)
select tests.keep('type_obj', t.id) from t;
with n as (
  insert into curriculum_nodes (version_id, node_type_id, level_code, label)
  values (tests.id('version'), tests.id('type_obj'), 'CE2', 'OBJECTIF FICTIF : diviser un nombre') returning id)
select tests.keep('node_div', n.id) from n;
with n as (
  insert into curriculum_nodes (version_id, node_type_id, level_code, label)
  values (tests.id('version'), tests.id('type_obj'), 'CE1', 'OBJECTIF FICTIF : tables de multiplication') returning id)
select tests.keep('node_tables', n.id) from n;
insert into node_prerequisites values (tests.id('node_div'), tests.id('node_tables'));

select tests.login(tests.id('enc1'));
select tests.fails($$insert into curriculum_nodes (version_id, node_type_id, label)
                    values (tests.id('version'), tests.id('type_obj'), 'x')$$,
                   'Un encadreur ne modifie pas le référentiel');

-- =============================================================================
-- T1. L'administrateur inscrit un élève de CE2
-- =============================================================================
select tests.login(tests.id('enc1'));
select tests.fails($$insert into students (first_name, last_name, birth_date, level_code)
                    values ('X', 'Y', '2017-01-01', 'CE2')$$,
                   'T1 : un encadreur ne peut pas inscrire un élève');

select tests.login(tests.id('admin'));
with s as (
  insert into students (first_name, last_name, birth_date, level_code, origin_school, origin_class,
                        initial_difficulties, profile_id, created_by)
  values ('Eleve1', 'FICTIF', '2017-03-12', 'CE2', 'École fictive', 'CE2 B',
          'Difficultés en division (fictif)', tests.id('acc1'), tests.id('admin'))
  returning id)
select tests.keep('stu1', s.id) from s;
with s as (
  insert into students (first_name, last_name, birth_date, level_code, profile_id)
  values ('Eleve2', 'FICTIF', '2016-05-02', 'CM1', tests.id('acc2')) returning id)
select tests.keep('stu2', s.id) from s;
select tests.ok((select code ~ '^TE-\d{4}-\d{4}$' from students where id = tests.id('stu1')),
                'T1 : élève CE2 inscrit avec identifiant unique TE-AAAA-NNNN');

-- =============================================================================
-- T2. Création du compte parent et lien validé + consentement
-- =============================================================================
insert into student_guardians (student_id, guardian_id, relationship, validated_by, validated_at)
values (tests.id('stu1'), tests.id('par1'), 'mère', tests.id('admin'), now()),
       (tests.id('stu2'), tests.id('par2'), 'père', tests.id('admin'), now());
insert into consents (student_id, guardian_id, kind, text_version, recorded_by)
values (tests.id('stu1'), tests.id('par1'), 'inscription', 'v1-test', tests.id('admin')),
       (tests.id('stu1'), tests.id('par1'), 'compte_eleve', 'v1-test', tests.id('admin'));

select tests.login(tests.id('par1'));
select tests.ok((select count(*) from students) = 1 and
                (select id from students) = tests.id('stu1'),
                'T2 : le parent 1 voit uniquement son enfant');
select tests.login(tests.id('par2'));
select tests.ok(not exists (select 1 from students where id = tests.id('stu1')),
                'T2 : le parent 2 ne voit pas l''enfant du parent 1');

-- Lien non validé : aucun accès.
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c3');
insert into profiles (id, first_name, last_name) values ('00000000-0000-0000-0000-0000000000c3', 'Parent3', 'FICTIF');
insert into user_roles values ('00000000-0000-0000-0000-0000000000c3', 'parent');
insert into student_guardians (student_id, guardian_id, relationship)
values (tests.id('stu1'), '00000000-0000-0000-0000-0000000000c3', 'oncle');
set role authenticated;
select tests.login('00000000-0000-0000-0000-0000000000c3');
select tests.ok((select count(*) from students) = 0, 'T2 : un lien parent NON validé ne donne aucun accès');

-- =============================================================================
-- T3. Affectation de l'élève à un groupe
-- =============================================================================
select tests.login(tests.id('admin'));
with g as (
  insert into groups (name, kind, level_code, created_by)
  values ('Groupe CE2 (test)', 'principal', 'CE2', tests.id('admin')) returning id)
select tests.keep('grp_ce2', g.id) from g;
with g as (
  insert into groups (name, kind, level_code) values ('Groupe CM1 (test)', 'principal', 'CM1') returning id)
select tests.keep('grp_cm1', g.id) from g;
insert into group_members (group_id, student_id, added_by) values
  (tests.id('grp_ce2'), tests.id('stu1'), tests.id('admin')),
  (tests.id('grp_cm1'), tests.id('stu2'), tests.id('admin'));
select tests.fails($$insert into group_members (group_id, student_id) values (tests.id('grp_cm1'), tests.id('stu1'))$$,
                   'T3 : un élève ne peut pas avoir deux groupes principaux');

-- =============================================================================
-- T4. Affectation d'un encadreur
-- =============================================================================
insert into group_staff (group_id, staff_id) values
  (tests.id('grp_ce2'), tests.id('enc1')),
  (tests.id('grp_cm1'), tests.id('enc2'));
update students set referent_staff_id = tests.id('enc1') where id = tests.id('stu1');

select tests.login(tests.id('enc1'));
select tests.ok((select count(*) from students) = 1, 'T4 : l''encadreur 1 voit son seul élève affecté');
select tests.login(tests.id('enc2'));
select tests.ok(not exists (select 1 from students where id = tests.id('stu1')),
                'T4 : l''encadreur 2 ne voit pas un élève qui ne lui est pas affecté');

-- Séances et conflits d'emploi du temps
select tests.login(tests.id('coord'));
with r as (
  insert into rooms (name, capacity) values ('Salle test', 10) returning id)
select tests.keep('room', r.id) from r;
with s as (
  insert into sessions (title, staff_id, room_id, starts_at, ends_at)
  values ('Séance CE2 test', tests.id('enc1'), tests.id('room'),
          '2026-12-01 16:00+00', '2026-12-01 17:30+00') returning id)
select tests.keep('sess', s.id) from s;
insert into session_participants (session_id, group_id) values (tests.id('sess'), tests.id('grp_ce2'));
select tests.fails($$insert into sessions (title, staff_id, online_url, starts_at, ends_at)
                    values ('Conflit', tests.id('enc1'), 'https://exemple.test', '2026-12-01 17:00+00', '2026-12-01 18:00+00')$$,
                   'Conflit détecté : encadreur déjà occupé');
select tests.fails($$insert into sessions (title, staff_id, room_id, starts_at, ends_at)
                    values ('Conflit salle', tests.id('enc2'), tests.id('room'), '2026-12-01 16:30+00', '2026-12-01 17:00+00')$$,
                   'Conflit détecté : salle déjà occupée');

select tests.login(tests.id('enc1'));
insert into attendance (session_id, student_id, status, recorded_by)
values (tests.id('sess'), tests.id('stu1'), 'present', tests.id('enc1'));
select tests.login(tests.id('enc2'));
select tests.fails($$insert into attendance (session_id, student_id, status, recorded_by)
                    values (tests.id('sess'), tests.id('stu1'), 'absent', tests.id('enc2'))$$,
                   'Un encadreur ne saisit pas les présences d''une séance qui n''est pas la sienne');
select tests.login(tests.id('par1'));
select tests.ok((select status from attendance where student_id = tests.id('stu1')) = 'present',
                'Le parent voit la présence de son enfant');

-- =============================================================================
-- T5. L'encadreur publie une leçon (avec exercice et aide wolof)
-- =============================================================================
select tests.login(tests.id('enc1'));
with l as (
  insert into lessons (title, level_code, content, author_id)
  values ('Leçon test : la division', 'CE2',
          '[{"type":"explication","texte":"Contenu fictif de test"}]', tests.id('enc1'))
  returning id)
select tests.keep('lesson', l.id) from l;
insert into lesson_objectives values (tests.id('lesson'), tests.id('node_div'));

with e as (
  insert into exercises (lesson_id, level_code, kind, prompt, choices, author_id, status)
  values (tests.id('lesson'), 'CE2', 'qcm', 'Exercice fictif : 12 ÷ 3 = ?',
          '[{"id":"a","label":"3"},{"id":"b","label":"4"},{"id":"c","label":"5"}]',
          tests.id('enc1'), 'valide') returning id)
select tests.keep('ex1', e.id) from e;
insert into exercise_keys values (tests.id('ex1'), '{"correct":["b"]}', '12 = 3 × 4');
insert into exercise_objectives values (tests.id('ex1'), tests.id('node_div'));

-- Publication refusée tant que la leçon n'est pas validée.
select tests.fails($$insert into publications (lesson_id, group_id, published_by)
                    values (tests.id('lesson'), tests.id('grp_ce2'), tests.id('enc1'))$$,
                   'T5 : impossible de publier une leçon non validée');
update lessons set status = 'valide', validated_by = tests.id('enc1'), validated_at = now()
 where id = tests.id('lesson');

-- Explication wolof enregistrée par l'encadreur (à valider), puis validée par la
-- coordination (Phase 5 : l'auteur ne peut pas valider seul un contenu wolof).
with m as (
  insert into media (storage_path, mime_type, lang, origin, lesson_id, recorded_by, status)
  values ('audio/test/division-wo.opus', 'audio/ogg', 'wo', 'humain', tests.id('lesson'),
          tests.id('enc1'), 'a_valider') returning id)
select tests.keep('media_wo', m.id) from m;
with w as (
  insert into wolof_explanations (lesson_id, target_kind, target_text, media_id, origin, status, author_id)
  values (tests.id('lesson'), 'notion', 'la division', tests.id('media_wo'), 'humain', 'a_valider', tests.id('enc1'))
  returning id)
select tests.keep('wolof_div', w.id) from w;
select tests.fails($$update wolof_explanations set status = 'valide', validated_by = tests.id('enc1') where id = tests.id('wolof_div')$$,
                   'Phase 5 : un encadreur ne valide pas seul un contenu en wolof');
select tests.login(tests.id('coord'));
update media set status = 'valide', validated_by = tests.id('coord') where id = tests.id('media_wo');
update wolof_explanations set status = 'valide', validated_by = tests.id('coord') where id = tests.id('wolof_div');
select tests.login(tests.id('enc1'));
-- Explication générée par IA, non validée : ne doit JAMAIS être visible par l'élève.
insert into wolof_explanations (lesson_id, target_kind, target_text, text_wo, origin, author_id)
values (tests.id('lesson'), 'consigne', 'Calcule', 'texte IA non relu (test)', 'ia', tests.id('enc1'));

select tests.login(tests.id('enc2'));
select tests.fails($$insert into publications (lesson_id, group_id, published_by)
                    values (tests.id('lesson'), tests.id('grp_ce2'), tests.id('enc2'))$$,
                   'T5 : un encadreur ne publie pas vers un groupe qui n''est pas le sien');

select tests.login(tests.id('enc1'));
with p as (
  insert into publications (lesson_id, group_id, published_by)
  values (tests.id('lesson'), tests.id('grp_ce2'), tests.id('enc1')) returning id)
select tests.keep('pub', p.id) from p;
select tests.ok(true, 'T5 : leçon publiée vers le groupe CE2');

-- =============================================================================
-- T6. L'élève consulte la leçon
-- =============================================================================
select tests.login(tests.id('acc1'));
select tests.ok((select count(*) from lessons) = 1, 'T6 : l''élève voit la leçon publiée');
select tests.ok((select count(*) from notifications where kind = 'nouvelle_publication') = 1,
                'T6 : l''élève a reçu une notification');
select tests.ok((select count(*) from exercises) = 1, 'T6 : l''élève voit l''exercice de la leçon');
select tests.ok((select count(*) from exercise_keys) = 0, 'T6 : l''élève ne peut PAS lire le corrigé');

select tests.login(tests.id('acc2'));
select tests.ok((select count(*) from lessons) = 0, 'T6 : un élève d''un autre groupe ne voit pas la leçon');

-- =============================================================================
-- T7. L'élève écoute l'explication complémentaire en wolof
-- =============================================================================
select tests.login(tests.id('acc1'));
select tests.ok((select count(*) from wolof_explanations) = 1
                and (select origin from wolof_explanations) = 'humain',
                'T7 : l''élève accède à l''explication wolof validée, et pas à celle de l''IA non relue');
select tests.ok((select storage_path from media where lang = 'wo') is not null,
                'T7 : l''audio wolof est accessible');

-- =============================================================================
-- T8. L'élève réalise l'exercice (mauvaise réponse)
-- =============================================================================
select tests.fails($$insert into submissions (student_id, exercise_id, answer, auto_score)
                    values (tests.id('stu1'), tests.id('ex1'), '{"selected":["b"]}', 1)$$,
                   'T8 : l''élève ne peut pas écrire directement sa note');
select tests.keep('sub1', submit_answer(tests.id('ex1'), '{"selected":["a"]}',
                                        '11111111-1111-1111-1111-111111111111', tests.id('pub')));
select tests.ok(submit_answer(tests.id('ex1'), '{"selected":["a"]}', '11111111-1111-1111-1111-111111111111')
                = tests.id('sub1'), 'T8 : renvoi hors-ligne du même envoi = pas de doublon');
select tests.ok((select tests.note_auto(tests.id('sub1'))) = 0,
                'T8 : score automatique calculé côté serveur (0, réponse fausse)');

select tests.login(tests.id('acc2'));
select tests.fails($$select submit_answer(tests.id('ex1'), '{"selected":["b"]}')$$,
                   'T8 : un élève ne peut pas répondre à un exercice qui ne lui est pas publié');

-- =============================================================================
-- T9. L'encadreur corrige
-- =============================================================================
select tests.login(tests.id('enc2'));
select tests.fails($$insert into corrections (submission_id, corrector_id, score, max_score)
                    values (tests.id('sub1'), tests.id('enc2'), 1, 1)$$,
                   'T9 : un encadreur non affecté ne peut pas corriger');
select tests.login(tests.id('enc1'));
insert into corrections (submission_id, corrector_id, score, max_score, comment)
values (tests.id('sub1'), tests.id('enc1'), 0, 1, 'Revoir les tables de multiplication (test)');
select tests.ok((select status from submissions where id = tests.id('sub1')) = 'corrige', 'T9 : copie corrigée');

-- =============================================================================
-- T10. Le dossier pédagogique est actualisé
-- =============================================================================
select tests.ok((select level from current_mastery
                 where student_id = tests.id('stu1') and node_id = tests.id('node_div')) = 'non_acquis',
                'T10 : niveau de maîtrise calculé = non acquis');
update mastery_records set level = 'acquis';   -- aucune politique UPDATE : 0 ligne touchée
select tests.ok((select level from current_mastery
                 where student_id = tests.id('stu1') and node_id = tests.id('node_div')) = 'non_acquis',
                'T10 : un encadreur ne peut pas réécrire l''historique de maîtrise');
reset role;   -- même un super-administrateur est bloqué par le verrou d'historique
select tests.fails($$update mastery_records set level = 'acquis'$$,
                   'T10 : historique de maîtrise verrouillé même pour le super-administrateur');
set role authenticated;
select tests.login(tests.id('enc1'));

-- =============================================================================
-- T11. Le parent consulte les résultats
-- =============================================================================
select tests.login(tests.id('par1'));
select tests.ok((select count(*) from corrections) = 1, 'T11 : le parent voit la correction');
select tests.ok((select level from current_mastery where node_id = tests.id('node_div')) = 'non_acquis',
                'T11 : le parent voit le niveau de compétence');
select tests.login(tests.id('par2'));
select tests.ok((select count(*) from corrections) = 0 and (select count(*) from mastery_records) = 0,
                'T11 : le parent 2 ne voit aucun résultat de l''autre enfant');

-- =============================================================================
-- T12. L'encadreur identifie une difficulté (et ses prérequis)
-- =============================================================================
select tests.login(tests.id('enc1'));
select tests.ok(exists (select 1 from students_at_risk where student_id = tests.id('stu1')),
                'T12 : l''élève apparaît dans la liste des élèves en difficulté');
select tests.ok((select count(*) from prerequisite_status(tests.id('stu1'), tests.id('node_div'))
                 where prerequisite_id = tests.id('node_tables')) = 1,
                'T12 : le prérequis « tables de multiplication » est remonté pour le diagnostic');
select tests.login(tests.id('enc2'));
select tests.ok(not exists (select 1 from students_at_risk), 'T12 : l''encadreur 2 ne voit pas cette alerte');

-- =============================================================================
-- T13. Une activité de remédiation est proposée puis validée par un humain
-- =============================================================================
select tests.login(tests.id('enc1'));
with p as (
  insert into remediation_plans (student_id, target_node_id, diagnosis, origin, proposed_by)
  values (tests.id('stu1'), tests.id('node_div'),
          'Diagnostic proposé (test) : le blocage vient des tables de multiplication', 'regles', tests.id('enc1'))
  returning id)
select tests.keep('plan', p.id) from p;
select tests.fails($$update remediation_plans set status = 'validee' where id = tests.id('plan')$$,
                   'T13 : un plan ne peut pas être validé sans validateur humain identifié');

select tests.login(tests.id('par1'));
select tests.ok((select count(*) from remediation_plans) = 0, 'T13 : le parent ne voit pas un plan seulement proposé');

select tests.login(tests.id('enc1'));
update remediation_plans set status = 'validee', validated_by = tests.id('enc1'), validated_at = now()
 where id = tests.id('plan');
with e as (
  insert into exercises (level_code, kind, prompt, author_id, status)
  values ('CE2', 'reponse_courte', 'Exercice fictif de remédiation : 15 ÷ 5 = ?', tests.id('enc1'), 'valide')
  returning id)
select tests.keep('ex2', e.id) from e;
insert into exercise_keys values (tests.id('ex2'), '{"accepted":["3"]}', '15 = 5 × 3');
insert into exercise_objectives values (tests.id('ex2'), tests.id('node_div'));
insert into remediation_steps (plan_id, position, node_id, exercise_id)
values (tests.id('plan'), 1, tests.id('node_div'), tests.id('ex2'));
insert into publications (exercise_id, student_id, published_by)
values (tests.id('ex2'), tests.id('stu1'), tests.id('enc1'));

select tests.login(tests.id('par1'));
select tests.ok((select status from remediation_plans) = 'validee', 'T13 : le parent voit le plan validé');

-- =============================================================================
-- T14. Résultats après remédiation
-- =============================================================================
do $$
declare i int; v uuid;
begin
  for i in 1..4 loop
    perform tests.login(tests.id('acc1'));
    v := submit_answer(tests.id('ex2'), '{"text":" 3 "}');
    perform tests.login(tests.id('enc1'));
    insert into corrections (submission_id, corrector_id, score, max_score)
    select v, tests.id('enc1'), (select a.auto_score from auto_scores(array[v]) a), 1;
  end loop;
end $$;

select tests.login(tests.id('par1'));
select tests.ok((select level from current_mastery where node_id = tests.id('node_div')) = 'acquis',
                'T14 : après remédiation, la compétence passe à « acquis »');
select tests.ok((select array_agg(level::text order by seq) from mastery_records)
                = array['non_acquis', 'en_cours', 'en_cours', 'en_cours', 'acquis'],
                'T14 : progression historisée non acquis → en cours → acquis');

-- =============================================================================
-- Messagerie encadrée et traçabilité
-- =============================================================================
select tests.login(tests.id('par1'));
with c as (
  insert into conversations (student_id, subject, created_by)
  values (tests.id('stu1'), 'Suivi en division (test)', tests.id('par1')) returning id)
select tests.keep('conv', c.id) from c;
insert into conversation_participants values (tests.id('conv'), tests.id('par1')), (tests.id('conv'), tests.id('enc1'));
select tests.fails($$insert into conversation_participants values (tests.id('conv'), tests.id('enc2'))$$,
                   'Messagerie : impossible d''ajouter un encadreur non affecté à l''enfant');
insert into messages (conversation_id, author_id, body) values (tests.id('conv'), tests.id('par1'), 'Bonjour (test)');
select tests.login(tests.id('par2'));
select tests.fails($$insert into conversations (student_id, subject, created_by)
                    values (tests.id('stu1'), 'x', tests.id('par2'))$$,
                   'Messagerie : un parent ne peut pas ouvrir une conversation sur l''enfant d''un autre');
select tests.ok((select count(*) from messages) = 0, 'Messagerie : le parent 2 ne lit pas les messages du parent 1');
select tests.login(tests.id('enc1'));
select tests.ok((select count(*) from messages) = 1, 'Messagerie : l''encadreur affecté lit le message');

select tests.login(tests.id('enc1'));
select tests.ok((select count(*) from audit_log) = 0, 'Audit : un encadreur ne lit pas le journal');
select tests.login(tests.id('admin'));
select tests.ok((select count(*) from audit_log where table_name = 'students') >= 2
                and exists (select 1 from audit_log where table_name = 'mastery_records' and actor_id = tests.id('enc1')),
                'Audit : inscriptions et niveaux de maîtrise tracés, avec leur auteur');

select tests.login(tests.id('acc1'));
select tests.ok((select count(*) from audit_log) = 0 and (select count(*) from curriculum_sources) = 0,
                'L''élève ne lit ni le journal ni les sources documentaires');

-- =============================================================================
-- Phase 3 : correction expliquée visible seulement après correction
-- =============================================================================
select tests.login(tests.id('acc1'));
select tests.keep('sub_nc', submit_answer(tests.id('ex1'), '{"selected":["b"]}'));
select tests.ok(not exists (select 1 from correction_feedback(tests.id('sub_nc'))),
                'Phase 3 : pas de correction expliquée avant la correction');
select tests.ok((select explanation from correction_feedback(tests.id('sub1'))) = '12 = 3 × 4',
                'Phase 3 : l''élève lit la correction expliquée après correction');
select tests.login(tests.id('par1'));
select tests.ok((select score from correction_feedback(tests.id('sub1'))) = 0,
                'Phase 3 : le parent lit le retour de correction de son enfant');
select tests.login(tests.id('par2'));
select tests.ok(not exists (select 1 from correction_feedback(tests.id('sub1'))),
                'Phase 3 : un autre parent ne lit pas le retour de correction');
select tests.login(tests.id('enc1'));
update exercise_keys set explanation = '12 = 3 × 4 (corrigé révisé)' where exercise_id = tests.id('ex1');
select tests.login(tests.id('admin'));
select tests.ok(exists (select 1 from audit_log where table_name = 'exercise_keys' and action = 'UPDATE'),
                'Phase 3 : toute modification d''un corrigé est journalisée');

select tests.login(tests.id('coord'));
select tests.fails($$update curriculum_nodes set is_provisional = false where id = tests.id('node_div')$$,
                   'RG14 : un objectif sans source authentifiée reste provisoire');
with s as (insert into curriculum_sources (title, issuer, status, verified_by, verified_at)
           values ('Guide fictif authentifié (test)', 'Test', 'authentifie', tests.id('coord'), now()) returning id)
select tests.keep('src_ok', s.id) from s;
update curriculum_nodes set is_provisional = false, source_id = tests.id('src_ok') where id = tests.id('node_div');
select tests.ok((select not is_provisional from curriculum_nodes where id = tests.id('node_div')),
                'RG14 : avec une source authentifiée, l''objectif peut être marqué vérifié');

-- =============================================================================
-- Phase 4 : suivi et remédiation
-- =============================================================================
select tests.login(tests.id('enc1'));
update remediation_plans set status = 'terminee', closed_at = now() where id = tests.id('plan');
select tests.ok((select level_before = 'non_acquis' and level_now = 'acquis' from remediation_outcome(tests.id('plan'))),
                'Phase 4 : mesure avant / après du premier programme (non acquis → acquis)');

-- Un exercice validé sur le prérequis « tables »
with e as (insert into exercises (level_code, kind, prompt, author_id, status)
           values ('CE1', 'reponse_courte', 'Exercice fictif : 3 × 4 = ?', tests.id('enc1'), 'valide') returning id)
select tests.keep('ex_tables', e.id) from e;
insert into exercise_keys values (tests.id('ex_tables'), '{"accepted":["12"]}', '3 × 4 = 12');
insert into exercise_objectives values (tests.id('ex_tables'), tests.id('node_tables'));

select tests.login(tests.id('enc2'));
select tests.fails($$select propose_remediation(tests.id('stu1'), tests.id('node_div'))$$,
                   'Phase 4 : un encadreur non affecté ne peut pas proposer de remédiation');

select tests.login(tests.id('enc1'));
select tests.keep('plan2', propose_remediation(tests.id('stu1'), tests.id('node_div')));
select tests.ok((select status = 'proposee' and origin = 'regles' from remediation_plans where id = tests.id('plan2')),
                'Phase 4 : programme proposé par les règles, en attente de validation');
select tests.ok((select node_id from remediation_steps where plan_id = tests.id('plan2') and position = 1) = tests.id('node_tables'),
                'Phase 4 : la première étape travaille le prérequis non évalué (tables)');
select tests.ok((select count(*) from remediation_steps where plan_id = tests.id('plan2') and node_id = tests.id('node_div')) >= 2,
                'Phase 4 : le programme reprend ensuite l''objectif visé');
select tests.ok((select diagnosis like '%tables de multiplication%jamais évalué%' from remediation_plans where id = tests.id('plan2')),
                'Phase 4 : le diagnostic explique le prérequis repéré');
select tests.fails($$select propose_remediation(tests.id('stu1'), tests.id('node_div'))$$,
                   'Phase 4 : pas deux programmes ouverts sur le même objectif');
select tests.fails($$select start_remediation(tests.id('plan2'))$$,
                   'Phase 4 : impossible de lancer un programme non validé');

update remediation_plans set status = 'validee', validated_by = tests.id('enc1'), validated_at = now() where id = tests.id('plan2');
select tests.ok(start_remediation(tests.id('plan2')) >= 1, 'Phase 4 : lancement = exercices publiés à l''élève');

select tests.login(tests.id('par1'));
select tests.ok(exists (select 1 from notifications where kind = 'remediation'),
                'Phase 4 : le parent est informé du programme validé');

select tests.login(tests.id('acc1'));
select submit_answer(tests.id('ex_tables'), '{"text":"12"}');
select tests.login(tests.id('enc1'));
select tests.ok((select steps_done = 1 from remediation_outcome(tests.id('plan2'))),
                'Phase 4 : l''étape est cochée dès que l''élève rend l''exercice');

-- Bilan périodique
with r as (insert into reports (student_id, period_start, period_end, body, author_id)
           values (tests.id('stu1'), '2026-11-01', '2026-11-30', '{"synthese":"Bilan fictif"}', tests.id('enc1')) returning id)
select tests.keep('bilan', r.id) from r;
select tests.login(tests.id('par1'));
select tests.ok((select count(*) from reports) = 0, 'Phase 4 : un bilan en brouillon est invisible pour le parent');
select tests.login(tests.id('enc1'));
update reports set status = 'envoye' where id = tests.id('bilan');
select tests.login(tests.id('par1'));
select tests.ok((select count(*) from reports) = 1 and exists (select 1 from notifications where kind = 'bilan'),
                'Phase 4 : le bilan envoyé est visible et notifié au parent');
select tests.login(tests.id('par2'));
select tests.ok((select count(*) from reports) = 0, 'Phase 4 : un autre parent ne voit pas le bilan');
select tests.login(tests.id('enc1'));
select tests.fails($$update reports set body = '{"synthese":"modifié"}' where id = tests.id('bilan')$$,
                   'Phase 4 : un bilan envoyé est figé');
insert into reports (student_id, period_start, period_end, body, status, author_id)
values (tests.id('stu1'), '2026-12-01', '2026-12-31', '{"synthese":"Envoi direct"}', 'envoye', tests.id('enc1'));
select tests.login(tests.id('par1'));
select tests.ok((select count(*) from notifications where kind = 'bilan') = 2
                and (select bool_and(sent_at is not null) from reports),
                'Phase 4 : un bilan envoyé directement est daté et notifié');

-- =============================================================================
-- Phase 5 : audio, wolof, relecteur, français obligatoire, stockage
-- =============================================================================
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
insert into profiles (id, first_name, last_name) values ('00000000-0000-0000-0000-0000000000e1', 'Relecteur', 'FICTIF');
insert into user_roles values ('00000000-0000-0000-0000-0000000000e1', 'relecteur_wolof');
insert into storage.buckets (id, name) values ('audio', 'audio') on conflict do nothing;
set role authenticated;
select tests.keep('rel', '00000000-0000-0000-0000-0000000000e1');

select tests.login(tests.id('rel'));
select tests.ok((select count(*) from students) = 0 and (select count(*) from submissions) = 0,
                'Phase 5 : le relecteur wolof n''a accès à aucun dossier d''élève');
select tests.ok((select count(*) from lessons) >= 1 and (select count(*) from wolof_explanations) >= 2,
                'Phase 5 : le relecteur lit les leçons et les explications à relire');
update wolof_explanations set text_wo = 'texte relu et corrigé (test)', status = 'valide', validated_by = tests.id('rel')
 where origin = 'ia';
select tests.login(tests.id('acc1'));
select tests.ok((select count(*) from wolof_explanations) = 2,
                'Phase 5 : après relecture, l''explication devient visible pour l''élève');

select tests.login(tests.id('enc1'));
update wolof_explanations set text_wo = 'modifié après validation (test)' where origin = 'ia';
select tests.ok((select status from wolof_explanations where origin = 'ia') = 'a_valider',
                'Phase 5 : une explication modifiée après validation repasse « à valider »');

-- Enregistrement français humain : l'encadreur peut le valider lui-même.
insert into media (storage_path, mime_type, lang, origin, lesson_id, recorded_by, status, validated_by)
values (tests.id('enc1') || '/lecon-fr.webm', 'audio/webm', 'fr', 'humain', tests.id('lesson'), tests.id('enc1'), 'valide', tests.id('enc1'));
select tests.fails($$insert into media (storage_path, mime_type, lang, origin, lesson_id, recorded_by, status, validated_by)
                    values ('x/tts.webm', 'audio/webm', 'fr', 'tts', tests.id('lesson'), tests.id('enc1'), 'valide', tests.id('enc1'))$$,
                   'Phase 5 : une voix de synthèse doit être validée par un relecteur');

-- Aide wolof sur un exercice + évaluation « français obligatoire »
insert into wolof_explanations (exercise_id, target_kind, target_text, text_wo, origin, author_id)
values (tests.id('ex2'), 'consigne', 'Calcule', 'aide wolof fictive (test)', 'humain', tests.id('enc1'));
select tests.login(tests.id('coord'));
update wolof_explanations set status = 'valide', validated_by = tests.id('coord') where exercise_id = tests.id('ex2');
select tests.login(tests.id('acc1'));
select tests.ok(exists (select 1 from wolof_explanations where exercise_id = tests.id('ex2')),
                'Phase 5 : l''aide wolof de l''exercice est visible en entraînement');
select tests.login(tests.id('enc1'));
with a as (insert into assessments (title, kind, level_code, french_only, status, author_id)
           values ('Évaluation fictive en français', 'sommative', 'CE2', true, 'valide', tests.id('enc1')) returning id)
select tests.keep('eval_fr', a.id) from a;
insert into assessment_items values (tests.id('eval_fr'), tests.id('ex2'), 1, 1);
insert into publications (assessment_id, student_id, published_by) values (tests.id('eval_fr'), tests.id('stu1'), tests.id('enc1'));
select tests.login(tests.id('acc1'));
select tests.ok(not exists (select 1 from wolof_explanations where exercise_id = tests.id('ex2')),
                'Phase 5 : l''aide wolof est masquée pour un exercice d''évaluation « français obligatoire »');

-- Fichiers audio : dépôt dans son propre dossier, lecture si la fiche est visible
select tests.login(tests.id('enc1'));
insert into storage.objects (bucket_id, name) values ('audio', tests.id('enc1') || '/lecon-fr.webm');
select tests.fails($$insert into storage.objects (bucket_id, name) values ('audio', tests.id('enc2') || '/intrus.webm')$$,
                   'Phase 5 : on ne dépose un fichier audio que dans son propre dossier');
insert into storage.objects (bucket_id, name) values ('audio', tests.id('enc1') || '/brouillon.webm');
select tests.login(tests.id('acc1'));
select tests.ok((select count(*) from storage.objects) = 1,
                'Phase 5 : l''élève n''accède qu''aux fichiers audio liés à un contenu validé et publié');
select tests.login(tests.id('acc2'));
select tests.ok((select count(*) from storage.objects) = 0, 'Phase 5 : un autre élève n''accède à aucun fichier audio');
select tests.login(tests.id('acc1'));
select tests.fails($$insert into storage.objects (bucket_id, name) values ('audio', tests.id('acc1') || '/x.webm')$$,
                   'Phase 5 : un élève ne dépose pas de fichier audio');

-- =============================================================================
-- Phase 6 : assistant IA (journal, indices)
-- =============================================================================
select tests.login(tests.id('enc1'));
select tests.fails($$insert into ai_requests (requester_id, purpose) values (tests.id('enc1'), 'test')$$,
                   'Phase 6 : un utilisateur n''écrit pas lui-même dans le journal de l''IA');
reset role;
insert into ai_requests (requester_id, purpose, role, student_id) values
  (tests.id('enc1'), 'analyse_eleve', 'encadreur', tests.id('stu1')),
  (tests.id('acc1'), 'indice', 'eleve', null);
set role authenticated;
select tests.login(tests.id('enc1'));
select tests.ok((select count(*) from ai_requests) = 1 and ai_usage_today() = 1,
                'Phase 6 : chacun ne voit que ses propres appels à l''IA et sa consommation du jour');
select tests.login(tests.id('coord'));
select tests.ok((select count(*) from ai_requests) = 2, 'Phase 6 : la coordination voit le journal complet de l''IA');

-- Indices : entraînement oui, évaluation non
select tests.login(tests.id('enc1'));
with e as (insert into exercises (level_code, kind, prompt, author_id, status)
           values ('CE2', 'reponse_courte', 'Exercice fictif d''entraînement : 10 ÷ 2 = ?', tests.id('enc1'), 'valide') returning id)
select tests.keep('ex_indice', e.id) from e;
insert into publications (exercise_id, student_id, published_by) values (tests.id('ex_indice'), tests.id('stu1'), tests.id('enc1'));
select tests.login(tests.id('acc1'));
select tests.ok(family_hint_allowed(tests.id('ex_indice')), 'Phase 6 : un indice est permis sur un exercice d''entraînement');
select tests.ok(not family_hint_allowed(tests.id('ex2')), 'Phase 6 : aucun indice sur un exercice qui fait partie d''une évaluation');
select tests.login(tests.id('acc2'));
select tests.ok(not family_hint_allowed(tests.id('ex_indice')), 'Phase 6 : aucun indice sur un exercice qui n''est pas publié à l''élève');

-- =============================================================================
-- Phase 7 : durcissement
-- =============================================================================
select tests.login(tests.id('acc1'));
select tests.fails($$select auto_score from submissions$$,
                   'Phase 7 : l''élève ne peut pas lire la note automatique avant correction');
select tests.ok((select count(*) from auto_scores(array(select id from submissions))) = 0,
                'Phase 7 : la fonction des notes automatiques ne renvoie rien à un élève');
select tests.ok((select count(*) from submissions) > 0, 'Phase 7 : l''élève lit toujours ses copies (sans la note automatique)');
select tests.login(tests.id('par1'));
select tests.fails($$select auto_score from submissions$$, 'Phase 7 : le parent ne lit pas la note automatique');
select tests.login(tests.id('enc1'));
select tests.ok((select count(*) from auto_scores(array(select id from submissions))) > 0,
                'Phase 7 : l''encadreur affecté lit les notes automatiques de ses élèves');
select tests.login(tests.id('enc2'));
select tests.ok((select count(*) from auto_scores(array[tests.id('sub1')])) = 0,
                'Phase 7 : un encadreur non affecté ne lit pas ces notes');

reset role;
select tests.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
                'Phase 7 : toutes les tables ont des règles d''accès (RLS) activées');
select tests.ok(not exists (select 1 from information_schema.role_table_grants
                            where grantee = 'anon' and table_schema = 'public'),
                'Phase 7 : un visiteur non connecté n''a aucun droit sur aucune table');
select tests.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'Phase 7 : toutes les fonctions à privilèges fixent leur search_path (pas de détournement)');

\echo '=== TOUS LES TESTS SONT PASSÉS ==='
