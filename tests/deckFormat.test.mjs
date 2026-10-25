import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utils, read } from 'xlsx';
import { LIMITS, applyResolvedTemplate, builtinNoteTypes, cardFromFields, validateCardFields, fieldsFromCard, normalizeConfig, normalizeDeckTemplate, resolveTemplate, sanitizeNoteType, upgradeLegacyTemplate, validateDeckFile, defaultDeckTemplate } from '../src/lib/deckFormat.ts';
import { checkImportText, parseTextImport, previewConfig } from '../src/lib/ankiImport.ts';
import { buildDeckFile, exportJson, exportTables, toCsv, toXlsx } from '../src/lib/deckExport.ts';
import { buildFormattingPrompt, buildStructurePrompt, exampleDeckFile } from '../src/lib/deckPrompts.ts';
import { CARD_MARKUP_TAGS, CARD_STYLE_DOC, hasCardMarkup, safeCardStyle } from '../src/lib/cardFormatting.ts';

const vocab = () => builtinNoteTypes()[0];
const file = (overrides = {}) => ({ format: 'sonhat.deck', version: 1, deck: { name: 'Bộ thử' }, cards: [{ type: 'vocab', fields: { front: '猫', back: 'mèo' } }], ...overrides });
const codes = result => result.issues.map(issue => `${issue.severity}:${issue.code}:${issue.path}`);

test('built-in note types satisfy their own schema', () => {
  for (const type of builtinNoteTypes()) {
    const issues = [];
    assert.deepEqual(sanitizeNoteType(type, 'type', issues), type);
    assert.deepEqual(issues, []);
  }
});

test('a minimal file validates and gets the built-in note types it uses', () => {
  const result = validateDeckFile(file());
  assert.equal(result.ok, true);
  assert.deepEqual(result.file.deck.noteTypes.map(type => type.id), ['vocab']);
  assert.deepEqual(result.file.cards[0].fields, { front: '猫', back: 'mèo' });
});

test('envelope problems reject the whole file', () => {
  assert.equal(validateDeckFile(null).ok, false);
  assert.match(validateDeckFile({ ...file(), format: 'other' }).issues[0].message, /sonhat\.deck/);
  assert.equal(validateDeckFile({ ...file(), version: 2 }).issues[0].code, 'bad_version');
  assert.equal(validateDeckFile({ ...file(), version: 0 }).issues[0].code, 'bad_version');
  assert.equal(validateDeckFile(file({ deck: { name: '  ' } })).ok, false);
  assert.equal(validateDeckFile(file({ cards: {} })).ok, false);
  assert.equal(validateDeckFile(file({ cards: Array.from({ length: LIMITS.cards + 1 }, () => ({})) })).issues[0].code, 'limit_exceeded');
});

test('card problems skip only that card and name the field path', () => {
  const result = validateDeckFile(file({ cards: [
    { type: 'vocab', fields: { front: '犬', back: 'chó' } },
    { type: 'vocab', fields: { front: '猫' } },
    { type: 'nope', fields: { front: 'a', back: 'b' } },
    { type: 'vocab', fields: { front: 'x'.repeat(LIMITS.text + 1), back: 'b' } },
    { type: 'vocab', fields: { front: 'a', back: 'b', hanViet: 5 } },
    { type: 'vocab', fields: { front: '犬', back: 'chó' } },
    { type: 'vocab', fields: { front: 'a', back: 'b', examples: [{ japanese: 'a' }] } },
  ] }));
  assert.equal(result.ok, true);
  assert.equal(result.file.cards.length, 1);
  assert.equal(result.skipped, 6);
  assert.deepEqual(codes(result), [
    'error:required:cards[1].fields.back',
    'error:unknown_type:cards[2].type',
    'error:too_long:cards[3].fields.front',
    'error:bad_type:cards[4].fields.hanViet',
    'error:duplicate:cards[5]',
    'error:bad_value:cards[6].fields.examples',
  ]);
});

test('unknown fields and keys warn without failing; x- keys are kept', () => {
  const result = validateDeckFile({ ...file({ cards: [{ type: 'vocab', fields: { front: 'a', back: 'b', mystery: 'x' } }] }), later: 1, 'x-tool': { a: 1 } });
  assert.equal(result.ok, true);
  assert.deepEqual(codes(result), ['warning:unknown_key:later', 'warning:unknown_field:cards[0].fields.mystery']);
  assert.deepEqual(result.file.ext, { 'x-tool': { a: 1 } });
  assert.deepEqual(result.file.cards[0].fields, { front: 'a', back: 'b' });
});

