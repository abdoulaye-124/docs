import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useProfils, verifier } from '../../lib/requetes';
import { useSession } from '../../lib/session';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui, formatDate } from '../../lib/dates';
import { libelleObjectif, useReferentiel } from '../../lib/pedagogie';
import {
  LIBELLES_MAITRISE, comparaison, progressionParObjectif,
  type EnregistrementMaitrise, type Maitrise, type ProgressionObjectif,
} from '../../lib/suivi-regles';
import { nomComplet, type Eleve } from '../../lib/types';
import { Alerte, Bouton, Carte, Case, Champ, Chargement, EnTete, Modale, Pastille, Selection, Statistique, Vide, ZoneTexte } from '../../ui/composants';
import { AvantApres, Frise, PastilleMaitrise, STATUTS_PLAN, type Bilan, type Plan } from './communs';
import { AnalyseIA, ConseilsParentIA } from '../ia/ComposantsIA';
import { assistant } from '../../lib/ia';
import { BoutonIA, PropositionIA } from '../../ui/assistant';

const EVOLUTION = { progres: { t: '↗ progrès', ton: 'vert' }, stable: { t: '→ stable', ton: 'neutre' }, recul: { t: '↘ recul', ton: 'rouge' } } as const;

export default function DossierPedagogique() {
  const { id = '' } = useParams();
  const { roleActif } = useSession();
  const qc = useQueryClient();
  const famille = roleActif === 'parent';
  const personnel = !famille;
  const ref = useReferentiel();
  const profils = useProfils();

  const donnees = useQuery({
    queryKey: ['dossier', id],
    queryFn: async () => {
      const [el, m, obs, plans, bilans, pres] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).maybeSingle(),
        supabase.from('mastery_records').select('node_id, level, source, score_pct, recorded_at, seq, justification').eq('student_id', id).order('seq'),
        supabase.from('observations').select('id, body, visible_to_parents, created_at, author_id').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('remediation_plans').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('reports').select('*').eq('student_id', id).order('period_end', { ascending: false }),
        supabase.from('attendance').select('status').eq('student_id', id),
      ]);
      return {
        eleve: verifier(el) as Eleve | null,
        maitrise: verifier(m) as EnregistrementMaitrise[],
        observations: verifier(obs) as { id: string; body: string; visible_to_parents: boolean; created_at: string; author_id: string }[],
        plans: verifier(plans) as Plan[],
        bilans: verifier(bilans) as Bilan[],
        presences: verifier(pres) as { status: string }[],
      };
    },
  });
  const [modale, setModale] = useState<null | { type: 'ajuster'; p: ProgressionObjectif } | { type: 'observation' } | { type: 'bilan'; b?: Bilan }>(null);
  const rafraichir = () => { setModale(null); qc.invalidateQueries({ queryKey: ['dossier', id] }); };

  if (donnees.isLoading || ref.isLoading) return <Chargement />;
  if (donnees.error) return <Alerte>{messageErreur(donnees.error)}</Alerte>;
  const d = donnees.data!;
  if (!d.eleve) return <Alerte>Dossier introuvable ou non accessible avec votre compte.</Alerte>;
  const noeud = (nid: string) => ref.data?.noeuds.find((n) => n.id === nid);
  const prog = progressionParObjectif(d.maitrise);
  const comp = comparaison(prog);
  const presents = d.presences.filter((p) => p.status === 'present' || p.status === 'retard').length;
  const retour = famille ? `/parent/enfant/${id}` : `/eleves/${id}`;

  return (
    <>
      <EnTete titre={`Dossier pédagogique · ${nomComplet(d.eleve)}`}
        sousTitre={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{d.eleve.code}</span><Pastille ton="vert">{d.eleve.level_code}</Pastille>
          <Link to={retour} className="font-semibold text-teranga-800">← Fiche</Link></span>}
        actions={personnel && <>
          <Bouton variante="secondaire" onClick={() => setModale({ type: 'observation' })}>+ Observation</Bouton>
          <Bouton onClick={() => setModale({ type: 'bilan' })}>+ Bilan</Bouton>
        </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Statistique libelle="Compétences acquises" valeur={`${comp.recent.acquis} / ${comp.recent.total}`} detail={`au départ : ${comp.initial.acquis} / ${comp.initial.total}`} />
        <Statistique libelle="En cours d’acquisition" valeur={comp.recent.en_cours} detail={`au départ : ${comp.initial.en_cours}`} />
        <Statistique libelle="Non acquises" valeur={comp.recent.non_acquis} detail={`au départ : ${comp.initial.non_acquis}`} />
        <Statistique libelle="Présences" valeur={d.presences.length ? `${presents} / ${d.presences.length}` : '—'} />
      </div>

      <Carte titre="Tableau de progression" className="mt-5">
        {!prog.length ? <Vide>Aucune compétence évaluée pour l’instant. Le tableau se remplit à chaque correction.</Vide> : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>{['Objectif', 'Niveau initial', 'Évolution', 'Niveau récent', 'Tendance', ...(personnel ? [''] : [])].map((t) =>
                  <th key={t} className="whitespace-nowrap px-4 py-2 font-semibold">{t}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prog.map((p) => {
                  const n = noeud(p.node_id);
                  const planOuvert = d.plans.some((x) => x.target_node_id === p.node_id && ['proposee', 'validee', 'en_cours'].includes(x.status));
                  return (
                    <tr key={p.node_id} data-testid="ligne-progression">
                      <td className="px-4 py-2.5">{n ? libelleObjectif(n) : '—'} {n?.is_provisional && <Pastille ton="ambre">provisoire</Pastille>}</td>
                      <td className="whitespace-nowrap px-4 py-2.5"><PastilleMaitrise n={p.initial.level} /></td>
                      <td className="px-4 py-2.5"><Frise h={p.historique} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5"><PastilleMaitrise n={p.recent.level} />{p.recent.score_pct !== null && <span className="ml-1 text-slate-500">{Math.round(p.recent.score_pct)} %</span>}</td>
                      <td className="whitespace-nowrap px-4 py-2.5"><Pastille ton={EVOLUTION[p.evolution].ton}>{EVOLUTION[p.evolution].t}</Pastille></td>
                      {personnel && (
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Bouton variante="discret" onClick={() => setModale({ type: 'ajuster', p })}>Ajuster</Bouton>
                          {p.recent.level !== 'acquis' && !planOuvert && (
                            <Link to={`/suivi/diagnostic/${id}/${p.node_id}`} className="ml-1 text-sm font-semibold text-teranga-800">Diagnostiquer</Link>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 px-4 text-xs text-slate-500 sm:px-0">Chaque point est une évaluation (rouge : non acquis, orange : en cours, vert : acquis). Point cerclé de bleu : niveau ajusté par l’encadreur.</p>
          </div>
        )}
      </Carte>

      <Carte titre={famille ? 'Comprendre les résultats' : 'Analyse de l’assistant'} className="mt-5">
        {famille ? <ConseilsParentIA studentId={id} /> : <AnalyseIA studentId={id} />}
      </Carte>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Carte titre="Programmes de remédiation">
          {!d.plans.length ? <Vide>Aucun programme.</Vide> : (
            <ul className="space-y-3">
              {d.plans.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {personnel ? <Link to={`/remediation/${p.id}`} className="text-teranga-800 hover:underline">{noeud(p.target_node_id)?.label ?? 'Objectif'}</Link> : noeud(p.target_node_id)?.label}
                    <Pastille ton={STATUTS_PLAN[p.status].ton}>{STATUTS_PLAN[p.status].libelle}</Pastille>
                  </p>
                  <p className="text-xs text-slate-500">depuis le {formatDate(p.created_at)}</p>
                  <div className="mt-2"><AvantApres planId={p.id} /></div>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Observations">
          {!d.observations.length ? <Vide>{famille ? 'Aucune observation partagée.' : 'Aucune observation.'}</Vide> : (
            <ul className="space-y-3 text-sm">
              {d.observations.map((o) => (
                <li key={o.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="whitespace-pre-line">{o.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(o.created_at)} · {nomComplet(profils.data?.find((x) => x.id === o.author_id))}
                    {personnel && (o.visible_to_parents ? ' · partagée avec les parents' : ' · interne au centre')}</p>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Bilans" className="lg:col-span-2">
          {!d.bilans.length ? <Vide>Aucun bilan.</Vide> : (
            <ul className="space-y-4">
              {d.bilans.map((b) => <BilanAffiche key={b.id} b={b} personnel={personnel} onModifier={() => setModale({ type: 'bilan', b })} />)}
            </ul>
          )}
        </Carte>
      </div>

      <Modale titre="Ajuster le niveau" ouverte={modale?.type === 'ajuster'} fermer={() => setModale(null)}>
        {modale?.type === 'ajuster' && <Ajuster eleveId={id} p={modale.p} label={noeud(modale.p.node_id)?.label ?? ''} onFait={rafraichir} />}
      </Modale>
      <Modale titre="Nouvelle observation" ouverte={modale?.type === 'observation'} fermer={() => setModale(null)}>
        <Observation eleveId={id} onFait={rafraichir} />
      </Modale>
      <Modale titre={modale?.type === 'bilan' && modale.b ? 'Bilan' : 'Nouveau bilan'} ouverte={modale?.type === 'bilan'} fermer={() => setModale(null)}>
        {modale?.type === 'bilan' && <EditionBilan eleveId={id} bilan={modale.b} prefill={{
          presences: d.presences.length ? `${presents} présence(s) sur ${d.presences.length} séance(s).` : 'Aucune séance enregistrée.',
          competences: prog.map((p) => `${noeud(p.node_id)?.label ?? '—'} : ${LIBELLES_MAITRISE[p.recent.level]}`).join('\n'),
        }} onFait={rafraichir} />}
      </Modale>
    </>
  );
}

const RUBRIQUES: { k: keyof Bilan['body']; t: string }[] = [
  { k: 'synthese', t: 'Synthèse' }, { k: 'points_forts', t: 'Points forts' }, { k: 'difficultes', t: 'Difficultés' },
  { k: 'recommandations', t: 'Recommandations pour la maison' }, { k: 'competences', t: 'Compétences' }, { k: 'presences', t: 'Assiduité' },
];

function BilanAffiche({ b, personnel, onModifier }: { b: Bilan; personnel: boolean; onModifier: () => void }) {
  return (
    <li className="rounded-lg border border-slate-200 p-4 text-sm print:border-0" data-testid="bilan">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Bilan du {formatDate(b.period_start)} au {formatDate(b.period_end)}</p>
        <span className="flex items-center gap-2 print:hidden">
          <Pastille ton={b.status === 'envoye' ? 'vert' : 'ambre'}>{b.status === 'envoye' ? `envoyé le ${formatDate(b.sent_at!)}` : 'brouillon'}</Pastille>
          {personnel && b.status !== 'envoye' && <Bouton variante="discret" onClick={onModifier}>Modifier</Bouton>}
          <Bouton variante="discret" onClick={() => window.print()}>Imprimer / PDF</Bouton>
        </span>
      </div>
      <dl className="space-y-2">
        {RUBRIQUES.filter((r) => b.body[r.k]).map((r) => (
          <div key={r.k}><dt className="font-medium text-slate-600">{r.t}</dt><dd className="whitespace-pre-line">{b.body[r.k]}</dd></div>
        ))}
      </dl>
    </li>
  );
}

function Ajuster({ eleveId, p, label, onFait }: { eleveId: string; p: ProgressionObjectif; label: string; onFait: () => void }) {
  const { profil } = useSession();
  const [niveau, setNiveau] = useState<Maitrise>(p.recent.level);
  const [justif, setJustif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      if (justif.trim().length < 10) throw new Error('Expliquez votre décision (10 caractères au moins).');
      verifier(await supabase.from('mastery_records').insert({
        student_id: eleveId, node_id: p.node_id, level: niveau, source: 'encadreur', justification: justif.trim(), recorded_by: profil!.id,
      }));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <p className="text-sm"><strong>{label}</strong><br />Niveau calculé actuel : {LIBELLES_MAITRISE[p.recent.level]}</p>
      <Selection label="Niveau retenu" value={niveau} onChange={(e) => setNiveau(e.target.value as Maitrise)}>
        {(Object.keys(LIBELLES_MAITRISE) as Maitrise[]).map((n) => <option key={n} value={n}>{LIBELLES_MAITRISE[n]}</option>)}
      </Selection>
      <ZoneTexte label="Justification (obligatoire)" value={justif} onChange={(e) => setJustif(e.target.value)} required
        aide="Ex. : observé en séance, l’élève réussit les partages avec du matériel." />
      <p className="text-xs text-slate-500">L’ajustement s’ajoute à l’historique : rien n’est effacé. Il sera tracé avec votre nom.</p>
      <Bouton type="submit" chargement={m.isPending}>Enregistrer</Bouton>
    </form>
  );
}

function Observation({ eleveId, onFait }: { eleveId: string; onFait: () => void }) {
  const { profil } = useSession();
  const [texte, setTexte] = useState('');
  const [partage, setPartage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => verifier(await supabase.from('observations').insert({ student_id: eleveId, author_id: profil!.id, body: texte.trim(), visible_to_parents: partage })),
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <ZoneTexte label="Observation" value={texte} onChange={(e) => setTexte(e.target.value)} required maxLength={2000}
        aide="Observations pédagogiques uniquement : pas d’information médicale ou familiale sensible." />
      <Case label="Partager avec les parents" checked={partage} onChange={(e) => setPartage(e.target.checked)} />
      <Bouton type="submit" chargement={m.isPending}>Enregistrer</Bouton>
    </form>
  );
}

function EditionBilan({ eleveId, bilan, prefill, onFait }: { eleveId: string; bilan?: Bilan; prefill: { presences: string; competences: string }; onFait: () => void }) {
  const { profil } = useSession();
  const [periode, setPeriode] = useState({ debut: bilan?.period_start ?? aujourdhui(-30), fin: bilan?.period_end ?? aujourdhui() });
  const [corps, setCorps] = useState<Bilan['body']>(bilan?.body ?? { ...prefill });
  const [erreur, setErreur] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<boolean | null>(null);
  const ia = useMutation({
    mutationFn: () => assistant<{ synthese: string; points_forts: string; difficultes: string; recommandations: string }>('brouillon_bilan', {
      student_id: eleveId, debut: periode.debut, fin: periode.fin,
    }),
    onSuccess: (d) => { setCorps({ ...corps, ...d.resultat }); setSimulation(d.simulation); },
    onError: (e) => setErreur((e as Error).message),
  });
  const m = useMutation({
    mutationFn: async (statut: Bilan['status']) => {
      if (statut === 'envoye' && !corps.synthese?.trim()) throw new Error('Rédigez au moins la synthèse avant d’envoyer.');
      const ligne = { period_start: periode.debut, period_end: periode.fin, body: corps, status: statut };
      if (bilan) verifier(await supabase.from('reports').update(ligne).eq('id', bilan.id).select('id'));
      else verifier(await supabase.from('reports').insert({ ...ligne, student_id: eleveId, author_id: profil!.id }));
    },
    onSuccess: onFait, onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate('envoye'); }} className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Du" type="date" value={periode.debut} onChange={(e) => setPeriode({ ...periode, debut: e.target.value })} required />
        <Champ label="Au" type="date" value={periode.fin} onChange={(e) => setPeriode({ ...periode, fin: e.target.value })} required />
      </div>
      <BoutonIA chargement={ia.isPending} onClick={() => ia.mutate()}>Pré-remplir avec l’assistant</BoutonIA>
      {simulation !== null && <PropositionIA simulation={simulation}>Brouillon pré-rempli : relisez, corrigez et complétez chaque rubrique avant d’envoyer.</PropositionIA>}
      {RUBRIQUES.map((r) => (
        <ZoneTexte key={r.k} label={r.t} value={corps[r.k] ?? ''} onChange={(e) => setCorps({ ...corps, [r.k]: e.target.value })} maxLength={3000} />
      ))}
      <p className="text-xs text-slate-500">Une fois envoyé, le bilan est visible par les parents et ne peut plus être modifié.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton type="submit" chargement={m.isPending}>Envoyer aux parents</Bouton>
        <Bouton type="button" variante="secondaire" onClick={() => m.mutate('brouillon')}>Enregistrer le brouillon</Bouton>
      </div>
    </form>
  );
}
