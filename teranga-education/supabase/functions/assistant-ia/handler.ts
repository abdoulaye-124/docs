// Fonction serveur « assistant-ia ».
//
// Pour chaque demande :
//  1. vérifie l'identité, le rôle et le quota du jour ;
//  2. lit les données AVEC LE JETON DE L'UTILISATEUR (règles RLS : il ne lit
//     que ce qu'il a le droit de voir) ;
//  3. construit un contexte PSEUDONYMISÉ (aucun nom d'enfant) et refuse l'envoi
//     si un nom subsiste ;
//  4. appelle le fournisseur, vérifie la réponse ;
//  5. enregistre le résultat comme brouillon / « à relire » : l'IA ne décide rien ;
//  6. journalise l'appel (clé service).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  INDICE_DE_SECOURS, ROLES_PAR_TACHE, construireRequete, contientNom, indiceSansReponse, pseudonymiser, verifierSortie,
  type Contexte, type ExerciceIA, type Tache,
} from '../_shared/ia.ts';
import { demanderIA, ErreurIA, fournisseurConfigure, modeleConfigure } from './fournisseurs.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const NIVEAUX_LISIBLES: Record<string, string> = { non_acquis: 'non acquis', en_cours: 'en cours d’acquisition', acquis: 'acquis' };

interface Ctx {
  uid: string;
  role: string;
  client: SupabaseClient;   // jeton de l'utilisateur : RLS appliquée
  admin: SupabaseClient;    // clé service : journal, corrigés (jamais renvoyés tels quels)
  reglages: { active: boolean; quota_jour: Record<string, number>; indices_par_exercice: number };
}

interface Resultat {
  contexte: Contexte;
  noms: string[];
  apres: (sortie: Record<string, unknown>) => Promise<unknown>;
  liens?: { student_id?: string; lesson_id?: string; exercise_id?: string };
  resume: string;
}

function lire<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw new ErreurIA('Données inaccessibles avec votre compte.', 403);
  if (r.data === null || r.data === undefined) throw new ErreurIA('Élément introuvable ou non accessible.', 404);
  return r.data as NonNullable<T>;
}

function texte(v: unknown, champ: string, max = 300): string {
  if (typeof v !== 'string' || !v.trim()) throw new ErreurIA(`Champ manquant : ${champ}`, 400);
  return v.trim().slice(0, max);
}

// ----------------------------------------------------------------------------- Données d'un élève (pseudonymisées)
async function donneesEleve(ctx: Ctx, studentId: string, nodeId?: string) {
  const el = lire(await ctx.client.from('students').select('id, first_name, last_name, level_code').eq('id', studentId).maybeSingle());
  const noms = [el.first_name, el.last_name];
  const nodes = lire(await ctx.client.from('curriculum_nodes').select('id, label'));
  const label = (id: string) => (nodes as { id: string; label: string }[]).find((n) => n.id === id)?.label ?? '—';
  const maitrise = lire(await ctx.client.from('current_mastery').select('node_id, level, score_pct').eq('student_id', studentId)) as
    { node_id: string; level: string; score_pct: number | null }[];
  const copies = lire(await ctx.client.from('submissions').select('submitted_at, exercises(prompt), corrections(score, max_score)')
    .eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(10)) as unknown as
    { exercises: { prompt: string } | null; corrections: { score: number; max_score: number } | null }[];
  let prerequis: { objectif: string; niveau: string }[] | undefined;
  if (nodeId) {
    const p = lire(await ctx.client.rpc('prerequisite_status', { p_student: studentId, p_node: nodeId })) as { label: string; level: string | null }[];
    prerequis = p.map((x) => ({ objectif: x.label, niveau: x.level ? NIVEAUX_LISIBLES[x.level] : 'jamais évalué' }));
  }
  return {
    noms,
    niveau: el.level_code as string,
    competences: maitrise.map((m) => ({ objectif: label(m.node_id), niveau: NIVEAUX_LISIBLES[m.level], reussite: m.score_pct === null ? null : Math.round(m.score_pct) })),
    derniers_resultats: copies.map((c) => ({
      consigne: pseudonymiser(c.exercises?.prompt ?? '', noms),
      note: c.corrections ? `${Number(c.corrections.score)} / ${Number(c.corrections.max_score)}` : 'pas encore corrigé',
    })),
    objectif_vise: nodeId ? label(nodeId) : undefined,
    prerequis,
  };
}

