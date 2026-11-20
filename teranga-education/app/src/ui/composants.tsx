import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primaire' | 'secondaire' | 'danger' | 'discret';

export function Bouton({
  variante = 'primaire', className, chargement, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chargement?: boolean }) {
  const styles: Record<Variante, string> = {
    primaire: 'bg-teranga-700 text-white hover:bg-teranga-800 disabled:bg-teranga-700/50',
    secondaire: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
    discret: 'text-teranga-800 hover:bg-teranga-50',
  };
  return (
    <button
      {...p}
      disabled={p.disabled || chargement}
      className={cx(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed',
        styles[variante], className,
      )}
    >
      {chargement && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

function Etiquette({ id, label, aide, requis }: { id: string; label: string; aide?: string; requis?: boolean }) {
  return (
    <>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}{requis && <span className="text-red-600"> *</span>}
      </label>
      {aide && <p className="text-xs text-slate-500">{aide}</p>}
    </>
  );
}

const champStyle = 'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-teranga-600 focus:ring-2 focus:ring-teranga-200';

export function Champ({ label, aide, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; aide?: string }) {
  const id = useId();
  return (
    <div>
      <Etiquette id={id} label={label} aide={aide} requis={p.required} />
      <input id={id} {...p} className={cx(champStyle, p.className)} />
    </div>
  );
}

export function Selection({ label, aide, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; aide?: string }) {
  const id = useId();
  return (
    <div>
      <Etiquette id={id} label={label} aide={aide} requis={p.required} />
      <select id={id} {...p} className={cx(champStyle, p.className)}>{children}</select>
    </div>
  );
}

export function ZoneTexte({ label, aide, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; aide?: string }) {
  const id = useId();
  return (
    <div>
      <Etiquette id={id} label={label} aide={aide} requis={p.required} />
      <textarea id={id} rows={3} {...p} className={cx(champStyle, 'py-2', p.className)} />
    </div>
  );
}

export function Case({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" {...p} className="mt-1 h-5 w-5 rounded border-slate-300 text-teranga-700" />
      <label htmlFor={id} className="text-sm text-slate-700">{label}</label>
    </div>
  );
}

export function Carte({ titre, actions, children, className }: { titre?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {(titre || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titre && <h2 className="text-base font-semibold text-slate-900">{titre}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EnTete({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-slate-600">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pastille({ children, ton = 'neutre' }: { children: ReactNode; ton?: 'neutre' | 'vert' | 'ambre' | 'rouge' | 'bleu' }) {
  const tons = {
    neutre: 'bg-slate-100 text-slate-700',
    vert: 'bg-teranga-100 text-teranga-800',
    ambre: 'bg-soleil-100 text-soleil-700',
    rouge: 'bg-red-100 text-red-800',
    bleu: 'bg-sky-100 text-sky-800',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tons[ton])}>{children}</span>;
}

export function Alerte({ children, ton = 'erreur' }: { children: ReactNode; ton?: 'erreur' | 'info' | 'succes' | 'attention' }) {
  const tons = {
    erreur: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    succes: 'border-teranga-200 bg-teranga-50 text-teranga-900',
    attention: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div role={ton === 'erreur' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', tons[ton])}>
      {children}
    </div>
  );
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teranga-600 border-t-transparent" aria-hidden />
      {texte}
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Statistique({ libelle, valeur, detail }: { libelle: string; valeur: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{libelle}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valeur}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

/** Tableau qui défile horizontalement dans son propre cadre sur téléphone. */
export function Tableau({ entetes, children }: { entetes: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {entetes.map((e) => (
              <th key={e} scope="col" className="whitespace-nowrap px-4 py-2 text-left font-semibold text-slate-700">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export function Cellule({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx('whitespace-nowrap px-4 py-2.5 align-middle', className)}>{children}</td>;
}

export function Modale({ titre, ouverte, fermer, children }: { titre: string; ouverte: boolean; fermer: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // L'événement « close » arrive APRÈS coup : s'il provient d'une fermeture
  // décidée par l'application, il ne doit pas refermer une fenêtre rouverte entre-temps.
  const fermetureVoulue = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) { fermetureVoulue.current = true; d.close(); }
  }, [ouverte]);
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (fermetureVoulue.current) { fermetureVoulue.current = false; return; }
        fermer();   // fermeture par l'utilisateur (touche Échap, bouton retour)
      }}
      aria-label={titre}
      className="w-[calc(100%-2rem)] max-w-lg rounded-xl p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-lg font-semibold">{titre}</h2>
        <button onClick={fermer} className="min-h-[44px] min-w-[44px] rounded-lg text-2xl text-slate-500 hover:bg-slate-100" aria-label="Fermer">×</button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{ouverte && children}</div>
    </dialog>
  );
}
