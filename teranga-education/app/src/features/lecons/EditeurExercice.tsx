import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import {
  LIBELLES_EXERCICE, exerciceIncomplet, libelleObjectif, useObjectifs,
  type Choix, type Exercice, type TypeExercice,
} from '../../lib/pedagogie';
import { NIVEAUX, type Niveau } from '../../lib/types';
import { Alerte, Bouton, Case, Champ, Chargement, Selection, ZoneTexte } from '../../ui/composants';

const LETTRES = 'abcdefgh';

/** Création / modification d'un exercice, de son corrigé (protégé) et de ses objectifs. */
export default function EditeurExercice({ exercice, lessonId, niveau, objectifsParDefaut, onFait }: {
  exercice?: Exercice | null;
  lessonId?: string | null;
  niveau: Niveau;
  objectifsParDefaut: string[];
  onFait: () => void;
}) {
  const { profil } = useSession();
  const objectifs = useObjectifs();
  const existant = useQuery({
    queryKey: ['exercice-detail', exercice?.id],
    enabled: !!exercice,
    queryFn: async () => {
      const [k, o] = await Promise.all([
        supabase.from('exercise_keys').select('answer_key, explanation').eq('exercise_id', exercice!.id).maybeSingle(),
        supabase.from('exercise_objectives').select('node_id').eq('exercise_id', exercice!.id),
      ]);
      return { cle: verifier(k) as { answer_key: { correct?: string[]; accepted?: string[] }; explanation: string | null } | null, objectifs: (verifier(o) as { node_id: string }[]).map((x) => x.node_id) };
    },
  });
  if (exercice && existant.isLoading) return <Chargement />;
  return <Formulaire exercice={exercice ?? null} lessonId={lessonId ?? null} niveau={niveau} profilId={profil!.id}
    objectifsDispo={objectifs.data} cle={existant.data?.cle ?? null}
    objectifsInitiaux={exercice ? existant.data?.objectifs ?? [] : objectifsParDefaut} onFait={onFait} />;
}

