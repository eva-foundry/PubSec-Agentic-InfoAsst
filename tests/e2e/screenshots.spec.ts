// Screenshot walkthrough — captures the full user journey into docs/screenshots/
// for the upstream PR description. Run with:
//
//   cd 53-AIA-Refactor  # (eventual rename)
//   # start backend: cd services/api-gateway && uvicorn app.main:app --reload --port 8000
//   # dev server starts automatically via playwright.config.ts
//   npx playwright test tests/e2e/screenshots.spec.ts --project=chromium
//
// Output: docs/screenshots/*.png (full-page PNGs, 1440x900 viewport).
//
// These are committed so an upstream reviewer can see the running app
// without deploying anything. Synthetic data only — no PII.

import { test, type Page } from '@playwright/test';
import path from 'node:path';

// Playwright is invoked from the repo root; resolve relative to it.
const SHOTS_DIR = path.resolve(process.cwd(), 'docs', 'screenshots');

// Prime demo auth as dave@ — has all three portals (self-service, admin, ops)
// and `workspace_grants: ['all']` so every gated route renders.
const primeAdmin = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aia.auth.v1',
      JSON.stringify({
        user: {
          user_id: 'demo-dave',
          email: 'dave@example.org',
          name: 'Dave Thompson',
          role: 'admin',
          portal_access: ['self-service', 'admin', 'ops'],
          workspace_grants: ['all'],
          data_classification_level: 'sensitive',
          language: 'en',
        },
      }),
    );
    window.localStorage.setItem('aia.tour.seen.v1', '1');
  });
};

const capture = async (page: Page, route: string, name: string) => {
  await page.goto(route);
  // Give streaming/async content a beat to settle. This is a screenshot
  // walkthrough, not a timing-sensitive functional test — latency here
  // is traded for visual completeness.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOTS_DIR, `${name}.png`),
    fullPage: true,
  });
};

test.describe('AIA screenshot walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeAdmin(page);
  });

  test('01 landing (public)', async ({ page }) => {
    // No auth needed — this is the public-facing entry point.
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(SHOTS_DIR, '01-landing.png'),
      fullPage: true,
    });
  });

  test('02 chat — grounded answer with citations', async ({ page }) => {
    await capture(page, '/chat', '02-chat');
  });

  test('03 catalog — workspace archetypes', async ({ page }) => {
    await capture(page, '/catalog', '03-catalog');
  });

  test('04 my-workspace — conversations, team, documents', async ({ page }) => {
    await capture(page, '/my-workspace', '04-my-workspace');
  });

  test('05 admin — workspaces + cost-centre editor', async ({ page }) => {
    await capture(page, '/admin/workspaces', '05-admin-workspaces');
  });

  test('06 admin — model registry', async ({ page }) => {
    await capture(page, '/models', '06-admin-models');
  });

  test('07 ops — finops cost dashboard', async ({ page }) => {
    await capture(page, '/cost', '07-ops-cost');
  });

  test('08 ops — aiops quality + calibration', async ({ page }) => {
    await capture(page, '/aiops', '08-ops-aiops');
  });

  test('09 ops — drift monitor', async ({ page }) => {
    await capture(page, '/drift', '09-ops-drift');
  });

  test('10 ops — liveops service health + incidents', async ({ page }) => {
    await capture(page, '/liveops', '10-ops-liveops');
  });

  test('11 ops — devops deployments', async ({ page }) => {
    await capture(page, '/devops', '11-ops-devops');
  });

  test('12 ops — compliance audit log', async ({ page }) => {
    await capture(page, '/compliance', '12-ops-compliance');
  });

  test('13 ops — red-team evaluation', async ({ page }) => {
    await capture(page, '/red-team', '13-ops-red-team');
  });
});
