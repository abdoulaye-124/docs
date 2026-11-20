-- =============================================================================
-- TERANGA ÉDUCATION — Migration 2 : sécurité (RLS) et logique métier en base
--
-- La base refuse elle-même toute lecture ou écriture non autorisée, même si
-- l'interface comporte une erreur. Les fonctions d'aide sont SECURITY DEFINER
-- (elles lisent les tables d'affectation sans être bloquées par RLS) et
-- STABLE (une seule évaluation par requête).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fonctions d'aide aux autorisations
-- -----------------------------------------------------------------------------
create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

-- Direction ou coordination : vision d'ensemble du centre.
create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles
                 where user_id = auth.uid() and role in ('admin', 'coordinateur'))
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles
                 where user_id = auth.uid() and role in ('admin', 'coordinateur', 'encadreur'))
$$;

create or replace function is_active_period(f date, t date) returns boolean
language sql immutable as $$
  select f <= current_date and (t is null or t >= current_date)
$$;

-- Encadreur affecté à l'élève : référent, ou anime un groupe actif dont l'élève
-- est membre actif.
create or replace function is_assigned_staff(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from students s
                 where s.id = p_student and s.referent_staff_id = auth.uid())
      or exists (select 1
                 from group_staff gs
                 join group_members gm on gm.group_id = gs.group_id
                 join groups g on g.id = gs.group_id and g.is_active
                 where gs.staff_id = auth.uid()
                   and gm.student_id = p_student
                   and is_active_period(gs.from_date, gs.to_date)
                   and is_active_period(gm.from_date, gm.to_date))
$$;

create or replace function is_guardian_of(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from student_guardians
                 where student_id = p_student and guardian_id = auth.uid()
                   and validated_at is not null)
$$;

create or replace function is_self_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from students where id = p_student and profile_id = auth.uid())
$$;

-- Peut ENSEIGNER à l'élève (écrire dans son dossier).
create or replace function can_teach_student(p_student uuid) returns boolean
language sql stable as $$
  select is_manager() or (has_role('encadreur') and is_assigned_staff(p_student))
$$;

-- Peut LIRE le dossier de l'élève.
create or replace function can_read_student(p_student uuid) returns boolean
language sql stable as $$
  select can_teach_student(p_student) or is_guardian_of(p_student) or is_self_student(p_student)
$$;

-- Élèves dont l'utilisateur courant est l'élève lui-même ou un parent validé.
create or replace function family_student_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from students where profile_id = auth.uid()
  union
  select student_id from student_guardians
  where guardian_id = auth.uid() and validated_at is not null
$$;

create or replace function is_group_staff(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from group_staff
                 where group_id = p_group and staff_id = auth.uid()
                   and is_active_period(from_date, to_date))
$$;

create or replace function is_family_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from group_members
                 where group_id = p_group
                   and student_id in (select family_student_ids())
                   and is_active_period(from_date, to_date))
$$;

-- Leçon visible côté famille : validée ET publiée vers l'élève ou son groupe.
create or replace function family_can_see_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from lessons l join publications p on p.lesson_id = l.id
    where l.id = p_lesson and l.status = 'valide'
      and ( p.student_id in (select family_student_ids())
         or (p.group_id is not null and is_family_group(p.group_id))))
$$;

create or replace function family_can_see_assessment(p_assessment uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from assessments a join publications p on p.assessment_id = a.id
    where a.id = p_assessment and a.status = 'valide'
      and ( p.student_id in (select family_student_ids())
         or (p.group_id is not null and is_family_group(p.group_id))))
$$;

-- Exercice visible côté famille : validé, et publié directement, ou via une
-- leçon publiée, ou via une évaluation publiée.
create or replace function family_can_see_exercise(p_exercise uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from exercises e
    where e.id = p_exercise and e.status = 'valide' and (
         (e.lesson_id is not null and family_can_see_lesson(e.lesson_id))
      or exists (select 1 from assessment_items ai
                 where ai.exercise_id = e.id and family_can_see_assessment(ai.assessment_id))
      or exists (select 1 from publications p
                 where p.exercise_id = e.id
                   and ( p.student_id in (select family_student_ids())
                      or (p.group_id is not null and is_family_group(p.group_id))))))
$$;

