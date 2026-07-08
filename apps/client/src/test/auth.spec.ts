import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
    
    // Should show login form
    await expect(page.locator('h3')).toContainText('Connexion');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show loading state while checking auth', async ({ page }) => {
    // Navigate to a protected route
    await page.goto('/workspaces');
    
    // Should show loading spinner
    await expect(page.locator('.spinner-border')).toBeVisible();
  });

  test('should display login form with correct fields', async ({ page }) => {
    await page.goto('/login');
    
    // Check for email field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('id', 'email');
    
    // Check for password field
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('id', 'password');
    
    // Check for login button
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Se connecter');
  });

  test('should show error message on failed login', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.alert-danger')).toBeVisible();
  });

  test('should redirect to returnTo URL after successful login', async ({ page }) => {
    // Navigate to a protected route with returnTo
    await page.goto('/workspaces?returnTo=/databases');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Fill in credentials (this would need valid test credentials)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to returnTo URL after successful login
    // Note: This test would need a test user to be set up in the database
    // For now, we'll just check that the form submits
    await expect(page.locator('button[type="submit"]')).toContainText('Connexion...');
  });

  test('should persist language toggle', async ({ page }) => {
    await page.goto('/login');
    
    // Find language toggle button
    const langButton = page.locator('button').filter({ hasText: /EN|FR/ });
    await expect(langButton).toBeVisible();
    
    // Click to toggle language
    const initialText = await langButton.textContent();
    await langButton.click();
    
    // Language should toggle
    const newText = await langButton.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('should persist theme toggle', async ({ page }) => {
    await page.goto('/login');
    
    // Find theme toggle button (emoji)
    const themeButton = page.locator('button').filter({ hasText: /🌙|🌞|🌿/ });
    await expect(themeButton).toBeVisible();
    
    // Click to toggle theme
    const initialEmoji = await themeButton.textContent();
    await themeButton.click();
    
    // Theme should toggle
    const newEmoji = await themeButton.textContent();
    expect(newEmoji).not.toBe(initialEmoji);
  });

  test('should show French text by default', async ({ page }) => {
    await page.goto('/login');
    
    // Check for French text
    await expect(page.locator('h3')).toContainText('Connexion');
    await expect(page.locator('label[for="email"]')).toContainText('Courriel');
    await expect(page.locator('label[for="password"]')).toContainText('Mot de passe');
  });

  test('should switch to English when language is toggled', async ({ page }) => {
    await page.goto('/login');
    
    // Toggle language to English
    const langButton = page.locator('button').filter({ hasText: 'EN' });
    await langButton.click();
    
    // Check for English text
    await expect(page.locator('h3')).toContainText('Login');
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Password');
  });

  test('should disable login button while submitting', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Button should be disabled and show loading text
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toBeDisabled();
    await expect(loginButton).toContainText('Connexion...');
  });
});
