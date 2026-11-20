import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { messageErreur } from '../../lib/erreurs';
import { formatDate } from '../../lib/dates';
import { ICONES_BLOC, LIBELLES_BLOC, type Exercice } from '../../lib/pedagogie';
import { Alerte, Bouton, Chargement, Vide } from '../../ui/composants';
import { lireAVoixHaute, useTravailEleve } from './donnees';

function Retour({ a = '/eleve', texte = 'Accueil' }: { a?: string; texte?: string }) {
  return <Link to={a} className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-base font-semibold text-teranga-800">← {texte}</Link>;
}

function BoutonEcouter({ texte }: { texte: string }) {
  return (
    <button onClick={() => lireAVoixHaute(texte)} aria-label="Écouter" title="Écouter"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teranga-700 text-2xl text-white">🔊</button>
  );
}

// ----------------------------------------------------------------------------- Mes leçons
export function MesLecons() {
  const t = useTravailEleve();
  if (t.isLoading) return <Chargement />;
  const lecons = t.data?.lecons ?? [];
  return (
    <div className="mx-auto max-w-xl">
      <Retour />
      <h1 className="mb-4 text-2xl font-bold">📖 Mes leçons</h1>
      {!lecons.length ? <Vide>Pas encore de leçon. Ton encadreur va bientôt en publier.</Vide> : (
        <ul className="space-y-3">
          {lecons.map((l) => (
            <li key={l.id}>
              <Link to={`/eleve/lecons/${l.id}`} className="flex min-h-[64px] items-center justify-between rounded-2xl bg-white p-4 text-lg font-semibold shadow-sm">
                {l.title}<span aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeconEleve() {
  const { id = '' } = useParams();
  const t = useTravailEleve();
  if (t.isLoading) return <Chargement />;
  const l = t.data?.lecons.find((x) => x.id === id);
  if (!l) return <div className="mx-auto max-w-xl"><Retour a="/eleve/lecons" texte="Mes leçons" /><Alerte>Leçon introuvable.</Alerte></div>;
  const exercices = (t.data?.exercices ?? []).filter((e) => e.lesson_id === id);
  return (
    <div className="mx-auto max-w-xl">
      <Retour a="/eleve/lecons" texte="Mes leçons" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{l.title}</h1>
        <BoutonEcouter texte={[l.title, ...l.content.map((b) => b.texte)].join('. ')} />
      </div>
      <div className="space-y-3">
        {l.content.map((b, i) => (
          <section key={i} className={`rounded-2xl p-4 shadow-sm ${b.type === 'resume' ? 'bg-soleil-100' : 'bg-white'}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600"><span aria-hidden>{ICONES_BLOC[b.type]}</span> {LIBELLES_BLOC[b.type]}</h2>
              <button onClick={() => lireAVoixHaute(b.texte)} aria-label={`Écouter : ${LIBELLES_BLOC[b.type]}`} className="min-h-[40px] min-w-[40px] rounded-full text-xl hover:bg-slate-100">🔊</button>
            </div>
            <p className="whitespace-pre-line text-lg leading-relaxed">{b.texte}</p>
          </section>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">L’explication complémentaire en wolof arrive à la Phase 5.</p>
      {exercices.length > 0 && (
        <Link to={`/eleve/exercer/${exercices[0].id}`} className="mt-6 flex min-h-[64px] items-center justify-center rounded-2xl bg-teranga-700 text-xl font-bold text-white">
          ✏️ Je m’exerce ({exercices.length})
        </Link>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------- Mes exercices
export function MesExercices() {
  const t = useTravailEleve();
  if (t.isLoading) return <Chargement />;
  const d = t.data!;
  const fait = (exId: string, evId: string | null = null) => d.copies.some((c) => c.exercise_id === exId && c.assessment_id === evId);
  const aFaire = d.exercices.filter((e) => !fait(e.id));
  const dejaFaits = d.exercices.filter((e) => fait(e.id));
  const evals = d.evaluations.map((e) => ({ ...e, terminee: e.assessment_items.every((i) => fait(i.exercise_id, e.id)) }));
  const echeance = (pid: { lesson_id: string | null; exercise_id: string | null }) =>
    d.publications.find((p) => (pid.lesson_id && p.lesson_id === pid.lesson_id) || (pid.exercise_id && p.exercise_id === pid.exercise_id))?.due_at;

  return (
    <div className="mx-auto max-w-xl">
      <Retour />
      <h1 className="mb-4 text-2xl font-bold">✏️ Mes exercices</h1>
      {evals.filter((e) => !e.terminee).map((e) => (
        <Link key={e.id} to={`/eleve/evaluation/${e.id}`} className="mb-3 flex min-h-[64px] items-center justify-between rounded-2xl bg-sky-100 p-4 text-lg font-semibold text-sky-900 shadow-sm">
          📝 {e.title}<span className="text-sm font-medium">{e.assessment_items.length} questions ›</span>
        </Link>
      ))}
      {!aFaire.length && !evals.some((e) => !e.terminee) ? <Vide>Bravo, tout est fait ! 🌟</Vide> : (
        <ul className="space-y-3">
          {aFaire.map((e, i) => {
            const due = echeance({ lesson_id: e.lesson_id, exercise_id: e.id });
            return (
              <li key={e.id}>
                <Link to={`/eleve/exercer/${e.id}`} className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="text-lg font-semibold">Exercice {i + 1}<span className="block text-sm font-normal text-slate-600">{'⭐'.repeat(e.difficulty)}{due ? ` · pour le ${formatDate(due)}` : ''}</span></span>
                  <span aria-hidden className="text-2xl">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {dejaFaits.length > 0 && <p className="mt-4 text-sm text-slate-600">{dejaFaits.length} exercice(s) déjà rendu(s). <Link to="/eleve/resultats" className="font-semibold text-teranga-800">Voir mes résultats</Link></p>}
    </div>
  );
}

// ----------------------------------------------------------------------------- Lecteur d’exercice
function Question({ e, onEnvoyer, envoi }: { e: Exercice; onEnvoyer: (r: { selected?: string[]; text?: string }) => void; envoi: boolean }) {
  const [choix, setChoix] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const pret = e.kind === 'qcm' ? choix.length > 0 : texte.trim().length > 0;
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="whitespace-pre-line text-xl font-semibold leading-relaxed" data-testid="consigne">{e.prompt}</p>
        <BoutonEcouter texte={e.prompt} />
      </div>
      {e.kind === 'qcm' ? (
        <div className="grid gap-3" role="group" aria-label="Réponses">
          {(e.choices ?? []).map((c) => (
            <button key={c.id} type="button" aria-pressed={choix.includes(c.id)}
              onClick={() => setChoix(choix.includes(c.id) ? choix.filter((x) => x !== c.id) : [...choix, c.id])}
              className={`min-h-[60px] rounded-2xl border-2 px-4 text-left text-xl font-semibold ${choix.includes(c.id) ? 'border-teranga-700 bg-teranga-50' : 'border-slate-200 bg-white'}`}>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <label className="block">
          <span className="mb-2 block text-base font-medium">Ma réponse</span>
          {e.kind === 'reponse_courte'
            ? <input value={texte} onChange={(x) => setTexte(x.target.value)} className="min-h-[60px] w-full rounded-2xl border-2 border-slate-300 px-4 text-2xl" />
            : <textarea value={texte} onChange={(x) => setTexte(x.target.value)} rows={6} maxLength={3000} className="w-full rounded-2xl border-2 border-slate-300 p-4 text-lg" />}
        </label>
      )}
      <Bouton className="mt-6 min-h-[60px] w-full text-xl" disabled={!pret} chargement={envoi}
        onClick={() => onEnvoyer(e.kind === 'qcm' ? { selected: choix } : { text: texte })}>
        J’envoie ma réponse
      </Bouton>
    </div>
  );
}

function useEnvoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { exercice: string; reponse: { selected?: string[]; text?: string }; evaluation?: string }) =>
      verifier(await supabase.rpc('submit_answer', {
        p_exercise: p.exercice, p_answer: p.reponse, p_client_id: crypto.randomUUID(), p_assessment: p.evaluation ?? null,
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travail-eleve'] }),
  });
}

function Bravo({ texte, suite }: { texte: string; suite: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-teranga-50 p-6 text-center" role="status">
      <p className="text-5xl" aria-hidden>🌟</p>
      <p className="mt-2 text-2xl font-bold text-teranga-900">{texte}</p>
      <p className="mt-1 text-slate-700">Ton encadreur va corriger. Tu verras le résultat dans « Mes résultats ».</p>
      <div className="mt-5 flex flex-col gap-3">{suite}</div>
    </div>
  );
}

export function Exercer() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const t = useTravailEleve();
  const envoi = useEnvoi();
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (t.isLoading) return <Chargement />;
  const e = t.data?.exercices.find((x) => x.id === id);
  if (!e) return <div className="mx-auto max-w-xl"><Retour a="/eleve/exercices" texte="Mes exercices" /><Alerte>Exercice introuvable.</Alerte></div>;
  const suivants = (t.data?.exercices ?? []).filter((x) => x.id !== id && x.lesson_id === e.lesson_id &&
    !t.data!.copies.some((c) => c.exercise_id === x.id));

  return (
    <div className="mx-auto max-w-xl">
      <Retour a="/eleve/exercices" texte="Mes exercices" />
      {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}
      {envoye ? (
        <Bravo texte="Réponse envoyée !" suite={<>
          {suivants[0] && <Bouton className="min-h-[56px] text-lg" onClick={() => { setEnvoye(false); nav(`/eleve/exercer/${suivants[0].id}`); }}>Exercice suivant ›</Bouton>}
          <Link to="/eleve/exercices" className="font-semibold text-teranga-800">Retour à mes exercices</Link>
        </>} />
      ) : (
        <Question key={e.id} e={e} envoi={envoi.isPending}
          onEnvoyer={(r) => envoi.mutate({ exercice: e.id, reponse: r }, { onSuccess: () => setEnvoye(true), onError: (x) => setErreur(messageErreur(x)) })} />
      )}
    </div>
  );
}

export function EvaluationEleve() {
  const { id = '' } = useParams();
  const t = useTravailEleve();
  const envoi = useEnvoi();
  const [erreur, setErreur] = useState<string | null>(null);
  const questions = useQuery({
    queryKey: ['evaluation-eleve', id],
    queryFn: async () => {
      const items = verifier(await supabase.from('assessment_items').select('exercise_id, position').eq('assessment_id', id).order('position')) as { exercise_id: string; position: number }[];
      if (!items.length) return [];
      const ex = verifier(await supabase.from('exercises').select('*').in('id', items.map((i) => i.exercise_id))) as Exercice[];
      return items.map((i) => ex.find((x) => x.id === i.exercise_id)).filter(Boolean) as Exercice[];
    },
  });
  if (t.isLoading || questions.isLoading) return <Chargement />;
  const ev = t.data?.evaluations.find((x) => x.id === id);
  if (!ev) return <div className="mx-auto max-w-xl"><Retour a="/eleve/exercices" texte="Mes exercices" /><Alerte>Évaluation introuvable.</Alerte></div>;
  const restantes = (questions.data ?? []).filter((q) => !t.data!.copies.some((c) => c.exercise_id === q.id && c.assessment_id === id));
  const total = questions.data?.length ?? 0;
  const q = restantes[0];

  return (
    <div className="mx-auto max-w-xl">
      <Retour a="/eleve/exercices" texte="Mes exercices" />
      <h1 className="text-xl font-bold">📝 {ev.title}</h1>
      <p className="mb-4 text-sm text-slate-600">{q ? `Question ${total - restantes.length + 1} sur ${total}` : 'Terminé'}{ev.french_only ? ' · en français' : ''}</p>
      {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}
      {q ? (
        <Question key={q.id} e={q} envoi={envoi.isPending}
          onEnvoyer={(r) => envoi.mutate({ exercice: q.id, reponse: r, evaluation: id }, { onError: (x) => setErreur(messageErreur(x)) })} />
      ) : (
        <Bravo texte="Évaluation terminée !" suite={<Link to="/eleve" className="font-semibold text-teranga-800">Retour à l’accueil</Link>} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------- Mes résultats
export function MesResultats() {
  const res = useResultats();
  return (
    <div className="mx-auto max-w-xl">
      <Retour />
      <h1 className="mb-4 text-2xl font-bold">⭐ Mes résultats</h1>
      <ListeResultats res={res} pourEleve />
    </div>
  );
}

export interface Resultat {
  id: string; status: string; submitted_at: string;
  exercises: { prompt: string } | null;
  corrections: { score: number; max_score: number; comment: string | null } | null;
}

export function useResultats(studentId?: string) {
  return useQuery({
    queryKey: ['resultats', studentId ?? 'moi'],
    queryFn: async () => {
      let q = supabase.from('submissions').select('id, status, submitted_at, exercises(prompt), corrections(score, max_score, comment)')
        .order('submitted_at', { ascending: false }).limit(30);
      if (studentId) q = q.eq('student_id', studentId);
      return verifier(await q) as unknown as Resultat[];
    },
  });
}

export function ListeResultats({ res, pourEleve }: { res: ReturnType<typeof useResultats>; pourEleve?: boolean }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['retour', ouvert],
    enabled: !!ouvert,
    queryFn: async () => (verifier(await supabase.rpc('correction_feedback', { p_submission: ouvert })) as { explanation: string | null }[])[0] ?? null,
  });
  if (res.isLoading) return <Chargement />;
  if (!res.data?.length) return <Vide>{pourEleve ? 'Pas encore de résultat.' : 'Aucun exercice rendu.'}</Vide>;
  return (
    <ul className="space-y-3">
      {res.data.map((r) => {
        const c = r.corrections;
        const reussi = c && Number(c.score) >= Number(c.max_score) / 2;
        return (
          <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm" data-testid="resultat">
            <p className="font-medium">{r.exercises?.prompt}</p>
            <p className="mt-1 text-sm text-slate-500">rendu le {formatDate(r.submitted_at)}</p>
            {c ? (
              <>
                <p className={`mt-2 text-lg font-bold ${reussi ? 'text-teranga-800' : 'text-soleil-700'}`}>
                  {reussi ? '🌟' : '💪'} {Number(c.score)} / {Number(c.max_score)}
                </p>
                {c.comment && <p className="mt-1 whitespace-pre-line text-slate-700">« {c.comment} »</p>}
                <button onClick={() => setOuvert(ouvert === r.id ? null : r.id)} className="mt-2 min-h-[44px] text-sm font-semibold text-teranga-800">
                  {ouvert === r.id ? 'Masquer la correction' : 'Voir la correction expliquée'}
                </button>
                {ouvert === r.id && (detail.isLoading ? <Chargement /> :
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-teranga-50 p-3" data-testid="correction-expliquee">{detail.data?.explanation ?? 'Pas de correction détaillée.'}</p>)}
              </>
            ) : <p className="mt-2 text-sm text-slate-600">⏳ En attente de correction</p>}
          </li>
        );
      })}
    </ul>
  );
}
