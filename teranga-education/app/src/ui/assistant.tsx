import type { ReactNode } from 'react';
import { Pastille } from './composants';
import { useAssistantDisponible } from '../lib/ia';

/** Cadre commun à toute proposition de l'assistant : origine visible, rappel que l'humain décide. */
export function PropositionIA({ simulation, titre = 'Proposition de l’assistant', children }: { simulation?: boolean; titre?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm" data-testid="proposition-ia">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-violet-900">
        ✨ {titre}
        {simulation && <Pastille ton="ambre">mode simulation : aucune IA réelle</Pastille>}
      </p>
      {children}
      <p className="mt-3 text-xs text-violet-800">Proposition automatique, à vérifier. Aucune décision n’est prise par l’assistant.</p>
    </div>
  );
}

export function BoutonIA({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { chargement?: boolean }) {
  const { chargement, ...reste } = p;
  const disponible = useAssistantDisponible();
  if (!disponible) return null;   // pas d'IA configurée (ou désactivée) : aucun bouton
  return (
    <button {...reste} disabled={reste.disabled || chargement}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-60 ${reste.className ?? ''}`}>
      {chargement ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <span aria-hidden>✨</span>}
      {children}
    </button>
  );
}
