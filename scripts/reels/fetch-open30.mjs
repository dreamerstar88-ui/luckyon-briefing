// 미국 정규장 개장 후 30분 구간의 지수선물 1분봉을 수집한다.
// 발행 시각(23:00 KST = 14:00 UTC = 10:00 ET)에 실행되는 릴스 루틴용.
//
// 사용법:
//   node scripts/reels/fetch-open30.mjs [YYYY-MM-DD]
// 날짜를 주지 않으면 가장 최근 정규장 세션을 자동으로 고른다.
// 결과는 data/reels/<DATE>-open30.json 으로 저장한다.

import fs from 'node:fs';
import path from 'node:path';

const SYMBOLS = [
  { key: 'nasdaq', yahoo: 'NQ=F', label_ko: '나스닥 선물', label_en: 'Nasdaq Futures' },
  { key: 'sp500', yahoo: 'ES=F', label_ko: 'S&P 500 선물', label_en: 'S&P 500 Futures' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';

async function fetchChart(yahooSymbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?interval=1m&range=5d&includePrePost=true`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${yahooSymbol}: HTTP ${res.status}`);
  const json = await res.json();
  const err = json?.chart?.error;
  if (err) throw new Error(`${yahooSymbol}: ${JSON.stringify(err)}`);
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`${yahooSymbol}: 결과 없음`);
  return r;
}

// 미 동부시간 기준 그 날짜의 9:30 ET(=정규장 개장) UTC epoch 초를 구한다.
// 서머타임 여부는 Intl 로 판정한다 (11월초~3월초는 EST = UTC-5, 그 외 EDT = UTC-4).
function etOffsetHours(dateUtcMs) {
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
    .formatToParts(new Date(dateUtcMs))
    .find((p) => p.type === 'timeZoneName')?.value;
  return tzName === 'EST' ? 5 : 4;
}

// epoch(초) → 미 동부시간 "YYYY-MM-DD" 및 분 단위 시각
function toEtParts(epochSec) {
  const d = new Date(epochSec * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => fmt.find((p) => p.type === t)?.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
  };
}

const OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const CUTOFF_MIN = 10 * 60; // 10:00 ET = 23:00 KST (발행 시점)

function extractBars(result) {
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null)) continue;
    const et = toEtParts(ts[i]);
    bars.push({ t: ts[i], etDate: et.date, etMin: et.minutes, o, h, l, c, v: q.volume?.[i] ?? 0 });
  }
  return bars;
}

function pickSession(bars, wantedDate) {
  // 정규장 개장(09:30 ET) 봉이 존재하는 날짜들만 후보로 삼는다.
  const sessions = [...new Set(bars.filter((b) => b.etMin >= OPEN_MIN).map((b) => b.etDate))].sort();
  if (!sessions.length) throw new Error('정규장 데이터가 있는 세션을 찾지 못함');
  if (wantedDate) {
    if (!sessions.includes(wantedDate)) {
      throw new Error(`${wantedDate} 세션 데이터 없음 (가능: ${sessions.join(', ')})`);
    }
    return wantedDate;
  }
  return sessions[sessions.length - 1];
}

function summarize(bars, prevClose) {
  const open = bars[0].o;
  const last = bars[bars.length - 1].c;
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));
  const volume = bars.reduce((s, b) => s + (b.v || 0), 0);
  // 시가 대비 / 전일 종가 대비 두 가지를 모두 낸다.
  const pctFromOpen = ((last - open) / open) * 100;
  const pctFromPrev = prevClose ? ((last - prevClose) / prevClose) * 100 : null;
  // 30분 구간 안에서 되돌림이 있었는지 (고점 대비 현재 위치, 0~1)
  const range = high - low;
  const posInRange = range > 0 ? (last - low) / range : 0.5;
  return {
    open, last, high, low, volume,
    pctFromOpen: Number(pctFromOpen.toFixed(2)),
    pctFromPrev: pctFromPrev == null ? null : Number(pctFromPrev.toFixed(2)),
    posInRange: Number(posInRange.toFixed(2)),
    dir: last > open ? 'up' : last < open ? 'down' : 'flat',
  };
}

async function main() {
  const wantedDate = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2])
    ? process.argv[2]
    : null;

  const out = { generatedAt: new Date().toISOString(), session: null, symbols: {} };
  let sessionDate = wantedDate;

  for (const sym of SYMBOLS) {
    const result = await fetchChart(sym.yahoo);
    const all = extractBars(result);
    if (!sessionDate) sessionDate = pickSession(all, null);

    const dayBars = all.filter((b) => b.etDate === sessionDate);
    const regular = dayBars.filter((b) => b.etMin >= OPEN_MIN && b.etMin < CUTOFF_MIN);
    if (!regular.length) throw new Error(`${sym.yahoo}: ${sessionDate} 개장 30분 봉이 비어 있음`);

    // 개장 직전 프리마켓 15분을 문맥용으로 함께 담는다 (차트 왼쪽에 흐리게 표시).
    const pre = dayBars.filter((b) => b.etMin >= OPEN_MIN - 15 && b.etMin < OPEN_MIN);
    const prevClose = result.meta?.chartPreviousClose ?? null;

    out.symbols[sym.key] = {
      label_ko: sym.label_ko,
      label_en: sym.label_en,
      yahoo: sym.yahoo,
      prevClose,
      pre: pre.map(({ t, o, h, l, c, v }) => ({ t, o, h, l, c, v })),
      bars: regular.map(({ t, o, h, l, c, v }) => ({ t, o, h, l, c, v })),
      stats: summarize(regular, prevClose),
    };
    console.log(
      `· ${sym.yahoo} ${sessionDate} 개장30분: ${regular.length}봉, ` +
      `시가대비 ${out.symbols[sym.key].stats.pctFromOpen > 0 ? '+' : ''}${out.symbols[sym.key].stats.pctFromOpen}%`
    );
  }

  out.session = sessionDate;
  const dir = path.join(process.cwd(), 'data', 'reels');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionDate}-open30.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n✅ 저장: ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
