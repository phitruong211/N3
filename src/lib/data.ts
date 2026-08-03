// ============================================================
// Data Layer — Process raw JSON into typed application data
// ============================================================

import type { VocabItem, KanjiItem, GrammarItem } from '../types';

// --- Vocabulary ---

interface RawVocab {
  kanji?: string;
  hiragana?: string;
  meaning?: string;
  type?: string;
  'Từ vựng'?: string;
  'Cách đọc (Phiên âm)'?: string;
  'Ý nghĩa'?: string;
  'Từ liên quan (Từ (Phiên âm): Nghĩa)'?: string;
}

let _vocabCache: VocabItem[] | null = null;

export async function loadVocabulary(): Promise<VocabItem[]> {
  if (_vocabCache) return _vocabCache;

  const res = await fetch('/all_vocab.json?t=' + Date.now());
  const raw: RawVocab[] = await res.json();

  _vocabCache = raw.map((item, index) => ({
    id: `vocab-${index}`,
    kanji: item['Từ vựng'] || item.kanji || '',
    hiragana: item['Cách đọc (Phiên âm)'] || item.hiragana || '',
    meaning: item['Ý nghĩa'] || item.meaning || '',
    type: item.type === 'compound' ? 'compound' : 'main',
    relatedWords: item['Từ liên quan (Từ (Phiên âm): Nghĩa)'] || '',
  }));

  return _vocabCache;
}

// --- Kanji ---

interface RawKanji {
  kanji: string;
  han_viet: string;
  vocabulary: { word: string; reading: string; meaning: string }[];
}

let _kanjiCache: KanjiItem[] | null = null;

export async function loadKanji(): Promise<KanjiItem[]> {
  if (_kanjiCache) return _kanjiCache;

  const res = await fetch('/kanjiN3_vocab_full.json?t=' + Date.now());
  const raw: RawKanji[] = await res.json();

  _kanjiCache = raw.map((item, index) => ({
    id: `kanji-${index}`,
    kanji: item.kanji,
    hanViet: item.han_viet,
    vocabulary: item.vocabulary
      .filter((v) => v.word.length <= 6 && v.reading.length > 1)
      .slice(0, 5)
      .map((v) => ({ word: v.word, reading: v.reading, meaning: v.meaning ?? '' })),
  }));

  return _kanjiCache;
}

// --- Grammar (curated N3 patterns) ---

let _grammarCache: GrammarItem[] | null = null;

export async function loadGrammar(): Promise<GrammarItem[]> {
  if (_grammarCache) return _grammarCache;

  _grammarCache = N3_GRAMMAR;
  return _grammarCache;
}

