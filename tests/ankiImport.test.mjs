import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { utils, write } from 'xlsx';
import { parseTextImport, parseExcelImport, parseImportFile } from '../src/lib/ankiImport.ts';

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
  assert.throws(() => parseTextImport('[{"front":"missing back"}]', 'bad.json'));
  assert.throws(() => parseTextImport('"unclosed', 'bad.csv'));
  await assert.rejects(parseImportFile(new File(['binary'], 'image.png')));
});
test('existing vocabulary, kanji and grammar schemas are detected', async () => {
  for (const [file, kind] of [['vocabN3.json', 'vocabulary'], ['kanjiN3_vocab_full.json', 'kanji'], ['kanjiN2.json', 'kanji'], ['grammarN3.json', 'grammar']]) {
    const result = parseTextImport(await readFile(new URL(`../public/data/${file}`, import.meta.url), 'utf8'), file);
    assert.ok(result.cards.length > 0); assert.equal(result.cards[0].kind, kind); assert.equal(result.skipped, 0);
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
    assert.equal(result.cards[1].front, '山'); assert.match(result.cards[1].notes, /Kanji/);
  }
});
