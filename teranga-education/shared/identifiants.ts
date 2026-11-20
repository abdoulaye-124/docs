// Règles d'identifiants partagées entre l'application (navigateur) et les
// fonctions serveur. Aucune dépendance : ce fichier doit rester autonome.

/** Normalise un numéro sénégalais au format international +221XXXXXXXXX.
 *  Accepte « 77 123 45 67 », « 771234567 », « +221 77… », « 00221 77… ».
 *  Retourne null si le numéro n'est pas un numéro sénégalais plausible. */
export function normaliserTelephoneSN(saisie: string): string | null {
  let n = saisie.replace(/[\s.\-()]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 12 && n.startsWith('221')) n = n.slice(3);
  // Mobiles (70, 71, 75, 76, 77, 78) et fixes (33) : 9 chiffres.
  if (!/^(7[0-9]|33)\d{7}$/.test(n)) return null;
  return `+221${n}`;
}

/** Affichage lisible : +221 77 123 45 67 */
export function formaterTelephone(tel: string | null | undefined): string {
  if (!tel) return '';
  const d = tel.replace(/\D/g, '');
  const local = d.startsWith('221') ? d.slice(3) : d;
  if (local.length !== 9) return tel;
  return `+221 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

/** Domaine technique (non routable) des comptes élèves : l'élève ne voit
 *  jamais d'adresse e-mail, seulement son identifiant court. */
export const DOMAINE_ELEVES = 'eleves.teranga.invalid';

const RE_IDENTIFIANT = /^[a-z][a-z0-9.]{2,23}$/;

export function identifiantValide(id: string): boolean {
  return RE_IDENTIFIANT.test(id);
}

export function identifiantVersEmail(id: string): string {
  const propre = id.trim().toLowerCase();
  if (!identifiantValide(propre)) throw new Error('Identifiant élève invalide');
  return `${propre}@${DOMAINE_ELEVES}`;
}

/** Propose un identifiant à partir du prénom : « Awa » → « awa.47 ». */
export function proposerIdentifiant(prenom: string, alea: () => number = Math.random): string {
  const base = prenom
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '')
    .slice(0, 12) || 'eleve';
  const suffixe = String(10 + Math.floor(alea() * 90));
  return `${base.length >= 3 ? base : base + 'x'.repeat(3 - base.length)}.${suffixe}`;
}

/** Les 12 images du code-image des jeunes élèves. */
export const IMAGES_CODE = [
  { id: 0, emoji: '🥭', nom: 'mangue' },
  { id: 1, emoji: '🐟', nom: 'poisson' },
  { id: 2, emoji: '⚽', nom: 'ballon' },
  { id: 3, emoji: '🌳', nom: 'arbre' },
  { id: 4, emoji: '🐐', nom: 'chèvre' },
  { id: 5, emoji: '☀️', nom: 'soleil' },
  { id: 6, emoji: '🌙', nom: 'lune' },
  { id: 7, emoji: '🚌', nom: 'car' },
  { id: 8, emoji: '🏠', nom: 'maison' },
  { id: 9, emoji: '🐓', nom: 'coq' },
  { id: 10, emoji: '🥁', nom: 'tam-tam' },
  { id: 11, emoji: '⭐', nom: 'étoile' },
] as const;

export const LONGUEUR_CODE_IMAGE = 4;

/** Transforme une suite de 4 images en mot de passe technique. */
export function codeImageVersMotDePasse(identifiant: string, code: number[]): string {
  if (code.length !== LONGUEUR_CODE_IMAGE) throw new Error('Le code-image comporte 4 images');
  if (code.some((c) => !Number.isInteger(c) || c < 0 || c >= IMAGES_CODE.length)) {
    throw new Error('Image inconnue dans le code');
  }
  return `img-${code.join('-')}-${identifiant.trim().toLowerCase()}`;
}

/** Tire un code-image au hasard (création du compte par le centre). */
export function tirerCodeImage(alea: () => number = Math.random): number[] {
  return Array.from({ length: LONGUEUR_CODE_IMAGE }, () => Math.floor(alea() * IMAGES_CODE.length));
}
