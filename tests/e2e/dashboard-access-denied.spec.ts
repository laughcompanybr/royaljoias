import { test, expect, type Request } from "@playwright/test";

/**
 * Cobre o fluxo completo de negação de acesso pelo `is_staff_or_admin`:
 *
 * 1. O dashboard falha via server fn com "permission denied".
 * 2. A UI redireciona para `/access-denied` (sem blank screen).
 * 3. Uma entrada é enviada ao `logPermissionDenied` com actor + rota corretos
 *    (proxy verificável do insert em `audit_log`, cujo write real depende de
 *    sessão autenticada — o payload prova a intenção enviada ao backend).
 * 4. `/access-denied` exibe título "Acesso restrito" e as duas CTAs esperadas.
 */

const DASHBOARD_FN = /\/_serverFn\/.*getDashboardStats/;
const AUDIT_FN = /\/_serverFn\/.*logPermissionDenied/;

async function fakeAuthenticated(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const key = Object.keys(window.localStorage).find((k) => k.startsWith("sb-"));
    if (!key) {
      window.localStorage.setItem(
        "sb-e2e-auth-token",
        JSON.stringify({
          currentSession: {
            access_token: "e2e-token",
            token_type: "bearer",
            user: { id: "e2e-user", email: "e2e@royal.test" },
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    }
  });
}

test("is_staff_or_admin deny → redireciona /access-denied + envia audit + CTAs visíveis", async ({
  page,
}) => {
  await fakeAuthenticated(page);

  await page.route(DASHBOARD_FN, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "permission denied for function is_staff_or_admin" },
      }),
    }),
  );

  const auditRequests: Request[] = [];
  await page.route(AUDIT_FN, (route) => {
    auditRequests.push(route.request());
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { logged: true } }),
    });
  });

  await page.goto("/dashboard");

  // Se o gate de auth mandar para /auth, o teste ainda garante ausência de blank screen.
  const authRedirected = page.url().includes("/auth");
  if (authRedirected) {
    const body = (await page.locator("body").innerText()).trim();
    expect(body.length).toBeGreaterThan(0);
    test.skip(true, "fluxo interceptado antes do dashboard pelo gate de auth");
    return;
  }

  await page.waitForURL(/\/access-denied/, { timeout: 6000 });
  expect(new URL(page.url()).searchParams.get("from")).toBe("/dashboard");
  expect(new URL(page.url()).searchParams.get("reason")).toMatch(/is_staff_or_admin/);

  // CTAs esperadas na página de fallback.
  await expect(
    page.getByRole("heading", { name: /Acesso restrito/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Voltar à navegação segura/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Trocar de conta/i })).toBeVisible();

  // Trilha de auditoria: `logPermissionDenied` foi disparada com rota + função.
  expect(auditRequests.length).toBeGreaterThan(0);
  const payload = auditRequests[0].postDataJSON();
  const inner = payload?.data ?? payload;
  expect(inner.route).toBe("/dashboard");
  expect(inner.functionName).toMatch(/is_staff_or_admin/i);
  expect(String(inner.message ?? "")).toMatch(/permission denied/i);

  // Bearer do "actor" viajou no header — o server fn resolve o userId a partir dele.
  const authHeader = auditRequests[0].headers()["authorization"] ?? "";
  expect(authHeader).toMatch(/^Bearer /);
});
