import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { formatDate } from '../../lib/dates';
import {
  ICONES_BLOC, LIBELLES_BLOC, LIBELLES_EXERCICE, libelleObjectif, useMatieres, useObjectifs,
  type Bloc, type Exercice, type Lecon, type TypeBloc,
} from '../../lib/pedagogie';
import { NIVEAUX, nomComplet, type Niveau } from '../../lib/types';
import { Alerte, Bouton, Carte, Case, Champ, Chargement, EnTete, Modale, Pastille, Selection, Vide, ZoneTexte } from '../../ui/composants';
import { PastilleStatut } from './ListeLecons';
import EditeurExercice from './EditeurExercice';
import Publier from './Publier';
import { AudioFrancais, GestionWolof } from '../wolof/Wolof';
import { assistant } from '../../lib/ia';
import { BoutonIA, PropositionIA } from '../../ui/assistant';

const VIDE: Omit<Lecon, 'id' | 'author_id' | 'validated_by' | 'updated_at'> = {
  title: '', level_code: 'CE2', subject_id: null, prerequisites: '', remediation_hint: '', status: 'brouillon',
  content: [{ type: 'explication', texte: '' }, { type: 'exemple', texte: '' }, { type: 'resume', texte: '' }],
};

export default function EditeurLecon() {
  const { id = 'nouvelle' } = useParams();
  const nouvelle = id === 'nouvelle';
  const lecon = useQuery({
    queryKey: ['lecon', id],
    enabled: !nouvelle,
    queryFn: async () => {
      const [l, o, e, p] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
        supabase.from('lesson_objectives').select('node_id').eq('lesson_id', id),
        supabase.from('exercises').select('*').eq('lesson_id', id).order('created_at'),
        supabase.from('publications').select('id, group_id, student_id, published_at, due_at, groups(name), students(first_name, last_name)').eq('lesson_id', id),
      ]);
      return {
        lecon: verifier(l) as Lecon | null,
        objectifs: (verifier(o) as { node_id: string }[]).map((x) => x.node_id),
        exercices: verifier(e) as Exercice[],
        publications: verifier(p) as unknown as { id: string; published_at: string; due_at: string | null; groups: { name: string } | null; students: { first_name: string; last_name: string } | null }[],
      };
    },
  });
  if (!nouvelle && lecon.isLoading) return <Chargement />;
  if (!nouvelle && !lecon.data?.lecon) return <Alerte>Leçon introuvable.</Alerte>;
  return <Editeur key={id} id={nouvelle ? null : id} donnees={lecon.data ?? null} />;
}

