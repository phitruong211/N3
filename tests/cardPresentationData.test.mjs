import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grammarCard, presentationCard, importedCardView, kanjiCard } from '../src/lib/cards.ts';

test('the shared grammar study card retains structure, variants, comparisons, warnings and examples', () => {
  const examples = [{ japanese: '例文', reading: 'れいぶん', meaning: 'Câu ví dụ' }];
  const card = grammarCard({ id:'g1', pattern:'～たびに', meaning:'Mỗi lần', structure:'V + たびに', usage:'Lặp lại', reading:'たびに', level:'N3', examples,
    cac_cach_dung:[{nghia:'Nghĩa phụ', giai_thich:'Giải thích'}], so_sanh_n4_n5:[{mau:'とき',cap_do_tham_khao:'N4',khac_biet_chinh:'Khác biệt'}], canh_bao:['Chú ý'] }, 'grammarN3', 0);
  assert.match(card.back, /V \+ たびに/);
  assert.match(card.back, /Lặp lại/);
  for (const text of ['Nghĩa phụ', 'Giải thích', 'とき', 'Khác biệt', 'Chú ý']) assert.ok(card.note.includes(text));
  assert.deepEqual(JSON.parse(presentationCard(card).extraData.examples), examples);
});

test('imported example metadata survives the shared study presentation', () => {
  const original = {id:'i1',front:'語',back:'Từ',reading:'ご',hanViet:'Ngữ',notes:'Ghi chú',kind:'vocabulary',extraData:{examples:'[{"japanese":"語","meaning":"Từ"}]'}};
  assert.deepEqual(presentationCard(importedCardView(original,'deck','IMPORT',0)).extraData,original.extraData);
});

test('built-in Kanji cards preserve structured vocabulary for ruby rendering', () => {
  const vocabulary = [
    { word: '閥', reading: 'ばつ', meaning: 'bè đảng; phe cánh' },
    { word: '党閥', reading: 'とうばつ', meaning: 'Đảng phái; bè cánh' },
  ];
  const card = kanjiCard({ id: 'k1', kanji: '閥', hanViet: 'PHIỆT', vocabulary, level: 'N2', onyomi: ['バツ'], kunyomi: [] }, 'kanjiN2', 0);
  assert.deepEqual(JSON.parse(card.extraData.kanjiVocabulary), vocabulary);
  assert.deepEqual(JSON.parse(presentationCard(card).extraData.kanjiVocabulary), vocabulary);
});
