// probe-naver-browser.mjs
// 코스피/코스닥 지수 페이지·업종(섹터) 페이지를 **실제 브라우저**로 열어 진짜 API 를 찾는다.
//
// 배경 (2026-09-21 pm): finance.naver.com/sise/sise_index.naver · sise_group.naver 를
// 평문 fetch 로 받으면 200 은 오지만(러너의 깨끗한 IP 에서도) 표가 0개다 — 네이버가 이
// 화면을 클라이언트 렌더링(SPA, stock.naver.com)으로 옮겼고, 화면이 로드된 뒤 JS 가
// 던지는 API 호출로만 데이터가 채워지는 구조로 보인다. 그 API 경로를 짐작으로 맞히려던
// 시도(m.stock.naver.com/api/index/KOSPI/investors 등)는 전부 404 였다 — 짐작이 아니라
// 브라우저가 실제로 무엇을 부르는지 직접 봐야 한다(probe-krx-browser.mjs 와 같은 이유).
//
// 세션에서는 프록시가 stock.naver.com CONNECT 자체를 막아 Chromium 이 못 뜬다.
// 러너는 이 제약이 없다.
//
// 방법: 지수 페이지·업종 페이지를 열고 30초 정도 기다리며 모든 XHR/fetch 응답을
// 가로챈다. JSON 처럼 보이는 응답만 남기고, URL·상태코드·본문 앞부분을 그대로 기록한다.
// 파라미터를 짐작하지 않는 게 요점이므로 필터링을 최소화한다(호스트 제한 없음).
//
// 출력: 잡은 XHR 목록 + 렌더된 표의 앞부분을 JSON 으로 stdout 에.

import { chromium } from 'playwright';

const PAGES = [
  { id: 'kospi-index', url: 'https://stock.naver.com/domestic/index/KOSPI/price' },
  { id: 'kosdaq-index', url: 'https://stock.naver.com/domestic/index/KOSDAQ/price' },
  { id: 'sector-industry', url: 'https://stock.naver.com/market/stock/kr/industry' },
  { id: 'kospi-home', url: 'https://stock.naver.com/domestic/index/KOSPI' },
];

const browser = await chromium.launch();
const out = { probedAt: new Date().toISOString(), runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local', pages: [] };

for (const p of PAGES) {
  const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  const xhr = [];
  page.on('response', async r => {
    const ct = r.headers()['content-type'] || '';
    const url = r.url();
    // finance.naver.com/stock.naver.com 자체 페이지 문서 응답은 뺀다 — API 응답만 본다.
    if (r.request().resourceType() === 'document') return;
    const looksJson = /json/i.test(ct) || /\/api\/|api\.stock\.naver\.com|api\.finance\.naver\.com/.test(url);
    if (!looksJson) return;
    let body = ''; try { body = (await r.text()).slice(0, 1500); } catch {}
    if (!body) return;
    xhr.push({ status: r.status(), url: url.slice(0, 300), contentType: ct, body });
  });
  const rec = { id: p.id, url: p.url };
  try {
    await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    rec.title = await page.title();
    const text = (await page.evaluate(() => document.body.innerText)).replace(/[ \t]+/g, ' ');
    rec.hasUpDownCounts = /상승.{0,15}종목|보합.{0,15}종목|하락.{0,15}종목/.test(text);
    rec.textHead = text.slice(0, 1500);
  } catch (e) { rec.error = String(e.message || e).slice(0, 300); }
  // 중복(같은 url·body 반복 폴링)을 줄인다.
  const seen = new Set();
  rec.xhr = xhr.filter(x => {
    const k = x.url + '|' + x.body.slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  out.pages.push(rec);
  await ctx.close();
}
await browser.close();
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
for (const p of out.pages) {
  process.stderr.write(`\n${p.id}: ${p.error ? '✗ ' + p.error : `✓ "${p.title}" 등락수문구=${p.hasUpDownCounts} XHR=${p.xhr.length}건`}\n`);
  for (const x of p.xhr) process.stderr.write(`   ${x.status} ${x.url}\n     ${x.body.slice(0, 200)}\n`);
}
