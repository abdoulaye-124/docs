import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useEleves, verifier } from '../../lib/requetes';
import { formatCreneau, formatDate } from '../../lib/dates';
import { useSession } from '../../lib/session';
import { nomComplet } from '../../lib/types';
import { Carte, Chargement, EnTete, Pastille, Vide } from '../../ui/composants';

export default function TableauParent() {
  const { profil } = useSession();
  const enfants = useEleves();   // RLS : uniquement les enfants liés et validés

  const seances = useQuery({
    queryKey: ['seances', 'famille'],
    queryFn: async () =>
      verifier(
        await supabase.from('sessions').select('id, title, starts_at, ends_at, status, room_id, online_url')
          .gte('ends_at', new Date().toISOString()).neq('status', 'annulee').order('starts_at').limit(5),
      ),
  });

  const presences = useQuery({
    queryKey: ['presences', 'famille'],
    queryFn: async () =>
      verifier(await supabase.from('attendance').select('student_id, status, sessions(title, starts_at, ends_at)').order('recorded_at', { ascending: false }).limit(50)),
  });

  const notifs = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => verifier(await supabase.from('notifications').select('id, title, link, created_at, read_at').order('created_at', { ascending: false }).limit(8)) as
      { id: string; title: string; link: string | null; created_at: string; read_at: string | null }[],
  });

  if (enfants.isLoading) return <Chargement />;

  return (
    <>
      <EnTete titre={`Bonjour ${profil?.first_name ?? ''}`} sousTitre="Le suivi de vos enfants au centre" />
      {!enfants.data?.length && (
        <Vide>Aucun enfant n'est encore associé à votre compte. Rapprochez-vous de l'accueil du centre.</Vide>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {enfants.data?.map((e) => {
          const p = (presences.data ?? []).filter((x) => x.student_id === e.id);
          const presents = p.filter((x) => x.status === 'present' || x.status === 'retard').length;
          return (
            <Carte key={e.id} titre={<span>{nomComplet(e)} <Pastille ton="vert">{e.level_code}</Pastille></span>}
              actions={<Link to={`/parent/enfant/${e.id}`} className="text-sm font-semibold text-teranga-800">Voir le dossier →</Link>}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Présences</dt><dd className="font-semibold">{p.length ? `${presents} / ${p.length}` : '—'}</dd></div>
                <div><dt className="text-slate-500">Identifiant</dt><dd className="font-mono">{e.code}</dd></div>
              </dl>
              <Link to={`/parent/enfant/${e.id}/suivi`} className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-teranga-800">📈 Compétences, bilans et remédiation →</Link>
            </Carte>
          );
        })}
      </div>

      <Carte titre="Notifications" className="mt-5">
        {!notifs.data?.length ? <Vide>Aucune notification.</Vide> : (
          <ul className="divide-y divide-slate-100" data-testid="notifications">
            {notifs.data.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className={n.read_at ? '' : 'font-semibold'}>{n.title}</span>
                <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre="Prochaines séances" className="mt-5">
        {!seances.data?.length ? <Vide>Aucune séance programmée.</Vide> : (
          <ul className="divide-y divide-slate-100">
            {seances.data.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <p className="font-medium">{s.title}</p>
                <p className="text-slate-600">{formatCreneau(s.starts_at, s.ends_at)}{s.online_url ? ' · à distance' : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  );
}
