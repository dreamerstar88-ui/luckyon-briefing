// fetch-krx-flows.mjs
// 코스피·코스닥의 투자자별 매매동향(개인·외국인·기관 순매수)을 받아
// data/krx-flows.json 으로 출력한다.
//
// 사용법:
//   node scripts/fetch-krx-flows.mjs            # 파싱해서 JSON 출력
//   node scripts/fetch-krx-flows.mjs --probe    # 페이지 구조만 진단 출력 (파서 수정용)
//
// 왜 워크플로에서 도나:
//   finance.naver.com 은 브리핑 세션의 네트워크 정책에서 차단된다(HTTP 000).
//   data.krx.co.kr 은 허용목록에 있으나 로그인을 요구해 LOGOUT 만 돌려준다.
//   GitHub Actions 러너는 프록시 밖이라 네이버 금융에 그대로 접속된다.
//   그래서 .github/workflows/krx-flows.yml 이 이 스크립트를 돌려 결과를
//   커밋하고, 세션은 커밋된 JSON 을 읽는다 (futures-cache·econ-calendar 와 같은 패턴).
//
// 인증이 필요 없다 — 공개 페이지다.

// bizdate 를 비우면 헤더만 있는 1.7KB 응답이 온다 — 반드시 날짜를 넣어야 데이터 행이 나온다.
// sosok=0 코스피, sosok=1 코스닥.
// 직전 '거래가 끝난' 날을 기본값으로 쓴다. 오늘 장이 아직 안 끝났으면 오늘 데이터는 없다.
// 15:40 KST 이전이면 전날, 주말이면 직전 금요일. (공휴일은 데이터가 없으면 하루씩 뒤로 간다)
function lastSessionKst() {
  const n = new Date();
  const kst = new Date(n.getTime() + (9 * 60 - n.getTimezoneOffset()) * 60000);
  if (kst.getUTCHours() * 60 + kst.getUTCMinutes() < 15 * 60 + 40) kst.setUTCDate(kst.getUTCDate() - 1);
  while (kst.getUTCDay() === 0 || kst.getUTCDay() === 6) kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.toISOString().slice(0, 10);
}
const DATE = (process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || lastSessionKst()).replace(/-/g, '');

const PAGES = [
  { key: 'KOSPI', url: `https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=${DATE}&sosok=0` },
  { key: 'KOSDAQ', url: `https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=${DATE}&sosok=1` },
];

// 네이버 금융은 EUC-KR 로 내려온다. UTF-8 로 읽으면 한글이 깨져 표 헤더를 못 찾는다.
async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      'Referer': 'https://finance.naver.com/sise/',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 1024).toString('latin1').toLowerCase();
  const enc = /euc-kr|ks_c_5601/.test(head) ? 'euc-kr' : 'utf-8';
  return { html: new TextDecoder(enc).decode(buf), enc, bytes: buf.length };
}

