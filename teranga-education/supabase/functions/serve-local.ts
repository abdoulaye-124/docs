// PASSERELLE LOCALE DE DÉVELOPPEMENT (jamais déployée).
// Reproduit l'adresse unique d'un projet Supabase :
//   /auth/v1/*      → GoTrue    (localhost:9999)
//   /rest/v1/*      → PostgREST (localhost:3000)
//   /storage/v1/*   → Stockage  (localhost:5000)
//   /functions/v1/* → fonctions serveur de ce dossier
import { handler as adminUsers } from './admin-users/handler.ts';

const FONCTIONS: Record<string, (r: Request) => Promise<Response>> = {
  'admin-users': adminUsers,
};

const AMONT: Record<string, string> = {
  '/auth/v1': Deno.env.get('GOTRUE_URL') ?? 'http://localhost:9999',
  '/rest/v1': Deno.env.get('POSTGREST_URL') ?? 'http://localhost:3000',
  '/storage/v1': Deno.env.get('STORAGE_URL') ?? 'http://localhost:5000',
};

async function relayer(req: Request, cible: string): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete('host');
  const r = await fetch(cible, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
}

Deno.serve({ port: 54321, hostname: '127.0.0.1' }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/health') return new Response('ok');

  for (const [prefixe, amont] of Object.entries(AMONT)) {
    if (url.pathname.startsWith(prefixe)) {
      return relayer(req, amont + url.pathname.slice(prefixe.length) + url.search);
    }
  }
  const m = url.pathname.match(/^\/functions\/v1\/([\w-]+)/);
  if (m && FONCTIONS[m[1]]) return FONCTIONS[m[1]](req);
  return new Response('Introuvable', { status: 404 });
});
