import { supabase } from './supabase';

export interface ReponseAssistant<T> { resultat: T; fournisseur: string; modele: string; simulation: boolean }

/** Appelle l'assistant (fonction serveur). La clé du fournisseur d'IA ne quitte jamais le serveur. */
export async function assistant<T>(action: string, corps: Record<string, unknown> = {}): Promise<ReponseAssistant<T>> {
  const { data, error } = await supabase.functions.invoke('assistant-ia', { body: { action, ...corps } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const b = await ctx.json().catch(() => null);
      if (b?.error) throw new Error(b.error);
    }
    throw new Error('Assistant indisponible pour le moment.');
  }
  return data as ReponseAssistant<T>;
}
