// Types et règles pédagogiques PURES (sans accès réseau) : testables isolément.
import type { Niveau } from './types';

export type StatutValidation = 'brouillon' | 'a_valider' | 'valide' | 'archive';
export const LIBELLES_STATUT: Record<StatutValidation, string> = {
  brouillon: 'Brouillon', a_valider: 'À valider', valide: 'Validé', archive: 'Archivé',
};

export type TypeBloc = 'explication' | 'exemple' | 'activite' | 'consigne' | 'resume';
export const LIBELLES_BLOC: Record<TypeBloc, string> = {
  explication: 'Explication', exemple: 'Exemple', activite: 'Activité', consigne: 'Consigne', resume: "Ce qu'il faut retenir",
};
export const ICONES_BLOC: Record<TypeBloc, string> = {
  explication: '💡', exemple: '🔎', activite: '🤲', consigne: '📌', resume: '⭐',
};
export interface Bloc { type: TypeBloc; texte: string }

export interface Lecon {
  id: string;
  title: string;
  level_code: Niveau;
  subject_id: string | null;
  prerequisites: string | null;
  content: Bloc[];
  remediation_hint: string | null;
  status: StatutValidation;
  author_id: string | null;
  validated_by: string | null;
  updated_at: string;
}

export type TypeExercice = 'qcm' | 'reponse_courte' | 'production_libre';
export const LIBELLES_EXERCICE: Record<TypeExercice, string> = {
  qcm: 'Choix multiple (QCM)', reponse_courte: 'Réponse courte', production_libre: 'Production libre (corrigée par l’encadreur)',
};
export interface Choix { id: string; label: string }
export interface Exercice {
  id: string;
  lesson_id: string | null;
  level_code: Niveau;
  kind: TypeExercice;
  prompt: string;
  choices: Choix[] | null;
  difficulty: 1 | 2 | 3;
  max_points: number;
  status: StatutValidation;
  author_id: string | null;
}
export interface Cle { exercise_id: string; answer_key: { correct?: string[]; accepted?: string[] }; explanation: string | null }

export type TypeEvaluation = 'diagnostique' | 'formative' | 'sommative';
export const LIBELLES_EVALUATION: Record<TypeEvaluation | 'cfee_blanc', string> = {
  diagnostique: 'Diagnostique', formative: 'Formative', sommative: 'Sommative', cfee_blanc: 'CFEE blanc',
};
export interface Evaluation {
  id: string;
  title: string;
  kind: TypeEvaluation | 'cfee_blanc';
  level_code: Niveau;
  french_only: boolean;
  status: StatutValidation;
  author_id: string | null;
  assessment_items: { exercise_id: string; position: number; weight: number }[];
}

export interface Noeud {
  id: string;
  version_id: string;
  parent_id: string | null;
  node_type_id: string;
  level_code: Niveau | null;
  code: string | null;
  label: string;
  is_provisional: boolean;
  source_ref: string | null;
  sort_order: number;
}

export function libelleObjectif(n: Pick<Noeud, 'code' | 'label' | 'level_code'>): string {
  return `${n.code ? `${n.code} · ` : ''}${n.label}${n.level_code ? ` (${n.level_code})` : ''}`;
}

/** Vérifie qu'un exercice est complet avant validation (aide à la saisie). */
export function exerciceIncomplet(e: { kind: TypeExercice; prompt: string; choices: Choix[] | null }, cle: Cle['answer_key']): string | null {
  if (!e.prompt.trim()) return 'La consigne est vide.';
  if (e.kind === 'qcm') {
    const choix = (e.choices ?? []).filter((c) => c.label.trim());
    if (choix.length < 2) return 'Un QCM doit proposer au moins deux réponses.';
    if (!cle.correct?.length) return 'Indiquez la ou les bonnes réponses.';
    if (cle.correct.some((c) => !choix.some((x) => x.id === c))) return 'Une bonne réponse ne correspond à aucun choix.';
  }
  if (e.kind === 'reponse_courte' && !(cle.accepted ?? []).some((a) => a.trim())) {
    return 'Indiquez au moins une réponse acceptée.';
  }
  return null;
}
