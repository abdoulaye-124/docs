-- =============================================================================
-- TERANGA ÉDUCATION — Migration 5 (Phase 4) : suivi et remédiation
--
-- Principe : le système PROPOSE (règles transparentes), l'encadreur DÉCIDE.
-- Toutes les fonctions sont SECURITY INVOKER : les règles RLS de l'appelant
-- s'appliquent (un encadreur n'agit que sur ses élèves).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Proposition d'un programme de remédiation (règles, sans IA)
--    a) on examine les prérequis de l'objectif (jusqu'à 5 niveaux) ;
--    b) chaque prérequis non acquis, en cours ou jamais évalué devient une étape,
--       avec jusqu'à 2 exercices validés (du plus facile au plus difficile) ;
--    c) on termine par jusqu'à 3 exercices validés sur l'objectif lui-même, en
--       commençant par ceux que l'élève a déjà tentés.
--    L'encadreur peut ensuite retirer des étapes avant de valider.
-- -----------------------------------------------------------------------------
create or replace function propose_remediation(p_student uuid, p_node uuid)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_plan uuid;
  v_pos int := 0;
  v_lignes text[] := '{}';
  v_cible text;
  v_niveau mastery_level;
  v_pct numeric;
  r record;
  e record;
begin
  if not can_teach_student(p_student) then
    raise exception 'Élève non affecté à votre compte' using errcode = '42501';
  end if;
  if exists (select 1 from remediation_plans where student_id = p_student and target_node_id = p_node
             and status in ('proposee', 'validee', 'en_cours')) then
    raise exception 'Un programme de remédiation est déjà ouvert pour cet objectif' using errcode = 'P0001';
  end if;

  select label into v_cible from curriculum_nodes where id = p_node;
  select level, score_pct into v_niveau, v_pct from current_mastery where student_id = p_student and node_id = p_node;
  v_lignes := array_append(v_lignes, format('Objectif visé : %s — niveau actuel : %s%s.', v_cible,
    coalesce(replace(v_niveau::text, '_', ' '), 'non évalué'), coalesce(format(' (%s %%)', round(v_pct)), ''))::text);

  insert into remediation_plans (student_id, target_node_id, diagnosis, origin, status, proposed_by)
  values (p_student, p_node, 'en préparation', 'regles', 'proposee', auth.uid())
  returning id into v_plan;

  for r in select * from prerequisite_status(p_student, p_node)
           where level is distinct from 'acquis' order by level nulls first loop
    v_lignes := array_append(v_lignes, format('Prérequis « %s » : %s.', r.label,
      coalesce(replace(r.level::text, '_', ' ') || coalesce(format(' (%s %%)', round(r.score_pct)), ''), 'jamais évalué — à vérifier'))::text);
    for e in select ex.id from exercises ex join exercise_objectives eo on eo.exercise_id = ex.id
             where eo.node_id = r.prerequisite_id and ex.status = 'valide'
             order by ex.difficulty, ex.created_at limit 2 loop
      v_pos := v_pos + 1;
      insert into remediation_steps (plan_id, position, node_id, exercise_id) values (v_plan, v_pos, r.prerequisite_id, e.id);
    end loop;
  end loop;

  if v_pos = 0 then
    v_lignes := array_append(v_lignes, 'Aucun prérequis non maîtrisé repéré : reprise directe de l''objectif, du plus facile au plus difficile.'::text);
  end if;

  -- Sur l'objectif visé : d'abord les exercices déjà tentés par l'élève (refaire
  -- ce qui a été raté), puis les autres, du plus facile au plus difficile.
  for e in select ex.id from exercises ex join exercise_objectives eo on eo.exercise_id = ex.id
           where eo.node_id = p_node and ex.status = 'valide'
           order by exists (select 1 from submissions s where s.student_id = p_student and s.exercise_id = ex.id) desc,
                    ex.difficulty, ex.created_at limit 3 loop
    v_pos := v_pos + 1;
    insert into remediation_steps (plan_id, position, node_id, exercise_id) values (v_plan, v_pos, p_node, e.id);
  end loop;

  if v_pos = 0 then
    v_lignes := array_append(v_lignes, 'ATTENTION : aucun exercice validé n''est rattaché à ces objectifs. Créez-en avant de lancer le programme.'::text);
  end if;
  v_lignes := array_append(v_lignes, 'Proposition automatique fondée sur les résultats et les prérequis : à vérifier et valider par l''encadreur.'::text);

  update remediation_plans set diagnosis = array_to_string(v_lignes, E'\n') where id = v_plan;
  return v_plan;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Lancement : publication des exercices du programme à l'élève.
-- -----------------------------------------------------------------------------
create or replace function start_remediation(p_plan uuid, p_due date default null)
returns int
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v remediation_plans%rowtype;
  n int;
begin
  select * into v from remediation_plans where id = p_plan;
  if v.id is null or not can_teach_student(v.student_id) then
    raise exception 'Programme introuvable' using errcode = '42501';
  end if;
  if v.status <> 'validee' then
    raise exception 'Le programme doit d''abord être validé par un encadreur' using errcode = 'P0001';
  end if;
  insert into publications (exercise_id, student_id, published_by, due_at, message)
  select s.exercise_id, v.student_id, auth.uid(),
         case when p_due is not null then (p_due + time '23:59')::timestamptz end,
         'Programme de remédiation'
  from remediation_steps s
  where s.plan_id = p_plan and s.exercise_id is not null
    and not exists (select 1 from publications p where p.exercise_id = s.exercise_id and p.student_id = v.student_id);
  get diagnostics n = row_count;
  update remediation_plans set status = 'en_cours' where id = p_plan;
  return n;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Une étape est faite dès que l'élève rend l'exercice correspondant.
