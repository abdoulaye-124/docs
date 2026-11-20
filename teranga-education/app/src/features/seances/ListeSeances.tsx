import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useEncadreurs, useGroupes, useProfils, useSalles, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui, formatCreneau } from '../../lib/dates';
import { nomComplet, type Seance } from '../../lib/types';
import { Alerte, Bouton, Case, Cellule, Champ, Chargement, EnTete, Modale, Pastille, Selection, Tableau, Vide } from '../../ui/composants';

const PERIODES = { semaine: 7, quinzaine: 14, mois: 31 } as const;

export default function ListeSeances() {
  const { roleActif, profil } = useSession();
  const profils = useProfils();
  const salles = useSalles();
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const [periode, setPeriode] = useState<keyof typeof PERIODES>('quinzaine');
  const [passees, setPassees] = useState(false);
  const [ouverte, setOuverte] = useState(false);

  const debut = passees ? aujourdhui(-PERIODES[periode]) : aujourdhui();
  const fin = passees ? aujourdhui(1) : aujourdhui(PERIODES[periode]);

  const seances = useQuery({
    queryKey: ['seances', 'liste', debut, fin, roleActif],
    queryFn: async () => {
      let q = supabase.from('sessions').select('*, session_participants(group_id, student_id, groups(name))')
        .gte('starts_at', `${debut}T00:00:00`).lt('starts_at', `${fin}T00:00:00`).order('starts_at', { ascending: !passees });
      if (!direction) q = q.eq('staff_id', profil!.id);
      return verifier(await q) as (Seance & { session_participants: { group_id: string | null; groups: { name: string } | null }[] })[];
    },
  });

  return (
    <>
      <EnTete titre={direction ? 'Séances' : 'Mes séances'} actions={direction && <Bouton onClick={() => setOuverte(true)}>+ Programmer une séance</Bouton>} />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Selection label="Période" value={periode} onChange={(e) => setPeriode(e.target.value as keyof typeof PERIODES)}>
            <option value="semaine">7 jours</option>
            <option value="quinzaine">14 jours</option>
            <option value="mois">31 jours</option>
          </Selection>
        </div>
        <div className="pb-3"><Case label="Séances passées" checked={passees} onChange={(e) => setPassees(e.target.checked)} /></div>
      </div>
      {seances.isLoading ? <Chargement /> : seances.error ? <Alerte>{messageErreur(seances.error)}</Alerte> : !seances.data?.length ? (
        <Vide>Aucune séance sur cette période.</Vide>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Créneau', 'Séance', 'Groupes', 'Encadreur', 'Lieu', 'État']}>
            {seances.data.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <Cellule>{formatCreneau(s.starts_at, s.ends_at)}</Cellule>
                <Cellule><Link to={`/seances/${s.id}`} className="font-medium text-teranga-800 hover:underline">{s.title}</Link></Cellule>
                <Cellule>{s.session_participants.map((p) => p.groups?.name).filter(Boolean).join(', ') || '—'}</Cellule>
                <Cellule>{nomComplet(profils.data?.find((p) => p.id === s.staff_id))}</Cellule>
                <Cellule>{s.online_url ? 'À distance' : salles.data?.find((r) => r.id === s.room_id)?.name ?? '—'}</Cellule>
                <Cellule><EtatSeance s={s} /></Cellule>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
      <Modale titre="Programmer une séance" ouverte={ouverte} fermer={() => setOuverte(false)}>
        <NouvelleSeance />
      </Modale>
    </>
  );
}

export function EtatSeance({ s }: { s: Pick<Seance, 'status'> }) {
  if (s.status === 'annulee') return <Pastille ton="rouge">annulée</Pastille>;
  if (s.status === 'realisee') return <Pastille ton="vert">réalisée</Pastille>;
  return <Pastille ton="bleu">planifiée</Pastille>;
}

function NouvelleSeance() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profil } = useSession();
  const encadreurs = useEncadreurs();
  const groupes = useGroupes();
  const salles = useSalles();
  const [f, setF] = useState({ title: '', staff_id: '', date: aujourdhui(1), debut: '16:00', fin: '17:30', lieu: 'salle', room_id: '', online_url: '' });
  const [grp, setGrp] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      const starts = new Date(`${f.date}T${f.debut}`);
      const ends = new Date(`${f.date}T${f.fin}`);
      if (!(ends > starts)) throw new Error("L'heure de fin doit être après l'heure de début.");
      if (!grp.length) throw new Error('Choisissez au moins un groupe.');
      const s = verifier(await supabase.from('sessions').insert({
        title: f.title, staff_id: f.staff_id, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
        room_id: f.lieu === 'salle' ? f.room_id || null : null,
        online_url: f.lieu === 'distance' ? f.online_url : null, created_by: profil!.id,
      }).select('id').single());
      verifier(await supabase.from('session_participants').insert(grp.map((group_id) => ({ session_id: s.id, group_id }))));
      return s;
    },
    onSuccess: async (s) => { await qc.invalidateQueries({ queryKey: ['seances'] }); nav(`/seances/${s.id}`); },
    onError: (e) => setErreur(messageErreur(e)),
  });

  function soumettre(e: FormEvent) { e.preventDefault(); setErreur(null); m.mutate(); }
  const maj = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={soumettre} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Champ label="Intitulé" value={f.title} onChange={maj('title')} required placeholder="ex. Mathématiques CE2" />
      <Selection label="Encadreur" value={f.staff_id} onChange={maj('staff_id')} required>
        <option value="">— Choisir —</option>
        {encadreurs.data?.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}</option>)}
      </Selection>
      <div className="grid grid-cols-3 gap-3">
        <Champ label="Date" type="date" value={f.date} onChange={maj('date')} required />
        <Champ label="Début" type="time" value={f.debut} onChange={maj('debut')} required />
        <Champ label="Fin" type="time" value={f.fin} onChange={maj('fin')} required />
      </div>
      <Selection label="Lieu" value={f.lieu} onChange={maj('lieu')}>
        <option value="salle">Au centre</option>
        <option value="distance">À distance</option>
      </Selection>
      {f.lieu === 'salle' ? (
        <Selection label="Salle" value={f.room_id} onChange={maj('room_id')} required aide={!salles.data?.length ? 'Ajoutez des salles dans Paramètres.' : undefined}>
          <option value="">— Choisir —</option>
          {salles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Selection>
      ) : (
        <Champ label="Lien de connexion" type="url" value={f.online_url} onChange={maj('online_url')} required placeholder="https://…" />
      )}
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Groupes participants *</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {groupes.data?.filter((g) => g.is_active).map((g) => (
            <Case key={g.id} label={g.name} checked={grp.includes(g.id)}
              onChange={(e) => setGrp(e.target.checked ? [...grp, g.id] : grp.filter((x) => x !== g.id))} />
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-slate-500">Le système refuse automatiquement une séance si l'encadreur ou la salle est déjà occupé(e) sur ce créneau.</p>
      <Bouton type="submit" chargement={m.isPending}>Programmer</Bouton>
    </form>
  );
}
