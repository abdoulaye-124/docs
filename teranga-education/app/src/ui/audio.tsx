import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cheminAudio, choisirFormat, DUREE_MAX_S, formatDuree, typeDeBase, verifierFichierAudio } from '../lib/audio-regles';
import { Alerte, Bouton } from './composants';

export interface AudioPret { blob: Blob; mime: string; duree: number | null }

/** Enregistrement au micro (téléphone ou PC) ou dépôt d'un fichier existant. */
export function EnregistreurAudio({ onPret, libelle = 'Enregistrer' }: { onPret: (a: AudioPret | null) => void; libelle?: string }) {
  const [etat, setEtat] = useState<'repos' | 'enregistrement' | 'pret'>('repos');
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const minuterie = useRef<number | null>(null);

  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);
  useEffect(() => () => { if (minuterie.current) window.clearInterval(minuterie.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  function pret(blob: Blob, mime: string, duree: number | null) {
    const err = verifierFichierAudio({ size: blob.size, type: mime });
    if (err) { setErreur(err); onPret(null); return; }
    setApercu(URL.createObjectURL(blob));
    setEtat('pret');
    onPret({ blob, mime: typeDeBase(mime), duree });
  }

  async function demarrer() {
    setErreur(null);
    const format = typeof MediaRecorder !== 'undefined' ? choisirFormat((m) => MediaRecorder.isTypeSupported(m)) : null;
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setErreur('Enregistrement impossible sur cet appareil : déposez plutôt un fichier audio.');
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(flux, { mimeType: format.mime, audioBitsPerSecond: 24_000 });
      morceaux.current = [];
      r.ondataavailable = (e) => { if (e.data.size) morceaux.current.push(e.data); };
      const debut = Date.now();
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        if (minuterie.current) window.clearInterval(minuterie.current);
        pret(new Blob(morceaux.current, { type: format.mime }), format.mime, (Date.now() - debut) / 1000);
      };
      r.start(250);
      rec.current = r;
      setSecondes(0);
      minuterie.current = window.setInterval(() => {
        setSecondes((s) => {
          if (s + 1 >= DUREE_MAX_S) r.state === 'recording' && r.stop();
          return s + 1;
        });
      }, 1000);
      setEtat('enregistrement');
    } catch {
      setErreur('Accès au micro refusé. Autorisez le micro dans le navigateur, ou déposez un fichier.');
    }
  }

  function arreter() { if (rec.current?.state === 'recording') rec.current.stop(); }
  function recommencer() { setEtat('repos'); setApercu(null); onPret(null); }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      {erreur && <Alerte>{erreur}</Alerte>}
      {etat === 'repos' && (
        <div className="flex flex-wrap items-center gap-2">
          <Bouton type="button" variante="secondaire" onClick={demarrer}>🎙️ {libelle}</Bouton>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-teranga-800 hover:bg-teranga-50">
            📁 Déposer un fichier
            <input type="file" accept="audio/*" className="sr-only" aria-label="Fichier audio"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pret(f, f.type || 'audio/mpeg', null); }} />
          </label>
        </div>
      )}
      {etat === 'enregistrement' && (
        <div className="flex items-center gap-3" role="status">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" aria-hidden />
          <span className="tabular-nums">Enregistrement… {formatDuree(secondes)} / {formatDuree(DUREE_MAX_S)}</span>
          <Bouton type="button" variante="danger" onClick={arreter}>⏹ Arrêter</Bouton>
        </div>
      )}
      {etat === 'pret' && apercu && (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls src={apercu} className="max-w-full" data-testid="apercu-audio" />
          <Bouton type="button" variante="discret" onClick={recommencer}>Recommencer</Bouton>
        </div>
      )}
    </div>
  );
}

/** Dépose l'audio dans le stockage privé et renvoie son chemin. */
export async function deposerAudio(auteurId: string, a: AudioPret): Promise<string> {
  const chemin = cheminAudio(auteurId, crypto.randomUUID(), a.mime);
  const { error } = await supabase.storage.from('audio').upload(chemin, a.blob, { contentType: a.mime, upsert: false });
  if (error) throw error;
  return chemin;
}

/** Lecteur à la demande : le fichier n'est téléchargé que si l'on appuie sur Écouter
 *  (économie de forfait), via un lien temporaire de 10 minutes. */
export function LecteurAudio({ chemin, libelle = 'Écouter', grand = false }: { chemin: string; libelle?: string; grand?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);

  async function ecouter() {
    if (url) { ref.current?.play().catch(() => undefined); return; }
    const { data, error } = await supabase.storage.from('audio').createSignedUrl(chemin, 600);
    if (error || !data) { setErreur(true); return; }
    setUrl(data.signedUrl);
  }
  useEffect(() => { if (url) ref.current?.play().catch(() => undefined); }, [url]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={ecouter}
        className={`inline-flex items-center gap-2 rounded-full bg-teranga-700 font-semibold text-white ${grand ? 'min-h-[56px] px-5 text-lg' : 'min-h-[44px] px-4 text-sm'}`}>
        🔊 {libelle}
      </button>
      {url && <audio ref={ref} src={url} controls preload="auto" className="max-w-full" data-testid="lecteur-audio" />}
      {erreur && <span className="text-sm text-red-700">Audio indisponible.</span>}
    </span>
  );
}
