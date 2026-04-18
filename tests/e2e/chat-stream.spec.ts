import { test, expect, type Page } from '@playwright/test';

// End-to-end: live backend → fetch NDJSON → applyEvent → DOM render.
// Requires api-gateway on VITE_API_BASE_URL and demo auth mode.

const primeAuth = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aia.auth.v1',
      JSON.stringify({
        user: {
          user_id: 'demo-alice',
          email: 'alice@demo.gc.ca',
          name: 'Alice Chen',
          role: 'contributor',
          portal_access: ['self-service'],
          workspace_grants: ['ws-oas-act', 'ws-ei-juris'],
          data_classification_level: 'protected_b',
          language: 'en',
        },
      }),
    );
    // Skip first-visit coachmark tour — its dialog overlay blocks clicks.
    window.localStorage.setItem('aia.tour.seen.v1', '1');
  });
};

test.describe('Chat: live NDJSON stream', () => {
  test('sends a grounded prompt and renders confidence + citations from the real backend', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/chat');

    // Wait for the workspace list to populate from /v1/eva/workspaces.
    await expect(page.getByRole('combobox', { name: /workspace/i })).toBeVisible();

    const composer = page.getByRole('textbox', { name: 'Message input' });
    await composer.fill('What are OAS benefits?');

    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    const agentPanel = page.getByLabel('Agentic reasoning progress');
    await expect(agentPanel).toBeVisible();

    // Final provenance_complete surfaces confidence + at least one source.
    await expect(page.getByText(/^Confidence$/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Sources \(\d+\)/)).toBeVisible({ timeout: 20_000 });

    // Real agent step pills (backend-labelled) appear — at least the search + answer phases.
    await expect(page.getByText(/Searching documents/i).first()).toBeVisible();
    await expect(page.getByText(/Generating answer/i).first()).toBeVisible();
  });
});
