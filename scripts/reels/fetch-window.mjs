// fetch-window.mjs
// "지금 이 순간"을 기준으로 최근 N분간의 지수선물 1분봉을 가져온다.
// 개장 직후든 장 중이든 상관없이, 실행한 시점의 최근 구간을 담는다.
//
// 사용법:
//   node scripts/reels/fetch-window.mjs                          # 지금 기준 최근 30분
//   node scripts/reels/fetch-window.mjs --minutes 45             # 최근 45분
//   node scripts/reels/fetch-window.mjs --end 2026-07-24T14:00Z  # 특정 시점 기준 (테스트용)
//   node scripts/reels/fetch-window.mjs --stale-ok               # 시세가 오래돼도 진행
//
// 결과: data/reels/<ET날짜>-<ET시각>.json   예) data/reels/2026-07-24-1000.json
//       마지막 스탬프는 data/reels/latest.txt 에 남긴다.

import fs from 'node:fs';
import path from 'node:path';

const SYMBOLS = [
  { key: 'nasdaq', yahoo: 'NQ=F', label_ko: '나스닥 선물', label_en: 'Nasdaq Futures' },
  { key: 'sp500', yahoo: 'ES=F', label_ko: 'S&P 500 선물', label_en: 'S&P 500 Futures' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const MINUTES = Number(argOf('--minutes', '30'));
const STALE_OK = argv.includes('--stale-ok');
const endArg = argOf('--end', null);
const endMs = endArg ? Date.parse(endArg) : Date.now();
if (Number.isNaN(endMs)) { console.error(`--end 를 해석할 수 없음: ${endArg}`); process.exit(1); }
if (!(MINUTES > 0)) { console.error('--minutes 는 양수여야 합니다'); process.exit(1); }

// ---------- 미 동부시간 helper ----------
function etParts(epochSec) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(epochSec * 1000));
  const g = (t) => f.find((p) => p.type === t)?.value;
  const hh = g('hour') === '24' ? '00' : g('hour');
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    hh, mm: g('minute'),
    min: Number(hh) * 60 + Number(g('minute')),
  };
}
const OPEN_MIN = 9 * 60 + 30;   // 09:30 ET
const CLOSE_MIN = 16 * 60;      // 16:00 ET

function phaseOf(min) {
  if (min >= OPEN_MIN && min < CLOSE_MIN) return 'regular';
  if (min >= 4 * 60 && min < OPEN_MIN) return 'pre';
  if (min >= CLOSE_MIN && min < 20 * 60) return 'after';
  return 'overnight';
}

async function fetchBars(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`
    + `?interval=1m&range=5d&includePrePost=true`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${sym}: HTTP ${res.status}`);
  const j = await res.json();
  if (j?.chart?.error) throw new Error(`${sym}: ${JSON.stringify(j.chart.error)}`);
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`${sym}: 결과 없음`);
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null)) continue;
    bars.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0 });
  }
  return { bars, prevClose: r.meta?.chartPreviousClose ?? null };
}

function summarize(bars) {
  const open = bars[0].o;
  const last = bars[bars.length - 1].c;
  const hi = Math.max(...bars.map((b) => b.h));
  const lo = Math.min(...bars.map((b) => b.l));
  return {
    open, last, high: hi, low: lo,
    volume: bars.reduce((s, b) => s + (b.v || 0), 0),
    pctFromOpen: Number((((last - open) / open) * 100).toFixed(2)),
    posInRange: Number(((last - lo) / (hi - lo || 1)).toFixed(2)),
    dir: last > open ? 'up' : last < open ? 'down' : 'flat',
  };
}

async function main() {
  const endSec = Math.floor(endMs / 1000);
  const startSec = endSec - MINUTES * 60;
  const out = { generatedAt: new Date(endMs).toISOString(), minutes: MINUTES, symbols: {} };
  let stamp = null, meta = null;

  for (const s of SYMBOLS) {
    const { bars, prevClose } = await fetchBars(s.yahoo);
    if (!bars.length) throw new Error(`${s.yahoo}: 봉 데이터가 비어 있음`);

    const win = bars.filter((b) => b.t > startSec && b.t <= endSec);
    if (win.length < 5) {
      const newest = etParts(bars[bars.length - 1].t);
      throw new Error(
        `${s.yahoo}: 최근 ${MINUTES}분 구간의 봉이 ${win.length}개뿐입니다.\n`
        + `   가장 최근 봉은 ${newest.date} ${newest.hh}:${newest.mm} ET.\n`
        + `   (주말·휴장이거나 선물 정비시간 17:00~18:00 ET 일 수 있습니다. `
        + `특정 시점으로 만들려면 --end 를 쓰세요.)`
      );
    }

    // 시세 신선도 — "지금"을 담는 게 목적이라 오래된 값이면 멈춘다
    const lagMin = (endSec - win[win.length - 1].t) / 60;
    if (lagMin > 10 && !STALE_OK && !endArg) {
      throw new Error(
        `${s.yahoo}: 최신 봉이 ${lagMin.toFixed(0)}분 전 것입니다. 지금 장이 열려 있지 않은 듯합니다.\n`
        + `   그래도 진행하려면 --stale-ok 를 붙이세요.`
      );
    }

    if (!meta) {
      const a = etParts(win[0].t);
      const b = etParts(win[win.length - 1].t);
      stamp = `${b.date}-${b.hh}${b.mm}`;
      meta = {
        etDate: b.date,
        startEt: `${a.hh}:${a.mm}`,
        endEt: `${b.hh}:${b.mm}`,
        startMin: a.min,
        endMin: b.min,
        phase: phaseOf(b.min),
        // 창이 정규장 개장에서 시작하면 "개장 직후" 화법을 쓴다
        atOpen: Math.abs(a.min - OPEN_MIN) <= 2,
        lagMinutes: Number(lagMin.toFixed(1)),
      };
    }

    out.symbols[s.key] = {
      label_ko: s.label_ko, label_en: s.label_en, yahoo: s.yahoo,
      prevClose,
      bars: win,
      stats: summarize(win),
    };
    const st = out.symbols[s.key].stats;
    console.log(`· ${s.yahoo}: ${win.length}봉, 창 대비 ${st.pctFromOpen > 0 ? '+' : ''}${st.pctFromOpen}%`);
  }

  Object.assign(out, meta, { stamp });

  const dir = path.join(process.cwd(), 'data', 'reels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(dir, 'latest.txt'), stamp);

  console.log(`\n  구간: ${meta.startEt} → ${meta.endEt} ET (${meta.phase}${meta.atOpen ? ', 개장 직후' : ''})`);
  console.log(`✅ data/reels/${stamp}.json`);
  console.log(`   다음: node scripts/reels/render-reel.mjs ${stamp}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
