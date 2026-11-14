// Draws the launcher icons and the splash icon from the traced crest (src/components/crestPaths.js),
// so they stay sharp at every size. Run after `npx cap add android`:
//   node scripts/make-icons.mjs
// Needs Playwright with its Chromium (pre-installed in the build environment).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { CREST_SIZE, CROSS, NAVY, RED, WHITE } from "../src/components/crestPaths.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const RES = new URL("../android/app/src/main/res/", import.meta.url).pathname;
const PAPER = "#f6f3ec";

function crestSvg({ mono = false } = {}) {
  const fill = (colour) => (mono ? "#000" : colour);
  const shapes = [
    ...NAVY.map((d) => `<path d="${d}" fill="${fill("#1c266d")}"/>`),
    ...RED.map((d) => `<path d="${d}" fill="${fill("#ce2b26")}"/>`),
    ...CROSS.map((d) => `<path d="${d}" fill="${fill("#141414")}"/>`),
    ...(mono ? [] : WHITE.map((d) => `<path d="${d}" fill="#fff"/>`)),
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CREST_SIZE.width} ${CREST_SIZE.height}">${shapes}</svg>`;
}

// Draw the crest centred on a square, taking `share` of its height.
async function draw(page, { size, share, background = "transparent", mono = false, round = false }) {
  const html = `<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${background};
      border-radius:${round ? "50%" : "0"};overflow:hidden">
      <div style="height:${Math.round(size * share)}px;aspect-ratio:${CREST_SIZE.width}/${CREST_SIZE.height}">
        ${crestSvg({ mono }).replace("<svg ", '<svg width="100%" height="100%" ')}
      </div></div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = `${RES}mipmap-${name}/`;
  mkdirSync(dir, { recursive: true });
  // Older phones: a square-ish and a round icon, crest on paper.
  writeFileSync(`${dir}ic_launcher.png`, await draw(page, { size: 48 * scale, share: 0.7, background: PAPER }));
  writeFileSync(`${dir}ic_launcher_round.png`, await draw(page, { size: 48 * scale, share: 0.62, background: PAPER, round: true }));
  // Android 8+: the crest on a 108dp layer, kept inside the 66dp safe circle.
  writeFileSync(`${dir}ic_launcher_foreground.png`, await draw(page, { size: 108 * scale, share: 0.5 }));
  // Android 13+ themed icons: the crest as one colour.
  writeFileSync(`${dir}ic_launcher_monochrome.png`, await draw(page, { size: 108 * scale, share: 0.5, mono: true }));
}
// The Android 12+ splash icon: 288dp canvas with the icon inside its 192dp circle.
mkdirSync(`${RES}drawable-nodpi/`, { recursive: true });
writeFileSync(`${RES}drawable-nodpi/splash_crest.png`, await draw(page, { size: 288 * 3, share: 0.42 }));
await browser.close();
console.log("Icons drawn into", RES);
