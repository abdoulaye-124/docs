import { describe, expect, it } from 'vitest';
import { exerciceIncomplet, libelleObjectif } from './pedagogie-regles';

describe('exerciceIncomplet', () => {
  const choix = [{ id: 'a', label: '3' }, { id: 'b', label: '4' }];
  it('accepte un QCM complet', () =>
    expect(exerciceIncomplet({ kind: 'qcm', prompt: '12 ÷ 3 ?', choices: choix }, { correct: ['b'] })).toBeNull());
  it('refuse un QCM sans bonne réponse', () =>
    expect(exerciceIncomplet({ kind: 'qcm', prompt: 'x', choices: choix }, { correct: [] })).toMatch(/bonne/));
  it('refuse un QCM à un seul choix', () =>
    expect(exerciceIncomplet({ kind: 'qcm', prompt: 'x', choices: [choix[0], { id: 'b', label: ' ' }] }, { correct: ['a'] })).toMatch(/deux/));
  it('refuse une bonne réponse inexistante', () =>
    expect(exerciceIncomplet({ kind: 'qcm', prompt: 'x', choices: choix }, { correct: ['z'] })).toMatch(/aucun choix/));
  it('exige une réponse acceptée pour une réponse courte', () => {
    expect(exerciceIncomplet({ kind: 'reponse_courte', prompt: 'x', choices: null }, { accepted: [' '] })).toMatch(/acceptée/);
    expect(exerciceIncomplet({ kind: 'reponse_courte', prompt: 'x', choices: null }, { accepted: ['3'] })).toBeNull();
  });
  it('accepte une production libre sans corrigé automatique', () =>
    expect(exerciceIncomplet({ kind: 'production_libre', prompt: 'Raconte…', choices: null }, {})).toBeNull());
  it('refuse une consigne vide', () =>
    expect(exerciceIncomplet({ kind: 'production_libre', prompt: '  ', choices: null }, {})).toMatch(/consigne/));
});

describe('libelleObjectif', () => {
  it('compose code, libellé et niveau', () =>
    expect(libelleObjectif({ code: 'P-M-03', label: 'Diviser', level_code: 'CE2' })).toBe('P-M-03 · Diviser (CE2)'));
});
