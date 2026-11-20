import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Profil, Role } from './types';

const ORDRE_ROLES: Role[] = ['admin', 'coordinateur', 'encadreur', 'parent', 'eleve'];

interface EtatSession {
  chargement: boolean;
  session: Session | null;
  profil: Profil | null;
  roles: Role[];
  roleActif: Role | null;
  choisirRole: (r: Role) => void;
  deconnexion: () => Promise<void>;
  aRole: (...r: Role[]) => boolean;
}

const Ctx = createContext<EtatSession | null>(null);

function lireRoleMemorise(): Role | null {
  try {
    return (localStorage.getItem('teranga-role') as Role | null) ?? null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleActif, setRoleActif] = useState<Role | null>(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfil(null);
      setRoles([]);
      setRoleActif(null);
      setChargement(false);
      return;
    }
    const uid = s.user.id;
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, phone, is_active').eq('id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    const lesRoles = ((r.data ?? []).map((x) => x.role as Role)).sort(
      (a, b) => ORDRE_ROLES.indexOf(a) - ORDRE_ROLES.indexOf(b),
    );
    setProfil((p.data as Profil) ?? null);
    setRoles(lesRoles);
    const memo = lireRoleMemorise();
    setRoleActif(memo && lesRoles.includes(memo) ? memo : lesRoles[0] ?? null);
    setChargement(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => charger(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'USER_UPDATED') {
        setChargement(true);
        // Différé : ne pas appeler Supabase à l'intérieur du rappel d'authentification.
        setTimeout(() => charger(s), 0);
      } else if (evt === 'TOKEN_REFRESHED') {
        setSession(s);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [charger]);

  const choisirRole = useCallback((r: Role) => {
    setRoleActif(r);
    try {
      localStorage.setItem('teranga-role', r);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }, []);

  const deconnexion = useCallback(async () => {
    await supabase.auth.signOut();
    qc.clear();
  }, [qc]);

  const valeur = useMemo<EtatSession>(
    () => ({
      chargement, session, profil, roles, roleActif, choisirRole, deconnexion,
      aRole: (...r: Role[]) => roleActif !== null && r.includes(roleActif),
    }),
    [chargement, session, profil, roles, roleActif, choisirRole, deconnexion],
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useSession(): EtatSession {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession hors de SessionProvider');
  return v;
}

/** Espace d'accueil selon le rôle actif. */
export function accueilPour(role: Role | null): string {
  switch (role) {
    case 'admin':
    case 'coordinateur':
      return '/direction';
    case 'encadreur':
      return '/encadreur';
    case 'parent':
      return '/parent';
    case 'eleve':
      return '/eleve';
    default:
      return '/connexion';
  }
}
