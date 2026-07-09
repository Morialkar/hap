import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const mockUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Test User', email: 'test@example.com' };

let databases = [{ id: 'db-1', name: 'Catalogue', locale: 'fr-CA', workspace_id: 'w1' }];
let tables = [
  { id: 'tbl-1', name: 'Ouvrages', database_id: 'db-1' },
];

let fields = [
  { id: 'fld-1', name: 'Titre', type: 'text', position: 0, options: {}, validation: {}, table_id: 'tbl-1' },
  { id: 'fld-2', name: 'Année', type: 'number', position: 1, options: {}, validation: {}, table_id: 'tbl-1' },
];

let views = [
  {
    id: 'view-1',
    name: 'Default',
    table_id: 'tbl-1',
    type: 'card',
    config: {
      columnCount: 2,
      columns: [['fld-1'], ['fld-2']],
    },
  },
];

let records = [
  { id: 'rec-1', table_id: 'tbl-1', data: { Titre: 'Le Petit Prince', Année: 1943 }, version: 1 },
  { id: 'rec-2', table_id: 'tbl-1', data: { Titre: 'Vol de Nuit', Année: 1931 }, version: 1 },
  { id: 'rec-empty', table_id: 'tbl-1', data: {}, version: 1 },
  { id: 'rec-error', table_id: 'tbl-1', data: { Titre: 'Erreur' }, version: 1 },
];

let trashRecords = [
  { id: 'rec-trashed-1', table_id: 'tbl-1', data: { Titre: 'L\'Étranger', Année: 1942 }, deleted_at: '2026-07-08T23:30:00Z' }
];

let historyLogs = [
  {
    id: 101,
    action: 'update',
    changes: {
      diff: {
        Titre: { type: 'changed', old: 'Draft Title', new: 'Vol de Nuit' }
      }
    },
    user: { id: 'u1', name: 'Antoine' },
    created_at: '2026-07-08T23:00:00Z'
  }
];

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

  page.route('**/api/v1/fields**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fields) });
  });

  page.route('**/api/v1/views**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: views }) });
  });

  // Track records that are currently blocked by reference links
  let blockedRecordIds = new Set<string>(['rec-1']);

  // Handle general records listing (least specific; registered first so checked last)
  page.route(/.*\/api\/v1\/records(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: records, pagination: {} }) });
  });

  // Handle single record details request (GET / DELETE)
  page.route(/.*\/api\/v1\/records\/[^/?]+(?:\?.*)?$/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const id = url.pathname.split('/').pop() ?? '';

    if (req.method() === 'DELETE') {
      if (blockedRecordIds.has(id)) {
        // Mock a 409 conflict due to existing reference links
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Cannot delete record',
            reference_counts: {
              total: 3,
              by_table: { 'Ouvrages': 3 }
            }
          })
        });
      } else {
        // Success delete
        records = records.filter((r) => r.id !== id);
        await route.fulfill({ status: 204 });
      }
      return;
    }

    if (id === 'rec-error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Record lookup failed' }),
      });
      return;
    }

    const r = records.find((item) => item.id === id) || records[0];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
  });

  // Handle record sub-resource routes (must be registered after single-record route)
  page.route(/.*\/api\/v1\/records\/[^/?]+\/history(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: historyLogs }) });
  });

  // Handle reassign-links (unblocks the record so it can be deleted)
  page.route(/.*\/api\/v1\/records\/[^/?]+\/reassign-links(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[4] ?? '';
    blockedRecordIds.delete(id);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Success' }) });
  });

  // Handle restore-version
  page.route(/.*\/api\/v1\/records\/[^/?]+\/restore-version(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Restored' }) });
  });

  // Handle restore from trash
  page.route(/.*\/api\/v1\/records\/[^/?]+\/restore(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[4] ?? '';
    const trashed = trashRecords.find((t) => t.id === id);
    if (trashed) {
      records.push({ id: trashed.id, table_id: trashed.table_id, data: trashed.data, version: 1 });
      trashRecords = trashRecords.filter((t) => t.id !== id);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Restored' }) });
  });

  // Handle purge from trash
  page.route(/.*\/api\/v1\/records\/[^/?]+\/purge(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/')[4] ?? '';
    trashRecords = trashRecords.filter((t) => t.id !== id);
    await route.fulfill({ status: 204 });
  });

  // Handle trash listing (most specific; registered last so checked first)
  page.route(/.*\/api\/v1\/records\/trash(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: trashRecords }) });
  });
}

