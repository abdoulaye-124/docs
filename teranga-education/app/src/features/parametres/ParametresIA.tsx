import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { assistant } from '../../lib/ia';
import { messageErreur } from '../../lib/erreurs';
import { LIBELLES_ROLES, type Role } from '../../lib/types';
import { Alerte, Bouton, Carte, Case, Champ, Pastille, Tableau, Cellule } from '../../ui/composants';

interface ReglagesIA { active: boolean; quota_jour: Partial<Record<Role, number>>; indices_par_exercice: number }
const ROLES: Role[] = ['encadreur', 'coordinateur', 'admin', 'relecteur_wolof', 'eleve', 'parent'];
const LIBELLES_TACHES: Record<string, string> = {
  generer_exercices: 'Exercices proposés', plan_lecon: 'Plans de leçon', analyse_eleve: 'Analyses de résultats',
  brouillon_bilan: 'Brouillons de bilan', proposer_wolof: 'Propositions en wolof', indice: 'Indices aux élèves', conseils_parent: 'Conseils aux parents',
};

export default function ParametresIA() {
  const { roleActif } = useSession();
  const qc = useQueryClient();
  const admin = roleActif === 'admin';
  const etat = useQuery({ queryKey: ['ia-etat'], queryFn: async () => (await assistant<never>('etat')) as unknown as { fournisseur: string; modele: string; active: boolean } });
  const reglages = useQuery({
    queryKey: ['ia-reglages'],
    queryFn: async () => (verifier(await supabase.from('app_settings').select('value').eq('key', 'ia').single()) as { value: ReglagesIA }).value,
  });
  const usage = useQuery({
    queryKey: ['ia-usage'],
    queryFn: async () => verifier(await supabase.from('ai_requests').select('purpose, tokens_in, tokens_out, error, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()).limit(5000)) as
      { purpose: string; tokens_in: number | null; tokens_out: number | null; error: string | null; created_at: string }[],
  });
  const [f, setF] = useState<ReglagesIA | null>(null);
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(null);
  useEffect(() => { if (reglages.data) setF(reglages.data); }, [reglages.data]);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('app_settings').update({ value: f }).eq('key', 'ia').select('key')),
    onSuccess: () => { setMessage({ ton: 'succes', texte: 'Réglages de l’assistant enregistrés.' }); qc.invalidateQueries({ queryKey: ['ia-reglages'] }); },
    onError: (e) => setMessage({ ton: 'erreur', texte: messageErreur(e) }),
  });

  const lignes = usage.data ?? [];
  const parTache = Object.entries(lignes.reduce<Record<string, { n: number; erreurs: number; tin: number; tout: number }>>((acc, l) => {
    const a = (acc[l.purpose] ??= { n: 0, erreurs: 0, tin: 0, tout: 0 });
    if (l.error) a.erreurs++; else a.n++;
    a.tin += l.tokens_in ?? 0; a.tout += l.tokens_out ?? 0;
    return acc;
  }, {}));

  return (
    <Carte titre="Assistant IA" className="lg:col-span-2">
      {message && <div className="mb-3"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        Fournisseur : <strong>{etat.data?.fournisseur === 'anthropic' ? 'Anthropic (Claude)' : 'simulation'}</strong>
        {etat.data?.fournisseur === 'simulation' && <Pastille ton="ambre">aucune IA réelle : réponses fictives de test</Pastille>}
        {etat.data?.fournisseur === 'anthropic' && <span>· modèle <code>{etat.data.modele}</code></span>}
      </p>
      {f && (
        <fieldset disabled={!admin} className="space-y-3">
          <Case label="Assistant activé pour le centre" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <p className="text-sm font-medium text-slate-700">Nombre de demandes par jour et par personne</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ROLES.map((r) => (
              <Champ key={r} label={LIBELLES_ROLES[r]} type="number" min={0} max={500} value={String(f.quota_jour[r] ?? 0)}
                onChange={(e) => setF({ ...f, quota_jour: { ...f.quota_jour, [r]: Math.max(0, Number(e.target.value) || 0) } })} />
            ))}
            <Champ label="Indices par exercice" type="number" min={0} max={5} value={String(f.indices_par_exercice)}
              onChange={(e) => setF({ ...f, indices_par_exercice: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
          {admin && <Bouton chargement={m.isPending} onClick={() => m.mutate()}>Enregistrer</Bouton>}
        </fieldset>
      )}
      <p className="mb-2 mt-5 text-sm font-medium text-slate-700">Utilisation sur 30 jours</p>
      {!parTache.length ? <p className="text-sm text-slate-500">Aucune demande.</p> : (
        <Tableau entetes={['Usage', 'Demandes', 'Échecs', 'Jetons envoyés', 'Jetons reçus']}>
          {parTache.map(([t, a]) => (
            <tr key={t}><Cellule>{LIBELLES_TACHES[t] ?? t}</Cellule><Cellule>{a.n}</Cellule><Cellule>{a.erreurs}</Cellule><Cellule>{a.tin}</Cellule><Cellule>{a.tout}</Cellule></tr>
          ))}
        </Tableau>
      )}
      <p className="mt-3 text-xs text-slate-500">Aucune donnée nominative n’est envoyée au fournisseur. La clé d’accès reste sur le serveur.</p>
    </Carte>
  );
}
