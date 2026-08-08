// probe-krx-browser.mjs
// 코스피·코스닥 지수 PER/PBR 을 **실제 브라우저로** 받아 본다.
//
// 왜 브라우저인가: KRX 정보데이터시스템의 getJsonData.cmd 는 https 로 불러도 `LOGOUT`
// 을 돌려준다. 화면이 JS 로 세션을 트고 그 쿠키로만 데이터를 주는 구조여서, 평문
// fetch 로는 넘을 수 없다. 브라우저는 그 과정을 그냥 통과한다.
//
// 왜 러너인가: 세션에서도 시도했지만 이 환경의 프록시가 HTTPS CONNECT 터널만 받아
// Chromium 이 ERR_CONNECTION_RESET 으로 끊긴다. 러너는 프록시 제약이 없다.
//
// 방법: [12021] PER/PBR/배당수익률 화면을 열고, 화면이 스스로 던지는 XHR 을 가로채
// bld·파라미터·응답을 그대로 기록한다. 우리가 파라미터를 짐작하지 않는 것이 요점이다 —
// 짐작으로 넣었다가 400 을 '차단'으로 오독한 적이 있다.
//
// 출력: 잡은 XHR 목록 + 렌더된 표의 앞부분을 JSON 으로 stdout 에.

import { chromium } from 'playwright';

const SCREENS = [
  { id: 'per-pbr-종목', menuId: 'MDC0201020506' },   // [12021] PER/PBR/배당수익률
  { id: '지수-주가지수', menuId: 'MDC0201010101' },  // 전체지수 시세
];

const browser = await chromium.launch();
const out = { probedAt: new Date().toISOString(), runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local', screens: [] };

for (const s of SCREENS) {
  const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  const xhr = [];
  page.on('response', async r => {
    if (!/getJsonData\.cmd/i.test(r.url())) return;
    let body = ''; try { body = (await r.text()).slice(0, 1200); } catch {}
    xhr.push({ status: r.status(), post: (r.request().postData() || '').slice(0, 500), body });
  });
  const rec = { id: s.id, menuId: s.menuId };
  try {
    await page.goto(`https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=${s.menuId}`,
                    { waitUntil: 'networkidle', timeout: 90000 });
    rec.title = await page.title();
    // 화면이 조회 버튼을 눌러야 데이터를 던지는 경우가 있다.
    for (const sel of ['#jsSearchButton', 'a.btn-sprite.type-00.vmiddle', 'button:has-text("조회")']) {
      const el = await page.$(sel);
      if (el) { await el.click().catch(() => {}); await page.waitForTimeout(4000); break; }
    }
    await page.waitForTimeout(3000);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/[ \t]+/g, ' ');
    rec.hasPER = /PER/.test(text);
    rec.hasPBR = /PBR/.test(text);
    rec.textHead = text.slice(0, 1200);
  } catch (e) { rec.error = String(e.message || e).slice(0, 200); }
  rec.xhr = xhr;
  out.screens.push(rec);
  await ctx.close();
}
await browser.close();
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
for (const s of out.screens) {
  process.stderr.write(`\n${s.id}: ${s.error ? '✗ ' + s.error : `✓ "${s.title}" PER=${s.hasPER} PBR=${s.hasPBR} XHR=${s.xhr.length}`}\n`);
  for (const x of s.xhr) process.stderr.write(`   ${x.status} | ${x.post.slice(0, 150)}\n`);
}
