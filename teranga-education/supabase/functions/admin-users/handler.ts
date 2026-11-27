// Fonction serveur « admin-users » : création et gestion des comptes.
//
// Pourquoi côté serveur ? Créer un compte exige la clé « service_role », qui
// ne doit JAMAIS se trouver dans le navigateur. Cette fonction :
//   1. vérifie que l'appelant est administrateur (avec SON jeton) ;
//   2. crée le compte d'authentification (avec la clé service_role) ;
//   3. enregistre le profil et le rôle AVEC LE JETON DE L'APPELANT, pour que
//      les règles RLS et le journal d'audit s'appliquent normalement ;
//   4. annule la création du compte si l'étape 3 échoue.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  identifiantValide,
  identifiantVersEmail,
  normaliserTelephoneSN,
  telephoneVersEmail,
} from '../_shared/identifiants.ts';

const ROLES = ['admin', 'coordinateur', 'encadreur', 'parent', 'eleve', 'relecteur_wolof'] as const;
type Role = (typeof ROLES)[number];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

class ErreurMetier extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function texte(v: unknown, champ: string, max = 80): string {
  if (typeof v !== 'string' || !v.trim()) throw new ErreurMetier(`Champ obligatoire : ${champ}`);
  const t = v.trim();
  if (t.length > max) throw new ErreurMetier(`Champ trop long : ${champ}`);
  return t;
}

function motDePasse(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8) {
    throw new ErreurMetier('Le mot de passe doit comporter au moins 8 caractères');
  }
  return v;
}

interface Contexte {
  appelantId: string;
  client: SupabaseClient;   // jeton de l'appelant : RLS appliquée
  admin: SupabaseClient;    // clé service_role : réservé à l'API d'authentification
}

async function creerCompte(ctx: Contexte, b: Record<string, unknown>) {
  const role = b.role as Role;
  if (!ROLES.includes(role)) throw new ErreurMetier('Rôle inconnu');
  const prenom = texte(b.first_name, 'prénom');
  const nom = texte(b.last_name, 'nom');
  const pwd = motDePasse(b.password);

  let email: string | undefined;
  let phone: string | undefined;
  let studentId: string | undefined;

  if (role === 'eleve') {
    const login = texte(b.login, 'identifiant élève', 24).toLowerCase();
    if (!identifiantValide(login)) {
      throw new ErreurMetier('Identifiant élève invalide (lettres minuscules, chiffres, points ; 3 à 24 caractères)');
    }
    email = identifiantVersEmail(login);
    studentId = texte(b.student_id, 'élève', 40);
    // L'élève doit exister, être visible par l'admin et ne pas déjà avoir de compte.
    const { data: el, error } = await ctx.client
      .from('students').select('id, profile_id').eq('id', studentId).maybeSingle();
    if (error || !el) throw new ErreurMetier('Élève introuvable');
    if (el.profile_id) throw new ErreurMetier('Cet élève a déjà un compte');
    // Consentement « compte élève » obligatoire (Phase 1, RG / consentements).
    const { data: cons } = await ctx.client
      .from('consents').select('id').eq('student_id', studentId)
      .eq('kind', 'compte_eleve').is('revoked_at', null).limit(1);
    if (!cons?.length) {
      throw new ErreurMetier('Consentement « compte élève » du responsable légal manquant');
    }
  } else {
    if (typeof b.phone === 'string' && b.phone.trim()) {
      const p = normaliserTelephoneSN(b.phone);
      if (!p) throw new ErreurMetier('Numéro de téléphone sénégalais invalide');
      phone = p;
    }
    if (typeof b.email === 'string' && b.email.trim()) {
      email = b.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErreurMetier('Adresse e-mail invalide');
    }
    if (role === 'parent' && !phone) throw new ErreurMetier('Le téléphone du parent est obligatoire');
    if (!phone && !email) throw new ErreurMetier('Indiquer un e-mail ou un téléphone');
    // Sans e-mail réel, on se connecte avec le numéro (identifiant technique, sans SMS).
    if (!email && phone) email = telephoneVersEmail(phone);
  }

  // Le téléphone n'est PAS donné au service d'authentification (cela exigerait des SMS) :
  // il est conservé dans le profil pour le contact.
  const { data: cree, error: errAuth } = await ctx.admin.auth.admin.createUser({
    email, password: pwd, email_confirm: true,
  });
  if (errAuth || !cree.user) {
    const deja = /already|registered|exists/i.test(errAuth?.message ?? '');
    throw new ErreurMetier(deja ? 'Un compte existe déjà avec cet identifiant' : `Création du compte impossible : ${errAuth?.message}`);
  }
  const id = cree.user.id;

  try {
    const r1 = await ctx.client.from('profiles').insert({ id, first_name: prenom, last_name: nom, phone: phone ?? null });
    if (r1.error) throw r1.error;
    const r2 = await ctx.client.from('user_roles').insert({ user_id: id, role, granted_by: ctx.appelantId });
    if (r2.error) throw r2.error;
    if (role === 'encadreur' || role === 'coordinateur') {
      const r3 = await ctx.client.from('staff_profiles').insert({ profile_id: id });
      if (r3.error) throw r3.error;
    }
    if (studentId) {
      const r4 = await ctx.client.from('students').update({ profile_id: id, login_id: email!.split('@')[0] })
        .eq('id', studentId).select('id');
      if (r4.error) throw r4.error;
      if (!r4.data?.length) throw new Error('Rattachement au dossier élève refusé');
    }
  } catch (e) {
    await ctx.admin.auth.admin.deleteUser(id);   // annulation : pas de compte orphelin
    throw new ErreurMetier(`Enregistrement du profil refusé : ${(e as Error).message}`);
  }
  return { id, role };
}

