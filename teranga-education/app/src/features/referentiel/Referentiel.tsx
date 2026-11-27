import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { libelleObjectif, useReferentiel, type Noeud } from '../../lib/pedagogie';
import { NIVEAUX } from '../../lib/types';
import { Alerte, Bouton, Carte, Case, Champ, Chargement, EnTete, Modale, Pastille, Selection, Vide } from '../../ui/composants';

interface Source { id: string; title: string; issuer: string; status: string; url: string | null; published_on: string | null; edition: string | null }

const STATUT_SOURCE: Record<string, { libelle: string; ton: 'ambre' | 'vert' | 'neutre' }> = {
  repere: { libelle: 'repérée, non authentifiée', ton: 'ambre' },
  authentifie: { libelle: 'authentifiée', ton: 'vert' },
  en_vigueur: { libelle: 'en vigueur', ton: 'vert' },
  abroge: { libelle: 'abrogée', ton: 'neutre' },
};

export default function Referentiel() {
  const { roleActif, profil } = useSession();
  const qc = useQueryClient();
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const ref = useReferentiel();
  const sources = useQuery({
    queryKey: ['sources'],
    queryFn: async () => verifier(await supabase.from('curriculum_sources').select('id, title, issuer, status, url, published_on, edition').order('created_at')) as Source[],
  });
  const [modale, setModale] = useState<null | { type: 'noeud'; parent: Noeud | null; version: string } | { type: 'source' } | { type: 'version' } | { type: 'prerequis'; noeud: Noeud }>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const rafraichir = () => { setModale(null); setErreur(null); qc.invalidateQueries({ queryKey: ['referentiel'] }); qc.invalidateQueries({ queryKey: ['sources'] }); };

  const authentifier = useMutation({
    mutationFn: async (id: string) => verifier(await supabase.from('curriculum_sources')
      .update({ status: 'authentifie', verified_by: profil!.id, verified_at: new Date().toISOString() }).eq('id', id).select('id')),
    onSuccess: rafraichir, onError: (e) => setErreur(messageErreur(e)),
  });
  const verifierNoeud = useMutation({
    mutationFn: async (id: string) => verifier(await supabase.from('curriculum_nodes').update({ is_provisional: false }).eq('id', id).select('id')),
    onSuccess: rafraichir, onError: (e) => setErreur(messageErreur(e)),
  });

  if (ref.isLoading) return <Chargement />;
  const d = ref.data!;
  const provisoires = d.noeuds.filter((n) => n.is_provisional).length;

  return (
    <>
      <EnTete titre="Référentiel pédagogique" sousTitre="Programmes, compétences et objectifs, avec leurs sources"
        actions={direction && <>
          <Bouton variante="secondaire" onClick={() => setModale({ type: 'source' })}>+ Source</Bouton>
          <Bouton variante="secondaire" onClick={() => setModale({ type: 'version' })}>+ Version</Bouton>
        </>} />

      {provisoires > 0 && (
        <div className="mb-4"><Alerte ton="attention">
          <strong>{provisoires} élément(s) provisoire(s), non officiel(s).</strong> Ils servent à construire et tester l'application en attendant
          les guides officiels authentifiés du CEB. Ils ne doivent pas être présentés comme le programme officiel.
        </Alerte></div>
      )}
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {!d.versions.length && <Vide>Aucune version de référentiel.</Vide>}
          {d.versions.map((v) => {
            const racines = d.noeuds.filter((n) => n.version_id === v.id && !n.parent_id);
            return (
              <Carte key={v.id} titre={<span className="flex flex-wrap items-center gap-2">{v.name}<Pastille ton={v.status === 'valide' ? 'vert' : 'ambre'}>{v.status === 'valide' ? 'validée' : 'brouillon'}</Pastille></span>}
                actions={direction && <Bouton variante="discret" onClick={() => setModale({ type: 'noeud', parent: null, version: v.id })}>+ Élément racine</Bouton>}>
                {v.description && <p className="mb-3 text-sm text-slate-600">{v.description}</p>}
                {!racines.length ? <Vide>Version vide.</Vide> : (
                  <ul className="space-y-2">
                    {racines.map((n) => (
                      <Branche key={n.id} n={n} tous={d.noeuds} types={d.types} prerequis={d.prerequis} direction={direction}
                        onAjouter={(p) => setModale({ type: 'noeud', parent: p, version: v.id })}
                        onPrerequis={(p) => setModale({ type: 'prerequis', noeud: p })}
                        onVerifier={(p) => verifierNoeud.mutate(p.id)} />
                    ))}
                  </ul>
                )}
              </Carte>
            );
          })}
        </div>

        <Carte titre="Sources documentaires">
          {!sources.data?.length ? <Vide>Aucune source.</Vide> : (
            <ul className="space-y-3 text-sm">
              {sources.data.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-slate-600">{s.issuer}{s.edition ? ` · ${s.edition}` : ''}{s.published_on ? ` · ${s.published_on}` : ''}</p>
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer noopener" className="break-all text-teranga-800 underline">{s.url}</a>}
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <Pastille ton={STATUT_SOURCE[s.status]?.ton ?? 'neutre'}>{STATUT_SOURCE[s.status]?.libelle ?? s.status}</Pastille>
                    {direction && s.status === 'repere' && (
                      <Bouton variante="discret" onClick={() => {
                        if (window.confirm('Confirmez-vous avoir contrôlé ce document sur un exemplaire officiel (IEF, Inspection d’Académie, ministère) ?')) authentifier.mutate(s.id);
                      }}>Marquer authentifiée</Bouton>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <Modale titre="Nouvel élément du référentiel" ouverte={modale?.type === 'noeud'} fermer={() => setModale(null)}>
        {modale?.type === 'noeud' && <FormNoeud version={modale.version} parent={modale.parent} sources={sources.data ?? []} onFait={rafraichir} />}
      </Modale>
      <Modale titre="Nouvelle source documentaire" ouverte={modale?.type === 'source'} fermer={() => setModale(null)}>
        <FormSource onFait={rafraichir} />
      </Modale>
      <Modale titre="Nouvelle version du référentiel" ouverte={modale?.type === 'version'} fermer={() => setModale(null)}>
        <FormVersion onFait={rafraichir} />
      </Modale>
      <Modale titre="Prérequis" ouverte={modale?.type === 'prerequis'} fermer={() => setModale(null)}>
        {modale?.type === 'prerequis' && <FormPrerequis noeud={modale.noeud} onFait={rafraichir} />}
      </Modale>
    </>
  );
}

function Branche({ n, tous, types, prerequis, direction, onAjouter, onPrerequis, onVerifier }: {
  n: Noeud; tous: Noeud[]; types: { id: string; label: string }[]; prerequis: { node_id: string; prerequisite_id: string }[];
  direction: boolean; onAjouter: (n: Noeud) => void; onPrerequis: (n: Noeud) => void; onVerifier: (n: Noeud) => void;
}) {
  const enfants = tous.filter((x) => x.parent_id === n.id);
  const pre = prerequis.filter((p) => p.node_id === n.id).map((p) => tous.find((x) => x.id === p.prerequisite_id)).filter(Boolean) as Noeud[];
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm">
          <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">{types.find((t) => t.id === n.node_type_id)?.label}</span>
          <span className="font-medium">{libelleObjectif(n)}</span>
          {n.is_provisional ? <span className="ml-2"><Pastille ton="ambre">provisoire</Pastille></span> : <span className="ml-2"><Pastille ton="vert">vérifié</Pastille></span>}
          {pre.length > 0 && <p className="mt-1 text-xs text-slate-600">Prérequis : {pre.map((p) => p.code ?? p.label).join(', ')}</p>}
        </div>
        {direction && (
          <span className="flex flex-wrap gap-1">
            <Bouton variante="discret" onClick={() => onAjouter(n)}>+ Sous-élément</Bouton>
            <Bouton variante="discret" onClick={() => onPrerequis(n)}>Prérequis</Bouton>
            {n.is_provisional && <Bouton variante="discret" onClick={() => onVerifier(n)}>Marquer vérifié</Bouton>}
          </span>
        )}
      </div>
      {enfants.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-teranga-100 pl-3">
          {enfants.map((e) => <Branche key={e.id} n={e} tous={tous} types={types} prerequis={prerequis} direction={direction} onAjouter={onAjouter} onPrerequis={onPrerequis} onVerifier={onVerifier} />)}
        </ul>
      )}
    </li>
  );
}

function FormNoeud({ version, parent, sources, onFait }: { version: string; parent: Noeud | null; sources: Source[]; onFait: () => void }) {
  const ref = useReferentiel();
  const types = (ref.data?.types ?? []).filter((t) => t.version_id === version);
  const [f, setF] = useState({ node_type_id: '', level_code: parent?.level_code ?? '', code: '', label: '', source_id: '', source_ref: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('curriculum_nodes').insert({
      version_id: version, parent_id: parent?.id ?? null, node_type_id: f.node_type_id, level_code: f.level_code || null,
      code: f.code || null, label: f.label, source_id: f.source_id || null, source_ref: f.source_ref || null,
    })),
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  function soumettre(e: FormEvent) { e.preventDefault(); m.mutate(); }
  if (!types.length) return <Vide>Cette version n'a pas encore de types d'éléments.</Vide>;
  return (
    <form onSubmit={soumettre} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      {parent && <p className="text-sm text-slate-600">Sous : <strong>{parent.label}</strong></p>}
      <Selection label="Type" value={f.node_type_id} onChange={(e) => setF({ ...f, node_type_id: e.target.value })} required>
        <option value="">— Choisir —</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </Selection>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="tel qu’il figure dans le guide" />
        <Selection label="Niveau" value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value })}>
          <option value="">Tous niveaux</option>
          {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
        </Selection>
      </div>
      <Champ label="Intitulé exact" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required aide="Recopier l’intitulé du document source, sans le reformuler." />
      <Selection label="Source" value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })}>
        <option value="">— Aucune —</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </Selection>
      <Champ label="Référence dans la source" value={f.source_ref} onChange={(e) => setF({ ...f, source_ref: e.target.value })} placeholder="ex. p. 42, § 3" />
      <p className="text-xs text-slate-500">L’élément sera créé « provisoire ». Il ne pourra être marqué vérifié qu’avec une source authentifiée.</p>
      <Bouton type="submit" chargement={m.isPending}>Ajouter</Bouton>
    </form>
  );
}

