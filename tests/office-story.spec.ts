import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/escritorio");
  await page.evaluate(() => { localStorage.removeItem("lifesystem-office-story"); localStorage.removeItem("lifesystem-office-briefing"); });
  await page.reload();
});

test("prólogo pelo briefing: falas pelo teclado, conquista e progresso guardado", async ({ page }) => {
  const briefing = page.getByRole("complementary", { name: "Briefing da estação" });
  await briefing.getByRole("button", { name: "Assistir prólogo" }).click();
  const scene = page.getByRole("dialog", { name: "Cena: A estação" });
  await expect(scene).toBeVisible();
  await expect(scene.getByText("Quem está a bordo e para que serve tudo isso.")).toBeVisible();

  // Cada toque completa a fala em digitação ou avança; o leitor de tela recebe a fala inteira.
  await expect(async () => {
    await scene.press("Space");
    await expect(scene.getByText("Conquista desbloqueada")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20000 });
  await expect(scene.getByText("Tripulante", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lifesystem-office-story") || "[]"))).toEqual(["prologo"]);

  await scene.getByRole("button", { name: "Próximo: Tire da cabeça" }).click();
  await expect(page.getByRole("dialog", { name: "Cena: Tire da cabeça" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /^Cena:/ })).toHaveCount(0);
  await expect(briefing).toHaveCount(0);
});

test("menu da campanha: Esc numa cena volta ao menu, ← volta uma fala", async ({ page }) => {
  await page.getByRole("button", { name: "Modo história", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Modo história" });
  await expect(menu.getByText("0/7 capítulos")).toBeVisible();
  await menu.getByRole("button", { name: "Assistir capítulo 2: Esclarecer" }).click();

  const scene = page.getByRole("dialog", { name: "Cena: Esclarecer" });
  const line = scene.locator("p[aria-live]");
  await expect(line).toContainText("Sirius: Agora cada captura passa por uma pergunta", { timeout: 10000 });
  // Enter completa a fala em digitação e, depois, avança para a próxima.
  await expect(async () => {
    await scene.press("Enter");
    await expect(line).toContainText("Se não exige", { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await scene.press("ArrowLeft");
  await expect(line).toContainText("Agora cada captura passa por uma pergunta");

  await scene.press("Escape");
  await expect(scene).toHaveCount(0);
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("‘Agora não’ esconde o briefing de vez", async ({ page }) => {
  await page.getByRole("complementary", { name: "Briefing da estação" }).getByRole("button", { name: "Agora não" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Modo história", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Briefing da estação" })).toHaveCount(0);
});

test("fim de capítulo leva ao anfitrião na estação", async ({ page }) => {
  await page.getByRole("button", { name: "Modo história", exact: true }).click();
  await page.getByRole("dialog", { name: "Modo história" }).getByRole("button", { name: "Assistir capítulo 6: O pacto" }).click();
  const scene = page.getByRole("dialog", { name: "Cena: O pacto" });
  await expect(async () => {
    await scene.press("Space");
    await expect(scene.getByText("Conquista desbloqueada")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20000 });
  await scene.getByRole("button", { name: "Ver Órion na estação" }).click();
  await expect(page.getByRole("dialog", { name: /^Cena:|Modo história/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /^Comando de Órion/ })).toBeVisible();
});
