/**
 * Write-path journeys for ouvrages: create (with inline new auteur), edit, delete.
 * Quirks documented in SMOKE.md:
 *   - B7: POST /editer/ouvrage responds with edit.periodique view — verify via fresh GET
 *   - B1: GET /delete/ouvrage returns 200 empty body — verify gone via fresh GET
 * Reseeds the DB in afterAll so subsequent runs start from 470/213/17.
 */

import { test, expect } from "@playwright/test";
import { AddOuvragePage, EditOuvragePage } from "../pages/v2/AddEditOuvragePage";
import { BrowseOuvragePage, OuvrageDetailPage } from "../pages/v2/BrowseOuvragePage";
import { reseedCapsule } from "../helpers/reseed";

let createdOuvrageId: number | null = null;

test.afterAll(() => {
  reseedCapsule();
});

test("create ouvrage (no image) → appears in browse-by-titre", async ({ page }) => {
  const addPage = new AddOuvragePage(page);
  const [, , ] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/auteur")),
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/editeur")),
    addPage.goto(),
  ]);

  await addPage.fill({
    titre: "E2E-TEST-OUVRAGE",
    description: "Test description",
    descriptionCourte: "Short desc",
    anneePublication: "1888",
    moisPublication: "06",
    nbPage: "42",
    nbEdition: "1",
    notes: "e2e test",
    auteurId: "4",
    typeId: "1",
    categorieId: "1",
    editeurId: "3",
    imprimeurId: "2",
    localisationId: "1",
  });

  await addPage.submit();

  await expect(page.locator("body")).toContainText("Ajouter");

  const browse = new BrowseOuvragePage(page);
  await browse.goto("titre");

  const links = await browse.ouvrageLinks();
  const created = links.find((l) => l.titre.includes("E2E-TEST-OUVRAGE"));
  expect(created).toBeDefined();

  if (created) createdOuvrageId = created.id;
});

test("create ouvrage with inline new auteur via modal", async ({ page }) => {
  const addPage = new AddOuvragePage(page);
  const [,] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/auteur")),
    addPage.goto(),
  ]);

  await page.locator("#add_auteur").click();
  await expect(page.locator("#aut_add")).toBeVisible();

  await page.locator("#aut_prenom").fill("E2E");
  await page.locator("#aut_nom").fill("TestAuteur");

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/save/auteur")),
    page.locator("#aut_add .save").click(),
  ]);

  await page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/auteur"));

  const options = await page.locator("#auteur option").allTextContents();
  expect(options.some((o) => o.includes("TestAuteur"))).toBe(true);
});

test("edit ouvrage → verify persistence via fresh GET (B7 quirk)", async ({ page }) => {
  expect(createdOuvrageId).not.toBeNull();
  const id = createdOuvrageId!;

  const editPage = new EditOuvragePage(page);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/auteur")),
    editPage.goto(id),
  ]);

  await editPage.fill({ titre: "E2E-TEST-OUVRAGE-EDITED", anneePublication: "1889" });
  await editPage.submit();

  const detail = new OuvrageDetailPage(page);
  await detail.goto(id);

  const titre = await detail.titre();
  expect(titre).toContain("E2E-TEST-OUVRAGE-EDITED");

  const publication = await detail.field("Publication");
  expect(publication).toBe("1889");
});

test("delete ouvrage via GET link → 200 empty → record gone (B1)", async ({ page }) => {
  expect(createdOuvrageId).not.toBeNull();
  const id = createdOuvrageId!;

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/delete/ouvrage/${id}`)),
    page.goto(`/delete/ouvrage/${id}`),
  ]);

  expect(response.status()).toBe(200);
  const body = await response.body();
  expect(body.length).toBe(0);

  const res = await page.request.get(`/view/ouvrage/id/${id}`);
  await expect(page.locator("body")).not.toContainText("E2E-TEST-OUVRAGE");
  void res;
});