function FormSource({ onFait }: { onFait: () => void }) {
  const [f, setF] = useState({ title: '', issuer: '', edition: '', published_on: '', url: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('curriculum_sources').insert({
      title: f.title, issuer: f.issuer, edition: f.edition || null, published_on: f.published_on || null, url: f.url || null, status: 'repere',
    })),
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Champ label="Titre du document" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
      <Champ label="Émetteur" value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} required placeholder="ex. Ministère de l’Éducation nationale" />
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Édition" value={f.edition} onChange={(e) => setF({ ...f, edition: e.target.value })} />
        <Champ label="Date" type="date" value={f.published_on} onChange={(e) => setF({ ...f, published_on: e.target.value })} />
      </div>
      <Champ label="Lien" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <p className="text-xs text-slate-500">La source est enregistrée comme « repérée ». Elle sera authentifiée après contrôle sur un exemplaire officiel.</p>
      <Bouton type="submit" chargement={m.isPending}>Enregistrer</Bouton>
    </form>
  );
}

function FormVersion({ onFait }: { onFait: () => void }) {
  const [nom, setNom] = useState('');
  const [desc, setDesc] = useState('');
  const [types, setTypes] = useState([{ code: 'domaine', label: 'Domaine', evaluable: false }, { code: 'objectif', label: 'Objectif', evaluable: true }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const v = verifier(await supabase.from('curriculum_versions').insert({ name: nom, description: desc || null }).select('id').single());
      verifier(await supabase.from('curriculum_node_types').insert(types.filter((t) => t.label.trim()).map((t, i) => ({
        version_id: v.id, code: t.code || `niveau${i}`, label: t.label, depth: i, is_assessable: t.evaluable,
      }))));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Champ label="Nom de la version" value={nom} onChange={(e) => setNom(e.target.value)} required placeholder="ex. CEB — édition 20XX" />
      <Champ label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Niveaux de la hiérarchie (du plus général au plus précis), tels qu’ils figurent dans le guide</legend>
        {types.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Champ label={`Niveau ${i + 1}`} value={t.label} onChange={(e) => setTypes(types.map((x, j) => j === i ? { ...x, label: e.target.value, code: e.target.value.toLowerCase().replace(/[^a-z]/g, '') } : x))} />
            <div className="pb-3"><Case label="évalué" checked={t.evaluable} onChange={(e) => setTypes(types.map((x, j) => j === i ? { ...x, evaluable: e.target.checked } : x))} /></div>
          </div>
        ))}
        <Bouton type="button" variante="discret" onClick={() => setTypes([...types, { code: '', label: '', evaluable: false }])}>+ Niveau</Bouton>
      </fieldset>
      <Bouton type="submit" chargement={m.isPending}>Créer la version</Bouton>
    </form>
  );
}

