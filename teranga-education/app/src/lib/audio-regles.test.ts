import { describe, expect, it } from 'vitest';
import { TAILLE_MAX_AUDIO, cheminAudio, choisirFormat, formatDuree, typeDeBase, verifierFichierAudio } from './audio-regles';

describe('choisirFormat', () => {
  it('préfère Opus en webm (Android, Chrome)', () =>
    expect(choisirFormat(() => true)).toEqual({ mime: 'audio/webm;codecs=opus', ext: 'webm' }));
  it('se rabat sur mp4 (Safari)', () =>
    expect(choisirFormat((m) => m === 'audio/mp4')).toEqual({ mime: 'audio/mp4', ext: 'm4a' }));
  it('renvoie null si rien n’est possible', () => expect(choisirFormat(() => false)).toBeNull());
});

describe('verifierFichierAudio', () => {
  it('accepte un enregistrement Opus', () => expect(verifierFichierAudio({ size: 50_000, type: 'audio/webm;codecs=opus' })).toBeNull());
  it('refuse un format non audio', () => expect(verifierFichierAudio({ size: 10, type: 'video/mp4' })).toMatch(/Format/));
  it('refuse un fichier trop lourd', () => expect(verifierFichierAudio({ size: TAILLE_MAX_AUDIO + 1, type: 'audio/mpeg' })).toMatch(/lourd/));
  it('refuse un fichier vide', () => expect(verifierFichierAudio({ size: 0, type: 'audio/wav' })).toMatch(/vide/));
});

describe('divers', () => {
  it('type de base', () => expect(typeDeBase('Audio/WEBM; codecs=opus')).toBe('audio/webm'));
  it('chemin dans le dossier de l’auteur', () => expect(cheminAudio('u1', 'abc', 'audio/webm;codecs=opus')).toBe('u1/abc.webm'));
  it('durée lisible', () => {
    expect(formatDuree(65)).toBe('1:05');
    expect(formatDuree(null)).toBe('');
  });
});
