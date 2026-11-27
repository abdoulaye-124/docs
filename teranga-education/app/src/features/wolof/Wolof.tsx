import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { formatDate } from '../../lib/dates';
import { LIBELLES_CIBLE, type CibleWolof } from '../../lib/audio-regles';
import { LIBELLES_STATUT, type StatutValidation } from '../../lib/pedagogie';
import { Alerte, Bouton, Carte, Champ, Chargement, EnTete, Pastille, Selection, Vide, ZoneTexte } from '../../ui/composants';
import { deposerAudio, EnregistreurAudio, LecteurAudio, type AudioPret } from '../../ui/audio';
import { assistant } from '../../lib/ia';
import { BoutonIA, PropositionIA } from '../../ui/assistant';

export interface ExplicationWolof {
  id: string; lesson_id: string | null; exercise_id: string | null; target_kind: CibleWolof; target_text: string;
  text_wo: string | null; media_id: string | null; origin: string; status: StatutValidation; created_at: string;
  media: { storage_path: string } | null;
}

const SELECT_EXPLICATION = 'id, lesson_id, exercise_id, target_kind, target_text, text_wo, media_id, origin, status, created_at, media:media!wolof_explanations_media_id_fkey(storage_path)';

function PastilleValidation({ s }: { s: StatutValidation }) {
  return <Pastille ton={s === 'valide' ? 'vert' : s === 'archive' ? 'neutre' : 'ambre'}>{s === 'a_valider' ? 'à relire' : LIBELLES_STATUT[s]}</Pastille>;
}