test('uid duplicates count as duplicates even when the text differs', () => {
  const result = validateDeckFile(file({ cards: [{ uid: 'a', type: 'vocab', fields: { front: '1', back: '1' } }, { uid: 'a', type: 'vocab', fields: { front: '2', back: '2' } }] }));
  assert.equal(result.file.cards.length, 1);
});

test('malformed furigana only warns', () => {
  const result = validateDeckFile(file({ cards: [{ type: 'vocab', fields: { front: '学校[がっこう', back: 'trường' } }] }));
  assert.equal(result.file.cards.length, 1);
  assert.deepEqual(codes(result), ['warning:bad_markup:cards[0].fields.front']);
});

test('note type definitions are checked', () => {
  const bad = patch => { const issues = []; const type = { ...vocab(), ...patch }; return [sanitizeNoteType(type, 't', issues), issues.map(issue => `${issue.code}:${issue.path}`)]; };
  assert.deepEqual(bad({ id: 'Bad Id' })[1], ['bad_value:t.id']);
  assert.deepEqual(bad({ fields: vocab().fields.filter(field => !['back', 'backReading'].includes(field.key)) })[1].slice(0, 1), ['required:t.fields']);
  assert.ok(bad({ fields: [...vocab().fields, { key: 'notes', label: 'x', type: 'text' }] })[1].includes('duplicate:t.fields[7].key'));
  assert.ok(bad({ front: { show: ['front', 'ghost'] } })[1].includes('bad_value:t.front.show'));
  assert.ok(bad({ fields: vocab().fields.map(field => field.key === 'frontReading' ? { ...field, for: 'hanViet' } : field) })[1].includes('bad_value:t.fields'));
  assert.equal(bad({ fields: [vocab().fields[0]] })[0], undefined);
  assert.equal(validateDeckFile(file({ deck: { name: 'x', noteTypes: [vocab(), vocab()] } })).ok, false);
});

test('custom note types carry their own fields and survive validation', () => {
  const custom = { id: 'grammar-jlpt', name: 'Ngữ pháp JLPT', kind: 'GRAMMAR', fields: [
    { key: 'front', label: 'Mẫu câu', type: 'ruby', required: true }, { key: 'back', label: 'Nghĩa', type: 'text', required: true }, { key: 'level', label: 'Cấp độ', type: 'text' },
  ], front: { show: ['front'] }, back: { show: ['back', 'level'] } };
  const result = validateDeckFile(file({ deck: { name: 'x', noteTypes: [custom] }, cards: [{ type: 'grammar-jlpt', fields: { front: '～ばかり', back: 'chỉ toàn', level: 'N3' } }] }));
  assert.equal(result.ok, true);
  assert.equal(result.file.cards[0].fields.level, 'N3');
});

