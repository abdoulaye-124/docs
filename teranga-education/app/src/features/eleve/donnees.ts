import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { ecrireCache, estErreurReseau, lireCache, lireFile } from '../../lib/horsligne';
import type { Exercice, Lecon } from '../../lib/pedagogie';

export interface PublicationEleve {
  id: string;
  lesson_id: string | null;
  assessment_id: string | null;
  exercise_id: string | null;
  published_at: string;
  due_at: string | null;
  message: string | null;
}

type Travail = Awaited<ReturnType<typeof chargerTravail>>;

/** Tout ce qui a été publié pour l'élève connecté (filtré par la base).
 *  Hors connexion : dernière version enregistrée sur le téléphone, plus les
 *  réponses en attente d'envoi (considérées comme faites). */
export function useTravailEleve() {
  const { profil } = useSession();
  const uid = profil?.id ?? 'inconnu';
  return useQuery({
    queryKey: ['travail-eleve', uid],
    networkMode: 'always',
    queryFn: async (): Promise<Travail & { horsLigne: boolean; enregistreLe: string | null }> => {
      let d: Travail;
      let horsLigne = false;
      let enregistreLe: string | null = null;
      try {
        // Sans réseau : on ne fait pas patienter l'élève, on lit directement le téléphone.
        if (navigator.onLine === false && lireCache(`travail:${uid}`)) throw new Error('Failed to fetch (hors connexion)');
        d = await chargerTravail();
        ecrireCache(`travail:${uid}`, d);
      } catch (e) {
        const c = lireCache<Travail>(`travail:${uid}`);
        if (!estErreurReseau(e) || !c) throw e;
        d = c.donnees;
        horsLigne = true;
        enregistreLe = c.enregistre_le;
      }
      const enAttente = lireFile(uid).map((x) => ({
        id: x.client_id, exercise_id: x.exercise_id, assessment_id: x.assessment_id, status: 'en_attente', submitted_at: x.cree_le,
      }));
      return { ...d, copies: [...enAttente, ...d.copies.filter((c) => !enAttente.some((a) => a.id === c.id))], horsLigne, enregistreLe };
    },
  });
}

async function chargerTravail() {
  const pubs = verifier(await supabase.from('publications').select('id, lesson_id, assessment_id, exercise_id, published_at, due_at, message')
    .order('published_at', { ascending: false })) as PublicationEleve[];
  const lecIds = [...new Set(pubs.flatMap((p) => (p.lesson_id ? [p.lesson_id] : [])))];
  const exIds = [...new Set(pubs.flatMap((p) => (p.exercise_id ? [p.exercise_id] : [])))];
  const evIds = [...new Set(pubs.flatMap((p) => (p.assessment_id ? [p.assessment_id] : [])))];
  const [lecons, exercicesLecons, exercicesDirects, evaluations, copies] = await Promise.all([
    lecIds.length ? supabase.from('lessons').select('id, title, level_code, content, status, updated_at').in('id', lecIds) : Promise.resolve({ data: [], error: null }),
    lecIds.length ? supabase.from('exercises').select('*').in('lesson_id', lecIds).eq('status', 'valide').order('difficulty').order('created_at') : Promise.resolve({ data: [], error: null }),
    exIds.length ? supabase.from('exercises').select('*').in('id', exIds).eq('status', 'valide') : Promise.resolve({ data: [], error: null }),
    evIds.length ? supabase.from('assessments').select('id, title, kind, french_only, assessment_items(exercise_id, position)').in('id', evIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('submissions').select('id, exercise_id, assessment_id, status, submitted_at').order('submitted_at', { ascending: false }),
  ]);
  const exercices = [...(verifier(exercicesLecons) as Exercice[]), ...(verifier(exercicesDirects) as Exercice[])];
  return {
    publications: pubs,
    lecons: verifier(lecons) as Pick<Lecon, 'id' | 'title' | 'level_code' | 'content' | 'status' | 'updated_at'>[],
    exercices: exercices.filter((e, i) => exercices.findIndex((x) => x.id === e.id) === i),
    evaluations: verifier(evaluations) as { id: string; title: string; kind: string; french_only: boolean; assessment_items: { exercise_id: string; position: number }[] }[],
    copies: verifier(copies) as { id: string; exercise_id: string; assessment_id: string | null; status: string; submitted_at: string }[],
  };
}

/** Lit un texte à voix haute en français (synthèse vocale de l'appareil). */
export function lireAVoixHaute(texte: string) {
  try {
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* synthèse vocale indisponible sur cet appareil */
  }
}
