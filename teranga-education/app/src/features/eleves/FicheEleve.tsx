import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { estActif, useEncadreurs, useGroupes, useProfils, verifier } from '../../lib/requetes';
import { messageErreur } from '../../lib/erreurs';
import { age, aujourdhui, formatCreneau, formatDate } from '../../lib/dates';
import { LIBELLES_PRESENCE, NIVEAUX, nomComplet, type Eleve, type StatutPresence } from '../../lib/types';
import { formaterTelephone } from '@shared/identifiants.ts';
import { Alerte, Bouton, Carte, Case, Cellule, Champ, Chargement, EnTete, Modale, Pastille, Selection, Tableau, Vide, ZoneTexte } from '../../ui/composants';
import { TEXTES_CONSENTEMENT, VERSION_TEXTES, type TypeConsentement } from './consentements';
import CompteEleve from './CompteEleve';
import { ListeResultats, useResultats } from '../eleve/EspaceEleve';

interface LienParent {
  guardian_id: string;
  relationship: string;
  is_authorized_contact: boolean;
  validated_at: string | null;
}
interface Consentement { id: string; kind: TypeConsentement | string; guardian_id: string; granted_at: string; revoked_at: string | null }

export default function FicheEleve() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { roleActif } = useSession();
  const qc = useQueryClient();
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const admin = roleActif === 'admin';
  const famille = roleActif === 'parent';
  const jour = aujourdhui();

  const eleve = useQuery({
    queryKey: ['eleve', id],
    queryFn: async () => verifier(await supabase.from('students').select('*').eq('id', id).maybeSingle()) as Eleve | null,
  });
  const profils = useProfils();
  const groupes = useGroupes();
  const liens = useQuery({
    queryKey: ['liens', id],
    enabled: !famille,
    queryFn: async () => verifier(await supabase.from('student_guardians').select('guardian_id, relationship, is_authorized_contact, validated_at').eq('student_id', id)) as LienParent[],
  });
  const consentements = useQuery({
    queryKey: ['consentements', id],
    enabled: !famille,
    queryFn: async () => verifier(await supabase.from('consents').select('id, kind, guardian_id, granted_at, revoked_at').eq('student_id', id).order('granted_at')) as Consentement[],
  });
  const presences = useQuery({
    queryKey: ['presences', 'eleve', id],
    queryFn: async () => verifier(await supabase.from('attendance').select('status, reason, session_id, sessions(title, starts_at, ends_at)').eq('student_id', id).order('recorded_at', { ascending: false }).limit(20)),
  });

  const resultats = useResultats(id);
  const [modale, setModale] = useState<null | 'parent' | 'groupe' | 'edition'>(null);
  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ['eleve', id] });
    qc.invalidateQueries({ queryKey: ['eleves'] });
    qc.invalidateQueries({ queryKey: ['liens', id] });
    qc.invalidateQueries({ queryKey: ['consentements', id] });
    qc.invalidateQueries({ queryKey: ['groupes'] });
  };

  if (eleve.isLoading) return <Chargement />;
  if (eleve.error) return <Alerte>{messageErreur(eleve.error)}</Alerte>;
  const e = eleve.data;
  if (!e) return <Alerte>Dossier introuvable ou non accessible avec votre compte.</Alerte>;

  const nomDe = (pid: string | null) => (pid ? nomComplet(profils.data?.find((p) => p.id === pid)) : '—');
  const mesGroupes = (groupes.data ?? []).map((g) => ({ g, m: g.group_members.find((m) => m.student_id === id && estActif(m, jour)) }))
    .filter((x) => x.m);

  return (
    <>
      <EnTete
        titre={nomComplet(e)}
        sousTitre={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{e.code}</span><Pastille ton="vert">{e.level_code}</Pastille>{!e.is_active && <Pastille>archivé</Pastille>}</span>}
        actions={<>
          <Link to={famille ? `/parent/enfant/${id}/suivi` : `/eleves/${id}/suivi`} className="inline-flex min-h-[44px] items-center rounded-lg bg-teranga-700 px-4 text-sm font-semibold text-white">📈 Dossier pédagogique</Link>
          {direction && <Bouton variante="secondaire" onClick={() => setModale('edition')}>Modifier</Bouton>}
        </>}
      />
      {params.get('nouveau') && (
        <div className="mb-4"><Alerte ton="succes">Élève inscrit. Associez maintenant un parent et affectez l'élève à un groupe.</Alerte></div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Carte titre="Dossier">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info l="Date de naissance" v={`${formatDate(e.birth_date)} (${age(e.birth_date)} ans)`} />
            <Info l="Inscrit le" v={formatDate(e.enrolled_on)} />
            <Info l="Établissement d'origine" v={e.origin_school ?? '—'} />
            <Info l="Classe d'origine" v={e.origin_class ?? '—'} />
            <Info l="Encadreur référent" v={nomDe(e.referent_staff_id)} />
            {!famille && <Info l="Difficultés initiales" v={e.initial_difficulties ?? '—'} large />}
          </dl>
        </Carte>

        <Carte titre="Groupes" actions={direction && <Bouton variante="discret" onClick={() => setModale('groupe')}>+ Affecter à un groupe</Bouton>}>
          {!mesGroupes.length ? <Vide>Aucun groupe actif.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {mesGroupes.map(({ g, m }) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {famille ? g.name : <Link to={`/groupes/${g.id}`} className="font-medium text-teranga-800 hover:underline">{g.name}</Link>}
                    <span className="ml-2"><Pastille ton={g.kind === 'principal' ? 'vert' : 'bleu'}>{g.kind === 'principal' ? 'principal' : 'remédiation'}</Pastille></span>
                  </span>
                  <span className="text-xs text-slate-500">depuis le {formatDate(m!.from_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        {!famille && (
          <Carte titre="Responsables légaux et consentements" actions={admin && <Bouton variante="discret" onClick={() => setModale('parent')}>+ Associer un parent</Bouton>}>
            {!liens.data?.length ? <Vide>Aucun parent associé.</Vide> : (
              <ul className="space-y-3">
                {liens.data.map((l) => {
                  const p = profils.data?.find((x) => x.id === l.guardian_id);
                  const cons = (consentements.data ?? []).filter((c) => c.guardian_id === l.guardian_id && !c.revoked_at);
                  return (
                    <li key={l.guardian_id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium">{nomComplet(p)} <span className="text-slate-500">({l.relationship})</span></p>
                      <p className="text-slate-600">{formaterTelephone(p?.phone)} {l.is_authorized_contact ? '· contact autorisé' : '· ne pas contacter'}</p>
                      <p className="mt-1 flex flex-wrap gap-1">
                        {l.validated_at ? <Pastille ton="vert">lien validé</Pastille> : <Pastille ton="ambre">lien non validé</Pastille>}
                        {cons.map((c) => <Pastille key={c.id} ton="bleu">✓ {TEXTES_CONSENTEMENT[c.kind as TypeConsentement]?.titre ?? c.kind}</Pastille>)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        )}

        {admin && <CompteEleve eleve={e} consentementCompte={(consentements.data ?? []).some((c) => c.kind === 'compte_eleve' && !c.revoked_at)} onChange={rafraichir} />}

        <Carte titre="Résultats récents" className="lg:col-span-2">
          <ListeResultats res={resultats} />
        </Carte>

        <Carte titre="Présences récentes" className="lg:col-span-2">
          {!presences.data?.length ? <Vide>Aucune présence enregistrée.</Vide> : (
            <Tableau entetes={['Séance', 'Créneau', 'Statut']}>
              {presences.data.map((p) => {
                const s = p.sessions as unknown as { title: string; starts_at: string; ends_at: string } | null;
                return (
                  <tr key={p.session_id}>
                    <Cellule>{s?.title ?? '—'}</Cellule>
                    <Cellule>{s ? formatCreneau(s.starts_at, s.ends_at) : '—'}</Cellule>
                    <Cellule><Pastille ton={p.status === 'present' ? 'vert' : p.status === 'absent' ? 'rouge' : 'ambre'}>{LIBELLES_PRESENCE[p.status as StatutPresence]}</Pastille></Cellule>
                  </tr>
                );
              })}
            </Tableau>
          )}
        </Carte>
      </div>

      <Modale titre="Associer un parent" ouverte={modale === 'parent'} fermer={() => setModale(null)}>
        <AssocierParent eleveId={id} dejaLies={(liens.data ?? []).map((l) => l.guardian_id)} onFait={() => { setModale(null); rafraichir(); }} />
      </Modale>
      <Modale titre="Affecter à un groupe" ouverte={modale === 'groupe'} fermer={() => setModale(null)}>
        <AffecterGroupe eleve={e} onFait={() => { setModale(null); rafraichir(); }} />
      </Modale>
      <Modale titre="Modifier le dossier" ouverte={modale === 'edition'} fermer={() => setModale(null)}>
        <EditionEleve eleve={e} onFait={() => { setModale(null); rafraichir(); }} />
      </Modale>
    </>
  );
}

function Info({ l, v, large }: { l: string; v: string; large?: boolean }) {
  return (
    <div className={large ? 'col-span-2' : ''}>
      <dt className="text-slate-500">{l}</dt>
      <dd className="whitespace-pre-line font-medium text-slate-900">{v}</dd>
    </div>
  );
}

function AssocierParent({ eleveId, dejaLies, onFait }: { eleveId: string; dejaLies: string[]; onFait: () => void }) {
  const { profil } = useSession();
  const profils = useProfils();
  const parents = (profils.data ?? []).filter((p) => p.roles.includes('parent') && !dejaLies.includes(p.id));
  const [parentId, setParentId] = useState('');
  const [lien, setLien] = useState('mère');
  const [contact, setContact] = useState(true);
  const [cons, setCons] = useState<Record<TypeConsentement, boolean>>({ inscription: false, compte_eleve: false, notifications: false });
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      verifier(await supabase.from('student_guardians').insert({
        student_id: eleveId, guardian_id: parentId, relationship: lien, is_authorized_contact: contact,
        validated_by: profil!.id, validated_at: new Date().toISOString(),
      }));
      const lignes = (Object.keys(cons) as TypeConsentement[]).filter((k) => cons[k]).map((kind) => ({
        student_id: eleveId, guardian_id: parentId, kind, text_version: VERSION_TEXTES, recorded_by: profil!.id,
      }));
      if (lignes.length) verifier(await supabase.from('consents').insert(lignes));
    },
    onSuccess: onFait,
    onError: (e) => setErreur(messageErreur(e)),
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!cons.inscription) return setErreur("Le consentement « Inscription et dossier pédagogique » est obligatoire.");
    m.mutate();
  }

  if (!parents.length && !profils.isLoading) {
    return <Vide>Aucun compte parent disponible. Créez d'abord le compte dans la rubrique <Link className="text-teranga-800 underline" to="/parents">Parents</Link>.</Vide>;
  }
  return (
    <form onSubmit={soumettre} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Parent / tuteur" value={parentId} onChange={(e) => setParentId(e.target.value)} required>
        <option value="">— Choisir —</option>
        {parents.map((p) => <option key={p.id} value={p.id}>{nomComplet(p)} · {formaterTelephone(p.phone)}</option>)}
      </Selection>
      <Selection label="Lien avec l'enfant" value={lien} onChange={(e) => setLien(e.target.value)}>
        {['mère', 'père', 'tuteur', 'tutrice', 'grand-parent', 'autre responsable légal'].map((x) => <option key={x}>{x}</option>)}
      </Selection>
      <Case label="Contact téléphonique autorisé" checked={contact} onChange={(e) => setContact(e.target.checked)} />
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Consentements recueillis (version {VERSION_TEXTES})</legend>
        {(Object.keys(TEXTES_CONSENTEMENT) as TypeConsentement[]).map((k) => (
          <Case key={k} checked={cons[k]} onChange={(e) => setCons({ ...cons, [k]: e.target.checked })}
            label={<><strong>{TEXTES_CONSENTEMENT[k].titre}{TEXTES_CONSENTEMENT[k].obligatoire ? ' *' : ''}</strong><br /><span className="text-slate-600">{TEXTES_CONSENTEMENT[k].texte}</span></>} />
        ))}
      </fieldset>
      <Bouton type="submit" chargement={m.isPending}>Associer et valider le lien</Bouton>
    </form>
  );
}

function AffecterGroupe({ eleve, onFait }: { eleve: Eleve; onFait: () => void }) {
  const { profil } = useSession();
  const groupes = useGroupes();
  const jour = aujourdhui();
  const dispo = (groupes.data ?? []).filter((g) => g.is_active && !g.group_members.some((m) => m.student_id === eleve.id && estActif(m, jour)));
  const [gid, setGid] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('group_members').insert({ group_id: gid, student_id: eleve.id, added_by: profil!.id })),
    onSuccess: onFait,
    onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Groupe" value={gid} onChange={(e) => setGid(e.target.value)} required>
        <option value="">— Choisir —</option>
        {dispo.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.kind === 'principal' ? `principal ${g.level_code}` : 'remédiation'}){g.kind === 'principal' && g.level_code !== eleve.level_code ? ' ⚠ autre niveau' : ''}
          </option>
        ))}
      </Selection>
      <p className="text-xs text-slate-500">Un élève n'a qu'un seul groupe principal, mais peut suivre plusieurs groupes de remédiation.</p>
      <Bouton type="submit" chargement={m.isPending}>Affecter</Bouton>
    </form>
  );
}

function EditionEleve({ eleve, onFait }: { eleve: Eleve; onFait: () => void }) {
  const { roleActif } = useSession();
  const encadreurs = useEncadreurs();
  const [f, setF] = useState({
    level_code: eleve.level_code, origin_school: eleve.origin_school ?? '', origin_class: eleve.origin_class ?? '',
    initial_difficulties: eleve.initial_difficulties ?? '', referent_staff_id: eleve.referent_staff_id ?? '', is_active: eleve.is_active,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('students').update({
      ...f, origin_school: f.origin_school || null, origin_class: f.origin_class || null,
      initial_difficulties: f.initial_difficulties || null, referent_staff_id: f.referent_staff_id || null,
    }).eq('id', eleve.id).select('id')),
    onSuccess: onFait,
    onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Niveau" value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value as Eleve['level_code'] })}>
        {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
      </Selection>
      <Selection label="Encadreur référent" value={f.referent_staff_id} onChange={(e) => setF({ ...f, referent_staff_id: e.target.value })}>
        <option value="">— Aucun —</option>
        {encadreurs.data?.map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}</option>)}
      </Selection>
      <Champ label="Établissement d'origine" value={f.origin_school} onChange={(e) => setF({ ...f, origin_school: e.target.value })} />
      <Champ label="Classe d'origine" value={f.origin_class} onChange={(e) => setF({ ...f, origin_class: e.target.value })} />
      <ZoneTexte label="Difficultés initiales" value={f.initial_difficulties} onChange={(e) => setF({ ...f, initial_difficulties: e.target.value })} />
      {roleActif === 'admin' && <Case label="Élève actif (décocher pour archiver le dossier)" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />}
      <Bouton type="submit" chargement={m.isPending}>Enregistrer</Bouton>
    </form>
  );
}