function Editeur({ id, donnees }: { id: string | null; donnees: { lecon: Lecon | null; objectifs: string[]; exercices: Exercice[]; publications: { id: string; published_at: string; due_at: string | null; groups: { name: string } | null; students: { first_name: string; last_name: string } | null }[] } | null }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profil, roleActif } = useSession();
  const profils = useProfils();
  const matieres = useMatieres();
  const objectifs = useObjectifs();
  const l = donnees?.lecon;
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const auteur = !l || l.author_id === profil?.id;
  const modifiable = auteur || direction;

  const [f, setF] = useState(() => (l ? { ...l, prerequisites: l.prerequisites ?? '', remediation_hint: l.remediation_hint ?? '' } : { ...VIDE }));
  const [objs, setObjs] = useState<Set<string>>(new Set(donnees?.objectifs ?? []));
  const location = useLocation();
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(
    (location.state as { message?: { ton: 'succes' | 'erreur'; texte: string } } | null)?.message ?? null);
  const [modale, setModale] = useState<null | { type: 'exercice'; ex: Exercice | null } | { type: 'publier' }>(null);
  const [aideExercice, setAideExercice] = useState<string | null>(null);
  const [propositionIA, setPropositionIA] = useState<{ nombre: string; difficulte: string } | null>(null);
  const [noteIA, setNoteIA] = useState<{ texte: string; simulation: boolean } | null>(null);

  const planIA = useMutation({
    mutationFn: () => {
      if (!f.title.trim()) throw new Error('Donnez d’abord un titre à la leçon.');
      return assistant<{ blocs: Bloc[] }>('plan_lecon', { titre: f.title, niveau: f.level_code, objectifs: [...objs] });
    },
    onSuccess: (d) => {
      const vide = f.content.every((b) => !b.texte.trim());
      setF({ ...f, content: vide ? d.resultat.blocs : [...f.content, ...d.resultat.blocs] });
      setNoteIA({ texte: 'Plan proposé inséré dans la leçon : relisez-le et corrigez-le avant de valider.', simulation: d.simulation });
    },
    onError: (e) => setMessage({ ton: 'erreur', texte: (e as Error).message }),
  });
  const exercicesIA = useMutation({
    mutationFn: () => assistant<{ exercices_crees: number }>('generer_exercices', {
      lesson_id: id, nombre: Number(propositionIA?.nombre ?? 3), difficulte: Number(propositionIA?.difficulte ?? 1),
    }),
    onSuccess: (d) => {
      setPropositionIA(null);
      setNoteIA({ texte: `${d.resultat.exercices_crees} exercice(s) proposé(s) en brouillon : vérifiez chaque consigne, réponse et correction, puis validez ou supprimez.`, simulation: d.simulation });
      rafraichir();
    },
    onError: (e) => setMessage({ ton: 'erreur', texte: (e as Error).message }),
  });
  useEffect(() => { if (l) setF({ ...l, prerequisites: l.prerequisites ?? '', remediation_hint: l.remediation_hint ?? '' }); }, [l]);

  const rafraichir = () => { qc.invalidateQueries({ queryKey: ['lecon', id] }); qc.invalidateQueries({ queryKey: ['lecons'] }); };

  const enregistrer = useMutation({
    mutationFn: async (statut: Lecon['status']) => {
      if (!f.title.trim()) throw new Error('Donnez un titre à la leçon.');
      const blocs = f.content.filter((b) => b.texte.trim());
      if (statut === 'valide') {
        if (!blocs.length) throw new Error('La leçon est vide.');
        if (!objs.size) throw new Error('Rattachez la leçon à au moins un objectif du référentiel.');
      }
      const ligne = {
        title: f.title.trim(), level_code: f.level_code, subject_id: f.subject_id || null, content: blocs,
        prerequisites: f.prerequisites || null, remediation_hint: f.remediation_hint || null, status: statut,
        validated_by: statut === 'valide' ? profil!.id : null, validated_at: statut === 'valide' ? new Date().toISOString() : null,
      };
      const r = id
        ? verifier(await supabase.from('lessons').update(ligne).eq('id', id).select('id').single())
        : verifier(await supabase.from('lessons').insert({ ...ligne, author_id: profil!.id }).select('id').single());
      verifier(await supabase.from('lesson_objectives').delete().eq('lesson_id', r.id));
      if (objs.size) verifier(await supabase.from('lesson_objectives').insert([...objs].map((node_id) => ({ lesson_id: r.id, node_id }))));
      return { id: r.id, statut };
    },
    onSuccess: ({ id: nouvelId, statut }) => {
      const msg = { ton: 'succes' as const, texte: statut === 'valide' ? 'Leçon validée : elle peut être publiée.' : 'Leçon enregistrée.' };
      setMessage(msg);
      rafraichir();
      // Nouvelle leçon : la page se recharge sur son identifiant ; le message suit.
      if (!id) nav(`/lecons/${nouvelId}`, { replace: true, state: { message: msg } });
    },
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  const majBloc = (i: number, b: Partial<Bloc>) => setF({ ...f, content: f.content.map((x, j) => (j === i ? { ...x, ...b } : x)) });
  const deplacer = (i: number, d: -1 | 1) => {
    const c = [...f.content]; const j = i + d;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]]; setF({ ...f, content: c });
  };
  const objectifsNiveau = (objectifs.data ?? []).filter((o) => !o.level_code || o.level_code === f.level_code || objs.has(o.id) ||
    NIVEAUX.indexOf(o.level_code) === NIVEAUX.indexOf(f.level_code) - 1);

  return (
    <>
      <EnTete titre={id ? f.title || 'Leçon' : 'Nouvelle leçon'}
        sousTitre={l && <span className="flex flex-wrap items-center gap-2"><PastilleStatut s={l.status} />
          par {nomComplet(profils.data?.find((p) => p.id === l.author_id))} · modifiée le {formatDate(l.updated_at)}</span>}
        actions={<>
          <Link to="/lecons" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-teranga-800">← Bibliothèque</Link>
          {l?.status === 'valide' && <Bouton onClick={() => setModale({ type: 'publier' })}>Publier</Bouton>}
        </>} />
      {message && <div className="mb-4"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}
      {!modifiable && <div className="mb-4"><Alerte ton="info">Leçon d’un autre encadreur : consultation et publication uniquement.</Alerte></div>}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Carte titre="Informations">
            <fieldset disabled={!modifiable} className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><Champ label="Titre de la leçon" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={150} /></div>
              <Selection label="Niveau" value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value as Niveau })}>
                {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
              </Selection>
              <Selection label="Matière" value={f.subject_id ?? ''} onChange={(e) => setF({ ...f, subject_id: e.target.value || null })}>
                <option value="">—</option>
                {(matieres.data ?? []).filter((m) => !m.level_code || m.level_code === f.level_code).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Selection>
              <div className="sm:col-span-3"><Champ label="Prérequis (ce que l’élève doit savoir avant)" value={f.prerequisites ?? ''} onChange={(e) => setF({ ...f, prerequisites: e.target.value })} /></div>
            </fieldset>
          </Carte>

          <Carte titre="Contenu de la leçon" actions={modifiable && <BoutonIA chargement={planIA.isPending} onClick={() => planIA.mutate()}>Proposer un plan</BoutonIA>}>
            {noteIA && <div className="mb-3"><PropositionIA simulation={noteIA.simulation}>{noteIA.texte}</PropositionIA></div>}
            <fieldset disabled={!modifiable} className="space-y-3">
              {f.content.map((b, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <select aria-label={`Type du bloc ${i + 1}`} value={b.type} onChange={(e) => majBloc(i, { type: e.target.value as TypeBloc })}
                      className="min-h-[40px] rounded-lg border border-slate-300 px-2 text-sm">
                      {(Object.keys(LIBELLES_BLOC) as TypeBloc[]).map((t) => <option key={t} value={t}>{ICONES_BLOC[t]} {LIBELLES_BLOC[t]}</option>)}
                    </select>
                    <span className="ml-auto flex gap-1">
                      <Bouton type="button" variante="discret" aria-label="Monter" onClick={() => deplacer(i, -1)}>↑</Bouton>
                      <Bouton type="button" variante="discret" aria-label="Descendre" onClick={() => deplacer(i, 1)}>↓</Bouton>
                      <Bouton type="button" variante="discret" aria-label="Supprimer le bloc" onClick={() => setF({ ...f, content: f.content.filter((_, j) => j !== i) })}>✕</Bouton>
                    </span>
                  </div>
                  <textarea aria-label={`${LIBELLES_BLOC[b.type]} (bloc ${i + 1})`} value={b.texte} rows={4} maxLength={3000}
                    onChange={(e) => majBloc(i, { texte: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LIBELLES_BLOC) as TypeBloc[]).map((t) => (
                  <Bouton key={t} type="button" variante="secondaire" onClick={() => setF({ ...f, content: [...f.content, { type: t, texte: '' }] })}>
                    + {LIBELLES_BLOC[t]}
                  </Bouton>
                ))}
              </div>
              <ZoneTexte label="Piste de remédiation (pour les encadreurs)" value={f.remediation_hint ?? ''} onChange={(e) => setF({ ...f, remediation_hint: e.target.value })} />
            </fieldset>
          </Carte>

          {id && (
            <Carte titre="Audio et aide en wolof">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">🔊 Lecture en français (voix de l’encadreur)</h3>
              <AudioFrancais lessonId={id} modifiable={modifiable} />
              <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-700">🗣 Explications complémentaires en wolof</h3>
              <GestionWolof lessonId={id} modifiable />
            </Carte>
          )}

          {id && (
            <Carte titre={`Exercices (${donnees?.exercices.length ?? 0})`} actions={modifiable && <span className="flex flex-wrap gap-2">
              <BoutonIA onClick={() => setPropositionIA(propositionIA ? null : { nombre: '3', difficulte: '1' })}>Proposer des exercices</BoutonIA>
              <Bouton variante="discret" onClick={() => setModale({ type: 'exercice', ex: null })}>+ Exercice</Bouton>
            </span>}>
              {propositionIA && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                  <Selection label="Nombre" value={propositionIA.nombre} onChange={(e) => setPropositionIA({ ...propositionIA, nombre: e.target.value })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                  </Selection>
                  <Selection label="Difficulté" value={propositionIA.difficulte} onChange={(e) => setPropositionIA({ ...propositionIA, difficulte: e.target.value })}>
                    <option value="1">1 · facile</option><option value="2">2 · moyen</option><option value="3">3 · difficile</option>
                  </Selection>
                  <BoutonIA chargement={exercicesIA.isPending} onClick={() => exercicesIA.mutate()}>Générer en brouillon</BoutonIA>
                </div>
              )}
              {!donnees?.exercices.length ? <Vide>Aucun exercice. Ajoutez des exercices progressifs (facile → difficile).</Vide> : (
                <ol className="space-y-2">
                  {donnees.exercices.map((e, i) => (
                    <li key={e.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span><strong>{i + 1}.</strong> {e.prompt} <span className="text-slate-500">· {LIBELLES_EXERCICE[e.kind]} · difficulté {e.difficulty}</span>
                          {e.origin === 'ia' && <span className="ml-2"><Pastille ton="bleu">proposé par l’IA</Pastille></span>}</span>
                        <span className="flex items-center gap-2"><PastilleStatut s={e.status} />
                          <Bouton variante="discret" onClick={() => setAideExercice(aideExercice === e.id ? null : e.id)}>🗣 Aide wolof</Bouton>
                          {modifiable && <Bouton variante="discret" onClick={() => setModale({ type: 'exercice', ex: e })}>Modifier</Bouton>}</span>
                      </div>
                      {aideExercice === e.id && <div className="mt-3"><GestionWolof exerciseId={e.id} modifiable /></div>}
                    </li>
                  ))}
                </ol>
              )}
            </Carte>
          )}
        </div>

        <div className="space-y-5">
          <Carte titre="Objectifs du référentiel">
            <fieldset disabled={!modifiable} className="space-y-2">
              {!objectifsNiveau.length && <Vide>Aucun objectif pour ce niveau dans le référentiel.</Vide>}
              {objectifsNiveau.map((o) => (
                <Case key={o.id} label={<>{libelleObjectif(o)} {o.is_provisional && <Pastille ton="ambre">provisoire</Pastille>}</>}
                  checked={objs.has(o.id)} onChange={(e) => { const s = new Set(objs); if (e.target.checked) s.add(o.id); else s.delete(o.id); setObjs(s); }} />
              ))}
            </fieldset>
          </Carte>

          {modifiable && (
            <Carte titre="Enregistrer">
              <div className="flex flex-col gap-2">
                <Bouton variante="secondaire" chargement={enregistrer.isPending} onClick={() => enregistrer.mutate('brouillon')}>Enregistrer le brouillon</Bouton>
                {!direction && <Bouton variante="secondaire" onClick={() => enregistrer.mutate('a_valider')}>Soumettre à la coordination</Bouton>}
                <Bouton chargement={enregistrer.isPending} onClick={() => enregistrer.mutate('valide')}>Valider la leçon</Bouton>
                <p className="text-xs text-slate-500">Une leçon validée peut être publiée. L’auteur peut valider sa propre leçon ; la coordination peut la revoir à tout moment.</p>
              </div>
            </Carte>
          )}

          {donnees?.publications && donnees.publications.length > 0 && (
            <Carte titre="Publications">
              <ul className="space-y-1 text-sm">
                {donnees.publications.map((p) => (
                  <li key={p.id}>{p.groups?.name ?? nomComplet(p.students)} · {formatDate(p.published_at)}{p.due_at ? ` · pour le ${formatDate(p.due_at)}` : ''}</li>
                ))}
              </ul>
            </Carte>
          )}
        </div>
      </div>

      <Modale titre={modale?.type === 'exercice' && modale.ex ? 'Modifier l’exercice' : 'Nouvel exercice'} ouverte={modale?.type === 'exercice'} fermer={() => setModale(null)}>
        {modale?.type === 'exercice' && id && (
          <EditeurExercice exercice={modale.ex} lessonId={id} niveau={f.level_code} objectifsParDefaut={[...objs]}
            onFait={() => { setModale(null); rafraichir(); }} />
        )}
      </Modale>
      <Modale titre="Publier la leçon" ouverte={modale?.type === 'publier'} fermer={() => setModale(null)}>
        {id && <Publier cible={{ lesson_id: id }} onFait={() => { setModale(null); setMessage({ ton: 'succes', texte: 'Leçon publiée.' }); rafraichir(); }} />}
      </Modale>
    </>
  );
}
