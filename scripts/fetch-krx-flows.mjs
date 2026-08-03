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

const PAGES = [
  { key: 'investorDealTrendDay', url: 'https://finance.naver.com/sise/investorDealTrendDay.naver' },
  { key: 'sise_trans_style', url: 'https://finance.naver.com/sise/sise_trans_style.naver' },
  { key: 'investorDealTrendDay_kosdaq', url: 'https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=&sosok=1' },
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

async function probe() {
  for (const p of PAGES) {
    console.log(`\n${'='.repeat(70)}\n▶ ${p.key}  ${p.url}`);
    try {
      const { html, enc, bytes } = await getHtml(p.url);
      console.log(`  인코딩 ${enc} · ${bytes} bytes`);
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

// 표에서 '개인 / 외국인 / 기관' 헤더를 찾아 가장 최근 행을 뽑는다.
function parseFlows(html) {
  for (const tb of tables(html)) {
    const rs = rows(tb).filter(r => r.length >= 4);
    if (rs.length < 2) continue;
    const headIdx = rs.findIndex(r => r.some(c => /개인/.test(c)) && r.some(c => /외국인/.test(c)) && r.some(c => /기관/.test(c)));
    if (headIdx < 0) continue;
    const head = rs[headIdx];
    const col = re => head.findIndex(c => re.test(c));
    const iDate = 0, iInd = col(/개인/), iFor = col(/외국인/), iIns = col(/기관/);
    if (iInd < 0 || iFor < 0 || iIns < 0) continue;
    for (const r of rs.slice(headIdx + 1)) {
      const date = r[iDate];
      if (!/\d{2}[./]\d{2}/.test(date || '')) continue;
      const v = [num(r[iInd]), num(r[iFor]), num(r[iIns])];
      if (v.some(x => x === null)) continue;
      return { date, individual: v[0], foreign: v[1], institution: v[2] };
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
