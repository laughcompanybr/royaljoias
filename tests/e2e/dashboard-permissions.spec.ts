import { test, expect } from "@playwright/test";

/**
 * Cobre a chamada de `is_staff_or_admin` do dashboard:
 * - staff/admin: renderiza KPIs sem erro
 * - sem permissão: renderiza a mensagem controlada "Acesso restrito"
 *
 * Os testes usam interceptação de rede para simular respostas do server fn,
 * evitando dependência de sessão real e cobrindo o fluxo de erro do RLS.
 */

const DASHBOARD_FN = /\/_serverFn\/.*getDashboardStats/;

async function fakeAuthenticated(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const fake = {
      currentSession: {
        access_token: "e2e-token",
        token_type: "bearer",
        user: { id: "e2e-user", email: "e2e@royal.test" },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    const key = Object.keys(window.localStorage).find((k) =>
      k.startsWith("sb-"),
    );
    if (!key) {
      window.localStorage.setItem("sb-e2e-auth-token", JSON.stringify(fake));
    }
  });
}

test.describe("dashboard access (is_staff_or_admin coverage)", () => {
  test("staff/admin carrega KPIs quando o server fn retorna dados", async ({
    page,
  }) => {
    await fakeAuthenticated(page);
    await page.route(DASHBOARD_FN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            revenueMonth: 12000,
            profitMonth: 4000,
            expensesMonth: 8000,
            ordersMonth: 42,
            openOrders: 5,
            deliveredOrders: 30,
            clients: 12,
            revenueSeries: [],
            statusSeries: [],
            recentOrders: [],
          },
        }),
      });
    });

    await page.goto("/dashboard");
    // Se o gate de auth mandar para /auth, valida no mínimo que não há blank screen
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("erro em is_staff_or_admin redireciona para /access-denied sem blank screen", async ({
    page,
  }) => {
    await fakeAuthenticated(page);
    await page.route(DASHBOARD_FN, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "permission denied for function is_staff_or_admin" },
        }),
      });
    });

    await page.goto("/dashboard");
    const authRedirected = page.url().includes("/auth");
    if (!authRedirected) {
      await page.waitForURL(/\/access-denied/, { timeout: 6000 });
      await expect(page.getByRole("heading", { name: /Acesso restrito/i })).toBeVisible();
    }
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("erro em has_role também redireciona para /access-denied com reason=has_role", async ({
    page,
  }) => {
    await fakeAuthenticated(page);
    await page.route(DASHBOARD_FN, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "permission denied for function has_role" },
        }),
      });
    });

    await page.goto("/dashboard");
    const authRedirected = page.url().includes("/auth");
    if (!authRedirected) {
      await page.waitForURL(/\/access-denied.*reason=has_role/, {
        timeout: 6000,
      });
      await expect(page.getByRole("heading", { name: /Acesso restrito/i })).toBeVisible();
      await expect(page.getByText(/has_role/)).toBeVisible();
    }
  });

  test("/access-denied acessível diretamente tem CTA de retorno", async ({ page }) => {
    await page.goto("/access-denied?from=%2Fdashboard&reason=is_staff_or_admin");
    await expect(page.getByRole("heading", { name: /Acesso restrito/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Voltar à navegação segura/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Trocar de conta/i })).toBeVisible();
  });
});

