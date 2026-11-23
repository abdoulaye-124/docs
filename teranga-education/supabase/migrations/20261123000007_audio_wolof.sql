-- =============================================================================
-- TERANGA ÉDUCATION — Migration 7 (Phase 5) : audio français et aide en wolof
--
-- Règles :
--  * un enregistrement français réalisé par un encadreur peut être validé par
--    lui-même (comme une leçon) ;
--  * TOUT contenu en wolof, et tout contenu produit par synthèse vocale ou IA,
--    doit être validé par un relecteur wolof ou par la coordination ;
--  * l'élève ne voit que des contenus VALIDÉS, liés à ce qui lui est publié ;
--  * l'aide en wolof est masquée pour un exercice qui fait partie d'une
--    évaluation « français obligatoire » publiée à l'élève ;
--  * les fichiers audio sont PRIVÉS : lecture uniquement par lien temporaire,
--    et seulement si la fiche audio correspondante est visible.
-- =============================================================================

create or replace function can_validate_language_content() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = auth.uid()
                 and role in ('admin', 'coordinateur', 'relecteur_wolof'))
$$;

create or replace function is_content_reviewer() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'relecteur_wolof')
$$;

-- Aide en wolof autorisée pour cet exercice (côté famille) ?
create or replace function family_wolof_allowed(p_exercise uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (
    select 1 from assessment_items ai join assessments a on a.id = ai.assessment_id
    where ai.exercise_id = p_exercise and a.french_only and family_can_see_assessment(a.id))
$$;

-- Règle de validation d'un contenu linguistique.
create or replace function language_validation_ok(p_lang lang_code, p_origin media_origin, p_status validation_status, p_validated_by uuid)
returns boolean language sql stable as $$
  select p_status <> 'valide'
      or (p_validated_by = auth.uid()
          and ((p_lang = 'fr' and p_origin = 'humain') or can_validate_language_content()))
$$;

alter table media add constraint media_storage_path_unique unique (storage_path);

-- -----------------------------------------------------------------------------
-- Le relecteur wolof lit les contenus pédagogiques (pour le contexte), jamais
-- les dossiers d'élèves.
-- -----------------------------------------------------------------------------
drop policy lessons_select on lessons;
create policy lessons_select on lessons for select to authenticated
  using (is_staff() or is_content_reviewer() or family_can_see_lesson(id));
drop policy exercises_select on exercises;
create policy exercises_select on exercises for select to authenticated
  using (is_staff() or is_content_reviewer() or family_can_see_exercise(id));

-- -----------------------------------------------------------------------------
-- Fiches audio
-- -----------------------------------------------------------------------------
drop policy media_select on media;
drop policy media_insert on media;
drop policy media_update on media;

create policy media_select on media for select to authenticated
  using (is_staff() or is_content_reviewer()
         or (status = 'valide' and (
               (lesson_id is not null and family_can_see_lesson(lesson_id))
            or (exercise_id is not null and family_can_see_exercise(exercise_id)
                and (lang = 'fr' or family_wolof_allowed(exercise_id))))));
create policy media_insert on media for insert to authenticated
  with check ((is_staff() or is_content_reviewer()) and recorded_by = auth.uid()
              and language_validation_ok(lang, origin, status, validated_by));
create policy media_update on media for update to authenticated
  using (is_staff() or is_content_reviewer())
  with check ((is_staff() or is_content_reviewer())
              and language_validation_ok(lang, origin, status, validated_by));
create policy media_delete on media for delete to authenticated
  using (is_manager() or (recorded_by = auth.uid() and status <> 'valide'));

-- -----------------------------------------------------------------------------
-- Explications en wolof
-- -----------------------------------------------------------------------------
drop policy wolof_select on wolof_explanations;
drop policy wolof_insert on wolof_explanations;
drop policy wolof_update on wolof_explanations;

create policy wolof_select on wolof_explanations for select to authenticated
  using (is_staff() or is_content_reviewer()
         or (status = 'valide' and (
               (lesson_id is not null and family_can_see_lesson(lesson_id))
            or (exercise_id is not null and family_can_see_exercise(exercise_id) and family_wolof_allowed(exercise_id)))));
create policy wolof_insert on wolof_explanations for insert to authenticated
  with check ((is_staff() or is_content_reviewer()) and author_id = auth.uid()
              and language_validation_ok('wo', origin, status, validated_by));
create policy wolof_update on wolof_explanations for update to authenticated
  using (is_staff() or is_content_reviewer())
  with check ((is_staff() or is_content_reviewer())
              and language_validation_ok('wo', origin, status, validated_by));
create policy wolof_delete on wolof_explanations for delete to authenticated
  using (is_manager() or (author_id = auth.uid() and status <> 'valide'));

-- Toute modification d'un contenu linguistique est tracée (corrections de formulation).
create trigger trg_audit_wolof after insert or update or delete on wolof_explanations
  for each row execute function audit_trigger();
create trigger trg_audit_media after insert or update or delete on media
  for each row execute function audit_trigger();

-- Une explication validée puis modifiée repasse « à valider ».
create or replace function revalidate_on_change() returns trigger
language plpgsql as $$
begin
  if old.status = 'valide' and new.status = 'valide'
     and (new.text_wo is distinct from old.text_wo or new.media_id is distinct from old.media_id
          or new.target_text is distinct from old.target_text) then
    new.status := 'a_valider';
    new.validated_by := null;
  end if;
  return new;
end $$;
create trigger trg_wolof_revalidate before update on wolof_explanations
  for each row execute function revalidate_on_change();

-- -----------------------------------------------------------------------------
-- Stockage des fichiers audio (compartiment privé « audio »)
-- Chemin imposé : <identifiant de l'auteur>/<nom de fichier>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 3145728,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy audio_lecture on storage.objects for select to authenticated
  using (bucket_id = 'audio' and exists (select 1 from public.media m where m.storage_path = storage.objects.name));
create policy audio_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (public.is_staff() or public.is_content_reviewer())
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy audio_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.media m where m.storage_path = storage.objects.name and m.status = 'valide'));

grant execute on function can_validate_language_content(), is_content_reviewer(), family_wolof_allowed(uuid),
  language_validation_ok(lang_code, media_origin, validation_status, uuid) to authenticated;