function FormPrerequis({ noeud, onFait }: { noeud: Noeud; onFait: () => void }) {
  const ref = useReferentiel();
  const actuels = new Set((ref.data?.prerequis ?? []).filter((p) => p.node_id === noeud.id).map((p) => p.prerequisite_id));
  const candidats = (ref.data?.noeuds ?? []).filter((n) => n.version_id === noeud.version_id && n.id !== noeud.id);
  const [choix, setChoix] = useState<Set<string>>(actuels);
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const ajout = [...choix].filter((x) => !actuels.has(x));
      const retrait = [...actuels].filter((x) => !choix.has(x));
      if (ajout.length) verifier(await supabase.from('node_prerequisites').insert(ajout.map((p) => ({ node_id: noeud.id, prerequisite_id: p }))));
      for (const p of retrait) verifier(await supabase.from('node_prerequisites').delete().eq('node_id', noeud.id).eq('prerequisite_id', p));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
      {erreur && <Alerte>{erreur}</Alerte>}
      <p className="text-sm">Ce qu’un élève doit maîtriser avant « <strong>{noeud.label}</strong> » :</p>
      {candidats.map((c) => (
        <Case key={c.id} label={libelleObjectif(c)} checked={choix.has(c.id)}
          onChange={(e) => { const s = new Set(choix); if (e.target.checked) s.add(c.id); else s.delete(c.id); setChoix(s); }} />
      ))}
      <Bouton type="submit" chargement={m.isPending}>Enregistrer</Bouton>
    </form>
  );
}
