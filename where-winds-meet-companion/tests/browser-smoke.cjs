const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/index.html", { waitUntil: "domcontentloaded" });

  await page.locator("#nav [data-view]").first().waitFor();
  await page.locator('#nav [data-view="codex"]').click();
  const initialEntries = await page.locator("#codex-results .codex-entry").count();
  assert.ok(initialEntries >= 130, "encyclopedia should render its full sourced catalogue");
  await page.locator("#codex-search").fill("Hutuo");
  assert.ok(await page.locator("#codex-results .codex-entry").count() >= 1, "codex search should filter live");

  await page.locator('#nav [data-view="quests"]').click();
  await page.locator("[data-quest-add]").first().click();
  assert.ok(await page.locator("#quest-form").count() === 1, "region milestones should add to the personal quest list");

  await page.locator('#nav [data-view="builds"]').click();
  await page.locator("#build-template").selectOption("0");
  assert.equal(await page.locator("#build-path").inputValue(), "Bellstrike - Umbra", "starter template should populate its Path");
  await page.locator("#build-form button").click();
  assert.ok(await page.getByText("DPS saignement · Strategic Sword + Heavenquaker Spear").count() >= 1, "build should save and render");

  await page.locator('#nav [data-view="map"]').click();
  assert.ok((await page.locator(".notice").innerText()).includes("Peer Link"), "map should explain the optional TH.GL Peer Link");
  assert.ok(await page.locator('a[href="https://www.th.gl/fr/apps/where-winds-meet"]').count() === 1, "map should link to TH.GL WWM companion");

  await page.locator('#nav [data-view="account"]').click();
  assert.ok((await page.locator("#view").innerText()).includes("Connexion cloud à configurer"), "unconfigured cloud account should be explained clearly");

  assert.deepEqual(errors, [], "the application should not throw browser runtime errors");
  await browser.close();
  process.stdout.write("Browser smoke tests passed.\n");
})().catch(error => {
  process.stderr.write(String(error.stack || error) + "\n");
  process.exit(1);
});
