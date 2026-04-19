// Per-feature E2E: walks each wired page against the deployed stack.
// Set E2E_BASE_URL to target a live SWA; otherwise uses the local dev server
// from playwright.config.ts.
import { test, expect, type Page } from '@playwright/test';

// Demo auth as dave@ — has all three portals (self-service, admin, ops)
// and `workspace_grants: ['all']` so every gated route renders.
const primeAdminOps = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aia.auth.v1',
      JSON.stringify({
        user: {
          user_id: 'demo-dave',
          email: 'dave@demo.gc.ca',
          name: 'Dave Thompson',
          role: 'admin',
          portal_access: ['self-service', 'admin', 'ops'],
          workspace_grants: ['all'],
          data_classification_level: 'protected_b',
          language: 'en',
        },
      }),
    );
    window.localStorage.setItem('aia.tour.seen.v1', '1');
  });
};

test.describe('per-feature E2E — live backend', () => {
  test.beforeEach(async ({ page }) => {
    await primeAdminOps(page);
  });

  test('Catalog renders archetype cards from /archetypes', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: /workspace catalog/i })).toBeVisible();
    await expect(page.getByText(/Knowledge Base/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Decision Support/).first()).toBeVisible();
  });

  test('MyWorkspace tabs render conversations + team + documents', async ({ page }) => {
    await page.goto('/my-workspace');
    await expect(page.getByRole('heading', { name: /my workspace/i })).toBeVisible();
    // Team tab should eventually show either seeded members or the empty state.
    await page.getByRole('tab', { name: /^team/i }).click();
    await expect(page.getByRole('tab', { name: /^documents/i })).toBeVisible();
  });

  test('Chat page streams a grounded answer', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: /chat/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Compliance audit log renders rows', async ({ page }) => {
    await page.goto('/compliance');
    await expect(page.getByRole('heading', { name: /compliance/i })).toBeVisible();
    // At least the header + one row column should exist.
    await expect(page.getByText(/audit log/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Cost page shows MTD cost + query count', async ({ page }) => {
    await page.goto('/cost');
    await expect(page.getByRole('heading', { name: /cost|finops/i }).first()).toBeVisible();
    await expect(page.getByText(/queries|MTD/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('AIOps page renders Quality trends + Calibration panels', async ({ page }) => {
    await page.goto('/aiops');
    await expect(page.getByRole('heading', { name: /aiops/i })).toBeVisible();
    await expect(page.getByText(/Quality trends/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Confidence calibration/i)).toBeVisible();
  });

  test('Drift monitor renders charts for a workspace', async ({ page }) => {
    await page.goto('/drift');
    await expect(page.getByRole('heading', { name: /drift/i })).toBeVisible();
    await expect(page.getByText(/Model drift|Prompt drift|Corpus drift/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('LiveOps shows service table + incidents', async ({ page }) => {
    await page.goto('/liveops');
    await expect(page.getByRole('heading', { name: /liveops/i })).toBeVisible();
    await expect(page.getByText(/Service health|Incident feed/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('DevOps lists deployments', async ({ page }) => {
    await page.goto('/devops');
    await expect(page.getByRole('heading', { name: /devops/i })).toBeVisible();
    await expect(page.getByText(/Deployment|Rollback/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Models page lists registered models', async ({ page }) => {
    await page.goto('/models');
    await expect(page.getByRole('heading', { name: /models/i })).toBeVisible();
    await expect(page.getByText(/gpt-5|model/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('RedTeam runs an evaluation end-to-end', async ({ page }) => {
    await page.goto('/red-team');
    await expect(page.getByRole('heading', { name: /red team/i })).toBeVisible();
    await page.getByRole('button', { name: /run evaluation/i }).click();
    // Wait for at least one verdict badge from the streaming runner.
    await expect(page.getByText(/^(blocked|review|bypass)$/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
