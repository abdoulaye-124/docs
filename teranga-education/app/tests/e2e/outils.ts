// Préparation rapide de données FICTIVES par l'API (pile locale uniquement),
// pour que chaque scénario démarre d'un centre déjà organisé.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

const env = Object.fromEntries(
  readFileSync(fileURLToPath(new URL('../../../dev/.run/env', import.meta.url)), 'utf8')
    .trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const G = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;

export const ADMIN = { id: 'admin@demo.teranga.invalid', mdp: 'Admin-demo-2026' };
export const NOMS_IMAGES = ['mangue', 'poisson', 'ballon', 'arbre', 'chèvre', 'soleil', 'lune', 'car', 'maison', 'coq', 'tam-tam', 'étoile'];

async function jeton(identifiants: Record<string, string>) {
  const r = await fetch(`${G}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(identifiants),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Connexion API : ${JSON.stringify(j)}`);
  return j.access_token as string;
}

class Api {
  constructor(private t: string) {}
  private h(extra: Record<string, string> = {}) {
    return { apikey: ANON, Authorization: `Bearer ${this.t}`, 'Content-Type': 'application/json', ...extra };
  }
  async inserer<T = { id: string }>(table: string, ligne: object): Promise<T> {
    const r = await fetch(`${G}/rest/v1/${table}`, { method: 'POST', headers: this.h({ Prefer: 'return=representation' }), body: JSON.stringify(ligne) });
    const j = await r.json();
    if (!r.ok) throw new Error(`${table} : ${JSON.stringify(j)}`);
    return (Array.isArray(j) ? j[0] : j) as T;
  }
  async compte(c: Record<string, unknown>): Promise<string> {
    const r = await fetch(`${G}/functions/v1/admin-users`, { method: 'POST', headers: this.h(), body: JSON.stringify({ action: 'create', ...c }) });
    const j = await r.json();
    if (!r.ok) throw new Error(`Compte : ${JSON.stringify(j)}`);
    return j.id;
  }
}

/** Centre minimal : encadreur, 2 parents, 1 élève CE2 avec compte, groupe CE2. */
export async function preparerCentre(suffixe: string, n: number) {
  const adminId = (await (await fetch(`${G}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${await jeton({ email: ADMIN.id, password: ADMIN.mdp })}` } })).json()).id;
  const api = new Api(await jeton({ email: ADMIN.id, password: ADMIN.mdp }));
  const c = {
    encadreur: { tel: `76 000 10 0${n}`, mdp: `Encadreur-${suffixe}-2026`, prenom: 'Fatou' },
    parent: { tel: `76 000 20 0${n}`, mdp: `Parent-${suffixe}-2026`, prenom: 'Mariama' },
    autreParent: { tel: `76 000 30 0${n}`, mdp: `Autre-${suffixe}-2026` },
    eleve: { login: `moussa.${suffixe.toLowerCase()}`, code: [3, 7, 0, 11], prenom: 'Moussa', nom: `ELEVE3-${suffixe}` },
    groupe: `CE2 Phase 3 ${suffixe}`,
  };
  const enc = await api.compte({ role: 'encadreur', first_name: c.encadreur.prenom, last_name: `ENC3-${suffixe}`, phone: c.encadreur.tel, password: c.encadreur.mdp });
  const par = await api.compte({ role: 'parent', first_name: c.parent.prenom, last_name: `PAR3-${suffixe}`, phone: c.parent.tel, password: c.parent.mdp });
  await api.compte({ role: 'parent', first_name: 'Autre', last_name: `PAR3B-${suffixe}`, phone: c.autreParent.tel, password: c.autreParent.mdp });
  const el = await api.inserer('students', { first_name: c.eleve.prenom, last_name: c.eleve.nom, birth_date: '2017-05-02', level_code: 'CE2', referent_staff_id: enc });
  await api.inserer('student_guardians', { student_id: el.id, guardian_id: par, relationship: 'mère', validated_by: adminId, validated_at: new Date().toISOString() });
  for (const kind of ['inscription', 'compte_eleve']) {
    await api.inserer('consents', { student_id: el.id, guardian_id: par, kind, text_version: 'v0-prototype', recorded_by: adminId });
  }
  await api.compte({ role: 'eleve', first_name: c.eleve.prenom, last_name: c.eleve.nom, login: c.eleve.login, student_id: el.id,
    password: `img-${c.eleve.code.join('-')}-${c.eleve.login}` });
  const g = await api.inserer('groups', { name: c.groupe, kind: 'principal', level_code: 'CE2' });
  await api.inserer('group_members', { group_id: g.id, student_id: el.id });
  await api.inserer('group_staff', { group_id: g.id, staff_id: enc });
  return { ...c, eleveId: el.id };
}

export async function connexion(page: Page, onglet: 'Personnel' | 'Parent', identifiant: string, mdp: string) {
  await page.goto('/connexion');
  await page.getByRole('tab', { name: onglet }).click();
  await page.getByLabel(onglet === 'Parent' ? 'Numéro de téléphone' : 'E-mail ou téléphone').fill(identifiant);
  await page.getByLabel('Mot de passe').fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/connexion/);
}

export async function connexionEleve(page: Page, login: string, code: number[]) {
  await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Élève' }).click();
  await page.getByLabel('Mon identifiant').fill(login);
  for (const i of code) await page.getByRole('button', { name: NOMS_IMAGES[i], exact: true }).click();
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page).toHaveURL(/\/eleve$/);
}

export async function deconnexion(page: Page) {
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByRole('tab', { name: 'Parent' })).toBeVisible();
}
