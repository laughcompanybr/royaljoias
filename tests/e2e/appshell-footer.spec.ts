import { expect, test } from "@playwright/test";

/**
 * Verifies the "Developed by Laugh Company" authorship strip is present on the
 * login shell (public) and, when a session is present, on the AppShell
 * across mobile + desktop viewports.
 *
 * NOTE: The AppShell portion runs only when LOVABLE_BROWSER_SUPABASE_* env
 * vars are injected (matching the sandbox auth mechanism). Otherwise those
 * tests are skipped to keep the suite green in unauthenticated CI runs.
 */

test.describe("Authorship footer — public", () => {
  test("login shell shows 'Developed by Laugh Company'", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/Developed by Laugh Company/i)).toBeVisible();
  });
});

const AUTHENTICATED_ROUTES = ["/dashboard", "/pedidos", "/configuracoes"];

test.describe("Authorship footer — AppShell", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
    const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
    if (!sessionJson || !storageKey) {
      testInfo.skip(true, "No injected Supabase session — skipping authenticated footer checks.");
      return;
    }
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [storageKey, sessionJson],
    );
  });

  for (const route of AUTHENTICATED_ROUTES) {
    test(`footer is visible at ${route}`, async ({ page }) => {
      await page.goto(route);
      const footer = page.locator("footer").filter({ hasText: /Developed by Laugh Company/i });
      await expect(footer).toBeVisible();
      await expect(footer).toContainText(/Royal Joias/i);
    });
  }
});
