export type KanaScript = 'hira' | 'kata';

/** Five vowel columns, in the order every Japanese chart uses. */
export const KANA_COLUMNS = [
  { id: 'a', hint: 'như "a"', vi: ['a', 'i', 'u', 'ê', 'ô'] },
  { id: 'i', hint: 'như "i"' },
  { id: 'u', hint: 'giữa "u" và "ư"' },
  { id: 'e', hint: 'như "ê"' },
  { id: 'o', hint: 'như "ô"' },
] as const;

export interface KanaRow {
  id: string;
  /** Row label, e.g. "Hàng K". */
  label: string;
  /** What the row's consonant sounds like to a Vietnamese speaker. */
  tip: string;
  hira: readonly string[];
  kata: readonly string[];
  /** One entry per column; '' marks an empty slot (ya-yu-yo and wa-wo skip columns). */
  romaji: readonly string[];
  /** Rough Vietnamese spelling of each sound, shown as a hint only. */
  vi: readonly string[];
}

export const KANA_ROWS: readonly KanaRow[] = [
  { id: 'a', label: 'Hàng A', tip: 'Năm nguyên âm — nền tảng của cả bảng. Học thuộc 5 chữ này trước: a, i, u, ê, ô.', hira: ['あ', 'い', 'う', 'え', 'お'], kata: ['ア', 'イ', 'ウ', 'エ', 'オ'], romaji: ['a', 'i', 'u', 'e', 'o'], vi: ['a', 'i', 'u', 'ê', 'ô'] },
  { id: 'k', label: 'Hàng K', tip: 'Phụ âm k đọc như "c/k" tiếng Việt, ghép với 5 nguyên âm: ka, ki, ku, ke, ko.', hira: ['か', 'き', 'く', 'け', 'こ'], kata: ['カ', 'キ', 'ク', 'ケ', 'コ'], romaji: ['ka', 'ki', 'ku', 'ke', 'ko'], vi: ['ca', 'ki', 'cư', 'kê', 'cô'] },
  { id: 's', label: 'Hàng S', tip: 'Đọc nhẹ như "x/s". Riêng し đọc là "shi" (gần "xi"), không phải "si".', hira: ['さ', 'し', 'す', 'せ', 'そ'], kata: ['サ', 'シ', 'ス', 'セ', 'ソ'], romaji: ['sa', 'shi', 'su', 'se', 'so'], vi: ['xa', 'xi', 'xư', 'xê', 'xô'] },
  { id: 't', label: 'Hàng T', tip: 'Đọc như "t". Hai chữ đặc biệt: ち đọc "chi", つ đọc "tsu" (t + su liền, môi không tròn).', hira: ['た', 'ち', 'つ', 'て', 'と'], kata: ['タ', 'チ', 'ツ', 'テ', 'ト'], romaji: ['ta', 'chi', 'tsu', 'te', 'to'], vi: ['ta', 'chi', 'tsư', 'tê', 'tô'] },
  { id: 'n', label: 'Hàng N', tip: 'Đọc như "n" tiếng Việt: na, ni, nu (nư), ne (nê), no (nô).', hira: ['な', 'に', 'ぬ', 'ね', 'の'], kata: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], romaji: ['na', 'ni', 'nu', 'ne', 'no'], vi: ['na', 'ni', 'nư', 'nê', 'nô'] },
  { id: 'h', label: 'Hàng H', tip: 'Đọc như "h". Riêng ふ đọc "fu": thổi nhẹ, giữa "hu" và "phu", môi không chạm răng.', hira: ['は', 'ひ', 'ふ', 'へ', 'ほ'], kata: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'], romaji: ['ha', 'hi', 'fu', 'he', 'ho'], vi: ['ha', 'hi', 'hư (thổi nhẹ)', 'hê', 'hô'] },
  { id: 'm', label: 'Hàng M', tip: 'Đọc như "m" tiếng Việt: ma, mi, mu (mư), me (mê), mo (mô).', hira: ['ま', 'み', 'む', 'め', 'も'], kata: ['マ', 'ミ', 'ム', 'メ', 'モ'], romaji: ['ma', 'mi', 'mu', 'me', 'mo'], vi: ['ma', 'mi', 'mư', 'mê', 'mô'] },
  { id: 'y', label: 'Hàng Y', tip: 'Chỉ có 3 chữ: ya, yu, yo (ia, iu, io đọc nhanh). Không có yi và ye nên 2 ô trống.', hira: ['や', '', 'ゆ', '', 'よ'], kata: ['ヤ', '', 'ユ', '', 'ヨ'], romaji: ['ya', '', 'yu', '', 'yo'], vi: ['ia', '', 'iu', '', 'io'] },
  { id: 'r', label: 'Hàng R', tip: 'Âm "r" của Nhật nằm giữa r và l: đầu lưỡi chạm nhẹ lên nướu trên rồi bật ra, nhẹ như "d".', hira: ['ら', 'り', 'る', 'れ', 'ろ'], kata: ['ラ', 'リ', 'ル', 'レ', 'ロ'], romaji: ['ra', 'ri', 'ru', 're', 'ro'], vi: ['ra', 'ri', 'rư', 'rê', 'rô'] },
  { id: 'w', label: 'Hàng W', tip: 'Chỉ có wa và wo (đọc là "o"). Các ô còn lại để trống.', hira: ['わ', '', '', '', 'を'], kata: ['ワ', '', '', '', 'ヲ'], romaji: ['wa', '', '', '', 'wo'], vi: ['oa', '', '', '', 'ô'] },
  { id: 'nn', label: 'Âm N', tip: 'ん là chữ duy nhất không có nguyên âm, không bao giờ đứng đầu từ. Đọc như "n/ng/m" cuối âm: ほん = hon.', hira: ['ん', '', '', '', ''], kata: ['ン', '', '', '', ''], romaji: ['n', '', '', '', ''], vi: ['n', '', '', '', ''] },
];

