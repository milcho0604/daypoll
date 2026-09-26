// 동화풍 영상 렌더러 (storybook-video 스킬).
//
//   node render.mjs                 → out.mp4 (OUT 환경변수로 경로 지정, 1080×1920, 30fps, BGM 포함)
//   node render.mjs --stills 1,5,9  → 해당 초의 PNG 스틸만 frames/ 에 (검수용)
//
// story.html 의 window.seek(t) / window.DURATION 계약만 지키면 어떤 이야기든 그대로 렌더된다.
//
// 필요: playwright(chromium), libx264 가 들어간 ffmpeg (FFMPEG 환경변수로 경로 지정 가능),
//       python3 (BGM 합성). 폰트는 fonts/ 에 Pretendard woff2 가 없으면 npm 에서 받아 온다.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const OUT = process.env.OUT ?? join(HERE, 'out.mp4');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execFileSync('npm', ['root', '-g']).toString().trim();
    return require(join(globalRoot, 'playwright'));
  }
}

function ensureFonts() {
  const dir = join(HERE, 'fonts');
  const weights = ['Medium', 'SemiBold', 'Bold', 'ExtraBold'];
  if (weights.every((w) => existsSync(join(dir, `Pretendard-${w}.woff2`)))) return;
  mkdirSync(dir, { recursive: true });
  const tmp = join(HERE, '.font-tmp');
  mkdirSync(tmp, { recursive: true });
  execFileSync('npm', ['pack', 'pretendard@1.3.9', '--pack-destination', tmp], { stdio: 'ignore' });
  execFileSync('tar', ['xzf', join(tmp, 'pretendard-1.3.9.tgz'), '-C', tmp]);
  for (const w of weights) {
    copyFileSync(join(tmp, 'package/dist/web/static/woff2', `Pretendard-${w}.woff2`), join(dir, `Pretendard-${w}.woff2`));
  }
  rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  ensureFonts();
  const stillsArg = process.argv.indexOf('--stills');
  const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'story.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);

  if (stills) {
    mkdirSync(join(HERE, 'frames'), { recursive: true });
    for (const t of stills) {
      await page.evaluate((t) => window.seek(t), t);
      await page.screenshot({ path: join(HERE, 'frames', `still-${t.toFixed(2).padStart(6, '0')}.png`) });
    }
    await browser.close();
    return;
  }

  const wav = join(HERE, 'bgm.wav');
  execFileSync('python3', [join(HERE, 'bgm.py'), wav, String(duration)], { stdio: 'inherit' });

  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const total = Math.round(duration * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  await browser.close();
  console.log(`\n→ ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
