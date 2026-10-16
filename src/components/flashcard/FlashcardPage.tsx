import { UnifiedDeckPage } from './UnifiedDeckPage';

export function FlashcardPage() {
  return <UnifiedDeckPage mode="free" />;
}

export function AnkiPage() {
  return <UnifiedDeckPage mode="scheduled" />;
}

export function speakJapanese(text?: string) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
