export type Role = 'admin' | 'coordinateur' | 'encadreur' | 'parent' | 'eleve' | 'relecteur_wolof';
export type Niveau = 'CI' | 'CP' | 'CE1' | 'CE2' | 'CM1' | 'CM2';
export const NIVEAUX: Niveau[] = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

export const LIBELLES_ROLES: Record<Role, string> = {
  admin: 'Direction',
  coordinateur: 'Coordination',
  encadreur: 'Encadreur',
  parent: 'Parent',
  eleve: 'Élève',
  relecteur_wolof: 'Relecteur wolof',
};

export interface Profil {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
}

export interface Eleve {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  level_code: Niveau;
  origin_school: string | null;
  origin_class: string | null;
  initial_difficulties: string | null;
  enrolled_on: string;
  referent_staff_id: string | null;
  profile_id: string | null;
  login_id: string | null;
  is_active: boolean;
}

export interface Groupe {
  id: string;
  name: string;
  kind: 'principal' | 'remediation';
  level_code: Niveau | null;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
}

export interface Seance {
  id: string;
  title: string;
  staff_id: string;
  room_id: string | null;
  online_url: string | null;
  starts_at: string;
  ends_at: string;
  status: 'planifiee' | 'realisee' | 'annulee';
  notes: string | null;
  subject_id: string | null;
}

export type StatutPresence = 'present' | 'absent' | 'retard' | 'excuse';
export const LIBELLES_PRESENCE: Record<StatutPresence, string> = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'En retard',
  excuse: 'Excusé',
};

export const nomComplet = (p: { first_name: string; last_name: string } | null | undefined) =>
  p ? `${p.first_name} ${p.last_name}` : '—';
