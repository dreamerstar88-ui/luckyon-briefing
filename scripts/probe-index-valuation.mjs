// probe-index-valuation.mjs
// 지수 PER / EPS 를 "정확한 공식 수치"로 가져올 수 있는 경로가 있는지 탐침한다.
//
// 왜 필요한가: 브리핑 세션의 egress 정책에서 지수 밸류에이션 공식 소스
// (S&P Dow Jones Indices · WSJ · Nasdaq · iShares · KRX 정보데이터시스템)가 전부 막힌다.
// 세션에 붙은 커넥터도 전부 확인했지만 지수 PER/EPS 는 어디에도 없었다:
//   - FMP quote / index-quote  → 지수엔 pe·eps 필드 자체가 없음
//   - FMP company              → ratios 엔드포인트 없음 (플랜 등급)
//   - Alpha Vantage COMPANY_OVERVIEW(SPY) → {} (ETF 는 미지원)
//   - Alpha Vantage ETF_PROFILE(SPY)      → 보유종목만, PER 없음
//   - 직접 크롤링                          → EGRESS_BLOCKED
// GitHub Actions 러너는 그 정책 밖에 있으므로(econ-calendar·krx-flows 와 같은 패턴),
// 여기서 어느 소스가 실제로 열리는지 먼저 시험해 보고 되는 곳으로 확정한다.
//
// 이 스크립트는 **판단하지 않는다** — 뚫리는지 여부와 원본 조각만 기록한다.
// 어떤 소스를 정식 채택할지는 결과를 보고 사람이 정한다.
//
// 사용법:
//   node scripts/probe-index-valuation.mjs            # 결과 JSON 을 stdout 으로
//   node scripts/probe-index-valuation.mjs --pretty   # 사람이 읽기 좋은 요약도 stderr 로

const PRETTY = process.argv.includes('--pretty');
const TIMEOUT_MS = 20000;

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// KRX 는 조회일자를 반드시 받는다. 가장 가까운 평일(KST)로 채운다 —
// 공휴일까지는 안 따진다. 탐침 목적상 "응답이 오는가"만 보면 되고,
// 휴장일이면 빈 배열이 오는데 그것도 접근 가능하다는 증거다.
function lastWeekdayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  while (kst.getDay() === 0 || kst.getDay() === 6) kst.setDate(kst.getDate() - 1);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

// 탐침 대상. index 는 이 소스가 커버하는 지수, official 은 지수 산출기관/운용사가
// 직접 내는 값인지 여부(2차 가공 사이트는 false).
const TARGETS = [
  {
    id: 'spdji-sp500-eps-xlsx',
    index: 'S&P 500', official: true,
    desc: 'S&P Dow Jones Indices 공식 S&P 500 EPS·PER 워크북(xlsx)',
    url: 'https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-eps-est.xlsx',
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
  },
  {
    id: 'ishares-ivv-fund-json',
    index: 'S&P 500', official: true,
    desc: 'iShares IVV 펀드 데이터 JSON (지수 추종 ETF 의 P/E·EPS)',
    url: 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=json&dataType=fund',
    accept: 'application/json,text/plain,*/*',
  },
  {
    id: 'ishares-ivv-product-page',
    index: 'S&P 500', official: true,
    desc: 'iShares IVV 상품 페이지 HTML (P/E Ratio 표기)',
    url: 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf',
    accept: 'text/html,*/*',
    grep: /(P\/E\s*Ratio|Price\s*to\s*Earnings)/i,
  },
  {
    id: 'invesco-qqq-holdings-csv',
    index: 'Nasdaq 100', official: true,
    desc: 'Invesco QQQ 보유종목 CSV (구성종목 가중 PER 산출용 원자료)',
    url: 'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ',
    accept: 'text/csv,*/*',
  },
  {
    id: 'nasdaq-ndx-overview',
    index: 'Nasdaq 100', official: true,
    desc: 'Nasdaq 공식 지수 개요 페이지 (NDX)',
    url: 'https://indexes.nasdaqomx.com/Index/Overview/NDX',
    accept: 'text/html,*/*',
    grep: /(P\/E|Price\/Earnings)/i,
  },
  {
    id: 'ssga-dia-fund-json',
    index: 'Dow Jones', official: true,
    desc: 'State Street SPDR DIA 펀드 파인더 JSON',
    url: 'https://www.ssga.com/bin/v1/ssmp/fund/fundfinder?country=us&language=en&role=intermediary&product=etfs&ticker=DIA',
    accept: 'application/json,*/*',
  },
  {
    id: 'wsj-pe-yields',
    index: 'S&P 500 · Dow · Nasdaq 100', official: false,
    desc: 'WSJ Market Data — P/E Ratios & Earnings Yields (3개 지수 한 표)',
    url: 'https://www.wsj.com/market-data/stocks/peyields',
    accept: 'text/html,*/*',
    grep: /(P\/E\s*RATIO|Earnings\s*Yield)/i,
  },
  {
    id: 'krx-index-per',
    index: 'KOSPI · KOSDAQ', official: true,
    desc: 'KRX 정보데이터시스템 — 지수 PER/PBR/배당수익률 (MDCSTAT00701)',
    url: 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
    method: 'POST',
    accept: 'application/json,*/*',
    // bld·파라미터는 KRX 정보데이터시스템 [12021] 지수 PER/PBR/배당수익률 화면과 동일.
    body: new URLSearchParams({
      bld: 'dbms/MDC/STAT/standard/MDCSTAT00701',
      locale: 'ko_KR',
      idxIndMidclssCd: '02',
      trdDd: lastWeekdayKST(),
      share: '1',
      csvxls_isNo: 'false',
    }),
    headers: { 'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020506' },
  },
  {
    id: 'multpl-sp500-pe',
    index: 'S&P 500', official: false,
    desc: 'multpl.com S&P 500 PE Ratio (2차 가공 — 대조용)',
    url: 'https://www.multpl.com/s-p-500-pe-ratio',
    accept: 'text/html,*/*',
    grep: /Current\s+S&P\s*500\s+PE\s+Ratio/i,
  },
  {
    id: 'yahoo-quotesummary-spy',
    index: 'S&P 500', official: false,
    desc: 'Yahoo quoteSummary SPY — trailingPE / trailingEps (크럼 필요 여부 확인)',
    url: 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/SPY?modules=defaultKeyStatistics,summaryDetail',
    accept: 'application/json,*/*',
  },
];

