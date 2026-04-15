// ---------------------------------------------------------------------------
// setup.ts — shared helpers for E2E tests
// ---------------------------------------------------------------------------

import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Accessibility: run axe-core and assert zero critical/serious violations
// ---------------------------------------------------------------------------

export async function checkA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (violations.length > 0) {
    const summary = violations.map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`,
    );
    console.error('Accessibility violations:\n' + summary.join('\n'));
  }

  expect(violations).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Demo login: select a user by email and submit
// ---------------------------------------------------------------------------

export async function loginAs(page: Page, email: string) {
  // Wait for the demo user dropdown to populate
  const select = page.locator('select');
  await select.waitFor({ state: 'visible', timeout: 10_000 });

  // Select the target user
  await select.selectOption({ value: email });

  // Click Sign In / Se connecter button
  const signInButton = page.getByRole('button', { name: /sign in|se connecter/i });
  await signInButton.click();

  // Wait for navigation — the login form should disappear
  await expect(select).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Language toggle: switch to EN or FR
// ---------------------------------------------------------------------------

export async function switchLanguage(page: Page, lang: 'en' | 'fr') {
  // The toggle button shows the *other* language name
  const targetLabel = lang === 'fr' ? /fran/i : /english/i;

  const toggle = page.getByRole('button', { name: targetLabel });

  // Only click if we actually need to switch
  if (await toggle.isVisible()) {
    await toggle.click();
    // Small delay for i18next to propagate
    await page.waitForTimeout(300);
  }
}
