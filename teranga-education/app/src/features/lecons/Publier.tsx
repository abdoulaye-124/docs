import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { estActif, useEleves, useGroupes, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui } from '../../lib/dates';
import { nomComplet } from '../../lib/types';
import { Alerte, Bouton, Champ, Selection, ZoneTexte } from '../../ui/composants';

/** Publication d'une leçon, d'une évaluation ou d'un exercice vers un groupe ou un élève. */
export default function Publier({ cible, onFait }: {
  cible: { lesson_id?: string; assessment_id?: string; exercise_id?: string };
  onFait: () => void;
}) {
  const { roleActif, profil } = useSession();
  const qc = useQueryClient();
  const groupes = useGroupes();
  const eleves = useEleves();   // RLS : encadreur = ses élèves
  const jour = aujourdhui();
  const direction = roleActif === 'admin' || roleActif === 'coordinateur';
  const mesGroupes = (groupes.data ?? []).filter((g) => g.is_active &&
    (direction || g.group_staff.some((a) => a.staff_id === profil?.id && estActif(a, jour))));

  const [vers, setVers] = useState<'groupe' | 'eleve'>('groupe');
  const [id, setId] = useState('');
  const [echeance, setEcheance] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('publications').insert({
      ...cible,
      group_id: vers === 'groupe' ? id : null,
      student_id: vers === 'eleve' ? id : null,
      published_by: profil!.id,
      due_at: echeance ? new Date(`${echeance}T23:59`).toISOString() : null,
      message: message || null,
    })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['publications'] }); onFait(); },
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <Selection label="Publier vers" value={vers} onChange={(e) => { setVers(e.target.value as 'groupe' | 'eleve'); setId(''); }}>
        <option value="groupe">Un groupe</option>
        <option value="eleve">Un élève</option>
      </Selection>
      {vers === 'groupe' ? (
        <Selection label="Groupe" value={id} onChange={(e) => setId(e.target.value)} required>
          <option value="">— Choisir —</option>
          {mesGroupes.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Selection>
      ) : (
        <Selection label="Élève" value={id} onChange={(e) => setId(e.target.value)} required>
          <option value="">— Choisir —</option>
          {(eleves.data ?? []).filter((e) => e.is_active).map((e) => <option key={e.id} value={e.id}>{nomComplet(e)} ({e.level_code})</option>)}
        </Selection>
      )}
      <Champ label="À faire pour le (facultatif)" type="date" min={jour} value={echeance} onChange={(e) => setEcheance(e.target.value)} />
      <ZoneTexte label="Message aux élèves (facultatif)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
      <p className="text-xs text-slate-500">Les élèves et leurs parents reçoivent une notification.</p>
      <Bouton type="submit" chargement={m.isPending}>Publier</Bouton>
    </form>
  );
}
