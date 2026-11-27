import type { Eleve } from '../../lib/types';

/** Échappe une valeur pour un fichier CSV (séparateur « ; », usage Excel français). */
export function celluleCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise les formules (=, +, -, @) pour éviter l'injection dans Excel.
  const sur = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

export function elevesVersCsv(eleves: Eleve[], nomReferent: (id: string | null) => string): string {
  const entetes = ['Identifiant', 'Nom', 'Prénom', 'Date de naissance', 'Niveau', 'Établissement d\'origine',
    'Classe d\'origine', 'Date d\'inscription', 'Référent', 'Actif'];
  const lignes = eleves.map((e) => [
    e.code, e.last_name, e.first_name, e.birth_date, e.level_code, e.origin_school, e.origin_class,
    e.enrolled_on, nomReferent(e.referent_staff_id), e.is_active ? 'oui' : 'non',
  ]);
  // BOM UTF-8 : Excel affiche correctement les accents.
  return '﻿' + [entetes, ...lignes].map((l) => l.map(celluleCsv).join(';')).join('\r\n');
}

export function exporterCsv(eleves: Eleve[], nomReferent: (id: string | null) => string) {
  const blob = new Blob([elevesVersCsv(eleves, nomReferent)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eleves-teranga-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
