import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_PATHS } from '../src/lib/navigation.ts';
import { PAGE_TITLES, SITE_URL, applyPageMeta, pageMeta } from '../src/lib/seo.ts';

const pages = Object.keys(PAGE_PATHS);

test('every page has a title, a description and a canonical URL on the site', () => {
  for (const page of pages) {
    const meta = pageMeta(page);
    assert.ok(meta.title.length > 5 && meta.title.length <= 75, `${page} title length ${meta.title.length}`);
    assert.ok(meta.description.length >= 40 && meta.description.length <= 170, `${page} description length ${meta.description.length}`);
    assert.equal(meta.canonical, `${SITE_URL}${PAGE_PATHS[page]}`);
    assert.ok(PAGE_TITLES[page], `${page} header title`);
  }
});

test('pages that share an address share the canonical URL', () => {
  assert.equal(pageMeta('srs').canonical, pageMeta('anki').canonical);
  assert.equal(pageMeta('dashboard').canonical, pageMeta('search').canonical);
});

test('applyPageMeta updates the tab title, description and canonical link', () => {
  const attrs = {};
  const el = name => ({ setAttribute: (key, value) => { attrs[`${name}.${key}`] = value; } });
  const doc = { title: '', querySelector: selector => selector.startsWith('meta') ? el('description') : selector.startsWith('link') ? el('canonical') : null };
  applyPageMeta('kanji', doc);
  assert.equal(doc.title, pageMeta('kanji').title);
  assert.equal(attrs['description.content'], pageMeta('kanji').description);
  assert.equal(attrs['canonical.href'], `${SITE_URL}/library/kanji`);
});

test('a missing meta tag does not break navigation', () => {
  const doc = { title: '', querySelector: () => null };
  assert.doesNotThrow(() => applyPageMeta('dashboard', doc));
});