test('style is checked leniently: bad parts are dropped with a warning', () => {
  const result = validateDeckFile(file({ deck: { name: 'x', style: { theme: 'neon', colors: { bg: '#FFF', fg: 'red' }, font: { family: 'notoSansJp', size: 99 }, align: 'left' } } }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.file.deck.style, { colors: { bg: '#fff' }, font: { family: 'notoSansJp' }, align: 'left' });
  assert.deepEqual(codes(result), ['warning:bad_value:deck.style.theme', 'warning:bad_value:deck.style.colors.fg', 'warning:bad_value:deck.style.font.size']);
});

test('v4 templates upgrade to v5 and resolve back to exactly the same template', () => {
  const customised = normalizeDeckTemplate({ front: { fields: ['front', 'reading', 'deckName'], style: { theme: 'dark', fontSize: 40, bold: true, fontFamily: 'notoSerifJp', alignment: 'left' } }, back: { fields: ['back', 'hanViet', 'kind'], showFront: true, showExamples: false, style: { theme: 'blue', fontSize: 18, italic: true } } });
  for (const legacy of [defaultDeckTemplate(), customised]) {
    const config = upgradeLegacyTemplate(legacy);
    assert.equal(config.version, 5);
    for (const type of config.noteTypes) assert.deepEqual(resolveTemplate(config, type.id), legacy);
    assert.deepEqual(normalizeDeckTemplate(config), legacy);
  }
});

test('unusable v5 configs fall back to the built-in note types', () => {
  for (const value of [null, {}, { version: 5 }, { version: 5, noteTypes: [{ id: 'x' }] }]) assert.deepEqual(normalizeConfig(value).noteTypes.map(type => type.id), ['vocab', 'kanji', 'grammar', 'general']);
});

test('custom fields reach the renderer as field:<key> with their labels', () => {
  const base = vocab();
  const type = { ...base, id: 'plus', fields: [...base.fields, { key: 'level', label: 'Cấp độ', type: 'text' }], back: { ...base.back, show: [...base.back.show, 'level'] } };
  const config = { version: 5, noteTypes: [type] };
  const resolved = resolveTemplate(config, 'plus');
  assert.deepEqual(resolved.back.fields, ['back', 'reading', 'hanViet', 'notes', 'field:level']);
  assert.deepEqual(resolved.fieldLabels, { level: 'Cấp độ' });
  assert.equal(resolved.back.showExamples, true);
});

test('appearance edits reach every note type with the same fields, and only those', () => {
  const custom = { ...vocab(), id: 'plus', fields: [...vocab().fields, { key: 'level', label: 'Cấp độ', type: 'text' }], back: { ...vocab().back, show: [...vocab().back.show, 'level'] } };
  const config = normalizeConfig({ version: 5, noteTypes: [...builtinNoteTypes(), custom] });
  const edited = resolveTemplate(config, 'kanji');
  edited.front.style.fontSize = 48; edited.back.fields = ['back', 'notes']; edited.back.showExamples = false; edited.back.showFront = true;
  const next = applyResolvedTemplate(config, 'kanji', edited);
  for (const id of ['vocab', 'kanji', 'grammar', 'general']) {
    assert.equal(resolveTemplate(next, id).front.style.fontSize, 48, id);
    assert.deepEqual(next.noteTypes.find(type => type.id === id).back.show, ['back', 'notes'], id);
    assert.equal(next.noteTypes.find(type => type.id === id).back.showFront, true, id);
  }
  assert.deepEqual(next.noteTypes.find(type => type.id === 'plus'), config.noteTypes.find(type => type.id === 'plus'));
  const own = applyResolvedTemplate(config, 'plus', { ...resolveTemplate(config, 'plus'), front: { ...resolveTemplate(config, 'plus').front, fields: ['front'] } });
  assert.deepEqual(own.noteTypes.find(type => type.id === 'plus').front.show, ['front']);
  assert.deepEqual(own.noteTypes.find(type => type.id === 'vocab'), config.noteTypes.find(type => type.id === 'vocab'));
});

test('fields project to the card shape and legacy cards derive their fields', () => {
  const { card, warnings } = cardFromFields(vocab(), { front: '勉強[べんきょう]する', back: '学校[がっこう]へ行[い]く', backReading: 'がっこうへいく', hanViet: 'Miễn Cường', examples: [{ japanese: '例', reading: '', meaning: 'ví dụ' }] }, { id: 'c1', tags: ['N3'] });
  assert.deepEqual(warnings, []);
  assert.equal(card.front, '勉強する'); assert.equal(card.reading, 'べんきょうする'); assert.equal(card.backReading, 'がっこうへいく');
  assert.equal(card.kind, 'vocabulary'); assert.equal(card.noteType, 'vocab');
  assert.match(card.extraData.frontFuriganaSegments, /べんきょう/);
  assert.equal(JSON.parse(card.extraData.examples)[0].meaning, 'ví dụ');
  const { fields: _drop, noteType: _type, ...legacy } = card;
  assert.deepEqual(fieldsFromCard(legacy), { front: '勉強[べんきょう]する', back: '学校[がっこう]へ行[い]く', frontReading: 'べんきょうする', backReading: 'がっこうへいく', hanViet: 'Miễn Cường', examples: [{ japanese: '例', reading: '', meaning: 'ví dụ' }] });
});

test('Markdown line and block forms import through the same pipeline', () => {
  const lines = parseTextImport('# Bộ dán\n勉強[べんきょう]する :: học :: べんきょうする\n先生 :: giáo viên', 'paste.md');
  assert.equal(lines.name, 'Bộ dán'); assert.equal(lines.cards.length, 2);
  assert.equal(lines.cards[0].reading, 'べんきょうする'); assert.equal(lines.cards[1].front, '先生');
  const blocks = parseTextImport('type: grammar\n\nfront: ～ばかり\nback: chỉ toàn\ntags: N3, bài 2\nexample: 食べてばかりいる | | Chỉ ăn suốt\nexample: 寝てばかり | ねてばかり | Chỉ ngủ\n---\nfront: ～ながら\nback: vừa ... vừa\nnote: Hai hành động song song', 'paste.md');
  assert.equal(blocks.cards.length, 2);
  assert.deepEqual(blocks.cards.map(card => card.kind), ['grammar', 'grammar']);
  assert.deepEqual(blocks.cards[0].tags, ['N3', 'bài 2']);
  assert.equal(blocks.cards[0].fields.examples.length, 2);
  assert.equal(blocks.cards[1].notes, 'Hai hành động song song');
  assert.throws(() => parseTextImport('# Chỉ tiêu đề', 'x.md'));
});

test('a .sonhat.json file imports directly, keeps custom note types and reports bad cards', () => {
  const custom = { id: 'plus', name: 'Cộng', kind: 'GENERAL', fields: [{ key: 'front', label: 'Q', type: 'ruby', required: true }, { key: 'back', label: 'A', type: 'text', required: true }, { key: 'extra', label: 'Thêm', type: 'text' }], front: { show: ['front'] }, back: { show: ['back', 'extra'] } };
  const source = JSON.stringify(file({ deck: { name: 'Riêng', description: 'mô tả', tags: ['a'], style: { theme: 'dark' }, noteTypes: [custom] }, cards: [{ uid: 'u1', type: 'plus', fields: { front: '猫', back: 'mèo', extra: 'x' }, tags: ['t'] }, { type: 'plus', fields: { front: 'chỉ trước' } }] }));
  const preview = parseTextImport(source, 'riêng.sonhat.json');
  assert.equal(preview.name, 'Riêng'); assert.equal(preview.cards.length, 1); assert.equal(preview.skipped, 1);
  assert.equal(preview.cards[0].fields.extra, 'x'); assert.deepEqual(preview.cards[0].tags, ['t']);
  assert.deepEqual(previewConfig(preview).noteTypes.map(type => type.id), ['plus']);
  assert.deepEqual(previewConfig(preview).style, { theme: 'dark' });
  assert.throws(() => parseTextImport(JSON.stringify({ ...file(), version: 9 }), 'x.sonhat.json'), /mới hơn/);
});

test('export then import round-trips content, note types and style', () => {
  const source = parseTextImport(JSON.stringify([
    { front: '勉強[べんきょう]する', back: 'học', han_viet: 'Miễn Cường', note: 'ghi chú', type: 'VOCABULARY', tags: ['N3', 'bài 1'], examples: [{ japanese: '例', reading: 'れい', meaning: 'ví dụ' }], Cột: 'dữ liệu thêm' },
    { front: '先生', back: 'giáo viên', type: 'GRAMMAR' },
  ]), 'cards.json');
  assert.equal(source.cards.length, 2);
  const config = { ...previewConfig(source), style: { colors: { bg: '#fffaf0' } } };
  const exported = exportJson(buildDeckFile({ name: 'Bộ thử', description: 'mô tả' }, config, source.cards));
  const again = parseTextImport(exported, 'bộ-thử.sonhat.json');
  assert.equal(again.skipped, 0);
  assert.deepEqual(again.cards.map(card => card.fields), source.cards.map(card => card.fields));
  assert.deepEqual(again.cards.map(card => card.tags), source.cards.map(card => card.tags));
  assert.deepEqual(again.cards.map(card => [card.front, card.reading, card.noteType]), source.cards.map(card => [card.front, card.reading, card.noteType]));
  assert.deepEqual(previewConfig(again).noteTypes, config.noteTypes);
  assert.deepEqual(previewConfig(again).style, { colors: { bg: '#fffaf0' } });
  assert.equal(JSON.stringify(exported).includes(source.cards[0].id), false);
});

test('CSV and XLSX exports re-import as the same cards', async () => {
  const source = parseTextImport('front,back,reading,han_viet,note,tags\n猫,mèo,ねこ,Miêu,"dòng 1\ndòng 2","a;b"\n"a,b",c,,,,', 'cards.csv');
  const exported = buildDeckFile({ name: 'x' }, previewConfig(source), source.cards);
  const [table] = exportTables(exported);
  assert.deepEqual(table.header.slice(0, 3), ['front', 'frontReading', 'back']);
  const csv = toCsv(table);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const fromCsv = parseTextImport(csv, 'out.csv');
  assert.deepEqual(fromCsv.cards.map(card => card.fields), source.cards.map(card => card.fields));
  assert.deepEqual(fromCsv.cards.map(card => card.tags), source.cards.map(card => card.tags));
  const book = read(await toXlsx([table, { ...table, name: 'Trùng/tên?' }, { ...table, name: 'trùng tên ' }]), { type: 'array' });
  assert.equal(new Set(book.SheetNames.map(name => name.toLowerCase())).size, 3);
  assert.deepEqual(utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0], table.header);
});

