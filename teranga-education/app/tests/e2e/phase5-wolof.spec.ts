import { expect, test, type Page } from '@playwright/test';
import { ADMIN, Api, connexion, connexionEleve, deconnexion, fichierWav, jeton, preparerCentre } from './outils';

// Scénario Phase 5 (étape T7 du scénario de validation) : audio français enregistré,
// explications en wolof relues par un relecteur, aide masquée en évaluation
// « français obligatoire ». DONNÉES FICTIVES : les textes « [wolof] … » sont des
// marqueurs de test, PAS du wolof.

test.describe.configure({ mode: 'serial' });

const signatureOk = (page: Page) =>
  page.waitForResponse((r) => r.url().includes('/storage/v1/object/sign/audio/') && r.status() === 200);

test('Phase 5 : audio, relecture wolof, aide wolof pour l’élève, français obligatoire', async ({ page }, info) => {
  const sfx = info.project.name === 'pc' ? 'PC5' : 'AND5';
  const c = await preparerCentre(sfx, info.project.name === 'pc' ? 1 : 2, '70');
  const relecteur = { email: `relecteur.${sfx.toLowerCase()}@demo.teranga.invalid`, mdp: `Relecteur-${sfx}-2026` };

  // --- Préparation : relecteur, leçon publiée avec un exercice -------------
  const admin = new Api(await jeton({ email: ADMIN.id, password: ADMIN.mdp }));
  await admin.compte({ role: 'relecteur_wolof', first_name: 'Relecteur', last_name: `WOLOF-${sfx}`, email: relecteur.email, password: relecteur.mdp });
  const enc = new Api(await jeton({ phone: `+221${c.encadreur.tel.replace(/\s/g, '')}`, password: c.encadreur.mdp }));
  const div = (await enc.lire<{ id: string }[]>('curriculum_nodes?code=eq.P-M-03&select=id'))[0].id;
  const lecon = await enc.inserer('lessons', { title: `Partager ${sfx}`, level_code: 'CE2', author_id: c.encadreurId, status: 'valide',
    validated_by: c.encadreurId, content: [{ type: 'explication', texte: 'Partager, c’est donner la même part à chacun.' }] });
  const ex = await enc.inserer('exercises', { lesson_id: lecon.id, level_code: 'CE2', kind: 'reponse_courte', difficulty: 1,
    prompt: 'Awa a 12 mangues pour 4 amis. Combien chacun en reçoit-il ?', author_id: c.encadreurId, status: 'valide', validated_by: c.encadreurId });
  await enc.inserer('exercise_keys', { exercise_id: ex.id, answer_key: { accepted: ['3'] }, explanation: '12 ÷ 4 = 3' });
  await enc.inserer('exercise_objectives', { exercise_id: ex.id, node_id: div });
  await enc.inserer('publications', { lesson_id: lecon.id, group_id: c.groupeId, published_by: c.encadreurId });

  // --- L'encadreur enregistre la lecture et propose des explications en wolof
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto(`/lecons/${lecon.id}`);
  await page.getByRole('button', { name: /Enregistrer la lecture de la leçon/ }).click();
  await expect(page.getByText(/Enregistrement…/)).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '⏹ Arrêter' }).click();
  await expect(page.getByTestId('apercu-audio')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer l’audio français' }).click();
  await expect(page.getByText(/Lecture enregistrée le/)).toBeVisible();

  await page.getByRole('button', { name: '+ Explication en wolof' }).first().click();
  await page.getByLabel('Ce qui est expliqué').selectOption('mot');
  await page.getByLabel('Passage en français').fill('partager');
  await page.getByLabel(/Explication écrite en wolof/).fill('[wolof] explication fictive de test');
  await page.getByLabel('Fichier audio').last().setInputFiles({ name: 'explication.wav', mimeType: 'audio/wav', buffer: fichierWav() });
  await expect(page.getByTestId('apercu-audio').last()).toBeVisible();
  await page.getByRole('button', { name: 'Envoyer en relecture' }).click();
  await expect(page.getByTestId('explication-wolof').filter({ hasText: 'partager' })).toContainText('à relire');

  // Aide wolof sur la consigne de l'exercice
  await page.getByRole('button', { name: '🗣 Aide wolof' }).click();
  await page.getByRole('button', { name: '+ Explication en wolof' }).last().click();
  await page.getByLabel('Passage en français').fill('Combien chacun en reçoit-il ?');
  await page.getByLabel(/Explication écrite en wolof/).fill('[wolof] aide fictive sur la consigne');
  await page.getByRole('button', { name: 'Envoyer en relecture' }).click();
  await expect(page.getByTestId('explication-wolof').filter({ hasText: 'Combien chacun' })).toContainText('à relire');
  await page.goto('/wolof');   // l'encadreur n'a pas accès à la relecture
  await expect(page).toHaveURL(/\/encadreur$/);
  await deconnexion(page);

  // --- Avant relecture : l'élève entend la voix de l'encadreur, pas de wolof
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.goto(`/eleve/lecons/${lecon.id}`);
  const lecture = signatureOk(page);
  await page.getByRole('button', { name: '🔊 Écouter la leçon' }).click();
  await lecture;
  await expect(page.getByTestId('lecteur-audio')).toBeVisible();
  await expect(page.getByText('🗣 Aide en wolof')).toHaveCount(0);
  await deconnexion(page);

  // --- Le relecteur corrige et valide -----------------------------------------
  await connexion(page, 'Personnel', relecteur.email, relecteur.mdp);
  await expect(page.getByRole('heading', { name: 'Relecture des contenus en wolof' })).toBeVisible();
  const aRelire = page.getByTestId('a-relire');
  await expect(aRelire).toHaveCount(2);
  const mot = page.locator('section', { hasText: '« partager »' });
  const ecoute = signatureOk(page);
  await mot.getByRole('button', { name: /Écouter l’enregistrement/ }).click();
  await ecoute;
  await mot.getByLabel('Texte en wolof (corrigeable)').fill('[wolof] explication fictive relue et corrigée');
  await mot.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByTestId('a-relire')).toHaveCount(1);
  await page.getByTestId('a-relire').getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Rien à relire.')).toBeVisible();
  await page.goto('/eleves');   // le relecteur n'accède à aucun dossier d'élève
  await expect(page).toHaveURL(/\/wolof$/);
  await deconnexion(page);

  // --- T7 : l'élève écoute l'explication complémentaire en wolof -----------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.goto(`/eleve/lecons/${lecon.id}`);
  await page.getByRole('button', { name: /Aide en wolof/ }).click();
  const aide = page.getByTestId('aide-wolof');
  await expect(aide).toContainText('« partager »');
  await expect(aide).toContainText('[wolof] explication fictive relue et corrigée');
  const wo = signatureOk(page);
  await aide.getByRole('button', { name: /Écouter en wolof/ }).click();
  await wo;
  await page.goto(`/eleve/exercer/${ex.id}`);
  await page.getByRole('button', { name: /Aide en wolof/ }).click();
  await expect(page.getByTestId('aide-wolof')).toContainText('[wolof] aide fictive sur la consigne');
  await deconnexion(page);

  // --- Évaluation « français obligatoire » : l'aide wolof disparaît ----------
  const ev = await enc.inserer('assessments', { title: `Contrôle en français ${sfx}`, kind: 'sommative', level_code: 'CE2',
    french_only: true, status: 'valide', author_id: c.encadreurId });
  await enc.inserer('assessment_items', { assessment_id: ev.id, exercise_id: ex.id, position: 1, weight: 1 });
  await enc.inserer('publications', { assessment_id: ev.id, student_id: c.eleveId, published_by: c.encadreurId });
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.goto(`/eleve/evaluation/${ev.id}`);
  await expect(page.getByText('Question 1 sur 1')).toBeVisible();
  await expect(page.getByText(/Aide en wolof/)).toHaveCount(0);
  await page.goto(`/eleve/exercer/${ex.id}`);
  await expect(page.getByTestId('consigne')).toBeVisible();
  await expect(page.getByText(/Aide en wolof/)).toHaveCount(0);
  // L'aide sur la leçon (le mot « partager ») reste disponible en dehors de l'évaluation.
  await page.goto(`/eleve/lecons/${lecon.id}`);
  await expect(page.getByRole('button', { name: /Aide en wolof/ })).toBeVisible();
});