-- Profils visibles : soi-même ; direction ; le personnel entre lui ; et les
-- personnes liées à un même élève (parent ⇄ encadreur affecté).
create or replace function can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_profile = auth.uid()
      or is_manager()
      or (is_staff() and exists (select 1 from user_roles
                                 where user_id = p_profile
                                   and role in ('admin', 'coordinateur', 'encadreur')))
      or exists (select 1 from student_guardians sg
                 where sg.guardian_id = p_profile and is_assigned_staff(sg.student_id))
      or exists (select 1 from students s
                 where s.profile_id = p_profile and is_assigned_staff(s.id))
      or exists (select 1 from students s
                 where s.id in (select family_student_ids())
                   and (s.referent_staff_id = p_profile
                        or exists (select 1 from group_members gm
                                   join group_staff gs on gs.group_id = gm.group_id
                                   where gm.student_id = s.id and gs.staff_id = p_profile
                                     and is_active_period(gm.from_date, gm.to_date)
                                     and is_active_period(gs.from_date, gs.to_date))))
$$;

create or replace function is_conversation_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from conversation_participants
                 where conversation_id = p_conv and user_id = auth.uid())
$$;

-- Personnes autorisées à échanger au sujet d'un élève.
create or replace function may_discuss_student(p_user uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = p_user and role in ('admin', 'coordinateur'))
      or exists (select 1 from student_guardians
                 where student_id = p_student and guardian_id = p_user
                   and validated_at is not null and is_authorized_contact)
      or exists (select 1 from students where id = p_student and referent_staff_id = p_user)
      or exists (select 1 from group_staff gs join group_members gm on gm.group_id = gs.group_id
                 where gs.staff_id = p_user and gm.student_id = p_student
                   and is_active_period(gs.from_date, gs.to_date)
                   and is_active_period(gm.from_date, gm.to_date))
$$;

-- -----------------------------------------------------------------------------
-- 2. Activation de RLS sur TOUTES les tables
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Politiques
-- -----------------------------------------------------------------------------

-- Identité
create policy profiles_select on profiles for select to authenticated using (can_see_profile(id));
create policy profiles_admin_write on profiles for all to authenticated
  using (has_role('admin')) with check (has_role('admin'));

create policy roles_select on user_roles for select to authenticated
  using (user_id = auth.uid() or is_manager());
create policy roles_admin_write on user_roles for all to authenticated
  using (has_role('admin')) with check (has_role('admin'));

create policy staff_profiles_select on staff_profiles for select to authenticated using (is_staff());
create policy staff_profiles_write on staff_profiles for all to authenticated
  using (is_manager()) with check (is_manager());

create policy settings_select on app_settings for select to authenticated using (true);
create policy settings_write on app_settings for all to authenticated
  using (has_role('admin')) with check (has_role('admin'));

-- Données de référence du centre
create policy school_years_select on school_years for select to authenticated using (true);
create policy school_years_write on school_years for all to authenticated
  using (is_manager()) with check (is_manager());
create policy levels_select on levels for select to authenticated using (true);
create policy levels_write on levels for all to authenticated
  using (has_role('admin')) with check (has_role('admin'));
create policy rooms_select on rooms for select to authenticated using (true);
create policy rooms_write on rooms for all to authenticated
  using (is_manager()) with check (is_manager());
create policy subjects_select on subjects for select to authenticated using (true);
create policy subjects_write on subjects for all to authenticated
  using (is_manager()) with check (is_manager());

-- Élèves : l'administration inscrit ; la coordination peut réaffecter.
create policy students_select on students for select to authenticated using (can_read_student(id));
create policy students_insert on students for insert to authenticated with check (has_role('admin'));
create policy students_update on students for update to authenticated
  using (is_manager()) with check (is_manager());
create policy students_delete on students for delete to authenticated using (has_role('admin'));

create policy guardians_select on student_guardians for select to authenticated
  using (is_manager() or guardian_id = auth.uid() or can_teach_student(student_id));
create policy guardians_write on student_guardians for all to authenticated
  using (has_role('admin')) with check (has_role('admin'));

create policy consents_select on consents for select to authenticated
  using (is_manager() or guardian_id = auth.uid() or can_teach_student(student_id));
create policy consents_insert on consents for insert to authenticated
  with check (has_role('admin') or (guardian_id = auth.uid() and is_guardian_of(student_id)));
