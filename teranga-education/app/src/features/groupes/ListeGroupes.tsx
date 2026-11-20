import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { estActif, useGroupes, useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui } from '../../lib/dates';
import { NIVEAUX, nomComplet } from '../../lib/types';
import { Alerte, Bouton, Carte, Champ, Chargement, EnTete, Modale, Pastille, Selection, Vide } from '../../ui/composants';

export default function ListeGroupes() {
  const { roleActif, profil } = useSession();
  const groupes = useGroupes();
  const profils = useProfils();
  const [ouverte, setOuverte] = useState(false);
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const jour = aujourdhui();

  const liste = (groupes.data ?? []).filter((g) =>
    direction || g.group_staff.some((a) => a.staff_id === profil?.id && estActif(a, jour)));
  const principaux = liste.filter((g) => g.kind === 'principal');
  const remediation = liste.filter((g) => g.kind === 'remediation');

  const bloc = (titre: string, gs: typeof liste) => (
    <Carte titre={titre}>
      {!gs.length ? <Vide>Aucun groupe.</Vide> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {gs.map((g) => {
            const membres = g.group_members.filter((m) => estActif(m, jour)).length;
            const enc = g.group_staff.filter((a) => estActif(a, jour)).map((a) => nomComplet(profils.data?.find((p) => p.id === a.staff_id)));
            return (
              <li key={g.id}>
                <Link to={`/groupes/${g.id}`} className="block rounded-xl border border-slate-200 p-4 hover:border-teranga-500 hover:bg-teranga-50">
                  <p className="flex items-center justify-between font-semibold">{g.name}{g.level_code && <Pastille ton="vert">{g.level_code}</Pastille>}</p>
                  <p className="mt-1 text-sm text-slate-600">{membres} élève(s)</p>
                  <p className="text-sm text-slate-600">{enc.length ? enc.join(', ') : 'Aucun encadreur'}</p>
                  {!g.is_active && <Pastille>inactif</Pastille>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );

  return (
    <>
      <EnTete titre={direction ? 'Groupes' : 'Mes groupes'} actions={direction && <Bouton onClick={() => setOuverte(true)}>+ Nouveau groupe</Bouton>} />
      {groupes.isLoading ? <Chargement /> : (
        <div className="space-y-5">
          {bloc('Groupes principaux (par niveau)', principaux)}
          {bloc('Groupes de remédiation', remediation)}
        </div>
      )}
      <Modale titre="Nouveau groupe" ouverte={ouverte} fermer={() => setOuverte(false)}>
        <NouveauGroupe />
      </Modale>
    </>
  );
}

function NouveauGroupe() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profil } = useSession();
  const [f, setF] = useState({ name: '', kind: 'principal', level_code: 'CE2', starts_on: aujourdhui(), ends_on: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('groups').insert({
      name: f.name, kind: f.kind, level_code: f.level_code || null, starts_on: f.starts_on, ends_on: f.ends_on || null, created_by: profil!.id,
    }).select('id').single()),
    onSuccess: async (g) => { await qc.invalidateQueries({ queryKey: ['groupes'] }); nav(`/groupes/${g.id}`); },
    onError: (e) => setErreur(messageErreur(e)),
  });
  function soumettre(e: FormEvent) { e.preventDefault(); m.mutate(); }
  return (
    <form onSubmit={soumettre} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Type de groupe" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
        <option value="principal">Groupe principal (un niveau)</option>
        <option value="remediation">Groupe de remédiation (transversal)</option>
      </Selection>
      <Champ label="Nom du groupe" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required
        placeholder={f.kind === 'principal' ? 'ex. Groupe CE2 A' : 'ex. Remédiation calcul'} />
      <Selection label="Niveau" value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value })} required={f.kind === 'principal'}>
        {f.kind === 'remediation' && <option value="">Plusieurs niveaux</option>}
        {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
      </Selection>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Début" type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} required />
        <Champ label="Fin (facultatif)" type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} min={f.starts_on} />
      </div>
      <Bouton type="submit" chargement={m.isPending}>Créer le groupe</Bouton>
    </form>
  );
}
