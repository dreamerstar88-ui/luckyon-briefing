// fetch-krx.mjs
// 한국 증시의 하루치 기록을 한 번에 뽑아 JSON 으로 출력한다.
// ROUTINE_PROMPT.md 3-b 의 pm 섹션(코스피·코스닥 기록 / 종목 기록)이 이 출력을 쓴다.
//
// 사용법:
//   node scripts/fetch-krx.mjs              # 오늘(KST) 기준
//   node scripts/fetch-krx.mjs 2026-08-03   # 특정 거래일
//
// 데이터 출처: FinanceDataReader 가 KRX 원천 데이터를 GitHub 에 미러링해 둔 CSV.
//   https://github.com/FinanceData/fdr_krx_data_cache
// KRX 정보데이터시스템(data.krx.co.kr)·네이버 금융은 이 실행 환경의 egress 정책에서
// 차단되므로 직접 조회할 수 없다. 이 미러는 raw.githubusercontent.com 이라 통과한다.
//
// 주의: 전종목 스냅샷(listing)은 2026-03-11 이후만 존재한다. 그 이전 날짜를 넣으면
// 지수만 나오고 종목 집계는 비어 있게 된다.
//
// 한계: **투자자별 매매동향(외국인/기관/개인 순매수)은 이 소스에 없다.** 어떤 경로로도
// 이 환경에서는 조회되지 않으므로, 카드에 수급을 쓰려면 별도 조치가 필요하다
// (ROUTINE_PROMPT.md 3-a 의 '한국 수급' 항목 참고).

const BASE = 'https://raw.githubusercontent.com/FinanceData/fdr_krx_data_cache/refs/heads/master/data';

const INDEXES = [
  { key: 'ks11', label: 'KOSPI', market: 'KOSPI' },
  { key: 'kq11', label: 'KOSDAQ', market: 'KOSDAQ' },
];

function kstToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  return kst.toISOString().slice(0, 10);
}

async function getCsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'luckyon-briefing' } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim() || text.startsWith('404')) return null;
  return text;
}

// 따옴표를 인식하는 CSV 파서.
// listing/desc 의 Industry 컬럼처럼 값 안에 쉼표가 든 필드가 실제로 있다
// (예: "측정, 시험, 항해, 제어 및 기타 정밀기기 제조업; 광학기기 제외").
// 단순히 line.split(',') 하면 그런 행이 통째로 버려져 업종 집계가 조용히 비는데,
// 실제로 그 버그를 겪었다 — 코스피 943종목 중 8개 업종만 잡혔다.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }   // 이스케이프된 따옴표
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];

  const head = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length === head.length)
    .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = v => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

async function fetchIndex(key, date) {
  const text = await getCsv(`${BASE}/index/${key}/${date}.csv`);
  if (!text) return null;
  const r = parseCsv(text)[0];
  if (!r) return null;
  return {
    close: num(r.Close),
    change: num(r.Comp),                       // 전일 대비 포인트
    changePct: num(r.Change) === null ? null : num(r.Change) * 100,
    open: num(r.Open), high: num(r.High), low: num(r.Low),
    volume: num(r.Volume),                     // 주
    amount: num(r.Amount),                     // 원
  };
}

function summarizeMarket(rows) {
  const clean = rows
    .map(r => ({
      code: r.Code, name: r.Name,
      close: num(r.Close), changes: num(r.Changes),
      pct: num(r.ChagesRatio),                 // 원본 컬럼명 오타(ChagesRatio)를 그대로 따른다
      amount: num(r.Amount), marcap: num(r.Marcap),
    }))
    .filter(r => r.close !== null && r.pct !== null);

  const up = clean.filter(r => r.changes > 0).length;
  const down = clean.filter(r => r.changes < 0).length;
  const flat = clean.filter(r => r.changes === 0).length;

  const byPct = [...clean].sort((a, b) => b.pct - a.pct);
  const byAmount = [...clean].filter(r => r.amount !== null).sort((a, b) => b.amount - a.amount);

  const slim = r => ({ code: r.code, name: r.name, close: r.close, pct: r.pct, amount: r.amount });
  return {
    counts: { up, down, flat, total: clean.length },
    topGainers: byPct.slice(0, 5).map(slim),
    topLosers: byPct.slice(-5).reverse().map(slim),
    topAmount: byAmount.slice(0, 5).map(slim),
  };
}

