import { describe, expect, it } from 'vitest';
import { comparaison, etoiles, progressionParObjectif, synthese, type EnregistrementMaitrise } from './suivi-regles';

const e = (seq: number, node_id: string, level: EnregistrementMaitrise['level'], score_pct: number | null = null): EnregistrementMaitrise =>
  ({ seq, node_id, level, score_pct, source: 'calcul', recorded_at: `2026-11-${String(seq).padStart(2, '0')}` });

describe('progressionParObjectif', () => {
  const p = progressionParObjectif([
    e(3, 'div', 'en_cours', 60), e(1, 'div', 'non_acquis', 0), e(5, 'div', 'acquis', 80),
    e(2, 'tab', 'acquis', 100), e(4, 'tab', 'en_cours', 70),
    e(6, 'add', 'en_cours', 50), e(7, 'add', 'en_cours', 65),
  ]);
  const div = p.find((x) => x.node_id === 'div')!;
  it('trie par ordre d’enregistrement et isole initial / récent', () => {
    expect(div.initial.level).toBe('non_acquis');
    expect(div.recent.level).toBe('acquis');
    expect(div.historique.map((h) => h.seq)).toEqual([1, 3, 5]);
  });
  it('détecte progrès, recul et progrès à niveau constant (+10 points)', () => {
    expect(div.evolution).toBe('progres');
    expect(p.find((x) => x.node_id === 'tab')!.evolution).toBe('recul');
    expect(p.find((x) => x.node_id === 'add')!.evolution).toBe('progres');
  });
  it('compare la situation initiale et la situation récente', () => {
    const c = comparaison(p);
    expect(c.initial).toEqual({ acquis: 1, en_cours: 1, non_acquis: 1, total: 3 });
    expect(c.recent).toEqual({ acquis: 1, en_cours: 2, non_acquis: 0, total: 3 });
    expect(c.progres).toBe(2);
    expect(c.recul).toBe(1);
  });
});

describe('divers', () => {
  it('stable si variation faible', () =>
    expect(progressionParObjectif([e(1, 'x', 'en_cours', 55), e(2, 'x', 'en_cours', 60)])[0].evolution).toBe('stable'));
  it('synthèse vide', () => expect(synthese([])).toEqual({ acquis: 0, en_cours: 0, non_acquis: 0, total: 0 }));
  it('étoiles de 1 à 3', () => expect([etoiles('non_acquis'), etoiles('en_cours'), etoiles('acquis')]).toEqual([1, 2, 3]));
});
