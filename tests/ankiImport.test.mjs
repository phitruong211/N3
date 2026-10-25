import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { utils, write } from 'xlsx';
import { IMPORT_EXAMPLE, assignImportColumn, defaultDeckTemplate, normalizeDeckTemplate, parseTextImport, parseExcelImport, parseImportFile, remapImportPreview, parseCardExamples, setImportTableNoteType } from '../src/lib/ankiImport.ts';

test('structured examples survive JSON import, remapping and API extra data serialization', () => {
  const examples = [{ japanese: '雨が降るたびに、道がぬれます。', reading: 'あめがふるたびに、みちがぬれます。', meaning: 'Mỗi lần trời mưa, đường lại ướt.' }, { japanese: '日本語を勉強します。', meaning: 'Tôi học tiếng Nhật.' }];
  const preview = parseTextImport(JSON.stringify([{ front: '～たびに', back: 'Mỗi lần', type: 'GRAMMAR', examples }]), 'cards.json');
  assert.equal(preview.skipped, 0);
  const remapped = remapImportPreview(preview, preview.tables);
  const restored = JSON.parse(JSON.stringify(remapped.cards[0].extraData));
  assert.deepEqual(parseCardExamples(restored.examples), [examples[0], { ...examples[1], reading: '' }]);
});

test('invalid examples are reported rather than silently lost', () => {
  for (const examples of [{ japanese: '猫', meaning: 'Mèo' }, [{ japanese: '猫' }], [{ japanese: 123, meaning: 'Mèo' }]]) {
    const preview = parseTextImport(JSON.stringify([{ front: '猫', back: 'Mèo', examples }]), 'cards.json');
    assert.equal(preview.cards.length, 0);
    assert.equal(preview.skipped, 1);
  }
  assert.deepEqual(parseCardExamples(undefined), []);
});

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
  assert.deepEqual(normalized.front.style, { theme: 'paper', fontScale: 'large', fontSize: 30, bold: false, italic: false, fontFamily: 'default', alignment: 'left' });
  assert.deepEqual(normalized.back.style, { theme: 'paper', fontScale: 'large', fontSize: 30, bold: false, italic: false, fontFamily: 'default', alignment: 'left' });
  assert.equal('study' in normalized, false);
});

test('deck templates keep independent front and back presentation settings', () => {
  const normalized = normalizeDeckTemplate({
    version: 3,
    front: { fields: ['front'], style: { theme: 'blue', fontScale: 'xlarge', fontSize: 42, bold: true, italic: false, fontFamily: 'delaGothicOne', alignment: 'center' } },
    back: { fields: ['back'], showFront: true, style: { theme: 'dark', fontScale: 'small', fontSize: 18, bold: false, italic: true, fontFamily: 'notoSerifJp', alignment: 'left' } },
  });
  assert.deepEqual(normalized.front.style, { theme: 'blue', fontScale: 'xlarge', fontSize: 42, bold: true, italic: false, fontFamily: 'delaGothicOne', alignment: 'center' });
  assert.deepEqual(normalized.back.style, { theme: 'dark', fontScale: 'small', fontSize: 18, bold: false, italic: true, fontFamily: 'notoSerifJp', alignment: 'left' });
  assert.equal(normalized.back.showFront, true);
});

test('numeric card text size is bounded and legacy presets receive their matching size', () => {
  const bounded = normalizeDeckTemplate({
    front: { style: { fontScale: 'medium', fontSize: 200, bold: 'yes', italic: true } },
    back: { style: { fontScale: 'small', fontSize: 4, bold: true, italic: 'yes' } },
  });
  assert.equal(bounded.front.style.fontSize, 72);
  assert.equal(bounded.back.style.fontSize, 12);
  assert.equal(bounded.front.style.bold, false);
  assert.equal(bounded.front.style.italic, true);
  assert.equal(bounded.back.style.bold, true);
  assert.equal(bounded.back.style.italic, false);
  const legacy = normalizeDeckTemplate({ front: { style: { fontScale: 'medium' } } });
  assert.equal(legacy.front.style.fontSize, 24);
});

test('legacy templates stop repeating the question on the answer side', () => {
  const legacy = normalizeDeckTemplate({ version: 2, back: { fields: ['back'], showFront: true } });
  assert.equal(legacy.back.showFront, false);
  assert.equal(defaultDeckTemplate().back.showFront, false);
});

