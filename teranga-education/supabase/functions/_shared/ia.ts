// Assistant pédagogique : règles PURES, partagées par la fonction serveur et
// testées isolément. Aucune dépendance, aucun accès réseau.
//
// Le fournisseur d'IA ne reçoit JAMAIS : nom, prénom, date de naissance,
// identifiant, téléphone ou e-mail d'un enfant ou d'un parent.

export type Tache =
  | 'generer_exercices' | 'plan_lecon' | 'analyse_eleve' | 'brouillon_bilan'
  | 'proposer_wolof' | 'indice' | 'conseils_parent';

export const ROLES_PAR_TACHE: Record<Tache, string[]> = {
  generer_exercices: ['admin', 'coordinateur', 'encadreur'],
  plan_lecon: ['admin', 'coordinateur', 'encadreur'],
  analyse_eleve: ['admin', 'coordinateur', 'encadreur'],
  brouillon_bilan: ['admin', 'coordinateur', 'encadreur'],
  proposer_wolof: ['admin', 'coordinateur', 'encadreur', 'relecteur_wolof'],
  indice: ['eleve'],
  conseils_parent: ['parent'],
};

// ----------------------------------------------------------------------------- Choix du fournisseur
export type Fournisseur = 'anthropic' | 'simulation' | 'aucun';

/** Sans clé d'API, l'assistant est DÉSACTIVÉ (aucun frais, aucune fausse réponse).
 *  La simulation n'est utilisée que si on la demande explicitement (développement, tests). */
export function choisirFournisseur(choix: string | undefined, aUneCle: boolean): Fournisseur {
  if (choix === 'simulation') return 'simulation';
  if (choix === 'aucun') return 'aucun';
  return aUneCle ? 'anthropic' : 'aucun';
}

