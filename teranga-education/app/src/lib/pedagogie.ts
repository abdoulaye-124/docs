import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { verifier } from './requetes';
import type { Niveau } from './types';
import type { Noeud, StatutValidation } from './pedagogie-regles';

export * from './pedagogie-regles';

export function useReferentiel() {
  return useQuery({
    queryKey: ['referentiel'],
    queryFn: async () => {
      const [versions, types, noeuds, prerequis] = await Promise.all([
        supabase.from('curriculum_versions').select('id, name, description, status, effective_from').order('created_at'),
        supabase.from('curriculum_node_types').select('id, version_id, code, label, depth, is_assessable').order('depth'),
        supabase.from('curriculum_nodes').select('id, version_id, parent_id, node_type_id, level_code, code, label, is_provisional, source_ref, sort_order').order('sort_order'),
        supabase.from('node_prerequisites').select('node_id, prerequisite_id'),
      ]);
      return {
        versions: verifier(versions) as { id: string; name: string; description: string | null; status: StatutValidation; effective_from: string | null }[],
        types: verifier(types) as { id: string; version_id: string; code: string; label: string; depth: number; is_assessable: boolean }[],
        noeuds: verifier(noeuds) as Noeud[],
        prerequis: verifier(prerequis) as { node_id: string; prerequisite_id: string }[],
      };
    },
  });
}

/** Objectifs évaluables (pour rattacher leçons et exercices). */
export function useObjectifs() {
  const r = useReferentiel();
  const evaluables = new Set((r.data?.types ?? []).filter((t) => t.is_assessable).map((t) => t.id));
  return { ...r, data: (r.data?.noeuds ?? []).filter((n) => evaluables.has(n.node_type_id)) };
}

export function useMatieres() {
  return useQuery({
    queryKey: ['matieres'],
    queryFn: async () =>
      verifier(await supabase.from('subjects').select('id, name, level_code, curriculum_node_id, is_active').order('name')) as
        { id: string; name: string; level_code: Niveau | null; curriculum_node_id: string | null; is_active: boolean }[],
  });
}

