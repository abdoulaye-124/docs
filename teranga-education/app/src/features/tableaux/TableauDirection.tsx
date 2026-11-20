import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { estActif, useEleves, useGroupes, useProfils, verifier } from '../../lib/requetes';
import { aujourdhui, formatCreneau } from '../../lib/dates';
import { NIVEAUX, nomComplet } from '../../lib/types';
import { Carte, Chargement, EnTete, Statistique, Vide } from '../../ui/composants';
import { useSession } from '../../lib/session';

export default function TableauDirection() {
  const { roleActif } = useSession();
  const eleves = useEleves();
  const profils = useProfils();
  const groupes = useGroupes();
  const jour = aujourdhui();

  const seances = useQuery({
    queryKey: ['seances', 'semaine'],
    queryFn: async () =>
      verifier(
        await supabase.from('sessions').select('id, title, starts_at, ends_at, status, staff_id')
          .gte('starts_at', `${jour}T00:00:00`).lt('starts_at', `${aujourdhui(7)}T00:00:00`)
          .neq('status', 'annulee').order('starts_at'),
      ),
  });

  const presences = useQuery({
    queryKey: ['presences', '30j'],
    queryFn: async () =>
      verifier(await supabase.from('attendance').select('status').gte('recorded_at', `${aujourdhui(-30)}T00:00:00`)),
  });

  const liens = useQuery({
    queryKey: ['liens-parents'],
    queryFn: async () => verifier(await supabase.from('student_guardians').select('student_id, validated_at')),
  });

  const suivi = useQuery({
    queryKey: ['alertes', 'compte'],
    queryFn: async () => {
      const [r, p] = await Promise.all([
        supabase.from('current_mastery').select('student_id').eq('level', 'non_acquis'),
        supabase.from('remediation_plans').select('id', { count: 'exact', head: true }).in('status', ['validee', 'en_cours']),
      ]);
      return { enDifficulte: new Set((verifier(r) as { student_id: string }[]).map((x) => x.student_id)).size, remediations: p.count ?? 0 };
    },
  });

  if (eleves.isLoading || profils.isLoading || groupes.isLoading) return <Chargement />;

  const actifs = (eleves.data ?? []).filter((e) => e.is_active);
  const parNiveau = NIVEAUX.map((n) => ({ n, nb: actifs.filter((e) => e.level_code === n).length }));
  const max = Math.max(1, ...parNiveau.map((x) => x.nb));
  const encadreurs = (profils.data ?? []).filter((p) => p.roles.includes('encadreur') && p.is_active);
  const parents = (profils.data ?? []).filter((p) => p.roles.includes('parent'));
  const nomDe = (id: string) => nomComplet(profils.data?.find((p) => p.id === id));

  const principaux = new Set(
    (groupes.data ?? []).filter((g) => g.kind === 'principal' && g.is_active)
      .flatMap((g) => g.group_members.filter((m) => estActif(m, jour)).map((m) => m.student_id)),
  );
  const avecParent = new Set((liens.data ?? []).filter((l) => l.validated_at).map((l) => l.student_id));
  const sansGroupe = actifs.filter((e) => !principaux.has(e.id));
  const sansReferent = actifs.filter((e) => !e.referent_staff_id);
  const sansParent = actifs.filter((e) => !avecParent.has(e.id));

  const p = presences.data ?? [];
  const taux = p.length ? Math.round((100 * p.filter((x) => x.status === 'present' || x.status === 'retard').length) / p.length) : null;

  return (
    <>
      <EnTete titre={roleActif === 'admin' ? 'Tableau de bord de la direction' : 'Tableau de bord de la coordination'} sousTitre="Vue d'ensemble du centre" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Statistique libelle="Élèves inscrits" valeur={actifs.length} />
        <Statistique libelle="Encadreurs actifs" valeur={encadreurs.length} />
        <Statistique libelle="Séances (7 jours)" valeur={seances.data?.length ?? '…'} />
        <Statistique libelle="Présence (30 jours)" valeur={taux === null ? '—' : `${taux} %`} detail={`${p.length} relevé(s)`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Carte titre="Effectifs par niveau">
          <ul className="space-y-2">
            {parNiveau.map(({ n, nb }) => (
              <li key={n} className="flex items-center gap-3 text-sm">
                <span className="w-10 font-semibold">{n}</span>
                <span className="h-3 flex-1 rounded-full bg-slate-100">
                  <span className="block h-3 rounded-full bg-teranga-600" style={{ width: `${(100 * nb) / max}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums">{nb}</span>
              </li>
            ))}
          </ul>
        </Carte>

        <Carte titre="Points d'attention">
          {sansGroupe.length + sansReferent.length + sansParent.length === 0 ? (
            <Vide>Aucun point d'attention.</Vide>
          ) : (
            <ul className="space-y-3 text-sm">
              <Attention liste={sansGroupe} texte="sans groupe principal" />
              <Attention liste={sansReferent} texte="sans encadreur référent" />
              <Attention liste={sansParent} texte="sans parent validé" />
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">{parents.length} compte(s) parent · {groupes.data?.length ?? 0} groupe(s)</p>
        </Carte>

        <Carte titre="Suivi pédagogique" className="lg:col-span-2" actions={<Link to="/suivi" className="text-sm font-semibold text-teranga-800">Élèves en difficulté →</Link>}>
          <p className="text-sm"><strong data-testid="nb-difficulte">{suivi.data?.enDifficulte ?? '…'}</strong> élève(s) avec au moins un objectif non acquis · <strong>{suivi.data?.remediations ?? '…'}</strong> programme(s) de remédiation en cours</p>
        </Carte>

        <Carte titre="Séances des 7 prochains jours" className="lg:col-span-2" actions={<Link to="/seances" className="text-sm font-semibold text-teranga-800">Toutes les séances →</Link>}>
          {!seances.data?.length ? <Vide>Aucune séance programmée.</Vide> : (
            <ul className="divide-y divide-slate-100">
              {seances.data.slice(0, 8).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link to={`/seances/${s.id}`} className="font-medium text-teranga-800 hover:underline">{s.title}</Link>
                  <span className="text-slate-600">{formatCreneau(s.starts_at, s.ends_at)} · {nomDe(s.staff_id)}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}

function Attention({ liste, texte }: { liste: { id: string; first_name: string; last_name: string }[]; texte: string }) {
  if (!liste.length) return null;
  return (
    <li>
      <p className="font-medium text-amber-800">⚠️ {liste.length} élève(s) {texte}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {liste.slice(0, 6).map((e) => (
          <Link key={e.id} to={`/eleves/${e.id}`} className="text-teranga-800 hover:underline">{nomComplet(e)}</Link>
        ))}
        {liste.length > 6 && <span className="text-slate-500">…</span>}
      </p>
    </li>
  );
}