export interface KanaInfo {
  /** Example word in kana, its romaji and Vietnamese meaning. */
  ex?: [word: string, romaji: string, meaning: string];
  /** Shape or sound cue that helps remember the character. */
  hint: string;
  /** Pronunciation or usage trap worth warning about. */
  note?: string;
}

const H = (hint: string, ex?: KanaInfo['ex'], note?: string): KanaInfo => ({ hint, ex, note });

export const HIRA_INFO: Record<string, KanaInfo> = {
  あ: H('Một người dang tay, nhún chân và reo lên "A!".', ['あめ', 'ame', 'mưa']),
  い: H('Hai nét đứng cạnh nhau như hai chữ "i" — "ii".', ['いぬ', 'inu', 'con chó']),
  う: H('Một nét "mũ" trên đầu, thân cong như chữ U nghiêng.', ['うみ', 'umi', 'biển'], 'Đọc giữa "u" và "ư"; môi không tròn.'),
  え: H('Chú chim lạ (exotic) đang vẫy đuôi — "ê!".', ['えき', 'eki', 'nhà ga']),
  お: H('Giống あ nhưng có thêm một chấm bên phải như quả bóng bay.', ['おかね', 'okane', 'tiền']),
  か: H('"ka" ~ "cá": con cá quẫy đuôi, có chấm là giọt nước.', ['かさ', 'kasa', 'cái ô']),
  き: H('Chiếc chìa khoá (key → ki) có hai răng ngang.', ['きのう', 'kinō', 'hôm qua']),
  く: H('Mỏ chim cu "ku-ku" — một nét gập nhọn.', ['くるま', 'kuruma', 'xe hơi']),
  け: H('Cái kệ ("ke" ~ kệ): nét dọc là thành kệ, nét ngang là tầng.', ['けさ', 'kesa', 'sáng nay']),
  こ: H('Hai nét xếp chồng như cái cốc ("ko" ~ cốc) úp miệng.', ['こども', 'kodomo', 'trẻ em']),
  さ: H('Giống cái cưa (saw → sa): nét ngang là lưỡi, nét cong là tay cầm.', ['さかな', 'sakana', 'cá']),
  し: H('Một nét cong như lưỡi câu cá; kéo cá lên kêu "shi!".', ['しお', 'shio', 'muối'], 'Đọc "shi" (gần "xi"), không phải "si".'),
  す: H('Nét tròn thắt nút như sợi mì xoắn — "su" trong "sushi".', ['すし', 'sushi', 'sushi']),
  せ: H('Nét ngang dài vắt qua, thân cong bên dưới như cái yên ngựa.', ['せんせい', 'sensei', 'giáo viên']),
  そ: H('Con rắn lượn một nét liền — "sô".', ['そら', 'sora', 'bầu trời']),
  た: H('Trông như chữ "ta" viết tay: "t" bên trái, "a" bên phải.', ['たまご', 'tamago', 'trứng']),
  ち: H('Nhìn như số 5 — nhớ "Chị Năm" ("chi").', ['ちず', 'chizu', 'bản đồ'], 'Đọc "chi", không phải "ti".'),
  つ: H('Một con sóng cuộn — "tsu" trong "tsunami" (sóng thần).', ['つくえ', 'tsukue', 'cái bàn'], 'Đọc "tsu": t + su liền, môi không tròn.'),
  て: H('"te" ~ "tay": nét ngang rồi cong xuống như cánh tay giơ ra.', ['てがみ', 'tegami', 'bức thư']),
  と: H('Ngón chân cái (toe → to) bị một cái gai chọc ở trên.', ['とり', 'tori', 'con chim']),
  な: H('Nữ tu (nun → na) cúi đầu cầu nguyện bên cây thập tự.', ['なつ', 'natsu', 'mùa hè']),
  に: H('Hai nét ngang bên phải như số 2 — "ni" nghĩa là hai!', ['にく', 'niku', 'thịt']),
  ぬ: H('Chiếc đũa gắp sợi mì (noodle → nu), có vòng xoắn ở cuối.', ['ぬの', 'nuno', 'vải']),
  ね: H('Con mèo (neko) ngồi cuộn đuôi tròn.', ['ねこ', 'neko', 'con mèo'], 'Dễ nhầm れ, わ: ね có vòng cuộn ở đuôi.'),
  の: H('Vòng tròn một nét như biển báo cấm "NO".', ['のり', 'nori', 'rong biển']),
  は: H('Chữ "h" kèm một vòng cong như tiếng cười "ha ha".', ['はな', 'hana', 'hoa'], 'Khi làm trợ từ, は đọc là "wa".'),
  ひ: H('Một nét cong như khuôn miệng cười toe "hi hi".', ['ひと', 'hito', 'người']),
  ふ: H('Ngọn núi Phú Sĩ (Fuji → fu) với mây bay xung quanh.', ['ふね', 'fune', 'con thuyền'], 'Đọc "fu": thổi nhẹ, giữa "hu" và "phu".'),
  へ: H('Một đỉnh đồi nhọn — gần giống hệt katakana ヘ.', ['へや', 'heya', 'căn phòng'], 'Khi làm trợ từ, へ đọc là "e".'),
  ほ: H('Giống は nhưng thêm một nét ngang: "ho" sâu hơn một tầng.', ['ほし', 'hoshi', 'ngôi sao']),
  ま: H('Bóng ma dang hai tay, thân xoắn bên dưới — "ma"!', ['まど', 'mado', 'cửa sổ']),
  み: H('Nhìn như số 2 và số 1 viết liền nét: 21.', ['みず', 'mizu', 'nước']),
  む: H('Con bò kêu "moo" (mu): sừng bên trái, đuôi cuộn bên phải.', ['むし', 'mushi', 'côn trùng']),
  め: H('"me" nghĩa là mắt (目) — hình con mắt có lông mi.', ['めがね', 'megane', 'kính mắt']),
  も: H('Cần câu thả xuống hai nét ngang như mồi.', ['もり', 'mori', 'khu rừng']),
  や: H('Chiếc du thuyền (yacht → ya) với cánh buồm phía trên.', ['やま', 'yama', 'núi']),
  ゆ: H('"yu" nghĩa là nước nóng (湯): nồi nước có vòng hơi bốc ra.', ['ゆき', 'yuki', 'tuyết']),
  よ: H('Con yo-yo treo trên sợi dây: nét dọc là dây, vòng cong là yo-yo.', ['よる', 'yoru', 'ban đêm']),
  ら: H('Con thỏ (rabbit → ra) có đôi tai ở trên.', ['さくら', 'sakura', 'hoa anh đào']),
  り: H('Hai nét dọc cong như hai cây sậy (reed → ri).', ['りんご', 'ringo', 'quả táo']),
  る: H('Con đường (route → ru) uốn như số 3 và thắt vòng ở cuối.', ['さる', 'saru', 'con khỉ'], 'Có vòng ở cuối; ろ thì không.'),
  れ: H('Giống ね nhưng đuôi hất ra ngoài, không cuộn tròn.', ['れきし', 'rekishi', 'lịch sử'], 'Phân biệt: ね cuộn, れ hất.'),
  ろ: H('Giống る nhưng không có vòng ở cuối — số 3 hở.', ['ろく', 'roku', 'số sáu']),
  わ: H('Giống れ/ね nhưng đuôi uốn tròn; "wa" ~ "oa" như em bé khóc.', ['わたし', 'watashi', 'tôi']),
  を: H('Dáng người dang tay cúi chào. Chữ này chỉ dùng làm trợ từ.', ['みずをのむ', 'mizu o nomu', 'uống nước'], 'Đọc là "o" (không đọc "wo").'),
  ん: H('Giống chữ "n" viết nghiêng, kéo dài nét cuối.', ['ほん', 'hon', 'quyển sách'], 'Không đứng đầu từ; đọc như "n/ng/m" cuối âm.'),
};