test('generated prompts describe the schema and their examples validate', () => {
  for (const type of builtinNoteTypes()) {
    const prompt = buildStructurePrompt(type);
    for (const field of type.fields) assert.ok(prompt.includes(`- ${field.key} —`), `${type.id}.${field.key}`);
    const example = exampleDeckFile(type);
    const result = validateDeckFile(example);
    assert.equal(result.ok, true); assert.deepEqual(result.issues, []);
    assert.ok(prompt.includes(JSON.stringify(example, null, 2)));
  }
  const custom = { ...vocab(), id: 'plus', fields: [...vocab().fields, { key: 'level', label: 'Cấp độ', type: 'text' }], back: { ...vocab().back, show: [...vocab().back.show, 'level'] } };
  assert.equal(validateDeckFile(exampleDeckFile(custom)).ok, true);
  assert.match(buildStructurePrompt(custom), /- level — Cấp độ/);
});

test('the formatting prompt only offers what the renderer actually allows', () => {
  for (const rule of CARD_STYLE_DOC) assert.equal(safeCardStyle(rule.property, rule.example), rule.example, rule.property);
  for (const tag of CARD_MARKUP_TAGS) assert.equal(hasCardMarkup(`<${tag}>x`), true, tag);
  const prompt = buildFormattingPrompt();
  for (const rule of CARD_STYLE_DOC) assert.ok(prompt.includes(`- ${rule.property}:`));
  for (const tag of CARD_MARKUP_TAGS) assert.ok(prompt.includes(`<${tag}>`));
});

