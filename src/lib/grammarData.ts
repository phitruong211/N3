import type { GrammarItem, GrammarExample } from '../types';

export interface GrammarCardData {
  front: string;
  back: string;
  reading?: string;
  note?: string;
  tags?: string[];
  examples?: GrammarExample[];
}

/** Adapt the card JSON without losing its original back or example readings. */
export function normalizeGrammarCard(item: GrammarCardData, level: 'N3' | 'N4', index: number): GrammarItem {
  const sections = item.back.split(/【([^】]+)】\s*/);
  const meaning = sections[0].trim();
  const content = new Map<string, string>();
  for (let i = 1; i < sections.length; i += 2) content.set(sections[i], sections[i + 1].trim());
  const structure = content.get('Cấu trúc') || content.get('Công thức') || '';
  const usage = [...content].filter(([title]) => title !== 'Cấu trúc' && title !== 'Công thức')
    .map(([title, text]) => title === 'Cách dùng' ? text : `【${title}】\n${text}`).join('\n\n');
  const reading = item.reading || '';
  const examples = (item.examples || []).map(ex => ({ ...ex, reading: ex.reading || '' }));
  const lessonTag = item.tags?.find(tag => /^bài\s+\d+$/i.test(tag));
  const bai = lessonTag ? Number(lessonTag.match(/\d+/)?.[0]) : 0;
  return {
    // A new dataset must not inherit progress for an unrelated old row at the same position.
    id: `grammar-${level.toLowerCase()}-card-${encodeURIComponent(item.front)}`,
    numericId: index + 1, bai, stt: index + 1, cap_do: level,
    nhom_chuc_nang: '', mau_ngu_phap: item.front, phien_am: reading,
    cong_thuc: structure, nghia_cot_loi: meaning, giai_thich_toi_uu: usage,
    so_sanh_n4_n5: [], cac_cach_dung: [], canh_bao: item.note ? [item.note] : [], vi_du: examples,
    pattern: item.front, reading, meaning, structure, congThuc: structure, usage,
    nuance: content.get('Sắc thái') || '', commonMistakes: '', comparison: content.get('Phân biệt') || '',
    examples, lesson: bai ? `${level} - Bài ${bai}` : level, level,
    cardBack: item.back, tags: item.tags || [level],
  };
}
