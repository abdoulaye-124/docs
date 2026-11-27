import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, Api, connexion, connexionEleve, jeton, jetonTelephone, preparerCentre } from './outils';

// Phase 7 : mode hors connexion de l'élève et accessibilité. DONNÉES FICTIVES.

test.describe.configure({ mode: 'serial' });

test('Hors connexion : l’élève relit sa leçon, répond, et la réponse part au retour du réseau (une seule fois)', async ({ page, context }, info) => {
  const sfx = info.project.name === 'pc' ? 'PC7' : 'AND7';
  const c = await preparerCentre(sfx, info.project.name === 'pc' ? 1 : 2, '72');
  const enc = new Api(await jetonTelephone(c.encadreur.tel, c.encadreur.mdp));
  const lecon = await enc.inserer('lessons', { title: `Hors ligne ${sfx}`, level_code: 'CE2', author_id: c.encadreurId, status: 'valide',
    validated_by: c.encadreurId, content: [{ type: 'explication', texte: 'Texte de leçon disponible sans réseau.' }] });
  const ex = await enc.inserer('exercises', { lesson_id: lecon.id, level_code: 'CE2', kind: 'reponse_courte', prompt: 'Hors ligne : 9 ÷ 3 = ?',
    difficulty: 1, author_id: c.encadreurId, status: 'valide', validated_by: c.encadreurId });
  await enc.inserer('exercise_keys', { exercise_id: ex.id, answer_key: { accepted: ['3'] }, explanation: '9 ÷ 3 = 3' });
  await enc.inserer('publications', { lesson_id: lecon.id, group_id: c.groupeId, published_by: c.encadreurId });

  // En ligne : l'élève ouvre ses leçons (elles sont gardées sur le téléphone).
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.getByRole('link', { name: /Mes leçons/ }).click();
  await expect(page.getByRole('link', { name: `Hors ligne ${sfx}` })).toBeVisible();

  // Coupure du réseau : navigation dans l'application, lecture et réponse.
  await context.setOffline(true);
  await expect(page.getByTestId('bandeau-reseau')).toContainText('Hors connexion');
  await page.getByRole('link', { name: `Hors ligne ${sfx}` }).click();
  await expect(page.getByText('Texte de leçon disponible sans réseau.')).toBeVisible();
  await page.getByRole('link', { name: /Je m’exerce/ }).click();
  await page.getByLabel('Ma réponse').fill('3');
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Réponse gardée sur ton téléphone !')).toBeVisible();
  await expect(page.getByTestId('bandeau-reseau')).toContainText('1 réponse(s) en attente d’envoi');
  await page.getByRole('link', { name: 'Retour à mes exercices' }).click();
  await expect(page.getByText('Bravo, tout est fait !')).toBeVisible();

  // Retour du réseau : envoi automatique, puis plus rien en attente.
  await context.setOffline(false);
  await expect(page.getByTestId('bandeau-reseau')).toHaveCount(0, { timeout: 15_000 });
  await page.reload();   // nouvel essai de synchronisation : ne doit pas créer de doublon
  await expect(page.getByText('Bravo, tout est fait !')).toBeVisible();

  const admin = new Api(await jeton({ email: ADMIN.id, password: ADMIN.mdp }));
  const copies = await admin.lire<{ id: string }[]>(`submissions?student_id=eq.${c.eleveId}&exercise_id=eq.${ex.id}&select=id`);
  expect(copies).toHaveLength(1);
});

async function sansViolationGrave(page: Page, nom: string) {
  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${nom} : ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([]);
}

test('Accessibilité : aucune violation grave (WCAG A / AA) sur les écrans principaux', async ({ page }, info) => {
  await page.goto('/connexion');
  await sansViolationGrave(page, 'connexion');
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  for (const url of ['/direction', '/eleves', '/groupes', '/seances', '/lecons', '/lecons/nouvelle', '/suivi', '/parametres']) {
    await page.goto(url);
    await sansViolationGrave(page, url);
  }
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  const sfx = info.project.name === 'pc' ? 'PC7' : 'AND7';
  await connexionEleve(page, `moussa.${sfx.toLowerCase()}`, [3, 7, 0, 11]);
  for (const url of ['/eleve', '/eleve/lecons', '/eleve/exercices', '/eleve/resultats']) {
    await page.goto(url);
    await sansViolationGrave(page, url);
  }
});
