# Navigation, Guest, and Library Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace state-only navigation with stable routes, reduce desktop/mobile navigation choices, preserve Guest sessions across reloads, and introduce the unified Library shell without changing learning data.

**Architecture:** `react-router-dom` becomes the source of truth for the current page while the existing `PageId` API remains as a compatibility adapter. Guest persistence is isolated in a small session helper. Existing vocabulary, grammar, Kanji, and listening pages render inside a routed Library layout; the old page shells are not kept in parallel.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Tailwind CSS 4, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-progressive-disclosure-ux-redesign-design.md`

## Global Constraints

- Keep all existing features reachable within two navigation actions.
- Desktop keeps a collapsible sidebar; mobile has exactly five bottom destinations: Hôm nay, Thư viện, Bộ thẻ, Ôn tập, Thêm.
- URL beats stored `lastPage`; stored state is only used when opening `/`.
- Login and registration finish on `/today`; an interrupted import remains recoverable through a “Tiếp tục tạo bộ” action.
- Guest reload in the same tab remains Guest and must not call protected account APIs.
- Preserve `Ctrl/Cmd + K`, lazy loading, retry states, four themes, three UI font sizes, and existing scoped storage.
- Do not alter content IDs, SRS scheduling, deck/card API shapes, or account ownership rules.

---

### Task 1: Define and test the route compatibility map

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `tests/navigation.test.mjs`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `PAGE_PATHS: Record<PageId, string>`
- Produces: `pathForPage(page: PageId): string`
- Produces: `pageForLocation(pathname: string, search?: string): PageId | null`
- Produces: `resolveInitialPath(pathname: string, storedPage: string | null): string`

- [ ] **Step 1: Write the failing route mapping tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageForLocation, pathForPage, resolveInitialPath } from '../src/lib/navigation.ts';

test('legacy page ids map to canonical routes', () => {
  assert.equal(pathForPage('dashboard'), '/today');
  assert.equal(pathForPage('flashcards'), '/decks');
  assert.equal(pathForPage('anki'), '/decks?mode=scheduled');
  assert.equal(pathForPage('srs'), '/review');
});

test('library routes retain their content page ids', () => {
  assert.equal(pageForLocation('/library/vocabulary'), 'vocabulary');
  assert.equal(pageForLocation('/library/grammar'), 'grammar');
  assert.equal(pageForLocation('/library/kanji'), 'kanji');
  assert.equal(pageForLocation('/library/listening'), 'listening');
});

test('the URL wins and root migrates the stored page', () => {
  assert.equal(resolveInitialPath('/library/kanji', 'dashboard'), '/library/kanji');
  assert.equal(resolveInitialPath('/', 'anki'), '/decks?mode=scheduled');
  assert.equal(resolveInitialPath('/', '/progress'), '/progress');
  assert.equal(resolveInitialPath('/', 'unknown'), '/today');
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `node --experimental-strip-types --test tests/navigation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/navigation.ts`.

- [ ] **Step 3: Implement the typed compatibility map**

```ts
import type { PageId } from '@/types';

export const PAGE_PATHS: Record<PageId, string> = {
  dashboard: '/today',
  vocabulary: '/library/vocabulary',
  grammar: '/library/grammar',
  kanji: '/library/kanji',
  listening: '/library/listening',
  flashcards: '/decks',
  anki: '/decks?mode=scheduled',
  srs: '/review',
  quiz: '/quiz',
  progress: '/progress',
  bookmarks: '/saved',
  settings: '/settings',
  search: '/today',
};

export function pathForPage(page: PageId): string {
  return PAGE_PATHS[page] ?? '/today';
}

export function pageForLocation(pathname: string, search = ''): PageId | null {
  if (pathname === '/decks') return new URLSearchParams(search).get('mode') === 'scheduled' ? 'anki' : 'flashcards';
  const entry = Object.entries(PAGE_PATHS).find(([, path]) => path.split('?')[0] === pathname);
  return (entry?.[0] as PageId | undefined) ?? null;
}

export function resolveInitialPath(pathname: string, storedPage: string | null): string {
  if (pathname !== '/') return pathname;
  if (!storedPage) return '/today';
  if (storedPage.startsWith('/')) return pageForLocation(storedPage.split('?')[0], storedPage.split('?')[1] ?? '') ? storedPage : '/today';
  return PAGE_PATHS[storedPage as PageId] ?? '/today';
}
```

- [ ] **Step 4: Run the navigation tests**

Run: `node --experimental-strip-types --test tests/navigation.test.mjs`

Expected: PASS for all three tests.

- [ ] **Step 5: Commit the route contract**

```bash
git add src/lib/navigation.ts src/types/index.ts tests/navigation.test.mjs
git commit -m "feat: define canonical app routes"
```

---

### Task 2: Make React Router the page source of truth

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useApp.tsx`
- Create: `src/components/layout/NotFoundPage.tsx`

