import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { formatDate, formatHeure } from '../../lib/dates';
import { LIBELLES_EXERCICE, type Choix, type TypeExercice } from '../../lib/pedagogie';
import { nomComplet } from '../../lib/types';
import { Alerte, Bouton, Carte, Champ, Chargement, EnTete, Pastille, Vide, ZoneTexte } from '../../ui/composants';

interface Copie {
  id: string;
  student_id: string;
  answer: { selected?: string[]; text?: string } | null;
  auto_score: number | null;
  submitted_at: string;
  assessment_id: string | null;
  students: { first_name: string; last_name: string; level_code: string } | null;
  exercises: {
    id: string; prompt: string; kind: TypeExercice; choices: Choix[] | null; max_points: number;
    exercise_keys: { answer_key: { correct?: string[]; accepted?: string[] }; explanation: string | null } | null;
  } | null;
  assessments: { title: string } | null;
}

export default function Corrections() {
  const qc = useQueryClient();
  const copies = useQuery({
    queryKey: ['corrections', 'file'],
    queryFn: async () => verifier(await supabase.from('submissions')
      .select('id, student_id, answer, auto_score, submitted_at, assessment_id, students(first_name, last_name, level_code), exercises(id, prompt, kind, choices, max_points, exercise_keys(answer_key, explanation)), assessments(title)')
      .eq('status', 'soumis').order('submitted_at')) as unknown as Copie[],
  });
  const [message, setMessage] = useState<string | null>(null);

  const automatiques = (copies.data ?? []).filter((c) => c.auto_score !== null);
  const toutValider = useCorrection(() => { setMessage(`${automatiques.length} copie(s) validée(s) avec la note automatique.`); qc.invalidateQueries({ queryKey: ['corrections'] }); });

  return (
    <>
      <EnTete titre="Copies à corriger" sousTitre={`${copies.data?.length ?? 0} copie(s) en attente`}
        actions={automatiques.length > 0 && (
          <Bouton variante="secondaire" chargement={toutValider.isPending}
            onClick={() => toutValider.mutate(automatiques.map((c) => ({ copie: c, score: Number(c.auto_score), comment: '' })))}>
            Valider les {automatiques.length} notes automatiques
          </Bouton>
        )} />
      {message && <div className="mb-4"><Alerte ton="succes">{message}</Alerte></div>}
      {copies.isLoading ? <Chargement /> : copies.error ? <Alerte>{messageErreur(copies.error)}</Alerte> : !copies.data?.length ? (
        <Vide>Aucune copie en attente. 🎉</Vide>
      ) : (
        <div className="space-y-4">
          {copies.data.map((c) => <CarteCopie key={c.id} c={c} />)}
        </div>
      )}
    </>
  );
}

function useCorrection(onSuccess: () => void) {
  const { profil } = useSession();
  return useMutation({
    mutationFn: async (lot: { copie: Copie; score: number; comment: string }[]) => {
      verifier(await supabase.from('corrections').insert(lot.map(({ copie, score, comment }) => ({
        submission_id: copie.id, corrector_id: profil!.id, score, max_score: copie.exercises!.max_points, comment: comment || null,
      }))));
    },
    onSuccess,
  });
}

function CarteCopie({ c }: { c: Copie }) {
  const qc = useQueryClient();
  const ex = c.exercises;
  const max = ex?.max_points ?? 1;
  const [score, setScore] = useState(c.auto_score !== null ? String(c.auto_score) : '');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useCorrection(() => qc.invalidateQueries({ queryKey: ['corrections'] }));

  function valider() {
    const n = Number(score.replace(',', '.'));
    if (score === '' || Number.isNaN(n) || n < 0 || n > max) return setErreur(`Note entre 0 et ${max}.`);
    m.mutate([{ copie: c, score: n, comment: commentaire }], { onError: (e) => setErreur(messageErreur(e)) });
  }

  const cle = ex?.exercise_keys?.answer_key;
  const reponse = ex?.kind === 'qcm'
    ? (c.answer?.selected ?? []).map((id) => `${id.toUpperCase()}. ${ex.choices?.find((x) => x.id === id)?.label ?? '?'}`).join(', ') || '(aucune)'
    : c.answer?.text || '(vide)';

  return (
    <Carte titre={<span className="flex flex-wrap items-center gap-2">
      <Link to={`/eleves/${c.student_id}`} className="text-teranga-800 hover:underline">{nomComplet(c.students)}</Link>
      {c.students && <Pastille>{c.students.level_code}</Pastille>}
      {c.assessments && <Pastille ton="bleu">{c.assessments.title}</Pastille>}
    </span>} actions={<span className="text-xs text-slate-500">rendu le {formatDate(c.submitted_at)} à {formatHeure(c.submitted_at)}</span>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p className="text-slate-500">{ex ? LIBELLES_EXERCICE[ex.kind] : ''}</p>
          <p className="font-medium">{ex?.prompt}</p>
          <p className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Réponse de l’élève : </span><span className="whitespace-pre-line font-semibold" data-testid="reponse-eleve">{reponse}</span></p>
          {cle && (cle.correct || cle.accepted) && (
            <p className="text-slate-600">Attendu : {cle.correct ? cle.correct.map((x) => x.toUpperCase()).join(', ') : cle.accepted?.join(' / ')}</p>
          )}
          {c.auto_score !== null && <p><Pastille ton={Number(c.auto_score) > 0 ? 'vert' : 'rouge'}>note automatique proposée : {c.auto_score} / {max}</Pastille></p>}
        </div>
        <div className="space-y-3">
          {erreur && <Alerte>{erreur}</Alerte>}
          <Champ label={`Note (sur ${max})`} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
          <ZoneTexte label="Commentaire pour l’élève et le parent" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1000} />
          <Bouton chargement={m.isPending} onClick={valider}>Valider la correction</Bouton>
        </div>
      </div>
    </Carte>
  );
}
