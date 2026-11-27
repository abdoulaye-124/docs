-- =============================================================================
-- PREMIER COMPTE ADMINISTRATEUR (à exécuter UNE fois dans Supabase › SQL Editor)
-- 1. Créez d'abord l'utilisateur dans Supabase › Authentication › Users ›
--    « Add user » (e-mail + mot de passe, cochez « Auto Confirm User »).
-- 2. Remplacez les valeurs entre <...> ci-dessous, puis exécutez.
-- =============================================================================
insert into public.profiles (id, first_name, last_name)
select id, '<Prénom>', '<NOM>' from auth.users where email = '<adresse e-mail du directeur>';

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = '<adresse e-mail du directeur>';

insert into public.school_years (label, starts_on, ends_on, is_current)
values ('2026-2027', '2026-10-01', '2027-07-31', true);
