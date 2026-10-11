// 모일까 컷툰 EP.1 렌더러 — cuttoon.html 의 8장 SVG 를 1080×1350 PNG 로 찍고 preview.png 를 만든다.
//
//   node render.mjs          → 01.png … 08.png + preview.png
//   node render.mjs 3 5      → 03.png, 05.png 만 (preview 는 있는 PNG 로 다시 만듦)
//
// 필요: playwright (chromium). 로컬에 없으면 전역 설치본(npm root -g)을 쓴다.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const only = process.argv.slice(2).map(Number).filter(Boolean);
const slides = only.length ? only : [1, 2, 3, 4, 5, 6, 7, 8];
const pad = (n) => String(n).padStart(2, '0');

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const n of slides) {
  await page.goto(`${pathToFileURL(join(HERE, 'cuttoon.html')).href}?s=${n}`);
  await page.waitForFunction(() => window.READY === true);
  await page.locator(`#s${n}`).screenshot({ path: join(HERE, `${pad(n)}.png`) });
  console.log(`${pad(n)}.png`);
}

// preview.png — 4×2 타일 (각 432×540)
const tiles = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => join(HERE, `${pad(n)}.png`));
if (tiles.every((t) => existsSync(t))) {
  const T = 432, G = 24, Wp = T * 4 + G * 5, Hp = 540 * 2 + G * 3;
  await page.setViewportSize({ width: Wp, height: Hp });
  const imgs = tiles.map((t) => `<img src="${pathToFileURL(t).href}?v=${Date.now()}">`).join('');
  await page.setContent(`<style>body{margin:0;background:#e4e4e7;display:grid;grid-template-columns:repeat(4,${T}px);gap:${G}px;padding:${G}px}img{width:${T}px;height:540px;display:block;border-radius:12px}</style>${imgs}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  await page.screenshot({ path: join(HERE, 'preview.png') });
  console.log('preview.png');
}
await browser.close();
