import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface ReponseAssistant<T> { resultat: T; fournisseur: string; modele: string; simulation: boolean }

export interface EtatAssistant { fournisseur: 'anthropic' | 'simulation' | 'aucun'; modele: string; active: boolean; utilise_aujourdhui: number }

/** L'assistant est-il utilisable ? Sinon, ses boutons ne sont pas affichés. */
export function useEtatAssistant() {
  return useQuery({
    queryKey: ['ia-etat'],
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('assistant-ia', { body: { action: 'etat' } });
      if (error) return { fournisseur: 'aucun', modele: '', active: false, utilise_aujourdhui: 0 } as EtatAssistant;
      return data as EtatAssistant;
    },
  });
}

export function useAssistantDisponible(): boolean {
  const e = useEtatAssistant();
  return !!e.data && e.data.active && e.data.fournisseur !== 'aucun';
}

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
