// Sauvegarde / restauration des fichiers du compartiment privé « audio »
// via l'API de stockage Supabase (clé service : réservé à l'administrateur).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const [, , mode, dossier] = process.argv;
const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: cle, Authorization: `Bearer ${cle}` };
const BUCKET = 'audio';

async function lister(prefixe = '') {
  const tout = [];
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${base}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefixe, limit: 100, offset }),
    });
    if (!r.ok) throw new Error(`Liste impossible (${r.status})`);
    const page = await r.json();
    for (const o of page) {
      const chemin = prefixe ? `${prefixe}/${o.name}` : o.name;
      if (o.id === null) tout.push(...(await lister(chemin)));   // sous-dossier
      else tout.push(chemin);
    }
    if (page.length < 100) return tout;
  }
}

async function parcourir(d) {
  const r = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) r.push(...(await parcourir(p))); else r.push(p);
  }
  return r;
}

if (mode === 'sauvegarder') {
  const chemins = await lister();
  for (const c of chemins) {
    const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${c}`, { headers: h });
    if (!r.ok) throw new Error(`Téléchargement impossible : ${c} (${r.status})`);
    const cible = join(dossier, c);
    await mkdir(dirname(cible), { recursive: true });
    await writeFile(cible, Buffer.from(await r.arrayBuffer()));
  }
  console.log(`   ${chemins.length} fichier(s) audio sauvegardé(s)`);
} else if (mode === 'restaurer') {
  const fichiers = await parcourir(dossier);
  for (const f of fichiers) {
    const c = relative(dossier, f).split('\\').join('/');
    const type = { webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav' }[c.split('.').pop()] ?? 'application/octet-stream';
    const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${c}`, {
      method: 'POST', headers: { ...h, 'Content-Type': type, 'x-upsert': 'true' }, body: await readFile(f),
    });
    if (!r.ok) throw new Error(`Envoi impossible : ${c} (${r.status})`);
  }
  console.log(`   ${fichiers.length} fichier(s) audio restauré(s)`);
} else {
  console.error('Usage : node fichiers.mjs sauvegarder|restaurer <dossier>');
  process.exit(1);
}
