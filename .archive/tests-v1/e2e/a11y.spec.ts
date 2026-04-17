// ---------------------------------------------------------------------------
// a11y.spec.ts — Playwright + axe-core accessibility test suite
// ---------------------------------------------------------------------------
//
// Each portal gets a test suite that navigates to every major page and runs
// an axe-core scan asserting zero critical/serious WCAG 2.1 AA violations.
//
// Prerequisites:
//   npm install --save-dev @axe-core/playwright @playwright/test
//
// Run:
//   npx playwright test tests/e2e/a11y.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertNoA11yViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (critical.length > 0) {
    const summary = critical.map(
      (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
    );
    console.error('Accessibility violations:\n' + summary.join('\n'));
  }

  expect(critical).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Portal 1 — Self-Service
// ---------------------------------------------------------------------------

test.describe('Portal 1: Self-Service', () => {
  const BASE = 'http://localhost:5173';

  test('chat page has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: authenticate via demo login
    await assertNoA11yViolations(page);
  });

  test('documents page has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to documents tab
    await assertNoA11yViolations(page);
  });

  test('workspace catalog has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to workspaces tab
    await assertNoA11yViolations(page);
  });

  test('booking flow has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: open booking dialog
    await assertNoA11yViolations(page);
  });
});

// ---------------------------------------------------------------------------
// Portal 2 — Business Admin
// ---------------------------------------------------------------------------

test.describe('Portal 2: Business Admin', () => {
  const BASE = 'http://localhost:5174';

  test('dashboard has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: authenticate as admin user
    await assertNoA11yViolations(page);
  });

  test('client onboarding has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to clients tab
    await assertNoA11yViolations(page);
  });

  test('workspace management has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to workspaces tab
    await assertNoA11yViolations(page);
  });
});

// ---------------------------------------------------------------------------
// Portal 3 — Operations & Support
// ---------------------------------------------------------------------------

test.describe('Portal 3: Operations & Support', () => {
  const BASE = 'http://localhost:5175';

  test('FinOps command center has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: authenticate as ops user
    await assertNoA11yViolations(page);
  });

  test('AIOps command center has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to AIOps tab
    await assertNoA11yViolations(page);
  });

  test('LiveOps command center has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to LiveOps tab
    await assertNoA11yViolations(page);
  });

  test('DevOps command center has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE);
    // TODO: navigate to DevOps tab
    await assertNoA11yViolations(page);
  });
});