test('checkImportText reports where problems are without importing anything', () => {
  const sonhat = checkImportText(JSON.stringify(file({ cards: [{ type: 'vocab', fields: { front: 'a' } }, { type: 'vocab', fields: { front: 'a', back: 'b' } }] })));
  assert.equal(sonhat.cards, 1); assert.equal(sonhat.skipped, 1);
  assert.equal(sonhat.issues[0].path, 'cards[0].fields.back');
  const legacy = checkImportText('[{"front":"a","back":""},{"front":"b","back":"c"}]');
  assert.equal(legacy.cards, 1); assert.match(legacy.issues[0].path, /dòng 2/);
  assert.equal(checkImportText('{bad').issues[0].severity, 'error');
  assert.equal(checkImportText('a :: b', 'dán.md').cards, 1);
});

// ---- contract shared with the backend (japanese-server DeckFormatContractTest) ----
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const cases = JSON.parse(await readFile(new URL('./fixtures/deck-format/cases.json', import.meta.url), 'utf8'));
const expand = value => value && typeof value === 'object' && !Array.isArray(value) && '$repeat' in value ? value.$repeat.repeat(value.times) : value;

for (const item of cases.noteTypes) test(`contract note type: ${item.name}`, () => {
  const issues = [];
  const type = sanitizeNoteType(item.noteType, 't', issues);
  assert.equal(issues.some(issue => issue.severity === 'error') ? 'error' : 'ok', item.expect, JSON.stringify(issues));
  assert.equal(type !== undefined, item.expect === 'ok');
});

for (const item of cases.cards) test(`contract card: ${item.name}`, () => {
  const fields = Object.fromEntries(Object.entries(item.fields).map(([key, value]) => [key, expand(value)]));
  const issues = [];
  const valid = validateCardFields(cases.standardNoteType, fields, 'f', issues);
  assert.equal(valid ? 'ok' : 'error', item.expect, JSON.stringify(issues));
  if (item.expect === 'ok') {
    const { card } = cardFromFields(cases.standardNoteType, valid, { id: 'x' });
    assert.equal(card.front, item.front);
    assert.equal(card.reading, item.reading);
  }
});