**Interfaces:**
- Consumes: `pathForPage`, `pageForLocation`, `resolveInitialPath`
- Preserves: `useApp().currentPage` and `useApp().setCurrentPage(PageId)` for existing components
- Produces: canonical routes and route redirects without parallel page shells

- [ ] **Step 1: Add a browser assertion for deep links and history**

Add to `tests/guestFlow.browser.mjs` after entering Guest:

```js
await page.goto(`${baseURL}/library/kanji`);
await page.getByRole('heading', { name: 'Kanji', exact: true }).first().waitFor();
await nav('Hôm nay');
await page.goBack();
await page.getByRole('heading', { name: 'Kanji', exact: true }).first().waitFor();
assert.equal(new URL(page.url()).pathname, '/library/kanji');
```

- [ ] **Step 2: Run the Guest browser test and verify deep linking fails**

Run in terminal 1: `npm run dev -- --host 127.0.0.1`

Run in terminal 2: `npm run test:guest`

Expected: FAIL because the application does not derive the page from the URL.

- [ ] **Step 3: Wrap the application and declare canonical routes**

In `src/main.tsx`, wrap `<App />` with `<BrowserRouter>`. In `src/App.tsx`, replace the `switch` with lazy routed elements:

```tsx
<Routes>
  <Route path="/" element={<RootRedirect />} />
  <Route path="/today" element={<Dashboard />} />
  <Route path="/library" element={<Navigate to="/library/vocabulary" replace />} />
  <Route path="/library/vocabulary" element={<VocabularyPage />} />
  <Route path="/library/grammar" element={<GrammarPage />} />
  <Route path="/library/kanji" element={<KanjiPage />} />
  <Route path="/library/listening" element={<ListeningPage />} />
  <Route path="/decks" element={<FlashcardPage />} />
  <Route path="/review" element={<SRSPage />} />
  <Route path="/quiz" element={<QuizPage />} />
  <Route path="/progress" element={<ProgressPage />} />
  <Route path="/saved" element={<BookmarksPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

`RootRedirect` must call `resolveInitialPath('/', storage.getLastPage())` and return `<Navigate replace to={...} />`. `NotFoundPage` contains heading “Không tìm thấy trang” and one button navigating to `/today`.

- [ ] **Step 4: Turn `useApp` into a compatibility adapter**

Replace `_setCurrentPage` state with router state:

```tsx
const location = useLocation();
const navigate = useNavigate();
const currentPage = pageForLocation(location.pathname, location.search) ?? 'dashboard';

const setCurrentPage = useCallback((page: PageId) => {
  const path = pathForPage(page);
  navigate(path);
  setLastPage(path);
}, [navigate, setLastPage]);
```

Update `selectSearchResult` to call `navigate(pathForPage(page))`, then store the canonical path. Remove `_setCurrentPage` and the initial `pages` array.

- [ ] **Step 5: Run focused and full checks**

Run: `node --experimental-strip-types --test tests/navigation.test.mjs`

Run: `npm run build`

Expected: both PASS; TypeScript reports no stale `_setCurrentPage` reference.

- [ ] **Step 6: Commit routed navigation**

```bash
git add src/main.tsx src/App.tsx src/hooks/useApp.tsx src/components/layout/NotFoundPage.tsx tests/guestFlow.browser.mjs
git commit -m "feat: route application pages by URL"
```

---

### Task 3: Persist Guest mode and redirect authentication safely

**Files:**
- Create: `src/lib/guestSession.ts`
- Create: `tests/guestSession.test.mjs`
- Modify: `src/hooks/useAuth.tsx`
- Modify: `src/components/auth/AuthPage.tsx`
- Modify: `src/components/auth/AuthDialog.tsx`
- Modify: `src/components/dashboard/Dashboard.tsx`

**Interfaces:**
- Produces: `readGuestSession(storage?: Storage): boolean`
- Produces: `writeGuestSession(active: boolean, storage?: Storage): void`
- Preserves: `ImportDraft` until the user resumes or discards it

- [ ] **Step 1: Write Guest session persistence tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGuestSession, writeGuestSession } from '../src/lib/guestSession.ts';

test('Guest session survives recreation in the same tab', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  writeGuestSession(true, storage);
  assert.equal(readGuestSession(storage), true);
  writeGuestSession(false, storage);
  assert.equal(readGuestSession(storage), false);
});
```

