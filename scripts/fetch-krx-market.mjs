// fetch-krx-market.mjs
// 코스피·코스닥의 «그날 하루 기록»을 네이버 증권의 실제 내부 API 에서 받아
// data/krx-market.json 으로 출력한다.
//
// 담는 것 (전부 한 곳에서 나온다):
//   · 지수 종가·등락·거래량·거래대금·52주 고저
//   · 등락 종목수(breadth)   — 카드3
//   · 투자자별 순매수(수급)   — 카드3
//   · 업종별 등락률 + 업종별 상승/하락 종목수·거래대금 — 카드4
//   · 업종별 거래대금 상위 종목 — 카드5 보조
//
// 왜 이 경로인가 (2026-09-21 pm 세션에서 확정):
//   예전 경로가 차례로 죽었다. sise_index.naver·sise_group.naver 는 GET 200 은 오지만
//   **표가 0개**다(러너의 깨끗한 IP 로도 동일) — 네이버가 이 화면들을 stock.naver.com
//   기반 클라이언트 렌더링(SPA)으로 옮겨, 데이터가 서버 HTML 에 없고 화면이 뜬 뒤 JS 가
//   부르는 API 로만 채워지기 때문이다. investorDealTrendDay.naver(수급 전용 JSP)는
//   러너에서도 410 Gone 으로, 이건 진짜로 폐기된 것이다.
//   짐작으로 API 경로를 맞히려던 시도(m.stock.naver.com/api/index/KOSPI/investors 등)는
//   전부 404 였다. 그래서 `scripts/probe-naver-browser.mjs` 로 실제 브라우저를 띄워
//   화면이 던지는 XHR 을 가로채 **진짜 경로를 관찰해서** 알아냈다. 아래 URL 들이 그것이다.
//
// 왜 워크플로에서 도나:
//   `stock.naver.com`·`polling.finance.naver.com` 은 브리핑 세션의 egress 프록시가
//   CONNECT 단계에서 403 으로 막는다(NODE_USE_ENV_PROXY=1 을 붙여도 소용없다 — 허용목록
//   문제라서다). 러너는 그 제약이 없다. data/krx-flows.json·econ-calendar 와 같은 패턴으로
//   워크플로가 받아 main 에 커밋하고, 세션은 `git show origin/main:data/krx-market.json`
//   으로 읽는다.
//
// 사용법:
//   node scripts/fetch-krx-market.mjs           # JSON 을 stdout 으로
//   node scripts/fetch-krx-market.mjs --pretty  # 사람이 읽기 좋게

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://stock.naver.com/', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// "-31,850" → -31850 · "20,811,215백만" → 20811215 · null/빈값 → null
const num = s => {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[^0-9.+-]/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

// 지수 상세 — 등락 종목수·수급·거래대금이 전부 여기 들어 있다.
async function index(code) {
  const d = await getJson(`https://stock.naver.com/api/securityFe/api/index/${code}/integration`);
  const info = Object.fromEntries((d.totalInfos || []).map(t => [t.code, t.value]));
  const ud = d.upDownStockInfo || {};
  const dt = d.dealTrendInfo || {};
  return {
    name: d.stockName,
    // 지수 자체 수치
    lastClose: num(info.lastClosePrice),
    open: num(info.openPrice), high: num(info.highPrice), low: num(info.lowPrice),
    tradingVolumeThousandShares: num(info.accumulatedTradingVolume),   // 단위: 천주
    tradingValueMillionKrw: num(info.accumulatedTradingValue),         // 단위: 백만원
    high52w: num(info.highPriceOf52Weeks), low52w: num(info.lowPriceOf52Weeks),
    // 등락 종목수 (카드3 breadth)
    breadth: {
      up: num(ud.riseCount), flat: num(ud.steadyCount), down: num(ud.fallCount),
      limitUp: num(ud.upperCount), limitDown: num(ud.lowerCount),
    },
    // 투자자별 순매수 (카드3 flows) — 단위 억원
    flows: {
      bizdate: dt.bizdate || null,
      unit: '억원',
      individual: num(dt.personalValue),
      foreign: num(dt.foreignValue),
      institution: num(dt.institutionalValue),
    },
  };
}

// 업종별 등락 — 100개까지 등락률 내림차순. 카드4 가 여기서 나온다.
async function industries() {
  const d = await getJson('https://stock.naver.com/api/stockSecurity/rankings/v2/domestic/industries?sortType=changeRate&size=100&period=daily');
  return (d.items || []).map(it => ({
    code: it.code,
    name: it.name,
    changeRate: num(it.changeRate),
    up: num(it.risingCount), flat: num(it.unchangedCount), down: num(it.fallingCount),
    marketCap: num(it.totalMarketCap),
    tradingValue: num(it.totalTradingValue),
    topByTradingValue: (it.topByTradingValue || []).map(s => ({ code: s.code, name: s.name, value: num(s.value) })),
    topByChangeRate: (it.topByChangeRate || []).map(s => ({ code: s.code, name: s.name, changeRate: num(s.value) })),
  }));
}

async function main() {
  const out = {
    fetchedAt: new Date().toISOString().slice(0, 19) + 'Z',
    source: 'stock.naver.com internal API (observed via browser probe 2026-09-21)',
    // 아래 두 항목은 카드에 실을 때 반드시 밝혀야 하는 범위 정보다.
    notes: {
      flowsScope: '유가증권시장/코스닥 각각. 장 마감 후 시점에 따라 넥스트레이드(NXT)·시간외가 섞여 언론 보도치와 수백억~수천억 차이가 날 수 있다 — 카드에는 기준 시각을 함께 적는다.',
      industriesScope: '코스피+코스닥 합산 업종 분류(네이버 자체 분류). fetch-krx.mjs 의 KSIC 시총가중 집계와 방법론이 다르다.',
    },
    indexes: {},
    industries: [],
  };
  const failed = [];
  for (const code of ['KOSPI', 'KOSDAQ']) {
    try { out.indexes[code] = await index(code); }
    catch (e) { failed.push(`${code}: ${e.message}`); }
  }
  try { out.industries = await industries(); }
  catch (e) { failed.push(`industries: ${e.message}`); }

  if (!Object.keys(out.indexes).length && !out.industries.length) {
    console.error(`⏭  네이버 시장 데이터 조회 실패 (${failed.join(' / ')})`);
    process.exit(2);
  }
  if (failed.length) console.error(`⚠️  일부 실패: ${failed.join(' / ')}`);
  console.log(JSON.stringify(out, null, process.argv.includes('--pretty') ? 2 : 0));
}

main().catch(e => { console.error('❌ 실행 실패:', e.message); process.exit(1); });
