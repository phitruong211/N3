// ============================================================
// App Root — Page Router
// ============================================================
// Principle: Single clear purpose per screen
// Each page maps to one navigation item, one mental model
// ============================================================

import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@/hooks/useApp';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { hasSession } from '@/lib/api';
import { AuthPage } from '@/components/auth/AuthPage';
import { AuthDialog, SessionNotices } from '@/components/auth/AuthDialog';
import { NotFoundPage } from '@/components/layout/NotFoundPage';
import { resolveInitialPath } from '@/lib/navigation';
import { LibraryLayout } from '@/components/library/LibraryLayout';

const Dashboard = lazy(() => import('@/components/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const VocabularyPage = lazy(() => import('@/components/vocabulary/VocabularyPage').then((module) => ({ default: module.VocabularyPage })));
const KanjiPage = lazy(() => import('@/components/kanji/KanjiPage').then((module) => ({ default: module.KanjiPage })));
const GrammarPage = lazy(() => import('@/components/grammar/GrammarPage').then((module) => ({ default: module.GrammarPage })));
const FlashcardPage = lazy(() => import('@/components/flashcard/FlashcardPage').then((module) => ({ default: module.FlashcardPage })));
const QuizPage = lazy(() => import('@/components/quiz/QuizPage').then((module) => ({ default: module.QuizPage })));
const ListeningPage = lazy(() => import('@/components/listening/ListeningPage').then((module) => ({ default: module.ListeningPage })));
const ProgressPage = lazy(() => import('@/components/progress/ProgressPage').then((module) => ({ default: module.ProgressPage })));
const BookmarksPage = lazy(() => import('@/components/bookmarks/BookmarksPage').then((module) => ({ default: module.BookmarksPage })));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function AppContent() {
  const { loading, loadError, retryLoad, learningSync } = useApp();

  if (loading || !learningSync.initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-2xl font-bold tracking-wide text-[var(--color-text)]"><img src="/so-nhat-mark.svg" alt="" className="h-12 w-12 object-contain" />SỔ NHẬT</div>
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

  return (
    <MainLayout>
      <SessionNotices />
      <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--color-text-secondary)]" role="status">Đang mở bài học…</div>}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/today" element={<Dashboard />} />
          <Route path="/library" element={<LibraryLayout />}>
            <Route index element={<Navigate to="vocabulary" replace />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
            <Route path="grammar" element={<GrammarPage />} />
            <Route path="kanji" element={<KanjiPage />} />
            <Route path="listening" element={<ListeningPage />} />
          </Route>
          <Route path="/decks" element={<FlashcardPage />} />
          <Route path="/review" element={<Navigate to="/decks" replace />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/saved" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </MainLayout>
  );
}

function RootRedirect() {
  const { storage } = useApp();
  return <Navigate replace to={resolveInitialPath('/', storage.getLastPage())} />;
}

export default function App() {
  return (
    <AuthProvider><AuthGate /></AuthProvider>
  );
}

function AuthGate() {
  const { user, mode, loading, restoreError, retryRestore, sessionKey } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]"><p className="study-copy">Đang khôi phục phiên đăng nhập…</p></div>;
  if (!user && restoreError && hasSession()) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-[var(--color-bg)]"><p className="study-copy max-w-md text-center" role="alert">{restoreError}</p><button className="study-button study-button-primary" onClick={retryRestore}>Thử kết nối lại</button></div>;
  if (mode === 'unauthenticated') return <AuthPage />;
  return <><AppProvider key={sessionKey}><AppContent /></AppProvider><AuthDialog /></>;
}
