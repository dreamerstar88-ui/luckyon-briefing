// fetch-sat-indexes.mjs
// 토요일 카드 ②③이 쓰는 `indexes[]` 블록을 통째로 만들어 낸다.
// 5개 지수(나스닥·S&P 500·다우·코스피·코스닥)의 일봉 + 이동평균 + 기간 고점 + RSI.
//
// 왜 스크립트로 뽑나: 세션이 MCP 로 5개 × 70봉을 손수 모으면 토큰도 많이 들고 무엇보다
// 틀리기 쉽다. 코스피 종가를 Yahoo `^KS11` 에서 받으면 일봉 마지막 값이 null 로 오는 함정이
// 정확히 이 자리에 있다. 한 번 계산해 커밋해 두면 세션은 읽어서 note 만 쓰면 된다.
//
// 사용법:
//   node scripts/fetch-sat-indexes.mjs                 # 오늘(KST) 기준 최근 거래일
//   node scripts/fetch-sat-indexes.mjs 2026-08-07      # 특정 금요일 기준
//   BARS=70 node scripts/fetch-sat-indexes.mjs         # 카드에 실을 봉 개수(기본 70)
//
// ── 어디서 돌려야 하나 (2026-08-08 실측 — 짐작과 반대였다)
// 한국(ks11·kq11): FinanceDataReader 가 KRX 원천을 GitHub 에 미러링한 연간 CSV.
//   raw.githubusercontent 라 **세션·러너 어디서든** 통과한다. OHLC 가 다 들어 있다.
// 미국(^IXIC·^GSPC·^DJI): Yahoo chart API.
//   **세션에서 된다 (5/5, 두 번 연속).** 첫 curl 은 429 를 주지만 아래 get() 의 재시도가
//   뚫는다 — 그래서 curl 한 방으로 판단하면 안 된다.
//   **Actions 러너에서는 안 된다 (0/3).** Yahoo 가 클라우드 IP 를 막는다. 러너에서 돌리면
//   한국 2개만 잡히고 미국은 통째로 비었다 (run 31255278775 실측).
//
// 결론: **이 스크립트는 토요일 세션이 직접 돌리는 것이 1순위다.**
//   sat-indexes 워크플로는 한국 쪽 예비용일 뿐이며, 세션이 그 파일을 미국 지수의
//   근거로 삼아서는 안 된다. 자세한 건 ROUTINE_PROMPT_WEEKEND.md §B2 기법 1.
//
// 출력: data/sat-indexes.json 형태의 JSON 을 stdout 으로.
//   `indexes[]` 는 FORMAT_BRIEFING.md §2-A 스키마와 필드 이름이 같아 그대로 붙여 쓸 수 있다.
//   `note_ko`/`note_en` 은 null 로 남긴다 — 계산된 관찰은 세션이 쓴다.

const KRX_BASE = 'https://raw.githubusercontent.com/FinanceData/fdr_krx_data_cache/refs/heads/master/data';
const YF = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BARS = Number(process.env.BARS || 70);   // 카드에 실을 봉 개수
const argDate = process.argv[2];

const SPEC = [
  { key: 'IXIC', market: 'us', symbol: '^IXIC', name_ko: '나스닥',   name_en: 'Nasdaq' },
  { key: 'GSPC', market: 'us', symbol: '^GSPC', name_ko: 'S&P 500',  name_en: 'S&P 500' },
  { key: 'DJI',  market: 'us', symbol: '^DJI',  name_ko: '다우',     name_en: 'Dow' },
  { key: 'KS11', market: 'kr', symbol: 'ks11',  name_ko: '코스피',   name_en: 'KOSPI' },
  { key: 'KQ11', market: 'kr', symbol: 'kq11',  name_ko: '코스닥',   name_en: 'KOSDAQ' },
];

function kstToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  return kst.toISOString().slice(0, 10);
}

/* ───────── 공통 조회 ───────── */
async function get(url, headers = {}) {
  // 러너에서도 Yahoo 가 간헐적으로 429 를 준다. 지수 하나가 빠지면 카드가 통째로 비므로 재시도한다.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 1500 * 2 ** (attempt - 1)));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) return null;
      return await res.text();
    } catch { /* 다음 시도 */ }
  }
  return null;
}