// ----------------------------------------------------------------------------- Audio français de la leçon
export function AudioFrancais({ lessonId, modifiable }: { lessonId: string; modifiable: boolean }) {
  const { profil } = useSession();
  const qc = useQueryClient();
  const [audio, setAudio] = useState<AudioPret | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const liste = useQuery({
    queryKey: ['audio-fr', lessonId],
    queryFn: async () => verifier(await supabase.from('media').select('id, storage_path, duration_s, status, created_at')
      .eq('lesson_id', lessonId).eq('lang', 'fr').order('created_at', { ascending: false })) as
      { id: string; storage_path: string; duration_s: number | null; status: StatutValidation; created_at: string }[],
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!audio) throw new Error('Enregistrez ou déposez d’abord un audio.');
      const chemin = await deposerAudio(profil!.id, audio);
      verifier(await supabase.from('media').insert({
        storage_path: chemin, mime_type: audio.mime, duration_s: audio.duree ? Math.round(audio.duree) : null,
        lang: 'fr', origin: 'humain', lesson_id: lessonId, recorded_by: profil!.id, status: 'valide', validated_by: profil!.id,
      }));
    },
    onSuccess: () => { setAudio(null); setErreur(null); qc.invalidateQueries({ queryKey: ['audio-fr', lessonId] }); },
    onError: (e) => setErreur(messageErreur(e)),
  });
  const actuel = liste.data?.find((x) => x.status === 'valide');
  return (
    <div className="space-y-3">
      {erreur && <Alerte>{erreur}</Alerte>}
      {actuel ? <p className="flex flex-wrap items-center gap-2 text-sm">Lecture enregistrée le {formatDate(actuel.created_at)} : <LecteurAudio chemin={actuel.storage_path} /></p>
        : <p className="text-sm text-slate-600">Pas encore d’enregistrement : l’élève entend la voix de synthèse de son téléphone.</p>}
      {modifiable && (
        <>
          <EnregistreurAudio onPret={setAudio} libelle="Enregistrer la lecture de la leçon" />
          {audio && <Bouton chargement={m.isPending} onClick={() => m.mutate()}>Enregistrer l’audio français</Bouton>}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------- Explications en wolof (auteur)
export function GestionWolof({ lessonId, exerciseId, modifiable }: { lessonId?: string; exerciseId?: string; modifiable: boolean }) {
  const qc = useQueryClient();
  const cle = ['wolof', lessonId ?? exerciseId];
  const liste = useQuery({
    queryKey: cle,
    queryFn: async () => {
      let q = supabase.from('wolof_explanations').select(SELECT_EXPLICATION).order('created_at');
      q = lessonId ? q.eq('lesson_id', lessonId) : q.eq('exercise_id', exerciseId!);
      return verifier(await q) as unknown as ExplicationWolof[];
    },
  });
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="space-y-3">
      {liste.isLoading ? <Chargement /> : !liste.data?.length ? <Vide>Aucune explication en wolof.</Vide> : (
        <ul className="space-y-2">
          {liste.data.map((w) => (
            <li key={w.id} className="rounded-lg border border-slate-200 p-3 text-sm" data-testid="explication-wolof">
              <p className="flex flex-wrap items-center gap-2"><strong>{LIBELLES_CIBLE[w.target_kind]} :</strong> « {w.target_text} » <PastilleValidation s={w.status} />
                {w.origin !== 'humain' && <Pastille ton="bleu">{w.origin === 'ia' ? 'IA' : 'synthèse vocale'}</Pastille>}</p>
              {w.text_wo && <p className="mt-1 whitespace-pre-line text-slate-700">{w.text_wo}</p>}
              {w.media && <div className="mt-2"><LecteurAudio chemin={w.media.storage_path} libelle="Écouter en wolof" /></div>}
            </li>
          ))}
        </ul>
      )}
      {modifiable && (ouvert
        ? <NouvelleExplication lessonId={lessonId} exerciseId={exerciseId} onFait={() => { setOuvert(false); qc.invalidateQueries({ queryKey: cle }); }} />
        : <Bouton variante="secondaire" onClick={() => setOuvert(true)}>+ Explication en wolof</Bouton>)}
      <p className="text-xs text-slate-500">Toute explication en wolof est relue et validée par un relecteur wolof ou par la coordination avant d’être montrée aux élèves.</p>
    </div>
  );
}

function NouvelleExplication({ lessonId, exerciseId, onFait }: { lessonId?: string; exerciseId?: string; onFait: () => void }) {
  const { profil } = useSession();
  const [cible, setCible] = useState<CibleWolof>(exerciseId ? 'consigne' : 'notion');
  const [texteFr, setTexteFr] = useState('');
  const [texteWo, setTexteWo] = useState('');
  const [audio, setAudio] = useState<AudioPret | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retourIA, setRetourIA] = useState<{ fr: string; remarque: string; simulation: boolean } | null>(null);
  const ia = useMutation({
    mutationFn: () => {
      if (!texteFr.trim()) throw new Error('Indiquez d’abord le passage français à expliquer.');
      return assistant<{ explication_fr_simple: string; remarque_relecteur: string }>('proposer_wolof', {
        lesson_id: lessonId, exercise_id: exerciseId, type: cible, passage: texteFr.trim(),
      });
    },
    onSuccess: (d) => setRetourIA({ fr: d.resultat.explication_fr_simple, remarque: d.resultat.remarque_relecteur, simulation: d.simulation }),
    onError: (e) => setErreur((e as Error).message),
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!texteFr.trim()) throw new Error('Indiquez le passage français expliqué.');
      if (!texteWo.trim() && !audio) throw new Error('Ajoutez une explication écrite ou un enregistrement en wolof.');
      let mediaId: string | null = null;
      if (audio) {
        const chemin = await deposerAudio(profil!.id, audio);
        mediaId = (verifier(await supabase.from('media').insert({
          storage_path: chemin, mime_type: audio.mime, duration_s: audio.duree ? Math.round(audio.duree) : null, lang: 'wo',
          origin: 'humain', lesson_id: lessonId ?? null, exercise_id: exerciseId ?? null, recorded_by: profil!.id, status: 'a_valider',
        }).select('id').single())).id;
      }
      verifier(await supabase.from('wolof_explanations').insert({
        lesson_id: lessonId ?? null, exercise_id: exerciseId ?? null, target_kind: cible, target_text: texteFr.trim(),
        text_wo: texteWo.trim() || null, media_id: mediaId, origin: 'humain', status: 'a_valider', author_id: profil!.id,
      }));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <div className="space-y-3 rounded-lg border border-teranga-200 bg-teranga-50/40 p-3">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Ce qui est expliqué" value={cible} onChange={(e) => setCible(e.target.value as CibleWolof)}>
        {(Object.keys(LIBELLES_CIBLE) as CibleWolof[]).map((k) => <option key={k} value={k}>{LIBELLES_CIBLE[k]}</option>)}
      </Selection>
      <Champ label="Passage en français" value={texteFr} onChange={(e) => setTexteFr(e.target.value)} maxLength={300}
        placeholder={cible === 'mot' ? 'ex. partager' : 'ex. Combien chacun en reçoit-il ?'} />
      <ZoneTexte label="Explication écrite en wolof (facultatif)" value={texteWo} onChange={(e) => setTexteWo(e.target.value)} maxLength={2000}
        aide="Orthographe officielle du wolof. Explication simple, sans donner la réponse." />
      <EnregistreurAudio onPret={setAudio} libelle="Enregistrer en wolof" />
      <div className="flex flex-wrap gap-2">
        <Bouton chargement={m.isPending} onClick={() => m.mutate()}>Envoyer en relecture</Bouton>
        <BoutonIA chargement={ia.isPending} onClick={() => ia.mutate()}>Proposer avec l’assistant</BoutonIA>
      </div>
      {retourIA && (
        <PropositionIA simulation={retourIA.simulation} titre="Proposition envoyée en relecture wolof">
          <p><strong>En français simple :</strong> {retourIA.fr}</p>
          {retourIA.remarque && <p className="mt-1"><strong>Note pour le relecteur :</strong> {retourIA.remarque}</p>}
          <button className="mt-2 font-semibold text-violet-900 underline" onClick={onFait}>Fermer</button>
        </PropositionIA>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------- Relecture (relecteur wolof, coordination)
export function RelectureWolof() {
  const qc = useQueryClient();
  const file = useQuery({
    queryKey: ['relecture-wolof'],
    queryFn: async () => {
      const w = verifier(await supabase.from('wolof_explanations').select(`${SELECT_EXPLICATION}, lessons(title), exercises(prompt, lessons(title))`)
        .eq('status', 'a_valider').order('created_at')) as unknown as (ExplicationWolof & { lessons: { title: string } | null; exercises: { prompt: string; lessons: { title: string } | null } | null })[];
      return w;
    },
  });
  return (
    <>
      <EnTete titre="Relecture des contenus en wolof" sousTitre={`${file.data?.length ?? 0} contenu(s) à relire`} />
      <div className="mb-4"><Alerte ton="info">Vérifiez que le wolof est naturel et compréhensible, conforme à l’orthographe officielle, fidèle au sens du français et qu’il ne donne pas la réponse. Vous pouvez corriger le texte avant de valider.</Alerte></div>
      {file.isLoading ? <Chargement /> : !file.data?.length ? <Vide>Rien à relire. 🎉</Vide> : (
        <div className="space-y-4">
          {file.data.map((w) => <CarteRelecture key={w.id} w={w} onFait={() => qc.invalidateQueries({ queryKey: ['relecture-wolof'] })} />)}
        </div>
      )}
    </>
  );
}

function CarteRelecture({ w, onFait }: { w: ExplicationWolof & { lessons: { title: string } | null; exercises: { prompt: string; lessons: { title: string } | null } | null }; onFait: () => void }) {
  const { profil } = useSession();
  const [texte, setTexte] = useState(w.text_wo ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async (decision: 'valide' | 'archive') => {
      if (decision === 'valide' && !texte.trim() && !w.media) throw new Error('Rien à valider : ni texte ni audio.');
      if (w.media_id) {
        verifier(await supabase.from('media').update(decision === 'valide'
          ? { status: 'valide', validated_by: profil!.id } : { status: 'archive' }).eq('id', w.media_id).select('id'));
      }
      verifier(await supabase.from('wolof_explanations').update({
        text_wo: texte.trim() || null, status: decision, validated_by: decision === 'valide' ? profil!.id : null,
      }).eq('id', w.id).select('id'));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <Carte titre={<span className="flex flex-wrap items-center gap-2">{LIBELLES_CIBLE[w.target_kind]} · « {w.target_text} »
      {w.origin !== 'humain' && <Pastille ton="bleu">{w.origin === 'ia' ? 'proposé par l’IA' : 'synthèse vocale'}</Pastille>}</span>}>
      <div className="space-y-3 text-sm" data-testid="a-relire">
        {erreur && <Alerte>{erreur}</Alerte>}
        <p className="text-slate-600">Contexte : {w.lessons ? `leçon « ${w.lessons.title} »` : w.exercises ? `exercice « ${w.exercises.prompt} »${w.exercises.lessons ? ` de la leçon « ${w.exercises.lessons.title} »` : ''}` : '—'}</p>
        {w.media && <LecteurAudio chemin={w.media.storage_path} libelle="Écouter l’enregistrement" />}
        <ZoneTexte label="Texte en wolof (corrigeable)" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={2000} />
        <div className="flex flex-wrap gap-2">
          <Bouton chargement={m.isPending} onClick={() => m.mutate('valide')}>Valider</Bouton>
          <Bouton variante="danger" onClick={() => m.mutate('archive')}>Refuser</Bouton>
        </div>
      </div>
    </Carte>
  );
}

// ----------------------------------------------------------------------------- Côté élève
export function useAideWolof(cible: { lessonId?: string; exerciseId?: string }) {
  return useQuery({
    queryKey: ['aide-wolof', cible.lessonId ?? cible.exerciseId],
    queryFn: async () => {
      let q = supabase.from('wolof_explanations').select(SELECT_EXPLICATION).eq('status', 'valide').order('created_at');
      q = cible.lessonId ? q.eq('lesson_id', cible.lessonId) : q.eq('exercise_id', cible.exerciseId!);
      return verifier(await q) as unknown as ExplicationWolof[];
    },
  });
}

/** Bouton « Aide en wolof » pour l'élève : n'apparaît que s'il existe une aide validée et autorisée. */
export function AideWolofEleve({ lessonId, exerciseId }: { lessonId?: string; exerciseId?: string }) {
  const aide = useAideWolof({ lessonId, exerciseId });
  const [ouvert, setOuvert] = useState(false);
  if (!aide.data?.length) return null;
  return (
    <section className="rounded-2xl border-2 border-soleil-400 bg-soleil-100 p-4">
      <button onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="flex min-h-[48px] w-full items-center justify-between text-left text-lg font-bold text-soleil-700">
        🗣 Aide en wolof <span aria-hidden>{ouvert ? '▲' : '▼'}</span>
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-3">
          {aide.data.map((w) => (
            <li key={w.id} className="rounded-xl bg-white p-3" data-testid="aide-wolof">
              <p className="text-sm text-slate-600">{LIBELLES_CIBLE[w.target_kind]} : « {w.target_text} »</p>
              {w.text_wo && <p className="mt-1 whitespace-pre-line text-lg">{w.text_wo}</p>}
              {w.media && <div className="mt-2"><LecteurAudio chemin={w.media.storage_path} libelle="Écouter en wolof" grand /></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Lecture de la leçon : voix de l'encadreur si elle existe, sinon synthèse vocale. */
export function useAudioFrancais(lessonId: string) {
  return useQuery({
    queryKey: ['audio-fr-eleve', lessonId],
    queryFn: async () => (verifier(await supabase.from('media').select('storage_path').eq('lesson_id', lessonId)
      .eq('lang', 'fr').eq('status', 'valide').order('created_at', { ascending: false }).limit(1)) as { storage_path: string }[])[0] ?? null,
  });
}
