import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { estActif, useGroupes, useProfils, useSalles, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui, formatCreneau } from '../../lib/dates';
import { LIBELLES_PRESENCE, nomComplet, type Seance, type StatutPresence } from '../../lib/types';
import { Alerte, Bouton, Carte, Chargement, EnTete, Pastille, Vide, ZoneTexte } from '../../ui/composants';
import { EtatSeance } from './ListeSeances';

const STATUTS: StatutPresence[] = ['present', 'retard', 'absent', 'excuse'];

export default function FicheSeance() {
  const { id = '' } = useParams();
  const { roleActif, profil } = useSession();
  const qc = useQueryClient();
  const profils = useProfils();
  const salles = useSalles();
  const groupes = useGroupes();
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(null);

  const seance = useQuery({
    queryKey: ['seance', id],
    queryFn: async () => verifier(await supabase.from('sessions').select('*, session_participants(group_id, student_id)').eq('id', id).maybeSingle()) as
      (Seance & { session_participants: { group_id: string | null; student_id: string | null }[] }) | null,
  });
  const presences = useQuery({
    queryKey: ['presences', 'seance', id],
    queryFn: async () => verifier(await supabase.from('attendance').select('student_id, status, reason').eq('session_id', id)),
  });
  const eleves = useQuery({
    queryKey: ['eleves', 'seance', id],
    enabled: !!seance.data && !!groupes.data,
    queryFn: async () => {
      const s = seance.data!;
      const jour = s.starts_at.slice(0, 10);
      const ids = new Set<string>(s.session_participants.flatMap((p) => (p.student_id ? [p.student_id] : [])));
      for (const p of s.session_participants) {
        const g = groupes.data!.find((x) => x.id === p.group_id);
        g?.group_members.filter((m) => estActif(m, jour)).forEach((m) => ids.add(m.student_id));
      }
      if (!ids.size) return [];
      return verifier(await supabase.from('students').select('id, first_name, last_name, level_code').in('id', [...ids]).order('last_name'));
    },
  });

  const peutSaisir = !!seance.data && (roleActif === 'admin' || roleActif === 'coordinateur' || seance.data.staff_id === profil?.id) && roleActif !== 'parent';
  const [saisie, setSaisie] = useState<Record<string, StatutPresence>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setSaisie(Object.fromEntries((presences.data ?? []).map((p) => [p.student_id, p.status as StatutPresence])));
  }, [presences.data]);
  useEffect(() => { setNotes(seance.data?.notes ?? ''); }, [seance.data?.notes]);

  const enregistrer = useMutation({
    mutationFn: async () => {
      const lignes = Object.entries(saisie).map(([student_id, status]) => ({
        session_id: id, student_id, status, recorded_by: profil!.id, recorded_at: new Date().toISOString(),
      }));
      if (lignes.length) verifier(await supabase.from('attendance').upsert(lignes, { onConflict: 'session_id,student_id' }));
      const maj: Partial<Seance> = { notes: notes || null };
      if (seance.data?.status === 'planifiee' && new Date(seance.data.starts_at) <= new Date()) maj.status = 'realisee';
      verifier(await supabase.from('sessions').update(maj).eq('id', id).select('id'));
    },
    onSuccess: () => {
      setMessage({ ton: 'succes', texte: 'Présences et observations enregistrées.' });
      qc.invalidateQueries({ queryKey: ['presences'] });
      qc.invalidateQueries({ queryKey: ['seance', id] });
      qc.invalidateQueries({ queryKey: ['seances'] });
    },
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  const annuler = useMutation({
    mutationFn: async () => verifier(await supabase.from('sessions').update({ status: 'annulee' }).eq('id', id).select('id')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seance', id] }); qc.invalidateQueries({ queryKey: ['seances'] }); },
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  const toutPresent = useMemo(() => () => setSaisie(Object.fromEntries((eleves.data ?? []).map((e) => [e.id, 'present' as StatutPresence]))), [eleves.data]);

  if (seance.isLoading) return <Chargement />;
  const s = seance.data;
  if (!s) return <Alerte>Séance introuvable ou non accessible.</Alerte>;
  const nomsGroupes = s.session_participants.map((p) => groupes.data?.find((g) => g.id === p.group_id)).filter(Boolean);
  const salle = salles.data?.find((r) => r.id === s.room_id);
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';

  return (
    <>
      <EnTete titre={s.title} sousTitre={<span className="flex flex-wrap items-center gap-2">{formatCreneau(s.starts_at, s.ends_at)} <EtatSeance s={s} /></span>}
        actions={direction && s.status === 'planifiee' && <Bouton variante="danger" onClick={() => annuler.mutate()}>Annuler la séance</Bouton>} />
      {message && <div className="mb-4"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Carte titre="Informations">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-slate-500">Encadreur</dt><dd className="font-medium">{nomComplet(profils.data?.find((p) => p.id === s.staff_id))}</dd></div>
            <div><dt className="text-slate-500">Lieu</dt><dd className="font-medium">{s.online_url ? <a href={s.online_url} target="_blank" rel="noreferrer noopener" className="text-teranga-800 underline">Lien de connexion</a> : salle?.name ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Groupes</dt><dd className="font-medium">{nomsGroupes.map((g) => g!.name).join(', ') || '—'}</dd></div>
          </dl>
        </Carte>

        <Carte titre={`Appel (${eleves.data?.length ?? 0} élève(s))`} className="lg:col-span-2"
          actions={peutSaisir && s.status !== 'annulee' && <Bouton variante="discret" onClick={toutPresent}>Tous présents</Bouton>}>
          {eleves.isLoading ? <Chargement /> : !eleves.data?.length ? <Vide>Aucun élève attendu.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {eleves.data.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium">
                    {roleActif === 'parent' ? nomComplet(e) : <Link to={`/eleves/${e.id}`} className="text-teranga-800 hover:underline">{nomComplet(e)}</Link>}
                  </span>
                  {peutSaisir && s.status !== 'annulee' ? (
                    <span role="radiogroup" aria-label={`Présence de ${nomComplet(e)}`} className="flex flex-wrap gap-1">
                      {STATUTS.map((st) => (
                        <button key={st} type="button" role="radio" aria-checked={saisie[e.id] === st}
                          onClick={() => setSaisie({ ...saisie, [e.id]: st })}
                          className={`min-h-[40px] rounded-lg border px-3 text-xs font-semibold ${saisie[e.id] === st
                            ? st === 'absent' ? 'border-red-600 bg-red-600 text-white' : st === 'present' ? 'border-teranga-700 bg-teranga-700 text-white' : 'border-soleil-500 bg-soleil-500 text-white'
                            : 'border-slate-300 text-slate-700'}`}>
                          {LIBELLES_PRESENCE[st]}
                        </button>
                      ))}
                    </span>
                  ) : saisie[e.id] ? <Pastille ton={saisie[e.id] === 'absent' ? 'rouge' : 'vert'}>{LIBELLES_PRESENCE[saisie[e.id]]}</Pastille> : <Pastille>non saisi</Pastille>}
                </li>
              ))}
            </ul>
          )}
          {peutSaisir && s.status !== 'annulee' && (
            <div className="mt-4 space-y-3">
              <ZoneTexte label="Observations sur la séance" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
              <Bouton chargement={enregistrer.isPending} onClick={() => enregistrer.mutate()}>Enregistrer l'appel</Bouton>
              {s.starts_at.slice(0, 10) > aujourdhui() && <p className="text-xs text-slate-500">Séance à venir : l'appel pourra être complété le jour même.</p>}
            </div>
          )}
        </Carte>
      </div>
    </>
  );
}
