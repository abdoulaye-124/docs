-- =============================================================================
-- TERANGA ÉDUCATION — Migration 3 (Phase 2) : identifiant de connexion élève
-- L'identifiant court (ex. « awa.47 ») est conservé dans le dossier pour que
-- l'administration puisse le réimprimer et réinitialiser le code-image.
-- =============================================================================
alter table students
  add column login_id text unique
  check (login_id ~ '^[a-z][a-z0-9.]{2,23}$');

comment on column students.login_id is
  'Identifiant de connexion de l''élève (sans e-mail visible). Renseigné par la fonction admin-users.';