// 연간 지수 파일(1995~)로 그날 하루만 봐서는 안 보이는 기록을 계산한다.
// ROUTINE_PROMPT.md 3-b 의 '예비 지표'가 이 값들을 쓴다.
async function fetchIndexExtras(key, date) {
  const year = date.slice(0, 4);
  const text = await getCsv(`${BASE}/index/year_${key}/${year}.csv`);
  if (!text) return null;
  const rows = parseCsv(text)
    .map(r => ({ date: r.Date, close: num(r.Close), pct: num(r.Change), amount: num(r.Amount) }))
    .filter(r => r.date && r.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const i = rows.findIndex(r => r.date === date);
  if (i < 0) return null;
  const upto = rows.slice(0, i + 1);
  const today = upto[i];

  // 연속 상승/하락 일수 (당일 방향 기준)
  let streak = 0;
  const dir = Math.sign(today.pct ?? 0);
  if (dir !== 0) {
    for (let j = i; j >= 0 && Math.sign(rows[j].pct ?? 0) === dir; j--) streak++;
  }

  const since = (n) => {
    const w = upto.slice(-n);
    return w.length < 2 ? null : {
      days: w.length,
      high: Math.max(...w.map(r => r.close)),
      low: Math.min(...w.map(r => r.close)),
      isHigh: today.close >= Math.max(...w.map(r => r.close)),
      isLow: today.close <= Math.min(...w.map(r => r.close)),
    };
  };

  // 주간 누적: 직전 주말(일요일) 이후 첫 거래일부터
  const d = new Date(date + 'T00:00:00Z');
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);
  const weekRows = upto.filter(r => r.date >= mondayStr);
  const monthRows = upto.filter(r => r.date.slice(0, 7) === date.slice(0, 7));

  const cum = (list) => {
    if (list.length < 1) return null;
    const prevIdx = rows.findIndex(r => r.date === list[0].date) - 1;
    if (prevIdx < 0) return null;
    const base = rows[prevIdx].close;
    return { days: list.length, pct: ((today.close - base) / base) * 100 };
  };

  return {
    streakDays: streak,
    streakDir: dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat',
    weekToDate: cum(weekRows),
    monthToDate: cum(monthRows),
    range20d: since(20),
    range60d: since(60),
    ytdSessions: upto.length,
  };
}

// 거래대금이 소수 종목에 얼마나 몰렸는지 — "대형주만 움직인 날"을 잡아낸다.
function concentration(rows, total) {
  if (!total) return null;
  const sorted = [...rows].filter(r => r.amount !== null).sort((a, b) => b.amount - a.amount);
  const share = n => sorted.slice(0, n).reduce((s, r) => s + r.amount, 0) / total * 100;
  return { top2Pct: share(2), top5Pct: share(5), top10Pct: share(10) };
}

// 업종별 등락 — 지수는 빠졌는데 대부분 업종은 올랐는지 같은 어긋남을 본다.
async function fetchIndustry(date, listingRows) {
  const text = await getCsv(`${BASE}/listing/desc/${date}.csv`);
  if (!text) return null;
  const industryOf = new Map(parseCsv(text).map(r => [r.Code, r.Industry]));
  const buckets = new Map();
  for (const r of listingRows) {
    const ind = industryOf.get(r.Code);
    const pct = num(r.ChagesRatio);
    if (!ind || pct === null) continue;
    if (!buckets.has(ind)) buckets.set(ind, []);
    buckets.get(ind).push(pct);
  }
  const list = [...buckets.entries()]
    .filter(([, v]) => v.length >= 5)            // 종목이 너무 적은 업종은 대표성이 없다
    .map(([name, v]) => ({ name, count: v.length, avgPct: v.reduce((s, x) => s + x, 0) / v.length }))
    .sort((a, b) => b.avgPct - a.avgPct);
  return { up: list.filter(x => x.avgPct > 0).length, down: list.filter(x => x.avgPct < 0).length,
    top: list.slice(0, 5), bottom: list.slice(-5).reverse() };
}

async function main() {
  const date = process.argv[2] || kstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('❌ 날짜는 YYYY-MM-DD 형식이어야 합니다.');
    process.exit(1);
  }

  const out = { date, source: 'KRX (FinanceDataReader cache)', indexes: {}, markets: {} };

  for (const { key, label } of INDEXES) {
    const idx = await fetchIndex(key, date);
    if (!idx) continue;
    out.indexes[label] = idx;
    const extras = await fetchIndexExtras(key, date);
    if (extras) out.indexes[label].records = extras;
  }

  const listingText = await getCsv(`${BASE}/listing/krx/${date}.csv`);
  if (listingText) {
    const rows = parseCsv(listingText);
    for (const { label, market } of INDEXES) {
      const sub = rows.filter(r => r.Market === market);
      if (!sub.length) continue;
      out.markets[label] = summarizeMarket(sub);
      out.markets[label].concentration = concentration(
        sub.map(r => ({ amount: num(r.Amount) })), out.indexes[label]?.amount);
    }
    const industry = await fetchIndustry(date, rows.filter(r => r.Market === 'KOSPI'));
    if (industry) out.industry = industry;
  }

  if (!Object.keys(out.indexes).length) {
    console.error(`⏭  ${date} 지수 데이터 없음 — 휴장일이거나 아직 수집 전입니다. 브리핑은 중단하지 말고 다른 항목으로 진행하세요.`);
    process.exit(2);
  }
  if (!listingText) {
    console.error(`⚠️  ${date} 전종목 스냅샷 없음 — 지수만 출력합니다 (스냅샷은 2026-03-11 이후만 존재).`);
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error('❌ 실행 실패:', err.message);
  process.exit(1);
});
