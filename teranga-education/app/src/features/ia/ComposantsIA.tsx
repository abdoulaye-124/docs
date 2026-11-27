import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assistant } from '../../lib/ia';
import { Alerte } from '../../ui/composants';
import { BoutonIA, PropositionIA } from '../../ui/assistant';

interface Analyse { constats: string[]; hypotheses: string[]; pistes: string[] }

/** Analyse des résultats d'un élève (encadreur) : constats, hypothèses, pistes. */
export function AnalyseIA({ studentId, nodeId }: { studentId: string; nodeId?: string }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => assistant<Analyse>('analyse_eleve', { student_id: studentId, node_id: nodeId }),
    onError: (e) => setErreur((e as Error).message),
    onSuccess: () => setErreur(null),
  });
  const r = m.data?.resultat;
  return (
    <div className="space-y-3">
      <BoutonIA chargement={m.isPending} onClick={() => m.mutate()}>{r ? 'Relancer l’analyse' : 'Analyser les résultats'}</BoutonIA>
      {erreur && <Alerte>{erreur}</Alerte>}
      {r && (
        <PropositionIA simulation={m.data?.simulation} titre="Analyse de l’assistant">
          {([['Constats', r.constats], ['Hypothèses', r.hypotheses], ['Pistes de remédiation', r.pistes]] as const).map(([t, l]) => l.length > 0 && (
            <div key={t} className="mb-2">
              <p className="font-medium text-slate-700">{t}</p>
              <ul className="ml-5 list-disc">{l.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </PropositionIA>
      )}
    </div>
  );
}

/** Conseils pour le parent : explication des résultats et activités à la maison. */
export function ConseilsParentIA({ studentId }: { studentId: string }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => assistant<{ resume: string; conseils: string[] }>('conseils_parent', { student_id: studentId }),
    onError: (e) => setErreur((e as Error).message),
    onSuccess: () => setErreur(null),
  });
  const r = m.data?.resultat;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">L’assistant explique simplement les résultats de votre enfant et propose des activités pour la maison.</p>
      <BoutonIA chargement={m.isPending} onClick={() => m.mutate()}>Comprendre les résultats et aider mon enfant</BoutonIA>
      {erreur && <Alerte>{erreur}</Alerte>}
      {r && (
        <PropositionIA simulation={m.data?.simulation} titre="Conseils de l’assistant">
          <p className="whitespace-pre-line">{r.resume}</p>
          <ul className="ml-5 mt-2 list-disc">{r.conseils.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-600">Pour toute question, écrivez à l’encadreur de votre enfant.</p>
        </PropositionIA>
      )}
    </div>
  );
}

/** Indices pour l'élève (entraînement uniquement ; jamais la réponse). */
export function IndiceIA({ exerciseId }: { exerciseId: string }) {
  const [indices, setIndices] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [restants, setRestants] = useState<number | null>(null);
  const m = useMutation({
    mutationFn: () => assistant<{ indice: string; encouragement: string; restants: number }>('indice', { exercise_id: exerciseId }),
    onSuccess: (d) => {
      setIndices([...indices, `${d.resultat.indice} ${d.resultat.encouragement}`.trim()]);
      setRestants(d.resultat.restants);
      setMessage(null);
    },
    onError: (e) => setMessage((e as Error).message),
  });
  return (
    <section className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4">
      <button onClick={() => m.mutate()} disabled={m.isPending || restants === 0}
        className="flex min-h-[48px] w-full items-center justify-between text-left text-lg font-bold text-violet-900 disabled:opacity-60">
        💡 {indices.length ? 'Un autre indice' : 'Un indice'}
        {m.isPending && <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" aria-hidden />}
      </button>
      {indices.length > 0 && (
        <ol className="mt-2 space-y-2" data-testid="indices">
          {indices.map((t, i) => <li key={i} className="rounded-xl bg-white p-3 text-lg">{t}</li>)}
        </ol>
      )}
      {restants === 0 && <p className="mt-2 text-sm text-violet-900">Tu as utilisé tes indices. Essaie, ou demande à ton encadreur !</p>}
      {message && <p className="mt-2 text-sm text-violet-900" role="status">{message}</p>}
    </section>
  );
}
