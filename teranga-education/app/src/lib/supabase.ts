import { createClient } from '@supabase/supabase-js';

// En local, l'URL est vide : on passe par le relais de Vite (même origine).
// En production : l'URL du projet Supabase. Seule la clé PUBLIQUE « anon » est
// présente dans le navigateur ; les droits réels sont contrôlés par la base (RLS).
const url = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!anonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY manquant (voir dev/local-stack.sh)');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'teranga-session' },
});
