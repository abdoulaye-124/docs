import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { formatDate } from '../../lib/dates';
import { LIBELLES_STATUT, type Lecon, type StatutValidation } from '../../lib/pedagogie';
import { NIVEAUX, nomComplet } from '../../lib/types';
import { Alerte, Bouton, Cellule, Champ, Chargement, EnTete, Pastille, Selection, Tableau, Vide } from '../../ui/composants';

export function PastilleStatut({ s }: { s: StatutValidation }) {
  const ton = s === 'valide' ? 'vert' : s === 'a_valider' ? 'ambre' : 'neutre';
  return <Pastille ton={ton}>{LIBELLES_STATUT[s]}</Pastille>;
}

export default function ListeLecons() {
  const nav = useNavigate();
  const { profil } = useSession();
  const profils = useProfils();
  const [niveau, setNiveau] = useState('');
  const [statut, setStatut] = useState('');
  const [miennes, setMiennes] = useState(false);
  const [recherche, setRecherche] = useState('');

  const lecons = useQuery({
    queryKey: ['lecons'],
    queryFn: async () => verifier(await supabase.from('lessons')
      .select('id, title, level_code, status, author_id, updated_at, exercises(id), publications(id)')
      .order('updated_at', { ascending: false })) as (Lecon & { exercises: { id: string }[]; publications: { id: string }[] })[],
  });

  const liste = useMemo(() => (lecons.data ?? []).filter((l) =>
    (!niveau || l.level_code === niveau) && (!statut || l.status === statut) &&
    (!miennes || l.author_id === profil?.id) &&
    (!recherche.trim() || l.title.toLowerCase().includes(recherche.trim().toLowerCase()))), [lecons.data, niveau, statut, miennes, recherche, profil?.id]);

  return (
    <>
      <EnTete titre="Leçons" sousTitre="Bibliothèque partagée du centre" actions={<Bouton onClick={() => nav('/lecons/nouvelle')}>+ Nouvelle leçon</Bouton>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Champ label="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <Selection label="Niveau" value={niveau} onChange={(e) => setNiveau(e.target.value)}>
          <option value="">Tous</option>{NIVEAUX.map((n) => <option key={n}>{n}</option>)}
        </Selection>
        <Selection label="Statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous</option>
          {(Object.keys(LIBELLES_STATUT) as StatutValidation[]).map((s) => <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>)}
        </Selection>
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={miennes} onChange={(e) => setMiennes(e.target.checked)} />Mes leçons</label>
      </div>
      {lecons.isLoading ? <Chargement /> : lecons.error ? <Alerte>{messageErreur(lecons.error)}</Alerte> : !liste.length ? <Vide>Aucune leçon.</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Leçon', 'Niveau', 'Exercices', 'Statut', 'Auteur', 'Modifiée le']}>
            {liste.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <Cellule><Link to={`/lecons/${l.id}`} className="font-medium text-teranga-800 hover:underline">{l.title}</Link>
                  {l.publications.length > 0 && <span className="ml-2"><Pastille ton="bleu">publiée</Pastille></span>}</Cellule>
                <Cellule><Pastille>{l.level_code}</Pastille></Cellule>
                <Cellule>{l.exercises.length}</Cellule>
                <Cellule><PastilleStatut s={l.status} /></Cellule>
                <Cellule>{nomComplet(profils.data?.find((p) => p.id === l.author_id))}</Cellule>
                <Cellule>{formatDate(l.updated_at)}</Cellule>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
    </>
  );
}