function Formulaire({ exercice, lessonId, niveau, profilId, objectifsDispo, cle, objectifsInitiaux, onFait }: {
  exercice: Exercice | null; lessonId: string | null; niveau: Niveau; profilId: string;
  objectifsDispo: ReturnType<typeof useObjectifs>['data'];
  cle: { answer_key: { correct?: string[]; accepted?: string[] }; explanation: string | null } | null;
  objectifsInitiaux: string[]; onFait: () => void;
}) {
  const [kind, setKind] = useState<TypeExercice>(exercice?.kind ?? 'qcm');
  const [prompt, setPrompt] = useState(exercice?.prompt ?? '');
  const [niv, setNiv] = useState<Niveau>(exercice?.level_code ?? niveau);
  const [difficulte, setDifficulte] = useState<1 | 2 | 3>(exercice?.difficulty ?? 1);
  const [points, setPoints] = useState(String(exercice?.max_points ?? 1));
  const [choix, setChoix] = useState<Choix[]>(exercice?.choices ?? [{ id: 'a', label: '' }, { id: 'b', label: '' }, { id: 'c', label: '' }]);
  const [bonnes, setBonnes] = useState<string[]>(cle?.answer_key.correct ?? []);
  const [acceptees, setAcceptees] = useState((cle?.answer_key.accepted ?? []).join('\n'));
  const [explication, setExplication] = useState(cle?.explanation ?? '');
  const [objs, setObjs] = useState<Set<string>>(new Set(objectifsInitiaux));
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async (valider: boolean) => {
      const choices = kind === 'qcm' ? choix.filter((c) => c.label.trim()) : null;
      const answer_key = kind === 'qcm' ? { correct: bonnes } : kind === 'reponse_courte'
        ? { accepted: acceptees.split('\n').map((x) => x.trim()).filter(Boolean) } : {};
      if (valider) {
        const p = exerciceIncomplet({ kind, prompt, choices }, answer_key);
        if (p) throw new Error(p);
        if (!objs.size) throw new Error('Rattachez l’exercice à au moins un objectif.');
      }
      const ligne = {
        lesson_id: lessonId, level_code: niv, kind, prompt: prompt.trim(), choices, difficulty: difficulte,
        max_points: Number(points) || 1, status: valider ? 'valide' : 'brouillon',
        validated_by: valider ? profilId : null,
      };
      const ex = exercice
        ? verifier(await supabase.from('exercises').update(ligne).eq('id', exercice.id).select('id').single())
        : verifier(await supabase.from('exercises').insert({ ...ligne, author_id: profilId, origin: 'encadreur' }).select('id').single());
      verifier(await supabase.from('exercise_keys').upsert({ exercise_id: ex.id, answer_key, explanation: explication || null }));
      verifier(await supabase.from('exercise_objectives').delete().eq('exercise_id', ex.id));
      if (objs.size) verifier(await supabase.from('exercise_objectives').insert([...objs].map((node_id) => ({ exercise_id: ex.id, node_id }))));
    },
    onSuccess: onFait,
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(true); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Type d'exercice" value={kind} onChange={(e) => setKind(e.target.value as TypeExercice)}>
        {(Object.keys(LIBELLES_EXERCICE) as TypeExercice[]).map((k) => <option key={k} value={k}>{LIBELLES_EXERCICE[k]}</option>)}
      </Selection>
      <ZoneTexte label="Consigne (en français)" value={prompt} onChange={(e) => setPrompt(e.target.value)} required maxLength={1000}
        aide="Une consigne courte et claire. Situation de la vie courante bienvenue." />

      {kind === 'qcm' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Réponses proposées (cocher la ou les bonnes)</legend>
          {choix.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="checkbox" aria-label={`Bonne réponse ${c.id.toUpperCase()}`} className="h-5 w-5"
                checked={bonnes.includes(c.id)} onChange={(e) => setBonnes(e.target.checked ? [...bonnes, c.id] : bonnes.filter((x) => x !== c.id))} />
              <span className="w-5 font-semibold uppercase">{c.id}</span>
              <input aria-label={`Réponse ${c.id.toUpperCase()}`} value={c.label} maxLength={200}
                onChange={(e) => setChoix(choix.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3" />
            </div>
          ))}
          {choix.length < LETTRES.length && (
            <Bouton type="button" variante="discret" onClick={() => setChoix([...choix, { id: LETTRES[choix.length], label: '' }])}>+ Réponse</Bouton>
          )}
        </fieldset>
      )}
      {kind === 'reponse_courte' && (
        <ZoneTexte label="Réponses acceptées (une par ligne)" value={acceptees} onChange={(e) => setAcceptees(e.target.value)}
          aide="Majuscules et espaces ne comptent pas. Ex. : 3, trois" />
      )}
      {kind === 'production_libre' && <Alerte ton="info">Cet exercice sera corrigé par l’encadreur (pas de note automatique).</Alerte>}

      <ZoneTexte label="Correction expliquée" value={explication} onChange={(e) => setExplication(e.target.value)} maxLength={2000}
        aide="Montrée à l’élève et au parent seulement APRÈS la correction." />

      <div className="grid grid-cols-3 gap-3">
        <Selection label="Niveau" value={niv} onChange={(e) => setNiv(e.target.value as Niveau)}>
          {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
        </Selection>
        <Selection label="Difficulté" value={difficulte} onChange={(e) => setDifficulte(Number(e.target.value) as 1 | 2 | 3)}>
          <option value={1}>1 · facile</option><option value={2}>2 · moyen</option><option value={3}>3 · difficile</option>
        </Selection>
        <Champ label="Points" type="number" min={0.5} step={0.5} value={points} onChange={(e) => setPoints(e.target.value)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Objectif(s) travaillé(s)</legend>
        {(objectifsDispo ?? []).map((o) => (
          <Case key={o.id} label={<>{libelleObjectif(o)} {o.is_provisional && <span className="text-xs text-amber-700">(provisoire)</span>}</>}
            checked={objs.has(o.id)} onChange={(e) => { const s = new Set(objs); if (e.target.checked) s.add(o.id); else s.delete(o.id); setObjs(s); }} />
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Bouton type="submit" chargement={m.isPending}>Enregistrer et valider</Bouton>
        <Bouton type="button" variante="secondaire" onClick={() => m.mutate(false)}>Enregistrer en brouillon</Bouton>
      </div>
    </form>
  );
}
