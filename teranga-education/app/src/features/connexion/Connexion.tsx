import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { messageErreur } from '../../lib/erreurs';
import {
  IMAGES_CODE, LONGUEUR_CODE_IMAGE, codeImageVersMotDePasse, identifiantValide,
  identifiantVersEmail, normaliserTelephoneSN,
} from '@shared/identifiants.ts';
import { Alerte, Bouton, Champ } from '../../ui/composants';

type Mode = 'personnel' | 'parent' | 'eleve';

const ONGLETS: { mode: Mode; libelle: string; icone: string }[] = [
  { mode: 'eleve', libelle: 'Élève', icone: '🎒' },
  { mode: 'parent', libelle: 'Parent', icone: '👪' },
  { mode: 'personnel', libelle: 'Personnel', icone: '🧑‍🏫' },
];

export default function Connexion() {
  const [mode, setMode] = useState<Mode>('parent');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function connecter(identifiants: { email: string; password: string } | { phone: string; password: string }) {
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword(identifiants);
    setEnvoi(false);
    if (error) setErreur(messageErreur(error));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teranga-800 to-teranga-900 px-4 py-10">
      <div className="mb-6 flex items-center gap-3 text-white">
        <img src="/icone.svg" alt="" className="h-14 w-14" />
        <div>
          <p className="text-2xl font-bold tracking-wide">TERANGA ÉDUCATION</p>
          <p className="text-sm text-teranga-100">Accompagnement et réussite scolaire, du CI au CM2</p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div role="tablist" aria-label="Type de compte" className="mb-5 grid grid-cols-3 gap-2">
          {ONGLETS.map((o) => (
            <button
              key={o.mode}
              role="tab"
              aria-selected={mode === o.mode}
              onClick={() => { setMode(o.mode); setErreur(null); }}
              className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border text-sm font-semibold ${mode === o.mode ? 'border-teranga-600 bg-teranga-50 text-teranga-900' : 'border-slate-200 text-slate-600'}`}
            >
              <span aria-hidden className="text-2xl">{o.icone}</span>{o.libelle}
            </button>
          ))}
        </div>

        {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

        {mode === 'personnel' && <FormPersonnel envoi={envoi} onConnecter={connecter} />}
        {mode === 'parent' && <FormParent envoi={envoi} onConnecter={connecter} onErreur={setErreur} />}
        {mode === 'eleve' && <FormEleve envoi={envoi} onConnecter={connecter} onErreur={setErreur} />}
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-teranga-100">
        Comptes créés par le centre uniquement. En cas d'oubli, adressez-vous à l'accueil du centre.
      </p>
    </div>
  );
}

type Connecter = (i: { email: string; password: string } | { phone: string; password: string }) => void;

function FormPersonnel({ envoi, onConnecter }: { envoi: boolean; onConnecter: Connecter }) {
  const [id, setId] = useState('');
  const [mdp, setMdp] = useState('');
  function soumettre(e: FormEvent) {
    e.preventDefault();
    const tel = normaliserTelephoneSN(id);
    onConnecter(tel ? { phone: tel, password: mdp } : { email: id.trim().toLowerCase(), password: mdp });
  }
  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Champ label="E-mail ou téléphone" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required />
      <Champ label="Mot de passe" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
      <Bouton type="submit" chargement={envoi} className="w-full">Se connecter</Bouton>
    </form>
  );
}

function FormParent({ envoi, onConnecter, onErreur }: { envoi: boolean; onConnecter: Connecter; onErreur: (m: string) => void }) {
  const [tel, setTel] = useState('');
  const [mdp, setMdp] = useState('');
  function soumettre(e: FormEvent) {
    e.preventDefault();
    const n = normaliserTelephoneSN(tel);
    if (!n) return onErreur('Numéro de téléphone invalide. Exemple : 77 123 45 67');
    onConnecter({ phone: n, password: mdp });
  }
  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Champ label="Numéro de téléphone" type="tel" inputMode="tel" placeholder="77 123 45 67" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel" required />
      <Champ label="Mot de passe" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
      <Bouton type="submit" chargement={envoi} className="w-full">Se connecter</Bouton>
    </form>
  );
}

function FormEleve({ envoi, onConnecter, onErreur }: { envoi: boolean; onConnecter: Connecter; onErreur: (m: string) => void }) {
  const [id, setId] = useState('');
  const [code, setCode] = useState<number[]>([]);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const propre = id.trim().toLowerCase();
    if (!identifiantValide(propre)) return onErreur('Identifiant inconnu. Demande-le à ton encadreur.');
    if (code.length !== LONGUEUR_CODE_IMAGE) return onErreur('Choisis tes 4 images.');
    onConnecter({ email: identifiantVersEmail(propre), password: codeImageVersMotDePasse(propre, code) });
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Champ label="Mon identifiant" value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="none" autoComplete="username" placeholder="ex. awa.47" required />
      <div>
        <p className="text-sm font-medium text-slate-700">Mon code secret : 4 images</p>
        <div className="my-2 flex min-h-[56px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3" aria-live="polite" aria-label={`${code.length} image(s) choisie(s) sur 4`}>
          {Array.from({ length: LONGUEUR_CODE_IMAGE }, (_, i) => (
            <span key={i} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-2xl shadow-sm">
              {code[i] !== undefined ? IMAGES_CODE[code[i]].emoji : '·'}
            </span>
          ))}
          {code.length > 0 && (
            <button type="button" onClick={() => setCode(code.slice(0, -1))} className="ml-auto min-h-[44px] rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-200" aria-label="Effacer la dernière image">⌫</button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {IMAGES_CODE.map((img) => (
            <button
              key={img.id}
              type="button"
              aria-label={img.nom}
              disabled={code.length >= LONGUEUR_CODE_IMAGE}
              onClick={() => setCode([...code, img.id])}
              className="flex aspect-square items-center justify-center rounded-xl border border-slate-200 text-3xl hover:bg-teranga-50 disabled:opacity-40"
            >
              {img.emoji}
            </button>
          ))}
        </div>
      </div>
      <Bouton type="submit" chargement={envoi} className="w-full">Entrer</Bouton>
    </form>
  );
}
