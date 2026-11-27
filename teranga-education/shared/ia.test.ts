import { describe, expect, it } from 'vitest';
import {
  SCHEMAS, construireRequete, contientNom, indiceSansReponse, pseudonymiser, simuler, verifierSortie, type Tache,
} from './ia';

describe('pseudonymiser', () => {
  it('retire prénom, nom, téléphone et e-mail', () => {
    const t = pseudonymiser('Awa NDIAYE progresse. Appeler sa mère au 77 123 45 67 ou maman@exemple.sn. awa aime lire.', ['Awa', 'Ndiaye']);
    expect(t).toBe("l'élève l'élève progresse. Appeler sa mère au [téléphone] ou [e-mail]. l'élève aime lire.");
  });
  it('gère les accents et les noms composés', () => {
    expect(pseudonymiser('Ndèye Fatou est là ; Ndeye aussi.', ['Ndèye Fatou'])).toBe("l'élève l'élève est là ; l'élève aussi.");
  });
  it('ne touche pas aux mots qui contiennent le nom', () => {
    expect(pseudonymiser('Awalé et Awa', ['Awa'])).toBe("Awalé et l'élève");
  });
  it('détecte un nom restant', () => {
    expect(contientNom('Bravo à MOUSSA', ['Moussa'])).toBe(true);
    expect(contientNom("Bravo à l'élève", ['Moussa'])).toBe(false);
  });
  it('remplace le format international +221', () => expect(pseudonymiser('+221 70 000 10 01', [])).toBe('[téléphone]'));
});

describe('indiceSansReponse', () => {
  it('bloque un indice qui donne le résultat', () => expect(indiceSansReponse('La réponse est 4.', ['4'])).toBeNull());
  it('ne confond pas 4 et 40 ou 14', () => expect(indiceSansReponse('Pense à 40 et à 14.', ['4'])).toBe('Pense à 40 et à 14.'));
  it('bloque une réponse en lettres', () => expect(indiceSansReponse('Indice : cinq.', ['5', 'cinq'])).toBeNull());
  it('accepte un indice neutre', () => expect(indiceSansReponse('Combien de groupes de 3 ?', ['6'])).not.toBeNull());
  it('gère la virgule décimale', () => expect(indiceSansReponse('environ 2,5 kg', ['2.5'])).toBeNull());
});

describe('verifierSortie', () => {
  it('garde les exercices cohérents et écarte les autres', () => {
    const r = verifierSortie('generer_exercices', { exercices: [
      { type: 'qcm', consigne: ' 6 × 2 ? ', choix: ['10', '12'], bonnes_reponses: ['B', 'z'], difficulte: 7, correction_expliquee: 'x' },
      { type: 'qcm', consigne: 'sans bonne réponse', choix: ['1', '2'], bonnes_reponses: ['d'], difficulte: 1, correction_expliquee: '' },
      { type: 'reponse_courte', consigne: '10 ÷ 2', choix: ['ignoré'], bonnes_reponses: ['5'], difficulte: 0, correction_expliquee: '' },
      { type: 'autre', consigne: 'x' },
    ] }) as { exercices: { consigne: string; bonnes_reponses: string[]; difficulte: number; choix: string[] }[] };
    expect(r.exercices).toHaveLength(2);
    expect(r.exercices[0]).toMatchObject({ consigne: '6 × 2 ?', bonnes_reponses: ['b'], difficulte: 3 });
    expect(r.exercices[1]).toMatchObject({ choix: [], difficulte: 1 });
  });
  it('refuse une proposition vide', () => {
    expect(() => verifierSortie('generer_exercices', { exercices: [] })).toThrow();
    expect(() => verifierSortie('proposer_wolof', { texte_wo: ' ' })).toThrow();
  });
  it('filtre les blocs de plan inconnus', () => {
    expect(verifierSortie('plan_lecon', { blocs: [{ type: 'explication', texte: 'a' }, { type: 'pub', texte: 'b' }] }))
      .toEqual({ blocs: [{ type: 'explication', texte: 'a' }] });
  });
});

describe('requêtes et simulation', () => {
  const taches = Object.keys(SCHEMAS) as Tache[];
  const contextes: Record<Tache, unknown> = {
    generer_exercices: { niveau: 'CE2', titre_lecon: 'Division', contenu_lecon: '', objectifs: [], nombre: 3, difficulte: 2 },
    plan_lecon: { niveau: 'CE2', titre: 'Division', objectifs: [] },
    analyse_eleve: { niveau: 'CE2', competences: [{ objectif: 'Diviser', niveau: 'non_acquis', reussite: 0 }], derniers_resultats: [] },
    brouillon_bilan: { niveau: 'CE2', competences: [], derniers_resultats: [], periode: 'novembre', presences: '', observations: [] },
    proposer_wolof: { niveau: 'CE2', type: 'mot', passage: 'partager', contexte: '' },
    indice: { niveau: 'CE2', consigne: '18 ÷ 3', choix: [], indices_deja_donnes: [] },
    conseils_parent: { niveau: 'CE2', competences: [], derniers_resultats: [] },
  };
  it('chaque schéma est strict (champs requis, pas de champ libre)', () => {
    for (const t of taches) {
      const s = SCHEMAS[t] as { required: string[]; properties: object; additionalProperties: boolean };
      expect(s.additionalProperties).toBe(false);
      expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
    }
  });
  it('la simulation produit des sorties valides et étiquetées', () => {
    for (const t of taches) {
      const sortie = verifierSortie(t, simuler(t, contextes[t] as never));
      expect(JSON.stringify(sortie)).toContain('[Simulation]');
    }
  });
  it('la requête ne contient que le contexte fourni', () => {
    const r = construireRequete('indice', contextes.indice as never);
    expect(r.effort).toBe('low');
    expect(r.utilisateur).toContain('18 ÷ 3');
    expect(r.system).toContain('Ne donne JAMAIS la réponse');
  });
});
