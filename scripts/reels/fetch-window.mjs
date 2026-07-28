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
// 기본은 '개장부터 지금까지'. --minutes 를 주면 '지금 기준 최근 N분' 방식으로 바뀐다.
const minutesArg = argOf('--minutes', null);
const MINUTES = minutesArg == null ? null : Number(minutesArg);
const STALE_OK = argv.includes('--stale-ok');
const endArg = argOf('--end', null);
const endMs = endArg ? Date.parse(endArg) : Date.now();
if (Number.isNaN(endMs)) { console.error(`--end 를 해석할 수 없음: ${endArg}`); process.exit(1); }
if (MINUTES != null && !(MINUTES > 0)) { console.error('--minutes 는 양수여야 합니다'); process.exit(1); }

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
  return { bars, metaPrevClose: r.meta?.chartPreviousClose ?? null };
}

// 전일 종가는 meta.chartPreviousClose 를 쓰지 않고 봉 데이터에서 직접 구한다.
// meta 값은 조회 시점 기준이라 --end 로 과거를 조회하면 엉뚱한 날 종가가 오고,
// 그러면 갭이 잘못 계산돼 손글씨 문구 선택까지 틀어진다.
function prevCloseFromBars(bars, windowStartSec) {
  const startEt = etParts(windowStartSec);
  // 창이 시작된 날 이전의 거래일들
  const prior = bars.filter((b) => {
    const e = etParts(b.t);
    return e.date < startEt.date && e.min <= CLOSE_MIN;
  });
  if (!prior.length) return null;
  const lastDate = etParts(prior[prior.length - 1].t).date;
  // 그 날의 정규장 마지막 봉 종가
  const sameDay = prior.filter((b) => etParts(b.t).date === lastDate);
  return sameDay[sameDay.length - 1].c;
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
  const endEt = etParts(endSec);
  const out = { generatedAt: new Date(endMs).toISOString(), symbols: {} };
  let stamp = null, meta = null;

  // 개장 기준 모드에서는 그날 09:30 ET 부터 지금까지를 담는다.
  if (MINUTES == null && endEt.min < OPEN_MIN) {
    throw new Error(
      `아직 정규장 개장(09:30 ET) 전입니다. 현재 ${endEt.hh}:${endEt.mm} ET.\n`
      + `   개장 전 구간으로 만들려면 --minutes 30 처럼 롤링 방식을 쓰세요.`
    );
  }

  for (const s of SYMBOLS) {
    const { bars, metaPrevClose } = await fetchBars(s.yahoo);
    if (!bars.length) throw new Error(`${s.yahoo}: 봉 데이터가 비어 있음`);

    // 창의 시작점
    let startSec;
    if (MINUTES != null) {
      startSec = endSec - MINUTES * 60;
    } else {
      // 그날 09:30 ET 직전 (개장봉을 포함시키려 1초 뺀다)
      const openBar = bars.find((b) => {
        const e = etParts(b.t);
        return e.date === endEt.date && e.min >= OPEN_MIN;
      });
      if (!openBar) {
        throw new Error(`${s.yahoo}: ${endEt.date} 정규장 봉을 찾지 못했습니다 (휴장?).`);
      }
      startSec = openBar.t - 1;
    }

    const win = bars.filter((b) => b.t > startSec && b.t <= endSec);
    if (win.length < 5) {
      const newest = etParts(bars[bars.length - 1].t);
      throw new Error(
        `${s.yahoo}: 대상 구간의 봉이 ${win.length}개뿐입니다.\n`
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
        minutesIn: b.min - a.min,
        lagMinutes: Number(lagMin.toFixed(1)),
      };
    }

    // ---- 개장 전 문맥 ----
    // 30분 창만 보면 "밤사이 크게 빠진 뒤의 소폭 반등"을 그냥 상승으로 읽게 된다.
    // 프리장(04:00 ET~개장)과 전일 종가를 함께 담아 문구가 현실과 어긋나지 않게 한다.
    const pre = bars.filter((b) => {
      const e = etParts(b.t);
      return e.date === endEt.date && e.min >= 4 * 60 && e.min < OPEN_MIN && b.t < win[0].t;
    });
    const prevClose = prevCloseFromBars(bars, win[0].t) ?? metaPrevClose;
    const sessionOpen = win[0].o;
    const nowPx = win[win.length - 1].c;
    const overnight = prevClose ? {
      // 전일 종가 대비 시가 = 갭
      gapPct: Number((((sessionOpen - prevClose) / prevClose) * 100).toFixed(2)),
      // 지금이 전일 종가 위인지 아래인지 — 하루 전체의 위치감
      nowVsPrevPct: Number((((nowPx - prevClose) / prevClose) * 100).toFixed(2)),
      preBars: pre.length,
      preRangePct: pre.length
        ? Number((((Math.max(...pre.map((b) => b.h)) - Math.min(...pre.map((b) => b.l))) / prevClose) * 100).toFixed(2))
        : null,
      preDirPct: pre.length
        ? Number((((pre[pre.length - 1].c - pre[0].o) / pre[0].o) * 100).toFixed(2))
        : null,
    } : null;

    out.symbols[s.key] = {
      label_ko: s.label_ko, label_en: s.label_en, yahoo: s.yahoo,
      prevClose,
      overnight,
      pre: pre.map(({ t, o, h, l, c, v }) => ({ t, o, h, l, c, v })),
      bars: win,
      stats: summarize(win),
    };
    const st = out.symbols[s.key].stats;
    console.log(
      `· ${s.yahoo}: ${win.length}봉, 창 대비 ${st.pctFromOpen > 0 ? '+' : ''}${st.pctFromOpen}%`
      + (overnight ? ` | 갭 ${overnight.gapPct > 0 ? '+' : ''}${overnight.gapPct}%`
        + ` · 전일比 ${overnight.nowVsPrevPct > 0 ? '+' : ''}${overnight.nowVsPrevPct}%`
        + ` · 프리장 ${overnight.preBars}봉` : '')
    );
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
