// Calculs de progression PURS (sans accès réseau) : testables isolément.

export type Maitrise = 'non_acquis' | 'en_cours' | 'acquis';
export const LIBELLES_MAITRISE: Record<Maitrise, string> = {
  non_acquis: 'Non acquis', en_cours: 'En cours d’acquisition', acquis: 'Acquis',
};
export const RANG: Record<Maitrise, number> = { non_acquis: 0, en_cours: 1, acquis: 2 };

export interface EnregistrementMaitrise {
  node_id: string;
  level: Maitrise;
  source: 'calcul' | 'encadreur' | 'diagnostic';
  score_pct: number | null;
  recorded_at: string;
  seq: number;
  justification?: string | null;
}

export type Evolution = 'progres' | 'stable' | 'recul';

export interface ProgressionObjectif {
  node_id: string;
  initial: EnregistrementMaitrise;
  recent: EnregistrementMaitrise;
  historique: EnregistrementMaitrise[];
  evolution: Evolution;
}

/** Regroupe l'historique par objectif : niveau initial, intermédiaires, récent, évolution. */
export function progressionParObjectif(enr: EnregistrementMaitrise[]): ProgressionObjectif[] {
  const parNoeud = new Map<string, EnregistrementMaitrise[]>();
  for (const e of [...enr].sort((a, b) => a.seq - b.seq)) {
    const l = parNoeud.get(e.node_id) ?? [];
    l.push(e);
    parNoeud.set(e.node_id, l);
  }
  return [...parNoeud.entries()].map(([node_id, h]) => {
    const initial = h[0];
    const recent = h[h.length - 1];
    const d = RANG[recent.level] - RANG[initial.level];
    const dPct = (recent.score_pct ?? 0) - (initial.score_pct ?? 0);
    const evolution: Evolution = d > 0 || (d === 0 && dPct >= 10) ? 'progres' : d < 0 || (d === 0 && dPct <= -10) ? 'recul' : 'stable';
    return { node_id, initial, recent, historique: h, evolution };
  });
}

export interface Synthese { acquis: number; en_cours: number; non_acquis: number; total: number }

export function synthese(niveaux: Maitrise[]): Synthese {
  const s: Synthese = { acquis: 0, en_cours: 0, non_acquis: 0, total: niveaux.length };
  niveaux.forEach((n) => { s[n] += 1; });
  return s;
}

/** Comparaison globale : niveaux initiaux vs niveaux récents. */
export function comparaison(p: ProgressionObjectif[]) {
  return {
    initial: synthese(p.map((x) => x.initial.level)),
    recent: synthese(p.map((x) => x.recent.level)),
    progres: p.filter((x) => x.evolution === 'progres').length,
    recul: p.filter((x) => x.evolution === 'recul').length,
  };
}

/** Nombre d'étoiles affichées à l'élève (jamais de classement entre élèves). */
export const etoiles = (n: Maitrise) => RANG[n] + 1;