// 값 안에 쉼표가 든 필드가 있어 따옴표를 인식해야 한다 (fetch-krx.mjs 와 같은 이유).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length)
             .map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}
const num = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/* ───────── 한국: 연간 CSV 두 해를 이어 붙인다 ───────── */
// MA200 을 계산하려면 200거래일이 필요하고 한 해는 245일쯤이다. 연초 기준일이면
// 올해 파일만으로는 모자라므로 전년도까지 받아 이어 붙인다.
async function fetchKr(spec, asOf) {
  const year = Number(asOf.slice(0, 4));
  const parts = [];
  for (const y of [year - 1, year]) {
    const text = await get(`${KRX_BASE}/index/year_${spec.symbol}/${y}.csv`);
    if (text) parts.push(...parseCsv(text));
  }
  const bars = parts
    .map(r => ({ date: r.Date, o: num(r.Open), h: num(r.High), l: num(r.Low), c: num(r.Close) }))
    .filter(b => b.date && b.o !== null && b.h !== null && b.l !== null && b.c !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(b => b.date <= asOf);
  return bars.length ? bars : null;
}

/* ───────── 미국: Yahoo chart API ───────── */
async function fetchUs(spec, asOf) {
  const text = await get(`${YF}/${encodeURIComponent(spec.symbol)}?range=2y&interval=1d`,
                         { Accept: 'application/json' });
  if (!text) return null;
  let j; try { j = JSON.parse(text); } catch { return null; }
  const r = j?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) return null;
  const bars = r.timestamp.map((ts, i) => ({
    // Yahoo 의 일봉 타임스탬프는 거래소 개장 시각이다. 날짜만 쓰므로 UTC 로 잘라도 안전하다.
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i],
  })).filter(b => [b.o, b.h, b.l, b.c].every(v => typeof v === 'number' && Number.isFinite(v)))
     .filter(b => b.date <= asOf);
  return bars.length ? bars : null;
}

/* ───────── 지표 계산 ───────── */
const sma = (arr, n) => (arr.length < n ? null
  : +(arr.slice(-n).reduce((a, b) => a + b, 0) / n).toFixed(2));

// Wilder RSI(14). 렌더러가 ohlc 로 다시 계산하므로 여기 값은 대조용이다 —
// 둘이 다르면 ohlc 를 잘라 붙이는 과정에서 뭔가 틀어진 것이다.
function rsi(closes, n = 14) {
  if (closes.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; d >= 0 ? g += d : l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (n - 1) + (d > 0 ? d : 0)) / n;
    l = (l * (n - 1) + (d < 0 ? -d : 0)) / n;
  }
  return l === 0 ? 100 : +(100 - 100 / (1 + g / l)).toFixed(1);
}

// 주간 등락률 = 기준주 마지막 종가 ÷ 직전주 마지막 종가.
// period:"5d" 식으로 '최근 5거래일'을 쓰면 휴장이 낀 주에 기준일이 밀린다 —
// 주(week) 로 묶어서 마지막 종가를 비교하는 것이 휴장에 흔들리지 않는다.
function weeklyChange(bars) {
  const weekKey = d => {           // ISO 주 번호
    const t = new Date(`${d}T00:00:00Z`);
    const day = (t.getUTCDay() + 6) % 7;                 // 월=0
    t.setUTCDate(t.getUTCDate() - day + 3);              // 그 주 목요일
    const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const fday = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
    return `${t.getUTCFullYear()}-${String(1 + Math.round((t - firstThu) / 604800000)).padStart(2, '0')}`;
  };
  const lastOfWeek = new Map();
  for (const b of bars) lastOfWeek.set(weekKey(b.date), b.c);
  const keys = [...lastOfWeek.keys()];
  if (keys.length < 2) return null;
  const cur = lastOfWeek.get(keys[keys.length - 1]);
  const prev = lastOfWeek.get(keys[keys.length - 2]);
  return prev ? +((cur / prev - 1) * 100).toFixed(2) : null;
}

