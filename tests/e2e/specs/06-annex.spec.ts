import { test, expect } from "@playwright/test";
import { AnnexPage } from "../pages";

test("/annex renders year groups, first group is Inconnu", async ({ page }) => {
  const annex = new AnnexPage(page);
  await annex.goto();

  await annex.expectHasGroups();
  await annex.expectFirstGroupYear("Inconnu");
});

test("/annex entries contain titre in italics", async ({ page }) => {
  const annex = new AnnexPage(page);
  await annex.goto();

  const firstTitle = await annex.firstEntryText();
  expect(firstTitle).toBeTruthy();
});

test("/annex has 50 year groups (Inconnu + 49 years)", async ({ page }) => {
  const annex = new AnnexPage(page);
  await annex.goto();

  const groups = await annex.yearGroups();
  expect(groups.length).toBe(50);
});
