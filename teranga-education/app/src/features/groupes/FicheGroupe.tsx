import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { estActif, useEleves, useEncadreurs, useGroupes, useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui, formatDate } from '../../lib/dates';
import { nomComplet } from '../../lib/types';
import { Alerte, Bouton, Carte, Chargement, EnTete, Pastille, Selection, Vide } from '../../ui/composants';

export default function FicheGroupe() {
  const { id = '' } = useParams();
  const { roleActif, profil } = useSession();
  const qc = useQueryClient();
  const groupes = useGroupes();
  const eleves = useEleves();
  const profils = useProfils();
  const encadreurs = useEncadreurs();
  const [eleveChoisi, setEleveChoisi] = useState('');
  const [encChoisi, setEncChoisi] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const jour = aujourdhui();
  const hier = aujourdhui(-1);

  const rafraichir = () => { setErreur(null); qc.invalidateQueries({ queryKey: ['groupes'] }); qc.invalidateQueries({ queryKey: ['eleves'] }); };
  const surErreur = (e: unknown) => setErreur(messageErreur(e));

  const ajoutEleve = useMutation({
    mutationFn: async () => verifier(await supabase.from('group_members').insert({ group_id: id, student_id: eleveChoisi, added_by: profil!.id })),
    onSuccess: () => { setEleveChoisi(''); rafraichir(); }, onError: surErreur,
  });
  const ajoutEnc = useMutation({
    mutationFn: async () => verifier(await supabase.from('group_staff').insert({ group_id: id, staff_id: encChoisi })),
    onSuccess: () => { setEncChoisi(''); rafraichir(); }, onError: surErreur,
  });
  // Retrait : on clôt l'affectation (historique conservé) ; si elle a commencé
  // aujourd'hui, on la supprime (une période vide n'a pas de sens).
  const retrait = useMutation({
    mutationFn: async ({ table, cle, valeur, depuis }: { table: 'group_members' | 'group_staff'; cle: 'student_id' | 'staff_id'; valeur: string; depuis: string }) => {
      const q = supabase.from(table);
      const r = depuis >= jour
        ? await q.delete().eq('group_id', id).eq(cle, valeur).eq('from_date', depuis)
        : await q.update({ to_date: hier }).eq('group_id', id).eq(cle, valeur).eq('from_date', depuis);
      return verifier(r);
    },
    onSuccess: rafraichir, onError: surErreur,
  });

  if (groupes.isLoading) return <Chargement />;
  const g = groupes.data?.find((x) => x.id === id);
  if (!g) return <Alerte>Groupe introuvable ou non accessible.</Alerte>;

  const membres = g.group_members.filter((m) => estActif(m, jour));
  const staff = g.group_staff.filter((a) => estActif(a, jour));
  const candidats = (eleves.data ?? []).filter((e) => e.is_active && !membres.some((m) => m.student_id === e.id))
    .sort((a, b) => Number(b.level_code === g.level_code) - Number(a.level_code === g.level_code));
  const encCandidats = (encadreurs.data ?? []).filter((p) => p.is_active && !staff.some((a) => a.staff_id === p.id));

  return (
    <>
      <EnTete titre={g.name}
        sousTitre={<span className="flex flex-wrap gap-2">
          <Pastille ton={g.kind === 'principal' ? 'vert' : 'bleu'}>{g.kind === 'principal' ? 'Groupe principal' : 'Remédiation'}</Pastille>
          {g.level_code && <Pastille>{g.level_code}</Pastille>}
          <span>depuis le {formatDate(g.starts_on)}{g.ends_on ? ` jusqu'au ${formatDate(g.ends_on)}` : ''}</span>
        </span>} />
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Carte titre={`Élèves (${membres.length})`} className="lg:col-span-2">
          {direction && (
            <form onSubmit={(e) => { e.preventDefault(); ajoutEleve.mutate(); }} className="mb-4 flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Selection label="Ajouter un élève" value={eleveChoisi} onChange={(e) => setEleveChoisi(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {candidats.map((e) => <option key={e.id} value={e.id}>{nomComplet(e)} ({e.level_code})</option>)}
                </Selection>
              </div>
              <Bouton type="submit" chargement={ajoutEleve.isPending}>Ajouter</Bouton>
            </form>
          )}
          {!membres.length ? <Vide>Aucun élève dans ce groupe.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {membres.map((m) => {
                const e = eleves.data?.find((x) => x.id === m.student_id);
                return (
                  <li key={m.student_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <Link to={`/eleves/${m.student_id}`} className="font-medium text-teranga-800 hover:underline">{nomComplet(e)}</Link>
                      {e && <span className="ml-2"><Pastille>{e.level_code}</Pastille></span>}
                    </span>
                    {direction && <Bouton variante="discret" onClick={() => retrait.mutate({ table: 'group_members', cle: 'student_id', valeur: m.student_id, depuis: m.from_date })}>Retirer</Bouton>}
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>

        <Carte titre="Encadreurs">
          {direction && (
            <form onSubmit={(e) => { e.preventDefault(); ajoutEnc.mutate(); }} className="mb-4 space-y-2">
              <Selection label="Affecter un encadreur" value={encChoisi} onChange={(e) => setEncChoisi(e.target.value)} required>
                <option value="">— Choisir —</option>
                {encCandidats.map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}</option>)}
              </Selection>
              <Bouton type="submit" chargement={ajoutEnc.isPending}>Affecter</Bouton>
            </form>
          )}
          {!staff.length ? <Vide>Aucun encadreur affecté.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {staff.map((a) => (
                <li key={a.staff_id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{nomComplet(profils.data?.find((p) => p.id === a.staff_id))}</span>
                  {direction && <Bouton variante="discret" onClick={() => retrait.mutate({ table: 'group_staff', cle: 'staff_id', valeur: a.staff_id, depuis: a.from_date })}>Retirer</Bouton>}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