export const KATA_INFO: Record<string, KanaInfo> = {
  ア: H('Nét ngang và nét xiên có móc — như nửa trên chữ "A" in hoa.', ['アイス', 'aisu', 'kem']),
  イ: H('Người đứng nghiêng: nét xiên là thân, nét dọc là chân.', ['インク', 'inku', 'mực']),
  ウ: H('Cái ô (umbrella → u): chấm là đỉnh ô, nét cong là tay cầm.', ['ウイスキー', 'uisukī', 'rượu whisky']),
  エ: H('Giống chữ I in hoa — thanh dầm xây dựng (工 = công trình).', ['エアコン', 'eakon', 'máy lạnh']),
  オ: H('Cây thập có cành lệch — giống お gọn lại, bỏ chấm.', ['オレンジ', 'orenji', 'quả cam']),
  カ: H('Cánh tay gồng lên — gốc từ chữ Hán 力 (sức mạnh).', ['カメラ', 'kamera', 'máy ảnh']),
  キ: H('Chiếc chìa khoá (key → ki) đứng thẳng, hai răng ngang.', ['キウイ', 'kiui', 'quả kiwi']),
  ク: H('Giống く nhưng thêm nét ngang ở trên: mỏ chim đội mũ.', ['クラス', 'kurasu', 'lớp học']),
  ケ: H('Chữ け rút gọn: cái kệ ("ke" ~ kệ) treo tường.', ['ケーキ', 'kēki', 'bánh kem']),
  コ: H('Một góc vuông ("ko" ~ góc) mở ra bên phải.', ['コーヒー', 'kōhī', 'cà phê']),
  サ: H('Nét ngang dài với hai cọc dọc, như cái xà ngang ("sa" ~ xà).', ['サラダ', 'sarada', 'salad']),
  シ: H('Mặt cười nghiêng: hai chấm là mắt, nét cong là miệng.', ['シャツ', 'shatsu', 'áo sơ mi'], 'Dễ nhầm ツ: シ có các nét nằm ngang, ツ có các nét đứng.'),
  ス: H('Nét ngang rồi nét xiên kéo xuống — さ gọn, bỏ vòng xoắn.', ['スープ', 'sūpu', 'súp']),
  セ: H('Giống せ nhưng gọn hơn, bỏ nét cong ở dưới.', ['セーター', 'sētā', 'áo len']),
  ソ: H('Hai nét xiên hướng xuống như hạt mưa nghiêng.', ['ソファ', 'sofa', 'ghế sofa'], 'Dễ nhầm ン: ソ có nét đi xuống, ン có nét đi lên.'),
  タ: H('Giống ク có thêm một nét xiên bên trong.', ['タクシー', 'takushī', 'taxi']),
  チ: H('Gốc từ chữ Hán 千 (nghìn), rút gọn còn 3 nét.', ['チーズ', 'chīzu', 'phô mai']),
  ツ: H('Ba nét như mưa rơi xuống — "tsu" trong "tsunami".', ['ツアー', 'tsuā', 'tour du lịch'], 'Dễ nhầm シ: ツ có các nét đứng, シ có các nét nằm ngang.'),
  テ: H('Cột anten truyền hình (TV → te): hai nét ngang, một nét cong.', ['テレビ', 'terebi', 'tivi']),
  ト: H('Cây đinh cắm xuống: nét dọc và một nhánh nhỏ bên phải.', ['トマト', 'tomato', 'cà chua']),
  ナ: H('Chỉ giữ phần dấu thập bên trái của な.', ['ナイフ', 'naifu', 'con dao']),
  ニ: H('Hai nét ngang = số 2 — "ni" nghĩa là hai!', ['ニュース', 'nyūsu', 'tin tức']),
  ヌ: H('Giống ぬ rút gọn — chiếc đũa gắp sợi mì.', ['ヌードル', 'nūdoru', 'mì sợi']),
  ネ: H('Cây có hai chấm như bộ "thị" 礻 trong chữ Hán.', ['ネクタイ', 'nekutai', 'cà vạt']),
  ノ: H('Một nét xiên duy nhất từ phải xuống trái, như ngọn lá.', ['ノート', 'nōto', 'vở']),
  ハ: H('Gốc từ chữ Hán 八 (số 8): hai nét tách ra như mái nhà.', ['ハム', 'hamu', 'giăm bông']),
  ヒ: H('Giống chữ L viết ngược: nét ngang rồi nét cong xuống.', ['ヒーター', 'hītā', 'máy sưởi']),
  フ: H('Giống số 7 viết thấp: một nét gập ở góc.', ['フォーク', 'fōku', 'cái nĩa']),
  ヘ: H('Một đỉnh đồi nhọn — giống hệt hiragana へ.', ['ヘルメット', 'herumetto', 'mũ bảo hiểm']),
  ホ: H('Chữ thập kèm hai chấm hai bên, như cây thông có hai cành.', ['ホテル', 'hoteru', 'khách sạn']),
  マ: H('Chiếc khăn chùm đầu của bóng ma ("ma").', ['マスク', 'masuku', 'khẩu trang']),
  ミ: H('Gốc từ chữ Hán 三 (số 3): ba nét song song, "mittsu" = ba.', ['ミルク', 'miruku', 'sữa']),
  ム: H('Hình tam giác nhỏ như đầu con bò ("mu" = tiếng bò kêu).', ['ゲーム', 'gēmu', 'trò chơi']),
  メ: H('Giống dấu nhân × — め rút gọn.', ['メール', 'mēru', 'email']),
  モ: H('Giống chữ E nằm nghiêng; も gọn lại.', ['モデル', 'moderu', 'người mẫu']),
  ヤ: H('Giống や nhưng bỏ chấm: cánh buồm du thuyền gọn gàng.', ['タイヤ', 'taiya', 'lốp xe']),
  ユ: H('Cái bồn tắm ("yu" = nước nóng 湯): góc vuông, đáy dài.', ['ユニフォーム', 'yunifōmu', 'đồng phục']),
  ヨ: H('Chữ E soi gương — ba nét ngang nối nhau.', ['ヨーグルト', 'yōguruto', 'sữa chua']),
  ラ: H('Nét ngang ngắn ở trên, nét ngang dài có móc bên dưới.', ['ラジオ', 'rajio', 'radio']),
  リ: H('Giống り nhưng thẳng hơn: nét trái ngắn, nét phải dài.', ['リモコン', 'rimokon', 'điều khiển từ xa']),
  ル: H('Hai chân đang bước đi, nét phải cong ra.', ['ルール', 'rūru', 'luật lệ']),
  レ: H('Giống chữ L hoặc dấu tích ✓ — chỉ một nét.', ['レモン', 'remon', 'quả chanh']),
  ロ: H('Hình cái miệng 口 — một ô vuông ("ro" ~ rô).', ['ロボット', 'robotto', 'robot']),
  ワ: H('Giống ウ nhưng mất nét chấm: cái mũ rơi mất.', ['ワイン', 'wain', 'rượu vang']),
  ヲ: H('Giống ヨ có thêm đuôi. Rất hiếm gặp, chỉ cần nhận ra mặt chữ.', undefined, 'Gần như không dùng; trợ từ "o" vẫn viết là を.'),
  ン: H('Chấm nhỏ và nét xiên đi lên về bên phải.', ['パン', 'pan', 'bánh mì'], 'Dễ nhầm ソ: ン có nét đi lên, ソ có nét đi xuống.'),
};

/** Maps a kana to the same sound in the other script, e.g. か ↔ カ. */
export function counterpart(char: string): string {
  for (const row of KANA_ROWS) {
    const h = row.hira.indexOf(char);
    if (h >= 0) return row.kata[h];
    const k = row.kata.indexOf(char);
    if (k >= 0) return row.hira[k];
  }
  return char;
}