// ----------------------------------------------------------------------------- Préparation par tâche
async function preparer(tache: Tache, ctx: Ctx, b: Record<string, unknown>): Promise<Resultat> {
  switch (tache) {
    case 'generer_exercices': {
      const lessonId = texte(b.lesson_id, 'leçon', 40);
      const l = lire(await ctx.client.from('lessons').select('id, title, level_code, content').eq('id', lessonId).maybeSingle());
      const objs = lire(await ctx.client.from('lesson_objectives').select('node_id, curriculum_nodes(label)').eq('lesson_id', lessonId)) as unknown as
        { node_id: string; curriculum_nodes: { label: string } | null }[];
      const nombre = Math.min(5, Math.max(1, Number(b.nombre) || 3));
      const difficulte = Math.min(3, Math.max(1, Number(b.difficulte) || 1));
      return {
        noms: [],
        resume: `${nombre} exercice(s), difficulté ${difficulte}, niveau ${l.level_code}`,
        liens: { lesson_id: lessonId },
        contexte: {
          niveau: l.level_code, titre_lecon: l.title, nombre, difficulte,
          contenu_lecon: ((l.content ?? []) as { texte: string }[]).map((x) => x.texte).join('\n').slice(0, 4000),
          objectifs: objs.map((o) => o.curriculum_nodes?.label ?? '').filter(Boolean),
        },
        apres: async (s) => {
          const crees: string[] = [];
          for (const e of s.exercices as ExerciceIA[]) {
            const ex = lire(await ctx.client.from('exercises').insert({
              lesson_id: lessonId, level_code: l.level_code, kind: e.type, prompt: e.consigne,
              choices: e.type === 'qcm' ? e.choix.map((label, i) => ({ id: 'abcdef'[i], label })) : null,
              difficulty: e.difficulte, max_points: 1, status: 'brouillon', origin: 'ia', author_id: ctx.uid,
            }).select('id').single());
            lire(await ctx.client.from('exercise_keys').insert({
              exercise_id: ex.id,
              answer_key: e.type === 'qcm' ? { correct: e.bonnes_reponses } : { accepted: e.bonnes_reponses },
              explanation: e.correction_expliquee || null,
            }).select('exercise_id'));
            if (objs.length) lire(await ctx.client.from('exercise_objectives').insert(objs.map((o) => ({ exercise_id: ex.id, node_id: o.node_id }))).select('exercise_id'));
            crees.push(ex.id);
          }
          return { exercices_crees: crees.length };
        },
      };
    }
    case 'plan_lecon': {
      const ids = Array.isArray(b.objectifs) ? (b.objectifs as unknown[]).map(String).slice(0, 10) : [];
      const objs = ids.length ? lire(await ctx.client.from('curriculum_nodes').select('label').in('id', ids)) as { label: string }[] : [];
      const niveau = texte(b.niveau, 'niveau', 3);
      return {
        noms: [], resume: `plan de leçon ${niveau}`,
        contexte: { niveau, titre: texte(b.titre, 'titre', 150), objectifs: objs.map((o) => o.label) },
        apres: async (s) => s,
      };
    }
    case 'analyse_eleve': {
      const sid = texte(b.student_id, 'élève', 40);
      const peut = lire(await ctx.client.rpc('can_teach_student', { p_student: sid }));
      if (peut !== true) throw new ErreurIA('Élève non affecté à votre compte.', 403);
      const d = await donneesEleve(ctx, sid, typeof b.node_id === 'string' ? b.node_id : undefined);
      return {
        noms: d.noms, resume: `analyse (${d.competences.length} objectif(s))`, liens: { student_id: sid },
        contexte: { niveau: d.niveau, competences: d.competences, derniers_resultats: d.derniers_resultats, objectif_vise: d.objectif_vise, prerequis: d.prerequis },
        apres: async (s) => s,
      };
    }
    case 'brouillon_bilan': {
      const sid = texte(b.student_id, 'élève', 40);
      const peut = lire(await ctx.client.rpc('can_teach_student', { p_student: sid }));
      if (peut !== true) throw new ErreurIA('Élève non affecté à votre compte.', 403);
      const debut = texte(b.debut, 'début', 10);
      const fin = texte(b.fin, 'fin', 10);
      const d = await donneesEleve(ctx, sid);
      const pres = lire(await ctx.client.from('attendance').select('status, recorded_at').eq('student_id', sid)
        .gte('recorded_at', `${debut}T00:00:00`).lte('recorded_at', `${fin}T23:59:59`)) as { status: string }[];
      const obs = lire(await ctx.client.from('observations').select('body').eq('student_id', sid)
        .gte('created_at', `${debut}T00:00:00`).lte('created_at', `${fin}T23:59:59`).limit(10)) as { body: string }[];
      const presents = pres.filter((p) => p.status === 'present' || p.status === 'retard').length;
      return {
        noms: d.noms, resume: `bilan ${debut} → ${fin}`, liens: { student_id: sid },
        contexte: {
          niveau: d.niveau, competences: d.competences, derniers_resultats: d.derniers_resultats,
          periode: `du ${debut} au ${fin}`,
          presences: pres.length ? `${presents} présence(s) sur ${pres.length} séance(s)` : 'aucune séance enregistrée',
          observations: obs.map((o) => pseudonymiser(o.body, d.noms).slice(0, 600)),
        },
        apres: async (s) => s,
      };
    }
    case 'proposer_wolof': {
      const lessonId = typeof b.lesson_id === 'string' ? b.lesson_id : undefined;
      const exerciseId = typeof b.exercise_id === 'string' ? b.exercise_id : undefined;
      if (!lessonId && !exerciseId) throw new ErreurIA('Indiquez la leçon ou l’exercice.', 400);
      const type = ['consigne', 'mot', 'notion', 'probleme'].includes(String(b.type)) ? String(b.type) : 'notion';
      const passage = texte(b.passage, 'passage', 300);
      const cadre = lessonId
        ? lire(await ctx.client.from('lessons').select('title, level_code').eq('id', lessonId).maybeSingle())
        : lire(await ctx.client.from('exercises').select('prompt, level_code').eq('id', exerciseId!).maybeSingle());
      return {
        noms: [], resume: `wolof : ${type} « ${passage.slice(0, 40)} »`, liens: { lesson_id: lessonId, exercise_id: exerciseId },
        contexte: { niveau: cadre.level_code, type, passage, contexte: 'title' in cadre ? `Leçon : ${cadre.title}` : `Exercice : ${cadre.prompt}` },
        apres: async (s) => {
          lire(await ctx.client.from('wolof_explanations').insert({
            lesson_id: lessonId ?? null, exercise_id: exerciseId ?? null, target_kind: type, target_text: passage,
            text_wo: s.texte_wo, origin: 'ia', status: 'a_valider', author_id: ctx.uid,
          }).select('id'));
          return { explication_fr_simple: s.explication_fr_simple, remarque_relecteur: s.remarque_relecteur, envoye_en_relecture: true };
        },
      };
    }
    case 'indice': {
      const exId = texte(b.exercise_id, 'exercice', 40);
      const autorise = lire(await ctx.client.rpc('family_hint_allowed', { p_exercise: exId }));
      if (autorise !== true) throw new ErreurIA('Pas d’indice pour cet exercice (évaluation ou exercice non publié).', 403);
      const deja = lire(await ctx.admin.from('ai_requests').select('output').eq('requester_id', ctx.uid)
        .eq('exercise_id', exId).eq('purpose', 'indice').is('error', null)) as { output: { indice?: string } | null }[];
      if (deja.length >= ctx.reglages.indices_par_exercice) {
        throw new ErreurIA(`Tu as déjà utilisé tes ${ctx.reglages.indices_par_exercice} indices pour cet exercice. Demande de l’aide à ton encadreur.`, 429);
      }
      const ex = lire(await ctx.client.from('exercises').select('prompt, choices, level_code').eq('id', exId).maybeSingle());
      const cle = (await ctx.admin.from('exercise_keys').select('answer_key').eq('exercise_id', exId).maybeSingle()).data as
        { answer_key: { correct?: string[]; accepted?: string[] } } | null;
      const choix = (ex.choices ?? []) as { id: string; label: string }[];
      const reponses = [
        ...(cle?.answer_key.accepted ?? []),
        ...(cle?.answer_key.correct ?? []).map((id) => choix.find((c) => c.id === id)?.label ?? '').filter(Boolean),
      ];
      return {
        noms: [], resume: 'indice', liens: { exercise_id: exId },
        contexte: { niveau: ex.level_code, consigne: ex.prompt, choix: choix.map((c) => c.label), indices_deja_donnes: deja.map((d) => d.output?.indice ?? '').filter(Boolean) },
        apres: async (s) => {
          const sur = indiceSansReponse(String(s.indice), reponses);
          return { indice: sur ?? INDICE_DE_SECOURS, encouragement: s.encouragement, filtre: sur === null,
            restants: ctx.reglages.indices_par_exercice - deja.length - 1 };
        },
      };
    }
    case 'conseils_parent': {
      const sid = texte(b.student_id, 'enfant', 40);
      const parent = lire(await ctx.client.rpc('is_guardian_of', { p_student: sid }));
      if (parent !== true) throw new ErreurIA('Enfant non associé à votre compte.', 403);
      const d = await donneesEleve(ctx, sid);
      return {
        noms: d.noms, resume: 'conseils aux parents', liens: { student_id: sid },
        contexte: { niveau: d.niveau, competences: d.competences.map(({ objectif, niveau }) => ({ objectif, niveau })), derniers_resultats: d.derniers_resultats },
        apres: async (s) => s,
      };
    }
  }
}

