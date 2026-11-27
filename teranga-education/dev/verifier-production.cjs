// Vérifie la version de PRODUCTION (vite build + preview, en-têtes de sécurité actifs) :
//  1. aucun blocage par la politique de sécurité (CSP) sur les écrans parcourus ;
//  2. l'application installée s'ouvre SANS RÉSEAU après rechargement (Service Worker).
const { chromium, devices } = require('../app/node_modules/playwright');
const B = 'http://127.0.0.1:4173';
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['Pixel 7'] });
  const p = await c.newPage();
  const problemes = [];
  p.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problemes.push(m.text()); });
  const r = await p.goto(B + '/connexion');
  const h = r.headers();
  for (const n of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    if (!h[n]) problemes.push(`En-tête absent : ${n}`);
  }
  await p.getByRole('tab', { name: 'Personnel' }).click();
  await p.getByLabel('E-mail ou téléphone').fill('admin@demo.teranga.invalid');
  await p.getByLabel('Mot de passe').fill('Admin-demo-2026');
  await p.getByRole('button', { name: 'Se connecter' }).click();
  await p.waitForURL(/direction/);
  for (const u of ['/eleves', '/lecons', '/suivi', '/parametres', '/wolof', '/direction']) {
    await p.goto(B + u); await p.waitForLoadState('networkidle');
  }
  // Service Worker prêt, puis coupure réseau et rechargement complet
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.reload(); await p.waitForLoadState('networkidle');
  await c.setOffline(true);
  await p.reload();
  const ok = await p.getByText('TERANGA ÉDUCATION').first().isVisible();
  const bandeau = await p.getByTestId('bandeau-reseau').isVisible().catch(() => false);
  console.log(`Ouverture sans réseau après rechargement : ${ok ? 'OK' : 'ÉCHEC'} ; bandeau hors connexion : ${bandeau ? 'oui' : 'non'}`);
  if (!ok) problemes.push('L’application ne s’ouvre pas sans réseau');
  console.log(problemes.length ? `PROBLÈMES :\n${problemes.join('\n')}` : 'Aucun blocage de sécurité, en-têtes présents.');
  await b.close();
  process.exit(problemes.length ? 1 : 0);
})();
