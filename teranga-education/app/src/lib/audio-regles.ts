// Règles audio PURES (sans accès réseau ni navigateur) : testables isolément.

export const TAILLE_MAX_AUDIO = 3 * 1024 * 1024;   // 3 Mo (≈ 3 min en Opus bas débit)
export const DUREE_MAX_S = 180;

export const TYPES_ACCEPTES: Record<string, string> = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'audio/aac': 'aac', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
};

/** Choisit le meilleur format d'enregistrement disponible sur l'appareil
 *  (Opus = très bonne qualité à très bas débit, idéal pour les petits forfaits). */
export function choisirFormat(estSupporte: (mime: string) => boolean): { mime: string; ext: string } | null {
  const candidats: [string, string][] = [
    ['audio/webm;codecs=opus', 'webm'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/mp4', 'm4a'], ['audio/webm', 'webm'],
  ];
  const t = candidats.find(([m]) => estSupporte(m));
  return t ? { mime: t[0], ext: t[1] } : null;
}

/** Type « de base » (sans paramètres de codec), tel qu'accepté par le stockage. */
export const typeDeBase = (mime: string) => mime.split(';')[0].trim().toLowerCase();

export function verifierFichierAudio(f: { size: number; type: string }): string | null {
  const t = typeDeBase(f.type);
  if (!TYPES_ACCEPTES[t]) return 'Format audio non accepté (formats acceptés : webm, ogg, m4a, mp3, aac, wav).';
  if (f.size > TAILLE_MAX_AUDIO) return 'Fichier trop lourd (3 Mo au maximum, soit environ 3 minutes).';
  if (f.size === 0) return 'Fichier vide.';
  return null;
}

/** Chemin de stockage imposé par la base : <identifiant de l'auteur>/<nom>. */
export function cheminAudio(auteurId: string, nom: string, mime: string): string {
  const ext = TYPES_ACCEPTES[typeDeBase(mime)] ?? 'audio';
  return `${auteurId}/${nom}.${ext}`;
}

export function formatDuree(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return '';
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export const LIBELLES_CIBLE = {
  consigne: 'Consigne', mot: 'Mot difficile', notion: 'Notion', probleme: 'Problème',
} as const;
export type CibleWolof = keyof typeof LIBELLES_CIBLE;
