// Run with Vite running: npm run test:guest (API responses are fixtures, never production).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const baseURL = process.env.GUEST_TEST_URL || 'http://127.0.0.1:5173';
const output = process.env.GUEST_TEST_OUTPUT || '/tmp/n3-guest-verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const calls = [];
const decks = { A: [], B: [] };
const learning={A:{revision:0,bookmarks:[],srsCards:[],studyDays:[]},B:{revision:0,bookmarks:[],srsCards:[],studyDays:[]}};
let failLogin = false;
let heldLogin = null;
let failCreate = false;
const settings = { theme: 'light', fontSize: 'medium', showFurigana: true, autoPlayAudio: false, dailyGoal: 20, ankiSessionMinutes: 0, reducedMotion: true };
context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/v1/**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname.replace('/api/v1', '');
  const method = request.method();
  const authorization = request.headers().authorization;
  const owner = authorization?.replace('Bearer ', '');
  calls.push({ path, method, authorization });
  const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/auth/login' || path === '/auth/register') {
    assert.equal(authorization, undefined);
    if (heldLogin) { heldLogin.started(); await heldLogin.pause; }
    if (failLogin) return reply({ message: 'Thông tin đăng nhập không đúng.' }, 401);
    const body = request.postDataJSON();
    const id = body.email.startsWith('b') ? 'B' : 'A';
    return reply({ accessToken: id, refreshToken: `refresh-${id}`, user: { id, email: body.email, displayName: `Learner ${id}` } });
  }
  if (path === '/auth/logout') return route.fulfill({ status: 204 });
  assert.ok(owner === 'A' || owner === 'B', `Unexpected protected request: ${method} ${path}`);
  if (path === '/auth/me') return reply({ id: owner, email: `${owner.toLowerCase()}@example.com`, displayName: `Learner ${owner}` });
  if (path === '/users/me/learning') { if(method==='PUT')learning[owner]={...request.postDataJSON(),revision:learning[owner].revision+1};return reply(learning[owner]); }
  if (path === '/users/me/settings') return reply(settings);
  if (path === '/decks' && method === 'GET') return reply({content:decks[owner].map(item=>item.deck),totalElements:decks[owner].length,totalPages:decks[owner].length?1:0,number:0,size:20});
  if (path === '/decks/import' && method === 'POST') {
    if (failCreate) return reply({ message: 'Máy chủ tạm thời chưa lưu được.' }, 503);
    const body = request.postDataJSON();
    const id = `${owner}-${decks[owner].length + 1}`;
    const entry = { deck: { ...body, id, cardCount: body.cards.length, newCount: body.cards.length, dueCount: 0, position: 0, createdAt: new Date().toISOString() }, cards: body.cards.map((card, index) => ({ ...card, id: `${id}-${index}`, deckId: id })) };
    decks[owner].push(entry);
    return reply(entry, 201);
  }
  if (path.startsWith('/anki/decks/')) return reply([]);
  if (path.startsWith('/decks/')) {
    const entry = decks[owner].find(item => item.deck.id === path.split('/')[2]);
    if(entry && path.endsWith('/metadata'))return reply(entry.deck);
    if(entry && path.endsWith('/cards'))return reply({content:entry.cards,totalElements:entry.cards.length,totalPages:1,number:0,size:50});
    return entry ? reply(entry) : reply({ message: 'Không tìm thấy bộ thẻ.' }, 404);
  }
  throw new Error(`Unhandled fixture: ${method} ${path}`);
});
// External metadata is unrelated to the Guest contract and must not make this test network-dependent.
await context.route('https://raw.githubusercontent.com/**', route => route.abort());
const button = (name) => page.getByRole('button', { name, exact: true });
const nav = name => page.getByRole('navigation', { name: 'Các trang học' }).getByRole('button', { name, exact: true }).click();
const stored = key => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
const createCount = () => calls.filter(call => call.path === '/decks/import' && call.method === 'POST').length;
async function signIn(email, register = false) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: register ? 'Đăng ký' : 'Đăng nhập', exact: true }).click();
  if (register) await dialog.getByLabel('Tên hiển thị').fill('Learner');
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await dialog.locator('form').getByRole('button', { name: register ? 'Tạo tài khoản' : 'Đăng nhập', exact: true }).click();
}
try {
  await page.goto(baseURL);
  await button('Khám phá với tư cách khách').click();
  await page.getByRole('heading', { name: 'Hôm nay học gì?' }).waitFor();
  assert.equal(calls.length, 0);
  assert.equal(await button('Đăng xuất').count(), 0);
  await nav('Từ vựng');
  await button('Lưu từ').click();
  const guestBookmarks = await stored('guest:n3_bookmarks');
  assert.equal(guestBookmarks.length, 1);
  await page.reload();
  await button('Bỏ lưu từ').waitFor();
  assert.deepEqual(await stored('guest:n3_bookmarks'), guestBookmarks);
  await button('Tìm kiếm').click();
  await page.getByLabel('Từ khóa tìm kiếm').fill('日本');
  await page.getByRole('listbox', { name: 'Kết quả tìm kiếm' }).getByRole('option').first().waitFor();
  await button('Đóng tìm kiếm').click();
  await nav('Ôn tập');
  await button('Học 10 từ mới').click();
  for (let i = 0; i < 10; i++) {
    await button('Chạm hoặc nhấn Space để xem đáp án').click();
    await page.getByRole('button', { name: /3 Được/ }).click();
  }
  await page.getByRole('heading', { name: 'Đã hoàn thành', exact: true }).waitFor();
  assert.equal((await stored('guest:srs_cards_vocab_v1')).filter(card => card.state === 'learning' && card.intervalMinutes === 10 && card.lastReviewedAt).length, 10);
  assert.equal((await stored('guest:n3_study_days'))[0].cardsReviewed, 10);
  await button('Về trang ôn tập').click();
  for (const name of ['Anki', 'Trắc nghiệm', 'Luyện nghe', 'Tiến độ', 'Cài đặt']) {
    await nav(name);
    await page.getByRole('heading', { name, exact: true }).first().waitFor();
  }
  await button('Tối').click();
  assert.equal((await stored('guest:n3_settings')).theme, 'dark');
  assert.equal(calls.length, 0, 'Guest learning/settings must never call account API');
  await nav('Thẻ học');
  await page.locator('article').filter({has:page.getByRole('heading',{name:'Từ vựng N3',exact:true})}).getByRole('button',{name:'Bắt đầu học',exact:true}).click();
  await page.getByLabel('Số thẻ', {exact:true}).fill('1');await button('Bắt đầu').click();
  await page.getByRole('button',{name:'Hiện đáp án',exact:true}).first().click();await button('Hoàn thành').click();
  await page.getByRole('heading',{name:'Đã hoàn thành',exact:true}).waitFor();await button('Về danh sách bộ thẻ').click();
  assert.equal((await stored('guest:n3_study_days'))[0].flashcardReviewed,1);
  await page.getByLabel('Chọn file nhập bộ thẻ').setInputFiles({ name: 'guest.csv', mimeType: 'text/csv', buffer: Buffer.from('front,back\n日本,Nhật Bản\n猫,Con mèo') });
  await page.getByLabel('Tên thư mục').fill('Guest draft');
  await button('Tạo bộ thẻ').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục học thử' }).click();
  assert.equal(await page.getByLabel('Tên thư mục').inputValue(), 'Guest draft');
  assert.equal(calls.length, 0);
  assert.equal(await button('Tạo bộ thẻ').evaluate(el => el === document.activeElement), true);
  await button('Tạo bộ thẻ').click();
  failLogin = true;
  await signIn('a@example.com');
  await page.getByRole('dialog').getByRole('alert').waitFor();
  await page.screenshot({ path: `${output}/auth-dark.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(await stored('guest:n3_bookmarks'), guestBookmarks);
  assert.equal(createCount(), 0);
  // Cancellation stays available during an in-flight authentication request.
  let releaseLogin;
  let markStarted;
  const loginStarted = new Promise(resolve => { markStarted = resolve; });
  heldLogin = { started: markStarted, pause: new Promise(resolve => { releaseLogin = resolve; }) };
  failLogin = false;
  await button('Tạo bộ thẻ').click();
  await signIn('a@example.com');
  await loginStarted;
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục học thử' }).click();
  releaseLogin(); heldLogin = null;
  assert.equal(await page.getByLabel('Tên thư mục').inputValue(), 'Guest draft');
  assert.equal(await page.evaluate(() => localStorage.getItem('auth:refresh_token')), null);
  assert.equal(createCount(), 0);
  // Signing in from the general header also preserves an in-progress preview.
  await button('Đăng nhập / Đăng ký').click();
  failLogin = false;
  await signIn('a@example.com');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByLabel('Tên thư mục').waitFor();
  assert.equal(await page.getByLabel('Tên thư mục').inputValue(), 'Guest draft');
  assert.equal(createCount(), 0, 'Authentication must not create a deck automatically');
  await button('Để lại trên thiết bị').click();
  failCreate = true;
  await button('Tạo bộ thẻ').click();
  await page.getByRole('alert').filter({ hasText: 'Máy chủ tạm thời' }).waitFor();
  assert.equal(await page.getByLabel('Tên thư mục').inputValue(), 'Guest draft');
  failCreate = false;
  await button('Tạo bộ thẻ').click();
  await page.getByText('Đã tạo bộ thẻ với 2 thẻ.', { exact: true }).waitFor();
  assert.equal(decks.A.length, 1);
  await nav('Từ vựng');
  await button('Lưu từ').click();
  assert.equal((await stored('user:A:n3_bookmarks')).length, 1);
  await button('Đăng xuất').click();
  await page.getByRole('heading', { name: 'Hôm nay học gì?' }).waitFor();
  assert.deepEqual(await stored('guest:n3_bookmarks'), guestBookmarks);
  await nav('Thẻ học');
  assert.equal(await page.getByText('Guest draft', { exact: true }).count(), 0);
  await button('Tạo bộ thủ công').click();
  await page.getByLabel('Tên bộ thẻ', { exact: true }).fill('B manual');
  await page.getByLabel('Tạo bộ trống', { exact:true }).check();
  await button('Tạo và thêm thẻ').click();
  await signIn('b@example.com', true);
  await page.getByLabel('Tên bộ thẻ', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Tên bộ thẻ', { exact: true }).inputValue(), 'B manual');
  assert.equal(decks.B.length, 0, 'Registering must not create an empty deck');
  await nav('Từ vựng');
  await button('Lưu từ').waitFor();
  assert.deepEqual(await stored('user:B:n3_bookmarks'), []);
  assert.deepEqual(await stored('user:B:srs_cards_vocab_v1'), []);
  assert.deepEqual(await stored('user:B:n3_study_days'), []);
  assert.deepEqual(await stored('guest:n3_bookmarks'), guestBookmarks);
  // A tab switch invalidates the old account tree and restores the new subject.
  const other = await context.newPage();
  await other.goto(baseURL);
  await other.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng nhập / Đăng ký', exact: true }).waitFor();
  assert.equal(await button('Đăng xuất').count(), 0);
  await other.close();
  // Mobile preview/auth: no horizontal overflow and the form remains usable.
  await page.setViewportSize({ width: 375, height: 812 });
  await button('Mở trang khác').click();
  await page.getByRole('dialog', { name: 'Trang khác' }).getByRole('button', { name: 'Thẻ học', exact: true }).click();
  await page.getByLabel('Chọn file nhập bộ thẻ').setInputFiles({ name: 'mobile.csv', mimeType: 'text/csv', buffer: Buffer.from('front,back\n日本,Nhật Bản') });
  await button('Tạo bộ thẻ').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.screenshot({ path: `${output}/auth-mobile.png`, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.keyboard.press('Escape');
  await page.getByLabel('Tên thư mục').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: Guest API isolation, bookmark reload/search, local settings, import cancel/error/resume/confirm, signup/manual draft, A/logout/B separation, cross-tab logout, mobile auth. Backend API mocked.');
} finally { await browser.close(); }
