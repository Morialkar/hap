import { test, expect } from "@playwright/test";
import { BrowsePeriodiquePage, PeriodiqueDetailPage } from "../pages/v2/BrowsePeriodiquePage";

test("browse périodiques by titre shows 17 entries", async ({ page }) => {
  const browse = new BrowsePeriodiquePage(page);
  await browse.goto();
  await expect(page).toHaveTitle(/Eusebe/i);

  const links = await browse.periodiqueLinks();
  expect(links.length).toBe(17);
});

test("browse périodiques by titre → open detail → verify fields", async ({ page }) => {
  const browse = new BrowsePeriodiquePage(page);
  await browse.goto();

  const links = await browse.periodiqueLinks();
  expect(links.length).toBeGreaterThan(0);

  const target = links.find((l) => l.titre.trim() !== "");
  expect(target).toBeDefined();
  expect(target!.titre.trim()).toBeTruthy();

  const detail = new PeriodiqueDetailPage(page);
  await detail.goto(target!.id);

  const fields = await detail.fields();
  expect(Object.keys(fields).length).toBeGreaterThan(0);
});