test('CSV preserves quoted separators, newlines and escaped quotes', () => {
  const result = parseTextImport('front,back\r\n"猫,犬","mèo\n#chó ""nhỏ"""', 'cards.csv');
  assert.equal(result.cards[0].front, '猫,犬');
  assert.equal(result.cards[0].back, 'mèo\n#chó "nhỏ"');
});
test('JSON and CSV map Hán Việt aliases into a dedicated field', () => {
  const json = parseTextImport('[{"front":"勉強","back":"Việc học","reading":"べんきょう","hanViet":"Miễn Cường"}]', 'cards.json');
  assert.equal(json.cards[0].hanViet, 'Miễn Cường');
  const csv = parseTextImport('front,back,Hán Việt\n日本,Nhật Bản,Nhật Bản', 'cards.csv');
  assert.equal(csv.cards[0].hanViet, 'Nhật Bản');
});
test('front and back furigana import consistently and warnings do not drop cards', () => {
  const result = parseTextImport(JSON.stringify([
    { front: '勉強[べんきょう]する', back: '学校[がっこう]へ行[い]く', back_reading: 'がっこうへいく' },
    { front: '学校[がっこう', back: 'School', reading: 'がっこう' },
  ]), 'ruby.json');
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].front, '勉強する');
  assert.equal(result.cards[0].reading, 'べんきょうする');
  assert.equal(result.cards[0].back, '学校へ行く');
  assert.equal(result.cards[0].backReading, 'がっこうへいく');
  assert.match(result.cards[0].extraData.frontFuriganaSegments, /べんきょう/);
  assert.match(result.cards[0].extraData.backFuriganaSegments, /がっこう/);
  assert.equal(result.skipped, 0);
  assert.equal(result.warnings.length, 1);
});

test('reading columns normalize accidental Kanji[hiragana] input to kana', () => {
  const result = parseTextImport(JSON.stringify([
    { front: '立場', back: 'lập trường; vị thế', reading: '立場[たちば]' },
  ]), 'reading-markup.json');
  assert.equal(result.cards[0].reading, 'たちば');
  assert.match(result.cards[0].extraData.frontFuriganaSegments, /たちば/);
});

