import type { PageId } from '../types/index.ts';
import { PAGE_PATHS } from './navigation.ts';

export const SITE_URL = 'https://n3-green.vercel.app';
const SUFFIX = ' · SỔ NHẬT';
const HOME_TITLE = 'SỔ NHẬT · Học tiếng Nhật mỗi ngày với từ vựng, kanji và ngữ pháp JLPT';
const HOME_DESCRIPTION = 'SỔ NHẬT giúp bạn học tiếng Nhật mỗi ngày: từ vựng, ngữ pháp và kanji JLPT N5–N2, từ điển, luyện nghe và lịch ôn ngắt quãng để nhớ lâu hơn.';

/** Short names for the app header; the longer search titles below are only for the browser tab and crawlers. */
export const PAGE_TITLES: Record<PageId, string> = {
  dictionary: 'Từ điển',
  dashboard: 'Hôm nay', vocabulary: 'Thư viện', grammar: 'Thư viện', kanji: 'Thư viện', listening: 'Thư viện', exam: 'Thư viện',
  flashcards: 'Bộ thẻ', anki: 'Ôn ngắt quãng', srs: 'Ôn ngắt quãng', quiz: 'Trắc nghiệm', progress: 'Tiến độ',
  search: 'Tìm kiếm', bookmarks: 'Đã lưu', settings: 'Cài đặt',
};

const META: Record<PageId, { title: string; description: string }> = {
  dashboard: { title: HOME_TITLE, description: HOME_DESCRIPTION },
  search: { title: HOME_TITLE, description: HOME_DESCRIPTION },
  vocabulary: { title: `Từ vựng tiếng Nhật JLPT N5–N2${SUFFIX}`, description: 'Học từ vựng tiếng Nhật theo cấp độ JLPT N5–N2 với cách đọc, Hán Việt, nghĩa và ví dụ. Lưu từ yêu thích và ôn lại bằng thẻ ghi nhớ.' },
  grammar: { title: `Ngữ pháp tiếng Nhật JLPT N5–N2${SUFFIX}`, description: 'Tra cứu mẫu ngữ pháp tiếng Nhật JLPT N5–N2 với cách dùng, ví dụ và ghi chú dễ hiểu bằng tiếng Việt.' },
  kanji: { title: `Kanji JLPT N5–N2${SUFFIX}`, description: 'Học kanji JLPT N5–N2 theo cấp độ: âm on, âm kun, Hán Việt, nghĩa và từ vựng đi kèm.' },
  listening: { title: `Luyện nghe tiếng Nhật JLPT${SUFFIX}`, description: 'Luyện nghe tiếng Nhật: podcast chọn theo cấp độ và bài nghe JLPT có câu hỏi, giải thích đáp án.' },
  exam: { title: `Đề thi JLPT N3 có đồng hồ${SUFFIX}`, description: 'Làm đề thi JLPT N3 các năm như phòng thi thật: đồng hồ đếm ngược từng phần, chấm điểm tự động, lưu kết quả và thời gian.' },
  dictionary: { title: `Từ điển tiếng Nhật${SUFFIX}`, description: 'Tra từ điển tiếng Nhật JMdict: tìm theo kanji, kana hoặc nghĩa, xem cách đọc, loại từ và biến thể; thêm từ vào bộ thẻ của bạn.' },
  flashcards: { title: `Bộ thẻ flashcard tiếng Nhật${SUFFIX}`, description: 'Tạo, nhập (Anki, Excel, CSV, JSON) và chia sẻ bộ thẻ flashcard tiếng Nhật. Ôn bằng thuật toán FSRS để nhớ đúng lúc.' },
  srs: { title: `Ôn ngắt quãng FSRS${SUFFIX}`, description: 'Ôn thẻ đến hạn bằng lịch ôn ngắt quãng FSRS: học ít hơn nhưng nhớ lâu hơn, đồng bộ giữa các thiết bị.' },
  anki: { title: `Ôn ngắt quãng FSRS${SUFFIX}`, description: 'Ôn thẻ đến hạn bằng lịch ôn ngắt quãng FSRS: học ít hơn nhưng nhớ lâu hơn, đồng bộ giữa các thiết bị.' },
  quiz: { title: `Trắc nghiệm tiếng Nhật${SUFFIX}`, description: 'Làm trắc nghiệm từ vựng và kanji tiếng Nhật để kiểm tra mức độ ghi nhớ.' },
  progress: { title: `Tiến độ học${SUFFIX}`, description: 'Theo dõi chuỗi ngày học, số thẻ đã ôn và thời gian học mỗi ngày.' },
  bookmarks: { title: `Đã lưu${SUFFIX}`, description: 'Các từ vựng, kanji và mẫu ngữ pháp bạn đã đánh dấu để xem lại.' },
  settings: { title: `Cài đặt${SUFFIX}`, description: 'Tuỳ chỉnh giao diện, cỡ chữ, furigana, mục tiêu hằng ngày và lịch ôn.' },
};

export function pageMeta(page: PageId): { title: string; description: string; canonical: string } {
  const path = PAGE_PATHS[page] ?? '/today';
  return { ...META[page], canonical: `${SITE_URL}${path}` };
}

/** Crawlers that run scripts read these from the document, so keep them in step with the route. */
export function applyPageMeta(page: PageId, doc: Document = document): void {
  const meta = pageMeta(page);
  doc.title = meta.title;
  doc.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', meta.canonical);
}