// ----------------------------------------------------------------------------- Point d'entrée
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json(500, { error: 'Configuration serveur incomplète' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Connexion requise' });

  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await client.auth.getUser(authorization.slice(7));
  if (!u?.user) return json(401, { error: 'Session invalide' });

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return json(400, { error: 'Requête illisible' }); }

  const roles = ((await client.from('user_roles').select('role').eq('user_id', u.user.id)).data ?? []).map((r) => r.role as string);
  const reglagesBruts = (await client.from('app_settings').select('value').eq('key', 'ia').maybeSingle()).data?.value as Ctx['reglages'] | undefined;
  const reglages: Ctx['reglages'] = { active: true, quota_jour: {}, indices_par_exercice: 2, ...(reglagesBruts ?? {}) };

  // Action d'information (paramètres) : pas d'appel à l'IA.
  if (corps.action === 'etat') {
    const { count } = await admin.from('ai_requests').select('id', { count: 'exact', head: true })
      .eq('requester_id', u.user.id).gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()).is('error', null);
    return json(200, { fournisseur: fournisseurConfigure(), modele: fournisseurConfigure() === 'anthropic' ? modeleConfigure() : 'simulation', active: reglages.active, utilise_aujourdhui: count ?? 0 });
  }

  const tache = corps.action as Tache;
  if (!(tache in ROLES_PAR_TACHE)) return json(400, { error: 'Action inconnue' });
  const role = ROLES_PAR_TACHE[tache].find((r) => roles.includes(r));
  if (!role) return json(403, { error: 'Cette fonction de l’assistant n’est pas disponible pour votre compte.' });
  if (!reglages.active) return json(503, { error: 'L’assistant est désactivé par la direction du centre.' });
  if (fournisseurConfigure() === 'aucun') return json(503, { error: 'Assistant non activé : aucun fournisseur d’IA n’est configuré.' });

  const debutJour = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
  const { count: utilise } = await admin.from('ai_requests').select('id', { count: 'exact', head: true })
    .eq('requester_id', u.user.id).gte('created_at', debutJour).is('error', null);
  const quota = reglages.quota_jour[role] ?? 20;
  if ((utilise ?? 0) >= quota) return json(429, { error: `Limite quotidienne atteinte (${quota} demandes). Elle se renouvelle demain.` });

  const ctx: Ctx = { uid: u.user.id, role, client, admin, reglages };
  const t0 = Date.now();
  let prep: Resultat | null = null;
  try {
    prep = await preparer(tache, ctx, corps);
    const requete = construireRequete(tache, prep.contexte);
    // Garde-fou : aucun nom d'élève ne doit partir chez le fournisseur.
    if (prep.noms.length && contientNom(requete.utilisateur, prep.noms)) {
      throw new ErreurIA('Envoi bloqué : des données nominatives subsistaient. Rien n’a été transmis.', 500);
    }
    const rep = await demanderIA(tache, prep.contexte, requete);
    const sortie = verifierSortie(tache, rep.json);
    const resultat = await prep.apres(sortie);
    await admin.from('ai_requests').insert({
      requester_id: ctx.uid, role, purpose: tache, provider: rep.fournisseur, model: rep.modele,
      input_summary: prep.resume, input_sent: rep.fournisseur === 'simulation' ? `[non envoyé : simulation]\n${requete.utilisateur}`.slice(0, 12000) : requete.utilisateur.slice(0, 12000),
      output: tache === 'indice' ? resultat : sortie,
      outcome: tache === 'generer_exercices' ? 'brouillon' : 'a_valider',
      tokens_in: rep.tokens_in, tokens_out: rep.tokens_out, duration_ms: Date.now() - t0, ...prep.liens,
    });
    return json(200, { resultat, fournisseur: rep.fournisseur, modele: rep.modele, simulation: rep.fournisseur === 'simulation' });
  } catch (e) {
    const err = e instanceof ErreurIA ? e : new ErreurIA('Erreur interne de l’assistant.', 500);
    if (!(e instanceof ErreurIA)) console.error(e);
    await admin.from('ai_requests').insert({
      requester_id: ctx.uid, role, purpose: tache, provider: fournisseurConfigure(), input_summary: prep?.resume ?? null,
      error: err.message, duration_ms: Date.now() - t0, ...(prep?.liens ?? {}),
    });
    return json(err.status, { error: err.message });
  }
}
