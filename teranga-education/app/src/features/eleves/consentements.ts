// PROJETS de textes de consentement (version prototype).
// À faire relire par un juriste avant toute utilisation avec de vraies familles
// (voir Phase 1, document 03, liste de contrôle CDP).
export const VERSION_TEXTES = 'v0-prototype';

export const TEXTES_CONSENTEMENT = {
  inscription: {
    titre: 'Inscription et dossier pédagogique',
    texte:
      "J'accepte que le centre TERANGA ÉDUCATION enregistre les informations nécessaires à l'accompagnement " +
      "scolaire de mon enfant (identité, niveau, résultats, présences, observations). Ces informations ne sont " +
      "accessibles qu'aux personnes du centre chargées de son suivi et à moi-même. Je peux demander à les consulter, " +
      'à les corriger ou à les faire supprimer.',
    obligatoire: true,
  },
  compte_eleve: {
    titre: 'Compte de connexion de l’enfant',
    texte:
      "J'accepte que mon enfant dispose d'un identifiant personnel pour consulter ses leçons et faire ses exercices. " +
      "Pour les plus jeunes, je l'accompagne lors de l'utilisation.",
    obligatoire: false,
  },
  notifications: {
    titre: 'Notifications',
    texte: "J'accepte de recevoir des notifications (nouvelles leçons, absences, bilans) sur mon compte parent.",
    obligatoire: false,
  },
} as const;

export type TypeConsentement = keyof typeof TEXTES_CONSENTEMENT;
