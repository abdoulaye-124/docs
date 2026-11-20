import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { formatCreneau } from '../../lib/dates';
import { useSession } from '../../lib/session';

const TUILES = [
  { icone: '📖', libelle: 'Mes leçons', couleur: 'bg-sky-100 text-sky-900' },
  { icone: '✏️', libelle: 'Mes exercices', couleur: 'bg-soleil-100 text-soleil-700' },
  { icone: '⭐', libelle: 'Mes progrès', couleur: 'bg-teranga-100 text-teranga-900' },
  { icone: '🙋', libelle: "J'ai besoin d'aide", couleur: 'bg-rose-100 text-rose-900' },
];

/** Lit un court texte à voix haute (synthèse vocale du téléphone, en français). */
function lire(texte: string) {
  try {
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* synthèse vocale indisponible sur cet appareil */
  }
}

export default function AccueilEleve() {
  const { profil } = useSession();
  const prochaine = useQuery({
    queryKey: ['seances', 'eleve'],
    queryFn: async () =>
      verifier(
        await supabase.from('sessions').select('id, title, starts_at, ends_at')
          .gte('ends_at', new Date().toISOString()).neq('status', 'annulee').order('starts_at').limit(1),
      ),
  });
  const s = prochaine.data?.[0];
  const bonjour = `Bonjour ${profil?.first_name ?? ''} !`;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{bonjour} 👋</h1>
        <button onClick={() => lire(`${bonjour} Choisis ce que tu veux faire.`)} aria-label="Écouter" className="flex h-12 w-12 items-center justify-center rounded-full bg-teranga-700 text-2xl text-white">🔊</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {TUILES.map((t) => (
          <button
            key={t.libelle}
            onClick={() => lire(`${t.libelle}. Bientôt disponible.`)}
            className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl text-lg font-bold shadow-sm ${t.couleur}`}
          >
            <span aria-hidden className="text-5xl">{t.icone}</span>
            {t.libelle}
            <span className="text-xs font-medium opacity-70">Bientôt</span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Ma prochaine séance</p>
        <p className="text-lg font-semibold">{s ? s.title : 'Pas de séance prévue'}</p>
        {s && <p className="text-slate-600">{formatCreneau(s.starts_at, s.ends_at)}</p>}
      </div>
    </div>
  );
}
