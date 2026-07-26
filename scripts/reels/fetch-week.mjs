// fetch-week.mjs
// 지난 한 주(월~금) 정규장 30분봉을 모아 '주간 되돌아보기' 릴스용 자료를 만든다.
// 주말에 "이번 주는 이랬고, 다음 주엔 이랬으면" 하는 편에 쓴다.
//
// 사용법:
//   node scripts/reels/fetch-week.mjs                 # 가장 최근에 끝난 주
//   node scripts/reels/fetch-week.mjs --week 2026-07-20  # 그 주(월요일 날짜) 지정
//
// 결과: data/reels/week-<월요일>.json  (+ latest.txt 갱신)

import fs from 'node:fs';
import path from 'node:path';

const SYMBOLS = [
  { key: 'nasdaq', yahoo: 'NQ=F', label_ko: '나스닥 선물', label_en: 'Nasdaq Futures' },
  { key: 'sp500', yahoo: 'ES=F', label_ko: 'S&P 500 선물', label_en: 'S&P 500 Futures' },
];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const weekArg = argOf('--week', null);

const OPEN_MIN = 9 * 60 + 30, CLOSE_MIN = 16 * 60;

function etParts(sec) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(new Date(sec * 1000));
  const g = (t) => f.find((p) => p.type === t)?.value;
  const hh = g('hour') === '24' ? '00' : g('hour');
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    wd: g('weekday'),
    min: Number(hh) * 60 + Number(g('minute')),
  };
}

async function fetchBars(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`
    + `?interval=30m&range=1mo`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${sym}: HTTP ${res.status}`);
  const j = await res.json();
  if (j?.chart?.error) throw new Error(`${sym}: ${JSON.stringify(j.chart.error)}`);
  const r = j.chart.result[0];
  const ts = r.timestamp || [], q = r.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null)) continue;
    const e = etParts(ts[i]);
    // 정규장만 담는다 (야간까지 넣으면 봉이 너무 많고 주간 흐름이 안 보인다)
    if (e.min < OPEN_MIN || e.min >= CLOSE_MIN) continue;
    bars.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0, etDate: e.date, wd: e.wd });
  }
  return bars;
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=일
  const back = (dow + 6) % 7; // 월요일까지 되돌아갈 일수
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const out = { mode: 'week', generatedAt: new Date().toISOString(), symbols: {} };
  let meta = null, stamp = null;

  for (const s of SYMBOLS) {
    const all = await fetchBars(s.yahoo);
    if (!all.length) throw new Error(`${s.yahoo}: 정규장 봉이 없습니다`);

    // 주 선택: 지정이 없으면 데이터에 있는 마지막 거래일이 속한 주
    const lastDate = all[all.length - 1].etDate;
    const mon = weekArg ? mondayOf(weekArg) : mondayOf(lastDate);
    const fri = addDays(mon, 4);

    const week = all.filter((b) => b.etDate >= mon && b.etDate <= fri);
    if (week.length < 10) {
      throw new Error(
        `${s.yahoo}: ${mon}~${fri} 구간 봉이 ${week.length}개뿐입니다.\n`
        + `   데이터의 마지막 거래일은 ${lastDate} 입니다. --week 로 다른 주를 지정해 보세요.`
      );
    }

    const days = [...new Set(week.map((b) => b.etDate))];
    const openPx = week[0].o;
    const lastPx = week[week.length - 1].c;
    const hi = Math.max(...week.map((b) => b.h));
    const lo = Math.min(...week.map((b) => b.l));

    // 일별 종가로 요일별 등락을 뽑는다 (문구 재료)
    const daily = days.map((d) => {
      const db = week.filter((b) => b.etDate === d);
      return {
        date: d, wd: db[0].wd,
        open: db[0].o, close: db[db.length - 1].c,
        pct: Number((((db[db.length - 1].c - db[0].o) / db[0].o) * 100).toFixed(2)),
      };
    });

    if (!meta) {
      meta = { weekStart: mon, weekEnd: fri, days: days.length, tradingDays: days };
      stamp = `week-${mon}`;
    }

    out.symbols[s.key] = {
      label_ko: s.label_ko, label_en: s.label_en, yahoo: s.yahoo,
      prevClose: null,          // 주간 차트에선 '어제 종가' 개념을 쓰지 않는다
      overnight: null,
      bars: week.map(({ t, o, h, l, c, v }) => ({ t, o, h, l, c, v })),
      daily,
      stats: {
        open: openPx, last: lastPx, high: hi, low: lo,
        pctFromOpen: Number((((lastPx - openPx) / openPx) * 100).toFixed(2)),
        posInRange: Number(((lastPx - lo) / (hi - lo || 1)).toFixed(2)),
        dir: lastPx > openPx ? 'up' : lastPx < openPx ? 'down' : 'flat',
        upDays: daily.filter((d) => d.pct > 0).length,
        downDays: daily.filter((d) => d.pct < 0).length,
        worstDay: daily.reduce((a, b) => (b.pct < a.pct ? b : a), daily[0]),
        bestDay: daily.reduce((a, b) => (b.pct > a.pct ? b : a), daily[0]),
      },
    };
    const st = out.symbols[s.key].stats;
    console.log(`· ${s.yahoo}: ${week.length}봉 / ${days.length}일, 주간 ${st.pctFromOpen > 0 ? '+' : ''}${st.pctFromOpen}%`
      + ` (상승 ${st.upDays}일 · 하락 ${st.downDays}일)`);
  }

  Object.assign(out, meta, { stamp });
  const dir = path.join(process.cwd(), 'data', 'reels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(dir, 'latest.txt'), stamp);

  console.log(`\n  주간: ${meta.weekStart} ~ ${meta.weekEnd} (${meta.days}거래일)`);
  console.log(`✅ data/reels/${stamp}.json`);
  console.log(`   다음: node scripts/reels/render-reel.mjs ${stamp}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
