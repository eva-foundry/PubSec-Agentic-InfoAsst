import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/pricing', name: 'pricing' },
  { path: '/about', name: 'about' },
  { path: '/chat', name: 'chat' },
  { path: '/catalog', name: 'catalog' },
  { path: '/my-workspace', name: 'my-workspace' },
  { path: '/onboarding', name: 'onboarding' },
  { path: '/models', name: 'models' },
  { path: '/cost', name: 'cost' },
  { path: '/aiops', name: 'aiops' },
  { path: '/drift', name: 'drift' },
  { path: '/liveops', name: 'liveops' },
  { path: '/devops', name: 'devops' },
  { path: '/compliance', name: 'compliance' },
  { path: '/red-team', name: 'red-team' },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

const THEMES = ['dark', 'light'] as const;

const KILL_MOTION = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;

function customizerState(theme: 'dark' | 'light') {
  return JSON.stringify({
    accent: 'indigo',
    product: 'violet',
    cardStyle: 'glass',
    radius: 'default',
    spacing: 'default',
    density: 'reader',
    portal: 'workspace',
    lang: 'en',
    theme,
    assurance: 'Advisory',
  });
}

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Prime Dave (all portals + all workspace grants) so every route
    // renders beyond the auth gate. Dismiss the coachmark tour.
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
  });

  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      for (const theme of THEMES) {
        // Seed the customizer once per theme via addInitScript (runs before
        // any navigation + before auth prime already attached above).
        await page.addInitScript(
          ({ key, value }) => {
            window.localStorage.setItem(key, value);
          },
          { key: 'aia.customizer.v1', value: customizerState(theme) },
        );
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(route.path);
          await page.addStyleTag({ content: KILL_MOTION });
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);
          await expect(page).toHaveScreenshot(
            `${route.name}-${theme}-${viewport.name}.png`,
            {
              fullPage: true,
              animations: 'disabled',
              maxDiffPixelRatio: 0.02,
            },
          );
        }
      }
    });
  }
});
