// ---------------------------------------------------------------------------
// smoke.spec.ts — basic smoke tests for the self-service portal
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import { checkA11y, loginAs, switchLanguage } from './setup';

// Run these tests only against the self-service portal project
test.describe('Portal Self-Service — Smoke', () => {
  test.skip(
    ({ browserName }, testInfo) =>
      testInfo.project.name !== 'portal-self-service',
    'Only runs against portal-self-service project',
  );

  test('loads the login page', async ({ page }) => {
    await page.goto('/');
    // Should see some form of sign-in UI
    const heading = page.getByRole('heading');
    await expect(heading.first()).toBeVisible();
  });

  test('demo login works', async ({ page }) => {
    await page.goto('/');

    // Login as the first available user
    const select = page.locator('select');
    await select.waitFor({ state: 'visible', timeout: 10_000 });

    // Grab the first option value
    const firstValue = await select.locator('option').first().getAttribute('value');
    if (firstValue) {
      await loginAs(page, firstValue);
    }

    // After login, the main content area should be visible
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 5_000 });
  });

  test('language toggle switches UI strings', async ({ page }) => {
    await page.goto('/');

    // Start in English — look for "Sign In" or similar English text
    const englishText = page.getByText(/sign in|login/i).first();
    await expect(englishText).toBeVisible({ timeout: 5_000 });

    // Switch to French
    await switchLanguage(page, 'fr');

    // French text should now be visible
    const frenchText = page.getByText(/se connecter|connexion/i).first();
    await expect(frenchText).toBeVisible({ timeout: 3_000 });

    // Switch back to English
    await switchLanguage(page, 'en');

    // English text should reappear
    await expect(page.getByText(/sign in|login/i).first()).toBeVisible({
      timeout: 3_000,
    });
  });

  test('login page passes basic a11y checks', async ({ page }) => {
    await page.goto('/');

    // Wait for content to render
    await page.waitForTimeout(500);

    await checkA11y(page);
  });
});
