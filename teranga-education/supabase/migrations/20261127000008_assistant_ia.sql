-- =============================================================================
-- TERANGA ÉDUCATION — Migration 8 (Phase 6) : assistant pédagogique (IA)
--
-- Principes :
--  * l'IA PROPOSE, l'humain DÉCIDE : tout contenu produit est enregistré avec
--    l'origine « ia » et un statut « brouillon » ou « à valider » ;
--  * aucune donnée nominative n'est envoyée au fournisseur (pseudonymisation
--    dans la fonction serveur) ; le journal garde le lien LOCAL vers l'élève ;
--  * le journal n'est écrit QUE par la fonction serveur (clé service) ;
--  * des quotas quotidiens par rôle maîtrisent le budget.
-- =============================================================================

alter table ai_requests
  add column role         app_role,
  add column model        text,
  add column tokens_in    integer,
  add column tokens_out   integer,
  add column duration_ms  integer,
  add column error        text,
  add column student_id   uuid references students (id) on delete set null,
  add column lesson_id    uuid references lessons (id) on delete set null,
  add column exercise_id  uuid references exercises (id) on delete set null,
  -- Texte EXACT envoyé au fournisseur (déjà pseudonymisé) : contrôlable par la direction.
  add column input_sent   text;
create index on ai_requests (requester_id, created_at);
create index on ai_requests (exercise_id, requester_id);

-- Le journal n'est plus écrit par les utilisateurs eux-mêmes.
drop policy if exists ai_insert on ai_requests;
drop policy if exists ai_update on ai_requests;
revoke insert, update, delete on ai_requests from authenticated;

insert into app_settings (key, value, description) values
  ('ia', '{"active": true,
           "quota_jour": {"admin": 80, "coordinateur": 80, "encadreur": 60, "relecteur_wolof": 30, "parent": 5, "eleve": 15},
           "indices_par_exercice": 2}',
   'Assistant IA : activation, nombre d''appels par jour et par personne selon le rôle, indices par exercice.')
on conflict (key) do nothing;

-- Indice autorisé : exercice d'ENTRAÎNEMENT visible par l'élève, qui ne fait
-- partie d'aucune évaluation publiée à l'élève (jamais d'aide pendant une épreuve).
create or replace function family_hint_allowed(p_exercise uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select family_can_see_exercise(p_exercise)
     and not exists (select 1 from assessment_items ai
                     where ai.exercise_id = p_exercise and family_can_see_assessment(ai.assessment_id))
$$;
grant execute on function family_hint_allowed(uuid) to authenticated;
revoke execute on function family_hint_allowed(uuid) from anon, public;

-- Consommation du jour (affichée à l'utilisateur et vérifiée par le serveur).
create or replace function ai_usage_today() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from ai_requests
  where requester_id = auth.uid() and created_at >= date_trunc('day', now()) and error is null
$$;
grant execute on function ai_usage_today() to authenticated;
