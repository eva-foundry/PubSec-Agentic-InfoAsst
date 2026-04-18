import { test, expect, type Page } from '@playwright/test';

// Prime demo auth in localStorage before navigation so gated routes
// skip the /login redirect. Mirrors the shape written by AuthContext.
const primeAuth = async (page: Page) => {
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

test.describe('AIA — smoke (post-refactor)', () => {
  test('landing renders with rebranded title (public route)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Agentic Information Assistant');
  });

  test('unauthenticated /chat redirects to /login', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login page surfaces demo personas', async ({ page }) => {
    await page.goto('/login');
    // If the backend is reachable, the persona list renders.
    // Without a backend, the error alert appears — either is a valid smoke.
    await expect(
      page
        .getByRole('button', { name: /Alice Chen|Bob Wilson|Carol Martinez|Dave Thompson|Eve Tremblay/ })
        .first()
        .or(page.getByText(/Could not reach the assistant/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('portal switcher swaps nav between Workspace / Admin / Ops', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/chat');

    const tablist = page.getByRole('tablist', { name: /portal/i });
    const workspaceTab = tablist.getByRole('tab', { name: 'Workspace' });
    const adminTab = tablist.getByRole('tab', { name: 'Administration' });
    const opsTab = tablist.getByRole('tab', { name: 'Operations' });

    await expect(workspaceTab).toHaveAttribute('aria-selected', 'true');

    const sidebar = page.getByRole('navigation', { name: /portal/i });
    await expect(sidebar.getByRole('link', { name: /chat/i })).toBeVisible();

    await adminTab.click();
    await expect(adminTab).toHaveAttribute('aria-selected', 'true');
    await expect(sidebar.getByRole('link', { name: /model registry/i })).toBeVisible();

    await opsTab.click();
    await expect(opsTab).toHaveAttribute('aria-selected', 'true');
    await expect(sidebar.getByRole('link', { name: /cost/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /aiops/i })).toBeVisible();
  });

  test('sidebar footer renders real identity (not Jordan Mehta)', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/chat');
    await expect(page.getByText('Dave Thompson')).toBeVisible();
    await expect(page.getByText('dave@demo.gc.ca')).toBeVisible();
    await expect(page.getByText('Jordan Mehta')).toHaveCount(0);
  });

  test('language switcher toggles EN / FR and updates <html lang>', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/chat');

    await expect(page.getByRole('tab', { name: 'Workspace' })).toBeVisible();

    await page.getByRole('button', { name: /select language/i }).click();
    await page.getByRole('menuitem', { name: 'Français' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('theme customizer opens, changes product color, persists', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/chat');

    await page.getByRole('button', { name: 'Customize theme' }).click();

    const popover = page.getByRole('dialog');
    await expect(popover).toBeVisible();

    const productSwatches = popover.getByRole('button', { name: /^Product / });
    await expect(productSwatches.first()).toBeVisible();

    const getVar = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--product').trim(),
      );
    const before = await getVar();

    await productSwatches.nth(1).click();
    await expect.poll(getVar).not.toBe(before);
  });
});
