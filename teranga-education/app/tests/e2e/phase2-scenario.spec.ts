import { expect, test, type Page } from '@playwright/test';

// Scénario Phase 2 (étapes T1 à T4 du scénario de validation, et au-delà) :
// rejoué dans l'interface, sur PC et sur téléphone Android.
// TOUTES LES DONNÉES SONT FICTIVES.

const ADMIN = { id: 'admin@demo.teranga.invalid', mdp: 'Admin-demo-2026' };

test.describe.configure({ mode: 'serial' });

/** Suffixe unique par projet (pc / android) pour que les deux passages coexistent. */
function jeu(projet: string) {
  const n = projet === 'pc' ? 1 : 2;
  return {
    suffixe: projet.toUpperCase(),
    telEncadreur: `77 000 10 0${n}`,
    telParent: `77 000 20 0${n}`,
    telAutreParent: `77 000 30 0${n}`,
    groupe: `Groupe CE2 ${projet.toUpperCase()}`,
    salle: `Salle ${projet.toUpperCase()}`,
  };
}

async function connexion(page: Page, onglet: 'Personnel' | 'Parent', identifiant: string, mdp: string) {
  await page.goto('/connexion');
  await page.getByRole('tab', { name: onglet }).click();
  await page.getByLabel(onglet === 'Parent' ? 'Numéro de téléphone' : 'E-mail ou téléphone').fill(identifiant);
  await page.getByLabel('Mot de passe').fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

async function deconnexion(page: Page) {
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByRole('tab', { name: 'Parent' })).toBeVisible();
}

async function creerCompte(page: Page, url: string, bouton: string, f: { prenom: string; nom: string; tel: string; fonction?: string }) {
  await page.goto(url);
  await page.getByRole('button', { name: bouton }).click();
  const d = page.getByRole('dialog');
  if (f.fonction) await d.getByLabel('Fonction').selectOption({ label: f.fonction });
  await d.getByLabel('Prénom').fill(f.prenom);
  await d.getByLabel(/^Nom( \*)?$/).fill(f.nom);
  await d.getByLabel(/^Téléphone( \*)?$/).fill(f.tel);
  const mdp = (await d.getByTestId('mdp-provisoire').textContent())!.trim();
  await d.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText(/Compte (parent )?créé/)).toBeVisible();
  return mdp;
}

