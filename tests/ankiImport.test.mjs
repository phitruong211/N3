import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { utils, write } from 'xlsx';
import { defaultDeckTemplate, normalizeDeckTemplate, parseTextImport, parseExcelImport, parseImportFile, remapImportPreview } from '../src/lib/ankiImport.ts';

test('deck templates use safe defaults and discard unsupported values', () => {
  assert.deepEqual(normalizeDeckTemplate(null), defaultDeckTemplate());
  const normalized = normalizeDeckTemplate({
    front: { fields: ['front', 'script', 'reading'], showDeckName: false },
    back: { fields: ['back'], showFront: false },
    style: { theme: 'unsafe-css', fontScale: 'huge', alignment: 'left' },
    study: { orientation: 'back-first' },
  });
  assert.deepEqual(normalized.front.fields, ['front', 'reading']);
  assert.equal(normalized.front.showDeckName, false);
  assert.equal(normalized.style.theme, 'paper');
  assert.equal(normalized.style.fontScale, 'large');
  assert.equal(normalized.style.alignment, 'left');
  assert.equal(normalized.study.orientation, 'back-first');
});

test('CSV preserves quoted separators, newlines and escaped quotes', () => {
  const result = parseTextImport('front,back\r\n"猫,犬","mèo\n#chó ""nhỏ"""', 'cards.csv');
  assert.equal(result.cards[0].front, '猫,犬');
  assert.equal(result.cards[0].back, 'mèo\n#chó "nhỏ"');
});
test('Anki text directives, BOM, headers and skipped rows', () => {
  const result = parseTextImport('\uFEFF#separator:Tab\n#html:false\nMặt trước\tMặt sau\n猫\tmèo\nbad\t', 'cards.txt');
  assert.equal(result.cards.length, 1); assert.equal(result.skipped, 1);
  assert.equal(result.cards[0].back, 'mèo');
});
test('headerless text and semicolon CSV', () => {
  assert.equal(parseTextImport('猫\tmèo\tねこ', 'cards.txt').cards[0].reading, 'ねこ');
  assert.equal(parseTextImport('từ;nghĩa\n猫;mèo', 'cards.csv').cards[0].kind, 'vocabulary');
});
test('invalid files fail explicitly', async () => {
  assert.throws(() => parseTextImport('', 'empty.txt'));
  assert.throws(() => parseTextImport('{bad}', 'bad.json'));
  assert.equal(parseTextImport('[{"front":"missing back"}]', 'bad.json').cards.length, 0);
  assert.throws(() => parseTextImport('"unclosed', 'bad.csv'));
  await assert.rejects(parseImportFile(new File(['binary'], 'image.png')));
});
test('existing vocabulary, kanji and grammar schemas are detected', async () => {
  for (const [file, kind] of [['vocabN3.json', 'vocabulary'], ['kanjiN3_vocab_full.json', 'kanji'], ['kanjiN2.json', 'kanji'], ['grammarN3.json', 'grammar']]) {
    const result = parseTextImport(await readFile(new URL(`../public/data/${file}`, import.meta.url), 'utf8'), file);
    assert.ok(result.cards.length > 0); assert.equal(result.cards[0].kind, kind); assert.equal(result.skipped, result.duplicates);
  }
});
test('Excel XLSX and XLS combine sheets while retaining source sheet', async () => {
  for (const bookType of ['xlsx', 'biff8']) {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['front', 'back'], ['猫', 'mèo'], ['invalid', '']]), 'Animals');
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['山', 'núi']]), 'Kanji');
    const buffer = write(workbook, { type: 'array', bookType });
    const result = await parseExcelImport(buffer, 'cards.xlsx');
    assert.equal(result.cards.length, 2); assert.equal(result.skipped, 1);
    assert.equal(result.cards[1].front, '山'); assert.equal(result.cards[1].sourceSheet, 'Kanji'); assert.equal(result.cards[1].notes, '');
  }
});

test('Unicode pair duplicates keep first but retain distinct answers', () => {
 const p = parseTextImport('front,back,note,type,tags\né,một,note,VOCABULARY,a;b\né,một,,GENERAL,\né,hai,,GENERAL,', 'unicode.csv');
 assert.equal(p.cards.length, 2); assert.equal(p.duplicates, 1); assert.equal(p.issues[0].row, 3);
 assert.equal(p.cards[0].notes, 'note'); assert.equal(p.cards[0].kind, 'vocabulary'); assert.deepEqual(p.cards[0].tags, ['a','b']);
});
test('unknown columns require explicit review and mapping can recover empty preview', () => {
 let p = parseTextImport('[{"A":"", "B":"猫", "C":"mèo", "Secret":"value"}]', 'custom.json');
 assert.equal(p.cards.length, 0);
 p = remapImportPreview(p, p.tables.map(t => ({...t, mapping: {front: 1, back: 2}, extraColumns: []})));
 assert.equal(p.cards[0].front, '猫'); assert.equal(p.cards[0].extraData, undefined); assert.equal(p.cards[0].notes, '');
 p = remapImportPreview(p, p.tables.map(t => ({...t, extraColumns: [3]})));
 assert.deepEqual(p.cards[0].extraData, { Secret: 'value' });
});
test('length limits, blank rows and manual header handling', () => {
 const p = parseTextImport('front,back\ncat,meaning\n,\n' + 'x'.repeat(20001) + ',back', 'limits.csv');
 assert.equal(p.cards.length, 1); assert.equal(p.skipped, 2); assert.equal(p.issues[0].row, 3);
 const plain = parseTextImport('A,B\ncat,meaning', 'plain.csv');
 assert.equal(plain.cards.length, 2);
 assert.equal(remapImportPreview(plain, plain.tables.map(t => ({...t, hasHeader:true}))).cards.length, 1);
});
test('sheet selection excludes unselected cards and duplicates', async () => {
 const book = utils.book_new();
 for (const name of ['One','Two']) utils.book_append_sheet(book, utils.aoa_to_sheet([['front','back'],['cat','mèo']]), name);
 const p = await parseExcelImport(write(book, {type:'array',bookType:'xlsx'}), 'sheets.xlsx');
 assert.equal(p.duplicates, 1);
 const selected = remapImportPreview(p, p.tables.map((t,i) => ({...t,selected:i === 1})));
 assert.equal(selected.duplicates, 0); assert.equal(selected.cards[0].sourceSheet, 'Two');
});
test('file size and cancelled parsing fail before work', async () => {
 const controller = new AbortController(); controller.abort();
 await assert.rejects(parseImportFile(new File(['a,b'], 'cards.csv'), controller.signal), {name:'AbortError'});
 await assert.rejects(parseImportFile(new File(['x'.repeat(20*1024*1024+1)], 'large.csv')), /20 MB/);
});
