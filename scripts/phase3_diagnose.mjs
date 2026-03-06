import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.resolve("output/phase3-diagnose");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push(msg.text());
  }
});
page.on("pageerror", (error) => {
  errors.push(String(error));
});

await page.goto("http://127.0.0.1:4177", { waitUntil: "networkidle" });
await page.click("#start-btn");
await page.waitForTimeout(300);
await page.evaluate(() => window.advanceTime(1000));
const startState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

await page.keyboard.press("KeyE");
await page.waitForTimeout(150);
await page.click(".recipe-chip.ready");
await page.waitForTimeout(150);
const inventoryState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, "inventory.png"), type: "png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(120);

await page.evaluate(() => {
  window.__brantcraftDebug.setTimeOfDay(0.82);
  window.advanceTime(5000);
});
const nightState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, "night.png"), type: "png" });

await page.evaluate(() => {
  window.__brantcraftDebug.setTimeOfDay(0.36);
  window.advanceTime(3000);
});
const dayState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

await fs.writeFile(path.join(outDir, "state.json"), JSON.stringify({ startState, inventoryState, nightState, dayState }, null, 2));
await fs.writeFile(path.join(outDir, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();



