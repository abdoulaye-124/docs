import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { verifier } from '../lib/requetes';
import { useSession } from '../lib/session';
import { lireFile, useEnLigne, viderFile } from '../lib/horsligne';

/** Bandeau « hors connexion » et envoi automatique des réponses gardées sur le téléphone. */
export default function Synchronisation() {
  const enLigne = useEnLigne();
  const { profil, roleActif } = useSession();
  const qc = useQueryClient();
  const [enAttente, setEnAttente] = useState(0);
  const uid = profil?.id;

  const synchroniser = useCallback(async () => {
    if (!uid) return;
    setEnAttente(lireFile(uid).length);
    if (!navigator.onLine || !lireFile(uid).length) return;
    const n = await viderFile(uid, async (e) => {
      verifier(await supabase.rpc('submit_answer', {
        p_exercise: e.exercise_id, p_answer: e.reponse, p_client_id: e.client_id, p_assessment: e.assessment_id,
      }));
    });
    setEnAttente(lireFile(uid).length);
    if (n) qc.invalidateQueries({ queryKey: ['travail-eleve'] });
  }, [uid, qc]);

  useEffect(() => { if (enLigne) synchroniser(); }, [enLigne, synchroniser]);
  useEffect(() => {
    // Nouvelles réponses mises en file pendant l'utilisation (vérification légère).
    const t = window.setInterval(() => uid && setEnAttente(lireFile(uid).length), 3000);
    return () => window.clearInterval(t);
  }, [uid]);

  if (enLigne && !enAttente) return null;
  return (
    <div role="status" data-testid="bandeau-reseau"
      className={`px-4 py-2 text-center text-sm font-medium ${enLigne ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900'}`}>
      {!enLigne
        ? `📴 Hors connexion${roleActif === 'eleve' ? ' : tu peux relire tes leçons et faire tes exercices déjà ouverts.' : ' : les informations affichées peuvent ne pas être à jour.'}`
        : '🔄 Envoi des réponses gardées sur le téléphone…'}
      {enAttente > 0 && <span className="ml-1">({enAttente} réponse(s) en attente d’envoi)</span>}
    </div>
  );
}
