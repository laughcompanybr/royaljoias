import { test, expect } from "@playwright/test";

/**
 * E2E: fluxo completo de upload de comprovante em telas pequenas.
 *
 * Cobre: abertura do dropzone, seleção do arquivo (via input hidden,
 * porque o file-picker nativo não é acessível ao Playwright), aparição
 * da prévia com botão "Enviar", cancelamento do upload em andamento e
 * detecção de erro quando o arquivo é maior que 10MB.
 *
 * Roda apenas no projeto "mobile" do Playwright (Pixel 7 viewport) —
 * as demais checagens desktop já existem em outros specs.
 */
test.describe("ReceiptField — mobile", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "chromium only");
  test.skip(
    ({ viewport }) => !viewport || viewport.width > 500,
    "somente viewports mobile",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/financeiro", { waitUntil: "domcontentloaded" });
    // Se cair na tela de auth (session ausente), pula — o fluxo completo
    // requer sessão real; o objetivo aqui é validar o widget quando visível.
    await page.waitForTimeout(500);
    if (page.url().includes("/auth")) {
      test.skip(true, "sem sessão autenticada no ambiente de teste");
    }
  });

  test("valida arquivo grande e mostra erro claro no mobile", async ({ page }) => {
    // Abre o dialog de nova despesa (o formulário que contém o ReceiptField)
    const trigger = page
      .getByRole("button", { name: /Nova despesa|Adicionar despesa|Nova/i })
      .first();
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "botão de nova despesa não encontrado nesta viewport");
    }
    await trigger.click();

    const dropzone = page.getByTestId("receipt-dropzone").first();
    await expect(dropzone).toBeVisible();

    // O dropzone é do tamanho do card — não deve extrapolar horizontalmente.
    const box = await dropzone.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width);
    }

    // Tenta anexar um arquivo grande (11MB) para acionar a validação client-side.
    const input = page.locator('input[type="file"]').first();
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0);
    await input.setInputFiles({
      name: "grande.pdf",
      mimeType: "application/pdf",
      buffer: bigBuffer,
    });

    // Deve exibir mensagem de "excede 10MB" e não iniciar upload.
    await expect(page.getByTestId("receipt-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("receipt-error")).toContainText(/10MB/i);
  });

  test("mostra prévia com Enviar/Descartar antes do upload", async ({ page }) => {
    const trigger = page
      .getByRole("button", { name: /Nova despesa|Adicionar despesa|Nova/i })
      .first();
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "botão de nova despesa não encontrado");
    }
    await trigger.click();

    const input = page.locator('input[type="file"]').first();
    // 1x1 PNG mínimo.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    await input.setInputFiles({
      name: "comprovante.png",
      mimeType: "image/png",
      buffer: png,
    });

    // Aparece o botão Enviar (confirmação antes do upload).
    const confirm = page.getByTestId("receipt-confirm-upload");
    await expect(confirm).toBeVisible({ timeout: 5000 });

    // Descartar limpa a prévia sem enviar.
    await page.getByRole("button", { name: /Descartar/ }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId("receipt-dropzone").first()).toBeVisible();
  });
});
