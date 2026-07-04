/**
 * Write-path journeys for périodiques: create + edit.
 * Reseeds in afterAll.
 */

import { test, expect } from "@playwright/test";
import { AddPeriodiquePage, EditPeriodiquePage } from "../pages/v2/AddEditPeriodiquePage";
import { BrowsePeriodiquePage, PeriodiqueDetailPage } from "../pages/v2/BrowsePeriodiquePage";
import { reseedCapsule } from "../helpers/reseed";

let createdPeriodiqueId: number | null = null;

test.afterAll(() => {
  reseedCapsule();
});

test("create périodique → appears in browse-by-titre", async ({ page }) => {
  const addPage = new AddPeriodiquePage(page);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/frequence")),
    addPage.goto(),
  ]);

  await addPage.fill({
    titre: "E2E-TEST-PERIODIQUE",
    description: "Test périodique",
    debut: "1870-01-01",
    fin: "1880-01-01",
    frequenceId: "1",
    editeurId: "3",
    imprimeurId: "2",
  });

  await addPage.submit();
  await expect(page.locator("body")).toContainText("Ajouter");

  const browse = new BrowsePeriodiquePage(page);
  await browse.goto();

  const links = await browse.periodiqueLinks();
  const created = links.find((l) => l.titre.includes("E2E-TEST-PERIODIQUE"));
  expect(created).toBeDefined();

  if (created) createdPeriodiqueId = created.id;
});

test("edit périodique → verify persistence via fresh GET", async ({ page }) => {
  expect(createdPeriodiqueId).not.toBeNull();
  const id = createdPeriodiqueId!;

  const editPage = new EditPeriodiquePage(page);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ajax/loadchoices/frequence")),
    editPage.goto(id),
  ]);

  await editPage.fill({ titre: "E2E-TEST-PERIODIQUE-EDITED" });
  await editPage.submit();

  const detail = new PeriodiqueDetailPage(page);
  await detail.goto(id);

  const titre = await detail.titre();
  expect(titre).toContain("E2E-TEST-PERIODIQUE-EDITED");
});
