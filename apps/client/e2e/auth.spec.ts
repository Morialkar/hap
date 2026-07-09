import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Test User',
  email: 'test@example.com',
};

function mockAuthRoutes(page: Page, state: { authed: boolean }) {
  page.route('**/api/v1/user', async (route) => {
    if (state.authed) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated.' }),
      });
    }
  });

  page.route('**/api/v1/login', async (route) => {
    const body = route.request().postDataJSON();
    if (body.email === 'test@example.com' && body.password === 'password') {
      state.authed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Identifiants invalides' }),
      });
    }
  });

  page.route('**/api/v1/databases**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  page.route('**/api/v1/tables**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Authentication Flow', () => {
  test('locked out until login: protected route redirects to login form', async ({ page }) => {
    mockAuthRoutes(page, { authed: false });
    await page.goto('/workspaces');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h3')).toContainText('Connexion');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login form shows French labels by default', async ({ page }) => {
    mockAuthRoutes(page, { authed: false });
    await page.goto('/login');

    await expect(page.locator('h3')).toContainText('Connexion');
    await expect(page.locator('label[for="email"]')).toContainText('Courriel');
    await expect(page.locator('label[for="password"]')).toContainText('Mot de passe');
    await expect(page.locator('button[type="submit"]')).toContainText('Se connecter');
  });

  test('failed login shows an error message', async ({ page }) => {
    mockAuthRoutes(page, { authed: false });
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-danger')).toBeVisible();
    await expect(page.locator('.alert-danger')).toContainText('Identifiants invalides');
  });

  test('deep link returns to the requested page after login', async ({ page }) => {
    const state = { authed: false };
    mockAuthRoutes(page, state);

    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fworkspaces/);

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.locator('h1')).toContainText('Espaces de travail');
  });

  test('language toggle persists across reloads', async ({ page }) => {
    mockAuthRoutes(page, { authed: true });
    await page.goto('/workspaces');
    await expect(page.locator('h1')).toContainText('Espaces de travail');

    // Toggle to English (button shows the target locale)
    await page.getByTestId('language-toggle').click();
    await expect(page.locator('h1')).toContainText('Workspaces');

    await page.reload();
    await expect(page.locator('h1')).toContainText('Workspaces');
  });

  test('appearance and accent preferences persist across reloads', async ({ page }) => {
    mockAuthRoutes(page, { authed: true });
    await page.goto('/workspaces');

    await page.getByTestId('appearance-menu-toggle').click();
    await page.getByTestId('appearance-dark').click();
    await page.getByTestId('accent-magenta').click();

    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-hap-accent', 'magenta');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-hap-accent', 'magenta');
  });

  test('mobile navigation opens and closes without Bootstrap JavaScript', async ({ page }) => {
    mockAuthRoutes(page, { authed: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/workspaces');

    const toggle = page.getByTestId('navigation-toggle');
    const navigation = page.locator('#primary-navigation');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation).not.toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toBeVisible();

    await navigation.getByRole('link', { name: 'Accueil' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('shared shell and workspace empty state have no detectable accessibility violations', async ({
    page,
  }) => {
    mockAuthRoutes(page, { authed: true });
    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { level: 1, name: 'Espaces de travail' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
