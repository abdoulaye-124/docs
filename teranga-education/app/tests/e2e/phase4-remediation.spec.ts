import { expect, test } from '@playwright/test';
import { ADMIN, Api, connexion, connexionEleve, deconnexion, jeton, preparerCentre } from './outils';

// Scénario Phase 4 : étapes T12, T13 et T14 du scénario de validation, dans
// l'interface, sur PC et sur Android. DONNÉES FICTIVES ; référentiel PROVISOIRE.

test.describe.configure({ mode: 'serial' });

test('Phase 4 : difficulté repérée, diagnostic, remédiation validée, résultats après remédiation, bilan', async ({ page }, info) => {
  const sfx = info.project.name === 'pc' ? 'PC4' : 'AND4';
  const c = await preparerCentre(sfx, info.project.name === 'pc' ? 1 : 2, '75');

  // --- Préparation par l'API : leçon, exercices, premières copies ratées ----
  const enc = new Api(await jeton({ phone: `+221${c.encadreur.tel.replace(/\s/g, '')}`, password: c.encadreur.mdp }));
  const noeud = async (code: string) => (await enc.lire<{ id: string }[]>(`curriculum_nodes?code=eq.${code}&select=id`))[0].id;
  const [div, tables] = [await noeud('P-M-03'), await noeud('P-M-01')];
  const lecon = await enc.inserer('lessons', { title: `Division ${sfx}`, level_code: 'CE2', author_id: c.encadreurId, status: 'valide',
    validated_by: c.encadreurId, content: [{ type: 'explication', texte: 'Diviser, c’est partager.' }] });
  await enc.inserer('lesson_objectives', { lesson_id: lecon.id, node_id: div });
  const exercice = async (prompt: string, reponse: string, node: string, lessonId: string | null, difficulty: number) => {
    const e = await enc.inserer('exercises', { lesson_id: lessonId, level_code: 'CE2', kind: 'reponse_courte', prompt, difficulty,
      author_id: c.encadreurId, status: 'valide', validated_by: c.encadreurId });
    await enc.inserer('exercise_keys', { exercise_id: e.id, answer_key: { accepted: [reponse] }, explanation: `Réponse : ${reponse}` });
    await enc.inserer('exercise_objectives', { exercise_id: e.id, node_id: node });
    return e.id;
  };
  const ex1 = await exercice('18 ÷ 3 = ?', '6', div, lecon.id, 1);
  const ex2 = await exercice('24 ÷ 4 = ?', '6', div, lecon.id, 2);
  await exercice('Table de 3 : 3 × 5 = ?', '15', tables, null, 1);
  await enc.inserer('publications', { lesson_id: lecon.id, group_id: c.groupeId, published_by: c.encadreurId });

  const el = new Api(await jeton({ email: `${c.eleve.login}@eleves.teranga.invalid`, password: `img-${c.eleve.code.join('-')}-${c.eleve.login}` }));
  for (const ex of [ex1, ex2]) {
    const sub = await el.rpc<string>('submit_answer', { p_exercise: ex, p_answer: { text: '7' } });
    await enc.inserer('corrections', { submission_id: sub, corrector_id: c.encadreurId, score: 0, max_score: 1 });
  }

  // --- T12 : l'encadreur identifie la difficulté -----------------------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await expect(page.getByText('Objectifs en alerte')).toBeVisible();
  await page.goto('/suivi');
  const alerte = page.getByTestId('alerte').filter({ hasText: c.eleve.nom });
  await expect(alerte).toContainText('P-M-03');
  await expect(alerte).toContainText('Non acquis');
  await expect(alerte).toContainText('0 %');
  await alerte.getByRole('link', { name: 'Diagnostiquer' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnostic' })).toBeVisible();
  const prerequis = page.getByTestId('prerequis');
  await expect(prerequis).toContainText('Connaître les tables de multiplication de 2 à 9');
  await expect(prerequis).toContainText('non évalué');
  await expect(page.getByText(/2 prérequis non maîtrisé\(s\) ou jamais évalué\(s\)/)).toBeVisible();

  // --- T13 : remédiation proposée, vérifiée et validée par l'encadreur -------
  await page.getByRole('button', { name: 'Proposer un programme' }).click();
  await expect(page.getByRole('heading', { name: /Remédiation ·/ })).toBeVisible();
  await expect(page.getByText('proposé, à valider')).toBeVisible();
  const etapes = page.getByTestId('etape');
  await expect(etapes.first()).toContainText('3 × 5');             // le prérequis d'abord
  await expect(etapes.filter({ hasText: '18 ÷ 3' })).toHaveCount(1); // puis les exercices ratés
  await expect(etapes.filter({ hasText: '24 ÷ 4' })).toHaveCount(1);
  // L'encadreur garde la main : il retire les étapes qu'il juge inutiles.
  const nosConsignes = /3 × 5|18 ÷ 3|24 ÷ 4/;
  for (let i = 0; i < 10; i++) {
    const autre = etapes.filter({ hasNotText: nosConsignes });
    if (await autre.count() === 0) break;
    await autre.first().getByRole('button', { name: 'Retirer' }).click();
    await expect(etapes.filter({ hasNotText: nosConsignes })).toHaveCount((await autre.count()) - 1).catch(() => undefined);
  }
  await expect(etapes.filter({ hasNotText: nosConsignes })).toHaveCount(0);
  const nbEtapes = await etapes.count();
  const diag = page.getByLabel('Diagnostic (modifiable avant validation)');
  await expect(diag).toHaveValue(/tables de multiplication/);
  await diag.fill(`${await diag.inputValue()}\nObservation de l’encadreur : confond partage et soustraction.`);
  await page.getByRole('button', { name: 'Valider le programme' }).click();
  await expect(page.getByText('Programme validé. Les parents en sont informés.')).toBeVisible();
  await expect(page.getByTestId('diagnostic')).toContainText('confond partage et soustraction');
  await page.getByRole('button', { name: /Lancer/ }).click();
  await expect(page.getByText(/Programme lancé : \d+ exercice\(s\) publié\(s\)/)).toBeVisible();
  const urlPlan = page.url();
  await deconnexion(page);

  // --- L'élève fait les exercices du programme -------------------------------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.getByRole('link', { name: /Mes exercices/ }).click();
  const reponses: Record<string, string> = { '3 × 5': '15', '18 ÷ 3': '6', '24 ÷ 4': '6' };
  for (let i = 0; i < nbEtapes; i++) {
    await page.goto('/eleve/exercices');
    await page.getByRole('link', { name: /Exercice 1/ }).click();
    const consigne = (await page.getByTestId('consigne').textContent())!;
    const cle = Object.keys(reponses).find((k) => consigne.includes(k))!;
    await page.getByLabel('Ma réponse').fill(reponses[cle]);
    await page.getByRole('button', { name: 'J’envoie ma réponse' }).click();
    await expect(page.getByText('Réponse envoyée !')).toBeVisible();
  }
  await page.goto('/eleve/exercices');
  await expect(page.getByText('Bravo, tout est fait !')).toBeVisible();
  await deconnexion(page);

  // --- T14 : correction, résultats après remédiation enregistrés --------------
  await connexion(page, 'Personnel', c.encadreur.tel, c.encadreur.mdp);
  await page.goto('/corrections');
  await page.getByRole('button', { name: `Valider les ${nbEtapes} notes automatiques` }).click();
  await expect(page.getByText('Aucune copie en attente.')).toBeVisible();
  await page.goto(urlPlan);
  await expect(page.getByText('fait le', { exact: false })).toHaveCount(nbEtapes);
  const avantApres = page.getByTestId('avant-apres');
  await expect(avantApres).toContainText('Avant :');
  await expect(avantApres).toContainText('Non acquis');
  await expect(avantApres).toContainText('En cours d’acquisition');
  await expect(avantApres).toContainText(`étapes faites : ${nbEtapes} / ${nbEtapes}`);
  await page.getByRole('button', { name: 'Clôturer le programme' }).click();
  await expect(page.getByText('Programme clôturé. Les résultats après remédiation sont enregistrés dans le dossier.')).toBeVisible();

  // Dossier : tableau de progression, observation partagée / interne, bilan
  await page.goto(`/eleves/${c.eleveId}/suivi`);
  const ligneDiv = page.getByTestId('ligne-progression').filter({ hasText: 'P-M-03' });
  await expect(ligneDiv).toContainText('Non acquis');
  await expect(ligneDiv).toContainText('En cours d’acquisition');
  await expect(ligneDiv).toContainText('↗ progrès');
  await page.getByRole('button', { name: '+ Observation' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel('Observation').fill('Note interne : à revoir avec la coordination.');
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('button', { name: '+ Observation' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Observation').fill('Moussa participe davantage et ose poser des questions.');
  await d.getByLabel('Partager avec les parents').check();
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Moussa participe davantage')).toBeVisible();
  await page.getByRole('button', { name: '+ Bilan' }).click();
  d = page.getByRole('dialog');
  await expect(d.getByLabel('Compétences')).toHaveValue(/Diviser .* : En cours d’acquisition/);
  await d.getByLabel('Synthèse').fill('Progrès nets en division après le travail sur les tables.');
  await d.getByLabel('Recommandations pour la maison').fill('Réciter la table de 3 chaque soir, 5 minutes.');
  await d.getByRole('button', { name: 'Envoyer aux parents' }).click();
  await expect(page.getByTestId('bilan')).toContainText('envoyé le');
  await deconnexion(page);

  // --- Le parent suit : notifications, progression, programme, bilan ---------
  await connexion(page, 'Parent', c.parent.tel, c.parent.mdp);
  await expect(page.getByTestId('notifications')).toContainText('Un programme de remédiation a été mis en place');
  await expect(page.getByTestId('notifications')).toContainText('Nouveau bilan disponible');
  await page.getByRole('link', { name: /Compétences, bilans et remédiation/ }).click();
  await expect(page.getByTestId('ligne-progression').filter({ hasText: 'P-M-03' })).toContainText('↗ progrès');
  await expect(page.getByText('terminé')).toBeVisible();
  await expect(page.getByText('Moussa participe davantage')).toBeVisible();
  await expect(page.getByText('Note interne')).toHaveCount(0);
  await expect(page.getByTestId('bilan')).toContainText('Réciter la table de 3 chaque soir');
  await expect(page.getByRole('button', { name: 'Ajuster' })).toHaveCount(0);
  await deconnexion(page);

  // --- L'élève voit ses progrès (étoiles, sans classement) -------------------
  await connexionEleve(page, c.eleve.login, c.eleve.code);
  await page.goto('/eleve/resultats');
  await expect(page.getByTestId('progres').filter({ hasText: 'Diviser' }).getByLabel('2 étoile(s) sur 3')).toBeVisible();
  await deconnexion(page);

  // --- Direction : vue d'ensemble ------------------------------------------
  await connexion(page, 'Personnel', ADMIN.id, ADMIN.mdp);
  await expect(page.getByRole('heading', { name: 'Suivi pédagogique' })).toBeVisible();
});
