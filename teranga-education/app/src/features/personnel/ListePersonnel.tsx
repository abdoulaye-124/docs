import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfils } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { changerActivation, motDePasseProvisoire, reinitialiserMotDePasse } from '../../lib/fonctions';
import { messageErreur } from '../../lib/erreurs';
import { LIBELLES_ROLES, nomComplet, type Role } from '../../lib/types';
import { formaterTelephone } from '@shared/identifiants.ts';
import { Alerte, Bouton, Cellule, Chargement, EnTete, Modale, Pastille, Tableau, Vide } from '../../ui/composants';
import FormCompte from './FormCompte';

const ROLES_PERSONNEL: Role[] = ['encadreur', 'coordinateur', 'admin'];

export default function ListePersonnel() {
  const { roleActif, profil } = useSession();
  const qc = useQueryClient();
  const profils = useProfils();
  const [ouverte, setOuverte] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const admin = roleActif === 'admin';
  const personnel = (profils.data ?? []).filter((p) => p.roles.some((r) => ROLES_PERSONNEL.includes(r)));

  const activation = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => changerActivation(id, actif),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profils'] }),
    onError: (e) => setErreur(messageErreur(e)),
  });
  const reinit = useMutation({
    mutationFn: async (id: string) => {
      const mdp = motDePasseProvisoire();
      await reinitialiserMotDePasse(id, mdp);
      return mdp;
    },
    onSuccess: (mdp) => setMessage(`Nouveau mot de passe provisoire : ${mdp}`),
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <>
      <EnTete titre="Personnel du centre" sousTitre={`${personnel.length} personne(s)`}
        actions={admin && <Bouton onClick={() => setOuverte(true)}>+ Nouveau compte</Bouton>} />
      {message && <div className="mb-4"><Alerte ton="succes">{message}</Alerte></div>}
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}
      {profils.isLoading ? <Chargement /> : !personnel.length ? <Vide>Aucun membre du personnel.</Vide> : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Tableau entetes={['Nom', 'Fonction(s)', 'Téléphone', 'État', ...(admin ? ['Actions'] : [])]}>
            {personnel.map((p) => (
              <tr key={p.id}>
                <Cellule className="font-medium">{nomComplet(p)}</Cellule>
                <Cellule><span className="flex gap-1">{p.roles.filter((r) => ROLES_PERSONNEL.includes(r)).map((r) => <Pastille key={r} ton="vert">{LIBELLES_ROLES[r]}</Pastille>)}</span></Cellule>
                <Cellule>{formaterTelephone(p.phone) || '—'}</Cellule>
                <Cellule>{p.is_active ? <Pastille ton="vert">actif</Pastille> : <Pastille ton="rouge">désactivé</Pastille>}</Cellule>
                {admin && (
                  <Cellule>
                    {p.id !== profil?.id && (
                      <span className="flex gap-2">
                        <Bouton variante="secondaire" onClick={() => reinit.mutate(p.id)}>Mot de passe</Bouton>
                        <Bouton variante={p.is_active ? 'danger' : 'secondaire'} onClick={() => activation.mutate({ id: p.id, actif: !p.is_active })}>
                          {p.is_active ? 'Désactiver' : 'Réactiver'}
                        </Bouton>
                      </span>
                    )}
                  </Cellule>
                )}
              </tr>
            ))}
          </Tableau>
        </div>
      )}
      <Modale titre="Nouveau compte du personnel" ouverte={ouverte} fermer={() => setOuverte(false)}>
        <FormCompte rolesPossibles={ROLES_PERSONNEL} onFait={({ identifiant, motDePasse }) => {
          setOuverte(false);
          setMessage(`Compte créé. Identifiant : ${identifiant} · mot de passe provisoire : ${motDePasse}`);
        }} />
      </Modale>
    </>
  );
}
