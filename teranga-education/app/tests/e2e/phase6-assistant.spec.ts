import { expect, test } from '@playwright/test';
import { ADMIN, Api, connexion, connexionEleve, deconnexion, jeton, preparerCentre } from './outils';

// Scénario Phase 6 : assistant IA en MODE SIMULATION (aucune IA réelle, aucun coût).
// Vérifie le circuit complet : propositions en brouillon, validation humaine,
// indices limités sans réponse, analyse, bilan, wolof en relecture, conseils aux
// parents, quotas, et absence de nom d'élève dans ce qui serait envoyé.

test.describe.configure({ mode: 'serial' });

test('Phase 6 : assistant pédagogique, indices, analyse, bilan, wolof, parents, quotas', async ({ page }, info) => {
  const sfx = info.project.name === 'pc' ? 'PC6' : 'AND6';
  const c = await preparerCentre(sfx, info.project.name === 'pc' ? 1 : 2, '71');
  const titre = `Division assistée ${sfx}`;

  // --- La direction règle l'assistant : 1 demande par jour pour les parents
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  await page.goto('/parametres');
  await expect(page.getByText('aucune IA réelle : réponses fictives de test')).toBeVisible();
  await page.getByLabel('Parent', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Réglages de l’assistant enregistrés.')).toBeVisible();
  await deconnexion(page);

  // --- L'encadreur : plan de leçon et exercices proposés ----------------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto('/lecons/nouvelle');
  await page.getByLabel('Titre de la leçon').fill(titre);
  await page.getByLabel(/P-M-03/).check();
  await page.getByRole('button', { name: /Proposer un plan/ }).click();
  await expect(page.getByTestId('proposition-ia').first()).toContainText('relisez-le et corrigez-le');
  await expect(page.getByLabel('Explication (bloc 1)')).toHaveValue(/\[Simulation\] Explication/);
  await page.getByRole('button', { name: 'Valider la leçon' }).click();
  await expect(page.getByText('Leçon validée : elle peut être publiée.')).toBeVisible();

  await page.getByRole('button', { name: /Proposer des exercices/ }).click();
  await page.getByLabel('Nombre', { exact: true }).selectOption('3');
  await page.getByRole('button', { name: /Générer en brouillon/ }).click();
  await expect(page.getByText(/3 exercice\(s\) proposé\(s\) en brouillon/)).toBeVisible();
  await expect(page.getByText('proposé par l’IA')).toHaveCount(3);
  await expect(page.getByText('Brouillon', { exact: true })).toHaveCount(3);
  // Validation humaine du premier exercice uniquement
  await page.getByRole('button', { name: 'Modifier' }).first().click();
  const d = page.getByRole('dialog');
  await expect(d.getByLabel(/Consigne/)).toHaveValue(/20 ÷ 5/);
  await d.getByRole('button', { name: 'Enregistrer et valider' }).click();
  await expect(page.getByText('Validé', { exact: true })).toHaveCount(2); // leçon + exercice 1

  // Proposition en wolof : part en relecture, jamais directement aux élèves
  await page.getByRole('button', { name: '🗣 Aide wolof' }).first().click();
  await page.getByRole('button', { name: '+ Explication en wolof' }).last().click();
  await page.getByLabel('Passage en français').fill('partager en parts égales');
  await page.getByRole('button', { name: /Proposer avec l’assistant/ }).click();
  await expect(page.getByText('Proposition envoyée en relecture wolof')).toBeVisible();

  // Publication
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Groupe').selectOption({ label: c.groupe });
  await page.getByRole('dialog').getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Leçon publiée.')).toBeVisible();
  await deconnexion(page);

  // --- L'élève : seul l'exercice validé est visible ; indices limités ---------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.goto('/eleve/exercices');
  await expect(page.getByRole('link', { name: /Exercice/ })).toHaveCount(1);
  await page.getByRole('link', { name: /Exercice 1/ }).click();
  await page.getByRole('button', { name: /Un indice/ }).click();
  await expect(page.getByTestId('indices')).toContainText('Relis la consigne');
  await expect(page.getByTestId('indices')).not.toContainText(/\b4\b/);   // jamais la réponse
  await page.getByRole('button', { name: /Un autre indice/ }).click();
  await expect(page.getByTestId('indices').locator('li')).toHaveCount(2);
  await expect(page.getByText('Tu as utilisé tes indices.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Un autre indice/ })).toBeDisabled();
  await page.getByRole('button', { name: '3', exact: true }).click();      // mauvaise réponse
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Réponse envoyée !')).toBeVisible();
  await deconnexion(page);

  // --- L'encadreur corrige, puis analyse et bilan assistés -------------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto('/corrections');
  await page.getByRole('button', { name: 'Valider les 1 notes automatiques' }).click();
  await expect(page.getByText('Aucune copie en attente.')).toBeVisible();
  await page.goto(`/eleves/${c.eleveId}/suivi`);
  await page.getByRole('button', { name: /Analyser les résultats/ }).click();
  const analyse = page.getByTestId('proposition-ia');
  await expect(analyse).toContainText('Constats');
  await expect(analyse).toContainText('Pistes de remédiation');
  await page.getByRole('button', { name: '+ Bilan' }).click();
  const bilan = page.getByRole('dialog');
  await bilan.getByRole('button', { name: /Pré-remplir avec l’assistant/ }).click();
  await expect(bilan.getByLabel('Synthèse')).toHaveValue(/\[Simulation\] Synthèse/);
  await bilan.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByTestId('bilan')).toContainText('brouillon');
  await deconnexion(page);

  // --- Le parent : conseils de l'assistant, puis quota atteint ----------------
  await connexion(page, 'Parent', c.parent.tel, c.parent.mdp);
  await page.goto(`/parent/enfant/${c.eleveId}/suivi`);
  await page.getByRole('button', { name: /Comprendre les résultats et aider mon enfant/ }).click();
  await expect(page.getByTestId('proposition-ia')).toContainText('Conseils de l’assistant');
  await page.getByRole('button', { name: /Comprendre les résultats et aider mon enfant/ }).click();
  await expect(page.getByText(/Limite quotidienne atteinte \(1 demandes\)/)).toBeVisible();
  await deconnexion(page);

  // --- Contrôle : aucun nom d'élève dans ce qui part au fournisseur ----------
  const admin = new Api(await jeton({ email: ADMIN.id, password: ADMIN.mdp }));
  const envois = await admin.lire<{ purpose: string; input_sent: string | null }[]>(
    `ai_requests?student_id=eq.${c.eleveId}&select=purpose,input_sent`);
  expect(envois.map((e) => e.purpose).sort()).toEqual(['analyse_eleve', 'brouillon_bilan', 'conseils_parent']);
  for (const e of envois) {
    expect(e.input_sent).toBeTruthy();
    expect(e.input_sent!.toLowerCase()).not.toContain(c.eleve.prenom.toLowerCase());
    expect(e.input_sent!.toLowerCase()).not.toContain(c.eleve.nom.toLowerCase());
  }

  // --- La direction voit l'utilisation ---------------------------------------
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  await page.goto('/parametres');
  await expect(page.getByRole('cell', { name: 'Exercices proposés' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Indices aux élèves' })).toBeVisible();
});
