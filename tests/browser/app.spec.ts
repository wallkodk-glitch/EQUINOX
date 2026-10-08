import { test, expect, type Page } from "@playwright/test";
async function settings(page: Page, section = "Backup og historik") {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const group = page.locator(".settings-group").filter({ has: page.getByText(section, { exact: true }) });
  if (await group.getAttribute("open") === null) await group.locator("summary").first().click();
}
import { readFile, writeFile } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("close", () => expect(errors).toEqual([]));
});
test("demo isolation, plan details, mobile layout and reload persistence", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Ny kapital" })).toBeVisible();
  await page.getByLabel("Ny kapital i DKK").fill("1234");
  await page.getByLabel("Ny kapital i DKK").blur();
  await expect(page.getByText("Gemt lokalt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prøv med demodata" }).click();
  await expect(
    page.getByText("DEMO · SYNTETISKE DATA", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Beregn fordeling" }).click();
  await expect(
    page.getByRole("heading", { name: "Din købsplan" }),
  ).toBeVisible();
  await expect(
    page.getByText("Midlertidigt demo-snapshot", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/equinox-mobile-plan.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Åbn Calculation Details" }).click();
  await expect(
    page.getByRole("heading", { name: "Calculation Details" }),
  ).toBeVisible();
  await page.getByText("Covariance og correlation", { exact: true }).click();
  await page.getByText("Targets og solver", { exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Targetværdi DKK" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Afslut demo" }).click();
  await page.getByRole("button", { name: "Allocate", exact: true }).click();
  await expect(page.getByLabel("Ny kapital i DKK")).toHaveValue("1234");
  await page.reload();
  await expect(page.getByLabel("Ny kapital i DKK")).toHaveValue("1234");
});
test("a Node-generated ERC snapshot is verified and regenerated in the browser", async ({
  page,
}) => {
  await page.goto("./");
  await settings(page);
  await page
    .getByText("Verificér snapshot", { exact: true })
    .locator("input")
    .setInputFiles("validation/node-snapshot.json");
  await expect(
    page.getByRole("heading", { name: "Calculation Details" }),
  ).toBeVisible();
  await expect(
    page.getByText("Historisk snapshot genberegnet og hash verificeret.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("manifest, service worker and offline shell", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const manifest = await page.evaluate(
    async () => await (await fetch("manifest.webmanifest")).json(),
  );
  expect(manifest.scope).toBe("/EQUINOX/");
  expect(manifest.display).toBe("standalone");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ny kapital" })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
test("manual equal weight needs no history, input edits invalidate displayed plan, backup downloads", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Redigér portefølje", exact: true }).click();
  for (const s of ["GOOGL", "ISRG", "TSM", "BTC", "ETH"]) {
    await page.getByLabel(`${s} pris i DKK`).fill("100");
    await page.getByLabel(`${s} antal`).fill("1");
  }
  await page
    .getByRole("button", { name: "Bekræft priser som aktuelle" })
    .click();
  await page.getByRole("button", { name: "Allocate", exact: true }).click();
  await page.getByRole("button", { name: "Beregn fordeling" }).click();
  await expect(
    page.getByRole("heading", { name: "Din købsplan" }),
  ).toBeVisible();
  await page.getByLabel("Ny kapital i DKK").fill("999");
  await page.getByLabel("Ny kapital i DKK").blur();
  await expect(
    page.getByText("Input ændret · beregn igen", { exact: true }),
  ).toBeVisible();
  await settings(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportér backup" }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toContain("EQUINOX-backup");
  await page.getByRole("button", { name: "Allocate", exact: true }).click();
  await page.getByLabel("Ny kapital i DKK").fill("71");
  await page.getByLabel("Ny kapital i DKK").blur();
  await settings(page);
  await page
    .getByLabel("Gendan backup", { exact: true })
    .setInputFiles((await backup.path())!);
  await expect(
    page.getByText(
      "Backup gendannet. Den tidligere database er bevaret som recovery-kopi.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ny kapital i DKK")).toHaveValue("999");
  await settings(page);
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await context.setOffline(true);await page.reload();
  await expect(page.getByText('Offline',{exact:true})).toBeVisible();
  await settings(page);await page.locator('.history-row').click();
  await expect(page.getByRole('heading',{name:'Calculation Details'})).toBeVisible();
  await context.setOffline(false);
});
test('light/dark appearance and clear input error at narrow mobile width',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('./');
 await page.getByRole('button',{name:'Beregn fordeling'}).click();await expect(page.getByRole('alert')).toContainText('MANUAL_CURRENT_PRICE_REQUIRED');
 await settings(page, 'Udseende og installation');await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');
 expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(10, 20, 23)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(238, 242, 241)');
});
test("service worker waits for approval and preserves local state through update", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByLabel("Ny kapital i DKK").fill("4321");
  await page.getByLabel("Ny kapital i DKK").blur();
  await expect(page.getByText("Gemt lokalt", { exact: true })).toBeVisible();
  const swPath = "dist/sw.js",
    original = await readFile(swPath, "utf8");
  try {
    await writeFile(
      swPath,
      original.replace(/(const CACHE="[^"]+)/, "$1-browser-update-test"),
    );
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r!.update();
    });
    await expect(
      page.getByRole("button", { name: "Opdatér app" }),
    ).toBeVisible();
    expect(
      await page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    ).toBe(true);
    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      page.getByRole("button", { name: "Opdatér app" }).click(),
    ]);
    await expect(page.getByLabel("Ny kapital i DKK")).toHaveValue("4321");
    const cachesAfter = await page.evaluate(async () => await caches.keys());
    expect(
      cachesAfter.filter((k) => k.startsWith("equinox:/EQUINOX/:")),
    ).toHaveLength(1);
    expect(cachesAfter.some((k) => k.endsWith("-browser-update-test"))).toBe(
      true,
    );
  } finally {
    await writeFile(swPath, original);
  }
});
