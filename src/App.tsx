// ============================================================
// App Root — Page Router
// ============================================================
// Principle: Single clear purpose per screen
// Each page maps to one navigation item, one mental model
// ============================================================

import React from 'react';
import { AppProvider, useApp } from '@/hooks/useApp';
import { MainLayout } from '@/components/layout/MainLayout';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { VocabularyPage } from '@/components/vocabulary/VocabularyPage';
import { KanjiPage } from '@/components/kanji/KanjiPage';
import { GrammarPage } from '@/components/grammar/GrammarPage';
import { FlashcardPage } from '@/components/flashcard/FlashcardPage';
import { SRSPage } from '@/components/srs/SRSPage';
import { QuizPage } from '@/components/quiz/QuizPage';
import { ProgressPage } from '@/components/progress/ProgressPage';
import { BookmarksPage } from '@/components/bookmarks/BookmarksPage';
import { SettingsPage } from '@/components/settings/SettingsPage';

function AppContent() {
  const { currentPage, loading } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-3">
          <div className="font-jp-serif text-3xl text-[var(--color-text)]">N3 学習</div>
          <div className="text-sm text-[var(--color-text-tertiary)]">Loading...</div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'vocabulary': return <VocabularyPage />;
      case 'kanji': return <KanjiPage />;
      case 'grammar': return <GrammarPage />;
      case 'flashcards': return <FlashcardPage />;
      case 'srs': return <SRSPage />;
      case 'quiz': return <QuizPage />;
      case 'progress': return <ProgressPage />;
      case 'bookmarks': return <BookmarksPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <MainLayout>
      {renderPage()}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
