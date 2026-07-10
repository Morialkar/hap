import { test, expect } from '@playwright/test';

const mockUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Test User', email: 'test@example.com' };

let databases = [
  { id: 'db-1', name: 'Catalogue', workspace_id: 'w1' }
];
let tables = [
  { id: 'tbl-1', name: 'Ouvrages', database_id: 'db-1' }
];
let fields = [
  { id: 'fld-1', name: 'Titre', type: 'text', position: 0, options: {}, validation: {}, table_id: 'tbl-1' },
  { id: 'fld-2', name: 'Auteur', type: 'text', position: 1, options: {}, validation: {}, table_id: 'tbl-1' },
  { id: 'fld-3', name: 'Année', type: 'number', position: 2, options: {}, validation: {}, table_id: 'tbl-1' }
];
type MockView = {
  id: string;
  name?: string;
  table_id?: string;
  type?: string;
  config?: unknown;
};

let views: MockView[] = [];

function mockRoutes(page: import('@playwright/test').Page) {
  page.route('**/api/v1/user', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
  });

  page.route('**/api/v1/databases/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(databases[0]) });
  });

  page.route('**/api/v1/tables/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables[0]) });
  });

  page.route(/.*\/api\/v1\/tables(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables) });
  });

  page.route('**/api/v1/fields**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fields) });
  });

  page.route('**/api/v1/views**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const view = { id: `view-${Date.now()}`, ...body };
      views.push(view);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(view) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(views) });
  });

  page.route('**/api/v1/views/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const id = url.pathname.split('/').pop() || '';
    if (req.method() === 'DELETE') {
      views = views.filter((v) => v.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    const body = await req.postDataJSON();
    const index = views.findIndex((v) => v.id === id);
    if (index !== -1) {
      views[index] = { ...views[index], ...body };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(views.find((v) => v.id === id)) });
  });
}

test.describe('Card Layout Builder', () => {
  test.beforeEach(async ({ page }) => {
    views = [];
    mockRoutes(page);
    await page.goto('/builder/db-1/tbl-1');
  });

  test('switches tabs and creates a new layout view', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ouvrages' })).toBeVisible();

    // Click the layout/disposition tab
    const layoutTab = page.locator('[data-testid="layout-tab"]');
    await expect(layoutTab).toBeVisible();
    await layoutTab.click();

    // Verify view has switched
    await expect(page.locator('h4')).toContainText('Éditeur de disposition');
    await expect(page.locator('p:has-text("Choisir une vue")')).toBeVisible();

    // Create a new view
    await page.fill('input[placeholder="Nom de la vue (ex. Aperçu Principal)"]', 'Vue Principale');
    await page.click('button:has-text("Créer")');

    // View should be selected and columns control visible
    await expect(page.locator('select')).toHaveValue(/view-.*/);
    await expect(page.locator('text=Nombre de colonnes')).toBeVisible();
    
    // Choose 2 columns
    await page.click('button:has-text("2 colonnes")');
    await expect(page.locator('text=Colonne 1')).toBeVisible();
    await expect(page.locator('text=Colonne 2')).toBeVisible();

    // Verify save button works
    await page.click('button:has-text("Enregistrer la disposition")');
    await expect(page.locator('text=Disposition enregistrée avec succès !')).toBeVisible();
  });
});
