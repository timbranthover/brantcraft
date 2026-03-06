import fs from "node:fs";
import { chromium } from "playwright";

const savePayload = {
  player: {
    x: -1.19,
    y: 22,
    z: -1.41,
    yaw: 0.45,
    pitch: -0.35,
    health: 100,
    stamina: 100,
    oxygen: 100,
  },
  selectedIndex: 1,
  timeOfDay: 0.34,
  inventory: Array.from({ length: 36 }, () => null),
  changes: {},
};
savePayload.inventory[0] = { itemId: "crafting_table", count: 1, durability: null };
savePayload.inventory[1] = { itemId: "wooden_axe", count: 1, durability: 59 };
savePayload.inventory[2] = { itemId: "oak_planks", count: 16, durability: null };
savePayload.inventory[3] = { itemId: "stick", count: 8, durability: null };
savePayload.inventory[4] = { itemId: "cobblestone", count: 12, durability: null };
savePayload.inventory[5] = { itemId: "oak_log", count: 2, durability: null };

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

await page.addInitScript((payload) => {
  localStorage.setItem("threecraft-save-84621", JSON.stringify(payload));
}, savePayload);

fs.mkdirSync("output/upgrade-diagnose", { recursive: true });
await page.goto("http://127.0.0.1:4174", { waitUntil: "domcontentloaded" });
await page.click("#start-btn");
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(200);
  }
});
const beforeMine = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.mouse.down({ button: "left" });
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(1200);
  }
});
await page.mouse.up({ button: "left" });
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(300);
  }
});
const afterMine = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: "output/upgrade-diagnose/world.png", type: "png" });
await page.keyboard.press("KeyE");
await page.waitForTimeout(120);
const inventoryOpen = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: "output/upgrade-diagnose/inventory.png", type: "png" });
await page.keyboard.press("KeyE");
await page.waitForTimeout(120);
await page.keyboard.press("Digit1");
await page.mouse.click(720, 450, { button: "right" });
await page.evaluate(async () => {
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(200);
  }
});
const afterPlace = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
fs.writeFileSync(
  "output/upgrade-diagnose/state.json",
  JSON.stringify({ beforeMine, afterMine, inventoryOpen, afterPlace }, null, 2),
);
fs.writeFileSync("output/upgrade-diagnose/errors.json", JSON.stringify(errors, null, 2));
await browser.close();