import { test, expect } from "@playwright/test";
import { DashboardPage } from "../pages";

test("dashboard shows 470 ouvrages, 213 auteurs, 17 périodiques", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.expectReady();
  await dashboard.expectCounts(470, 213, 17);
});
