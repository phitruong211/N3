import { normalizeDeckTemplate, type DeckTemplateConfig } from './ankiImport.ts';

export function hasSeparateSideStyles(template: DeckTemplateConfig): boolean {
  const normalized = normalizeDeckTemplate(template);
  return JSON.stringify(normalized.front.style) !== JSON.stringify(normalized.back.style);
}

export function copySideStyle(template: DeckTemplateConfig, sourceSide: 'front' | 'back'): DeckTemplateConfig {
  const normalized = normalizeDeckTemplate(template);
  const targetSide = sourceSide === 'front' ? 'back' : 'front';
  return {
    ...normalized,
    [sourceSide]: { ...normalized[sourceSide], style: { ...normalized[sourceSide].style } },
    [targetSide]: { ...normalized[targetSide], style: { ...normalized[sourceSide].style } },
  };
}

export function createAppearanceDraft(template: DeckTemplateConfig) {
  const normalized = normalizeDeckTemplate(template);
  return { template: normalized, separateSides: hasSeparateSideStyles(normalized) };
}
