import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useEleves, useGroupes, verifier } from '../../lib/requetes';
import { aujourdhui, formatCreneau } from '../../lib/dates';
import { useSession } from '../../lib/session';
import { nomComplet } from '../../lib/types';
import { Carte, Chargement, EnTete, Pastille, Statistique, Vide } from '../../ui/composants';

export default function TableauEncadreur() {
  const { profil } = useSession();
  const eleves = useEleves();
  const groupes = useGroupes();

  const seances = useQuery({
    queryKey: ['seances', 'encadreur', profil?.id],
    enabled: !!profil,
    queryFn: async () =>
      verifier(
        await supabase.from('sessions').select('id, title, starts_at, ends_at, status, attendance(student_id)')
          .eq('staff_id', profil!.id).gte('starts_at', `${aujourdhui(-14)}T00:00:00`)
          .neq('status', 'annulee').order('starts_at'),
      ),
  });

  const aCorriger = useQuery({
    queryKey: ['corrections', 'compte'],
    queryFn: async () => (await supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'soumis')).count ?? 0,
  });

  if (eleves.isLoading || groupes.isLoading || seances.isLoading) return <Chargement />;

  const maintenant = new Date().toISOString();
  const aVenir = (seances.data ?? []).filter((s) => s.ends_at >= maintenant);
  const appelsManquants = (seances.data ?? []).filter((s) => s.ends_at < maintenant && s.attendance.length === 0);

  return (
    <>
      <EnTete titre={`Bonjour ${profil?.first_name ?? ''}`} sousTitre="Votre espace encadreur" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Statistique libelle="Élèves affectés" valeur={eleves.data?.length ?? 0} />
        <Link to="/corrections" className="block"><Statistique libelle="Copies à corriger" valeur={aCorriger.data ?? '…'} /></Link>
        <Statistique libelle="Séances à venir" valeur={aVenir.length} />
        <Statistique libelle="Appels à saisir" valeur={appelsManquants.length} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Carte titre="Mes prochaines séances">
          {!aVenir.length ? <Vide>Aucune séance programmée.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {aVenir.slice(0, 6).map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <Link to={`/seances/${s.id}`} className="font-medium text-teranga-800 hover:underline">{s.title}</Link>
                  <p className="text-slate-600">{formatCreneau(s.starts_at, s.ends_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Présences à saisir">
          {!appelsManquants.length ? <Vide>Tous les appels sont à jour.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {appelsManquants.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/seances/${s.id}`} className="font-medium text-teranga-800 hover:underline">{s.title}</Link>
                  <Pastille ton="ambre">{formatCreneau(s.starts_at, s.ends_at)}</Pastille>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Mes élèves" className="lg:col-span-2" actions={<Link to="/eleves" className="text-sm font-semibold text-teranga-800">Voir la liste →</Link>}>
          {!eleves.data?.length ? <Vide>Aucun élève ne vous est encore affecté.</Vide> : (
            <ul className="flex flex-wrap gap-2">
              {eleves.data.map((e) => (
                <li key={e.id}>
                  <Link to={`/eleves/${e.id}`} className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-3 text-sm hover:bg-slate-50">
                    {nomComplet(e)} <Pastille>{e.level_code}</Pastille>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Le suivi détaillé des compétences arrive en Phase 4.</p>
        </Carte>
      </div>
    </>
  );
}
