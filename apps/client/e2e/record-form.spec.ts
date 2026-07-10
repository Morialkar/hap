import { test, expect } from '@playwright/test';

const mockUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Test User', email: 'test@example.com' };

let databases = [{ id: 'db-1', name: 'Catalogue', workspace_id: 'w1' }];
let tables = [
  { id: 'tbl-1', name: 'Ouvrages', database_id: 'db-1' },
  { id: 'tbl-author', name: 'Auteurs', database_id: 'db-1' }
];

let fieldsForOuvrages = [
  { id: 'fld-1', name: 'Titre', type: 'text', position: 0, options: { max_length: 100 }, validation: { required: true }, table_id: 'tbl-1' },
  { id: 'fld-2', name: 'Auteur', type: 'reference', position: 1, options: { target_table: 'tbl-author' }, validation: {}, table_id: 'tbl-1' }
];

let fieldsForAuteurs = [
  { id: 'fld-a1', name: 'Nom', type: 'text', position: 0, options: {}, validation: { required: true }, table_id: 'tbl-author' }
];

type MockRecord = {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  version: number;
};

let recordsForOuvrages: MockRecord[] = [];
let recordsForAuteurs: MockRecord[] = [];

function mockRoutes(page: import('@playwright/test').Page) {
  page.route('**/api/v1/user', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
  });

  page.route('**/api/v1/databases/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(databases[0]) });
  });

  page.route('**/api/v1/tables/*', async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const table = tables.find((t) => t.id === id) || tables[0];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(table) });
  });

  page.route('**/api/v1/fields**', async (route) => {
    const url = new URL(route.request().url());
    const tableId = url.searchParams.get('table_id');
    const f = tableId === 'tbl-author' ? fieldsForAuteurs : fieldsForOuvrages;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(f) });
  });

  page.route('**/api/v1/records**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tableId = url.searchParams.get('table_id');

    if (req.method() === 'POST') {
      const body = await req.postDataJSON();
      const newRecord = {
        id: `rec-${Date.now()}`,
        table_id: body.table_id,
        data: body.data,
        version: 1
      };
      if (body.table_id === 'tbl-author') {
        recordsForAuteurs.push(newRecord);
      } else {
        recordsForOuvrages.push(newRecord);
      }
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newRecord) });
      return;
    }

    const items = tableId === 'tbl-author' ? recordsForAuteurs : recordsForOuvrages;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items, pagination: {} }) });
  });
}

test.describe('Record Forms and Ergonomics', () => {
  test.beforeEach(async ({ page }) => {
    recordsForOuvrages = [];
    recordsForAuteurs = [];
    mockRoutes(page);
    await page.goto('/tables/db-1/tbl-1');
  });

  test('creates a record with inline reference and checks counter', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ouvrages' })).toBeVisible();
    await expect(page.getByText('Aucune fiche pour le moment')).toBeVisible();

    // Open creation panel
    await page.click('[data-testid="add-record-btn"]');
    const createPanelTitle = page.getByRole('heading', { level: 2, name: 'Ajouter une fiche' });
    await expect(createPanelTitle).toBeVisible();

    // Fill Title and verify counter updates
    const titleInput = page.locator('[data-testid="field-input-Titre"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Le Petit Prince');
    await expect(page.locator('text=15 / 100 caractères')).toBeVisible();

    // Click plus next to reference dropdown to create inline author
    await page.click('[data-testid="inline-create-Auteur"]');

    // Modal opens
    const modal = page.locator('.modal.show');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toContainText('Créer une référence');

    // Fill inline author name and save
    const authorNameInput = modal.locator('[data-testid="field-input-Nom"]');
    await authorNameInput.fill('Antoine de Saint-Exupéry');
    await modal.locator('[data-testid="save-record"]').click();

    // Modal closes and new author is selected in select dropdown
    await expect(modal).not.toBeVisible();
    const select = page.locator('select[data-testid="field-input-Auteur"]');
    await expect(select).toHaveValue(/rec-.*/);

    // Save record
    await page.click('[data-testid="save-record"]');

    // Form closes and record is in table list
    await expect(createPanelTitle).not.toBeVisible();
    await expect(page.locator('text=Le Petit Prince')).toBeVisible();
  });

  test('unsaved changes guard blocks cancel action when form is dirty', async ({ page }) => {
    // Open creation panel
    await page.click('[data-testid="add-record-btn"]');
    const createPanelTitle = page.getByRole('heading', { level: 2, name: 'Ajouter une fiche' });
    await expect(createPanelTitle).toBeVisible();

    // Type in form (dirty)
    const titleInput = page.locator('[data-testid="field-input-Titre"]');
    await titleInput.fill('Draft Work');

    // Set dialog handler to cancel the confirm pop-up
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('modifications non enregistrées');
      await dialog.dismiss();
    });

    // Clicks close/cancel
    await page.click('.btn-close');

    // Form should remain open
    await expect(createPanelTitle).toBeVisible();

    // Now set dialog handler to accept the pop-up
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Clicks close/cancel again
    await page.click('.btn-close');

    // Form should be closed
    await expect(createPanelTitle).not.toBeVisible();
  });
});