// Curated N3 Grammar Data
const N3_GRAMMAR: GrammarItem[] = [
  {
    id: 'grammar-0',
    pattern: '～ようにする',
    meaning: 'Cố gắng làm gì đó (thành thói quen)',
    structure: 'V (dictionary form) + ようにする',
    usage: 'Diễn tả nỗ lực để thay đổi thói quen hoặc hành vi.',
    nuance: 'Nhấn mạnh sự cố gắng có ý thức, thường dùng cho thói quen mới.',
    commonMistakes: 'Nhầm với ～ようになる (thay đổi tự nhiên, không phải cố ý).',
    comparison: '～ようにする (cố ý) vs ～ようになる (tự nhiên)',
    examples: [
      {
        japanese: '毎日、野菜を食べるようにしています。',
        reading: 'まいにち、やさいをたべるようにしています。',
        meaning: 'Tôi cố gắng ăn rau mỗi ngày.',
      },
      {
        japanese: '遅刻しないようにしてください。',
        reading: 'ちこくしないようにしてください。',
        meaning: 'Hãy cố gắng đừng đi trễ.',
      },
    ],
  },
  {
    id: 'grammar-1',
    pattern: '～ようになる',
    meaning: 'Trở nên có thể / Bắt đầu (thay đổi tự nhiên)',
    structure: 'V (dictionary form) + ようになる',
    usage: 'Diễn tả sự thay đổi dần dần, trở nên có khả năng mới.',
    nuance: 'Thay đổi xảy ra tự nhiên theo thời gian, không phải cố ý.',
    commonMistakes: 'Nhầm với ～ようにする (cố ý thay đổi).',
    comparison: '～ようになる (tự nhiên) vs ～ようにする (cố ý)',
    examples: [
      {
        japanese: '日本語が話せるようになりました。',
        reading: 'にほんごがはなせるようになりました。',
        meaning: 'Tôi đã có thể nói được tiếng Nhật.',
      },
      {
        japanese: '最近、早く起きられるようになった。',
        reading: 'さいきん、はやくおきられるようになった。',
        meaning: 'Gần đây tôi đã có thể dậy sớm được.',
      },
    ],
  },
  {
    id: 'grammar-2',
    pattern: '～ことにする',
    meaning: 'Quyết định làm gì',
    structure: 'V (dictionary form / ない form) + ことにする',
    usage: 'Diễn tả quyết định do bản thân đưa ra.',
    nuance: 'Quyết định chủ quan, có ý chí rõ ràng.',
    commonMistakes: 'Nhầm với ～ことになる (quyết định từ bên ngoài).',
    comparison: '～ことにする (tự quyết) vs ～ことになる (được quyết định)',
    examples: [
      {
        japanese: '来月から日本語を勉強することにしました。',
        reading: 'らいげつからにほんごをべんきょうすることにしました。',
        meaning: 'Tôi đã quyết định học tiếng Nhật từ tháng sau.',
      },
      {
        japanese: 'お酒を飲まないことにした。',
        reading: 'おさけをのまないことにした。',
        meaning: 'Tôi đã quyết định không uống rượu.',
      },
    ],
  },
  {
    id: 'grammar-3',
    pattern: '～ことになる',
    meaning: 'Được quyết định / Sẽ trở thành',
    structure: 'V (dictionary form) + ことになる',
    usage: 'Diễn tả quyết định từ bên ngoài hoặc kết quả tự nhiên.',
    nuance: 'Không phải do bản thân quyết định, mà do hoàn cảnh/tổ chức.',
    commonMistakes: 'Nhầm với ～ことにする (tự mình quyết định).',
    comparison: '～ことになる (bị động) vs ～ことにする (chủ động)',
    examples: [
      {
        japanese: '来年、東京に転勤することになりました。',
        reading: 'らいねん、とうきょうにてんきんすることになりました。',
        meaning: 'Năm sau tôi sẽ được chuyển công tác đến Tokyo.',
      },
      {
        japanese: '会議は月曜日に行うことになった。',
        reading: 'かいぎはげつようびにおこなうことになった。',
        meaning: 'Cuộc họp được quyết định sẽ tổ chức vào thứ Hai.',
      },
    ],
  },
  {
    id: 'grammar-4',
    pattern: '～てしまう',
    meaning: 'Làm xong hoàn toàn / Đáng tiếc đã làm',
    structure: 'V (て form) + しまう',
    usage: 'Diễn tả hoàn thành hoặc hối tiếc.',
    nuance: 'Hai nghĩa: (1) hoàn thành triệt để, (2) hành động không mong muốn.',
    commonMistakes: 'Không phân biệt được nghĩa hoàn thành và hối tiếc.',
    comparison: '口語: ～ちゃう / ～じゃう (nói tắt)',
    examples: [
      {
        japanese: '宿題を全部やってしまった。',
        reading: 'しゅくだいをぜんぶやってしまった。',
        meaning: 'Tôi đã làm xong hết bài tập rồi.',
      },
      {
        japanese: '財布を忘れてしまいました。',
        reading: 'さいふをわすれてしまいました。',
        meaning: 'Tôi đã quên ví mất rồi. (đáng tiếc)',
      },
    ],
  },
  {
    id: 'grammar-5',
    pattern: '～ために',
    meaning: 'Để / Vì (mục đích / nguyên nhân)',
    structure: 'V (dictionary) / N + の + ために',
    usage: 'Diễn tả mục đích hoặc nguyên nhân.',
    nuance: 'Mục đích: dùng với V ý chí. Nguyên nhân: dùng với V/A trạng thái.',
    commonMistakes: 'Nhầm mục đích và nguyên nhân. Mục đích dùng V ý chí.',
    comparison: '～ために (mục đích/nguyên nhân) vs ～ように (mục đích gián tiếp)',
    examples: [
      {
        japanese: '日本に留学するために、お金を貯めています。',
        reading: 'にほんにりゅうがくするために、おかねをためています。',
        meaning: 'Để du học Nhật, tôi đang tiết kiệm tiền.',
      },
      {
        japanese: '台風のために、電車が止まった。',
        reading: 'たいふうのために、でんしゃがとまった。',
        meaning: 'Vì bão, tàu điện đã dừng.',
      },
    ],
  },
  {
    id: 'grammar-6',
    pattern: '～はずだ',
    meaning: 'Chắc là / Lẽ ra phải',
    structure: 'V (plain) / A / N の + はずだ',
    usage: 'Diễn tả sự suy luận logic dựa trên bằng chứng.',
    nuance: 'Có căn cứ để tin rằng điều gì đó đúng.',
    commonMistakes: 'Nhầm với ～かもしれない (có thể, ít chắc chắn hơn).',
    comparison: '～はずだ (chắc chắn logic) vs ～かもしれない (có thể)',
    examples: [
      {
        japanese: '彼は今日来るはずです。',
        reading: 'かれはきょうくるはずです。',
        meaning: 'Anh ấy chắc là sẽ đến hôm nay.',
      },
      {
        japanese: 'もう届いているはずなのに、届いていない。',
        reading: 'もうとどいているはずなのに、とどいていない。',
        meaning: 'Lẽ ra đã phải đến rồi, nhưng vẫn chưa đến.',
      },
    ],
  },
  {
    id: 'grammar-7',
    pattern: '～わけだ',
    meaning: 'Có nghĩa là / Tức là / Thảo nào',
    structure: 'V/A (plain) + わけだ',
    usage: 'Diễn tả kết luận logic hoặc lý do hiểu được.',
    nuance: 'Dùng khi hiểu ra nguyên nhân hoặc đưa ra kết luận.',
    commonMistakes: 'Nhầm ～わけだ (kết luận) với ～はずだ (suy luận).',
    comparison: '～わけだ (kết luận) vs ～わけがない (không thể nào)',
    examples: [
      {
        japanese: '毎日3時間練習しているのか。上手なわけだ。',
        reading: 'まいにちさんじかんれんしゅうしているのか。じょうずなわけだ。',
        meaning: 'Mỗi ngày luyện 3 tiếng à. Thảo nào giỏi.',
      },
    ],
  },
  {
    id: 'grammar-8',
    pattern: '～ばかり',
    meaning: 'Vừa mới / Toàn là / Chỉ toàn',
    structure: 'V (た form) + ばかり / N + ばかり',
    usage: 'Diễn tả hành động vừa xong hoặc sự lặp lại quá mức.',
    nuance: 'V た ばかり: vừa mới. N ばかり: toàn là, chỉ toàn.',
    commonMistakes: 'Nhầm ～たばかり (vừa mới) với ～たところ (vừa xong).',
    comparison: '～たばかり vs ～たところ vs ～たて',
    examples: [
      {
        japanese: '日本に来たばかりです。',
        reading: 'にほんにきたばかりです。',
        meaning: 'Tôi vừa mới đến Nhật.',
      },
      {
        japanese: '彼はゲームばかりしている。',
        reading: 'かれはゲームばかりしている。',
        meaning: 'Anh ấy toàn chơi game.',
      },
    ],
  },
  {
    id: 'grammar-9',
    pattern: '～として',
    meaning: 'Với tư cách là',
    structure: 'N + として',
    usage: 'Diễn tả vai trò, tư cách, vị trí.',
    nuance: 'Xác định vai trò cụ thể của ai đó trong một tình huống.',
    commonMistakes: 'Thiếu tính chất "vai trò" khi dịch.',
    comparison: '～として (vai trò) vs ～にとって (đối với)',
    examples: [
      {
        japanese: '留学生として日本に来ました。',
        reading: 'りゅうがくせいとしてにほんにきました。',
        meaning: 'Tôi đến Nhật với tư cách là du học sinh.',
      },
      {
        japanese: '医者として、アドバイスします。',
        reading: 'いしゃとして、アドバイスします。',
        meaning: 'Với tư cách bác sĩ, tôi khuyên bạn.',
      },
    ],
  },
  {
    id: 'grammar-10',
    pattern: '～にとって',
    meaning: 'Đối với',
    structure: 'N + にとって',
    usage: 'Diễn tả quan điểm, đánh giá từ góc nhìn của ai.',
    nuance: 'Nhấn mạnh góc nhìn chủ quan, thường đi với đánh giá.',
    commonMistakes: 'Nhầm với ～に対して (đối với, mang tính khách quan hơn).',
    comparison: '～にとって (quan điểm) vs ～に対して (đối với, về)',
    examples: [
      {
        japanese: '私にとって、日本語は難しいです。',
        reading: 'わたしにとって、にほんごはむずかしいです。',
        meaning: 'Đối với tôi, tiếng Nhật khó.',
      },
    ],
  },
  {
    id: 'grammar-11',
    pattern: '～ている間に',
    meaning: 'Trong khi đang',
    structure: 'V (ている) + 間に',
    usage: 'Diễn tả một sự việc xảy ra trong khoảng thời gian hành động khác.',
    nuance: 'Nhấn mạnh sự việc xảy ra bất ngờ/đồng thời.',
    commonMistakes: 'Nhầm ～間に (trong khi, có sự kiện) với ～間 (suốt trong).',
    comparison: '～間に (có sự kiện xảy ra) vs ～間 (suốt thời gian)',
    examples: [
      {
        japanese: '寝ている間に、雪が降った。',
        reading: 'ねているあいだに、ゆきがふった。',
        meaning: 'Trong khi đang ngủ, tuyết đã rơi.',
      },
    ],
  },
  {
    id: 'grammar-12',
    pattern: '～てもらう',
    meaning: 'Được ai đó làm cho',
    structure: 'N に V (て form) + もらう',
    usage: 'Diễn tả việc nhận hành động từ người khác (biết ơn).',
    nuance: 'Người nói là người hưởng lợi, thể hiện sự biết ơn.',
    commonMistakes: 'Nhầm với ～てくれる (người khác làm cho mình, nhấn mạnh lòng tốt).',
    comparison: '～てもらう (xin/được) vs ～てくれる (người kia cho)',
    examples: [
      {
        japanese: '先生に日本語を教えてもらいました。',
        reading: 'せんせいににほんごをおしえてもらいました。',
        meaning: 'Tôi được thầy dạy tiếng Nhật.',
      },
    ],
  },
  {
    id: 'grammar-13',
    pattern: '～かどうか',
    meaning: 'Có hay không',
    structure: 'V (plain) + かどうか',
    usage: 'Diễn tả sự không chắc chắn, dùng trong câu hỏi gián tiếp.',
    nuance: 'Dùng khi không biết câu trả lời là có hay không.',
    commonMistakes: 'Nhầm với ～か (câu hỏi trực tiếp).',
    comparison: '～かどうか (có...không) vs ～か (câu hỏi)',
    examples: [
      {
        japanese: '明日雨が降るかどうか分かりません。',
        reading: 'あしたあめがふるかどうかわかりません。',
        meaning: 'Tôi không biết ngày mai có mưa hay không.',
      },
    ],
  },
  {
    id: 'grammar-14',
    pattern: '～ほど',
    meaning: 'Đến mức / Càng...càng',
    structure: 'V (dictionary/ば) + ほど / N + ほど',
    usage: 'Diễn tả mức độ hoặc mối quan hệ tỉ lệ.',
    nuance: 'Dùng để nhấn mạnh mức độ hoặc diễn tả "càng...càng".',
    commonMistakes: 'Nhầm cấu trúc ～ば～ほど với ～ほど đơn.',
    comparison: '～ほど (mức độ) vs ～くらい/ぐらい (khoảng)',
    examples: [
      {
        japanese: '日本語は勉強すればするほど面白くなる。',
        reading: 'にほんごはべんきょうすればするほどおもしろくなる。',
        meaning: 'Tiếng Nhật càng học càng thú vị.',
      },
      {
        japanese: '死ぬほど疲れた。',
        reading: 'しぬほどつかれた。',
        meaning: 'Mệt muốn chết.',
      },
    ],
  },
];
