import { test, expect } from '@playwright/test';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Test User',
  email: 'test@example.com',
};

let databases: Array<{ id: string; name: string; workspace_id: string }> = [];
let tables: Array<{ id: string; name: string; database_id: string }> = [];
let fields: Array<{
  id: string;
  name: string;
  type: string;
  position: number;
  options: Record<string, unknown>;
  validation: Record<string, unknown>;
  table_id: string;
}> = [];

function mockRoutes(page: import('@playwright/test').Page) {
  page.route('**/api/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });

  page.route('**/api/v1/databases**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const db = {
        id: `db-${Date.now()}`,
        name: body.name,
        workspace_id: body.workspace_id || 'workspace-1',
      };
      databases.push(db);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(db),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(databases),
    });
  });

  page.route('**/api/v1/tables**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const table = { id: `tbl-${Date.now()}`, name: body.name, database_id: body.database_id };
      tables.push(table);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(table),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tables),
    });
  });

  page.route('**/api/v1/fields**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const field = { id: `fld-${Date.now()}`, ...body };
      fields.push(field);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(field),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fields),
    });
  });

  page.route('**/api/v1/fields/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const id = url.pathname.split('/').pop() || '';
    if (req.method() === 'DELETE') {
      fields = fields.filter((f) => f.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    const body = await req.postDataJSON();
    const index = fields.findIndex((f) => f.id === id);
    if (index !== -1) {
      fields[index] = { ...fields[index], ...body };
    } else {
      fields.push({ id, ...body });
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fields.find((f) => f.id === id)),
    });
  });

  page.route('**/api/v1/fields/*/preview-impact', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ affected_records: 0, orphaned_values: 0, coercion_required: false }),
    });
  });

  page.route('**/api/v1/fields/*/confirmation-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'token-123' }),
    });
  });
}

test.describe('Structure Builder', () => {
  test.beforeEach(async ({ page }) => {
    databases = [];
    tables = [];
    fields = [];
    mockRoutes(page);
    await page.goto('/workspaces');
  });

  test('builds a small table from scratch', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Espaces de travail');

    await page.fill('input[placeholder="Nouvelle base de données"]', 'Catalogue');
    await page.click('button:has-text("Créer")');
    await expect(page.locator('text=Catalogue')).toBeVisible();

    await page.locator('input[placeholder="Nouvelle table"]').first().fill('Ouvrages');
    await page.locator('input[placeholder="Nouvelle table"]').first().press('Enter');

    await page.waitForSelector('text=Ouvrages');
    await page.click('a:has-text("Éditeur de structure")');
    await expect(page).toHaveURL(/\/builder\/.*\/.*$/);

    await expect(page.locator('[role="list"] .text-muted')).toContainText('Aucun champ');

    const addText = page.locator('[data-testid="add-field-text"]');
    await expect(addText).toBeVisible();
    await addText.click();

    await page.fill('#field-name', 'Titre');
    await page.fill('#option-placeholder', "Titre de l'œuvre");
    await page.fill('#option-max_length', '255');

    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('text=Brouillon enregistré automatiquement')).toBeVisible();
  });

  test('delete-field flow shows impact preview', async ({ page }) => {
    databases.push({ id: 'db-1', name: 'Catalogue', workspace_id: 'w1' });
    tables.push({ id: 'tbl-1', name: 'Ouvrages', database_id: 'db-1' });
    fields.push({
      id: 'fld-1',
      name: 'Titre',
      type: 'text',
      position: 0,
      options: {},
      validation: {},
      table_id: 'tbl-1',
    });

    await page.route('**/api/v1/fields/*/preview-impact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          affected_records: 12,
          orphaned_values: 3,
          coercion_required: false,
        }),
      });
    });

    await page.goto('/builder/db-1/tbl-1');

    await expect(page.locator('[role="list"]').getByText('Titre')).toBeVisible();

    await page.locator('[role="list"] button[aria-label="Retirer"]').first().click();

    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Changement destructif');
    await expect(modal).toContainText('12 fiches concernées');
    await expect(modal).toContainText('3 valeurs orphelines seront conservées');

    await modal.locator('button:has-text("Confirmer la modification")').click();
    await expect(modal).not.toBeVisible();
    await expect(page.locator('[role="list"]').getByText('Titre')).not.toBeVisible();
  });
});
