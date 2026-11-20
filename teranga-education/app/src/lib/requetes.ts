import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Eleve, Groupe, Profil, Role } from './types';

/** Lance une erreur Supabase pour que TanStack Query la gère.
 *  (Sans erreur, une requête avec select() renvoie toujours des données ;
 *  pour une écriture sans select(), la valeur renvoyée n'est pas utilisée.) */
export function verifier<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}

export interface ProfilAvecRoles extends Profil {
  roles: Role[];
}

export function useProfils() {
  return useQuery({
    queryKey: ['profils'],
    queryFn: async () => {
      const data = verifier(
        await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, is_active, user_roles!user_roles_user_id_fkey(role)')
          .order('last_name'),
      );
      return (data ?? []).map((p) => ({
        ...(p as unknown as Profil),
        roles: ((p as { user_roles: { role: Role }[] }).user_roles ?? []).map((r) => r.role),
      })) as ProfilAvecRoles[];
    },
  });
}

export function useEncadreurs() {
  const q = useProfils();
  return { ...q, data: q.data?.filter((p) => p.roles.includes('encadreur')) };
}

export function useEleves() {
  return useQuery({
    queryKey: ['eleves'],
    queryFn: async () =>
      verifier(await supabase.from('students').select('*').order('last_name').order('first_name')) as Eleve[],
  });
}

export function useGroupes() {
  return useQuery({
    queryKey: ['groupes'],
    queryFn: async () =>
      verifier(
        await supabase
          .from('groups')
          .select('*, group_members(student_id, from_date, to_date), group_staff(staff_id, from_date, to_date)')
          .order('name'),
      ) as (Groupe & {
        group_members: { student_id: string; from_date: string; to_date: string | null }[];
        group_staff: { staff_id: string; from_date: string; to_date: string | null }[];
      })[],
  });
}

export function useSalles() {
  return useQuery({
    queryKey: ['salles'],
    queryFn: async () =>
      verifier(await supabase.from('rooms').select('id, name, capacity').order('name')) as
        { id: string; name: string; capacity: number | null }[],
  });
}

/** Vrai si une affectation datée est active aujourd'hui. */
export function estActif(a: { from_date: string; to_date: string | null }, jour: string): boolean {
  return a.from_date <= jour && (a.to_date === null || a.to_date >= jour);
}