function build(spec, bars) {
  const closes = bars.map(b => b.c);
  const close = +closes[closes.length - 1].toFixed(2);
  const win = n => bars.slice(-n);

  const hi52 = +Math.max(...win(252).map(b => b.h)).toFixed(2);
  const hi60 = +Math.max(...win(60).map(b => b.h)).toFixed(2);
  // 렌더러는 고점선이 캔들 범위에서 25% 넘게 벗어나면 선을 안 긋는다. 52주 고점이
  // 그만큼 멀면 어차피 선이 안 나오니, 실제로 그려지는 60일 고점을 대신 내보낸다.
  // 숫자만 남는 것보다 선이 보이는 쪽이 카드에서 더 많은 것을 말해 준다.
  const lo = Math.min(...win(BARS).map(b => b.l));
  const farOff = hi52 > Math.max(...win(BARS).map(b => b.h)) + (Math.max(...win(BARS).map(b => b.h)) - lo) * 0.25;
  const useHi = farOff ? hi60 : hi52;

  return {
    key: spec.key,
    name_ko: spec.name_ko,
    name_en: spec.name_en,
    close,
    wk: weeklyChange(bars),
    hi: useHi,
    hiLabel_ko: farOff ? '60일 고점' : '52주 고점',
    hiLabel_en: farOff ? '60d high' : '52W high',
    ma50: sma(closes, 50),
    ma100: sma(closes, 100),
    ma200: sma(closes, 200),
    note_ko: null,                 // 계산된 관찰은 세션이 쓴다
    note_en: null,
    ohlc: win(BARS).map(b => [b.o, b.h, b.l, b.c].map(v => +v.toFixed(2))),
    _check: {                      // 대조용. 렌더러가 ohlc 로 다시 계산한 값과 맞아야 한다
      bars: bars.length,
      firstBar: bars[0].date,
      lastBar: bars[bars.length - 1].date,
      ma20: sma(closes, 20),
      rsi14_full: rsi(closes),
      rsi14_card: rsi(win(BARS).map(b => b.c)),
      hi52, hi60,
    },
  };
}

/* ───────── 실행 ───────── */
const asOf = argDate || kstToday();
const indexes = [], missing = [];
for (const spec of SPEC) {          // 순차 — 동시 요청은 Yahoo 429 를 부른다
  const bars = spec.market === 'kr' ? await fetchKr(spec, asOf) : await fetchUs(spec, asOf);
  if (!bars || bars.length < 30) { missing.push(spec.key); continue; }
  indexes.push(build(spec, bars));
}

const out = {
  fetchedAt: new Date().toISOString(),
  asOf,
  bars: BARS,
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  source: {
    kr: 'KRX via FinanceDataReader cache (raw.githubusercontent)',
    us: 'Yahoo Finance chart API v8 — 세션에서는 되고 Actions 러너에서는 막힌다(클라우드 IP 차단)',
  },
  missing,
  note: 'indexes[] 는 FORMAT_BRIEFING.md §2-A 스키마와 필드가 같다. note_ko/note_en 은 세션이 채운다. _check 는 대조용이라 콘텐츠 JSON 에 옮기지 않는다.',
  indexes,
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

if (missing.length) {
  process.stderr.write(`\n⚠ 못 받은 지수: ${missing.join(', ')} — 이 지수는 카드에서 빠진다\n`);
  // 일부만 빠진 것은 실패로 보지 않는다. 빈 파일로 덮어써 낡은 데이터까지 잃는 것이 더 나쁘다.
  if (indexes.length === 0) process.exit(1);
}
process.stderr.write(`\n✅ ${indexes.length}/${SPEC.length}개 지수 · 기준 ${asOf} · 봉 ${BARS}개\n`);
for (const x of indexes) {
  process.stderr.write(`   ${x.key.padEnd(5)} ${String(x.close).padStart(10)}  주간 ${String(x.wk).padStart(6)}%  `
    + `RSI ${x._check.rsi14_full}  MA200 ${x.ma200 ?? '—'}  ${x.hiLabel_en} ${x.hi}\n`);
}
