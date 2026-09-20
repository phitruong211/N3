// ============================================================
// App Root — Page Router
// ============================================================
// Principle: Single clear purpose per screen
// Each page maps to one navigation item, one mental model
// ============================================================

import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from '@/hooks/useApp';
import { MainLayout } from '@/components/layout/MainLayout';

const Dashboard = lazy(() => import('@/components/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const VocabularyPage = lazy(() => import('@/components/vocabulary/VocabularyPage').then((module) => ({ default: module.VocabularyPage })));
const KanjiPage = lazy(() => import('@/components/kanji/KanjiPage').then((module) => ({ default: module.KanjiPage })));
const GrammarPage = lazy(() => import('@/components/grammar/GrammarPage').then((module) => ({ default: module.GrammarPage })));
const FlashcardPage = lazy(() => import('@/components/flashcard/FlashcardPage').then((module) => ({ default: module.FlashcardPage })));
const AnkiPage = lazy(() => import('@/components/flashcard/FlashcardPage').then((module) => ({ default: module.AnkiPage })));
const SRSPage = lazy(() => import('@/components/srs/SRSPage').then((module) => ({ default: module.SRSPage })));
const QuizPage = lazy(() => import('@/components/quiz/QuizPage').then((module) => ({ default: module.QuizPage })));
const ProgressPage = lazy(() => import('@/components/progress/ProgressPage').then((module) => ({ default: module.ProgressPage })));
const BookmarksPage = lazy(() => import('@/components/bookmarks/BookmarksPage').then((module) => ({ default: module.BookmarksPage })));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function AppContent() {
  const { currentPage, loading, loadError, retryLoad } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-3">
          <div className="font-jp-serif text-3xl text-[var(--color-text)]">N3 学習</div>
          <div className="text-sm text-[var(--color-text-tertiary)]">Đang tải nội dung học…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--color-bg)] text-[var(--color-text)]" role="alert">
        <p>Không thể tải nội dung học.</p>
        <button onClick={retryLoad} className="study-button study-button-primary">Thử lại</button>
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
      case 'anki': return <AnkiPage />;
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
      <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--color-text-secondary)]" role="status">Đang mở bài học…</div>}>
        {renderPage()}
      </Suspense>
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
