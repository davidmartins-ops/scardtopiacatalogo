import { test, expect } from "../playwright-fixture";

const ROUTES = ["/", "/catalogo", "/tendencias", "/termos", "/privacidade", "/rota-inexistente-404"];

test.describe("SiteFooter — presença global e links legais", () => {
  for (const route of ROUTES) {
    test(`renderiza o footer em ${route}`, async ({ page }) => {
      await page.goto(route);
      const footer = page.getByTestId("site-footer");
      await expect(footer).toBeVisible({ timeout: 15_000 });
      await expect(footer).toHaveAttribute("role", "contentinfo");
    });
  }

  test("JSON-LD Organization é único em qualquer rota", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      await page.getByTestId("site-footer").waitFor({ state: "visible" });
      const orgCount = await page.evaluate(() => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        );
        return scripts.filter((s) => (s.textContent || "").includes('"Organization"')).length;
      });
      expect(orgCount, `rota ${route} deve ter exatamente 1 Organization JSON-LD`).toBe(1);
    }
  });

  test("links Termos/Privacidade funcionam no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/catalogo");
    await page.getByTestId("footer-link-termos").scrollIntoViewIfNeeded();
    await page.getByTestId("footer-link-termos").click();
    await expect(page).toHaveURL(/\/termos$/);
    await expect(page.locator("h1")).toContainText(/Termos de Uso/i);

    await page.goto("/catalogo");
    await page.getByTestId("footer-link-privacidade").scrollIntoViewIfNeeded();
    await page.getByTestId("footer-link-privacidade").click();
    await expect(page).toHaveURL(/\/privacidade$/);
    await expect(page.locator("h1")).toContainText(/Política de Privacidade/i);
  });

  test("Gerenciar cookies abre o banner", async ({ page }) => {
    await page.goto("/catalogo");
    await page.getByTestId("footer-manage-cookies").scrollIntoViewIfNeeded();
    await page.getByTestId("footer-manage-cookies").click();
    await expect(page.getByRole("dialog", { name: /privacidade/i })).toBeVisible();
  });
});