create policy consents_revoke on consents for update to authenticated
  using (has_role('admin') or guardian_id = auth.uid())
  with check (has_role('admin') or guardian_id = auth.uid());

-- Référentiel : lecture pour tous les connectés (libellés de progression),
-- sources réservées au personnel, écriture réservée à la direction/coordination.
create policy cur_sources_select on curriculum_sources for select to authenticated using (is_staff());
create policy cur_sources_write on curriculum_sources for all to authenticated
  using (is_manager()) with check (is_manager());
create policy cur_versions_select on curriculum_versions for select to authenticated using (true);
create policy cur_versions_write on curriculum_versions for all to authenticated
  using (is_manager()) with check (is_manager());
create policy cur_vs_select on curriculum_version_sources for select to authenticated using (is_staff());
create policy cur_vs_write on curriculum_version_sources for all to authenticated
  using (is_manager()) with check (is_manager());
create policy cur_types_select on curriculum_node_types for select to authenticated using (true);
create policy cur_types_write on curriculum_node_types for all to authenticated
  using (is_manager()) with check (is_manager());
create policy cur_nodes_select on curriculum_nodes for select to authenticated using (true);
create policy cur_nodes_write on curriculum_nodes for all to authenticated
  using (is_manager()) with check (is_manager());
create policy prereq_select on node_prerequisites for select to authenticated using (true);
create policy prereq_write on node_prerequisites for all to authenticated
  using (is_manager()) with check (is_manager());

-- Groupes
create policy groups_select on groups for select to authenticated
  using (is_manager() or is_group_staff(id) or is_family_group(id));
create policy groups_write on groups for all to authenticated
  using (is_manager()) with check (is_manager());
create policy gm_select on group_members for select to authenticated
  using (is_manager() or is_group_staff(group_id) or student_id in (select family_student_ids()));
create policy gm_write on group_members for all to authenticated
  using (is_manager()) with check (is_manager());
create policy gs_select on group_staff for select to authenticated
  using (is_manager() or staff_id = auth.uid() or is_family_group(group_id));
create policy gs_write on group_staff for all to authenticated
  using (is_manager()) with check (is_manager());

-- Séances
create or replace function can_see_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from sessions s where s.id = p_session
                 and (is_manager() or s.staff_id = auth.uid()))
      or exists (select 1 from session_participants sp
                 where sp.session_id = p_session
                   and ( (sp.group_id is not null and (is_group_staff(sp.group_id) or is_family_group(sp.group_id)))
                      or (sp.student_id is not null and can_read_student(sp.student_id))))
$$;

create policy sessions_select on sessions for select to authenticated using (can_see_session(id));
create policy sessions_manage on sessions for all to authenticated
  using (is_manager()) with check (is_manager());
create policy sessions_staff_update on sessions for update to authenticated
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());

create policy sp_select on session_participants for select to authenticated using (can_see_session(session_id));
create policy sp_write on session_participants for all to authenticated
  using (is_manager()) with check (is_manager());

create or replace function is_session_staff(p_session uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from sessions where id = p_session and staff_id = auth.uid())
$$;

create policy attendance_select on attendance for select to authenticated
  using (is_manager() or is_session_staff(session_id) or can_read_student(student_id));
create policy attendance_write on attendance for all to authenticated
  using (is_manager() or is_session_staff(session_id))
  with check ((is_manager() or is_session_staff(session_id)) and recorded_by = auth.uid());

create policy documents_select on documents for select to authenticated
  using (owner_id = auth.uid() or is_manager() or (student_id is not null and can_teach_student(student_id)));
create policy documents_insert on documents for insert to authenticated
  with check (owner_id = auth.uid() and is_staff()
              and (student_id is null or can_teach_student(student_id)));
create policy documents_delete on documents for delete to authenticated
  using (owner_id = auth.uid() or has_role('admin'));

-- Ressources pédagogiques : bibliothèque ouverte au personnel ; la famille ne
-- voit que ce qui est VALIDÉ et PUBLIÉ pour l'enfant.
create policy sequences_select on sequences for select to authenticated using (is_staff());
create policy sequences_insert on sequences for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
create policy sequences_update on sequences for update to authenticated
  using (author_id = auth.uid() or is_manager()) with check (author_id = auth.uid() or is_manager());

