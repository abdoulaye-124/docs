import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useEleves, useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui, formatDate } from '../../lib/dates';
import { libelleObjectif, useReferentiel } from '../../lib/pedagogie';
import type { Maitrise } from '../../lib/suivi-regles';
import { nomComplet } from '../../lib/types';
import { Alerte, Bouton, Carte, Cellule, Champ, Chargement, EnTete, Pastille, Tableau, Vide, ZoneTexte } from '../../ui/composants';
import { AvantApres, PastilleMaitrise, STATUTS_PLAN, type Plan } from './communs';
import { AnalyseIA } from '../ia/ComposantsIA';

// ----------------------------------------------------------------------------- Élèves en difficulté (T12)
export function ElevesEnDifficulte() {
  const eleves = useEleves();
  const ref = useReferentiel();
  const alertes = useQuery({
    queryKey: ['alertes'],
    queryFn: async () => {
      const [risque, plans] = await Promise.all([
        supabase.from('current_mastery').select('student_id, node_id, level, score_pct, recorded_at').neq('level', 'acquis').order('score_pct'),
        supabase.from('remediation_plans').select('id, student_id, target_node_id, status').in('status', ['proposee', 'validee', 'en_cours']),
      ]);
      return {
        risque: verifier(risque) as { student_id: string; node_id: string; level: Maitrise; score_pct: number | null; recorded_at: string }[],
        plans: verifier(plans) as { id: string; student_id: string; target_node_id: string; status: string }[],
      };
    },
  });
  if (alertes.isLoading || eleves.isLoading) return <Chargement />;
  const lignes = (alertes.data?.risque ?? []).sort((a, b) => (a.level === b.level ? (a.score_pct ?? 0) - (b.score_pct ?? 0) : a.level === 'non_acquis' ? -1 : 1));
  const noeud = (id: string) => ref.data?.noeuds.find((n) => n.id === id);

  return (
    <>
      <EnTete titre="Élèves en difficulté" sousTitre="Objectifs non acquis ou en cours d’acquisition, d’après les dernières corrections"
        actions={<Link to="/remediation" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teranga-800">Programmes de remédiation →</Link>} />
      {!lignes.length ? <Vide>Aucun élève en difficulté sur les objectifs évalués. 🎉</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Élève', 'Objectif', 'Niveau', 'Réussite', 'Depuis', 'Action']}>
            {lignes.map((l) => {
              const e = eleves.data?.find((x) => x.id === l.student_id);
              const plan = alertes.data!.plans.find((p) => p.student_id === l.student_id && p.target_node_id === l.node_id);
              const n = noeud(l.node_id);
              return (
                <tr key={`${l.student_id}-${l.node_id}`} data-testid="alerte">
                  <Cellule><Link to={`/eleves/${l.student_id}/suivi`} className="font-medium text-teranga-800 hover:underline">{nomComplet(e)}</Link> {e && <Pastille>{e.level_code}</Pastille>}</Cellule>
                  <Cellule className="whitespace-normal">{n ? libelleObjectif(n) : '—'}</Cellule>
                  <Cellule><PastilleMaitrise n={l.level} /></Cellule>
                  <Cellule>{l.score_pct === null ? '—' : `${Math.round(l.score_pct)} %`}</Cellule>
                  <Cellule>{formatDate(l.recorded_at)}</Cellule>
                  <Cellule>{plan
                    ? <Link to={`/remediation/${plan.id}`} className="font-semibold text-teranga-800">Programme {STATUTS_PLAN[plan.status].libelle}</Link>
                    : <Link to={`/suivi/diagnostic/${l.student_id}/${l.node_id}`} className="font-semibold text-teranga-800">Diagnostiquer</Link>}</Cellule>
                </tr>
              );
            })}
          </Tableau>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------- Diagnostic
export function Diagnostic() {
  const { eleve = '', noeud = '' } = useParams();
  const nav = useNavigate();
  const ref = useReferentiel();
  const eleves = useEleves();
  const [erreur, setErreur] = useState<string | null>(null);
  const diag = useQuery({
    queryKey: ['diagnostic', eleve, noeud],
    queryFn: async () => {
      const [pre, cur, res] = await Promise.all([
        supabase.rpc('prerequisite_status', { p_student: eleve, p_node: noeud }),
        supabase.from('current_mastery').select('level, score_pct').eq('student_id', eleve).eq('node_id', noeud).maybeSingle(),
        supabase.from('submissions').select('id, submitted_at, exercises!inner(prompt, exercise_objectives!inner(node_id)), corrections(score, max_score)')
          .eq('student_id', eleve).eq('exercises.exercise_objectives.node_id', noeud).order('submitted_at', { ascending: false }).limit(10),
      ]);
      return {
        prerequis: verifier(pre) as { prerequisite_id: string; label: string; level: Maitrise | null; score_pct: number | null }[],
        actuel: verifier(cur) as { level: Maitrise; score_pct: number | null } | null,
        resultats: verifier(res) as unknown as { id: string; submitted_at: string; exercises: { prompt: string }; corrections: { score: number; max_score: number } | null }[],
      };
    },
  });
  const proposer = useMutation({
    mutationFn: async () => verifier(await supabase.rpc('propose_remediation', { p_student: eleve, p_node: noeud })) as string,
    onSuccess: (id) => nav(`/remediation/${id}`),
    onError: (e) => setErreur(messageErreur(e)),
  });
  if (diag.isLoading || ref.isLoading) return <Chargement />;
  const n = ref.data?.noeuds.find((x) => x.id === noeud);
  const e = eleves.data?.find((x) => x.id === eleve);
  const d = diag.data!;
  const bloquants = d.prerequis.filter((p) => p.level !== 'acquis');

  return (
    <>
      <EnTete titre="Diagnostic" sousTitre={<>{nomComplet(e)} · {n ? libelleObjectif(n) : ''}</>}
        actions={<Link to={`/eleves/${eleve}/suivi`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teranga-800">← Dossier</Link>} />
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Carte titre="Situation sur l’objectif">
          <p className="mb-3 flex items-center gap-2 text-sm">Niveau actuel : <PastilleMaitrise n={d.actuel?.level} />{d.actuel?.score_pct != null && <span>{Math.round(d.actuel.score_pct)} %</span>}</p>
          {!d.resultats.length ? <Vide>Aucun exercice rendu sur cet objectif.</Vide> : (
            <ul className="space-y-1 text-sm">
              {d.resultats.map((r) => (
                <li key={r.id} className="flex justify-between gap-2"><span>{r.exercises.prompt}</span>
                  <span className="whitespace-nowrap font-semibold">{r.corrections ? `${Number(r.corrections.score)} / ${Number(r.corrections.max_score)}` : 'à corriger'}</span></li>
              ))}
            </ul>
          )}
        </Carte>
        <Carte titre="Vérification des prérequis">
          {!d.prerequis.length ? <Vide>Aucun prérequis déclaré dans le référentiel pour cet objectif.</Vide> : (
            <ul className="space-y-2 text-sm" data-testid="prerequis">
              {d.prerequis.map((p) => (
                <li key={p.prerequisite_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                  <span>{p.label}</span>
                  <span className="flex items-center gap-1"><PastilleMaitrise n={p.level} />{p.score_pct != null && <span>{Math.round(p.score_pct)} %</span>}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-700">
            {bloquants.length
              ? `Piste : ${bloquants.length} prérequis non maîtrisé(s) ou jamais évalué(s). La difficulté vient peut-être de là.`
              : 'Les prérequis sont acquis : reprendre l’objectif lui-même, du plus facile au plus difficile.'}
          </p>
        </Carte>
      </div>
      <Carte className="mt-5" titre="Avis de l’assistant"><AnalyseIA studentId={eleve} nodeId={noeud} /></Carte>
      <Carte className="mt-5" titre="Programme de remédiation">
        <p className="mb-3 text-sm text-slate-600">Le système propose un programme à partir des prérequis et des exercices validés. <strong>Vous le vérifiez et le validez</strong> avant qu’il soit transmis à l’élève.</p>
        <Bouton chargement={proposer.isPending} onClick={() => proposer.mutate()}>Proposer un programme</Bouton>
      </Carte>
    </>
  );
}

// ----------------------------------------------------------------------------- Programmes
export function ListeRemediations() {
  const eleves = useEleves();
  const ref = useReferentiel();
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => verifier(await supabase.from('remediation_plans').select('*').order('created_at', { ascending: false })) as Plan[],
  });
  if (plans.isLoading) return <Chargement />;
  return (
    <>
      <EnTete titre="Programmes de remédiation" actions={<Link to="/suivi" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teranga-800">Élèves en difficulté →</Link>} />
      {!plans.data?.length ? <Vide>Aucun programme. Partez de la liste des élèves en difficulté.</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Élève', 'Objectif', 'État', 'Créé le']}>
            {plans.data.map((p) => (
              <tr key={p.id}>
                <Cellule><Link to={`/remediation/${p.id}`} className="font-medium text-teranga-800 hover:underline">{nomComplet(eleves.data?.find((e) => e.id === p.student_id))}</Link></Cellule>
                <Cellule className="whitespace-normal">{ref.data?.noeuds.find((n) => n.id === p.target_node_id)?.label}</Cellule>
                <Cellule><Pastille ton={STATUTS_PLAN[p.status].ton}>{STATUTS_PLAN[p.status].libelle}</Pastille></Cellule>
                <Cellule>{formatDate(p.created_at)}</Cellule>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
    </>
  );
}

export function FicheRemediation() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { profil } = useSession();
  const eleves = useEleves();
  const profils = useProfils();
  const ref = useReferentiel();
  const plan = useQuery({
    queryKey: ['plan', id],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from('remediation_plans').select('*').eq('id', id).maybeSingle(),
        supabase.from('remediation_steps').select('id, position, node_id, done_at, exercise_id, exercises(prompt, difficulty)').eq('plan_id', id).order('position'),
      ]);
      return { plan: verifier(p) as Plan | null, etapes: verifier(s) as unknown as { id: string; position: number; node_id: string | null; done_at: string | null; exercises: { prompt: string; difficulty: number } | null }[] };
    },
  });
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [echeance, setEcheance] = useState('');
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(null);
  const rafraichir = () => { qc.invalidateQueries({ queryKey: ['plan', id] }); qc.invalidateQueries({ queryKey: ['plans'] }); qc.invalidateQueries({ queryKey: ['resultat-plan', id] }); qc.invalidateQueries({ queryKey: ['alertes'] }); };
  const action = useMutation({
    mutationFn: async (a: 'valider' | 'refuser' | 'lancer' | 'cloturer' | 'diagnostic') => {
      const maintenant = new Date().toISOString();
      if (a === 'diagnostic') {
        verifier(await supabase.from('remediation_plans').update({ diagnosis: diagnostic }).eq('id', id).select('id'));
        return 'Diagnostic enregistré.';
      }
      if (a === 'valider') {
        verifier(await supabase.from('remediation_plans').update({ status: 'validee', validated_by: profil!.id, validated_at: maintenant, ...(diagnostic !== null ? { diagnosis: diagnostic } : {}) }).eq('id', id).select('id'));
        return 'Programme validé. Les parents en sont informés.';
      }
      if (a === 'refuser') { verifier(await supabase.from('remediation_plans').update({ status: 'refusee', closed_at: maintenant }).eq('id', id).select('id')); return 'Programme refusé.'; }
      if (a === 'lancer') {
        const n = verifier(await supabase.rpc('start_remediation', { p_plan: id, p_due: echeance || null })) as number;
        return `Programme lancé : ${n} exercice(s) publié(s) pour l’élève.`;
      }
      verifier(await supabase.from('remediation_plans').update({ status: 'terminee', closed_at: maintenant }).eq('id', id).select('id'));
      return 'Programme clôturé. Les résultats après remédiation sont enregistrés dans le dossier.';
    },
    onSuccess: (texte) => { setMessage({ ton: 'succes', texte }); setDiagnostic(null); rafraichir(); },
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  const retirer = useMutation({
    mutationFn: async (etape: string) => verifier(await supabase.from('remediation_steps').delete().eq('id', etape).select('id')),
    onSuccess: rafraichir,
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  if (plan.isLoading) return <Chargement />;
  const p = plan.data?.plan;
  if (!p) return <Alerte>Programme introuvable ou non accessible.</Alerte>;
  const e = eleves.data?.find((x) => x.id === p.student_id);
  const noeud = (nid: string | null) => ref.data?.noeuds.find((n) => n.id === nid);
  const etapes = plan.data!.etapes;
  const vide = !etapes.some((s) => s.exercises);

  return (
    <>
      <EnTete titre={`Remédiation · ${nomComplet(e)}`}
        sousTitre={<span className="flex flex-wrap items-center gap-2">{noeud(p.target_node_id)?.label}<Pastille ton={STATUTS_PLAN[p.status].ton}>{STATUTS_PLAN[p.status].libelle}</Pastille>
          <span className="text-xs">origine : {p.origin === 'regles' ? 'proposition automatique' : p.origin === 'ia' ? 'assistant IA' : 'encadreur'}</span></span>}
        actions={<Link to={`/eleves/${p.student_id}/suivi`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teranga-800">← Dossier</Link>} />
      {message && <div className="mb-4"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Carte titre="Diagnostic">
            {p.status === 'proposee' ? (
              <>
                <ZoneTexte label="Diagnostic (modifiable avant validation)" rows={7} value={diagnostic ?? p.diagnosis} onChange={(x) => setDiagnostic(x.target.value)} />
                {diagnostic !== null && <Bouton variante="secondaire" className="mt-2" onClick={() => action.mutate('diagnostic')}>Enregistrer le diagnostic</Bouton>}
              </>
            ) : <p className="whitespace-pre-line text-sm" data-testid="diagnostic">{p.diagnosis}</p>}
          </Carte>
          <Carte titre={`Étapes (${etapes.length})`}>
            {!etapes.length ? <Vide>Aucune étape.</Vide> : (
              <ol className="space-y-2">
                {etapes.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm" data-testid="etape">
                    <span><strong>{s.position}.</strong> {s.exercises?.prompt ?? '—'}<br />
                      <span className="text-xs text-slate-500">{noeud(s.node_id)?.label}{s.exercises ? ` · difficulté ${s.exercises.difficulty}` : ''}</span></span>
                    <span className="flex items-center gap-2">
                      {s.done_at ? <Pastille ton="vert">fait le {formatDate(s.done_at)}</Pastille> : <Pastille>à faire</Pastille>}
                      {p.status === 'proposee' && <Bouton variante="discret" onClick={() => retirer.mutate(s.id)}>Retirer</Bouton>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Carte>
        </div>
        <div className="space-y-5">
          <Carte titre="Résultat">
            <AvantApres planId={id} />
            {p.validated_by && <p className="mt-3 text-xs text-slate-500">Validé par {nomComplet(profils.data?.find((x) => x.id === p.validated_by))} le {formatDate(p.validated_at!)}</p>}
          </Carte>
          <Carte titre="Décision">
            <div className="flex flex-col gap-2">
              {p.status === 'proposee' && <>
                {vide && <Alerte ton="attention">Aucun exercice dans ce programme : créez des exercices validés sur ces objectifs.</Alerte>}
                <Bouton chargement={action.isPending} onClick={() => action.mutate('valider')}>Valider le programme</Bouton>
                <Bouton variante="danger" onClick={() => action.mutate('refuser')}>Refuser</Bouton>
              </>}
              {p.status === 'validee' && <>
                <Champ label="À faire pour le (facultatif)" type="date" min={aujourdhui()} value={echeance} onChange={(x) => setEcheance(x.target.value)} />
                <Bouton chargement={action.isPending} onClick={() => action.mutate('lancer')}>Lancer : publier les exercices à l’élève</Bouton>
              </>}
              {p.status === 'en_cours' && <Bouton chargement={action.isPending} onClick={() => action.mutate('cloturer')}>Clôturer le programme</Bouton>}
              {(p.status === 'terminee' || p.status === 'refusee') && <p className="text-sm text-slate-600">Programme {STATUTS_PLAN[p.status].libelle}{p.closed_at ? ` le ${formatDate(p.closed_at)}` : ''}.</p>}
              <p className="text-xs text-slate-500">Le système propose ; seul l’encadreur décide. Toute décision est tracée.</p>
            </div>
          </Carte>
        </div>
      </div>
    </>
  );
}
