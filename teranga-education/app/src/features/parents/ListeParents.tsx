import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useEleves, useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { nomComplet } from '../../lib/types';
import { formaterTelephone } from '@shared/identifiants.ts';
import { Alerte, Bouton, Cellule, Champ, Chargement, EnTete, Modale, Tableau, Vide } from '../../ui/composants';
import FormCompte from '../personnel/FormCompte';

export default function ListeParents() {
  const { roleActif } = useSession();
  const profils = useProfils();
  const eleves = useEleves();
  const liens = useQuery({
    queryKey: ['liens-parents'],
    queryFn: async () => verifier(await supabase.from('student_guardians').select('student_id, guardian_id, relationship, validated_at')),
  });
  const [ouverte, setOuverte] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const r = recherche.trim().toLowerCase();
  const parents = (profils.data ?? []).filter((p) => p.roles.includes('parent'))
    .filter((p) => !r || `${p.first_name} ${p.last_name} ${p.phone ?? ''}`.toLowerCase().includes(r));

  return (
    <>
      <EnTete titre="Parents et tuteurs" sousTitre={`${parents.length} compte(s)`}
        actions={roleActif === 'admin' && <Bouton onClick={() => setOuverte(true)}>+ Nouveau parent</Bouton>} />
      {message && <div className="mb-4"><Alerte ton="succes">{message}</Alerte></div>}
      <div className="mb-4 max-w-sm"><Champ label="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom ou téléphone" /></div>
      {profils.isLoading ? <Chargement /> : !parents.length ? <Vide>Aucun parent.</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Nom', 'Téléphone', 'Enfant(s) associé(s)']}>
            {parents.map((p) => {
              const enfants = (liens.data ?? []).filter((l) => l.guardian_id === p.id);
              return (
                <tr key={p.id}>
                  <Cellule className="font-medium">{nomComplet(p)}</Cellule>
                  <Cellule>{formaterTelephone(p.phone)}</Cellule>
                  <Cellule>
                    {!enfants.length ? <span className="text-slate-500">Aucun — associez-le depuis la fiche de l'élève</span> : (
                      <span className="flex flex-wrap gap-x-3">
                        {enfants.map((l) => {
                          const e = eleves.data?.find((x) => x.id === l.student_id);
                          return <Link key={l.student_id} to={`/eleves/${l.student_id}`} className="text-teranga-800 hover:underline">{nomComplet(e)} ({l.relationship}){!l.validated_at && ' ⏳'}</Link>;
                        })}
                      </span>
                    )}
                  </Cellule>
                </tr>
              );
            })}
          </Tableau>
        </div>
      )}
      <Modale titre="Nouveau compte parent" ouverte={ouverte} fermer={() => setOuverte(false)}>
        <FormCompte rolesPossibles={['parent']} onFait={({ identifiant, motDePasse }) => {
          setOuverte(false);
          setMessage(`Compte parent créé. Téléphone : ${identifiant} · mot de passe provisoire : ${motDePasse}. Associez-le maintenant à son enfant depuis la fiche de l'élève.`);
        }} />
      </Modale>
    </>
  );
}