create policy lessons_select on lessons for select to authenticated
  using (is_staff() or family_can_see_lesson(id));
create policy lessons_insert on lessons for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
create policy lessons_update on lessons for update to authenticated
  using (author_id = auth.uid() or is_manager())
  with check ((author_id = auth.uid() or is_manager())
              and (status <> 'valide' or validated_by = auth.uid() or is_manager()));
create policy lessons_delete on lessons for delete to authenticated
  using (is_manager() or (author_id = auth.uid() and status = 'brouillon'));

create policy lesson_obj_select on lesson_objectives for select to authenticated using (true);
create policy lesson_obj_write on lesson_objectives for all to authenticated
  using (is_manager() or exists (select 1 from lessons where id = lesson_id and author_id = auth.uid()))
  with check (is_manager() or exists (select 1 from lessons where id = lesson_id and author_id = auth.uid()));

create policy exercises_select on exercises for select to authenticated
  using (is_staff() or family_can_see_exercise(id));
create policy exercises_insert on exercises for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
create policy exercises_update on exercises for update to authenticated
  using (author_id = auth.uid() or is_manager()) with check (author_id = auth.uid() or is_manager());
create policy exercises_delete on exercises for delete to authenticated
  using (is_manager() or (author_id = auth.uid() and status = 'brouillon'));

-- Corrigés : personnel uniquement. Aucune politique pour les familles.
create policy keys_select on exercise_keys for select to authenticated using (is_staff());
create policy keys_write on exercise_keys for all to authenticated
  using (is_manager() or exists (select 1 from exercises where id = exercise_id and author_id = auth.uid()))
  with check (is_manager() or exists (select 1 from exercises where id = exercise_id and author_id = auth.uid()));

create policy ex_obj_select on exercise_objectives for select to authenticated using (true);
create policy ex_obj_write on exercise_objectives for all to authenticated
  using (is_manager() or exists (select 1 from exercises where id = exercise_id and author_id = auth.uid()))
  with check (is_manager() or exists (select 1 from exercises where id = exercise_id and author_id = auth.uid()));

create policy media_select on media for select to authenticated
  using (is_staff()
         or (status = 'valide' and ( (lesson_id is not null and family_can_see_lesson(lesson_id))
                                  or (exercise_id is not null and family_can_see_exercise(exercise_id)))));
create policy media_insert on media for insert to authenticated
  with check (is_staff() and recorded_by = auth.uid());
create policy media_update on media for update to authenticated
  using (is_staff()) with check (is_staff() and (status <> 'valide' or validated_by = auth.uid()));

create policy wolof_select on wolof_explanations for select to authenticated
  using (is_staff()
         or (status = 'valide' and ( (lesson_id is not null and family_can_see_lesson(lesson_id))
                                  or (exercise_id is not null and family_can_see_exercise(exercise_id)))));
create policy wolof_insert on wolof_explanations for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
create policy wolof_update on wolof_explanations for update to authenticated
  using (is_staff()) with check (is_staff() and (status <> 'valide' or validated_by = auth.uid()));

create policy assessments_select on assessments for select to authenticated
  using (is_staff() or family_can_see_assessment(id));
create policy assessments_insert on assessments for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
create policy assessments_update on assessments for update to authenticated
  using (author_id = auth.uid() or is_manager()) with check (author_id = auth.uid() or is_manager());
create policy items_select on assessment_items for select to authenticated
  using (is_staff() or family_can_see_assessment(assessment_id));
create policy items_write on assessment_items for all to authenticated
  using (is_manager() or exists (select 1 from assessments where id = assessment_id and author_id = auth.uid()))
  with check (is_manager() or exists (select 1 from assessments where id = assessment_id and author_id = auth.uid()));

-- Publication : uniquement d'un contenu VALIDÉ, vers un public dont on a la charge.
create or replace function content_is_validated(p_lesson uuid, p_assessment uuid, p_exercise uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select status = 'valide' from lessons where id = p_lesson), false)
      or coalesce((select status = 'valide' from assessments where id = p_assessment), false)
      or coalesce((select status = 'valide' from exercises where id = p_exercise), false)
$$;

