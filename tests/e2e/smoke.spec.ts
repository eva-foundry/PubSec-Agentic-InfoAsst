import { test, expect } from '@playwright/test';

test.describe('Agentic Information Assistant — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing renders with rebranded title', async ({ page }) => {
    await expect(page).toHaveTitle('Agentic Information Assistant');
  });

  test('portal switcher swaps nav between Workspace, Admin, Ops', async ({ page }) => {
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
    await expect(sidebar.getByRole('link', { name: /onboarding/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /model registry/i })).toBeVisible();

    await opsTab.click();
    await expect(opsTab).toHaveAttribute('aria-selected', 'true');
    await expect(sidebar.getByRole('link', { name: /cost/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /aiops/i })).toBeVisible();

    await workspaceTab.click();
    await expect(workspaceTab).toHaveAttribute('aria-selected', 'true');
  });

  test('chat scripted Q&A: send prefilled prompt, agent runs, answer with sources + confidence', async ({ page }) => {
    await page.goto('/chat');

    const composer = page.getByRole('textbox', { name: 'Message input' });
    await expect(composer).toHaveValue(/parental leave/i);

    await page.getByRole('button', { name: 'Send' }).click();

    const agentPanel = page.getByLabel('Agentic reasoning progress');
    await expect(agentPanel).toBeVisible();

    await expect(page.getByText(/12 weeks/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/confidence/i).first()).toBeVisible();
    await expect(page.getByText(/sources/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /helpful/i })).toBeVisible();
  });

  test('language switcher changes UI strings to French', async ({ page }) => {
    await page.goto('/chat');

    await expect(page.getByRole('tab', { name: 'Workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Select language' }).click();
    await page.getByRole('menuitem', { name: 'Français' }).click();

    await expect(page.getByRole('tab', { name: 'Espace' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('theme customizer opens, changes product color, persists', async ({ page }) => {
    await page.goto('/chat');

    await page.getByRole('button', { name: 'Customize theme' }).click();

    const popover = page.getByRole('dialog');
    await expect(popover).toBeVisible();

    const productSwatches = popover.getByRole('button', { name: /^Product / });
    await expect(productSwatches.first()).toBeVisible();

    const getVar = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--product').trim());
    const before = await getVar();

    await productSwatches.nth(1).click();
    await expect.poll(getVar).not.toBe(before);

    await expect(page.getByRole('button', { name: /reset to defaults/i })).toBeVisible();
  });
});
