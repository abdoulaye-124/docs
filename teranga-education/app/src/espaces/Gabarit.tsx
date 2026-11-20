import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/session';
import { LIBELLES_ROLES, type Role } from '../lib/types';

interface Lien { a: string; libelle: string; icone: string }

const MENUS: Record<Role, Lien[]> = {
  admin: [
    { a: '/direction', libelle: 'Tableau de bord', icone: '🏠' },
    { a: '/eleves', libelle: 'Élèves', icone: '🎒' },
    { a: '/parents', libelle: 'Parents', icone: '👪' },
    { a: '/personnel', libelle: 'Personnel', icone: '🧑‍🏫' },
    { a: '/groupes', libelle: 'Groupes', icone: '👥' },
    { a: '/seances', libelle: 'Séances', icone: '📅' },
    { a: '/lecons', libelle: 'Leçons', icone: '📖' },
    { a: '/evaluations', libelle: 'Évaluations', icone: '📝' },
    { a: '/corrections', libelle: 'Corrections', icone: '✅' },
    { a: '/referentiel', libelle: 'Référentiel', icone: '🗂️' },
    { a: '/parametres', libelle: 'Paramètres', icone: '⚙️' },
  ],
  coordinateur: [
    { a: '/direction', libelle: 'Tableau de bord', icone: '🏠' },
    { a: '/eleves', libelle: 'Élèves', icone: '🎒' },
    { a: '/parents', libelle: 'Parents', icone: '👪' },
    { a: '/personnel', libelle: 'Personnel', icone: '🧑‍🏫' },
    { a: '/groupes', libelle: 'Groupes', icone: '👥' },
    { a: '/seances', libelle: 'Séances', icone: '📅' },
    { a: '/lecons', libelle: 'Leçons', icone: '📖' },
    { a: '/evaluations', libelle: 'Évaluations', icone: '📝' },
    { a: '/corrections', libelle: 'Corrections', icone: '✅' },
    { a: '/referentiel', libelle: 'Référentiel', icone: '🗂️' },
    { a: '/parametres', libelle: 'Paramètres', icone: '⚙️' },
  ],
  encadreur: [
    { a: '/encadreur', libelle: 'Accueil', icone: '🏠' },
    { a: '/eleves', libelle: 'Mes élèves', icone: '🎒' },
    { a: '/groupes', libelle: 'Mes groupes', icone: '👥' },
    { a: '/seances', libelle: 'Mes séances', icone: '📅' },
    { a: '/lecons', libelle: 'Leçons', icone: '📖' },
    { a: '/evaluations', libelle: 'Évaluations', icone: '📝' },
    { a: '/corrections', libelle: 'Corrections', icone: '✅' },
    { a: '/referentiel', libelle: 'Référentiel', icone: '🗂️' },
  ],
  parent: [{ a: '/parent', libelle: 'Mes enfants', icone: '👪' }],
  eleve: [{ a: '/eleve', libelle: 'Accueil', icone: '🏠' }],
};

export default function Gabarit() {
  const { profil, roles, roleActif, choisirRole, deconnexion } = useSession();
  const menu = roleActif ? MENUS[roleActif] : [];
  const lienStyle = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium ${isActive ? 'bg-teranga-100 text-teranga-900' : 'text-slate-700 hover:bg-slate-100'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-teranga-900 bg-teranga-800 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2">
            <img src="/icone.svg" alt="" className="h-8 w-8" />
            <span className="font-bold tracking-wide">TERANGA ÉDUCATION</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {roles.length > 1 && (
              <select
                aria-label="Espace"
                value={roleActif ?? ''}
                onChange={(e) => choisirRole(e.target.value as Role)}
                className="min-h-[40px] rounded-lg border-0 bg-teranga-700 px-2 text-white"
              >
                {roles.map((r) => <option key={r} value={r}>{LIBELLES_ROLES[r]}</option>)}
              </select>
            )}
            <span className="hidden sm:inline">{profil?.first_name}</span>
            <button onClick={deconnexion} className="min-h-[40px] rounded-lg px-3 hover:bg-teranga-700">Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-24 pt-5 md:pb-8">
        {menu.length > 1 && (
          <nav aria-label="Menu principal" className="hidden w-52 shrink-0 md:block">
            <ul className="sticky top-20 space-y-1">
              {menu.map((l) => (
                <li key={l.a}><NavLink to={l.a} className={lienStyle}><span aria-hidden>{l.icone}</span>{l.libelle}</NavLink></li>
              ))}
            </ul>
          </nav>
        )}
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>

      {menu.length > 1 && (
        <nav aria-label="Menu mobile" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
          <ul className="flex overflow-x-auto">
            {menu.map((l) => (
              <li key={l.a} className="min-w-[72px] flex-1">
                <NavLink
                  to={l.a}
                  className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center text-[11px] ${isActive ? 'text-teranga-800 font-semibold' : 'text-slate-600'}`}
                >
                  <span aria-hidden className="text-lg">{l.icone}</span>{l.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