-- NB : la politique de lecture porte sur les COLONNES de la ligne (et non sur
-- une recherche par id), sinon INSERT … RETURNING échoue : la ligne en cours
-- d'insertion n'est pas encore visible pour une sous-requête.
create policy pub_select on publications for select to authenticated
  using (is_manager()
         or published_by = auth.uid()
         or (group_id is not null and (is_group_staff(group_id) or is_family_group(group_id)))
         or (student_id is not null and can_read_student(student_id)));
create policy pub_insert on publications for insert to authenticated
  with check (published_by = auth.uid()
              and content_is_validated(lesson_id, assessment_id, exercise_id)
              and ( is_manager()
                 or (has_role('encadreur') and group_id is not null and is_group_staff(group_id))
                 or (has_role('encadreur') and student_id is not null and can_teach_student(student_id))));
create policy pub_delete on publications for delete to authenticated
  using (published_by = auth.uid() or is_manager());

-- Copies d'élèves : l'élève soumet via la fonction submit_answer() (score
-- calculé côté serveur, impossible à falsifier). Le personnel peut saisir une
-- copie papier pour un élève dont il a la charge.
create policy sub_select on submissions for select to authenticated using (can_read_student(student_id));
create policy sub_staff_insert on submissions for insert to authenticated
  with check (can_teach_student(student_id) and auto_score is null);
create policy sub_staff_update on submissions for update to authenticated
  using (can_teach_student(student_id)) with check (can_teach_student(student_id));