test('JSON, TXT, CSV, TSV, XLSX and XLS normalize to equivalent card data', async () => {
  const examples = [{ japanese: '日本語を勉強します。', reading: 'にほんごをべんきょうします。', meaning: 'Tôi học tiếng Nhật.' }];
  const record = { front: '勉強[べんきょう]する', back: '学校[がっこう]へ行[い]く', reading: 'べんきょうする', back_reading: 'がっこうへいく', han_viet: 'Miễn Cường', note: 'Ôn bài', type: 'VOCABULARY', tags: ['N3', 'bài 1'], examples };
  const examplesCell = JSON.stringify(examples).replaceAll('"', '""');
  const header = 'front,back,reading,back_reading,han_viet,note,type,tags,examples';
  const row = `"${record.front}","${record.back}",${record.reading},${record.back_reading},${record.han_viet},${record.note},${record.type},"N3;bài 1","${examplesCell}"`;
  const csv = `${header}\n${row}`;
  const tsv = `front\tback\treading\tback_reading\than_viet\tnote\ttype\ttags\texamples\n${record.front}\t${record.back}\t${record.reading}\t${record.back_reading}\t${record.han_viet}\t${record.note}\t${record.type}\tN3;bài 1\t${JSON.stringify(examples)}`;
  const sheet = utils.json_to_sheet([{ ...record, tags: 'N3;bài 1', examples: JSON.stringify(examples) }]);
  const book = utils.book_new(); utils.book_append_sheet(book, sheet, 'Cards');
  const previews = [
    parseTextImport(JSON.stringify([record]), 'cards.json'),
    parseTextImport(csv, 'cards.csv'),
    parseTextImport(tsv, 'cards.tsv'),
    parseTextImport(`#separator:Tab\n${tsv}`, 'cards.txt'),
    await parseExcelImport(write(book, { type: 'array', bookType: 'xlsx' }), 'cards.xlsx'),
    await parseExcelImport(write(book, { type: 'array', bookType: 'xls' }), 'cards.xls'),
  ];
  const shape = card => ({ front: card.front, back: card.back, reading: card.reading, backReading: card.backReading, hanViet: card.hanViet, notes: card.notes, kind: card.kind, tags: card.tags, examples: JSON.parse(card.extraData.examples), frontRuby: JSON.parse(card.extraData.frontFuriganaSegments), backRuby: JSON.parse(card.extraData.backFuriganaSegments) });
  const expected = shape(previews[0].cards[0]);
  for (const preview of previews) assert.deepEqual(shape(preview.cards[0]), expected);
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
  for (const [file, kind] of [['vocabN3.json', 'vocabulary'], ['kanjiN3_vocab_full.json', 'kanji'], ['kanjiN4.json', 'kanji'], ['kanjiN2.json', 'kanji'], ['grammarN2.json', 'grammar'], ['grammarN3.json', 'grammar']]) {
    const result = parseTextImport(await readFile(new URL(`../public/data/${file}`, import.meta.url), 'utf8'), file);
    assert.ok(result.cards.length > 0); assert.equal(result.cards[0].kind, kind); assert.ok(result.skipped >= result.duplicates);
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
test('columns that match no field become custom fields of a derived note type and nothing is lost', () => {
 let p = parseTextImport('[{"A":"", "B":"猫", "C":"mèo", "Secret":"value"}]', 'custom.json');
 assert.equal(p.cards.length, 0);
 let table = p.tables[0];
 assert.deepEqual(table.columns.map(column => column.target), ['front', 'back', 'col3', 'col4']);
 const type = p.noteTypes.find(item => item.id === table.noteTypeId);
 assert.deepEqual(type.fields.slice(-2).map(field => [field.key, field.label]), [['col3', 'C'], ['col4', 'Secret']]);
 table = assignImportColumn(table, 'col-0', 'ignore');
 table = assignImportColumn(table, 'col-1', 'front');
 table = assignImportColumn(table, 'col-2', 'back');
 table = assignImportColumn(table, 'col-3', 'ignore');
 p = remapImportPreview(p, [table]);
 assert.equal(p.cards[0].front, '猫'); assert.equal(p.cards[0].back, 'mèo'); assert.equal(p.cards[0].notes, '');
 assert.deepEqual(p.cards[0].fields, { front: '猫', back: 'mèo' });
});

test('assigning a column to a field releases the column that held it', () => {
 const p = parseTextImport('[{"Question":"丘[おか]","Meaning":"Đồi","Sentence":"丘[おか]の上[うえ]"}]', 'free-form.json');
 const table = assignImportColumn(p.tables[0], 'col-2', 'back');
 assert.deepEqual(table.columns.map(column => column.target), ['front', 'ignore', 'back']);
 const result = remapImportPreview(p, [table]);
 assert.equal(result.cards[0].back, '丘の上');
 assert.equal(result.cards[0].backReading, 'おかのうえ');
 assert.equal(result.cards[0].reading, 'おか');
});

test('extra source columns stay on the card as labelled custom fields', () => {
 const p = parseTextImport('[{"Question":"丘","Meaning":"Đồi","Sentence":"丘の上"}]', 'free-form.json');
 assert.equal(p.cards.length, 1);
 assert.deepEqual(p.cards[0].fields, { front: '丘', back: 'Đồi', col3: '丘の上' });
 assert.equal(p.noteTypes.find(item => item.id === p.cards[0].noteType).back.show.at(-1), 'col3');
});

test('switching a table to another note type releases columns that type does not have', () => {
 const p = parseTextImport('[{"Question":"猫","Meaning":"mèo","Sentence":"x"}]', 'free-form.json');
 const table = setImportTableNoteType(p.tables[0], 'general', p.noteTypes);
 assert.deepEqual(table.columns.map(column => column.target), ['front', 'back', 'ignore']);
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


test('guide sample retains notes and structured examples across JSON, CSV and TSV', () => {
  const headers = Object.keys(IMPORT_EXAMPLE[0]);
  const rows = IMPORT_EXAMPLE.map(card => headers.map(key => card[key] == null ? '' : key === 'tags' ? card[key].join(';') : typeof card[key] === 'object' ? JSON.stringify(card[key]) : String(card[key])));
  const samples = [['json', JSON.stringify(IMPORT_EXAMPLE)], ...[',', '\t'].map(delimiter => [delimiter === ',' ? 'csv' : 'txt', [headers, ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(delimiter)).join('\n')])];
  for (const [extension, source] of samples) {
    const preview = parseTextImport(source, `guide.${extension}`);
    assert.equal(preview.skipped, 0);
    assert.equal(preview.cards.length, 1);
    const card = preview.cards[0];
    assert.equal(card.front, IMPORT_EXAMPLE[0].front);
    assert.equal(card.back, IMPORT_EXAMPLE[0].back);
    assert.equal(card.notes, IMPORT_EXAMPLE[0].note);
    assert.deepEqual(parseCardExamples(card.extraData.examples), IMPORT_EXAMPLE[0].examples);
  }
});

test('custom-named JSON example lists preserve multiple examples when assigned a role', () => {
  const examples = [
    { japanese: '猫です。', reading: 'ねこです。', meaning: 'Là mèo.' },
    { japanese: '猫がいます。', reading: 'ねこがいます。', meaning: 'Có một con mèo.' },
  ];
  const preview = parseTextImport(JSON.stringify([{ 'Từ': '猫', 'Nghĩa': 'Mèo', 'Minh họa': examples }]), 'custom.json');
  let table = preview.tables[0];
  const field = table.columns.find(field => field.label === 'Minh họa');
  table = assignImportColumn(table, field.key, 'examples');
  const result = remapImportPreview(preview, [table]);
  assert.equal(result.skipped, 0);
  assert.equal(result.cards.length, 1);
  assert.deepEqual(parseCardExamples(result.cards[0].extraData.examples), examples);
});
