-- =============================================================================
-- TERANGA ÉDUCATION — Migration 4 (Phase 3) : module pédagogique
-- =============================================================================

-- Retour de correction pour l'élève et sa famille : la « correction expliquée »
-- est rangée avec les corrigés (table exercise_keys, illisible par les familles).
-- Cette fonction ne la révèle QU'APRÈS correction, et seulement à qui peut lire
-- le dossier de l'élève.
create or replace function correction_feedback(p_submission uuid)
returns table (score numeric, max_score numeric, comment text, explanation text, corrected_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.score, c.max_score, c.comment, k.explanation, c.corrected_at
  from submissions s
  join corrections c on c.submission_id = s.id
  left join exercise_keys k on k.exercise_id = s.exercise_id
  where s.id = p_submission and can_read_student(s.student_id)
$$;
revoke execute on function correction_feedback(uuid) from public, anon;
grant execute on function correction_feedback(uuid) to authenticated;

-- File de correction : accès rapide aux copies en attente.
create index if not exists submissions_status_idx on submissions (status, submitted_at);

-- Un exercice publié ne doit plus changer de corrigé sans trace : on journalise
-- les corrigés.
create trigger trg_audit_exercise_keys after insert or update or delete on exercise_keys
  for each row execute function audit_trigger();

-- Une publication porte une échéance cohérente.
alter table publications
  add constraint publications_due_after_publish check (due_at is null or due_at >= published_at - interval '1 day');

-- RG14 : un objectif ne peut perdre son statut « provisoire » que s'il cite une
-- source AUTHENTIFIÉE (ou en vigueur). Règle appliquée par la base elle-même.
create or replace function check_node_verification() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_provisional = false and not exists (
       select 1 from curriculum_sources
       where id = new.source_id and status in ('authentifie', 'en_vigueur')) then
    raise exception 'Un objectif ne peut être marqué vérifié que s''il cite une source authentifiée'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_node_verification before insert or update on curriculum_nodes
  for each row execute function check_node_verification();