async function changerMotDePasse(ctx: Contexte, b: Record<string, unknown>) {
  const userId = texte(b.user_id, 'utilisateur', 40);
  const pwd = motDePasse(b.password);
  const { error } = await ctx.admin.auth.admin.updateUserById(userId, { password: pwd });
  if (error) throw new ErreurMetier(`Réinitialisation impossible : ${error.message}`);
  await ctx.admin.from('audit_log').insert({
    actor_id: ctx.appelantId, table_name: 'auth.users', row_pk: userId, action: 'RESET_PASSWORD',
  });
  return { ok: true };
}

async function changerActivation(ctx: Contexte, b: Record<string, unknown>) {
  const userId = texte(b.user_id, 'utilisateur', 40);
  const actif = b.active === true;
  if (userId === ctx.appelantId && !actif) throw new ErreurMetier('Impossible de désactiver son propre compte');
  const { error } = await ctx.admin.auth.admin.updateUserById(userId, {
    ban_duration: actif ? 'none' : '876000h',
  });
  if (error) throw new ErreurMetier(`Modification impossible : ${error.message}`);
  const r = await ctx.client.from('profiles').update({ is_active: actif }).eq('id', userId);
  if (r.error) throw new ErreurMetier(r.error.message);
  return { ok: true };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json(500, { error: 'Configuration serveur incomplète' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Connexion requise' });

  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: u, error: errU } = await client.auth.getUser(authorization.slice(7));
  if (errU || !u.user) return json(401, { error: 'Session invalide' });
  const { data: estAdmin } = await client.rpc('has_role', { r: 'admin' });
  if (estAdmin !== true) return json(403, { error: 'Réservé à l\'administrateur du centre' });

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return json(400, { error: 'Requête illisible' });
  }

  const ctx: Contexte = { appelantId: u.user.id, client, admin };
  try {
    switch (corps.action) {
      case 'create': return json(200, await creerCompte(ctx, corps));
      case 'reset_password': return json(200, await changerMotDePasse(ctx, corps));
      case 'set_active': return json(200, await changerActivation(ctx, corps));
      default: return json(400, { error: 'Action inconnue' });
    }
  } catch (e) {
    if (e instanceof ErreurMetier) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Erreur interne' });
  }
}