- [ ] **Step 2: Verify the test fails, then implement the helper**

Run: `node --experimental-strip-types --test tests/guestSession.test.mjs`

Expected before implementation: FAIL with missing module.

```ts
const KEY = 'guest:session';
export function readGuestSession(storage: Storage = sessionStorage): boolean {
  try { return storage.getItem(KEY) === '1'; } catch { return false; }
}
export function writeGuestSession(active: boolean, storage: Storage = sessionStorage): void {
  try { if (active) storage.setItem(KEY, '1'); else storage.removeItem(KEY); } catch { /* unavailable storage */ }
}
```

- [ ] **Step 3: Use the helper in authentication state transitions**

Initialize Guest with `useState(readGuestSession)`. `enterGuest()` writes `true`; successful authentication and `signOut()` write `false`. Remove `startUnauthenticated()` and its unconditional session removal. Keep `guest:*`, `user:<id>:*`, and `auth:*` storage separate.

- [ ] **Step 4: Navigate successful authentication to Hôm nay**

In `AuthPage`, call `useNavigate()` and, only after `signIn`/`signUp` resolves, run:

```tsx
setPrompt(null);
navigate('/today', { replace: true });
```

If `draft` exists, do not create the deck. `Dashboard` displays a primary or secondary `Tiếp tục tạo bộ` action that navigates to `/decks`; closing it leaves the draft intact until the deck creator handles it.

- [ ] **Step 5: Extend the Guest browser test**

Replace the old post-reload second click on “Học thử” with:

```js
await page.reload();
await page.getByRole('heading', { name: /Hôm nay học gì/ }).waitFor();
assert.equal(calls.filter(call => call.authorization).length, 0);
```

After fixture login, assert `new URL(page.url()).pathname === '/today'` and the draft continuation action exists.

- [ ] **Step 6: Run Guest and unit tests**

Run: `node --experimental-strip-types --test tests/guestSession.test.mjs tests/guestStorage.test.mjs tests/authSession.test.mjs`

Run with Vite active: `npm run test:guest`

Expected: PASS; reload remains Guest without a protected request.

- [ ] **Step 7: Commit Guest continuity**

```bash
git add src/lib/guestSession.ts src/hooks/useAuth.tsx src/components/auth/AuthPage.tsx src/components/auth/AuthDialog.tsx src/components/dashboard/Dashboard.tsx tests/guestSession.test.mjs tests/guestFlow.browser.mjs
git commit -m "fix: preserve guest sessions and auth drafts"
```

---

### Task 4: Replace crowded navigation with desktop and mobile information architecture

**Files:**
- Create: `src/components/layout/navigationItems.ts`
- Create: `src/components/ui/AppDialog.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/hooks/useApp.tsx`
- Modify: `src/lib/storage.ts`

**Interfaces:**
- Produces: `PRIMARY_NAV_ITEMS`, `SECONDARY_NAV_ITEMS`, `MOBILE_NAV_ITEMS`, `MORE_NAV_ITEMS`
- Produces: `AppDialog` with Escape, focus trap, backdrop close, scroll lock, and focus restoration

- [ ] **Step 1: Define the single navigation configuration**

```ts
export const PRIMARY_NAV_ITEMS = [
  { page: 'dashboard', label: 'Hôm nay', icon: LayoutGrid },
  { page: 'vocabulary', label: 'Thư viện', icon: BookOpen },
  { page: 'flashcards', label: 'Bộ thẻ', icon: Layers },
  { page: 'srs', label: 'Ôn tập', icon: RotateCcw },
  { page: 'quiz', label: 'Trắc nghiệm', icon: CircleHelp },
] as const;
export const SECONDARY_NAV_ITEMS = [
  { page: 'progress', label: 'Tiến độ', icon: ChartNoAxesCombined },
  { page: 'bookmarks', label: 'Đã lưu', icon: Bookmark },
] as const;
export const MOBILE_NAV_ITEMS = PRIMARY_NAV_ITEMS.slice(0, 4);
export const MORE_NAV_ITEMS = [...PRIMARY_NAV_ITEMS.slice(4), ...SECONDARY_NAV_ITEMS, { page: 'settings', label: 'Cài đặt', icon: Settings }] as const;
```

- [ ] **Step 2: Persist the collapsed desktop sidebar**

