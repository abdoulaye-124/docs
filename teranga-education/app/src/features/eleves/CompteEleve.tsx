import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { creerCompte, reinitialiserMotDePasse } from '../../lib/fonctions';
import { messageErreur } from '../../lib/erreurs';
import type { Eleve } from '../../lib/types';
import {
  IMAGES_CODE, codeImageVersMotDePasse, identifiantValide, proposerIdentifiant, tirerCodeImage,
} from '@shared/identifiants.ts';
import { Alerte, Bouton, Carte, Champ } from '../../ui/composants';

/** Création et réinitialisation du compte de connexion de l'élève (admin). */
export default function CompteEleve({ eleve, consentementCompte, onChange }: { eleve: Eleve; consentementCompte: boolean; onChange: () => void }) {
  const [identifiant, setIdentifiant] = useState(() => eleve.login_id ?? proposerIdentifiant(eleve.first_name));
  const [code, setCode] = useState<number[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const creation = useMutation({
    mutationFn: async () => {
      const id = identifiant.trim().toLowerCase();
      if (!identifiantValide(id)) throw new Error('Identifiant invalide : lettres minuscules, chiffres et points (3 à 24 caractères), en commençant par une lettre.');
      const c = tirerCodeImage();
      await creerCompte({
        role: 'eleve', first_name: eleve.first_name, last_name: eleve.last_name,
        login: id, password: codeImageVersMotDePasse(id, c), student_id: eleve.id,
      });
      return c;
    },
    onSuccess: (c) => { setCode(c); setErreur(null); onChange(); },
    onError: (e) => setErreur(messageErreur(e)),
  });

  const reinit = useMutation({
    mutationFn: async () => {
      const c = tirerCodeImage();
      await reinitialiserMotDePasse(eleve.profile_id!, codeImageVersMotDePasse(eleve.login_id!, c));
      return c;
    },
    onSuccess: (c) => { setCode(c); setErreur(null); },
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <Carte titre="Compte de connexion de l'élève">
      {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}
      {code && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-teranga-600 p-4 text-center" data-testid="carte-code">
          <p className="text-sm text-slate-600">À recopier ou imprimer et remettre au parent</p>
          <p className="mt-2 text-sm">Identifiant</p>
          <p className="font-mono text-xl font-bold" data-testid="identifiant-eleve">{eleve.login_id ?? identifiant}</p>
          <p className="mt-2 text-sm">Code secret</p>
          <p className="text-4xl" data-testid="code-image" data-code={code.join(',')}>{code.map((i) => IMAGES_CODE[i].emoji).join(' ')}</p>
          <p className="text-xs text-slate-500">{code.map((i) => IMAGES_CODE[i].nom).join(' · ')}</p>
          <Bouton variante="secondaire" className="mt-3" onClick={() => window.print()}>Imprimer</Bouton>
        </div>
      )}
      {eleve.profile_id ? (
        <div className="space-y-3 text-sm">
          <p>Compte actif. Identifiant : <span className="font-mono font-semibold">{eleve.login_id ?? '—'}</span></p>
          {eleve.login_id && (
            <Bouton variante="secondaire" chargement={reinit.isPending} onClick={() => reinit.mutate()}>Générer un nouveau code-image</Bouton>
          )}
        </div>
      ) : !consentementCompte ? (
        <Alerte ton="attention">Le consentement « Compte de connexion de l'enfant » doit d'abord être recueilli auprès du responsable légal.</Alerte>
      ) : (
        <div className="space-y-3">
          <Champ label="Identifiant proposé" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none"
            aide="Court et facile à retenir. Pas de nom de famille complet." />
          <Bouton chargement={creation.isPending} onClick={() => creation.mutate()}>Créer le compte élève</Bouton>
        </div>
      )}
    </Carte>
  );
}
