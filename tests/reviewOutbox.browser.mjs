// Run against local Vite. APIs are controlled here to exercise slow and lost responses.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.SRS_TEST_URL || 'http://127.0.0.1:5173';
const main = await (await fetch(base + '/src/main.tsx')).text();
const deps = [...main.matchAll(/from "(\/node_modules\/\.vite\/deps\/[^"]+)"/g)].map(match => match[1]);
const dep = name => deps.find(url => url.includes('/' + name + '.js?'));
const sessionModule = await (await fetch(base + '/src/components/flashcard/StudySession.tsx')).text();
const appUrl = sessionModule.match(/from "(\/src\/hooks\/useApp\.tsx[^"]*)"/)[1];
const authUrl = sessionModule.match(/from "(\/src\/hooks\/useAuth\.tsx[^"]*)"/)[1];
const browser = await chromium.launch();
try {
  for (const {source, type} of [{source:'BUILT_IN',type:'VOCABULARY'}, {source:'IMPORT',type:'VOCABULARY'}, {source:'IMPORT',type:'KANJI'}]) {
    const context = await browser.newContext();
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await context.addInitScript(() => {
      localStorage.setItem('auth:access_token', 'fixture');
      localStorage.setItem('auth:refresh_token', 'fixture');
      localStorage.setItem('auth:session_id', 'fixture');
    });
    let state = { revision: 0, bookmarks: [], studyDays: [], srsCards: [] };
    const receipts = new Map();
    let requests = 0;
    let loseFirst = true;
    let completedRequests = 0;
    const user = { id: 'queue-test', email: 'queue@example.test', displayName: 'Queue', timezone: 'Asia/Ho_Chi_Minh', role: 'USER' };
    const settings = { theme: 'light', fontSize: 'medium', showFurigana: true, showFuriganaFront: true, showFuriganaBack: true, autoPlayAudio: false, dailyGoal: 20, srsDailyNewLimit: 20, srsAgainMinutes: 1, srsGoodMinutes: 10, srsDesiredRetention: 0.9, reducedMotion: true };
    await context.route('**/api/v1/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const reply = data => route.fulfill({ json: data }).catch(() => {});
      if (path.endsWith('/auth/me')) return reply(user);
      if (path.endsWith('/settings')) return reply(settings);
      if (path.includes('/card-notes/')) return reply({ key: path.split('/').at(-1), text: '', version: 0, updatedAt: null });
      if (path.endsWith('/learning')) {
        if (req.method() === 'PUT') state = { ...req.postDataJSON(), revision: state.revision + 1 };
        return reply(state);
      }
      if (path.endsWith('/reviews/batch') || /\/anki\/cards\/[^/]+\/reviews$/.test(path)) {
        requests++;
        const lose = loseFirst; loseFirst = false;
        if (lose) await new Promise(resolve => setTimeout(resolve, 3000));
        const builtin = path.endsWith('/batch');
        const reviews = builtin ? req.postDataJSON().reviews : [{ cardId: path.split('/').at(-2), deckType: 'vocabulary', review: req.postDataJSON() }];
        const cards = reviews.map(value => {
          const id = value.review.clientReviewId;
          if (receipts.has(id)) return receipts.get(id);
          const reps = value.review.expectedRepetitions + 1;
          const card = { cardId: value.cardId, deckType: value.deckType, state: 'review', easeFactor: 2.5, dueDate: new Date(Date.now() + 86400000).toISOString(), reps, lapses: 0, lastReviewedAt: new Date().toISOString(), algorithm: 'fsrs-6', stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, firstReviewedAt: new Date().toISOString(), lastRating: 'easy' };
          receipts.set(id, card);
          if (builtin) state = { ...state, revision: state.revision + 1, srsCards: [...state.srsCards.filter(c => c.cardId !== card.cardId), card] };
          return card;
        });
        completedRequests++;
        if (lose) return route.abort().catch(() => {});
        if (builtin) return reply({ state, cards });
        const c = cards[0];
        return reply({ cardId: c.cardId, progress: { ...c, state: c.state.toUpperCase(), dueAt: c.dueDate, repetitions: c.reps, lastRating: 'EASY' } });
      }
      return reply({});
    });
    await context.route('**/__review-harness', route => route.fulfill({ contentType: 'text/html', body: `<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script><div id="root"></div><script type="module" src="/__review-harness.tsx"></script>` }));
    await context.route('**/__review-harness.tsx', route => route.fulfill({ contentType: 'application/javascript', body: `
      import React from '${dep('react')}';
      import ReactDOM from '${dep('react-dom_client')}';
      const {createRoot}=ReactDOM;
      import {BrowserRouter} from '${dep('react-router-dom')}';
      import {AuthProvider,useAuth} from '${authUrl}';
      import {AppProvider} from '${appUrl}';
      import {StudySession} from '/src/components/flashcard/StudySession.tsx';
      const cards=[1,2].map(i=>({id:'card-'+i,deckId:'test',front:'Question '+i,back:'Answer '+i,type:'${type}',tags:[],source:'${source}',position:i}));
      function Harness(){const {user,sessionKey}=useAuth();return user?React.createElement(AppProvider,{key:sessionKey},React.createElement(StudySession,{cards,deckName:'Queue test',mode:'anki',onExit:()=>{}})):null;}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(Harness))));
    ` }));
    await page.goto(base + '/__review-harness');
    await page.getByText('Question 1', { exact: true }).waitFor();
    const rateEasy = async () => {
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: /4 · Dễ/ }).waitFor();
      await page.getByRole('button', { name: /4 · Dễ/ }).click();
    };
    const start = Date.now();
    await rateEasy();
    await page.getByText('Question 2', { exact: true }).waitFor();
    assert.ok(Date.now() - start < 2000, 'advance must not wait for the 3-second response');
    assert.equal(completedRequests, 0, 'next card appears before backend completes');
    await rateEasy();
    await page.getByText('Đã hoàn thành', { exact: true }).waitFor();
    assert.equal(completedRequests, 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('user:queue-test:review_outbox_v1')).items.length), 2);
    // Let the server commit, drop its response, then reload before the backoff retry.
    await page.waitForFunction(() => document.body.textContent.includes('Chưa đồng bộ'), { timeout: 6000 });
    await page.reload();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('user:queue-test:review_outbox_v1'))?.items.length === 0, { timeout: 10000 });
    if (type === 'KANJI') assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('user:queue-test:review_outbox_v1')).confirmed['PERSONAL:kanji:card-1']));
    assert.equal(receipts.size, 2, 'lost response retries retain the same review ids');
    assert.ok([...receipts.values()].every(card => card.reps === 1));
    assert.ok(requests >= 2);
    assert.deepEqual(errors, []);
    console.log(`${source}/${type}: card advanced before slow response; completion preserved 2 pending reviews; reload drained without duplicates`);
    await context.close();
  }
} finally { await browser.close(); }
