import { describe, expect, it } from 'vitest';
import { celluleCsv, elevesVersCsv } from './export';
import type { Eleve } from '../../lib/types';

describe('export CSV', () => {
  it('échappe les guillemets et séparateurs', () => {
    expect(celluleCsv('École "Les Manguiers"; Dakar')).toBe('"École ""Les Manguiers""; Dakar"');
  });
  it('neutralise les formules Excel', () => {
    expect(celluleCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celluleCsv('+221')).toBe("'+221");
  });
  it('produit un fichier lisible par Excel (BOM, ;)', () => {
    const e = {
      code: 'TE-2026-0001', last_name: 'FICTIF', first_name: 'Awa', birth_date: '2017-03-12', level_code: 'CE2',
      origin_school: null, origin_class: 'CE2 B', enrolled_on: '2026-11-20', referent_staff_id: 'x', is_active: true,
    } as Eleve;
    const csv = elevesVersCsv([e], () => 'M. Test');
    expect(csv.startsWith('﻿Identifiant;Nom;')).toBe(true);
    expect(csv.split('\r\n')[1]).toBe('TE-2026-0001;FICTIF;Awa;2017-03-12;CE2;;CE2 B;2026-11-20;M. Test;oui');
  });
});
