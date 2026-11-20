import { Navigate, Route, Routes } from 'react-router-dom';
import { accueilPour, useSession } from './lib/session';
import type { Role } from './lib/types';
import { Chargement } from './ui/composants';
import Gabarit from './espaces/Gabarit';
import Connexion from './features/connexion/Connexion';
import TableauDirection from './features/tableaux/TableauDirection';
import TableauEncadreur from './features/tableaux/TableauEncadreur';
import TableauParent from './features/tableaux/TableauParent';
import AccueilEleve from './features/tableaux/AccueilEleve';
import ListeEleves from './features/eleves/ListeEleves';
import FicheEleve from './features/eleves/FicheEleve';
import NouvelEleve from './features/eleves/NouvelEleve';
import ListePersonnel from './features/personnel/ListePersonnel';
import ListeParents from './features/parents/ListeParents';
import ListeGroupes from './features/groupes/ListeGroupes';
import FicheGroupe from './features/groupes/FicheGroupe';
import ListeSeances from './features/seances/ListeSeances';
import FicheSeance from './features/seances/FicheSeance';
import Parametres from './features/parametres/Parametres';
import Referentiel from './features/referentiel/Referentiel';
import ListeLecons from './features/lecons/ListeLecons';
import EditeurLecon from './features/lecons/EditeurLecon';
import { EditeurEvaluation, ListeEvaluations } from './features/evaluations/Evaluations';
import Corrections from './features/corrections/Corrections';
import { EvaluationEleve, Exercer, LeconEleve, MesExercices, MesLecons, MesResultats } from './features/eleve/EspaceEleve';

const DIRECTION: Role[] = ['admin', 'coordinateur'];
const PERSONNEL: Role[] = ['admin', 'coordinateur', 'encadreur'];

function Protege({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { chargement, session, roleActif } = useSession();
  if (chargement) return <Chargement />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (!roleActif || !roles.includes(roleActif)) return <Navigate to={accueilPour(roleActif)} replace />;
  return children;
}

export default function App() {
  const { chargement, session, roleActif } = useSession();
  if (chargement) return <div className="p-6"><Chargement /></div>;

  return (
    <Routes>
      <Route path="/connexion" element={session && roleActif ? <Navigate to={accueilPour(roleActif)} replace /> : <Connexion />} />
      <Route element={<Gabarit />}>
        <Route path="/direction" element={<Protege roles={DIRECTION}><TableauDirection /></Protege>} />
        <Route path="/encadreur" element={<Protege roles={['encadreur']}><TableauEncadreur /></Protege>} />
        <Route path="/parent" element={<Protege roles={['parent']}><TableauParent /></Protege>} />
        <Route path="/parent/enfant/:id" element={<Protege roles={['parent']}><FicheEleve /></Protege>} />
        <Route path="/eleve" element={<Protege roles={['eleve']}><AccueilEleve /></Protege>} />

        <Route path="/eleves" element={<Protege roles={PERSONNEL}><ListeEleves /></Protege>} />
        <Route path="/eleves/nouveau" element={<Protege roles={['admin']}><NouvelEleve /></Protege>} />
        <Route path="/eleves/:id" element={<Protege roles={PERSONNEL}><FicheEleve /></Protege>} />
        <Route path="/parents" element={<Protege roles={DIRECTION}><ListeParents /></Protege>} />
        <Route path="/personnel" element={<Protege roles={DIRECTION}><ListePersonnel /></Protege>} />
        <Route path="/groupes" element={<Protege roles={PERSONNEL}><ListeGroupes /></Protege>} />
        <Route path="/groupes/:id" element={<Protege roles={PERSONNEL}><FicheGroupe /></Protege>} />
        <Route path="/seances" element={<Protege roles={PERSONNEL}><ListeSeances /></Protege>} />
        <Route path="/seances/:id" element={<Protege roles={[...PERSONNEL, 'parent']}><FicheSeance /></Protege>} />
        <Route path="/parametres" element={<Protege roles={DIRECTION}><Parametres /></Protege>} />
        <Route path="/referentiel" element={<Protege roles={PERSONNEL}><Referentiel /></Protege>} />
        <Route path="/lecons" element={<Protege roles={PERSONNEL}><ListeLecons /></Protege>} />
        <Route path="/lecons/:id" element={<Protege roles={PERSONNEL}><EditeurLecon /></Protege>} />
        <Route path="/evaluations" element={<Protege roles={PERSONNEL}><ListeEvaluations /></Protege>} />
        <Route path="/evaluations/:id" element={<Protege roles={PERSONNEL}><EditeurEvaluation /></Protege>} />
        <Route path="/corrections" element={<Protege roles={PERSONNEL}><Corrections /></Protege>} />
        <Route path="/eleve/lecons" element={<Protege roles={['eleve']}><MesLecons /></Protege>} />
        <Route path="/eleve/lecons/:id" element={<Protege roles={['eleve']}><LeconEleve /></Protege>} />
        <Route path="/eleve/exercices" element={<Protege roles={['eleve']}><MesExercices /></Protege>} />
        <Route path="/eleve/exercer/:id" element={<Protege roles={['eleve']}><Exercer /></Protege>} />
        <Route path="/eleve/evaluation/:id" element={<Protege roles={['eleve']}><EvaluationEleve /></Protege>} />
        <Route path="/eleve/resultats" element={<Protege roles={['eleve']}><MesResultats /></Protege>} />
      </Route>
      <Route path="*" element={<Navigate to={session ? accueilPour(roleActif) : '/connexion'} replace />} />
    </Routes>
  );
}
