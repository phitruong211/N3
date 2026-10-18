import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWidgetStyle, readWidgetStyles, moveWidget, DEFAULT_WIDGET_STYLE, WIDGET_COLORS, widgetInk, glassBackgrounds, widgetSpan, snapWidgetSize, sizeFromPixels, ambientColors, AMBIENT_FALLBACK, CLEAR_TINT } from '../src/lib/deckWidgets.ts';

test('widget preferences validate stored values, keeping opacity off text and respecting bounds', () => {
  assert.deepEqual(normalizeWidgetStyle(null), DEFAULT_WIDGET_STYLE);
  assert.deepEqual(readWidgetStyles([]), {});
  assert.deepEqual(normalizeWidgetStyle({ size: 'injected', color: 'url(unsafe)', opacity: Infinity, blur: NaN }), DEFAULT_WIDGET_STYLE);
  assert.deepEqual(normalizeWidgetStyle({ size: 'medium', color: '#AABBCC', opacity: -4, blur: 100 }), { size: 'medium', color: '#aabbcc', opacity: 0, blur: 40 });
  assert.equal(normalizeWidgetStyle({ size: 'xlarge' }).size, 'xlarge');
  assert.deepEqual(readWidgetStyles({ group: { size: 'large', opacity: 75 } }).group, { ...DEFAULT_WIDGET_STYLE, size: 'large', opacity: 70 });
  // Tones saved before the Apple palette keep rendering exactly as chosen.
  assert.equal(normalizeWidgetStyle({ color: '#a78bfa' }).color, '#a78bfa');
  assert.equal(normalizeWidgetStyle({ color: '#b5cee8', opacity: 30 }).opacity, 30);
  assert.equal(WIDGET_COLORS.length, 8);
  assert.equal(WIDGET_COLORS[0].value, CLEAR_TINT);
});

test('widget footprints form fixed tiers and shrink to the phone grid', () => {
  assert.deepEqual(widgetSpan('small', 8), { cols: 1, rows: 1 });
  assert.deepEqual(widgetSpan('medium', 4), { cols: 2, rows: 1 });
  assert.deepEqual(widgetSpan('large', 4), { cols: 2, rows: 2 });
  assert.deepEqual(widgetSpan('xlarge', 6), { cols: 4, rows: 2 });
  assert.deepEqual(widgetSpan('xlarge', 2), { cols: 2, rows: 3 });
});

test('snapping picks the nearest tier for any drag footprint', () => {
  assert.equal(snapWidgetSize(1, 1, 6), 'small');
  assert.equal(snapWidgetSize(1.4, 1, 6), 'small');
  assert.equal(snapWidgetSize(2, 1, 6), 'medium');
  assert.equal(snapWidgetSize(2, 1.9, 6), 'large');
  assert.equal(snapWidgetSize(3.6, 2, 6), 'xlarge');
  assert.equal(snapWidgetSize(6, 6, 6), 'xlarge');
  assert.equal(snapWidgetSize(0.2, 0.2, 6), 'small');
  assert.equal(snapWidgetSize(2, 2.9, 2), 'xlarge');
  assert.equal(snapWidgetSize(2, 1, 2), 'medium');
});

test('legacy pixel sizes migrate to the closest tier', () => {
  const cell = 160, gap = 16;
  assert.equal(sizeFromPixels(160, 160, cell, gap, 6), 'small');
  assert.equal(sizeFromPixels(336, 336, cell, gap, 6), 'large');
  assert.equal(sizeFromPixels(336, 160, cell, gap, 6), 'medium');
  assert.equal(sizeFromPixels(700, 340, cell, gap, 6), 'xlarge');
  assert.equal(sizeFromPixels(300, 460, cell, gap, 6), 'large');
  assert.equal(sizeFromPixels(Number.NaN, 300, cell, gap, 6), DEFAULT_WIDGET_STYLE.size);
  assert.equal(sizeFromPixels(300, 300, 0, gap, 6), DEFAULT_WIDGET_STYLE.size);
});

test('ambient glows follow the first three tones and neutralise the clear tone', () => {
  const styles = tones => tones.map(color => ({ ...DEFAULT_WIDGET_STYLE, color }));
  assert.deepEqual(ambientColors(styles([])), [AMBIENT_FALLBACK]);
  assert.deepEqual(ambientColors(styles([CLEAR_TINT])), [AMBIENT_FALLBACK, AMBIENT_FALLBACK, AMBIENT_FALLBACK]);
  assert.deepEqual(ambientColors(styles(['#0a84ff', '#34c759', '#ff375f', '#af52de'])), ['#0a84ff', '#34c759', '#ff375f']);
});

test('glass ink stays at AA text contrast across every tone, opacity, theme and ambient glow', () => {
  const rgb = hex => [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const luminance = color => color.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const ambients = [undefined, WIDGET_COLORS.map(c => c.value).slice(1, 4), ['#ffcc00', '#00c7be', '#ff9f0a']];
  for(const light of [false,true])for(const tone of WIDGET_COLORS)for(const ambient of ambients)for(let opacity=0;opacity<=70;opacity+=2) {
    const style={...DEFAULT_WIDGET_STYLE,color:tone.value,opacity};
    const colors=widgetInk(style,light,ambient);
    for(const background of glassBackgrounds(style,light,ambient))for(const text of [colors.ink,colors.ink2]) {
      const a=luminance(rgb(text)),b=luminance(colors.halo ? rgb(colors.halo) : background);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${tone.label} ${opacity}% ${light?'light':'dark'} ${text}`);
    }
  }
});

test('widget move supports either side, retains every ID once, and leaves input untouched', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveWidget(ids, 'a', 'c'), ['b', 'a', 'c']);
  assert.deepEqual(moveWidget(ids, 'a', 'c', true), ['b', 'c', 'a']);
  assert.deepEqual(moveWidget(ids, 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(moveWidget(ids, 'x', 'a'), ids);
  assert.deepEqual(moveWidget(ids, 'a', 'a'), ids);
  assert.deepEqual(ids, ['a', 'b', 'c']);
});