const strip = s => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function tables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
}
function rows(table) {
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m =>
    [...m[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map(c => strip(c[0])));
}

// "1,234" / "-1,234" / "+1,234" → 숫자(백만원 등 단위는 페이지에 따라 다르므로 그대로 둔다)
const num = s => {
  const t = String(s ?? '').replace(/[,\s+]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

// KRX 정보데이터시스템 직접 조회. 브리핑 세션에서는 LOGOUT 만 돌아왔지만
// 그건 프록시 IP 때문일 수 있어, 러너에서 되는지 확인한다. 되면 1차 출처라 더 낫다.
async function krx(bld, extra = {}) {
  const body = new URLSearchParams({
    bld, locale: 'ko_KR', share: '1', money: '1', csvxls_isNo: 'false', ...extra,
  });
  const res = await fetch('https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      'Referer': 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020304',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function probeKrx() {
  const cands = [
    ['MDCSTAT02203 투자자별 거래실적(일별)', 'dbms/MDC/STAT/standard/MDCSTAT02203',
      { inqTpCd: '1', trdVolVal: '2', askBid: '3', mktId: 'STK', strtDd: DATE, endDd: DATE, detailView: '1' }],
    ['MDCSTAT02201 투자자별 거래실적', 'dbms/MDC/STAT/standard/MDCSTAT02201',
      { inqTpCd: '1', trdVolVal: '2', askBid: '3', mktId: 'STK', strtDd: DATE, endDd: DATE }],
    ['MDCSTAT01501 전종목 시세(연결 확인용)', 'dbms/MDC/STAT/standard/MDCSTAT01501',
      { mktId: 'STK', trdDd: DATE }],
  ];
  for (const [name, bld, extra] of cands) {
    console.log(`\n▶ KRX ${name}`);
    try {
      const { status, text } = await krx(bld, extra);
      console.log(`  HTTP ${status} · ${text.length} bytes`);
      console.log('  ' + text.slice(0, 400).replace(/\n/g, ' '));
    } catch (e) {
      console.log(`  실패: ${e.message}`);
    }
  }
}

// 네이버 모바일/내부 JSON API 후보. 어느 것이 살아 있는지 한 번에 확인한다.
async function probeJson() {
  const urls = [
    'https://m.stock.naver.com/api/index/KOSPI/investors',
    'https://m.stock.naver.com/api/index/KOSPI/investorTrend',
    'https://api.stock.naver.com/index/KOSPI/investors',
    'https://api.stock.naver.com/index/KOSPI/investorTrend',
    'https://m.stock.naver.com/api/index/KOSPI/price?pageSize=3',
    `https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=${DATE}&endTime=${DATE}&timeframe=day`,
    'https://finance.naver.com/sise/sise_index.naver?code=KOSPI',
  ];
  for (const u of urls) {
    console.log(`\n▶ ${u}`);
    try {
      const r = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
          'Referer': 'https://m.stock.naver.com/', 'Accept': 'application/json,text/html,*/*',
        },
      });
      const buf = Buffer.from(await r.arrayBuffer());
      const head = buf.subarray(0, 800).toString('latin1').toLowerCase();
      const enc = /euc-kr|ks_c_5601/.test(head) ? 'euc-kr' : 'utf-8';
      const body = new TextDecoder(enc).decode(buf);
      console.log(`  HTTP ${r.status} · ${buf.length} bytes · ${enc}`);
      const isJson = /^[\s]*[[{]/.test(body);
      console.log('  ' + (isJson ? body.slice(0, 500) : strip(body).slice(0, 350)).replace(/\n/g, ' '));
    } catch (e) {
      console.log(`  실패: ${e.message}`);
    }
  }
}

async function probe() {
  console.log(`기준일 ${DATE}`);
  await probeKrx();
  await probeJson();
  for (const p of PAGES) {
    console.log(`\n${'='.repeat(70)}\n▶ ${p.key}  ${p.url}`);
    try {
      const { html, enc, bytes } = await getHtml(p.url);
      console.log(`  인코딩 ${enc} · ${bytes} bytes`);
      console.log('  --- 본문 텍스트 ---\n    ' + strip(html).slice(0, 500));
      const ts = tables(html);
      console.log(`  table ${ts.length}개`);
      ts.forEach((tb, i) => {
        const rs = rows(tb).filter(r => r.length);
        if (!rs.length) return;
        const wide = rs.filter(r => r.length >= 3);
        if (wide.length < 2) return;
        console.log(`  --- table[${i}] rows=${rs.length} ---`);
        wide.slice(0, 5).forEach((r, j) => console.log(`    [${j}] ${r.slice(0, 9).join(' | ')}`));
      });
    } catch (e) {
      console.log(`  실패: ${e.message}`);
    }
  }
}

// 표 구조 (probe 로 확인):
//   헤더 1행: 날짜 | 개인 | 외국인 | 기관계 | 기관 | 기타법인
//   헤더 2행: 금융투자 | 보험 | 투신 (사모) | 은행 | 기타금융기관 | 연기금등
// 데이터 행은 기관 세부가 펼쳐져 열 수가 헤더보다 많으므로, 헤더로 위치를 잡지 않고
// 앞 네 칸(날짜·개인·외국인·기관계)을 자리로 읽는다. 헤더 존재 여부만 검증에 쓴다.
// 값 단위는 백만원이다 (개인 순매수 4.65조 → 4,652,xxx).
function parseFlows(html) {
  for (const tb of tables(html)) {
    const rs = rows(tb).filter(r => r.length >= 4);
    if (rs.length < 2) continue;
    const hasHead = rs.some(r => r.some(c => /개인/.test(c)) && r.some(c => /외국인/.test(c)) && r.some(c => /기관/.test(c)));
    if (!hasHead) continue;
    for (const r of rs) {
      if (!/^\d{2}[./]\d{2}([./]\d{2})?$/.test((r[0] || '').trim())) continue;
      const v = [num(r[1]), num(r[2]), num(r[3])];
      if (v.some(x => x === null)) continue;
      return {
        date: r[0].trim(),
        unit: '백만원',
        individual: v[0], foreign: v[1], institution: v[2],
      };
    }
  }
  return null;
}

async function main() {
  if (process.argv.includes('--probe')) return probe();

  const out = { fetchedAt: new Date().toISOString().slice(0, 19) + 'Z', source: 'finance.naver.com', markets: {} };
  const tried = [];
  for (const p of PAGES) {
    try {
      const { html } = await getHtml(p.url);
      const f = parseFlows(html);
      if (f) out.markets[p.key] = f;
      else tried.push(`${p.key}: 표를 찾지 못함`);
    } catch (e) {
      tried.push(`${p.key}: ${e.message}`);
    }
  }
  if (!Object.keys(out.markets).length) {
    console.error(`⏭  투자자별 매매동향 조회 실패 (${tried.join(' / ')}) — 수급 항목은 빼고 발행은 계속한다.`);
    process.exit(2);
  }
  if (tried.length) console.error(`⚠️  일부 실패: ${tried.join(' / ')}`);
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => { console.error('❌ 실행 실패:', e.message); process.exit(1); });
