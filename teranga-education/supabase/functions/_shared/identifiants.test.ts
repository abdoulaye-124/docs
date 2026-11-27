import { describe, expect, it } from 'vitest';
import {
  codeImageVersMotDePasse, formaterTelephone, telephoneVersEmail, identifiantValide, identifiantVersEmail,
  normaliserTelephoneSN, proposerIdentifiant, tirerCodeImage, IMAGES_CODE,
} from './identifiants';

describe('normaliserTelephoneSN', () => {
  it.each([
    ['77 123 45 67', '+221771234567'],
    ['771234567', '+221771234567'],
    ['+221 77 123 45 67', '+221771234567'],
    ['00221771234567', '+221771234567'],
    ['221-70-123-45-67', '+221701234567'],
    ['33 820 00 00', '+221338200000'],
  ])('%s → %s', (entree, attendu) => expect(normaliserTelephoneSN(entree)).toBe(attendu));

  it.each(['12345', '0612345678', '+33612345678', '87 123 45 67', ''])('refuse %s', (x) =>
    expect(normaliserTelephoneSN(x)).toBeNull());
});

describe('telephoneVersEmail', () => {
  it('donne le même identifiant quelle que soit l’écriture du numéro', () => {
    expect(telephoneVersEmail('77 123 45 67')).toBe('t221771234567@telephones.teranga.invalid');
    expect(telephoneVersEmail('+221771234567')).toBe('t221771234567@telephones.teranga.invalid');
    expect(telephoneVersEmail('00221 77-123-45-67')).toBe('t221771234567@telephones.teranga.invalid');
  });
  it('refuse un numéro invalide', () => expect(() => telephoneVersEmail('123')).toThrow());
});

describe('formaterTelephone', () => {
  it('affiche par paires', () => expect(formaterTelephone('221771234567')).toBe('+221 77 123 45 67'));
  it('gère l’absence', () => expect(formaterTelephone(null)).toBe(''));
});

describe('identifiants élèves', () => {
  it('valide les formes attendues', () => {
    expect(identifiantValide('awa.47')).toBe(true);
    expect(identifiantValide('Awa.47')).toBe(false);
    expect(identifiantValide('a1')).toBe(false);
    expect(identifiantValide('1awa')).toBe(false);
    expect(identifiantValide('awa@x')).toBe(false);
  });
  it('produit une adresse technique non routable', () =>
    expect(identifiantVersEmail(' Awa.47 ')).toBe('awa.47@eleves.teranga.invalid'));
  it('refuse un identifiant invalide', () => expect(() => identifiantVersEmail('x')).toThrow());
  it('propose un identifiant sans accent', () => {
    expect(proposerIdentifiant('Ndèye Fatou', () => 0.5)).toBe('ndeyefatou.55');
    expect(proposerIdentifiant('Al', () => 0)).toBe('alx.10');
    expect(identifiantValide(proposerIdentifiant('Éléonore'))).toBe(true);
  });
});

describe('code-image', () => {
  it('donne un mot de passe stable d’au moins 8 caractères', () => {
    const p = codeImageVersMotDePasse('awa.47', [0, 5, 11, 3]);
    expect(p).toBe('img-0-5-11-3-awa.47');
    expect(p.length).toBeGreaterThanOrEqual(8);
  });
  it('dépend de l’ordre des images', () =>
    expect(codeImageVersMotDePasse('awa.47', [1, 2, 3, 4])).not.toBe(codeImageVersMotDePasse('awa.47', [4, 3, 2, 1])));
  it('refuse un code incomplet ou inconnu', () => {
    expect(() => codeImageVersMotDePasse('awa.47', [1, 2, 3])).toThrow();
    expect(() => codeImageVersMotDePasse('awa.47', [1, 2, 3, 12])).toThrow();
  });
  it('tire 4 images valides', () => {
    const c = tirerCodeImage();
    expect(c).toHaveLength(4);
    c.forEach((i) => expect(i >= 0 && i < IMAGES_CODE.length).toBe(true));
  });
});
