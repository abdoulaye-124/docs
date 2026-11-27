// Crée le compte administrateur de DÉMONSTRATION dans la pile locale.
// Identifiants fictifs, à usage local uniquement.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runDir = process.env.TERANGA_RUN_DIR ?? join(here, '.run');
const env = Object.fromEntries(
  readFileSync(join(runDir, 'env'), 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)),
);

export const ADMIN_DEMO = { email: 'admin@demo.teranga.invalid', password: 'Admin-demo-2026' };

const base = env.SUPABASE_URL;
const h = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const r = await fetch(`${base}/auth/v1/admin/users`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ ...ADMIN_DEMO, email_confirm: true }),
});
const user = await r.json();
if (!r.ok) throw new Error(`Création admin : ${JSON.stringify(user)}`);

for (const [table, row] of [
  ['profiles', { id: user.id, first_name: 'Administrateur', last_name: 'DÉMO' }],
  ['user_roles', { user_id: user.id, role: 'admin' }],
  ['school_years', { label: '2026-2027', starts_on: '2026-10-01', ends_on: '2027-07-31', is_current: true }],
]) {
  const x = await fetch(`${base}/rest/v1/${table}`, { method: 'POST', headers: h, body: JSON.stringify(row) });
  if (!x.ok) throw new Error(`${table} : ${await x.text()}`);
}
console.log(`Admin de démonstration : ${ADMIN_DEMO.email} / ${ADMIN_DEMO.password}`);
