const fmtDate = new Intl.DateTimeFormat('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtJour = new Intl.DateTimeFormat('fr-SN', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-SN', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (d: string | Date) => fmtDate.format(new Date(d));
export const formatJour = (d: string | Date) => fmtJour.format(new Date(d));
export const formatHeure = (d: string | Date) => fmtHeure.format(new Date(d));
export const formatCreneau = (debut: string, fin: string) =>
  `${formatJour(debut)} · ${formatHeure(debut)}–${formatHeure(fin)}`;

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(decalageJours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function age(naissance: string): number {
  const n = new Date(naissance);
  const a = new Date();
  let ans = a.getFullYear() - n.getFullYear();
  if (a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate())) ans--;
  return ans;
}