// ----------------------------------------------------------------------------- Pseudonymisation
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remplace les noms donnés, les téléphones et les e-mails par des mentions neutres. */
export function pseudonymiser(texte: string, noms: string[], remplacement = "l'élève"): string {
  let t = texte
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]')
    .replace(/(?:\+|00)?221[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '[téléphone]')
    .replace(/\b(?:7[0-9]|33)[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, '[téléphone]');
  const mots = noms.flatMap((n) => n.split(/[\s-]+/)).map((n) => n.trim()).filter((n) => n.length >= 2);
  for (const m of mots.sort((a, b) => b.length - a.length)) {
    const motif = new RegExp(`(^|[^\\p{L}])(${echapper(m)})(?=$|[^\\p{L}])`, 'giu');
    t = t.replace(motif, `$1${remplacement}`);
    // Même nom écrit sans accents
    const sa = sansAccents(m);
    if (sa !== m) t = t.replace(new RegExp(`(^|[^\\p{L}])(${echapper(sa)})(?=$|[^\\p{L}])`, 'giu'), `$1${remplacement}`);
  }
  return t;
}

/** Vrai si un texte contient encore l'un des noms (contrôle de sécurité avant envoi). */
export function contientNom(texte: string, noms: string[]): boolean {
  const t = sansAccents(texte).toLowerCase();
  return noms.flatMap((n) => n.split(/[\s-]+/)).filter((n) => n.length >= 3)
    .some((n) => new RegExp(`(^|[^a-z])${echapper(sansAccents(n).toLowerCase())}($|[^a-z])`).test(t));
}

// ----------------------------------------------------------------------------- Indices sans réponse
const normaliser = (s: string) => sansAccents(s).toLowerCase().replace(/\s+/g, ' ').trim();

/** Renvoie l'indice s'il ne révèle aucune des réponses attendues, sinon null. */
export function indiceSansReponse(indice: string, reponses: string[]): string | null {
  const t = normaliser(indice);
  for (const r of reponses.map(normaliser).filter(Boolean)) {
    if (/^-?\d+([.,]\d+)?$/.test(r)) {
      const n = r.replace(',', '[.,]');
      if (new RegExp(`(^|[^\\d])${n}($|[^\\d])`).test(t)) return null;
    } else if (r.length >= 3 && t.includes(r)) {
      return null;
    }
  }
  return indice;
}

export const INDICE_DE_SECOURS = 'Relis bien la consigne. Qu’est-ce qu’on te demande de trouver ? Essaie avec un dessin ou des objets.';

// ----------------------------------------------------------------------------- Contextes envoyés
export interface ContexteExercices { niveau: string; titre_lecon: string; contenu_lecon: string; objectifs: string[]; nombre: number; difficulte: number }
export interface ContextePlan { niveau: string; titre: string; objectifs: string[] }
export interface ContexteAnalyse { niveau: string; competences: { objectif: string; niveau: string; reussite: number | null }[]; derniers_resultats: { consigne: string; note: string }[]; objectif_vise?: string; prerequis?: { objectif: string; niveau: string }[] }
export interface ContexteBilan extends ContexteAnalyse { periode: string; presences: string; observations: string[] }
export interface ContexteWolof { niveau: string; type: string; passage: string; contexte: string }
export interface ContexteIndice { niveau: string; consigne: string; choix: string[]; indices_deja_donnes: string[] }
export interface ContexteParent { niveau: string; competences: { objectif: string; niveau: string }[]; derniers_resultats: { consigne: string; note: string }[] }

export type Contexte = ContexteExercices | ContextePlan | ContexteAnalyse | ContexteBilan | ContexteWolof | ContexteIndice | ContexteParent;

// ----------------------------------------------------------------------------- Formats de réponse (JSON Schema)
const texte = { type: 'string' } as const;
const listeTextes = { type: 'array', items: { type: 'string' } } as const;
const objet = (properties: Record<string, unknown>) =>
  ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const SCHEMAS: Record<Tache, Record<string, unknown>> = {
  generer_exercices: objet({
    exercices: {
      type: 'array',
      items: objet({
        type: { type: 'string', enum: ['qcm', 'reponse_courte'] },
        consigne: texte, choix: listeTextes, bonnes_reponses: listeTextes,
        difficulte: { type: 'integer' }, correction_expliquee: texte,
      }),
    },
  }),
  plan_lecon: objet({
    blocs: { type: 'array', items: objet({ type: { type: 'string', enum: ['explication', 'exemple', 'activite', 'consigne', 'resume'] }, texte }) },
  }),
  analyse_eleve: objet({ constats: listeTextes, hypotheses: listeTextes, pistes: listeTextes }),
  brouillon_bilan: objet({ synthese: texte, points_forts: texte, difficultes: texte, recommandations: texte }),
  proposer_wolof: objet({ explication_fr_simple: texte, texte_wo: texte, remarque_relecteur: texte }),
  indice: objet({ indice: texte, encouragement: texte }),
  conseils_parent: objet({ resume: texte, conseils: listeTextes }),
};

// ----------------------------------------------------------------------------- Consignes données à l'IA
export const CONSIGNE_GENERALE = [
  'Tu es l’assistant pédagogique de TERANGA ÉDUCATION, un centre d’accompagnement scolaire au Sénégal (enseignement élémentaire, du CI au CM2).',
  'La langue d’enseignement est le français : écris un français simple, correct, adapté à l’âge des élèves.',
  'Utilise des situations de la vie quotidienne au Sénégal (marché, francs CFA, transport, cuisine, fêtes, agriculture, pêche), avec des prénoms variés.',
  'Les objectifs pédagogiques fournis peuvent être provisoires : ne présente jamais un contenu comme étant « le programme officiel » et n’invente aucune référence officielle.',
  'Tu ne connais l’élève que par les données fournies : n’invente rien sur lui ou sa famille, et ne tire aucune conclusion médicale, psychologique ou familiale.',
  'Tes propositions seront vérifiées par un encadreur humain, qui reste seul à décider.',
].join('\n');

const CONSIGNES: Record<Tache, string> = {
  generer_exercices:
    'Propose des exercices progressifs sur la leçon fournie. Pour un QCM : 3 ou 4 choix, « bonnes_reponses » contient les lettres des bonnes réponses (a, b, c, d) dans l’ordre des choix. ' +
    'Pour une réponse courte : « choix » est vide et « bonnes_reponses » liste les réponses acceptées (ex. « 5 », « cinq »). « difficulte » vaut 1, 2 ou 3. ' +
    'La correction expliquée montre le raisonnement en une ou deux phrases.',
  plan_lecon:
    'Propose le plan d’une leçon courte en blocs : une explication, un ou deux exemples concrets, une activité à faire en séance, et ce qu’il faut retenir. Phrases courtes.',
  analyse_eleve:
    'Analyse les résultats fournis. « constats » : ce que montrent les données, chiffres à l’appui. « hypotheses » : causes possibles des difficultés (par exemple un prérequis non maîtrisé), formulées avec prudence. ' +
    '« pistes » : activités de remédiation concrètes. Pas plus de 4 éléments par liste.',
  brouillon_bilan:
    'Rédige un brouillon de bilan périodique, bienveillant et factuel, destiné aux parents. Parle de « l’élève ». Recommandations simples, réalisables à la maison sans matériel coûteux.',
  proposer_wolof:
    'Propose une explication complémentaire en wolof du passage français fourni, pour aider l’élève à comprendre (sans donner la réponse d’un exercice). ' +
    'Écris le wolof avec l’orthographe officielle (alphabet des langues nationales du Sénégal). Si un terme scolaire n’a pas d’équivalent sûr, garde le mot français entre guillemets. ' +
    '« explication_fr_simple » reformule d’abord en français simple. Dans « remarque_relecteur », signale honnêtement tes doutes de formulation : un relecteur wolof vérifiera tout.',
  indice:
    'Donne UN indice à un enfant qui bloque sur l’exercice. Ne donne JAMAIS la réponse, ni le résultat d’un calcul, ni la bonne lettre d’un QCM. ' +
    'Pose plutôt une question qui le met sur la piste, ou rappelle une méthode. Deux phrases au maximum, tutoiement. Si des indices ont déjà été donnés, va un peu plus loin sans donner la réponse. « encouragement » : une phrase courte et positive.',
  conseils_parent:
    'Explique simplement à un parent où en est son enfant, à partir des compétences fournies (« acquis », « en cours », « non acquis »). ' +
    'Puis 3 ou 4 conseils concrets pour l’aider à la maison (quelques minutes par jour, sans matériel coûteux, même si le parent n’est pas à l’aise avec le français). Vouvoiement, ton chaleureux, pas de jargon.',
};

export const EFFORT: Record<Tache, 'low' | 'medium' | 'high'> = {
  generer_exercices: 'medium', plan_lecon: 'medium', analyse_eleve: 'medium', brouillon_bilan: 'medium',
  proposer_wolof: 'medium', indice: 'low', conseils_parent: 'low',
};

export interface RequeteIA { system: string; utilisateur: string; schema: Record<string, unknown>; effort: 'low' | 'medium' | 'high' }

export function construireRequete(tache: Tache, contexte: Contexte): RequeteIA {
  return {
    system: `${CONSIGNE_GENERALE}\n\n${CONSIGNES[tache]}`,
    utilisateur: `Données (JSON) :\n${JSON.stringify(contexte, null, 2)}`,
    schema: SCHEMAS[tache],
    effort: EFFORT[tache],
  };
}

// ----------------------------------------------------------------------------- Vérification des réponses
const court = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const liste = (l: unknown, max: number, n: number) => (Array.isArray(l) ? l.map((x) => court(x, max)).filter(Boolean).slice(0, n) : []);

export interface ExerciceIA { type: 'qcm' | 'reponse_courte'; consigne: string; choix: string[]; bonnes_reponses: string[]; difficulte: 1 | 2 | 3; correction_expliquee: string }

/** Nettoie et vérifie la réponse de l'IA ; écarte ce qui est incohérent. */
export function verifierSortie(tache: Tache, brut: unknown): Record<string, unknown> {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  switch (tache) {
    case 'generer_exercices': {
      const ex: ExerciceIA[] = [];
      for (const e of (Array.isArray(o.exercices) ? o.exercices : []) as Record<string, unknown>[]) {
        const consigne = court(e.consigne, 600);
        if (!consigne) continue;
        const difficulte = Math.min(3, Math.max(1, Math.round(Number(e.difficulte) || 1))) as 1 | 2 | 3;
        if (e.type === 'qcm') {
          const choix = liste(e.choix, 200, 6);
          const lettres = 'abcdef'.slice(0, choix.length).split('');
          const bonnes = liste(e.bonnes_reponses, 3, 6).map((x) => x.toLowerCase()).filter((x) => lettres.includes(x));
          if (choix.length < 2 || !bonnes.length) continue;
          ex.push({ type: 'qcm', consigne, choix, bonnes_reponses: [...new Set(bonnes)], difficulte, correction_expliquee: court(e.correction_expliquee, 1000) });
        } else if (e.type === 'reponse_courte') {
          const acceptees = liste(e.bonnes_reponses, 60, 6);
          if (!acceptees.length) continue;
          ex.push({ type: 'reponse_courte', consigne, choix: [], bonnes_reponses: acceptees, difficulte, correction_expliquee: court(e.correction_expliquee, 1000) });
        }
      }
      if (!ex.length) throw new Error('Aucun exercice exploitable dans la proposition');
      return { exercices: ex.slice(0, 5) };
    }
    case 'plan_lecon': {
      const types = ['explication', 'exemple', 'activite', 'consigne', 'resume'];
      const blocs = (Array.isArray(o.blocs) ? o.blocs : [])
        .map((b) => b as Record<string, unknown>)
        .filter((b) => types.includes(String(b.type)) && court(b.texte, 3000))
        .map((b) => ({ type: String(b.type), texte: court(b.texte, 3000) })).slice(0, 8);
      if (!blocs.length) throw new Error('Plan vide');
      return { blocs };
    }
    case 'analyse_eleve':
      return { constats: liste(o.constats, 500, 4), hypotheses: liste(o.hypotheses, 500, 4), pistes: liste(o.pistes, 500, 4) };
    case 'brouillon_bilan':
      return { synthese: court(o.synthese, 2000), points_forts: court(o.points_forts, 2000), difficultes: court(o.difficultes, 2000), recommandations: court(o.recommandations, 2000) };
    case 'proposer_wolof': {
      const wo = court(o.texte_wo, 2000);
      if (!wo) throw new Error('Proposition en wolof vide');
      return { explication_fr_simple: court(o.explication_fr_simple, 1500), texte_wo: wo, remarque_relecteur: court(o.remarque_relecteur, 1000) };
    }
    case 'indice':
      return { indice: court(o.indice, 400), encouragement: court(o.encouragement, 200) };
    case 'conseils_parent':
      return { resume: court(o.resume, 1500), conseils: liste(o.conseils, 500, 5) };
  }
}

// ----------------------------------------------------------------------------- Mode simulation
/** Réponses fabriquées, sans IA, pour développer et tester sans clé ni coût.
 *  Toutes portent la mention [Simulation] : elles ne doivent jamais être prises pour du vrai contenu. */
export function simuler(tache: Tache, c: Contexte): Record<string, unknown> {
  const S = '[Simulation]';
  switch (tache) {
    case 'generer_exercices': {
      const x = c as ContexteExercices;
      return {
        exercices: Array.from({ length: Math.max(1, Math.min(5, x.nombre)) }, (_, i) => i % 2 === 0
          ? { type: 'qcm', consigne: `${S} Exercice ${i + 1} sur « ${x.titre_lecon} » : 20 ÷ 5 = ?`, choix: ['3', '4', '5'], bonnes_reponses: ['b'], difficulte: x.difficulte, correction_expliquee: `${S} 20 ÷ 5 = 4 car 5 × 4 = 20.` }
          : { type: 'reponse_courte', consigne: `${S} Exercice ${i + 1} sur « ${x.titre_lecon} » : 18 ÷ 3 = ?`, choix: [], bonnes_reponses: ['6', 'six'], difficulte: x.difficulte, correction_expliquee: `${S} 18 ÷ 3 = 6 car 3 × 6 = 18.` }),
      };
    }
    case 'plan_lecon': {
      const x = c as ContextePlan;
      return { blocs: [
        { type: 'explication', texte: `${S} Explication de « ${x.titre} » (${x.niveau}).` },
        { type: 'exemple', texte: `${S} Exemple au marché : 12 mangues partagées entre 3 enfants.` },
        { type: 'activite', texte: `${S} Activité en séance avec des capsules ou des cailloux.` },
        { type: 'resume', texte: `${S} Ce qu’il faut retenir.` },
      ] };
    }
    case 'analyse_eleve': {
      const x = c as ContexteAnalyse;
      const faibles = x.competences.filter((k) => k.niveau !== 'acquis').map((k) => k.objectif);
      return {
        constats: [`${S} ${x.competences.length} objectif(s) évalué(s) ; ${faibles.length} non acquis ou en cours.`],
        hypotheses: [`${S} Un prérequis est peut-être fragile${x.prerequis?.length ? ` : ${x.prerequis[0].objectif}` : ''}.`],
        pistes: [`${S} Reprendre avec du matériel concret, puis des exercices courts du plus facile au plus difficile.`],
      };
    }
    case 'brouillon_bilan':
      return { synthese: `${S} Synthèse de la période ${(c as ContexteBilan).periode}.`, points_forts: `${S} Points forts.`, difficultes: `${S} Difficultés.`, recommandations: `${S} 10 minutes de calcul mental chaque soir.` };
    case 'proposer_wolof':
      return { explication_fr_simple: `${S} « ${(c as ContexteWolof).passage} » expliqué simplement.`, texte_wo: `${S} [proposition wolof fictive pour « ${(c as ContexteWolof).passage} »]`, remarque_relecteur: `${S} Texte fictif : à remplacer intégralement.` };
    case 'indice':
      return { indice: `${S} Relis la consigne : que dois-tu partager, et entre combien de personnes ?`, encouragement: `${S} Tu peux y arriver !` };
    case 'conseils_parent':
      return { resume: `${S} Votre enfant progresse sur ${(c as ContexteParent).competences.length} objectif(s).`, conseils: [`${S} Faites-lui compter les pièces au marché.`, `${S} Demandez-lui d’expliquer sa leçon.`] };
  }
}
