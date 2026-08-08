// fetch-logos.mjs
// 미국 대형주 로고를 받아 base64 data URI 로 data/logos.json 에 캐시한다.
// 토요일 카드 ⑧(대형주)의 배지가 모노그램 대신 실제 로고를 쓸 수 있게 하는 것이 목적이다.
//
// 왜 캐시하나 — 두 가지 다 필요하다.
//  ① 로고 CDN(cdn.alphavantage.co)이 브리핑 세션의 egress 정책에서 막힌다(HTTP 000).
//     러너는 그 밖에 있어 통과한다 — econ-calendar·krx-flows·sat-indexes 와 같은 패턴이다.
//  ② 렌더러는 Playwright 로 로컬 HTML 을 그린다. 원격 이미지를 걸면 렌더 시점에 네트워크를
//     타야 하고, 그때 막히면 **배지가 빈칸으로 나간 걸 아무도 모른다.** data URI 로 박아 두면
//     렌더는 네트워크와 완전히 무관해진다.
//
// URL 규칙은 Alpha Vantage COMPANY_LOGO 가 알려주는 그대로다(실측):
//   https://cdn.alphavantage.co/logos/<TICKER>.svg  /  .png
// CDN 자체는 키가 필요 없다.
//
// 사용법:
//   node scripts/fetch-logos.mjs                    # 기본 목록 전체
//   node scripts/fetch-logos.mjs NVDA PLTR UNH      # 지정한 티커만
//   MERGE=data/logos.json node scripts/fetch-logos.mjs NVDA   # 기존 캐시에 얹기
//
// 출력: data/logos.json 형태의 JSON 을 stdout 으로.
//   { fetchedAt, logos: { NVDA: { fmt, bytes, dataUri }, ... }, missing: [...] }

import fs from 'node:fs';

const CDN = 'https://cdn.alphavantage.co/logos';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_BYTES = 120 * 1024;   // 카드 하나에 여러 개가 박히므로 큰 파일은 거른다

// 카드 ⑧에 올라올 수 있는 미국 대형주. 넉넉히 캐시해 두면 그 주에 무엇이 뽑혀도 덮인다.
// 로고는 거의 안 바뀌므로 주 1회 갱신으로 충분하다.
const DEFAULT = [
  // 메가캡
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','AVGO','TSLA','BRK-B','LLY',
  'JPM','V','MA','XOM','UNH','ORCL','COST','WMT','PG','JNJ',
  'HD','ABBV','NFLX','BAC','CRM','KO','CVX','AMD','PEP','TMO',
  // 반도체·AI (이 계정의 축)
  'TSM','ASML','MU','QCOM','TXN','INTC','ARM','SNDK','WDC','SMCI',
  'PLTR','SNOW','DELL','HPE','MRVL','ADI','KLAC','LRCX','AMAT','NOW',
  // 그 밖에 주간 등락 상·하위에 자주 오르는 대형주
  'DIS','SHOP','ROKU','ETSY','UBER','ABNB','COIN','MSTR','PFE','MRK',
  'CAT','BA','GE','RTX','LIN','HON','SBUX','NKE','MCD','T',
];

const tickers = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

const MIME = { svg: 'image/svg+xml', png: 'image/png' };

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 1200 * 2 ** (attempt - 1)));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch { /* 다음 시도 */ }
  }
  return null;
}

// svg 를 먼저 본다 — 벡터라 배지 크기와 무관하게 선명하고 대체로 png 보다 작다.
async function fetchLogo(ticker) {
  for (const fmt of ['svg', 'png']) {
    const buf = await get(`${CDN}/${encodeURIComponent(ticker)}.${fmt}`);
    if (!buf || !buf.length) continue;
    // 404 를 HTML 로 주는 CDN 이 흔하다. 매직 바이트로 실제 이미지인지 확인한다.
    const head = buf.subarray(0, 200).toString('latin1');
    if (fmt === 'svg' && !/<svg[\s>]/i.test(head)) continue;
    if (fmt === 'png' && buf.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') continue;
    if (buf.length > MAX_BYTES) continue;
    return { fmt, bytes: buf.length, dataUri: `data:${MIME[fmt]};base64,${buf.toString('base64')}` };
  }
  return null;
}

const logos = {};
if (process.env.MERGE && fs.existsSync(process.env.MERGE)) {
  Object.assign(logos, JSON.parse(fs.readFileSync(process.env.MERGE, 'utf8')).logos || {});
}

const missing = [];
for (const t of tickers) {                 // 순차 — 동시 요청은 CDN 쪽 차단을 부른다
  const got = await fetchLogo(t);
  if (got) logos[t] = got; else missing.push(t);
}

const out = {
  fetchedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  source: 'cdn.alphavantage.co/logos — 세션 egress 에서는 막히므로 Actions 러너에서 받는다',
  note: '토요일 카드 ⑧이 movers.*.items[].logo 에 티커를 적으면 이 캐시에서 찾아 배지에 넣는다. 없으면 mono_ko/mono_en 모노그램으로 자동 대체된다.',
  count: Object.keys(logos).length,
  missing,
  logos,
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

const kb = Math.round(JSON.stringify(out).length / 1024);
process.stderr.write(`\n✅ 로고 ${out.count}개 (${kb}KB)`
  + `${missing.length ? ` · 못 받음 ${missing.length}개: ${missing.join(', ')}` : ''}\n`);
// 일부가 없는 것은 실패가 아니다 — 그 종목만 모노그램으로 나간다.
if (out.count === 0) process.exit(1);
