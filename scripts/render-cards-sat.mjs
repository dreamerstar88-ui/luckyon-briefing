// render-cards-sat.mjs
// 토요일(주간 결산) 전용 렌더러. content/<date>-sat.json 을 읽어 1080x1350 PNG 10장을 만든다.
//
// 이 파일은 직접 호출하지 않는다 — render-cards.mjs 가 session === 'sat' 일 때 위임한다.
//   node scripts/render-cards.mjs 2026-08-08 ko sat
//
// ── 왜 평일 렌더러와 파일을 나눴나
// 평일(am·pm)과 일요일(sun)은 어두운 바탕에 sections 배열을 그대로 카드로 펴는 구조다.
// 토요일은 카드 10장이 각자 다른 모양을 가진 고정 편성이고 바탕도 밝다. 같은 파일에
// 두면 두 규칙이 서로를 갉아먹어서, 카드 구성이 고정인 쪽을 따로 뺐다.
//
// ── 서식 (노션 «노트북LM 슬라이드 스타일 가이드북» 27 / 28 / 30 혼용)
//   27] SaaS 대시보드   → ② 지수 · ③ 차트 · ④ 지표 · ⑦ 섹터 · ⑧ 대형주
//                        칼럼 헤더 + 타일 + 등락 알약칩 + 카드 안 차트
//   28] Before / After  → ⑤ 발표 결과
//                        타일 하나가 '예상 → 실제' 한 쌍, 화살표가 분할선을 겸한다
//   30] 카드뉴스형      → ① 표지 · ⑥ 뉴스 · ⑨ AI·반도체 · ⑩ 아웃트로
//                        번호 배지 + 굵은 산세리프 제목 + 블록 분리
// 27번 원문의 'white and blue corporate palette' 는 따르지 않는다 —
// 파랑은 이 브리핑에서 이미 '하락'이라, UI 색으로 겸용하면 등락 신호가 흐려진다.
// 색은 브랜드 팔레트를 유지하고 서식의 **구조**만 가져왔다.
//
// ── 색 규칙: 한국 관행대로 상승 빨강 / 하락 파랑. 미국 종목도 같은 규칙을 쓴다.
//
// 스키마는 FORMAT_BRIEFING.md 의 «토요일(sat) 카드» 절 참고.
// 견본: content/example-sat.json (node scripts/render-cards.mjs example ko sat)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', `${date}-sat.json`), 'utf8'));
const outDir = path.join(root, 'cards', date, 'sat', lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);

// 로고 캐시. logos-cache 워크플로가 만들어 커밋해 둔 base64 사전이다.
// 없어도 렌더는 된다 — 그 종목은 모노그램으로 나간다. 캐시가 통째로 비어도 조용히
// 실패하지 않도록, 아래 badge() 가 항상 모노그램 대체 경로를 갖는다.
const LOGO_FILE = path.join(root, 'data', 'logos.json');
const LOGOS = fs.existsSync(LOGO_FILE)
  ? (JSON.parse(fs.readFileSync(LOGO_FILE, 'utf8')).logos || {})
  : {};

/* ───────── 팔레트 ───────── */
const P = {
  paper: '#f2efe6', card: '#fffdf8', line: '#ddd6c6', ink: '#1f1d19', mute: '#6f685b',
  accent: '#2f5d50', up: '#c2382e', dn: '#26618c',
};
const MA20C = '#1f7a5f', HIC = '#b8860b';
const UPDN = v => (v > 0 ? P.up : v < 0 ? P.dn : P.mute);
const fmt = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = v => `${v > 0 ? '▲' : v < 0 ? '▼' : ''}${Math.abs(v).toFixed(2)}%`;

