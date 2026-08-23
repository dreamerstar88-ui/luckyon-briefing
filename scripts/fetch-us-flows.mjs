// fetch-us-flows.mjs
// 미국장의 '돈이 어디로 갔나' 를 한 번에 뽑아 JSON 으로 낸다.
// ROUTINE_PROMPT.md 리서치 B절 am ⑤ (거래대금 상위) 가 이 출력을 쓴다.
//
// 사용법:
//   node scripts/fetch-us-flows.mjs              # 직전 미국 거래일
//   node scripts/fetch-us-flows.mjs 2026-08-21   # 특정 거래일 (공매도 파일이 있는 날만)
//
// 무엇을 주나
//   1) 거래대금 상위 — 가격 × 거래량 으로 계산한다.
//      Alpha Vantage 의 TOP_GAINERS_LOSERS·most_actively_traded 는 **주식 수** 기준이라
//      1위가 $0.87 짜리 동전주로 채워진다. 거래대금과는 다른 지표이므로 쓰지 않는다.
//   2) 종목별 공매도 비중 — FINRA 일별 공매도 거래량 파일.
//   3) 상승/하락 거래대금 — 돈이 오른 종목으로 갔는지 내린 종목으로 갔는지.
//
// 왜 '매수 주체' 가 아니라 이것인가
//   미국은 한국처럼 외국인·기관·개인을 나눈 일별 순매수를 **공표하지 않는다.**
//   거래소도 규제기관도 내지 않는다. 그래서 매일 나오는 대용 지표 두 가지를 쓴다.
//
// 공매도 비중을 읽는 법 (중요)
//   FINRA 공매도 거래량에는 **시장조성자 헤지가 대량 포함**된다. 그래서 어느 날이든
//   전체 합산은 45~50% 에서 움직인다. 절대값은 독자에게 아무 정보가 없다.
//   반드시 **표본 평균과 견주어** 읽는다 — 2026-08-21 에 아마존 27.5% / 월마트 53.9% 처럼
//   같은 날 종목 사이의 차이가 의미다.
//   또 FINRA 집계는 전체 시장 거래량이 아니다. 그날 NVDA 는 FINRA 3,780만주 /
//   전체 9,159만주로 약 41% 만 잡혔다. 비중(비율)으로만 쓰고 절대 거래량으로 쓰지 않는다.

import { fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';
const SCREENER = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';
const FINRA = 'https://cdn.finra.org/equity/regsho/daily';

// 표본 = 야후 '최다거래' 목록. 전체 상장종목을 쓰면 동전주·소형 ETF 가 종목 수를
// 지배하고, 지수 구성종목은 구성 목록을 받을 소스가 현재 플랜에서 막혀 있다.
// 실제로 돈이 오간 곳을 표본으로 삼는 것이 이 카드의 취지에도 맞는다.
async function screener(pages = 3, count = 100) {
  const out = new Map();
  for (let i = 0; i < pages; i++) {
    const url = `${SCREENER}?scrIds=most_actives&count=${count}&start=${i * count}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) break;
    const j = await res.json();
    const quotes = j?.finance?.result?.[0]?.quotes || [];
    if (!quotes.length) break;
    for (const q of quotes) {
      const { symbol, regularMarketPrice: px, regularMarketVolume: vol,
              regularMarketChangePercent: pct } = q;
      if (!symbol || !px || !vol || pct == null || out.has(symbol)) continue;
      out.set(symbol, { symbol, px, vol, pct, amount: px * vol });
    }
  }
  return [...out.values()];
}

async function shortVolume(yyyymmdd) {
  const res = await fetch(`${FINRA}/CNMSshvol${yyyymmdd}.txt`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`FINRA HTTP ${res.status}`);
  const text = await res.text();
  const map = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('Date')) continue;
    const p = line.trim().split('|');
    if (p.length < 5) continue;
    const short = Number(p[2]), total = Number(p[4]);
    if (!Number.isFinite(short) || !Number.isFinite(total) || !total) continue;
    map.set(p[1], { short, total, ratio: (short / total) * 100 });
  }
  return map;
}

// 직전 '거래가 끝난' 미국 영업일 (KST 로 오전이면 전날 밤 장이 방금 끝난 것)
function lastUsSession() {
  const now = new Date();
  const et = new Date(now.getTime() - 4 * 3600 * 1000);   // EDT 근사
  if (et.getUTCHours() < 20) et.setUTCDate(et.getUTCDate() - 1);
  while (et.getUTCDay() === 0 || et.getUTCDay() === 6) et.setUTCDate(et.getUTCDate() - 1);
  return et.toISOString().slice(0, 10);
}

async function main() {
  const date = (process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || lastUsSession());
  const rows = await screener();
  if (!rows.length) { console.error('⏭  거래대금 표본을 받지 못했습니다 — 이 항목은 빼고 진행한다.'); process.exit(2); }

  let shorts = new Map();
  try { shorts = await shortVolume(date.replace(/-/g, '')); }
  catch (e) { console.error(`⚠️  공매도 파일 없음 (${e.message}) — 비중 없이 거래대금만 낸다.`); }

  for (const r of rows) r.short = shorts.get(r.symbol)?.ratio ?? null;
  rows.sort((a, b) => b.amount - a.amount);

  const up = rows.filter(r => r.pct > 0), down = rows.filter(r => r.pct < 0);
  const sum = a => a.reduce((s, r) => s + r.amount, 0);
  const upAmt = sum(up), downAmt = sum(down);
  const withShort = rows.filter(r => r.short != null);
  const sampleShort = withShort.length
    ? withShort.reduce((s, r) => s + shorts.get(r.symbol).short, 0) /
      withShort.reduce((s, r) => s + shorts.get(r.symbol).total, 0) * 100
    : null;

  console.log(JSON.stringify({
    date,
    source: 'Yahoo screener (most_actives) + FINRA daily short volume',
    sampleSize: rows.length,
    // 거래대금 상위 — 카드의 순위 막대
    topTurnover: rows.slice(0, 10).map(r => ({
      symbol: r.symbol,
      amountUsd: Math.round(r.amount),
      changePct: Number(r.pct.toFixed(2)),
      shortPct: r.short == null ? null : Number(r.short.toFixed(1)),
    })),
    // 돈이 오른 쪽으로 갔나 — 거래량이 아니라 거래대금으로 센다.
    // 거래량 기준은 저가주가 부풀린다 (2026-08-21: 거래량 66.8% vs 거래대금 57.7%).
    breadth: {
      upCount: up.length, downCount: down.length,
      upAmountUsd: Math.round(upAmt), downAmountUsd: Math.round(downAmt),
      upSharePct: Number((upAmt / (upAmt + downAmt) * 100).toFixed(1)),
    },
    shortVolume: sampleShort == null ? null : {
      sampleAvgPct: Number(sampleShort.toFixed(1)),
      note: '시장조성자 헤지 포함 · 표본 평균과의 차이로만 읽는다',
    },
  }, null, 2));
}

main().catch(e => { console.error('❌ 실행 실패:', e.message); process.exit(1); });
