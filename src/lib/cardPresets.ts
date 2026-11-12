import type { DeckConfig, StyleSpec } from './deckFormat.ts';

export type CardPreset = { id: string; name: string; note: string; style: StyleSpec };

/** One-tap looks for a whole deck. Each is a complete deck-level style; applying one clears the tiers below it. */
export const CARD_PRESETS: CardPreset[] = [
  { id: 'paper', name: 'Giấy', note: 'Nền giấy, chữ gọn, dễ đọc lâu', style: { theme: 'paper', font: { family: 'default', size: 30, bold: false }, align: 'center', autoFit: true } },
  { id: 'ink', name: 'Mực tối', note: 'Nền tối, chữ Mincho sáng, đỡ mỏi mắt ban đêm', style: { theme: 'dark', font: { family: 'notoSerifJp', size: 32 }, align: 'center', autoFit: true } },
  { id: 'brush', name: 'Thư pháp', note: 'Giấy dó, chữ Mincho lớn, cách đọc màu son', style: { theme: 'paper', colors: { bg: '#f4ecda', fg: '#1b1a17', accent: '#b23a2b' }, font: { family: 'shipporiMincho', size: 36 }, align: 'center', autoFit: true } },
  { id: 'plain', name: 'Tối giản', note: 'Theo màu ứng dụng, chữ Gothic, căn trái', style: { theme: 'system', font: { family: 'zenKakuGothic', size: 28 }, align: 'left' } },
];

/**
 * Puts a preset on the deck. Note-type and side styles would hide it, so they are cleared; per-field styles stay,
 * because "make the meaning small" is a layout choice the user made on purpose, not a look.
 */
export function applyPreset(config: DeckConfig, preset: CardPreset): DeckConfig {
  return {
    ...config,
    style: preset.style,
    noteTypes: config.noteTypes.map(({ style: _type, front: { style: _front, ...front }, back: { style: _back, ...back }, ...type }) => ({ ...type, front, back })),
  };
}

/** The preset a config currently matches, if any, so the picker can show which one is on. */
export function activePreset(config: DeckConfig): string | null {
  if (config.noteTypes.some(type => type.style || type.front.style || type.back.style)) return null;
  return CARD_PRESETS.find(preset => JSON.stringify(preset.style) === JSON.stringify(config.style))?.id ?? null;
}
