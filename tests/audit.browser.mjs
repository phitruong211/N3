// Design/a11y/perf audit. Run `npm run build` first, then `npm run test:audit`.
// Reports by default; set AUDIT_STRICT=1 to fail on any finding.
import { preview } from 'vite';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { brotliCompressSync, constants } from 'node:zlib';

const ROUTES = ['/today', '/library/vocabulary', '/library/grammar', '/library/kanji', '/library/listening', '/decks', '/review', '/quiz', '/progress', '/saved', '/settings', '/dictionary', '/no-such-page'];
const THEMES = process.env.AUDIT_THEMES?.split(',') ?? ['light', 'dark', 'reading', 'high-contrast'];
const SIZES = [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 375, height: 812 }]];
const strict = process.env.AUDIT_STRICT === '1';

const server = await preview({ preview: { port: 0, host: '127.0.0.1' } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
const rows = [];
let today;

for (const [sizeName, viewport] of SIZES) {
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport, hasTouch: sizeName === 'mobile' });
    await context.addInitScript(value => {
      sessionStorage.setItem('guest:session', '1');
      localStorage.setItem('guest:n3_settings', JSON.stringify({ theme: value, autoPlayAudio: false, reducedMotion: false }));
    }, theme);
    const page = await context.newPage();
    let requests = [];
    // Text assets are measured brotli-compressed, as Vercel serves them; fonts and images are already compressed.
    page.on('response', async response => {
      try {
        const body = await response.body(), url = response.url().replace(base, '');
        requests.push([url, /\.(js|css|json|html|svg)(\?|$)|^\/$/.test(url) ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length : body.length]);
      } catch { /* aborted */ }
    });
    for (const route of ROUTES) {
      requests = [];
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      if (route === '/today' && theme === 'light' && sizeName === 'desktop') today = requests.slice();
      const axe = await new AxeBuilder({ page }).analyze();
      const hard = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
      const probe = await page.evaluate(() => {
        const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const targets = [...document.querySelectorAll('button, [role=button], input:not([type=hidden]), select, summary')].filter(visible)
          .filter(el => !el.matches('.hit, .sr-only') && !el.closest('.sr-only'))
          .filter(el => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; });
        let smallest = 99;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement;
          if (!node.textContent.trim() || !el || !visible(el) || el.closest('rt, kbd, script, style, noscript')) continue;
          smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
        }
        return { h1: document.querySelectorAll('h1').length, small: targets.length, smallest, overflow: document.documentElement.scrollWidth > innerWidth + 1, lucide: document.querySelectorAll('svg.lucide').length };
      });
      rows.push({ size: sizeName, theme, route, axe: hard.length, axeIds: hard.map(v => v.id).join(','), ...probe });
    }
    await context.close();
  }
}
await browser.close();
await new Promise(resolve => server.httpServer.close(resolve));

const pad = (value, width) => String(value).padEnd(width);
console.log(pad('size', 8) + pad('theme', 14) + pad('route', 22) + 'axe h1 small minpx overflow lucide');
for (const row of rows) console.log(pad(row.size, 8) + pad(row.theme, 14) + pad(row.route, 22) + [row.axe, row.h1, row.small, row.smallest, row.overflow ? 'Y' : '-', row.lucide].join('   ') + (row.axeIds ? '  ' + row.axeIds : ''));
const bytes = (today ?? []).reduce((sum, [, size]) => sum + size, 0);
console.log(`\n/today first load (compressed): ${Math.round(bytes / 1024)} KB in ${today?.length ?? 0} requests. Largest:`);
for (const [url, size] of (today ?? []).sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${Math.round(size / 1024)} KB ${url}`);

const issues = rows.filter(row => row.route !== '/no-such-page' && (row.axe || row.h1 !== 1 || row.small || row.smallest < 11 || row.overflow || row.lucide));
console.log(`\n${issues.length} of ${rows.length} page views have findings.`);
if (strict && issues.length) process.exit(1);
