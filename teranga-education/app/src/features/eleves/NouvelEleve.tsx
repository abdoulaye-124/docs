import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useEncadreurs } from '../../lib/requetes';
import { messageErreur } from '../../lib/erreurs';
import { aujourdhui } from '../../lib/dates';
import { NIVEAUX, nomComplet } from '../../lib/types';
import { Alerte, Bouton, Carte, Champ, EnTete, Selection, ZoneTexte } from '../../ui/composants';

export default function NouvelEleve() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profil } = useSession();
  const encadreurs = useEncadreurs();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [f, setF] = useState({
    first_name: '', last_name: '', birth_date: '', level_code: 'CE2', origin_school: '', origin_class: '',
    initial_difficulties: '', enrolled_on: aujourdhui(), referent_staff_id: '',
  });
  const maj = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { data, error } = await supabase.from('students').insert({
      ...f,
      origin_school: f.origin_school || null,
      origin_class: f.origin_class || null,
      initial_difficulties: f.initial_difficulties || null,
      referent_staff_id: f.referent_staff_id || null,
      created_by: profil?.id,
    }).select('id').single();
    setEnvoi(false);
    if (error) return setErreur(messageErreur(error));
    await qc.invalidateQueries({ queryKey: ['eleves'] });
    nav(`/eleves/${data.id}?nouveau=1`);
  }

  return (
    <>
      <EnTete titre="Inscrire un élève" sousTitre="Seules les informations nécessaires à l'accompagnement sont demandées." />
      <form onSubmit={soumettre} className="max-w-3xl space-y-5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Carte titre="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Prénom" value={f.first_name} onChange={maj('first_name')} required maxLength={60} />
            <Champ label="Nom" value={f.last_name} onChange={maj('last_name')} required maxLength={60} />
            <Champ label="Date de naissance" type="date" value={f.birth_date} onChange={maj('birth_date')} required max={aujourdhui()} />
            <Selection label="Niveau" value={f.level_code} onChange={maj('level_code')} required>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </Selection>
          </div>
        </Carte>
        <Carte titre="Scolarité">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Établissement d'origine" value={f.origin_school} onChange={maj('origin_school')} maxLength={120} />
            <Champ label="Classe d'origine" value={f.origin_class} onChange={maj('origin_class')} maxLength={30} placeholder="ex. CE2 B" />
            <div className="sm:col-span-2">
              <ZoneTexte label="Difficultés initialement identifiées" value={f.initial_difficulties} onChange={maj('initial_difficulties')} maxLength={1000}
                aide="Observations pédagogiques uniquement. Ne pas inscrire d'information médicale ou familiale sensible." />
            </div>
          </div>
        </Carte>
        <Carte titre="Accompagnement">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Date d'inscription" type="date" value={f.enrolled_on} onChange={maj('enrolled_on')} required />
            <Selection label="Encadreur référent" value={f.referent_staff_id} onChange={maj('referent_staff_id')}>
              <option value="">— À désigner plus tard —</option>
              {encadreurs.data?.map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}</option>)}
            </Selection>
          </div>
        </Carte>
        <p className="text-sm text-slate-600">Étape suivante : associer le parent, enregistrer son consentement et affecter l'élève à un groupe.</p>
        <div className="flex gap-3">
          <Bouton type="submit" chargement={envoi}>Inscrire l'élève</Bouton>
          <Bouton type="button" variante="secondaire" onClick={() => nav('/eleves')}>Annuler</Bouton>
        </div>
      </form>
    </>
  );
}
