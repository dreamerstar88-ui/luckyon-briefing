// probe-valuation-extract.mjs
// 탐침 2단계 — 1단계에서 «열린다»고 확인된 소스에서 지수 PER·EPS 를 **실제로 뽑아 본다.**
//
// 1단계(probe-index-valuation.mjs)는 접근 가능 여부만 봤다. 러너에서 5/10 이 열렸지만
// 「키워드가 있다」까지였고 숫자가 뽑히는지는 확인하지 못했다. 이 스크립트가 그 뒤를 맡는다.
//
// ── 왜 발췌를 같이 남기나
// 이 소스들은 브리핑 세션 egress 에서 전부 막힌다(1단계에서 10/10 차단 확인). 즉 세션에서는
// HTML 을 열어 볼 수 없어 파서를 «보고» 짤 수 없다. 그래서 러너가 값 추출을 시도하면서
// **키워드 주변 원문 발췌를 함께 커밋**한다. 추출이 실패해도 발췌를 보고 파서를 고칠 수 있다.
// 발췌 없이 실패하면 다음 시도가 또 장님 상태에서 시작한다.
//
// 사용법: node scripts/probe-valuation-extract.mjs
// 출력: JSON 을 stdout 으로 (values + excerpts). 워크플로가 data/ 에 커밋한다.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const EXCERPT = 2600;    // 키워드 주변으로 남길 문자 수
const MAX_HITS = 3;      // 소스별 발췌 개수

const SOURCES = [
  { id: 'wsj', label: 'WSJ Market Data — P/E Ratios & Earnings Yields',
    covers: 'S&P 500 · Dow · Nasdaq 100',
    url: 'https://www.wsj.com/market-data/stocks/peyields',
    kind: 'html',
    // 표 안에서 지수 이름 옆에 P/E 가 붙는다. 이름을 기준점으로 잡는다.
    anchors: [/Dow\s+Jones\s+Industrial\s+Average/i, /S&amp;P\s*500|S&P\s*500/i, /Nasdaq\s*100/i] },

  { id: 'ishares-ivv', label: 'iShares IVV 펀드 데이터', covers: 'S&P 500',
    url: 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=json&dataType=fund',
    kind: 'json-ish',
    anchors: [/peRatio|priceToEarnings|"pe"|P\/E/i] },

  { id: 'ishares-ivv-page', label: 'iShares IVV 상품 페이지', covers: 'S&P 500',
    url: 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf',
    kind: 'html',
    anchors: [/P\/E\s*Ratio/i, /Price\s*to\s*Earnings/i] },

  { id: 'nasdaq-ndx', label: 'Nasdaq 공식 NDX 개요', covers: 'Nasdaq 100',
    url: 'https://indexes.nasdaqomx.com/Index/Overview/NDX',
    kind: 'html',
    anchors: [/P\/E/i, /Price\/Earnings/i] },

  { id: 'multpl', label: 'multpl.com S&P 500 PE (대조용)', covers: 'S&P 500',
    url: 'https://www.multpl.com/s-p-500-pe-ratio',
    kind: 'html',
    anchors: [/Current\s+S&amp;P\s*500\s+PE\s+Ratio|Current\s+S&P\s*500\s+PE\s+Ratio/i] },
];

async function get(url) {
  for (let a = 0; a < 3; a++) {
    if (a) await new Promise(r => setTimeout(r, 1500 * 2 ** (a - 1)));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9',
                   Accept: 'text/html,application/json,*/*' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) continue;
      return { status: res.status, ok: res.ok, text: await res.text() };
    } catch (e) { if (a === 2) return { status: 0, ok: false, error: String(e.message || e) }; }
  }
  return { status: 0, ok: false, error: 'retries exhausted' };
}

// HTML 태그를 벗겨 표를 «이름 … 숫자 숫자» 형태의 평문으로 만든다.
// 표 파싱을 정공법으로 하려면 DOM 이 필요한데, 러너에 파서를 새로 깔지 않고
// 텍스트만으로 지수 이름 뒤에 오는 숫자들을 집는 편이 이 목적에는 충분하다.
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(tr|div|p|li|table|h\d)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n');
}

// 지수 이름이 나온 줄에서 소수점 숫자를 순서대로 뽑는다.
// P/E 인지 배당수익률인지는 여기서 단정하지 않는다 — 후보만 남기고 판단은 사람이 한다.
function numbersNear(text, anchor, span = 400) {
  const out = [];
  let idx = 0;
  const re = new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : anchor.flags + 'g');
  let m;
  while ((m = re.exec(text)) && out.length < MAX_HITS) {
    const seg = text.slice(m.index, m.index + span);
    const nums = [...seg.matchAll(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g)].map(x => x[0]).slice(0, 10);
    out.push({ at: m.index, matched: m[0], line: seg.split('\n')[0].slice(0, 220).trim(), numbers: nums });
    idx = m.index + 1;
    re.lastIndex = idx;
  }
  return out;
}

