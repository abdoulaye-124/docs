// Mode hors connexion (élèves) : cache local des leçons et file d'envoi des réponses.
// Stockage du navigateur uniquement : il peut être indisponible (navigation privée,
// téléphone plein) ; tout est donc protégé, et l'application fonctionne sans.
import { useEffect, useState } from 'react';

const PREFIXE = 'teranga-hl:';

function lire<T>(cle: string): T | null {
  try {
    const v = localStorage.getItem(PREFIXE + cle);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible ou plein : sans conséquence, on reste en ligne */
  }
}

export const lireCache = <T,>(cle: string) => lire<{ enregistre_le: string; donnees: T }>(`cache:${cle}`);
export const ecrireCache = (cle: string, donnees: unknown) => ecrire(`cache:${cle}`, { enregistre_le: new Date().toISOString(), donnees });

export interface EnvoiEnAttente {
  client_id: string;
  exercise_id: string;
  assessment_id: string | null;
  reponse: { selected?: string[]; text?: string };
  cree_le: string;
}
const CLE_FILE = (uid: string) => `file:${uid}`;
export const lireFile = (uid: string) => lire<EnvoiEnAttente[]>(CLE_FILE(uid)) ?? [];
export const ajouterALaFile = (uid: string, e: EnvoiEnAttente) =>
  ecrire(CLE_FILE(uid), [...lireFile(uid).filter((x) => x.client_id !== e.client_id), e]);
export const retirerDeLaFile = (uid: string, clientId: string) =>
  ecrire(CLE_FILE(uid), lireFile(uid).filter((x) => x.client_id !== clientId));

/** Vraie panne de réseau (et non refus du serveur) : on peut mettre en file. */
export function estErreurReseau(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = String((e as { message?: string })?.message ?? e);
  return /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(m);
}

/** Envoie la file dans l'ordre. Les réponses déjà reçues ne sont pas dupliquées
 *  (le serveur reconnaît l'identifiant client). S'arrête à la première panne. */
export async function viderFile(uid: string, envoyer: (e: EnvoiEnAttente) => Promise<void>): Promise<number> {
  let n = 0;
  for (const e of lireFile(uid)) {
    try {
      await envoyer(e);
      retirerDeLaFile(uid, e.client_id);
      n++;
    } catch (err) {
      if (estErreurReseau(err)) break;
      retirerDeLaFile(uid, e.client_id);   // refus définitif (ex. exercice retiré) : on n'insiste pas
    }
  }
  return n;
}

export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return enLigne;
}
