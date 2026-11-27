import { beforeEach, describe, expect, it } from 'vitest';
import { ajouterALaFile, estErreurReseau, lireCache, ecrireCache, lireFile, viderFile, type EnvoiEnAttente } from './horsligne';

// Petit stockage en mémoire pour les tests (pas de navigateur ici).
const memoire = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => memoire.get(k) ?? null,
    setItem: (k: string, v: string) => void memoire.set(k, v),
    removeItem: (k: string) => void memoire.delete(k),
  },
});

const envoi = (id: string): EnvoiEnAttente => ({ client_id: id, exercise_id: 'ex', assessment_id: null, reponse: { text: '3' }, cree_le: '2026-11-27' });

describe('mode hors connexion', () => {
  beforeEach(() => memoire.clear());

  it('garde les données mises en cache', () => {
    ecrireCache('lecons', [{ id: 1 }]);
    expect(lireCache<{ id: number }[]>('lecons')?.donnees).toEqual([{ id: 1 }]);
  });
  it('n’ajoute pas deux fois le même envoi', () => {
    ajouterALaFile('u', envoi('a'));
    ajouterALaFile('u', envoi('a'));
    expect(lireFile('u')).toHaveLength(1);
  });
  it('vide la file dans l’ordre et s’arrête à la première panne réseau', async () => {
    ['a', 'b', 'c'].forEach((id) => ajouterALaFile('u', envoi(id)));
    const envoyes: string[] = [];
    const n = await viderFile('u', async (e) => {
      if (e.client_id === 'b') throw new Error('Failed to fetch');
      envoyes.push(e.client_id);
    });
    expect(n).toBe(1);
    expect(envoyes).toEqual(['a']);
    expect(lireFile('u').map((e) => e.client_id)).toEqual(['b', 'c']);
  });
  it('abandonne un envoi refusé définitivement par le serveur', async () => {
    ajouterALaFile('u', envoi('a'));
    await viderFile('u', async () => { throw new Error('Exercice non publié pour cet élève'); });
    expect(lireFile('u')).toHaveLength(0);
  });
  it('distingue panne réseau et refus', () => {
    expect(estErreurReseau(new Error('Failed to fetch'))).toBe(true);
    expect(estErreurReseau(new Error('Exercice non publié pour cet élève'))).toBe(false);
  });
  it('isole les files de deux élèves sur le même téléphone', () => {
    ajouterALaFile('u1', envoi('a'));
    expect(lireFile('u2')).toHaveLength(0);
  });
});