/* ───────── 지표 계산 (ohlc 배열에서 직접 뽑는다) ───────── */
const closes = x => x.ohlc.map(b => b[3]);
const ma = (x, n) => { const c = closes(x); return c.length < n ? null : c.slice(-n).reduce((a, b) => a + b, 0) / n; };
// Wilder RSI. ohlc 가 짧으면 워밍업이 모자라 값이 흔들린다 — 3개월치(60봉 이상)를 넣을 것.
function rsi(x, n = 14) {
  const c = closes(x); if (c.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d >= 0 ? g += d : l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + (d > 0 ? d : 0)) / n;
    l = (l * (n - 1) + (d < 0 ? -d : 0)) / n;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
// 20/50/100/200 중 현재가와 이격이 가장 작은 2개만 쓴다.
// 넷을 다 적으면 한 줄에 안 들어가고, 멀리 있는 선은 어차피 아무것도 말해주지 않는다.
function pickMA(x) {
  const cand = [
    { n: 20, v: ma(x, 20) }, { n: 50, v: x.ma50 ?? null },
    { n: 100, v: x.ma100 ?? null }, { n: 200, v: x.ma200 ?? null },
  ].filter(m => m.v);
  cand.forEach(m => { m.gap = (x.close / m.v - 1) * 100; });
  cand.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
  return cand.slice(0, 2);
}

/* ───────── 공통 스타일 ───────── */
const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px}
body{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans KR","Noto Color Emoji",sans-serif;
 background:${P.paper};color:${P.ink};width:1080px;height:1350px;display:flex;flex-direction:column;
 position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
.pad{padding:62px 58px 96px;flex:1;display:flex;flex-direction:column}
.bar{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:30px}
.bd{font-size:27px;font-weight:800;letter-spacing:-.01em}
.bd i{font-style:normal;color:${P.accent}}
.dt{font-size:22px;color:${P.mute};font-weight:700}
.ttl{font-size:46px;font-weight:800;letter-spacing:-.025em;margin-bottom:26px;display:flex;align-items:center;gap:16px}
.ttl s{width:16px;height:16px;border-radius:50%;background:${P.accent};display:inline-block;text-decoration:none;flex:none}
.ttl u{font-size:23px;font-weight:700;color:${P.mute};letter-spacing:0;text-decoration:none}
.foot{position:absolute;left:58px;bottom:46px;font-size:20px;color:${P.mute}}
.pg{position:absolute;right:58px;bottom:46px;font-size:21px;color:${P.mute};font-weight:800}
.blk{background:${P.card};border:1px solid ${P.line};border-radius:22px}
.num{font-variant-numeric:tabular-nums}
.note{font-size:20px;color:${P.mute};margin-top:14px;line-height:1.45}
`;

// 브랜드의 "luckyon 브리핑" 은 영어 카드에서도 한글 그대로 둔다 (평일 렌더러와 같은 규칙).
const page = (inner, i, n) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
<body>${inner}<div class="foot">luckyon 브리핑</div><div class="pg">${i} / ${n}</div></body></html>`;
const bar = () => `<div class="bar"><div class="bd">luckyon <i>${t('브리핑', 'Briefing')}</i></div>
  <div class="dt">${t(data.dateLabel_ko, data.dateLabel_en)}</div></div>`;
const title = (main, sub) => `<div class="ttl"><s></s>${main}${sub ? `<u>${sub}</u>` : ''}</div>`;
const note = s => (s ? `<div class="note">${s}</div>` : '');

/* ───────── 서식 27 / 30 공용 부품 ───────── */
const dashHead = cells => `<div style="display:flex;align-items:center;gap:20px;padding:0 26px 10px;
  font-size:17px;font-weight:800;color:${P.mute};letter-spacing:.1em">
  ${cells.map(([txt, st]) => `<div style="${st}">${txt}</div>`).join('')}</div>`;
const chip = (txt, col, fs = 22) => `<span class="num" style="background:${col}18;color:${col};
  padding:5px 13px;border-radius:999px;font-size:${fs}px;font-weight:800;white-space:nowrap">${txt}</span>`;
const numBadge = i => `<div style="width:38px;height:38px;border-radius:11px;background:${P.accent};color:#fff;
  display:grid;place-items:center;font-size:20px;font-weight:800;flex:none">${i}</div>`;

/* ───────── 봉차트 ───────── */
function candles(x, w, h, extra = []) {
  const bars = x.ohlc;
  const rawLo = Math.min(...bars.map(b => b[2])), rawHi = Math.max(...bars.map(b => b[1]));
  const span = rawHi - rawLo;
  // 참조선이 캔들 범위에서 25% 넘게 벗어나면 아예 긋지 않는다.
  // 억지로 범위에 넣으면 캔들이 납작해져 차트가 아무것도 못 보여준다
  // (코스피 60일 고점 9,115 vs 현재 6,259 에서 실제로 그렇게 뭉갰다).
  extra = extra.filter(e => e.v <= rawHi + span * 0.25 && e.v >= rawLo - span * 0.25);
  let lo = rawLo, hi = rawHi;
  extra.forEach(e => { if (e.v > hi) hi = e.v; if (e.v < lo) lo = e.v; });
  const padv = (hi - lo) * 0.10; lo -= padv; hi += padv;
  const y = v => +(h - (v - lo) / (hi - lo) * h).toFixed(2);
  const step = w / bars.length, bw = Math.max(step * 0.62, 3);
  let s = '';
  extra.forEach(e => { s += `<line x1="0" y1="${y(e.v)}" x2="${w}" y2="${y(e.v)}" stroke="${e.c}" stroke-width="1.4" stroke-dasharray="7 5"/>`; });
  bars.forEach((b, i) => {
    const [o, H, L, c] = b, cx = i * step + step / 2, col = c >= o ? P.up : P.dn;
    const top = y(Math.max(o, c)), bot = y(Math.min(o, c)), hh = Math.max(bot - top, 1.6);
    s += `<line x1="${cx.toFixed(2)}" y1="${y(H)}" x2="${cx.toFixed(2)}" y2="${y(L)}" stroke="${col}" stroke-width="1.6"/>`
       + `<rect x="${(cx - bw / 2).toFixed(2)}" y="${top}" width="${bw.toFixed(2)}" height="${hh.toFixed(2)}" fill="${col}"/>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">${s}</svg>`;
}

// 스파크라인. SVG 를 absolute 로 박아 둔다 — height:100% 만 주면 flex 아이템이
// viewBox 비율만큼 부풀어 카드가 푸터 밖으로 밀려난다 (실제로 그렇게 터졌다).
function spark(seq, col, w = 190, h = 80) {
  const lo = Math.min(...seq), hi = Math.max(...seq), sp = (hi - lo) || 1;
  const pts = seq.map((v, i) => `${(i / (seq.length - 1) * w).toFixed(1)},${(h - (v - lo) / sp * (h - 10) - 5).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
    style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <polyline points="${pts.join(' ')} ${w},${h} 0,${h}" fill="${col}" fill-opacity="0.07" stroke="none"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.6"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${lx}" cy="${ly}" r="4.2" fill="${col}"/></svg>`;
}

/* ═════════ ① 표지 — 서식 30 ═════════ */
function cardCover() {
  const c = data.cover;
  return `<div class="pad">
  ${bar()}
  <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:10px;background:${P.accent};color:#fff;
       border-radius:999px;padding:9px 20px;font-size:21px;font-weight:800;letter-spacing:.06em;margin-bottom:22px">
    ${t(data.weekLabel_ko, data.weekLabel_en)}</div>
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:20px">
    <div style="flex:none;font-size:48px;font-weight:800;line-height:1.24;letter-spacing:-.035em">${t(c.headline_ko, c.headline_en)}</div>
    <div class="blk" style="flex:1;min-height:0;padding:34px 36px 30px;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="font-size:27px;font-weight:800;color:${P.mute}">${t(c.hero.label_ko, c.hero.label_en)}</div>
        <div class="num" style="font-size:176px;font-weight:800;letter-spacing:-.055em;line-height:1.04;color:${UPDN(c.hero.dir)}">${c.hero.value}</div>
        <div style="font-size:28px;color:${P.mute};margin-top:6px">${t(c.hero.sub_ko, c.hero.sub_en)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${(c.points || []).map(p => `<div style="display:flex;gap:16px;align-items:baseline">
          <div style="width:9px;height:9px;border-radius:50%;background:${P.accent};flex:none;transform:translateY(-4px)"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:25px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px">${t(p.title_ko, p.title_en)}</div>
            <div style="font-size:22px;color:#4a453c;line-height:1.42">${t(p.body_ko, p.body_en)}</div>
          </div></div>`).join('')}
      </div>
      <div>
        <div style="height:1px;background:${P.line};margin-bottom:24px"></div>
        <div style="font-size:21px;font-weight:800;color:${P.mute};letter-spacing:.08em;margin-bottom:16px">${t(c.tiles_title_ko, c.tiles_title_en)}</div>
        <div style="display:flex;gap:13px">
          ${(c.tiles || []).map(x => `<div style="flex:1;background:${P.paper};border-radius:16px;padding:18px 20px">
            <div style="font-size:20px;color:${P.mute};font-weight:700">${t(x.label_ko, x.label_en)}</div>
            <div class="num" style="font-size:37px;font-weight:800;color:${UPDN(x.value)};margin-top:4px">${x.value > 0 ? '+' : '−'}${Math.abs(x.value).toFixed(2)}%</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div></div>`;
}

/* ═════════ ② 지수 주간 등락 — 서식 27 ═════════ */
function cardIndexWeek() {
  const mxw = Math.max(...data.indexes.map(x => Math.abs(x.wk)));
  const v = data.valuation;
  return `<div class="pad">
  ${bar()}${title(t('지수 주간 등락', 'Index — the week'))}
  ${dashHead([[t('지수', 'INDEX'), 'flex:1'], [t('주간 등락', 'WEEKLY'), 'width:250px;text-align:center'], [t('종가', 'CLOSE'), 'width:200px;text-align:right']])}
  <div style="display:flex;flex-direction:column;gap:12px;flex:1">
    ${data.indexes.map(x => { const col = UPDN(x.wk);
      return `<div class="blk" style="flex:1;min-height:0;padding:20px 26px;display:flex;align-items:center;gap:20px">
      <div style="flex:1;min-width:0">
        <div style="font-size:28px;font-weight:800;letter-spacing:-.02em">${t(x.name_ko, x.name_en)}</div>
        <div style="font-size:19px;color:${P.mute};margin-top:3px">${t(x.note_ko, x.note_en)}</div>
      </div>
      <div style="width:250px;flex:none;display:flex;flex-direction:column;align-items:center;gap:9px">
        ${chip(pct(x.wk), col, 23)}
        <div style="width:100%;height:8px;border-radius:99px;background:${P.line};overflow:hidden">
          <div style="width:${(Math.abs(x.wk) / mxw * 100).toFixed(1)}%;height:100%;background:${col};border-radius:99px"></div></div>
      </div>
      <div class="num" style="width:200px;flex:none;text-align:right;font-size:36px;font-weight:800;letter-spacing:-.03em">${fmt(x.close)}</div>
      </div>`; }).join('')}
    ${valuationBlock(v)}
  </div>
  ${note(t(data.indexNote_ko, data.indexNote_en))}</div>`;
}

// 밸류에이션 블록. **현재 PER 을 1년 전과 나란히 둔다** — 지금이 비싼지 싼지는 절대
// 수치보다 이 대비로 읽힌다. 오르면 빨강/내리면 파랑은 등락과 같은 규칙이다.
//
// EPS 는 넣지 않는다. 소스(WSJ 표)에 없고, 종가 ÷ PER 로 되짚으면 반올림 오차가 그대로
// '지수 EPS' 처럼 보인다. 출처를 반드시 함께 적는다 — 같은 지수의 PER 도 산출 기관마다
// 최대 18% 벌어지므로(2026-08-08 확인) 무출처로 쓰면 특정 벤더 방법론을 사실처럼 내보내게 된다.
function valuationBlock(v) {
  if (!v || !Array.isArray(v.rows) || !v.rows.length) {
    return `<div class="blk" style="flex:none;padding:18px 26px;background:${P.paper};border-style:dashed;display:flex;align-items:center;gap:18px">
      <div style="font-size:20px;font-weight:800;color:${P.accent};flex:none">${t('밸류에이션<br>(PER)', 'Valuation<br>(PER)')}</div>
      <div style="font-size:19px;color:${P.mute};line-height:1.45">${t(
        '이번 주 지수 PER 을 확보하지 못해 비워 두었습니다.<br>틀린 숫자보다 빈칸이 낫다는 원칙입니다.',
        'Index PER could not be secured this week, so this stays blank.<br>A blank beats a wrong number.')}</div>
    </div>`;
  }
  return `<div class="blk" style="flex:none;padding:15px 26px 13px">
    <div style="display:flex;align-items:center;gap:20px">
      <div style="font-size:19px;font-weight:800;color:${P.accent};flex:none;line-height:1.25">
        ${t('PER<br>1년 전 대비', 'PER<br>vs a year ago')}</div>
      ${v.rows.map(r => { const d = r.perYearAgo ? r.per - r.perYearAgo : null, col = UPDN(d ?? 0);
        return `<div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:10px">
        <div style="min-width:0">
          <div style="font-size:18px;color:${P.mute};font-weight:700">${t(r.name_ko, r.name_en)}</div>
          <div class="num" style="font-size:26px;font-weight:800;letter-spacing:-.02em">${r.per.toFixed(2)}</div>
        </div>
        ${d != null ? `<div class="num" style="font-size:18px;font-weight:800;color:${col};white-space:nowrap">
          ${d > 0 ? '▲' : d < 0 ? '▼' : ''}${Math.abs(d).toFixed(2)}</div>` : ''}
      </div>`; }).join('')}
    </div>
    <div style="font-size:17px;color:${P.mute};margin-top:9px">※ ${t(v.note_ko, v.note_en)}</div>
  </div>`;
}

/* ═════════ ③ 주간 차트 — 서식 27 ═════════ */
function cardCharts() {
  return `<div class="pad">
  ${bar()}${title(t('주간 차트', 'Charts'), t(`최근 ${data.indexes[0].ohlc.length}거래일 일봉`, `Last ${data.indexes[0].ohlc.length} sessions`))}
  <div style="display:flex;flex-direction:column;gap:9px;flex:1">
    ${data.indexes.map(x => {
      const ms = pickMA(x);
      const m20 = ms.find(m => m.n === 20) || { n: 20, v: ma(x, 20), gap: (x.close / ma(x, 20) - 1) * 100 };
      const other = ms.find(m => m.n !== 20);
      const r = rsi(x);
      return `<div class="blk" style="padding:13px 18px 11px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div style="font-size:23px;font-weight:800">${t(x.name_ko, x.name_en)}</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="num" style="font-size:21px;font-weight:800;letter-spacing:-.02em">${fmt(x.close)}</span>
            ${chip(pct(x.wk), UPDN(x.wk), 18)}</div>
        </div>
        ${candles(x, 900, 96, [{ v: x.hi, c: HIC }, { v: m20.v, c: MA20C }])}
        <div class="num" style="display:flex;gap:20px;font-size:17px;color:${P.mute};margin-top:6px;flex-wrap:wrap">
          ${r != null ? `<span>RSI <b style="color:${P.ink}">${r.toFixed(0)}</b></span>` : ''}
          <span style="color:${MA20C};font-weight:700">${t('20일선', 'MA20')} ${m20.gap > 0 ? '+' : ''}${m20.gap.toFixed(1)}%</span>
          ${other ? `<span>${t(`${other.n}일선`, `MA${other.n}`)} <b style="color:${P.ink}">${other.gap > 0 ? '+' : ''}${other.gap.toFixed(1)}%</b></span>` : ''}
          <span style="color:${HIC};font-weight:700">${t(x.hiLabel_ko, x.hiLabel_en)} ${fmt(x.hi, 0)}</span>
        </div></div>`;
    }).join('')}
  </div>
  <div style="font-size:19px;margin-top:11px;display:flex;gap:26px;align-items:center;flex-wrap:wrap">
    <span style="display:flex;align-items:center;gap:7px;color:${MA20C};font-weight:700">
      <i style="width:22px;height:0;border-top:3px dashed ${MA20C};display:inline-block"></i>${t('20일 이동평균선', '20-day moving average')}</span>
    <span style="display:flex;align-items:center;gap:7px;color:${HIC};font-weight:700">
      <i style="width:22px;height:0;border-top:3px dashed ${HIC};display:inline-block"></i>${t('기간 고점', 'Period high')}</span>
    <span style="color:${P.mute}">${t('※ 고점이 화면 밖이면 선은 생략하고 숫자만 표기', '※ Line omitted when the high sits off-chart; the number stays')}</span>
  </div></div>`;
}

/* ═════════ ④ 지수 외 지표 — 서식 27 ═════════ */
function cardMetrics() {
  return `<div class="pad">
  ${bar()}${title(t('지수 외 지표', 'Beyond the indexes'), t(`${data.metrics.length}개 한눈에`, `${data.metrics.length} at a glance`))}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;flex:1;align-content:stretch">
    ${data.metrics.map(m => { const col = UPDN(m.dir);
      return `<div class="blk" style="padding:18px 24px;display:flex;flex-direction:column;justify-content:center;gap:8px">
      <div style="display:flex;align-items:center;gap:9px;font-size:20px;color:${P.mute};font-weight:700">
        <span style="font-size:24px;line-height:1">${m.emoji}</span>${t(m.name_ko, m.name_en)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div class="num" style="font-size:36px;font-weight:800;letter-spacing:-.03em">${m.value}</div>
        ${chip(m.delta, col, 21)}
      </div></div>`; }).join('')}
  </div>
  ${note(t(data.metricsNote_ko, data.metricsNote_en))}</div>`;
}

/* ═════════ ⑤ 발표 결과 — 서식 28 (Before / After) ═════════ */
function cardCalendar() {
  // 칸이 좁아 '115.4억' 같은 값이 두 줄로 접힌다. 글자 수에 따라 크기를 낮춰 한 줄에 붙인다.
  const fs = s => (s.length >= 7 ? 14 : s.length >= 6 ? 16 : s.length >= 5 ? 17 : 19);
  // est/act 는 기본적으로 언어 공통이지만, '18.1억'·'7.0만' 처럼 한글 단위가 붙는 값이 있다.
  // 그대로 두면 영어 카드에 한글이 새어 나가므로(실제로 그렇게 나갔다) _ko/_en 쌍을 허용한다.
  // 숫자만 있는 값은 한 필드로 두면 되고, 단위가 한글인 값에만 쌍을 넣으면 된다.
  const val = (r, k) => t(r[`${k}_ko`] ?? r[k], r[`${k}_en`] ?? r[k]);
  return `<div class="pad">
  ${bar()}${title(t('이번 주 발표 결과', 'What came in'), t('예상 → 실제', 'Forecast → Actual'))}
  <div style="display:grid;grid-template-columns:repeat(${data.calendar.length},1fr);gap:9px;flex:1">
    ${data.calendar.map(d => `<div style="display:flex;flex-direction:column;gap:7px;min-width:0">
      <div style="background:${P.ink};color:${P.paper};border-radius:12px;padding:9px 6px;text-align:center;font-size:20px;font-weight:800">${t(d.day_ko, d.day_en)}</div>
      ${d.rows.map(r => { const col = r.dir > 0 ? P.up : r.dir < 0 ? P.dn : '#8d8677';
        const est = val(r, 'est'), act = val(r, 'act');
        return `<div class="blk" style="padding:9px 10px 8px;min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;gap:5px">
        <div style="font-size:17px;font-weight:800;line-height:1.2">${t(r.name_ko, r.name_en)}</div>
        <div style="display:flex;align-items:center;gap:5px;min-width:0">
          <div class="num" style="flex:1;min-width:0;text-align:center;font-size:${Math.min(fs(est), 16)}px;color:${P.mute};font-weight:700;
               background:${P.paper};border-radius:7px;padding:3px 2px;white-space:nowrap;overflow:hidden">${est}</div>
          <div style="flex:none;font-size:15px;font-weight:800;color:${col}">→</div>
          <div class="num" style="flex:1;min-width:0;text-align:center;font-size:${fs(act)}px;font-weight:800;color:#fff;
               background:${col};border-radius:7px;padding:3px 2px;white-space:nowrap;overflow:hidden">${act}</div>
        </div></div>`; }).join('')}</div>`).join('')}
  </div>
  <div style="font-size:19px;color:${P.mute};margin-top:13px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <span style="display:flex;align-items:center;gap:7px"><i style="width:15px;height:15px;border-radius:4px;background:${P.paper};border:1px solid ${P.line};display:inline-block"></i>${t('예상', 'Forecast')}</span>
    <span style="display:flex;align-items:center;gap:7px"><i style="width:15px;height:15px;border-radius:4px;background:${P.up};display:inline-block"></i>${t('실제 — 예상보다 높음', 'Actual — above forecast')}</span>
    <span style="display:flex;align-items:center;gap:7px"><i style="width:15px;height:15px;border-radius:4px;background:${P.dn};display:inline-block"></i>${t('예상보다 낮음', 'Below forecast')}</span>
    <span>${t('※ 좋고 나쁨이 아니라 방향만 표시 · 기업은 주당순이익(EPS)', '※ Direction only, not good/bad · company figures are EPS')}</span>
  </div></div>`;
}

/* ═════════ ⑥ ⑨ 뉴스 블록 — 서식 30 ═════════ */
// 반도체에는 쓸 만한 이모지가 없다(💾·🖥 는 칩이 아니다). icon:"chip" 이면 이 SVG 를 쓴다.
const CHIP_SVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${P.accent}" stroke-width="1.7"
  stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="1.6"/>
  <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/></svg>`;
const mark = n => (n.icon === 'chip'
  ? `<div style="width:38px;height:38px;border-radius:11px;background:${P.accent}1a;display:grid;place-items:center">${CHIP_SVG}</div>`
  : n.emoji);
const newsBlock = (i, n) => `<div class="blk" style="padding:22px 26px;flex:1;min-height:0;display:flex;gap:16px;align-items:center">
  ${numBadge(i)}
  <div style="flex:1;min-width:0">
    <div style="display:flex;gap:11px;align-items:center;margin-bottom:8px">
      <div style="font-size:28px;line-height:1.15;flex:none">${mark(n)}</div>
      <div style="flex:1;min-width:0;font-size:29px;font-weight:800;line-height:1.26;letter-spacing:-.03em">${t(n.headline_ko, n.headline_en)}</div>
    </div>
    <div style="font-size:22px;line-height:1.5;color:#4a453c">${t(n.body_ko, n.body_en)}</div>
    <div style="font-size:18px;color:${P.mute};margin-top:9px">${n.src}</div>
  </div></div>`;

const cardNews = key => () => {
  const s = data[key];
  return `<div class="pad">
  ${bar()}${title(t(s.title_ko, s.title_en), t(s.sub_ko, s.sub_en))}
  <div style="display:flex;flex-direction:column;gap:14px;flex:1">
    ${s.items.map((n, i) => newsBlock(i + 1, n)).join('')}
  </div>
  ${note(t(s.note_ko, s.note_en))}</div>`;
};

/* ═════════ ⑦ 섹터 등락 — 서식 27 ═════════ */
function cardSectors() {
  const mx = Math.max(...data.sectors.map(s => Math.abs(s.value)));
  // 라벨 칸과 막대 칸을 flex 로 완전히 분리한다. 절대배치로 두면 음수 막대가
  // 라벨 영역을 덮어써 글자가 뒤섞인다 — 평일 렌더러에도 같은 사고 기록이 있다.
  // 막대 최대폭 29% 는 막대칸(약 652px) 안에서 수치 라벨까지 들어가는 상한이다.
  return `<div class="pad">
  ${bar()}${title(t('주간 섹터 등락', 'Sectors'), t(data.sectorsSub_ko, data.sectorsSub_en))}
  ${dashHead([[t('섹터', 'SECTOR'), 'width:252px;text-align:right'], [t('하락 ← 0 → 상승', 'DOWN ← 0 → UP'), 'flex:1;text-align:center;letter-spacing:.06em']])}
  <div class="blk" style="padding:20px 30px;flex:1;min-height:0;display:flex;flex-direction:column;gap:2px">
    ${data.sectors.map(s => {
      const w = Math.abs(s.value) / mx * 29, col = UPDN(s.value), up = s.value >= 0;
      return `<div style="display:flex;align-items:center;flex:1;min-height:0;gap:14px">
        <div style="width:238px;flex:none;text-align:right;font-size:23px;font-weight:700">${t(s.label_ko, s.label_en)}</div>
        <div style="flex:1;position:relative;height:100%;display:flex;align-items:center">
          <div style="position:absolute;left:50%;top:8px;bottom:8px;width:2px;background:${P.line}"></div>
          <div style="position:absolute;${up ? 'left:50%' : 'right:50%'};width:${w}%;height:26px;
               background:${col};border-radius:${up ? '0 6px 6px 0' : '6px 0 0 6px'}"></div>
          <div class="num" style="position:absolute;${up ? `left:calc(50% + ${w}% + 12px)` : `right:calc(50% + ${w}% + 12px)`};
               font-size:22px;font-weight:800;color:${col};white-space:nowrap">${pct(s.value)}</div>
        </div></div>`;
    }).join('')}
  </div>
  ${note(t(data.sectorsNote_ko, data.sectorsNote_en))}</div>`;
}

/* ═════════ ⑧ 대형주 — 서식 27, 좌우 2단 ═════════ */
// 배지: 캐시에 로고가 있으면 로고, 없으면 모노그램. 한국 종목은 로고 캐시가 없어
// 항상 모노그램으로 나간다(CDN 이 미국 티커만 준다).
// 로고 배지는 흰 바탕에 둔다 — 브랜드색 위에 얹으면 로고 자체 색과 부딪힌다.
function badge(s) {
  const L = s.logo && LOGOS[s.logo];
  if (L) {
    return `<div style="width:54px;height:54px;border-radius:15px;background:#fff;border:1px solid ${P.line};
      display:grid;place-items:center;flex:none;overflow:hidden;padding:7px">
      <img src="${L.dataUri}" alt="" style="width:100%;height:100%;object-fit:contain;display:block"></div>`;
  }
  const mono = t(s.mono_ko, s.mono_en);
  return `<div style="width:54px;height:54px;border-radius:15px;background:${s.color};color:#fff;display:grid;place-items:center;
    font-size:${mono.length > 2 ? 17 : 21}px;font-weight:800;flex:none;letter-spacing:-.02em">${mono}</div>`;
}
function moverCol(c) {
  return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;gap:10px;font-size:25px;font-weight:800;letter-spacing:-.01em;padding-left:2px">
    <span style="font-size:27px">${c.flag}</span>${t(c.head_ko, c.head_en)}</div>
  ${c.items.map(s => { const col = UPDN(s.pct);
    return `<div class="blk" style="flex:1;min-height:0;padding:22px 24px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;gap:14px;flex:none">
      ${badge(s)}
      <div style="flex:1;min-width:0;font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.2">${t(s.name_ko, s.name_en)}</div>
    </div>
    <div style="flex:1;min-height:0;position:relative">${spark(s.seq, col)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none">
      <div class="num" style="font-size:29px;font-weight:800;letter-spacing:-.02em">${t(s.px_ko, s.px_en)}</div>
      ${chip(pct(s.pct), col, 22)}
    </div>
  </div>`; }).join('')}
</div>`;
}
function cardMovers() {
  const m = data.movers;
  return `<div class="pad">
  ${bar()}${title(t('이번 주 많이 움직인 대형주', 'Biggest movers'), t(`한국·미국 각 ${m.kr.items.length}종목`, `${m.kr.items.length} each, Korea & US`))}
  <div style="display:flex;gap:22px;flex:1;min-height:0">${moverCol(m.kr)}${moverCol(m.us)}</div>
  ${note(t(m.note_ko, m.note_en))}</div>`;
}

/* ═════════ ⑩ 아웃트로 — 서식 30 ═════════ */
function cardOutro() {
  const o = data.outro;
  return `<div class="pad" style="justify-content:center;align-items:center;text-align:center">
  <div class="bd" style="font-size:36px;margin-bottom:44px">luckyon <i>${t('브리핑', 'Briefing')}</i></div>
  <div style="font-size:52px;font-weight:800;line-height:1.32;letter-spacing:-.03em">${t(o.tagline_ko, o.tagline_en)}</div>
  <div style="font-size:29px;font-weight:800;color:${P.accent};margin-top:40px">${t(o.next_ko, o.next_en)}</div>
  <div style="font-size:30px;color:#4a453c;margin-top:46px;line-height:1.5">
    ${t('팔로우하고 놓치지 마세요', 'Follow so you never miss it')}<br>
    🔖 ${t('저장', 'Save')} · 📤 ${t('공유', 'Share')} · 💬 ${t('댓글', 'Comment')}</div>
  <div style="font-size:26px;color:${P.mute};margin-top:52px">@luckyon_77</div>
  <div style="font-size:20px;color:#8d8677;margin-top:18px">${t('정보 제공 목적 · 투자 조언 아님', 'For information only · not investment advice')}</div></div>`;
}

/* ───────── 렌더 ───────── */
// 카드 편성은 고정 10장이다. 인스타 캐러셀 상한이 10장이라 여기서 더 늘릴 수 없다.
const inners = [
  cardCover(), cardIndexWeek(), cardCharts(), cardMetrics(), cardCalendar(),
  cardNews('news')(), cardSectors(), cardMovers(), cardNews('ai')(), cardOutro(),
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pageObj = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
for (let i = 0; i < inners.length; i++) {
  await pageObj.setContent(page(inners[i], i + 1, inners.length), { waitUntil: 'networkidle' });
  const file = path.join(outDir, `card${i + 1}.png`);
  await pageObj.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
console.log(`\n✅ ${lang.toUpperCase()} SAT ${inners.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