create or replace function submission_student(p_sub uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select student_id from submissions where id = p_sub
$$;

create policy corr_select on corrections for select to authenticated
  using (can_read_student(submission_student(submission_id)));
create policy corr_insert on corrections for insert to authenticated
  with check (corrector_id = auth.uid() and can_teach_student(submission_student(submission_id)));
create policy corr_update on corrections for update to authenticated
  using (corrector_id = auth.uid() or is_manager())
  with check (corrector_id = auth.uid() or is_manager());

-- Maîtrise : lecture du dossier ; saisie manuelle par le personnel (justifiée).
create policy mastery_select on mastery_records for select to authenticated using (can_read_student(student_id));
create policy mastery_insert on mastery_records for insert to authenticated
  with check (can_teach_student(student_id) and recorded_by = auth.uid()
              and source in ('encadreur', 'diagnostic'));

create policy obs_select on observations for select to authenticated
  using (can_teach_student(student_id) or (visible_to_parents and is_guardian_of(student_id)));
create policy obs_insert on observations for insert to authenticated
  with check (author_id = auth.uid() and can_teach_student(student_id));
create policy obs_update on observations for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy reports_select on reports for select to authenticated
  using (can_teach_student(student_id)
         or (status = 'envoye' and (is_guardian_of(student_id) or is_self_student(student_id))));
create policy reports_write on reports for all to authenticated
  using (can_teach_student(student_id)) with check (can_teach_student(student_id));

create policy plans_select on remediation_plans for select to authenticated
  using (can_teach_student(student_id)
         or (status in ('validee', 'en_cours', 'terminee') and can_read_student(student_id)));
create policy plans_insert on remediation_plans for insert to authenticated
  with check (can_teach_student(student_id));
create policy plans_update on remediation_plans for update to authenticated
  using (can_teach_student(student_id))
  with check (can_teach_student(student_id)
              and (status in ('proposee', 'refusee') or validated_by = auth.uid() or is_manager()));

create or replace function plan_student(p_plan uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select student_id from remediation_plans where id = p_plan
$$;
create or replace function plan_is_visible(p_plan uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from remediation_plans where id = p_plan
                 and (can_teach_student(student_id)
                      or (status in ('validee', 'en_cours', 'terminee') and can_read_student(student_id))))
$$;
create policy steps_select on remediation_steps for select to authenticated using (plan_is_visible(plan_id));
create policy steps_write on remediation_steps for all to authenticated
  using (can_teach_student(plan_student(plan_id))) with check (can_teach_student(plan_student(plan_id)));

-- CFEE
create policy exf_select on exam_frameworks for select to authenticated using (true);
create policy exf_write on exam_frameworks for all to authenticated
  using (is_manager()) with check (is_manager());
create policy exs_select on exam_subjects for select to authenticated using (true);
create policy exs_write on exam_subjects for all to authenticated
  using (is_manager()) with check (is_manager());
create policy mock_select on mock_exams for select to authenticated using (true);
create policy mock_write on mock_exams for all to authenticated
  using (is_staff()) with check (is_staff());
create policy mockr_select on mock_exam_results for select to authenticated using (can_read_student(student_id));
create policy mockr_write on mock_exam_results for all to authenticated
  using (can_teach_student(student_id)) with check (can_teach_student(student_id));

-- Communication encadrée
create or replace function conversation_student(p_conv uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select student_id from conversations where id = p_conv
$$;

create policy conv_select on conversations for select to authenticated
  using (created_by = auth.uid() or is_conversation_participant(id) or is_manager());
create policy conv_insert on conversations for insert to authenticated
  with check (created_by = auth.uid() and may_discuss_student(auth.uid(), student_id));
create policy convp_select on conversation_participants for select to authenticated
  using (is_conversation_participant(conversation_id) or is_manager());
create policy convp_insert on conversation_participants for insert to authenticated
  with check ((is_conversation_participant(conversation_id)
               or exists (select 1 from conversations where id = conversation_id and created_by = auth.uid()))
              and may_discuss_student(user_id, conversation_student(conversation_id)));
create policy msg_select on messages for select to authenticated
  using (is_conversation_participant(conversation_id) or is_manager());
create policy msg_insert on messages for insert to authenticated
  with check (author_id = auth.uid() and is_conversation_participant(conversation_id)
              and may_discuss_student(auth.uid(), conversation_student(conversation_id)));
create policy reads_all on message_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notif_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy help_select on help_requests for select to authenticated using (can_read_student(student_id));
create policy help_insert on help_requests for insert to authenticated
  with check (is_self_student(student_id) or is_guardian_of(student_id));
create policy help_update on help_requests for update to authenticated
  using (can_teach_student(student_id)) with check (can_teach_student(student_id));

-- Traçabilité : lecture par l'administrateur uniquement ; écriture par trigger.
create policy audit_select on audit_log for select to authenticated using (has_role('admin'));
create policy ai_select on ai_requests for select to authenticated
  using (requester_id = auth.uid() or is_manager());
create policy ai_insert on ai_requests for insert to authenticated
  with check (requester_id = auth.uid() and is_staff());
create policy ai_update on ai_requests for update to authenticated
  using (requester_id = auth.uid() or is_manager())
  with check (requester_id = auth.uid() or is_manager());

-- -----------------------------------------------------------------------------
-- 4. Logique métier en base
-- -----------------------------------------------------------------------------

-- 4.1 Soumission par l'élève, avec score automatique côté serveur.
create or replace function submit_answer(
  p_exercise uuid, p_answer jsonb,
  p_client_id uuid default null, p_publication uuid default null, p_assessment uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_student uuid;
  v_ex      exercises%rowtype;
  v_key     jsonb;
  v_score   numeric(5,2);
  v_id      uuid;
begin
  select id into v_student from students where profile_id = auth.uid() and is_active;
  if v_student is null then
    raise exception 'Seul un élève connecté peut soumettre une réponse' using errcode = '42501';
  end if;
  if not family_can_see_exercise(p_exercise) then
    raise exception 'Exercice non publié pour cet élève' using errcode = '42501';
  end if;

  -- Re-synchronisation hors-ligne : même client_id → on renvoie l'existant.
  if p_client_id is not null then
    select id into v_id from submissions where client_id = p_client_id and student_id = v_student;
    if v_id is not null then return v_id; end if;
  end if;

  select * into v_ex from exercises where id = p_exercise;
  select answer_key into v_key from exercise_keys where exercise_id = p_exercise;

  if v_key is not null and v_ex.kind = 'qcm' then
    v_score := case when (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                          from jsonb_array_elements_text(coalesce(p_answer -> 'selected', '[]')) x)
                       = (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                          from jsonb_array_elements_text(v_key -> 'correct') x)
                     then v_ex.max_points else 0 end;
  elsif v_key is not null and v_ex.kind = 'reponse_courte' then
    v_score := case when exists (
                 select 1 from jsonb_array_elements_text(v_key -> 'accepted') a
                 where lower(btrim(a)) = lower(btrim(p_answer ->> 'text')))
               then v_ex.max_points else 0 end;
  end if;

  insert into submissions (client_id, student_id, exercise_id, assessment_id, publication_id, answer, auto_score)
  values (p_client_id, v_student, p_exercise, p_assessment, p_publication, p_answer, v_score)
  returning id into v_id;
  return v_id;
end $$;

-- 4.2 Calcul du niveau de maîtrise après chaque correction.
-- Pour chaque objectif rattaché à l'exercice corrigé, on prend les N dernières
-- corrections de l'élève sur cet objectif (N = « window ») et on applique les
-- seuils de app_settings. Le résultat est AJOUTÉ à l'historique.
create or replace function compute_mastery_after_correction() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_student uuid;
  v_exercise uuid;
  v_cfg     jsonb;
  v_node    uuid;
  v_pct     numeric;
  v_n       integer;
  v_ids     jsonb;
  v_level   mastery_level;
begin
  select student_id, exercise_id into v_student, v_exercise from submissions where id = new.submission_id;
  update submissions set status = 'corrige' where id = new.submission_id;
  select value into v_cfg from app_settings where key = 'mastery_thresholds';

  for v_node in select node_id from exercise_objectives where exercise_id = v_exercise loop
    select round(100 * sum(score) / nullif(sum(max_score), 0), 2), count(*), jsonb_agg(id)
      into v_pct, v_n, v_ids
    from (
      select c.id, c.score, c.max_score
      from corrections c
      join submissions s on s.id = c.submission_id
      join exercise_objectives eo on eo.exercise_id = s.exercise_id and eo.node_id = v_node
      where s.student_id = v_student
      order by c.seq desc
      limit (v_cfg ->> 'window')::int
    ) last_n;

    v_level := case
      when v_pct >= (v_cfg ->> 'acquis_min_pct')::numeric
           and v_n >= (v_cfg ->> 'acquis_min_evaluations')::int then 'acquis'
      when v_pct >= (v_cfg ->> 'en_cours_min_pct')::numeric then 'en_cours'
      else 'non_acquis' end;

    insert into mastery_records (student_id, node_id, level, source, score_pct, evidence, recorded_by)
    values (v_student, v_node, v_level, 'calcul', v_pct,
            jsonb_build_object('corrections', v_ids, 'window', v_n, 'settings', v_cfg),
            new.corrector_id);
  end loop;
  return new;
end $$;

create trigger trg_correction_mastery after insert or update of score on corrections
  for each row execute function compute_mastery_after_correction();

-- 4.3 Notifications automatiques lors d'une publication.
create or replace function notify_on_publication() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text;
begin
  v_title := case
    when new.lesson_id is not null then 'Nouvelle leçon : ' || (select title from lessons where id = new.lesson_id)
    when new.assessment_id is not null then 'Nouvelle évaluation : ' || (select title from assessments where id = new.assessment_id)
    else 'Nouvel exercice' end;

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

create trigger trg_publication_notify after insert on publications
  for each row execute function notify_on_publication();

-- 4.4 Élèves en alerte (tableaux de bord) : dernier niveau « non acquis ».
create view students_at_risk with (security_invoker = true) as
  select cm.student_id, cm.node_id, cm.score_pct, cm.recorded_at
  from current_mastery cm
  where cm.level = 'non_acquis';

-- 4.5 Prérequis d'un objectif avec le niveau courant de l'élève (aide au diagnostic).
create or replace function prerequisite_status(p_student uuid, p_node uuid)
returns table (prerequisite_id uuid, label text, level mastery_level, score_pct numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with recursive prereq(id, depth) as (
    select prerequisite_id, 1 from node_prerequisites where node_id = p_node
    union
    select np.prerequisite_id, p.depth + 1
    from node_prerequisites np join prereq p on np.node_id = p.id
    where p.depth < 5
  )
  select cn.id, cn.label, cm.level, cm.score_pct
  from (select distinct id from prereq) pr
  join curriculum_nodes cn on cn.id = pr.id
  left join current_mastery cm on cm.node_id = cn.id and cm.student_id = p_student
  where can_read_student(p_student)
$$;

-- -----------------------------------------------------------------------------
-- 5. Droits d'accès (RLS filtre ensuite ligne par ligne)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke insert, update, delete on audit_log from authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
