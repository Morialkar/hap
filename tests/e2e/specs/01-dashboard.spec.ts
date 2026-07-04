import { test, expect } from "@playwright/test";
import { DashboardPage } from "../pages/v2/DashboardPage";

test("dashboard shows 470 ouvrages, 213 auteurs, 17 périodiques", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await expect(page).toHaveTitle(/Eusebe/i);
  await dashboard.expectCounts(470, 213, 17);
});