test.describe('List & Detail Views, Sorting, Filtering, and Audit log', () => {
  test.beforeEach(async ({ page }) => {
    records = [
      { id: 'rec-1', table_id: 'tbl-1', data: { Titre: 'Le Petit Prince', Année: 1943 }, version: 1 },
      { id: 'rec-2', table_id: 'tbl-1', data: { Titre: 'Vol de Nuit', Année: 1931 }, version: 1 },
      { id: 'rec-empty', table_id: 'tbl-1', data: {}, version: 1 },
      { id: 'rec-error', table_id: 'tbl-1', data: { Titre: 'Erreur' }, version: 1 },
    ];
    trashRecords = [
      { id: 'rec-trashed-1', table_id: 'tbl-1', data: { Titre: 'L\'Étranger', Année: 1942 }, deleted_at: '2026-07-08T23:30:00Z' }
    ];
    mockRoutes(page);
    await page.goto('/tables/db-1/tbl-1');
  });

  test('filters, sorts, and groups records in the list view', async ({ page }) => {
    // 1. Search Box
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('Petit');
    await expect(searchInput).toHaveValue('Petit');

    // 2. Sorting by column
    const titleHeader = page.locator('[data-testid="sort-header-Titre"]');
    await titleHeader.getByRole('button').click();
    await expect(titleHeader.locator('.ti-chevron-up')).toBeVisible();

    // 3. Grouping by field
    const groupSelect = page.locator('[data-testid="group-by-select"]');
    await groupSelect.selectOption('Année');
    await expect(page.locator('text=1943 — 1 ouvrages')).toBeVisible();
    await expect(page.locator('text=1931 — 1 ouvrages')).toBeVisible();
  });

  test('opens details layout and reverts version in history tab', async ({ page }) => {
    // Select first record row to open details panel
    await page.click('[data-testid="record-row-rec-1"]');

    const detailPanel = page.locator('[data-testid="detail-view"]');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator('text=Le Petit Prince')).toBeVisible();

    // Switch to history tab
    await page.click('[data-testid="history-tab-btn"]');
    const historyPanel = page.locator('[data-testid="history-panel"]');
    await expect(historyPanel).toBeVisible();
    await expect(historyPanel.locator('text=Antoine')).toBeVisible();

    // Revert/restore version
    await page.click('[data-testid="restore-version-btn-101"]');
    await expect(page.locator('text=Version restored successfully')).toBeVisible();
  });

  test('shows placeholders for a record whose fields are empty', async ({ page }) => {
    await page.click('[data-testid="record-row-rec-empty"]');

    const detailPanel = page.locator('[data-testid="detail-view"]');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator('.text-muted', { hasText: '--' })).toHaveCount(2);
  });

  test('empty state offers a direct path to create the first record', async ({ page }) => {
    records = [];
    await page.reload();

    const emptyState = page.getByTestId('records-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Aucune fiche pour le moment');
    await emptyState.getByRole('button', { name: 'Ajouter une fiche' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Ajouter une fiche' })).toBeVisible();
  });

  test('list and detail views have no detectable accessibility violations', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ouvrages' })).toBeVisible();

    const listResults = await new AxeBuilder({ page }).analyze();
    expect(listResults.violations).toEqual([]);

    await page.click('[data-testid="record-row-rec-1"]');
    await expect(page.getByTestId('detail-view')).toBeVisible();

    const detailResults = await new AxeBuilder({ page }).analyze();
    expect(detailResults.violations).toEqual([]);
  });

  test('shows an explicit error when record details cannot be loaded', async ({ page }) => {
    await page.click('[data-testid="record-row-rec-error"]');

    await expect(page.locator('[data-testid="detail-error"]')).toContainText(
      'Record lookup failed',
      { timeout: 15_000 },
    );
  });

  test('deletes a referenced record with reassignment, restores/purges from trash', async ({ page }) => {
    // Register dialog accept listener
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Try to delete a referenced record (rec-1)
    await page.click('[data-testid="delete-record-rec-1"]');

    // DeleteConflict Modal opens
    const conflictModal = page.locator('.modal.show');
    await expect(conflictModal).toBeVisible();
    await expect(conflictModal.locator('.modal-title')).toContainText('Conflit de suppression');

    // Choose replacement B and submit
    const reassignSelect = conflictModal.locator('[data-testid="reassign-select"]');
    await reassignSelect.selectOption('rec-2');
    await conflictModal.locator('[data-testid="reassign-submit"]').click();

    // Modal closes and list updates (record is deleted)
    await expect(conflictModal).not.toBeVisible();
    await expect(page.locator('text=Links reassigned and record deleted')).toBeVisible();

    // Open Trash Manager
    await page.click('[data-testid="trash-btn"]');
    const trashModal = page.locator('.modal.show');
    await expect(trashModal).toBeVisible();
    await expect(trashModal.locator('.modal-title')).toContainText('Corbeille');
    await expect(trashModal.locator('text=L\'Étranger')).toBeVisible();

    // Restore from trash
    await trashModal.locator('[data-testid="restore-trash-rec-trashed-1"]').click();
    await expect(trashModal.locator('text=L\'Étranger')).not.toBeVisible();

    // Close trash modal
    await trashModal.locator('[data-testid="trash-close-btn"]').click();
    await expect(trashModal).not.toBeVisible();
  });
});
