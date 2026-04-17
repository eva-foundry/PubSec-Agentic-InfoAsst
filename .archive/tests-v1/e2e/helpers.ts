/**
 * Shared Playwright test helpers — login, a11y, i18n, navigation.
 */

import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Portal URLs
// ---------------------------------------------------------------------------

export const PORTALS = {
  selfService: 'http://localhost:5173',
  admin: 'http://localhost:5174',
  ops: 'http://localhost:5175',
} as const;

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------

export const USERS = {
  alice: 'alice@demo.gc.ca',    // P1 contributor (OAS Act, EI Juris)
  bob: 'bob@demo.gc.ca',       // P1 reader (OAS Act)
  carol: 'carol@demo.gc.ca',   // P2 admin (all workspaces)
  dave: 'dave@demo.gc.ca',     // P3 ops
  eve: 'eve@demo.gc.ca',       // P1 multi-workspace contributor
} as const;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Log in as a demo user. Assumes the portal shows a DemoLogin page
 * when not authenticated.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // Wait for the demo user dropdown to load
  await page.waitForSelector('select', { timeout: 10000 });

  // Find the option that contains this email and select it
  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  const matchIdx = options.findIndex((t) => t.includes(email));
  if (matchIdx >= 0) {
    // Select by index — get the option value attribute
    const optionValue = await select.locator('option').nth(matchIdx).getAttribute('value');
    if (optionValue) {
      await select.selectOption(optionValue);
    } else {
      // Fallback: select by visible text
      await select.selectOption({ index: matchIdx });
    }
  }

  // Click Sign In (EN or FR)
  const signIn = page.locator('button:has-text("Sign In")').or(page.locator('button:has-text("Se connecter")'));
  await signIn.click();

  // DemoLogin stores auth to localStorage. The App component reads it on mount.
  // Wait for localStorage to be set, then reload to trigger App's useAuth() re-read.
  await page.waitForTimeout(1000);

  // Check if we're already in the main app (nav visible)
  const navVisible = await page.locator('nav[role="navigation"]').isVisible().catch(() => false);
  if (!navVisible) {
    // DemoLogin wrote to localStorage but App didn't re-render — reload the page
    await page.reload();
    await page.locator('#main-content').waitFor({ timeout: 10000 });
  }
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate to a tab by clicking the nav button with matching text.
 */
export async function navigateTo(page: Page, tabName: string): Promise<void> {
  await page.click(`nav[role="navigation"] button:has-text("${tabName}")`);
  // Wait for the active tab indicator
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/**
 * Switch language. Clicks the language toggle link.
 */
export async function switchLanguage(page: Page, targetLang: 'en' | 'fr'): Promise<void> {
  const toggleText = targetLang === 'fr' ? 'Francais' : 'English';
  const toggleButton = page.locator(`button:has-text("${toggleText}"), a:has-text("${toggleText}")`);
  if (await toggleButton.isVisible()) {
    await toggleButton.click();
    await page.waitForTimeout(300);
  }
}

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

/**
 * Run axe-core WCAG 2.1 AA audit. Fails if any critical/serious violations.
 */
export async function checkA11y(page: Page, context?: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (violations.length > 0) {
    const summary = violations.map(
      (v) => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
    );
    console.error(`A11y violations${context ? ` on ${context}` : ''}:\n${summary.join('\n')}`);
  }

  expect(violations, `A11y violations${context ? ` on ${context}` : ''}`).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Chat helpers
// ---------------------------------------------------------------------------

/**
 * Send a chat message and wait for the response to start streaming.
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill(message);
  const sendBtn = page.locator('button[aria-label="Send message"]')
    .or(page.locator('button[aria-label="Envoyer le message"]'))
    .or(page.locator('button:has-text("Send")'));
  await sendBtn.click();
}

/**
 * Wait for the chat response to complete (provenance badge appears).
 */
export async function waitForChatResponse(page: Page, timeout = 60000): Promise<void> {
  // Wait for either content to appear or an error message
  await page.waitForSelector(
    '[data-testid="chat-message-assistant"], [class*="assistant"], [role="status"]',
    { timeout },
  );
}

// ---------------------------------------------------------------------------
// Document upload helpers
// ---------------------------------------------------------------------------

/**
 * Upload a file via the document upload interface.
 */
export async function uploadFile(
  page: Page,
  filePath: string,
  workspaceId?: string,
): Promise<void> {
  // If workspace selector exists, select it
  if (workspaceId) {
    const wsSelect = page.locator('select[aria-label*="workspace"], select').first();
    if (await wsSelect.isVisible()) {
      await wsSelect.selectOption(workspaceId);
    }
  }

  // Set the file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  // Click upload/submit button
  await page.click('button:has-text("Upload"), button:has-text("Submit"), button:has-text("Telecharger")');
}

/**
 * Wait for a document to reach "indexed" status.
 */
export async function waitForDocumentIndexed(page: Page, timeout = 30000): Promise<void> {
  await page.waitForSelector(
    'text=indexed, text=Complete, [data-status="indexed"]',
    { timeout },
  );
}