test('Scénario Phase 2 : inscription, parent, groupe, encadreur, séance, présences et cloisonnement', async ({ page }, info) => {
  const j = jeu(info.project.name);

  // --- Direction : connexion -----------------------------------------------
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  await expect(page.getByRole('heading', { name: 'Tableau de bord de la direction' })).toBeVisible();

  // Paramètres : une salle
  await page.goto('/parametres');
  await page.getByLabel('Nom').fill(j.salle);
  await page.getByRole('button', { name: 'Ajouter' }).first().click();
  await expect(page.getByText(j.salle)).toBeVisible();

  // Comptes : un encadreur et deux parents
  const mdpEncadreur = await creerCompte(page, '/personnel', '+ Nouveau compte',
    { prenom: 'Moussa', nom: `ENCADREUR-${j.suffixe}`, tel: j.telEncadreur, fonction: 'Encadreur' });
  const mdpParent = await creerCompte(page, '/parents', '+ Nouveau parent',
    { prenom: 'Aminata', nom: `PARENT-${j.suffixe}`, tel: j.telParent });
  const mdpAutreParent = await creerCompte(page, '/parents', '+ Nouveau parent',
    { prenom: 'Ibrahima', nom: `AUTRE-${j.suffixe}`, tel: j.telAutreParent });

  // --- T1 : inscription d'un élève de CE2 ------------------------------------
  await page.goto('/eleves/nouveau');
  await page.getByLabel('Prénom').fill('Awa');
  await page.getByLabel(/^Nom( \*)?$/).fill(`ELEVE-${j.suffixe}`);
  await page.getByLabel('Date de naissance').fill('2017-03-12');
  await page.getByLabel('Niveau').selectOption('CE2');
  await page.getByLabel("Établissement d'origine").fill('École fictive de test');
  await page.getByRole('button', { name: "Inscrire l'élève" }).click();
  await expect(page.getByText('Élève inscrit.')).toBeVisible();
  await expect(page.getByText(/TE-\d{4}-\d{4}/)).toBeVisible();
  const urlEleve = page.url().split('?')[0];

  // --- T2 : association du parent et consentements --------------------------
  await page.getByRole('button', { name: '+ Associer un parent' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel('Parent / tuteur').selectOption({ label: `Aminata PARENT-${j.suffixe} · +221 ${j.telParent}` });
  // Consentement obligatoire manquant : refus explicite
  await d.getByRole('button', { name: 'Associer et valider le lien' }).click();
  await expect(d.getByText(/consentement .* est obligatoire/i)).toBeVisible();
  await d.getByLabel(/Inscription et dossier pédagogique/).check();
  await d.getByLabel(/Compte de connexion de l’enfant/).check();
  await d.getByRole('button', { name: 'Associer et valider le lien' }).click();
  await expect(page.getByText('lien validé')).toBeVisible();

  // --- T3 : groupe principal CE2 et affectation -----------------------------
  await page.goto('/groupes');
  await page.getByRole('button', { name: '+ Nouveau groupe' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Nom du groupe').fill(j.groupe);
  await d.getByLabel('Niveau').selectOption('CE2');
  await d.getByRole('button', { name: 'Créer le groupe' }).click();
  await expect(page.getByRole('heading', { name: j.groupe })).toBeVisible();
  await page.getByLabel('Ajouter un élève').selectOption({ label: `Awa ELEVE-${j.suffixe} (CE2)` });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('link', { name: `Awa ELEVE-${j.suffixe}` })).toBeVisible();

  // --- T4 : affectation de l'encadreur (groupe + référent) ------------------
  await page.getByLabel('Affecter un encadreur').selectOption({ label: `Moussa ENCADREUR-${j.suffixe}` });
  await page.getByRole('button', { name: 'Affecter', exact: true }).click();
  await expect(page.getByText(`Moussa ENCADREUR-${j.suffixe}`).last()).toBeVisible();

  await page.goto(urlEleve);
  await page.getByRole('button', { name: 'Modifier' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Encadreur référent').selectOption({ label: `Moussa ENCADREUR-${j.suffixe}` });
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(`Moussa ENCADREUR-${j.suffixe}`).first()).toBeVisible();

  // Règle : un seul groupe principal
  await page.goto('/groupes');
  await page.getByRole('button', { name: '+ Nouveau groupe' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Nom du groupe').fill(`${j.groupe} bis`);
  await d.getByLabel('Niveau').selectOption('CE2');
  await d.getByRole('button', { name: 'Créer le groupe' }).click();
  await page.getByLabel('Ajouter un élève').selectOption({ label: `Awa ELEVE-${j.suffixe} (CE2)` });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText('déjà un groupe principal')).toBeVisible();

  // Compte élève (après consentement)
  await page.goto(urlEleve);
  const identifiant = `awa.${j.suffixe.toLowerCase()}`;
  await page.getByLabel('Identifiant proposé').fill(identifiant);
  await page.getByRole('button', { name: 'Créer le compte élève' }).click();
  const code = (await page.getByTestId('code-image').getAttribute('data-code'))!.split(',').map(Number);
  expect(code).toHaveLength(4);
  // L'identifiant est conservé dans le dossier (réimpression, nouveau code)
  await page.reload();
  await expect(page.getByText('Compte actif.')).toBeVisible();
  await expect(page.locator('span.font-mono', { hasText: identifiant })).toBeVisible();

  // --- Séance et détection des conflits -------------------------------------
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const programmer = async (titre: string, debut: string, fin: string) => {
    await page.goto('/seances');
    await page.getByRole('button', { name: '+ Programmer une séance' }).click();
    const m = page.getByRole('dialog');
    await m.getByLabel('Intitulé').fill(titre);
    await m.getByLabel('Encadreur').selectOption({ label: `Moussa ENCADREUR-${j.suffixe}` });
    await m.getByLabel('Date').fill(demain);
    await m.getByLabel('Début').fill(debut);
    await m.getByLabel('Fin').fill(fin);
    await m.getByLabel('Salle').selectOption({ label: j.salle });
    await m.getByLabel(j.groupe, { exact: true }).check();
    await m.getByRole('button', { name: 'Programmer' }).click();
    return m;
  };
  await programmer(`Mathématiques CE2 ${j.suffixe}`, '16:00', '17:30');
  await expect(page.getByRole('heading', { name: `Mathématiques CE2 ${j.suffixe}` })).toBeVisible();
  const urlSeance = page.url();
  const conflit = await programmer(`Conflit ${j.suffixe}`, '17:00', '18:00');
  await expect(conflit.getByText(/Conflit : l'encadreur a déjà une séance/)).toBeVisible();

  // Tableau de bord : effectifs
  await page.goto('/direction');
  await expect(page.getByText('Élèves inscrits')).toBeVisible();
  await deconnexion(page);

  // --- Encadreur : voit son élève, fait l'appel -----------------------------
  await connexion(page, 'Personnel', j.telEncadreur, mdpEncadreur);
  await expect(page.getByRole('heading', { name: 'Bonjour Moussa' })).toBeVisible();
  await page.goto('/eleves');
  await expect(page.getByRole('link', { name: new RegExp(`ELEVE-${j.suffixe}`) })).toBeVisible();
  await expect(page.getByText('1 élève(s)')).toBeVisible();
  await page.goto('/parents');   // interdit pour un encadreur
  await expect(page).toHaveURL(/\/encadreur$/);
  await page.goto(urlSeance);
  await page.getByRole('radio', { name: 'Présent' }).click();
  await page.getByLabel('Observations sur la séance').fill('Séance de test : bonne participation.');
  await page.getByRole('button', { name: "Enregistrer l'appel" }).click();
  await expect(page.getByText('Présences et observations enregistrées.')).toBeVisible();
  await deconnexion(page);

  // --- Parent : voit uniquement son enfant ----------------------------------
  await connexion(page, 'Parent', j.telParent, mdpParent);
  await expect(page.getByRole('heading', { name: 'Bonjour Aminata' })).toBeVisible();
  await expect(page.getByText(`Awa ELEVE-${j.suffixe}`)).toBeVisible();
  await expect(page.getByText(`Mathématiques CE2 ${j.suffixe}`)).toBeVisible();
  await page.getByRole('link', { name: 'Voir le dossier →' }).click();
  await expect(page.getByText('Présent', { exact: true })).toBeVisible();
  await expect(page.getByText('Difficultés initiales')).toHaveCount(0);
  await deconnexion(page);

  // --- Autre parent : ne voit rien ------------------------------------------
  await connexion(page, 'Parent', j.telAutreParent, mdpAutreParent);
  await expect(page.getByText("Aucun enfant n'est encore associé à votre compte.")).toBeVisible();
  await expect(page.getByText(`ELEVE-${j.suffixe}`)).toHaveCount(0);
  await page.goto(urlEleve.replace('/eleves/', '/parent/enfant/'));
  await expect(page.getByText('Dossier introuvable ou non accessible')).toBeVisible();
  await deconnexion(page);

  // --- Élève : connexion par code-image -------------------------------------
  await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Élève' }).click();
  await page.getByLabel('Mon identifiant').fill(identifiant);
  const noms = ['mangue', 'poisson', 'ballon', 'arbre', 'chèvre', 'soleil', 'lune', 'car', 'maison', 'coq', 'tam-tam', 'étoile'];
  for (const i of code) await page.getByRole('button', { name: noms[i], exact: true }).click();
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByRole('heading', { name: /Bonjour Awa/ })).toBeVisible();
  await expect(page.getByText(`Mathématiques CE2 ${j.suffixe}`)).toBeVisible();
});

test('Un mauvais code-image est refusé', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Élève' }).click();
  await page.getByLabel('Mon identifiant').fill('inconnu.99');
  for (const n of ['mangue', 'mangue', 'mangue', 'mangue']) await page.getByRole('button', { name: n, exact: true }).click();
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByText('Identifiant ou mot de passe incorrect.')).toBeVisible();
});

test('Aucune page interne sans connexion', async ({ page }) => {
  await page.goto('/eleves');
  await expect(page).toHaveURL(/\/connexion$/);
});

test("Pas de défilement horizontal de la page (téléphone et PC)", async ({ page }) => {
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  for (const url of ['/direction', '/eleves', '/groupes', '/seances', '/parents', '/personnel']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debord, `débordement sur ${url}`).toBeLessThanOrEqual(1);
  }
});
