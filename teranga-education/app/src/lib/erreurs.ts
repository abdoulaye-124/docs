// Traduit les erreurs techniques en messages compréhensibles.
interface ErreurBase { code?: string; message?: string; details?: string }

export function messageErreur(e: unknown): string {
  if (!e) return 'Erreur inconnue';
  const err = e as ErreurBase;
  switch (err.code) {
    case '42501':
      return "Action non autorisée pour votre compte.";
    case '23P01':
      if (err.message?.includes('no_room_overlap')) return 'Conflit : la salle est déjà occupée sur ce créneau.';
      return "Conflit : l'encadreur a déjà une séance sur ce créneau.";
    case '23505':
      return 'Cet enregistrement existe déjà.';
    case '23503':
      return 'Opération impossible : un élément lié est introuvable ou encore utilisé.';
    case '23514':
      return 'Données invalides : vérifiez les champs (dates, valeurs obligatoires…).';
    case 'P0001':
      return err.message ?? 'Règle de gestion non respectée.';
  }
  if (err.message?.includes('row-level security')) return 'Action non autorisée pour votre compte.';
  if (err.message === 'Invalid login credentials') return 'Identifiant ou mot de passe incorrect.';
  if (err.message?.includes('Failed to fetch')) return 'Connexion au serveur impossible. Vérifiez le réseau.';
  return err.message ?? String(e);
}