-- -----------------------------------------------------------------------------
create or replace function mark_remediation_step_done() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update remediation_steps s set done_at = now()
  from remediation_plans p
  where s.plan_id = p.id and p.student_id = new.student_id and p.status = 'en_cours'
    and s.exercise_id = new.exercise_id and s.done_at is null;
  return new;
end $$;
create trigger trg_remediation_step_done after insert on submissions
  for each row execute function mark_remediation_step_done();

-- -----------------------------------------------------------------------------
-- 4. Mesure avant / après : niveau au moment de la proposition, niveau actuel.
-- -----------------------------------------------------------------------------
create or replace function remediation_outcome(p_plan uuid)
returns table (level_before mastery_level, pct_before numeric, level_now mastery_level, pct_now numeric,
               steps_total int, steps_done int)
language sql stable security invoker set search_path = public, pg_temp as $$
  select
    (select m.level from mastery_records m where m.student_id = p.student_id and m.node_id = p.target_node_id
       and m.recorded_at <= p.created_at order by m.seq desc limit 1),
    (select m.score_pct from mastery_records m where m.student_id = p.student_id and m.node_id = p.target_node_id
       and m.recorded_at <= p.created_at order by m.seq desc limit 1),
    (select c.level from current_mastery c where c.student_id = p.student_id and c.node_id = p.target_node_id),
    (select c.score_pct from current_mastery c where c.student_id = p.student_id and c.node_id = p.target_node_id),
    (select count(*)::int from remediation_steps s where s.plan_id = p.id),
    (select count(*)::int from remediation_steps s where s.plan_id = p.id and s.done_at is not null)
  from remediation_plans p
  where p.id = p_plan
$$;

-- -----------------------------------------------------------------------------
-- 5. Information des familles : programme validé, bilan envoyé.
-- -----------------------------------------------------------------------------
create or replace function notify_family(p_student uuid, p_kind text, p_title text, p_link text)
returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into notifications (user_id, kind, title, link)
  select guardian_id, p_kind, p_title, p_link from student_guardians
  where student_id = p_student and validated_at is not null
  union
  select profile_id, p_kind, p_title, p_link from students
  where id = p_student and profile_id is not null and p_kind <> 'bilan'
$$;
revoke execute on function notify_family(uuid, text, text, text) from public, anon, authenticated;

create or replace function notify_on_plan_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'validee' and old.status is distinct from 'validee' then
    perform notify_family(new.student_id, 'remediation',
      'Un programme de remédiation a été mis en place', '/parent/enfant/' || new.student_id || '/suivi');
  end if;
  return new;
end $$;
create trigger trg_plan_notify after update of status on remediation_plans
  for each row execute function notify_on_plan_status();

create or replace function notify_on_report_sent() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- À la création (bilan envoyé directement) comme à la modification.
  if new.status = 'envoye' and (tg_op = 'INSERT' or old.status is distinct from 'envoye') then
    perform notify_family(new.student_id, 'bilan', 'Nouveau bilan disponible', '/parent/enfant/' || new.student_id || '/suivi');
  end if;
  return new;
end $$;
create trigger trg_report_notify after insert or update of status on reports
  for each row execute function notify_on_report_sent();

-- Un bilan envoyé est figé (traçabilité de ce que la famille a reçu).
create or replace function freeze_sent_report() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'envoye' then
    raise exception 'Un bilan envoyé ne peut plus être modifié' using errcode = 'P0001';
  end if;
  if new.status = 'envoye' and new.sent_at is null then new.sent_at := now(); end if;
  return new;
end $$;
create trigger trg_report_freeze before insert or update on reports
  for each row execute function freeze_sent_report();

-- Libellé plus explicite pour les exercices publiés directement (ex. remédiation).
create or replace function notify_on_publication() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text;
begin
  v_title := case
    when new.lesson_id is not null then 'Nouvelle leçon : ' || (select title from lessons where id = new.lesson_id)
    when new.assessment_id is not null then 'Nouvelle évaluation : ' || (select title from assessments where id = new.assessment_id)
    else 'Nouvel exercice' || coalesce(' (' || new.message || ')', '') end;

  insert into notifications (user_id, kind, title, link)
  select distinct u.user_id, 'nouvelle_publication', v_title, '/publications/' || new.id
  from (
    select s.id as student_id from students s
    where s.id = new.student_id
       or s.id in (select student_id from group_members
                   where group_id = new.group_id and is_active_period(from_date, to_date))
  ) target
  cross join lateral (
    select profile_id as user_id from students where id = target.student_id and profile_id is not null
    union
    select guardian_id from student_guardians where student_id = target.student_id and validated_at is not null
  ) u;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Droits d'exécution
-- -----------------------------------------------------------------------------
grant execute on function propose_remediation(uuid, uuid), start_remediation(uuid, date),
  remediation_outcome(uuid) to authenticated;
revoke execute on function propose_remediation(uuid, uuid), start_remediation(uuid, date),
  remediation_outcome(uuid) from anon, public;
