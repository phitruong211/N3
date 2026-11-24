import { UnifiedDeckPage } from './UnifiedDeckPage';

export function FlashcardPage() {
  return <UnifiedDeckPage mode="free" />;
}

export function AnkiPage() {
  return <UnifiedDeckPage mode="scheduled" />;
}

