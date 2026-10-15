import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWidgetStyle, readWidgetStyles, moveWidget, DEFAULT_WIDGET_STYLE, WIDGET_COLORS, widgetInk } from '../src/lib/deckWidgets.ts';

test('widget preferences validate stored values, keeping opacity off text and respecting bounds', () => {
  assert.deepEqual(normalizeWidgetStyle(null), DEFAULT_WIDGET_STYLE);
  assert.deepEqual(readWidgetStyles([]), {});
  assert.deepEqual(normalizeWidgetStyle({ size: 'injected', color: 'url(unsafe)', opacity: Infinity, blur: NaN }), DEFAULT_WIDGET_STYLE);
  assert.deepEqual(normalizeWidgetStyle({ size: 'medium', color: '#AABBCC', opacity: -4, blur: 100 }), { size: 'medium', color: '#aabbcc', opacity: 5, blur: 40 });
  assert.deepEqual(readWidgetStyles({ group: { size: 'large', opacity: 75 } }).group, { ...DEFAULT_WIDGET_STYLE, size: 'large', opacity: 70 });
  assert.equal(normalizeWidgetStyle({color:'#a78bfa'}).color,'#a78bfa');
  assert.equal(WIDGET_COLORS.length,6);
});

test('glass ink stays at AA text contrast across every tone, opacity and theme surface', () => {
  const rgb = hex => [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const mix = (a,b,alpha) => a.map((value,index)=>value*alpha+b[index]*(1-alpha));
  const luminance = color => color.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  for(const light of [false,true])for(const tone of WIDGET_COLORS)for(let opacity=5;opacity<=70;opacity++) {
    const colors=widgetInk({...DEFAULT_WIDGET_STYLE,color:tone.value,opacity},light);
    for(const base of light?['#eceeeb','#c7e1d5','#dbd6ec']:['#0d100f','#1f3930','#2f2a42','#14432c','#322046']) {
      const glass=mix(rgb(tone.value),rgb(base),opacity/100);
      for(const background of [glass,mix([255,255,255],glass,.06),mix([0,0,0],glass,.06)])for(const text of [colors.ink,colors.ink2]) {
        const a=luminance(rgb(text)),b=luminance(colors.halo ? rgb(colors.halo) : background);
        assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${tone.label} ${opacity}% ${light?'light':'dark'} ${text}`);
      }
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
