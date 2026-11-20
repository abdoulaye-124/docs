import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSalles, verifier } from '../../lib/requetes';
import { messageErreur } from '../../lib/erreurs';
import { formatDate } from '../../lib/dates';
import { Alerte, Bouton, Carte, Champ, EnTete, Vide } from '../../ui/composants';

export default function Parametres() {
  const qc = useQueryClient();
  const salles = useSalles();
  const annees = useQuery({
    queryKey: ['annees'],
    queryFn: async () => verifier(await supabase.from('school_years').select('*').order('starts_on', { ascending: false })),
  });
  const [salle, setSalle] = useState({ name: '', capacity: '' });
  const [erreur, setErreur] = useState<string | null>(null);

  const ajout = useMutation({
    mutationFn: async () => verifier(await supabase.from('rooms').insert({ name: salle.name, capacity: salle.capacity ? Number(salle.capacity) : null })),
    onSuccess: () => { setSalle({ name: '', capacity: '' }); setErreur(null); qc.invalidateQueries({ queryKey: ['salles'] }); },
    onError: (e) => setErreur(messageErreur(e)),
  });
  function soumettre(e: FormEvent) { e.preventDefault(); ajout.mutate(); }

  return (
    <>
      <EnTete titre="Paramètres du centre" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Carte titre="Salles">
          {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}
          <form onSubmit={soumettre} className="mb-4 grid grid-cols-[1fr_100px_auto] items-end gap-2">
            <Champ label="Nom" value={salle.name} onChange={(e) => setSalle({ ...salle, name: e.target.value })} required />
            <Champ label="Places" type="number" min={1} value={salle.capacity} onChange={(e) => setSalle({ ...salle, capacity: e.target.value })} />
            <Bouton type="submit" chargement={ajout.isPending}>Ajouter</Bouton>
          </form>
          {!salles.data?.length ? <Vide>Aucune salle.</Vide> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {salles.data.map((r) => <li key={r.id} className="py-2">{r.name}{r.capacity ? ` · ${r.capacity} places` : ''}</li>)}
            </ul>
          )}
        </Carte>
        <Carte titre="Année scolaire">
          {!annees.data?.length ? <Vide>Aucune année scolaire.</Vide> : (
            <ul className="text-sm">
              {annees.data.map((a) => (
                <li key={a.id} className="py-1">{a.label} : du {formatDate(a.starts_on)} au {formatDate(a.ends_on)} {a.is_current && '(en cours)'}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Matières et référentiel : Phase 3, à partir des documents officiels authentifiés.</p>
        </Carte>
      </div>
    </>
  );
}
