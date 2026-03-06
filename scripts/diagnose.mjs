import fs from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push({ type: "console", text: msg.text() });
  }
});
page.on("pageerror", (err) => {
  errors.push({ type: "pageerror", text: String(err) });
});

await page.goto("http://127.0.0.1:4174", { waitUntil: "domcontentloaded" });
await page.click("#start-btn");
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(500);
  }
});
await page.keyboard.down("ArrowUp");
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(900);
  }
});
await page.keyboard.up("ArrowUp");
await page.keyboard.press("Space");
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(600);
  }
});
await page.mouse.down({ button: "left" });
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(900);
  }
});
await page.mouse.up({ button: "left" });
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(250);
  }
});
fs.mkdirSync("output/diagnose", { recursive: true });
await page.screenshot({ path: "output/diagnose/shot-stepped.png", type: "png" });
const state = await page.evaluate(() => (typeof window.render_game_to_text === "function" ? window.render_game_to_text() : null));
fs.writeFileSync("output/diagnose/state-stepped.json", state ?? "null");
fs.writeFileSync("output/diagnose/errors-stepped.json", JSON.stringify(errors, null, 2));
await browser.close();