test('the contract fixtures are identical in the backend when it is checked out beside this project', async () => {
  const backend = new URL('../../japanese-server/src/test/resources/deck-format/cases.json', import.meta.url);
  if (!existsSync(backend)) return;
  assert.equal(await readFile(backend, 'utf8'), await readFile(new URL('./fixtures/deck-format/cases.json', import.meta.url), 'utf8'));
});

// ---- note type editing helpers ----
import { addNoteTypeField, cloneNoteType, moveFaceField, moveNoteTypeField, removeNoteTypeField, setFaceField, updateNoteTypeField } from '../src/lib/noteTypeEdit.ts';

test('every note type edit keeps the type valid', () => {
  const valid = type => { const issues = []; return sanitizeNoteType(type, 't', issues) !== undefined && issues.length === 0; };
  let type = vocab();
  type = addNoteTypeField(type, 'Cấp độ', 'text');
  assert.deepEqual(type.fields.at(-1), { key: 'field8', label: 'Cấp độ', type: 'text' });
  assert.equal(type.back.show.at(-1), 'field8');
  type = addNoteTypeField(type);
  type = updateNoteTypeField(type, 'field8', { label: 'Level', required: true });
  type = moveNoteTypeField(type, 'field9', -1);
  assert.deepEqual(type.fields.slice(-2).map(field => field.key), ['field9', 'field8']);
  type = setFaceField(type, 'front', 'field8', true);
  type = moveFaceField(type, 'front', 'field8', -1);
  assert.deepEqual(type.front.show, ['front', 'field8', 'frontReading']);
  assert.ok(valid(type));
  type = removeNoteTypeField(type, 'field8');
  assert.equal(type.fields.some(field => field.key === 'field8'), false);
  assert.deepEqual(type.front.show, ['front', 'frontReading']);
  assert.ok(valid(type));
});

test('front and back cannot be removed, unrequired, or turned into non-text fields', () => {
  let type = vocab();
  assert.equal(removeNoteTypeField(type, 'front'), type);
  type = updateNoteTypeField(type, 'back', { required: false, type: 'examples' });
  assert.deepEqual(type.fields.find(field => field.key === 'back'), { key: 'back', label: 'Mặt sau', type: 'ruby', required: true });
  assert.equal(setFaceField(vocab(), 'front', 'front', false).front.show.includes('front'), false);
  const onlyFront = { ...vocab(), front: { show: ['front'] } };
  assert.equal(setFaceField(onlyFront, 'front', 'front', false), onlyFront);
});

test('removing a text field detaches its reading field instead of leaving a dangling link', () => {
  const type = { ...vocab(), fields: [...vocab().fields, { key: 'sentence', label: 'Câu', type: 'ruby' }, { key: 'sentenceReading', label: 'Đọc câu', type: 'kana', for: 'sentence' }] };
  const next = removeNoteTypeField(type, 'sentence');
  assert.equal(next.fields.find(field => field.key === 'sentenceReading').for, undefined);
  assert.deepEqual(sanitizeNoteType(next, 't', []), next);
});

test('field count and cloning respect the limits', () => {
  let type = vocab();
  for (let i = 0; i < 40; i++) type = addNoteTypeField(type);
  assert.equal(type.fields.length, LIMITS.fields);
  const copy = cloneNoteType(vocab(), ['vocab', 'type-5']);
  assert.equal(copy.id, 'type-3');
  copy.fields[0].label = 'đổi';
  assert.equal(vocab().fields[0].label, 'Mặt trước');
});

import { exampleLines, parseExampleLines } from '../src/lib/deckFormat.ts';
test('example lines round-trip and report lines that cannot be read', () => {
  const examples = [{ japanese: '猫です。', reading: 'ねこです。', meaning: 'Là mèo.' }, { japanese: '犬', reading: '', meaning: 'chó' }];
  assert.deepEqual(parseExampleLines(exampleLines(examples)), { examples, invalid: 0 });
  assert.deepEqual(parseExampleLines('猫 | mèo\n\nchỉ một phần\n a | b | c | d'), { examples: [{ japanese: '猫', reading: '', meaning: 'mèo' }], invalid: 2 });
});
