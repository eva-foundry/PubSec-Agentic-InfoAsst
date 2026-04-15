/**
 * Portal 3 — Operations & Support: User journey tests.
 *
 * Covers: ops login, FinOps dashboard, AIOps metrics,
 * LiveOps health, DevOps pipelines, compliance dashboard.
 */

import { test, expect } from '@playwright/test';
import { PORTALS, USERS, loginAs, navigateTo, checkA11y } from './helpers';

const BASE = PORTALS.ops;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test.describe('Ops Authentication', () => {
  test('ops login as Dave', async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
    await expect(page.locator('text=Dave')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// FinOps Command Center
// ---------------------------------------------------------------------------

test.describe('FinOps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
  });

  test('FinOps dashboard shows cost metrics', async ({ page }) => {
    await navigateTo(page, 'FinOps');
    await page.waitForTimeout(3000);
    // Should show cost data from telemetry store
    await expect(page.locator('text=cost, text=Cost, text=CAD, text=$').first()).toBeVisible({ timeout: 5000 });
  });

  test('FinOps dashboard has charts', async ({ page }) => {
    await navigateTo(page, 'FinOps');
    await page.waitForTimeout(3000);
    // Recharts renders SVG elements
    const svgCharts = page.locator('svg.recharts-surface, svg[class*="recharts"]');
    const count = await svgCharts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('FinOps a11y check', async ({ page }) => {
    await navigateTo(page, 'FinOps');
    await page.waitForTimeout(3000);
    await checkA11y(page, 'FinOps dashboard');
  });
});

// ---------------------------------------------------------------------------
// AIOps Monitor
// ---------------------------------------------------------------------------

test.describe('AIOps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
  });

  test('AIOps shows quality metrics', async ({ page }) => {
    await navigateTo(page, 'AIOps');
    await page.waitForTimeout(3000);
    // Should show confidence, groundedness, etc.
    await expect(page.locator('text=confidence, text=Confidence, text=groundedness, text=Groundedness').first()).toBeVisible({ timeout: 5000 });
  });

  test('AIOps a11y check', async ({ page }) => {
    await navigateTo(page, 'AIOps');
    await page.waitForTimeout(3000);
    await checkA11y(page, 'AIOps monitor');
  });
});

// ---------------------------------------------------------------------------
// LiveOps Health
// ---------------------------------------------------------------------------

test.describe('LiveOps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
  });

  test('LiveOps shows service health grid', async ({ page }) => {
    await navigateTo(page, 'LiveOps');
    await page.waitForTimeout(3000);
    // Should show Azure service names
    await expect(page.locator('text=msub-, text=healthy, text=Healthy').first()).toBeVisible({ timeout: 5000 });
  });

  test('LiveOps a11y check', async ({ page }) => {
    await navigateTo(page, 'LiveOps');
    await page.waitForTimeout(3000);
    await checkA11y(page, 'LiveOps health');
  });
});

// ---------------------------------------------------------------------------
// DevOps Pipelines
// ---------------------------------------------------------------------------

test.describe('DevOps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
  });

  test('DevOps shows deployment history', async ({ page }) => {
    await navigateTo(page, 'DevOps');
    await page.waitForTimeout(3000);
    // Should show version numbers or deployment status
    await expect(page.locator('text=0.1.0, text=success, text=pipeline').first()).toBeVisible({ timeout: 5000 });
  });

  test('DevOps a11y check', async ({ page }) => {
    await navigateTo(page, 'DevOps');
    await page.waitForTimeout(3000);
    await checkA11y(page, 'DevOps pipelines');
  });
});

// ---------------------------------------------------------------------------
// Compliance Dashboard
// ---------------------------------------------------------------------------

test.describe('Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);
  });

  test('compliance dashboard loads', async ({ page }) => {
    // Navigate to compliance if it exists as a tab
    const compTab = page.locator('button:has-text("Compliance"), button:has-text("Conformite")');
    if (await compTab.isVisible()) {
      await compTab.click();
      await page.waitForTimeout(3000);
      // Should show ITSG-33 or EVA principles
      await expect(page.locator('text=ITSG-33, text=control, text=Control').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Full Ops Journey
// ---------------------------------------------------------------------------

test.describe('Full Ops Journey', () => {
  test('navigate through all command centers', async ({ page }) => {
    await page.goto(BASE);
    await loginAs(page, USERS.dave);

    // Visit each command center tab
    for (const tab of ['FinOps', 'AIOps', 'LiveOps', 'DevOps']) {
      await navigateTo(page, tab);
      await page.waitForTimeout(2000);
      // Verify we're on the right tab
      await expect(page.locator(`button[aria-current="page"]:has-text("${tab}")`)).toBeVisible();
    }
  });
});
