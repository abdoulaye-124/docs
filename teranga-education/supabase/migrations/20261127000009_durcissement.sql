-- =============================================================================
-- TERANGA ÉDUCATION — Migration 9 (Phase 7) : durcissement de la sécurité
-- =============================================================================

-- 1. La note automatique proposée n'est plus lisible directement : l'élève et
--    sa famille ne doivent pas savoir avant la correction si la réponse est juste.
--    Le personnel affecté la lit par la fonction auto_scores().
revoke select on submissions from authenticated;
grant select (id, client_id, student_id, exercise_id, assessment_id, publication_id, answer, file_path,
              status, submitted_at, synced_at) on submissions to authenticated;

create or replace function auto_scores(p_ids uuid[])
returns table (id uuid, auto_score numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.auto_score from submissions s
  where s.id = any (p_ids) and can_teach_student(s.student_id)
$$;
revoke execute on function auto_scores(uuid[]) from public, anon;
grant execute on function auto_scores(uuid[]) to authenticated;

-- 2. Aucun droit pour les visiteurs non connectés, sur aucune table.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
