import { test, expect } from "@playwright/test";
import { BrowseOuvragePage, OuvrageDetailPage } from "../pages/v2/BrowseOuvragePage";

const DIMENSIONS = ["titre", "auteurs", "dates", "genre", "categorie"] as const;

for (const dim of DIMENSIONS) {
  test(`browse ouvrages by ${dim} shows entries`, async ({ page }) => {
    const browse = new BrowseOuvragePage(page);
    await browse.goto(dim);
    await expect(page).toHaveTitle(/Eusebe/i);

    if (dim === "titre") {
      const links = await browse.ouvrageLinks();
      expect(links.length).toBe(470);
      expect(links[0].id).toBeGreaterThan(0);
    } else {
      const links = await browse.dimensionLinks();
      expect(links.length).toBeGreaterThan(0);
    }
  });
}

test("browse ouvrages by titre → open detail page → verify fields", async ({ page }) => {
  const browse = new BrowseOuvragePage(page);
  await browse.goto("titre");

  const links = await browse.ouvrageLinks();
  const target = links.find((l) => l.id === 5);
  expect(target).toBeDefined();

  const detail = new OuvrageDetailPage(page);
  await detail.goto(5);

  const titre = await detail.titre();
  expect(titre).toContain("Iberville");

  const auteur = await detail.field("Auteur");
  expect(auteur).toBeTruthy();

  const publication = await detail.field("Publication");
  expect(publication).toMatch(/\d{4}/);

  const pages = await detail.field("Nombre de Pages");
  expect(pages).toMatch(/\d+/);
});

test("browse ouvrages by auteur → filtered list → detail", async ({ page }) => {
  const browse = new BrowseOuvragePage(page);
  await browse.goto("auteurs");
  await expect(page).toHaveTitle(/Eusebe/i);

  const first = page.locator("a[href*='/view/ouvrage/auteur/']").first();
  const href = (await first.getAttribute("href")) ?? "";
  await first.click();

  const ouvrageLinks = page.locator("a[href*='/view/ouvrage/id/']");
  await expect(ouvrageLinks.first()).toBeVisible();

  const firstOuvrage = ouvrageLinks.first();
  await firstOuvrage.click();

  const detail = new OuvrageDetailPage(page);
  const auteur = await detail.field("Auteur");
  expect(auteur).toBeTruthy();
  void href;
});

test("browse ouvrages by dates → filtered list → detail", async ({ page }) => {
  const browse = new BrowseOuvragePage(page);
  await browse.goto("dates");

  const yearLink = page.locator("a[href*='/view/ouvrage/dates/']").first();
  await yearLink.click();

  await expect(page.locator("a[href*='/view/ouvrage/id/']").first()).toBeVisible();
  await page.locator("a[href*='/view/ouvrage/id/']").first().click();

  const detail = new OuvrageDetailPage(page);
  const publication = await detail.field("Publication");
  expect(publication).toMatch(/\d+/);
});

test("browse ouvrages by genre → filtered list → detail", async ({ page }) => {
  const browse = new BrowseOuvragePage(page);
  await browse.goto("genre");

  await page.locator("a[href*='/view/ouvrage/genre/']").first().click();
  await expect(page.locator("a[href*='/view/ouvrage/id/']").first()).toBeVisible();
  await page.locator("a[href*='/view/ouvrage/id/']").first().click();

  const detail = new OuvrageDetailPage(page);
  const type = await detail.field("Type");
  expect(type).toBeTruthy();
});

test("browse ouvrages by catégorie → filtered list → detail", async ({ page }) => {
  const browse = new BrowseOuvragePage(page);
  await browse.goto("categorie");

  await page.locator("a[href*='/view/ouvrage/categorie/']").first().click();
  await expect(page.locator("a[href*='/view/ouvrage/id/']").first()).toBeVisible();
  await page.locator("a[href*='/view/ouvrage/id/']").first().click();

  const detail = new OuvrageDetailPage(page);
  const categorie = await detail.field("Catégorie");
  expect(categorie).toBeTruthy();
});
