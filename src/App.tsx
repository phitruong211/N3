// ============================================================
// App Root — Page Router
// ============================================================
// Principle: Single clear purpose per screen
// Each page maps to one navigation item, one mental model
// ============================================================

import React, { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/hooks/useApp';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { hasSession } from '@/lib/api';
import { AuthPage } from '@/components/auth/AuthPage';
import { AuthDialog, SessionNotices } from '@/components/auth/AuthDialog';
import { NotFoundPage } from '@/components/layout/NotFoundPage';
import { resolveInitialPath } from '@/lib/navigation';
import { LibraryLayout } from '@/components/library/LibraryLayout';
import { SharedGroupPage } from '@/components/flashcard/SharedGroupPage';
import { SharedDeckPage } from '@/components/flashcard/SharedDeckPage';
import { ShortLinkPage } from '@/components/flashcard/ShortLinkPage';
import { ExplorePage } from '@/components/flashcard/ExplorePage';
import { AdminReportsPage } from '@/components/flashcard/AdminReportsPage';
import { AppLoading } from '@/components/ui/AppLoading';

const Dashboard = lazy(() => import('@/components/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const DictionaryPage = lazy(() => import('@/components/dictionary/DictionaryPage').then(module => ({ default: module.DictionaryPage })));
const VocabularyPage = lazy(() => import('@/components/vocabulary/VocabularyPage').then((module) => ({ default: module.VocabularyPage })));
const KanjiPage = lazy(() => import('@/components/kanji/KanjiPage').then((module) => ({ default: module.KanjiPage })));
const GrammarPage = lazy(() => import('@/components/grammar/GrammarPage').then((module) => ({ default: module.GrammarPage })));
const FlashcardPage = lazy(() => import('@/components/flashcard/FlashcardPage').then((module) => ({ default: module.FlashcardPage })));
const AnkiPage = lazy(() => import('@/components/flashcard/FlashcardPage').then((module) => ({ default: module.AnkiPage })));
const QuizPage = lazy(() => import('@/components/quiz/QuizPage').then((module) => ({ default: module.QuizPage })));
const ListeningPage = lazy(() => import('@/components/listening/ListeningPage').then((module) => ({ default: module.ListeningPage })));
const ProgressPage = lazy(() => import('@/components/progress/ProgressPage').then((module) => ({ default: module.ProgressPage })));
const BookmarksPage = lazy(() => import('@/components/bookmarks/BookmarksPage').then((module) => ({ default: module.BookmarksPage })));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));

/** Library pages wait here; the data downloads the first time one is opened. */
function LibraryGate({ children }: { children: ReactNode }) {
  const { loading, loadError, retryLoad, ensureLibrary } = useApp();
  useEffect(ensureLibrary, [ensureLibrary]);
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-[var(--color-text)]" role="alert">
        <p>Không thể tải nội dung học.</p>
        <button onClick={retryLoad} className="study-button study-button-primary">Thử lại</button>
      </div>
    );
  }
  return loading ? <AppLoading message="Đang mở thư viện…"/> : <>{children}</>;
}

function AppContent() {
  const { learningSync } = useApp();
  const location = useLocation();
  const isDictionary = location.pathname === "/dictionary" || location.pathname.startsWith("/dictionary/");

  if (!isDictionary && !learningSync.initialized) {
    return <AppLoading fullScreen message="Đang chuẩn bị nội dung học…"/>;
  }

  return (
    <MainLayout>
      <SessionNotices />
      <Suspense fallback={<AppLoading message="Đang mở bài học…"/>}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/today" element={<Dashboard />} />
          <Route path="/dictionary/*" element={<DictionaryPage embedded />} />
          <Route path="/library" element={<LibraryLayout />}>
            <Route index element={<Navigate to="vocabulary" replace />} />
            <Route path="vocabulary" element={<LibraryGate><VocabularyPage /></LibraryGate>} />
            <Route path="grammar" element={<LibraryGate><GrammarPage /></LibraryGate>} />
            <Route path="kanji" element={<LibraryGate><KanjiPage /></LibraryGate>} />
            <Route path="listening" element={<ListeningPage />} />
          </Route>
          <Route path="/decks" element={<LibraryGate><FlashcardPage /></LibraryGate>} />
          <Route path="/review" element={<LibraryGate><AnkiPage /></LibraryGate>} />
          <Route path="/quiz" element={<LibraryGate><QuizPage /></LibraryGate>} />
          <Route path="/progress" element={<LibraryGate><ProgressPage /></LibraryGate>} />
          <Route path="/saved" element={<LibraryGate><BookmarksPage /></LibraryGate>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, mode, loading, restoreError, retryRestore, sessionKey, enterGuest } = useAuth();
  // Landing "Học thử" sends ?guest=1 so a new visitor skips the login screen.
  const wantsGuest = new URLSearchParams(location.search).get('guest') === '1';
  useEffect(() => {
    if (!wantsGuest || loading) return;
    if (mode === 'unauthenticated') enterGuest();
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [wantsGuest, loading, mode, enterGuest, navigate, location.pathname]);
  if (!user && (location.pathname === '/dictionary' || location.pathname.startsWith('/dictionary/'))) return <><Suspense fallback={<AppLoading fullScreen message="Đang mở từ điển…"/>}><DictionaryPage/></Suspense><AuthDialog/></>;
  if (/^\/s\/[^/]+\/?$/.test(location.pathname)) return <><Routes><Route path="/s/:code" element={<ShortLinkPage />}/></Routes><AuthDialog /></>;
  if (/^\/explore\/?$/.test(location.pathname)) return <><Routes><Route path="/explore" element={<ExplorePage />}/></Routes><AuthDialog /></>;
  if (/^\/shared\/groups\/[^/]+\/?$/.test(location.pathname)) return <><Routes><Route path="/shared/groups/:token" element={<SharedGroupPage />}/></Routes><AuthDialog /></>;
  if (/^\/shared\/[^/]+\/?$/.test(location.pathname)) return <><Routes><Route path="/shared/:token" element={<SharedDeckPage />}/></Routes><AuthDialog /></>;
  if (loading) return <AppLoading fullScreen message="Đang mở không gian học của bạn…"/>;
  if (!user && restoreError && hasSession()) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-[var(--color-bg)]"><p className="study-copy max-w-md text-center" role="alert">{restoreError}</p><button className="study-button study-button-primary" onClick={retryRestore}>Thử kết nối lại</button></div>;
  if (mode === 'unauthenticated') return wantsGuest ? <AppLoading fullScreen message="Đang mở không gian học…"/> : <AuthPage />;
  return <><AppProvider key={sessionKey}><AppContent /></AppProvider><AuthDialog /></>;
}
