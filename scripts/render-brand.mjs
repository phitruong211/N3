// Regenerates the brand files in public/ from src/lib/brand.ts. Run: npm run brand
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BRAND_COLORS, brandSvg } from '../src/lib/brand.ts';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const fontUrl = name => pathToFileURL(join(publicDir, 'fonts', name)).href;
const { ink, sun, paper } = BRAND_COLORS;
const sized = (svg, px) => svg.replace('<svg ', `<svg width="${px}" height="${px}" `);

writeFileSync(join(publicDir, 'so-nhat-mark.svg'), brandSvg('full'));
writeFileSync(join(publicDir, 'favicon.svg'), brandSvg('small'));

const dir = mkdtempSync(join(tmpdir(), 'n3-brand-'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  async function shot(html, width, height, file) {
    const path = join(dir, `${file}.html`);
    writeFileSync(path, `<!doctype html><meta charset="utf-8"><style>
      @font-face{font-family:JP;src:url(${fontUrl('noto-serif-jp.woff2')}) format('woff2')}
      html{background:transparent}body{margin:0;width:${width}px;height:${height}px}
      ${html.css ?? ''}</style>${html.body}`);
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(path).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(publicDir, file), omitBackground: true });
  }

  const icon = (px, logoRatio, radiusRatio) => ({
    css: `body{display:grid;place-items:center;background:${paper};border-radius:${Math.round(px * radiusRatio)}px}`,
    body: sized(brandSvg('full'), Math.round(px * logoRatio)),
  });
  await shot(icon(180, .74, 0), 180, 180, 'apple-touch-icon.png');
  await shot(icon(192, .74, .22), 192, 192, 'icon-192.png');
  await shot(icon(512, .74, .22), 512, 512, 'icon-512.png');
  await shot(icon(512, .56, 0), 512, 512, 'icon-maskable-512.png'); // keeps the mark inside the 80% safe zone

  await shot({
    css: `body{position:relative;overflow:hidden;display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box;
      background:linear-gradient(165deg,#F2D3AE 0%,#F6E6D0 46%,${paper} 100%);color:${ink};font-family:'Helvetica Neue',Arial,sans-serif}
      .orb{position:absolute;right:-110px;top:-190px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle at 40% 40%,${sun}55,${sun}22 58%,transparent 70%)}
      .mark{position:relative;flex:none}
      .text{position:relative}.name{font-size:112px;font-weight:700;letter-spacing:.04em;line-height:1}
      .tag{margin-top:18px;font-size:44px;font-weight:500}.jp{margin-top:34px;font-family:JP,serif;font-size:34px;color:${sun};letter-spacing:.3em}
      .chips{margin-top:30px;font-size:26px;letter-spacing:.04em;line-height:1.55;opacity:.8;white-space:nowrap}.url{position:absolute;left:96px;bottom:44px;font-size:24px;opacity:.7}`,
    body: `<div class="orb"></div><div class="mark">${sized(brandSvg('full'), 300)}</div>
      <div class="text"><div class="name">SỔ NHẬT</div><div class="tag">Học tiếng Nhật mỗi ngày</div>
      <div class="jp">一日一歩</div><div class="chips">JLPT N5 · N4 · N3 · N2<br>Từ vựng · Kanji · Ngữ pháp · Ôn ngắt quãng</div></div>
      <div class="url">n3-green.vercel.app</div>`,
  }, 1200, 630, 'og-image.png');
} finally {
  await browser.close();
}
console.log('Brand files written to public/');
