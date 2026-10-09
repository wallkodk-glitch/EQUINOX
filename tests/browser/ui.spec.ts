import { test, expect, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Hovednavigation" }).getByRole("button", { name, exact: true }).click();
}
async function demoPlan(page: Page) {
  await page.getByRole("button", { name: "Prøv med demodata" }).click();
  await page.getByRole("button", { name: "Beregn fordeling" }).click();
  await expect(page.getByRole("heading", { name: "Din købsplan" })).toBeVisible();
}
async function noDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test("primary navigation, title focus and drill-down return preserve the active tab", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hovednavigation" });
  await expect(nav.getByRole("button")).toHaveCount(4);
  for (const name of ["Allocate", "Risk", "Settings", "Overview"]) {
    await navigate(page, name);
    await expect(nav.getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-page-title]")).toBeFocused();
  }
  await page.getByRole("button", { name: "Redigér portefølje", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Portefølje", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  await page.locator(".back-button").click();
  await expect(page.locator("[data-page-title]")).toHaveText("Overview");
});

for (const width of [320, 390, 430]) {
  test(`financial views and touch targets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    await demoPlan(page);
    await expect(page.getByRole("heading", { name: "Balance Rail", exact: true })).toBeVisible();
    await noDocumentOverflow(page);
    for (const name of ["Overview", "Risk", "Settings"]) {
      await navigate(page, name);
      await noDocumentOverflow(page);
    }
    const sizes = await page.locator(".bottom-nav button").evaluateAll(buttons => buttons.map(b => {
      const rect = b.getBoundingClientRect(); return { width: rect.width, height: rect.height };
    }));
    expect(sizes.every(size => size.width >= 44 && size.height >= 44)).toBe(true);
  });
}

test("200 percent text keeps financial charts in bounded scroll regions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("./");
  await demoPlan(page);
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  await expect(page.getByRole("region", { name: "Balance Rail, aktivernes vægte" })).toBeVisible();
  expect(await page.locator(".balance-scroll").evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await noDocumentOverflow(page);
  await navigate(page, "Risk");
  const matrix = page.getByRole("region", { name: "Korrelationsmatrix" });
  await expect(matrix).toBeVisible();
  expect(await matrix.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await matrix.focus();
  await page.keyboard.press("ArrowRight");
  await noDocumentOverflow(page);
  await navigate(page, "Overview");
  await noDocumentOverflow(page);
});

test("credential sheet focus, small viewport and cancellation retain local-only key behavior", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await page.goto("./");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Settings");
  await page.getByRole("button", { name: "Configure", exact: true }).click();
  const connect = page.getByRole("button", { name: "Connect Massive", exact: true });
  await connect.click();
  const sheet = page.getByRole("dialog"), input = sheet.getByLabel("API key");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("type", "password");
  await input.fill(crypto.randomUUID());
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(connect).toBeFocused();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Infinity Motion belongs to an actual request and stops under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("https://api.coingecko.com/**", async route => {
    await pending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      bitcoin: { usd: 100000, last_updated_at: Math.floor(Date.now() / 1000) - 5 },
      ethereum: { usd: 4000, last_updated_at: Math.floor(Date.now() / 1000) - 5 },
    }) });
  });
  await page.goto("./");
  await navigate(page, "Settings");
  await page.locator(".provider-row").filter({ hasText: "CoinGecko" }).locator("summary").click();
  await page.getByRole("button", { name: "Test public access CoinGecko", exact: true }).click();
  await expect(page.locator(".infinity-flow")).toBeVisible();
  expect(await page.locator(".infinity-flow").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  release();
  await expect(page.getByText("Public access verified", { exact: true })).toBeVisible();
  await expect(page.locator(".infinity-loader")).toHaveCount(0);
});

test("invalid numeric draft is described and does not overwrite saved capital", async ({ page }) => {
  await page.goto("./");
  const input = page.getByLabel("Ny kapital i DKK");
  await input.fill("1234");
  await input.blur();
  await expect(page.getByText("Gemt lokalt", { exact: true })).toBeVisible();
  await input.fill("");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAccessibleDescription(/Ændringen er ikke gemt/);
  await input.blur();
  await expect(input).toHaveValue("1234");
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await page.reload();
  await expect(page.getByLabel("Ny kapital i DKK")).toHaveValue("1234");
});

test("manual freshness expires visibly and offline does not imply live valuation", async ({ page, context }) => {
  const now = new Date("2026-10-07T12:00:00Z");
  await page.clock.install({ time: now });
  await page.goto("./");
  await page.getByRole("button", { name: "Redigér portefølje", exact: true }).click();
  for (const asset of ["GOOGL", "ISRG", "TSM", "BTC", "ETH"]) await page.getByLabel(`${asset} pris i DKK`).fill("100");
  await page.getByRole("button", { name: "Bekræft priser som aktuelle" }).click();
  await navigate(page, "Overview");
  await expect(page.locator(".freshness")).toHaveText("Manuelle priser · bekræftet");
  // Advance the installed Playwright clock so Date.now() and the app's
  // 60-second freshness timer move together. setSystemTime() changes the
  // wall clock without firing timers, which can leave React state unchanged.
  await page.clock.fastForward(24 * 3600e3 + 1);
  await expect(page.locator(".freshness")).toHaveText("Priser udløbet · bekræft igen");
  await context.setOffline(true);
  await expect(page.locator(".freshness")).toHaveText("Offline · manuelle priser");
  await context.setOffline(false);
});
