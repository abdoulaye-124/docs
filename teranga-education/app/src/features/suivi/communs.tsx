import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { formatDate } from '../../lib/dates';
import { LIBELLES_MAITRISE, type EnregistrementMaitrise, type Maitrise } from '../../lib/suivi-regles';
import { Pastille } from '../../ui/composants';

export function PastilleMaitrise({ n }: { n: Maitrise | null | undefined }) {
  if (!n) return <Pastille>non évalué</Pastille>;
  return <Pastille ton={n === 'acquis' ? 'vert' : n === 'en_cours' ? 'ambre' : 'rouge'}>{LIBELLES_MAITRISE[n]}</Pastille>;
}

const COULEUR: Record<Maitrise, string> = { non_acquis: 'bg-red-500', en_cours: 'bg-amber-400', acquis: 'bg-teranga-600' };

/** Frise : un point par évaluation, de la plus ancienne à la plus récente. */
export function Frise({ h }: { h: EnregistrementMaitrise[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label={`Historique : ${h.map((x) => LIBELLES_MAITRISE[x.level]).join(', ')}`}>
      {h.map((x) => (
        <span key={x.seq} title={`${formatDate(x.recorded_at)} · ${LIBELLES_MAITRISE[x.level]}${x.score_pct !== null ? ` · ${Math.round(x.score_pct)} %` : ''}${x.source === 'encadreur' ? ' · ajusté par l’encadreur' : ''}`}
          className={`inline-block h-3 w-3 rounded-full ${COULEUR[x.level]} ${x.source === 'encadreur' ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`} />
      ))}
    </span>
  );
}

export const STATUTS_PLAN: Record<string, { libelle: string; ton: 'neutre' | 'ambre' | 'vert' | 'bleu' | 'rouge' }> = {
  proposee: { libelle: 'proposé, à valider', ton: 'ambre' },
  validee: { libelle: 'validé', ton: 'bleu' },
  en_cours: { libelle: 'en cours', ton: 'bleu' },
  terminee: { libelle: 'terminé', ton: 'vert' },
  refusee: { libelle: 'refusé', ton: 'neutre' },
};

export interface Plan {
  id: string; student_id: string; target_node_id: string; diagnosis: string; origin: string; status: string;
  validated_by: string | null; validated_at: string | null; closed_at: string | null; created_at: string;
}

export interface Bilan {
  id: string; student_id: string; period_start: string; period_end: string; status: 'brouillon' | 'valide' | 'envoye';
  body: { synthese?: string; points_forts?: string; difficultes?: string; recommandations?: string; presences?: string; competences?: string };
  author_id: string | null; sent_at: string | null; created_at: string;
}

export function useResultatPlan(planId: string | null) {
  return useQuery({
    queryKey: ['resultat-plan', planId],
    enabled: !!planId,
    queryFn: async () => (verifier(await supabase.rpc('remediation_outcome', { p_plan: planId })) as {
      level_before: Maitrise | null; pct_before: number | null; level_now: Maitrise | null; pct_now: number | null;
      steps_total: number; steps_done: number;
    }[])[0] ?? null,
  });
}

export function AvantApres({ planId }: { planId: string }) {
  const r = useResultatPlan(planId);
  if (!r.data) return null;
  const d = r.data;
  const pct = (v: number | null) => (v === null ? '' : ` (${Math.round(v)} %)`);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="avant-apres">
      <span className="text-slate-500">Avant :</span><PastilleMaitrise n={d.level_before} /><span>{pct(d.pct_before)}</span>
      <span aria-hidden>→</span>
      <span className="text-slate-500">Maintenant :</span><PastilleMaitrise n={d.level_now} /><span>{pct(d.pct_now)}</span>
      <span className="text-slate-500">· étapes faites : {d.steps_done} / {d.steps_total}</span>
    </div>
  );
}