Add scoped storage methods `getSidebarCollapsed()` and `setSidebarCollapsed(value)` using key `sidebar_collapsed`. Initialize `useApp` from it and write when toggled. This preference is visual and may remain device-local.

- [ ] **Step 3: Rebuild Sidebar and BottomNav from the shared configuration**

Use `hidden lg:flex` for Sidebar and `lg:hidden` for mobile navigation. BottomNav renders four route buttons plus a fifth local “Thêm” button with `aria-expanded`. Labels remain at least `text-xs`; each button stays at least 44 px high. Sidebar login calls `setPrompt('login')` directly.

- [ ] **Step 4: Replace the hand-built mobile sheet with `AppDialog`**

`AppDialog` must wrap native `<dialog>`, call `showModal()`, handle `cancel`, restore the opener, and accept:

```ts
type AppDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};
```

Render `MORE_NAV_ITEMS` in the sheet. The mobile header keeps logo/title/search and removes the duplicate hamburger because “Thêm” owns secondary navigation.

- [ ] **Step 5: Update keyboard shortcuts and active states**

Keep `G D`, `G V`, `G F`, `G S`, `G Q`, `G P`, and `G B`; remove the public `G A` route. Library is active for all four library page IDs. The decks item is active for both `flashcards` and legacy `anki` query mode.

- [ ] **Step 6: Verify responsive navigation**

Run: `npm run build`

Use Playwright or browser QA at 320×812, 768×1024, 1024×768, and 1440×900. Confirm five mobile items, no horizontal overflow, no desktop sidebar before 1024 px, and no sidebar scrolling at 720 px height.

- [ ] **Step 7: Commit the navigation shell**

```bash
git add src/components/layout src/components/ui/AppDialog.tsx src/hooks/useApp.tsx src/lib/storage.ts
git commit -m "feat: simplify desktop and mobile navigation"
```

---

### Task 5: Add the unified Library layout and contextual notices

**Files:**
- Create: `src/components/library/LibraryLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/auth/AuthDialog.tsx`
- Modify: `src/components/auth/AccountLearningStatus.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/components/dashboard/Dashboard.tsx`

**Interfaces:**
- Produces: `LibraryLayout` with four route tabs and `<Outlet />`
- Produces: contextual legacy-data notice linking to `/settings?section=data`

- [ ] **Step 1: Build Library tabs around nested routes**

```tsx
const tabs = [
  ['/library/vocabulary', 'Từ vựng'],
  ['/library/grammar', 'Ngữ pháp'],
  ['/library/kanji', 'Kanji'],
  ['/library/listening', 'Luyện nghe'],
] as const;

export function LibraryLayout() {
  return <div className="study-page">
    <PageHeading eyebrow="KHÁM PHÁ" title="Thư viện" subtitle="Chọn nội dung bạn muốn học" />
    <nav aria-label="Nội dung thư viện" className="study-segmented">
      {tabs.map(([to, label]) => <NavLink key={to} to={to} aria-current={({ isActive }) => isActive ? 'page' : undefined}>{label}</NavLink>)}
    </nav>
    <Outlet />
  </div>;
}
```

Use a nested `/library` route in `App.tsx`. Existing pages remove duplicate outer `study-page` and top heading only when rendered through `LibraryLayout`; their content, search, filters, and details stay unchanged.

- [ ] **Step 2: Move success sync status out of global notices**

`SessionNotices` renders only actionable errors. `AccountLearningStatus` moves into Settings → Tài khoản. The legacy notice appears on Hôm nay only when `hasLegacyLearningData()` is true.

- [ ] **Step 3: Add deterministic legacy notice dismissal**

Store `legacy_notice_signature` and `legacy_notice_dismissed_signature` per namespace. Compute the signature from the set of legacy keys that exist. “Để sau” stores the current signature; a changed signature shows the notice again. “Xem dữ liệu” navigates to `/settings?section=data`.

- [ ] **Step 4: Keep one primary Dashboard action**

Dashboard priority is: due review → draft continuation → last deck → library. Only the first is a filled primary button; library cards remain secondary navigation.

- [ ] **Step 5: Run project checks**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run with Vite active: `npm run test:guest`

Expected: all PASS; no global “Đã đồng bộ” banner appears on content pages.

- [ ] **Step 6: Commit the Library shell**

```bash
git add src/App.tsx src/components/library src/components/auth src/components/settings/SettingsPage.tsx src/components/dashboard/Dashboard.tsx src/lib/storage.ts
git commit -m "feat: unify library navigation and notices"
```

