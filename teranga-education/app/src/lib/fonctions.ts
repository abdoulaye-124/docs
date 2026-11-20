import { supabase } from './supabase';
import type { Role } from './types';

async function appeler<T>(corps: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: corps });
  if (error) {
    // Le message métier est dans le corps de la réponse.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const b = await ctx.json().catch(() => null);
      if (b?.error) throw new Error(b.error);
    }
    throw new Error(error.message);
  }
  return data as T;
}

export interface NouveauCompte {
  role: Role;
  first_name: string;
  last_name: string;
  password: string;
  email?: string;
  phone?: string;
  login?: string;
  student_id?: string;
}

export const creerCompte = (c: NouveauCompte) => appeler<{ id: string }>({ action: 'create', ...c });
export const reinitialiserMotDePasse = (user_id: string, password: string) =>
  appeler({ action: 'reset_password', user_id, password });
export const changerActivation = (user_id: string, active: boolean) =>
  appeler({ action: 'set_active', user_id, active });

/** Mot de passe provisoire lisible, à communiquer de vive voix ou sur papier. */
export function motDePasseProvisoire(): string {
  const lettres = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const tab = new Uint32Array(6);
  crypto.getRandomValues(tab);
  const l = Array.from(tab.slice(0, 4), (v) => lettres[v % lettres.length]).join('');
  const c = String(tab[4] % 90 + 10) + String(tab[5] % 90 + 10);
  return `Teranga-${l}-${c}`;
}
