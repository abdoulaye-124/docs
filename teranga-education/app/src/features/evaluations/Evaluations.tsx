import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { LIBELLES_EVALUATION, LIBELLES_EXERCICE, type Evaluation, type Exercice, type TypeEvaluation } from '../../lib/pedagogie';
import { NIVEAUX, type Niveau } from '../../lib/types';
import { Alerte, Bouton, Carte, Case, Cellule, Champ, Chargement, EnTete, Modale, Pastille, Selection, Tableau, Vide } from '../../ui/composants';
import { PastilleStatut } from '../lecons/ListeLecons';
import Publier from '../lecons/Publier';

export function ListeEvaluations() {
  const nav = useNavigate();
  const evals = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => verifier(await supabase.from('assessments').select('*, assessment_items(exercise_id, position, weight)').order('created_at', { ascending: false })) as Evaluation[],
  });
  return (
    <>
      <EnTete titre="Évaluations" sousTitre="Diagnostiques, formatives et sommatives" actions={<Bouton onClick={() => nav('/evaluations/nouvelle')}>+ Nouvelle évaluation</Bouton>} />
      {evals.isLoading ? <Chargement /> : !evals.data?.length ? <Vide>Aucune évaluation.</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Évaluation', 'Type', 'Niveau', 'Questions', 'Statut']}>
            {evals.data.map((e) => (
              <tr key={e.id}>
                <Cellule><Link to={`/evaluations/${e.id}`} className="font-medium text-teranga-800 hover:underline">{e.title}</Link></Cellule>
                <Cellule>{LIBELLES_EVALUATION[e.kind]}{e.french_only && <span className="ml-2"><Pastille>français obligatoire</Pastille></span>}</Cellule>
                <Cellule><Pastille>{e.level_code}</Pastille></Cellule>
                <Cellule>{e.assessment_items.length}</Cellule>
                <Cellule><PastilleStatut s={e.status} /></Cellule>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
    </>
  );
}

export function EditeurEvaluation() {
  const { id = 'nouvelle' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profil, roleActif } = useSession();
  const nouvelle = id === 'nouvelle';

  const ev = useQuery({
    queryKey: ['evaluation', id],
    enabled: !nouvelle,
    queryFn: async () => verifier(await supabase.from('assessments').select('*, assessment_items(exercise_id, position, weight)').eq('id', id).maybeSingle()) as Evaluation | null,
  });
  const banque = useQuery({
    queryKey: ['banque-exercices'],
    queryFn: async () => verifier(await supabase.from('exercises').select('*, lessons(title)').eq('status', 'valide').order('created_at')) as (Exercice & { lessons: { title: string } | null })[],
  });

  const [f, setF] = useState<{ title: string; kind: TypeEvaluation; level_code: Niveau; french_only: boolean } | null>(null);
  const [items, setItems] = useState<string[] | null>(null);
  const location = useLocation();
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(
    (location.state as { message?: { ton: 'succes' | 'erreur'; texte: string } } | null)?.message ?? null);
  const [publier, setPublier] = useState(false);

  const e = ev.data;
  const form = f ?? (e ? { title: e.title, kind: e.kind as TypeEvaluation, level_code: e.level_code, french_only: e.french_only } : { title: '', kind: 'diagnostique' as TypeEvaluation, level_code: 'CE2' as Niveau, french_only: true });
  const choisis = items ?? (e ? [...e.assessment_items].sort((a, b) => a.position - b.position).map((i) => i.exercise_id) : []);
  const modifiable = !e || e.author_id === profil?.id || roleActif === 'admin' || roleActif === 'coordinateur';

  const enregistrer = useMutation({
    mutationFn: async (valider: boolean) => {
      if (!form.title.trim()) throw new Error('Donnez un titre.');
      if (valider && !choisis.length) throw new Error('Ajoutez au moins une question.');
      const ligne = { ...form, title: form.title.trim(), status: valider ? 'valide' : 'brouillon' };
      const r = e
        ? verifier(await supabase.from('assessments').update(ligne).eq('id', e.id).select('id').single())
        : verifier(await supabase.from('assessments').insert({ ...ligne, author_id: profil!.id }).select('id').single());
      verifier(await supabase.from('assessment_items').delete().eq('assessment_id', r.id));
      if (choisis.length) verifier(await supabase.from('assessment_items').insert(choisis.map((x, i) => ({ assessment_id: r.id, exercise_id: x, position: i + 1, weight: 1 }))));
      return r.id;
    },
    onSuccess: (nid) => {
      setMessage({ ton: 'succes', texte: 'Évaluation enregistrée.' });
      qc.invalidateQueries({ queryKey: ['evaluations'] }); qc.invalidateQueries({ queryKey: ['evaluation', id] });
      setF(null); setItems(null);
      if (nouvelle) nav(`/evaluations/${nid}`, { replace: true, state: { message: { ton: 'succes', texte: 'Évaluation enregistrée.' } } });
    },
    onError: (x) => setMessage({ ton: 'erreur', texte: messageErreur(x) }),
  });

  if (!nouvelle && ev.isLoading) return <Chargement />;
  if (!nouvelle && !e) return <Alerte>Évaluation introuvable.</Alerte>;
  const dispo = (banque.data ?? []).filter((x) => x.level_code === form.level_code);

  return (
    <>
      <EnTete titre={e ? e.title : 'Nouvelle évaluation'} sousTitre={e && <PastilleStatut s={e.status} />}
        actions={<>
          <Link to="/evaluations" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-teranga-800">← Évaluations</Link>
          {e?.status === 'valide' && <Bouton onClick={() => setPublier(true)}>Publier</Bouton>}
        </>} />
      {message && <div className="mb-4"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Carte titre="Paramètres">
          <fieldset disabled={!modifiable} className="space-y-4">
            <Champ label="Titre" value={form.title} onChange={(x) => setF({ ...form, title: x.target.value })} required />
            <Selection label="Type" value={form.kind} onChange={(x) => setF({ ...form, kind: x.target.value as TypeEvaluation })}>
              {(['diagnostique', 'formative', 'sommative'] as TypeEvaluation[]).map((k) => <option key={k} value={k}>{LIBELLES_EVALUATION[k]}</option>)}
            </Selection>
            <Selection label="Niveau" value={form.level_code} onChange={(x) => { setF({ ...form, level_code: x.target.value as Niveau }); setItems([]); }}>
              {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
            </Selection>
            <Case label="Français obligatoire (aide en wolof masquée pendant l’épreuve)" checked={form.french_only} onChange={(x) => setF({ ...form, french_only: x.target.checked })} />
          </fieldset>
          {modifiable && (
            <div className="mt-4 flex flex-col gap-2">
              <Bouton chargement={enregistrer.isPending} onClick={() => enregistrer.mutate(true)}>Enregistrer et valider</Bouton>
              <Bouton variante="secondaire" onClick={() => enregistrer.mutate(false)}>Enregistrer le brouillon</Bouton>
            </div>
          )}
        </Carte>
        <Carte titre={`Questions (${choisis.length})`} className="lg:col-span-2">
          <p className="mb-3 text-sm text-slate-600">Choisissez des exercices validés de niveau {form.level_code}, dans l’ordre de passage.</p>
          {!dispo.length ? <Vide>Aucun exercice validé pour ce niveau. Créez-en depuis une leçon.</Vide> : (
            <ul className="space-y-2">
              {dispo.map((x) => {
                const rang = choisis.indexOf(x.id);
                return (
                  <li key={x.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <Case disabled={!modifiable} checked={rang >= 0}
                      onChange={(c) => setItems(c.target.checked ? [...choisis, x.id] : choisis.filter((y) => y !== x.id))}
                      label={<>{rang >= 0 && <strong>Q{rang + 1}. </strong>}{x.prompt} <span className="text-slate-500">· {LIBELLES_EXERCICE[x.kind]} · {x.lessons?.title ?? 'hors leçon'}</span></>} />
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </div>
      <Modale titre="Publier l’évaluation" ouverte={publier} fermer={() => setPublier(false)}>
        {e && <Publier cible={{ assessment_id: e.id }} onFait={() => { setPublier(false); setMessage({ ton: 'succes', texte: 'Évaluation publiée.' }); }} />}
      </Modale>
    </>
  );
}