// 열렸다고 다 쓸 수 있는 게 아니다 — 값이 실제로 보이는지까지 확인한다.
// 숫자를 여기서 확정하지는 않는다. 채택 판단에 필요한 "보이더라" 증거만 남긴다.
function inspect(t, status, ct, text) {
  const out = { bytes: text.length, contentType: ct };
  if (status < 200 || status >= 300) return out;

  // 차단·봇방어 페이지는 200 으로도 온다. 본문을 봐야 구분된다.
  if (/(Access Denied|Request Rejected|captcha|Are you a robot|Incapsula|cf-browser-verification)/i.test(text.slice(0, 4000))) {
    out.blockedBody = true;
    return out;
  }
  if (t.grep) out.keywordFound = t.grep.test(text);

  if (/json/i.test(ct) || text.trimStart().startsWith('{')) {
    try {
      const j = JSON.parse(text);
      // PER/EPS 로 보이는 키를 얕게 훑는다 (경로만 기록, 값은 원본 그대로).
      const hits = [];
      const walk = (o, p, d) => {
        if (d > 6 || hits.length >= 12 || o == null || typeof o !== 'object') return;
        for (const [k, v] of Object.entries(o)) {
          if (/^(pe|per|peRatio|trailingPE|forwardPE|priceToEarnings|eps|trailingEps|epsTrailingTwelveMonths|PER|EPS)$/i.test(k)
              && (typeof v === 'number' || typeof v === 'string' || (v && typeof v === 'object' && 'raw' in v))) {
            hits.push({ path: `${p}${k}`, value: v && typeof v === 'object' ? v.raw ?? v.fmt ?? null : v });
          }
          if (v && typeof v === 'object') walk(v, `${p}${k}.`, d + 1);
        }
      };
      walk(j, '', 0);
      out.jsonValuationKeys = hits;
      out.topLevelKeys = Object.keys(j).slice(0, 15);
    } catch { out.jsonParseError = true; }
  } else {
    // HTML/CSV 는 키워드 주변 조각만 남긴다.
    const m = text.match(/[^<>\n]{0,60}(P\/E|PER|Price\/Earnings|EPS)[^<>\n]{0,80}/i);
    if (m) out.snippet = m[0].replace(/\s+/g, ' ').trim().slice(0, 180);
  }
  return out;
}

async function probe(t) {
  const started = Date.now();
  const rec = { id: t.id, index: t.index, official: t.official, desc: t.desc, url: t.url, method: t.method || 'GET' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(t.url, {
      method: t.method || 'GET',
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': t.accept || '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        ...(t.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}),
        ...(t.headers || {}),
      },
      body: t.body ? t.body.toString() : undefined,
    });
    const ct = res.headers.get('content-type') || '';
    // xlsx/PDF 같은 바이너리는 본문을 통째로 들고 있을 이유가 없다. 앞부분만 본다.
    const buf = Buffer.from(await res.arrayBuffer());
    const isBinary = /(sheet|excel|pdf|octet-stream|zip)/i.test(ct);
    const text = isBinary ? buf.subarray(0, 512).toString('latin1') : buf.toString('utf8');
    rec.status = res.status;
    rec.ok = res.ok;
    rec.finalUrl = res.url !== t.url ? res.url : undefined;
    rec.binary = isBinary || undefined;
    rec.totalBytes = buf.length;
    // xlsx 는 zip 이라 'PK' 로 시작한다. 그게 확인되면 진짜 파일이 온 것이다.
    if (isBinary) rec.looksLikeZip = buf.subarray(0, 2).toString('latin1') === 'PK';
    Object.assign(rec, inspect(t, res.status, ct, text));
  } catch (e) {
    rec.ok = false;
    rec.error = e.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(e.message || e);
  } finally {
    clearTimeout(timer);
  }
  rec.ms = Date.now() - started;
  return rec;
}

const results = [];
for (const t of TARGETS) results.push(await probe(t));   // 순차 — 동시 요청은 봇방어를 부른다

const report = {
  probed_at: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  note: '탐침 결과. 값의 정확성은 검증하지 않았다 — 접근 가능 여부와 원본 조각만 기록한다.',
  reachable: results.filter(r => r.ok && !r.blockedBody).map(r => r.id),
  results,
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (PRETTY) {
  const line = r => {
    const mark = !r.ok ? '✗' : r.blockedBody ? '⚠' : '✓';
    const why = r.error ? r.error : r.blockedBody ? '봇방어/차단 본문' : `${r.status} · ${r.totalBytes}B`;
    const val = r.jsonValuationKeys?.length ? ` · 키 ${r.jsonValuationKeys.length}개`
              : r.keywordFound ? ' · 키워드 있음'
              : r.snippet ? ' · 조각 있음'
              : r.looksLikeZip ? ' · xlsx 정상'
              : '';
    return `${mark} ${r.id.padEnd(28)} ${r.index.padEnd(24)} ${why}${val}`;
  };
  process.stderr.write('\n' + results.map(line).join('\n') + '\n\n');
  process.stderr.write(`열린 소스 ${report.reachable.length} / ${results.length}\n`);
}
