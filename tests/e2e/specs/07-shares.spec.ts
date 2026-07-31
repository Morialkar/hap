import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.skip(process.env.E2E_TARGET !== "v3", "Sharing is only supported in v3");
});

test("authenticated user can create share and public logged-out user can view it", async ({ page, browser }) => {
  // 1. Authenticate API request context
  await page.request.post("/api/v1/login", {
    data: {
      email: process.env.E2E_V3_EMAIL ?? "test@example.com",
      password: process.env.E2E_V3_PASSWORD ?? "password",
    },
  });

  // 2. Discover Database
  const dbResp = await page.request.get("/api/v1/databases");
  expect(dbResp.ok()).toBeTruthy();
  const databases = await dbResp.json();
  const database = databases.find((d: any) => /eusebe|catalogue/i.test(d.name)) || databases[0];
  expect(database).toBeDefined();

  // 3. Discover Table
  const tblResp = await page.request.get(`/api/v1/tables?database_id=${database.id}`);
  expect(tblResp.ok()).toBeTruthy();
  const tables = await tblResp.json();
  const table = tables.find((t: any) => /ouvrage/i.test(t.name)) || tables[0];
  expect(table).toBeDefined();

  // 4. Discover Record
  const recResp = await page.request.get(`/api/v1/records?table_id=${table.id}&per_page=1`);
  expect(recResp.ok()).toBeTruthy();
  const recordsData = await recResp.json();
  const record = recordsData.data[0];
  expect(record).toBeDefined();

  // 5. Create Share Link
  const shareResp = await page.request.post(`/api/v1/databases/${database.id}/shares`, {
    data: {
      name: "Partage E2E Ouvrage",
      target_type: "record",
      target_id: record.id,
    }
  });
  expect(shareResp.ok()).toBeTruthy();
  const share = await shareResp.json();
  expect(share.token).toBeDefined();

  // 6. Access Share Link with a clean unauthenticated context
  const cleanContext = await browser.newContext();
  const cleanPage = await cleanContext.newPage();
  
  cleanPage.on('console', msg => console.log('PAGE LOG:', msg.text()));
  cleanPage.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const publicShareResponse = cleanPage.waitForResponse(
    (response) => response.url().endsWith(`/api/v1/shares/${share.token}`),
  );
  await cleanPage.goto(`/public-shares/${share.token}`);
  expect((await publicShareResponse).ok()).toBeTruthy();

  // 7. Verify elements on the page (Public view layout is read-only)
  await expect(cleanPage.locator("body")).toContainText("Partage Public");
  await expect(cleanPage.locator("body")).toContainText("Partage E2E Ouvrage");

  // 8. Confirm Sidebar Navigation is not present
  await expect(cleanPage.locator(".hap-topbar")).not.toBeVisible();
  await expect(cleanPage.locator("header")).not.toBeVisible();

  await cleanContext.close();
});
