// fetch-index-valuation.mjs
// 지수 PER 을 WSJ Market Data 의 «P/E Ratios & Earnings Yields» 표에서 받아온다.
// 토요일 카드 ②의 valuation 블록이 이 출력을 쓴다.
//
// ── 왜 WSJ 한 곳만 쓰나 (2026-08-08 탐침 결론)
// 러너에서 열린 소스 넷의 S&P 500 PER 이 서로 다르다:
//     WSJ 26.02 · multpl.com 29.88 · iShares IVV 30.65
// 셋 다 "as-reported 기준 S&P 500 PER" 이라고 말하는데 최대 18% 벌어진다. 산출에 쓰는
// 이익 계열(Birinyi / S&P 공식 / 보유종목 가중)이 서로 달라서다. 어느 하나를 골라
// "S&P 500 PER 은 X" 라고 쓰면 특정 벤더의 방법론을 사실처럼 내보내는 셈이 된다.
//
// 그래서 **한 소스에서 세 지수를 모두 받아 출처를 함께 표기한다.** 지수 간 비교가
// 같은 방법론 위에서 이뤄지고, 독자에게도 "누구 기준인지"가 보인다.
// EPS 는 내보내지 않는다 — WSJ 표에 없고, 종가 ÷ PER 로 되짚으면 반올림 오차가
// 그대로 '지수 EPS' 처럼 보이게 된다. 있는 것만 쓴다.
//
// 표에서 얻는 것: 현재 PER · 1년 전 PER · 추정 PER · 배당수익률(현재/1년 전).
// **1년 전 PER 이 핵심이다** — 지금이 비싼지 싼지는 절대 수치보다 이 대비로 읽힌다.
//
// ── 어디서 돌리나
// 세션 egress 에서 WSJ 는 403 이다(1단계 탐침 10/10 차단). 러너는 200 으로 통과한다.
// 그래서 이 스크립트는 index-valuation 워크플로가 러너에서 돌려 커밋하는 것을 전제로 한다.
// (fetch-sat-indexes.mjs 와 반대 방향이다 — 그쪽은 Yahoo 가 클라우드 IP 를 막아 세션이 낫다.)
//
// 사용법: node scripts/fetch-index-valuation.mjs
// 출력: data/index-valuation.json 형태의 JSON 을 stdout 으로.

const URL_WSJ = 'https://www.wsj.com/market-data/stocks/peyields';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 표에 있는 이름 → 카드에서 쓰는 이름. 카드 ②의 지수와 맞춘다.
// 나스닥은 카드가 종합지수(IXIC)를 쓰므로 Composite 을 우선하고, 없으면 100 을 쓴다.
const WANT = [
  { key: 'DJI',  rowNames: ['Dow Jones Industrial Average'], name_ko: '다우', name_en: 'Dow' },
  { key: 'GSPC', rowNames: ['S&P 500 Index'],                name_ko: 'S&P 500', name_en: 'S&P 500' },
  { key: 'IXIC', rowNames: ['NASDAQ Composite', 'NASDAQ 100 Index'], name_ko: '나스닥', name_en: 'Nasdaq' },
];

async function get(url) {
  for (let a = 0; a < 4; a++) {
    if (a) await new Promise(r => setTimeout(r, 1500 * 2 ** (a - 1)));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) return { status: res.status };
      return { status: res.status, text: await res.text() };
    } catch { /* 다음 시도 */ }
  }
  return { status: 0 };
}

// 표를 «이름|숫자|숫자|…» 평문으로 편다. 셀 경계를 파이프로 남기는 게 요점이다 —
// 그냥 태그를 지우면 이름과 숫자가 붙어 어디까지가 한 행인지 알 수 없다.
function flatten(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '|')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\|{2,}/g, '|')
    .replace(/[ \t]+/g, ' ');
}

const NUM = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/;