function excerptsAround(raw, anchor) {
  const out = [];
  const re = new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : anchor.flags + 'g');
  let m;
  while ((m = re.exec(raw)) && out.length < MAX_HITS) {
    const s = Math.max(0, m.index - Math.floor(EXCERPT / 3));
    out.push(raw.slice(s, s + EXCERPT));
    re.lastIndex = m.index + 1;
  }
  return out;
}

// iShares 는 2.2MB 를 주면서 JSON.parse 가 깨졌다(1단계). BOM·JSONP 래퍼·앞쪽 쓰레기를
// 순서대로 벗겨 본다. 어느 쪽이었는지 기록해 둔다 — 다음에 같은 걸 다시 파헤치지 않도록.
function looseJson(text) {
  const tries = [
    ['as-is', t => t],
    ['strip-bom', t => t.replace(/^﻿/, '')],
    ['first-brace', t => t.slice(Math.min(...[t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0)))],
    ['jsonp-unwrap', t => { const m = t.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/); return m ? m[1] : t; }],
  ];
  for (const [how, fn] of tries) {
    try { return { how, json: JSON.parse(fn(text).trim()) }; } catch { /* 다음 */ }
  }
  return null;
}

function walkValuation(obj, depth = 0, path = '', hits = []) {
  if (depth > 8 || hits.length >= 25 || obj == null || typeof obj !== 'object') return hits;
  for (const [k, v] of Object.entries(obj)) {
    if (/^(pe|per|peRatio|priceToEarnings|priceEarnings|trailingPE|forwardPE|eps|epsTrailing|earningsPerShare)$/i.test(k)) {
      const val = v && typeof v === 'object' ? (v.r ?? v.raw ?? v.d ?? v.fmt ?? JSON.stringify(v).slice(0, 80)) : v;
      hits.push({ path: `${path}${k}`, value: val });
    }
    if (v && typeof v === 'object') walkValuation(v, depth + 1, `${path}${k}.`, hits);
  }
  return hits;
}

const results = [];
for (const s of SOURCES) {
  const rec = { id: s.id, label: s.label, covers: s.covers, url: s.url };
  const res = await get(s.url);
  rec.status = res.status; rec.ok = res.ok;
  if (res.error) rec.error = res.error;
  if (!res.ok || !res.text) { results.push(rec); continue; }

  const raw = res.text;
  rec.bytes = raw.length;
  if (/(Access Denied|Request Rejected|captcha|Are you a robot|__verify)/i.test(raw.slice(0, 5000))) {
    rec.blockedBody = true; results.push(rec); continue;
  }

  if (s.kind === 'json-ish') {
    const parsed = looseJson(raw);
    if (!parsed) { rec.jsonParseFailed = true; rec.head = raw.slice(0, 300); }
    else {
      rec.jsonParsedVia = parsed.how;
      rec.topKeys = Object.keys(parsed.json).slice(0, 25);
      rec.valuationKeys = walkValuation(parsed.json);
    }
  }

  const text = s.kind === 'html' ? toText(raw) : raw;
  rec.candidates = [];
  rec.excerpts = [];
  for (const a of s.anchors) {
    const near = numbersNear(text, a);
    if (near.length) rec.candidates.push({ anchor: String(a), hits: near });
    // 발췌는 원문에서 딴다 — 태그를 벗기면 파서 짤 때 필요한 구조가 사라진다.
    const ex = excerptsAround(raw, a);
    if (ex.length) rec.excerpts.push({ anchor: String(a), samples: ex });
  }
  results.push(rec);
}

process.stdout.write(JSON.stringify({
  probedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  purpose: '지수 PER/EPS 를 실제로 추출할 수 있는지 확인한다. 값의 정확성은 여기서 판정하지 않는다 — 후보와 원문 발췌만 남긴다.',
  results,
}, null, 2) + '\n');

process.stderr.write('\n');
for (const r of results) {
  const mark = !r.ok ? '✗' : r.blockedBody ? '⚠' : '✓';
  const n = (r.candidates || []).reduce((a, c) => a + c.hits.length, 0);
  process.stderr.write(`${mark} ${r.id.padEnd(18)} ${String(r.status).padStart(3)}  `
    + `후보 ${n}  발췌 ${(r.excerpts || []).reduce((a, e) => a + e.samples.length, 0)}`
    + `${r.valuationKeys ? `  JSON키 ${r.valuationKeys.length}(${r.jsonParsedVia})` : ''}`
    + `${r.jsonParseFailed ? '  JSON파싱실패' : ''}\n`);
}
