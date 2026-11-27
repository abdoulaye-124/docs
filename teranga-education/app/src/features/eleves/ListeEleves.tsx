import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEleves, useProfils } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { age } from '../../lib/dates';
import { NIVEAUX, nomComplet } from '../../lib/types';
import { Alerte, Bouton, Cellule, Champ, Chargement, EnTete, Pastille, Selection, Tableau, Vide } from '../../ui/composants';
import { messageErreur } from '../../lib/erreurs';
import { exporterCsv } from './export';

export default function ListeEleves() {
  const { roleActif } = useSession();
  const nav = useNavigate();
  const eleves = useEleves();
  const profils = useProfils();
  const [recherche, setRecherche] = useState('');
  const [niveau, setNiveau] = useState('');
  const [inactifs, setInactifs] = useState(false);

  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return (eleves.data ?? []).filter((e) =>
      (inactifs || e.is_active) &&
      (!niveau || e.level_code === niveau) &&
      (!r || `${e.first_name} ${e.last_name} ${e.code}`.toLowerCase().includes(r)));
  }, [eleves.data, recherche, niveau, inactifs]);

  const nomDe = (id: string | null) => (id ? nomComplet(profils.data?.find((p) => p.id === id)) : '—');

  return (
    <>
      <EnTete
        titre={roleActif === 'encadreur' ? 'Mes élèves' : 'Élèves'}
        sousTitre={`${liste.length} élève(s)`}
        actions={
          <>
            {roleActif !== 'encadreur' && (
              <Bouton variante="secondaire" onClick={() => exporterCsv(liste, nomDe)}>Exporter (Excel)</Bouton>
            )}
            {roleActif === 'admin' && <Bouton onClick={() => nav('/eleves/nouveau')}>+ Inscrire un élève</Bouton>}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Champ label="Rechercher" placeholder="Nom, prénom ou identifiant" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <Selection label="Niveau" value={niveau} onChange={(e) => setNiveau(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
        </Selection>
        <label className="flex items-end gap-2 pb-3 text-sm text-slate-700">
          <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} className="h-5 w-5" />
          Afficher les élèves archivés
        </label>
      </div>

      {eleves.isLoading ? <Chargement /> : eleves.error ? <Alerte>{messageErreur(eleves.error)}</Alerte> : !liste.length ? (
        <Vide>Aucun élève ne correspond.</Vide>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Identifiant', 'Élève', 'Niveau', 'Âge', 'Établissement d\'origine', 'Référent']}>
            {liste.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <Cellule className="font-mono text-xs">{e.code}</Cellule>
                <Cellule>
                  <Link to={`/eleves/${e.id}`} className="font-medium text-teranga-800 hover:underline">{e.last_name.toUpperCase()} {e.first_name}</Link>
                  {!e.is_active && <span className="ml-2"><Pastille>archivé</Pastille></span>}
                </Cellule>
                <Cellule><Pastille ton="vert">{e.level_code}</Pastille></Cellule>
                <Cellule>{age(e.birth_date)} ans</Cellule>
                <Cellule>{e.origin_school ?? '—'}{e.origin_class ? ` (${e.origin_class})` : ''}</Cellule>
                <Cellule>{nomDe(e.referent_staff_id)}</Cellule>
              </tr>
            ))}
          </Tableau>
        </div>
      )}
    </>
  );
}