// 이름 바로 뒤에 오는 숫자 5개를 순서대로 집는다.
// 칼럼 순서(실측 헤더): P/E 현재 | P/E 1년 전 | P/E 추정 | 배당 현재 | 배당 1년 전
function rowAfter(flat, rowName) {
  const i = flat.indexOf(rowName);
  if (i < 0) return null;
  const cells = flat.slice(i + rowName.length, i + rowName.length + 400).split('|').map(s => s.trim());
  const nums = [];
  for (const c of cells) {
    if (!c) continue;
    if (NUM.test(c)) { nums.push(Number(c.replace(/,/g, ''))); if (nums.length === 5) break; }
    else if (nums.length) break;   // 숫자가 끊기면 다음 행으로 넘어간 것이다
  }
  return nums.length >= 3 ? nums : null;
}

const res = await get(URL_WSJ);
const out = {
  fetchedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  source: 'WSJ Market Data — P/E Ratios & Earnings Yields',
  sourceUrl: URL_WSJ,
  basis_ko: 'as-reported 이익 기준 · 추정치는 operating 이익 기준 (WSJ 표기)',
  basis_en: 'P/E on as-reported earnings; estimates on operating earnings (per WSJ)',
  caveat_ko: '산출 방법이 기관마다 달라 같은 지수의 PER 도 벤더별로 벌어진다(같은 날 S&P 500: WSJ 26.02 / multpl 29.88 / iShares 30.65). 그래서 세 지수를 한 소스에서 받아 출처를 함께 적는다.',
  status: res.status,
  asOfLabel: null,
  rows: [],
  missing: [],
};

if (res.text) {
  const flat = flatten(res.text);
  // 헤더의 날짜 라벨(예: "8/07/26")을 그대로 가져온다. 우리가 날짜를 짐작하지 않는다.
  const dm = flat.match(/P\/E RATIO\|[^|]*\|?\s*(\d{1,2}\/\d{2}\/\d{2})/);
  out.asOfLabel = dm ? dm[1] : null;

  for (const w of WANT) {
    let hit = null, usedName = null;
    for (const rn of w.rowNames) {
      const nums = rowAfter(flat, rn);
      if (nums) { hit = nums; usedName = rn; break; }
    }
    if (!hit) { out.missing.push(w.key); continue; }
    out.rows.push({
      key: w.key,
      name_ko: w.name_ko,
      name_en: w.name_en,
      wsjRow: usedName,                 // 어느 행에서 왔는지 남긴다 (Composite vs 100 구분)
      per: hit[0],
      perYearAgo: hit[1] ?? null,
      perEstimate: hit[2] ?? null,
      divYield: hit[3] ?? null,
      divYieldYearAgo: hit[4] ?? null,
    });
  }
}

// 한국 지수는 아직 경로가 없다. KRX 정보데이터시스템은 러너에서도 400 을 준다.
// 빈칸으로 두는 것이 원칙이다 — 틀린 숫자보다 빈칸이 낫다.
out.korea_ko = '코스피·코스닥 지수 PER 은 확보 경로가 없다(KRX 정보데이터시스템 400). 빈칸으로 둔다.';

process.stdout.write(JSON.stringify(out, null, 2) + '\n');

if (!out.rows.length) {
  process.stderr.write(`\n✗ 한 행도 못 읽었다 (HTTP ${out.status}) — 표 구조가 바뀌었을 수 있다\n`);
  process.exit(1);
}
process.stderr.write(`\n✅ ${out.rows.length}/3개 지수 · WSJ 기준일 ${out.asOfLabel || '?'}`
  + `${out.missing.length ? ` · 못 읽음 ${out.missing.join(', ')}` : ''}\n`);
for (const r of out.rows) {
  process.stderr.write(`   ${r.key.padEnd(5)} PER ${String(r.per).padStart(6)}  `
    + `1년 전 ${String(r.perYearAgo).padStart(6)}  추정 ${String(r.perEstimate).padStart(6)}  `
    + `배당 ${r.divYield}%   [${r.wsjRow}]\n`);
}
