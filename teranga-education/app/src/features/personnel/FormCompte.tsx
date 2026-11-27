import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { creerCompte, motDePasseProvisoire } from '../../lib/fonctions';
import { messageErreur } from '../../lib/erreurs';
import { LIBELLES_ROLES, type Role } from '../../lib/types';
import { normaliserTelephoneSN } from '@shared/identifiants.ts';
import { Alerte, Bouton, Champ, Selection } from '../../ui/composants';

/** Formulaire de création d'un compte personnel ou parent (via la fonction serveur). */
export default function FormCompte({ rolesPossibles, onFait }: { rolesPossibles: Role[]; onFait: (r: { identifiant: string; motDePasse: string }) => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>(rolesPossibles[0]);
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [motDePasse] = useState(motDePasseProvisoire);
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => creerCompte({
      role, first_name: f.first_name, last_name: f.last_name, password: motDePasse,
      email: f.email || undefined, phone: f.phone || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profils'] });
      onFait({ identifiant: f.phone || f.email, motDePasse });
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (f.phone && !normaliserTelephoneSN(f.phone)) return setErreur('Numéro de téléphone invalide. Exemple : 77 123 45 67');
    if (role === 'parent' && !f.phone) return setErreur('Le téléphone est obligatoire pour un parent.');
    if (!f.phone && !f.email) return setErreur('Indiquez un e-mail ou un téléphone.');
    m.mutate();
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      {rolesPossibles.length > 1 && (
        <Selection label="Fonction" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {rolesPossibles.map((r) => <option key={r} value={r}>{LIBELLES_ROLES[r]}</option>)}
        </Selection>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Prénom" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required />
        <Champ label="Nom" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required />
      </div>
      <Champ label="Téléphone" type="tel" inputMode="tel" placeholder="77 123 45 67" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required={role === 'parent'} />
      {role !== 'parent' && (
        <Champ label="E-mail (facultatif si téléphone)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      )}
      <Alerte ton="info">
        Mot de passe provisoire : <strong className="font-mono" data-testid="mdp-provisoire">{motDePasse}</strong><br />
        Communiquez-le en main propre. Il ne sera plus affiché après la création.
      </Alerte>
      <Bouton type="submit" chargement={m.isPending}>Créer le compte</Bouton>
    </form>
  );
}
