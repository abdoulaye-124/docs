import { expect, test } from '@playwright/test';
import { ADMIN, connexion, connexionEleve, deconnexion, preparerCentre } from './outils';

// Scénario Phase 3 (étapes T5, T6, T8, T9, T10 et T11 du scénario de validation),
// rejoué dans l'interface sur PC et sur Android. DONNÉES FICTIVES ; référentiel PROVISOIRE.

test.describe.configure({ mode: 'serial' });

test('Phase 3 : référentiel provisoire, leçon, exercices, évaluation, correction, résultats', async ({ page }, info) => {
  const sfx = info.project.name === 'pc' ? 'PC' : 'AND';
  const c = await preparerCentre(sfx, info.project.name === 'pc' ? 1 : 2);
  const titre = `La division (${sfx})`;

  // --- Référentiel : provisoire signalé ; RG14 appliquée par la base ---------
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  await page.goto('/referentiel');
  await expect(page.getByText(/élément\(s\) provisoire\(s\), non officiel\(s\)/)).toBeVisible();
  await expect(page.getByText('P-M-03 · Diviser un nombre à deux chiffres par un nombre à un chiffre (CE2)')).toBeVisible();
  const ligne = page.locator('li', { hasText: 'P-M-03 · Diviser' }).last();   // l'élément le plus profond
  await ligne.getByRole('button', { name: 'Marquer vérifié' }).click();
  await expect(page.getByText("ne peut être marqué vérifié que s'il cite une source authentifiée")).toBeVisible();
  await deconnexion(page);

  // --- T5 : l'encadreur prépare, valide et publie une leçon ------------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto('/lecons/nouvelle');
  await page.getByLabel('Titre de la leçon').fill(titre);
  await page.getByLabel('Niveau').first().selectOption('CE2');
  await page.getByLabel('Matière').selectOption({ label: 'Mathématiques' });
  await page.getByLabel(/P-M-03/).check();
  await page.getByLabel('Explication (bloc 1)').fill('Diviser, c’est partager en parts égales.');
  await page.getByLabel('Exemple (bloc 2)').fill('12 mangues pour 3 enfants : chacun reçoit 4 mangues, car 3 × 4 = 12.');
  await page.getByLabel("Ce qu'il faut retenir (bloc 3)").fill('12 ÷ 3 = 4');
  await page.getByRole('button', { name: 'Valider la leçon' }).click();
  await expect(page.getByText('Leçon validée : elle peut être publiée.')).toBeVisible();
  await expect(page).toHaveURL(/\/lecons\/[0-9a-f-]{36}$/);

  // Exercice 1 : QCM
  await page.getByRole('button', { name: '+ Exercice' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel(/Consigne/).fill('Awa partage 15 bonbons entre 3 amis. Combien chacun en reçoit-il ?');
  await d.getByLabel('Réponse A', { exact: true }).fill('3');
  await d.getByLabel('Réponse B', { exact: true }).fill('5');
  await d.getByLabel('Réponse C', { exact: true }).fill('12');
  // Validation refusée sans bonne réponse
  await d.getByRole('button', { name: 'Enregistrer et valider' }).click();
  await expect(d.getByText('Indiquez la ou les bonnes réponses.')).toBeVisible();
  await d.getByLabel('Bonne réponse B').check();
  await d.getByLabel(/Correction expliquée/).fill('15 ÷ 3 = 5, car 3 × 5 = 15.');
  await d.getByRole('button', { name: 'Enregistrer et valider' }).click();
  await expect(page.getByText('Awa partage 15 bonbons')).toBeVisible();

  // Exercice 2 : réponse courte
  await page.getByRole('button', { name: '+ Exercice' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel("Type d'exercice").selectOption('reponse_courte');
  await d.getByLabel(/Consigne/).fill('Calcule : 20 ÷ 4 = ?');
  await d.getByLabel(/Réponses acceptées/).fill('5\ncinq');
  await d.getByLabel(/Correction expliquée/).fill('20 ÷ 4 = 5, car 4 × 5 = 20.');
  await d.getByRole('button', { name: 'Enregistrer et valider' }).click();
  await expect(page.getByText('Calcule : 20 ÷ 4 = ?')).toBeVisible();

  // Publication vers le groupe
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Groupe').selectOption({ label: c.groupe });
  await d.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Leçon publiée.')).toBeVisible();

  // Une leçon en brouillon (non publiée) ne sera jamais vue par l'élève
  await page.goto('/lecons/nouvelle');
  await page.getByLabel('Titre de la leçon').fill(`Brouillon secret ${sfx}`);
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByText('Leçon enregistrée.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publier', exact: true })).toHaveCount(0);
  await deconnexion(page);

  // --- T6 / T8 : l'élève lit la leçon et fait les exercices -----------------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.getByRole('link', { name: /Mes leçons/ }).click();
  await expect(page.getByText(`Brouillon secret ${sfx}`)).toHaveCount(0);
  await page.getByRole('link', { name: titre }).click();
  await expect(page.getByText('Diviser, c’est partager en parts égales.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Je m’exerce/ }).click();
  await expect(page.getByTestId('consigne')).toContainText('15 bonbons');
  await page.getByRole('button', { name: '3', exact: true }).click();     // mauvaise réponse
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Réponse envoyée !')).toBeVisible();
  await expect(page.getByText(/5, car 3 × 5/)).toHaveCount(0);           // pas de corrigé avant correction
  await page.getByRole('button', { name: 'Exercice suivant ›' }).click();
  await page.getByLabel('Ma réponse').fill(' Cinq ');
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Réponse envoyée !')).toBeVisible();
  await page.goto('/eleve/resultats');
  await expect(page.getByText('⏳ En attente de correction')).toHaveCount(2);
  await deconnexion(page);

  // --- T9 : l'encadreur corrige ---------------------------------------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await expect(page.getByText('Copies à corriger')).toBeVisible();
  await page.goto('/corrections');
  const copieQcm = page.locator('section', { hasText: '15 bonbons' });
  await expect(copieQcm.getByTestId('reponse-eleve')).toHaveText('A. 3');
  await expect(copieQcm.getByText('note automatique proposée : 0 / 1')).toBeVisible();
  await copieQcm.getByLabel(/Commentaire/).fill('Revois la table de 3 : 3 × 5 = 15.');
  await copieQcm.getByRole('button', { name: 'Valider la correction' }).click();
  await expect(page.locator('section', { hasText: '15 bonbons' })).toHaveCount(0);
  const copieCourte = page.locator('section', { hasText: '20 ÷ 4' });
  await expect(copieCourte.getByText('note automatique proposée : 1 / 1')).toBeVisible();
  await copieCourte.getByRole('button', { name: 'Valider la correction' }).click();
  await expect(page.getByText('Aucune copie en attente.')).toBeVisible();

  // Évaluation diagnostique composée des deux exercices, publiée à l'élève
  await page.goto('/evaluations/nouvelle');
  await page.getByLabel('Titre').fill(`Diagnostic division ${sfx}`);
  const deMaLecon = (debut: string) => page.getByLabel(new RegExp(`${debut}.*La division \\(${sfx}\\)`));
  await deMaLecon('15 bonbons').check();
  await deMaLecon('20 ÷ 4').check();
  await page.getByRole('button', { name: 'Enregistrer et valider' }).click();
  await expect(page.getByText('Évaluation enregistrée.')).toBeVisible();
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Publier vers').selectOption('eleve');
  await d.getByLabel(/^Élève/).selectOption({ label: `Moussa ${c.eleve.nom} (CE2)` });
  await d.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Évaluation publiée.')).toBeVisible();
  await deconnexion(page);

  // --- T11 : le parent consulte les résultats et la correction expliquée ----
  await connexion(page, 'Parent', c.parent.tel, c.parent.mdp);
  await page.getByRole('link', { name: 'Voir le dossier →' }).click();
  const resQcm = page.getByTestId('resultat').filter({ hasText: '15 bonbons' });
  await expect(resQcm.getByText('0 / 1')).toBeVisible();
  await expect(resQcm.getByText('« Revois la table de 3 : 3 × 5 = 15. »')).toBeVisible();
  await resQcm.getByRole('button', { name: 'Voir la correction expliquée' }).click();
  await expect(resQcm.getByTestId('correction-expliquee')).toHaveText('15 ÷ 3 = 5, car 3 × 5 = 15.');
  await deconnexion(page);

  // Un autre parent ne voit aucun résultat de cet enfant
  await connexion(page, 'Parent', c.autreParent.tel, c.autreParent.mdp);
  await page.goto(`/parent/enfant/${c.eleveId}`);
  await expect(page.getByText('Dossier introuvable ou non accessible')).toBeVisible();
  await deconnexion(page);

  // --- L'élève passe l'évaluation et voit ses résultats ---------------------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.getByRole('link', { name: /Mes exercices/ }).click();
  await page.getByRole('link', { name: new RegExp(`Diagnostic division ${sfx}`) }).click();
  await expect(page.getByText('Question 1 sur 2')).toBeVisible();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Question 2 sur 2')).toBeVisible();
  await page.getByLabel('Ma réponse').fill('5');
  await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
  await expect(page.getByText('Évaluation terminée !')).toBeVisible();
  await page.goto('/eleve/resultats');
  await expect(page.getByTestId('resultat').filter({ hasText: '20 ÷ 4' }).getByText('1 / 1').first()).toBeVisible();
  await deconnexion(page);

  // L'encadreur valide en une fois les notes automatiques de l'évaluation
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto('/corrections');
  await expect(page.getByText(`Diagnostic division ${sfx}`).first()).toBeVisible();
  await page.getByRole('button', { name: 'Valider les 2 notes automatiques' }).click();
  await expect(page.getByText('Aucune copie en attente.')).toBeVisible();
});
