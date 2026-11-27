-- =============================================================================
-- RÉFÉRENTIEL PROVISOIRE DE DÉMONSTRATION — NON OFFICIEL
--
-- Saisi par le centre pour construire et tester le module pédagogique, en
-- attendant les guides officiels authentifiés du CEB (Phase 0, documents M1-M3).
-- Ces objectifs NE SONT PAS des objectifs du programme officiel sénégalais.
-- Ils sont tous marqués « provisoires » (is_provisional = true) et rattachés à
-- une source de statut « repéré » qui le précise.
-- =============================================================================
do $$
declare
  v_src uuid; v_ver uuid; t_dom uuid; t_obj uuid; d_math uuid;
  o_tables uuid; o_partage uuid; o_div uuid; o_prob uuid; o_addsub uuid;
begin
  if exists (select 1 from curriculum_versions where name like 'PROVISOIRE%') then return; end if;

  insert into curriculum_sources (title, issuer, status, notes)
  values ('Saisie provisoire du centre (démonstration)', 'TERANGA ÉDUCATION (non officiel)', 'repere',
          'Objectifs rédigés pour tester l''application. À remplacer par les objectifs des guides officiels du CEB.')
  returning id into v_src;

  insert into curriculum_versions (name, description, status)
  values ('PROVISOIRE — démonstration (non officiel)',
          'Version de travail. Aucun objectif n''est officiel tant que la source n''est pas authentifiée.', 'brouillon')
  returning id into v_ver;
  insert into curriculum_version_sources values (v_ver, v_src);

  insert into curriculum_node_types (version_id, code, label, depth, is_assessable)
  values (v_ver, 'domaine', 'Domaine (provisoire)', 0, false) returning id into t_dom;
  insert into curriculum_node_types (version_id, code, label, depth, is_assessable)
  values (v_ver, 'objectif', 'Objectif (provisoire)', 1, true) returning id into t_obj;

  insert into curriculum_nodes (version_id, node_type_id, label, source_id, source_ref, sort_order)
  values (v_ver, t_dom, 'Mathématiques', v_src, 'provisoire', 1) returning id into d_math;

  insert into curriculum_nodes (version_id, parent_id, node_type_id, level_code, code, label, source_id, source_ref, sort_order) values
    (v_ver, d_math, t_obj, 'CE1', 'P-M-01', 'Connaître les tables de multiplication de 2 à 9', v_src, 'provisoire', 1)
    returning id into o_tables;
  insert into curriculum_nodes (version_id, parent_id, node_type_id, level_code, code, label, source_id, source_ref, sort_order) values
    (v_ver, d_math, t_obj, 'CE1', 'P-M-02', 'Comprendre le sens du partage équitable', v_src, 'provisoire', 2)
    returning id into o_partage;
  insert into curriculum_nodes (version_id, parent_id, node_type_id, level_code, code, label, source_id, source_ref, sort_order) values
    (v_ver, d_math, t_obj, 'CE2', 'P-M-03', 'Diviser un nombre à deux chiffres par un nombre à un chiffre', v_src, 'provisoire', 3)
    returning id into o_div;
  insert into curriculum_nodes (version_id, parent_id, node_type_id, level_code, code, label, source_id, source_ref, sort_order) values
    (v_ver, d_math, t_obj, 'CE2', 'P-M-04', 'Résoudre un problème simple de partage de la vie courante', v_src, 'provisoire', 4)
    returning id into o_prob;
  insert into curriculum_nodes (version_id, parent_id, node_type_id, level_code, code, label, source_id, source_ref, sort_order) values
    (v_ver, d_math, t_obj, 'CE2', 'P-M-05', 'Additionner et soustraire des nombres jusqu''à 1 000', v_src, 'provisoire', 5)
    returning id into o_addsub;

  insert into node_prerequisites values (o_div, o_tables), (o_div, o_partage), (o_prob, o_div);

  insert into subjects (name, level_code, curriculum_node_id) values
    ('Mathématiques', 'CE2', d_math), ('Mathématiques', 'CE1', d_math)
  on conflict do nothing;
end $$;
