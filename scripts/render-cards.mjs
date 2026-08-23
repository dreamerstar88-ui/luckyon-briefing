// render-cards.mjs
// content/<date>-<session>.json 을 읽어 인스타 캐러셀용 카드 PNG(1080x1350)를 생성한다.
// 언어별(ko/en) 9장씩 -> cards/<date>/<session>/<lang>/card1..9.png
//   (1 훅, 2 시장, 3~7 본문(sections 5장), 8 주요 일정, 9 아웃트로)
//   본문 장수는 sections 배열 길이를 그대로 따르므로 총 장수는 sections.length + 4 다.
//
// 사용법: node scripts/render-cards.mjs <date> <lang> <session>
//   예)   node scripts/render-cards.mjs 2026-07-16 ko am
//   session: am(아침) | pm(저녁) | sat(주간 결산) | sun(다음 주 일정) — 주말 세션은 ROUTINE_PROMPT_WEEKEND.md 참고
//
// session 을 생략하면 구버전 content/<date>.json / cards/<date>/<lang>/ 경로로 동작하며,
// JSON 에 schedule 이 없으면 일정 카드는 건너뛴다(구버전 7장 호환).
//
// 의존성: playwright (chromium)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const session = process.argv[4] || '';
if (!date) { console.error('Usage: node scripts/render-cards.mjs <date> <lang> <session:am|pm|sat|sun>'); process.exit(1); }
if (session && !['am', 'pm', 'sat', 'sun'].includes(session)) { console.error(`session 은 am|pm|sat|sun 중 하나여야 합니다: ${session}`); process.exit(1); }

// 경로에 공백이 있거나 윈도우에서 돌 때 URL.pathname 은 '/C:/…/SJ%20PARK%20Project/…' 를
// 돌려줘 파일을 못 찾는다. fileURLToPath 는 두 경우 모두 올바른 경로를 준다.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentFile = session ? `${date}-${session}.json` : `${date}.json`;
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', contentFile), 'utf8'));
const outDir = session
  ? path.join(root, 'cards', date, session, lang)
  : path.join(root, 'cards', date, lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);
const dateLabel = t(data.dateLabel_ko, data.dateLabel_en);

// 브랜드 표기는 확정 로고 파일을 그대로 쓴다.
// 예전에는 "luckyon <span class=k>브리핑</span>" 처럼 글자로 그렸는데, 로고의 'o' 자리에
// 들어가는 앰버 원판과 그 안의 흰 네잎클로버는 글자로 재현할 수 없다. 글자판은 '브리핑'이
// 파랑이지만 확정 로고는 앰버다 — 색까지 달랐다 (2026-08-23 확인).
// setContent 로 HTML 을 주입하므로 상대경로 이미지는 못 읽는다. base64 로 심는다.
const brandPng = fs.readFileSync(path.join(root, 'assets', 'brand', 'wordmark-briefing.png')).toString('base64');
const BRAND = (h) => `<img src="data:image/png;base64,${brandPng}" style="height:${h}px; display:block;" alt="luckyon 브리핑">`;

// ---------- 공통 스타일 ----------
const BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html,body { width:1080px; height:1350px; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans KR", sans-serif;
    background:#0d0d0d; color:#ffffff; width:1080px; height:1350px;
    display:flex; flex-direction:column; position:relative; overflow:hidden;
  }
  .pad { padding:80px 72px; flex:1; display:flex; flex-direction:column; }
  .brandbar { display:flex; justify-content:space-between; align-items:center; }
  .brand { font-size:30px; font-weight:800; letter-spacing:-0.01em; }
  .brand .k { color:#3987e5; }
  .date { font-size:24px; color:#c3c2b7; font-weight:600; }
  .pageno { position:absolute; bottom:52px; right:72px; font-size:24px; color:#898781; font-weight:700; }
  .foot { position:absolute; bottom:52px; left:72px; font-size:22px; color:#898781; }
  .accent { color:#3987e5; }
`;

// 브랜드 로고·푸터의 "luckyon 브리핑" 은 영어 카드에서도 한글 그대로 둔다.
// t() 로 감싸 "luckyon Briefing" 으로 바꾸지 말 것 — 번역 누락이 아니라
// 브랜드 정체성을 위한 의도된 선택이다 (2026-08-01 확인).
function page(inner, pageno, total) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
  <body>${inner}<div class="foot" style="opacity:0.55;">${BRAND(24)}</div><div class="pageno">${pageno} / ${total}</div></body></html>`;
}

// ---------- 카드별 마크업 ----------
function cardHook() {
  // 호재/악재 분석 블록 (있으면 headline_sub 대신 노출)
  //
  // 일요일(sun) 세션은 "다음 주에 무엇을 볼 것인가"라 아직 일어나지 않은 일정을 다룬다.
  // 예정된 이벤트를 "호재"라고 부르면 결과를 미리 단정하는 예측이 되므로, 이 세션만
  // 라벨을 '기대 요인 / 경계 요인' 으로 바꾼다. 색·화살표(방향성)는 그대로 둔다.
  // 토요일(sat)은 지나간 한 주를 정리하므로 호재/악재 그대로가 맞다.
  const forward = session === 'sun';
  const point = (p, kind) => {
    if (!p) return '';
    const isBull = kind === 'bull';
    const color = isBull ? '#4fbf7b' : '#e66767';
    const arrow = isBull ? '▲' : '▼';
    const label = isBull
      ? (forward ? t('기대 요인', 'TAILWIND') : t('호재', 'BULL'))
      : (forward ? t('경계 요인', 'HEADWIND') : t('악재', 'BEAR'));
    return `<div style="background:#1a1a19; border-left:6px solid ${color}; border-radius:14px; padding:24px 28px; margin-top:18px;">
      <div style="font-size:23px; font-weight:800; color:${color}; letter-spacing:0.04em; margin-bottom:12px;">${arrow} ${label}</div>
      <div style="font-size:30px; font-weight:700; line-height:1.42; color:#e8e7e0;">${t(p.body_ko, p.body_en)}</div>
    </div>`;
  };
  // summary: 그날 증시 결과를 호재/악재로 가르지 않고 한 덩어리로 정리한 글.
  // 호재·악재는 앞으로 벌어질 일의 '재료'를 가리키는 말이라, 이미 나온 결과를
  // 그렇게 나누면 어색하다. summary 가 있으면 hook_bull/hook_bear 대신 이것을 쓴다.
  if (data.summary) {
    const lines = (t(data.summary.lines_ko, data.summary.lines_en) || []);
    return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:30px; color:#3987e5; font-weight:800; letter-spacing:0.08em; margin-bottom:26px;">${
          session === 'pm' ? t('저녁 브리핑', 'EVENING BRIEF')
          : session === 'sat' ? t('주간 결산', 'WEEK IN REVIEW')
          : session === 'sun' ? t('다음 주 미리 보기', 'THE WEEK AHEAD')
          : t('오늘의 핵심', 'TODAY')}</div>
        <div style="font-size:68px; font-weight:800; line-height:1.2; letter-spacing:-0.02em;">${t(data.headline_ko, data.headline_en)}</div>
        <div style="background:#1a1a19; border-radius:16px; padding:30px 34px; margin-top:38px;">
          ${lines.map((l, i) => `<div style="display:flex; gap:16px; ${i ? 'margin-top:18px;' : ''}">
            <span style="color:#3987e5; font-size:30px; font-weight:800; line-height:1.45;">·</span>
            <span style="font-size:30px; font-weight:600; line-height:1.45; color:#e8e7e0;">${l}</span>
          </div>`).join('')}
        </div>
      </div>
      <div style="font-size:26px; color:#898781; margin-bottom:24px;">${t('오른쪽으로 넘겨보세요', 'Swipe to read')} →</div>
    </div>`;
  }

  const sub = `<div style="font-size:34px; color:#c3c2b7; margin-top:36px; line-height:1.45;">${t(data.headline_sub_ko, data.headline_sub_en)}</div>`;
  // 호재·악재가 둘 다 있을 때만 헤드라인을 줄이고 서브헤드라인을 감춘다.
  // 한쪽만 있는 날(예: 뚜렷한 악재만 있는 날)은 박스가 하나뿐이라 서브헤드라인을
  // 함께 남겨야 카드 아래쪽이 비어 보이지 않는다.
  const hookCount = (data.hook_bull ? 1 : 0) + (data.hook_bear ? 1 : 0);
  const points = `${point(data.hook_bull, 'bull')}${point(data.hook_bear, 'bear')}`;
  const analysis = hookCount === 2 ? points
    : hookCount === 1 ? `${sub}${points}`
    : sub;
  return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:30px; color:#3987e5; font-weight:800; letter-spacing:0.08em; margin-bottom:26px;">${
          session === 'pm' ? t('저녁 브리핑', 'EVENING BRIEF')
          : session === 'sat' ? t('주간 결산', 'WEEK IN REVIEW')
          : session === 'sun' ? t('다음 주 미리 보기', 'THE WEEK AHEAD')
          : t('오늘의 핵심', 'TODAY')}</div>
        <div style="font-size:${hookCount === 2 ? '58px' : '78px'}; font-weight:800; line-height:1.2; letter-spacing:-0.02em;">${t(data.headline_ko, data.headline_en)}</div>
        ${analysis}
      </div>
      <div style="font-size:26px; color:#898781; margin-bottom:24px;">${t('오른쪽으로 넘겨보세요', 'Swipe to read')} →</div>
    </div>`;
}

function cardMarkets() {
  const tiles = data.markets.map(m => {
    const c = m.dir === 'up' ? '#e66767' : m.dir === 'down' ? '#3987e5' : '#c3c2b7';
    const note = t(m.note_ko, m.note_en);
    return `<div style="background:#1a1a19; border:1px solid rgba(255,255,255,0.08); border-radius:15px; padding:16px 24px; display:flex; flex-direction:column; justify-content:center;">
      <div style="font-size:22px; color:#898781; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">${m.label}</div>
      <div style="display:flex; align-items:baseline; gap:10px; margin-top:6px; flex-wrap:wrap;">
        <div style="font-size:37px; font-weight:800; font-variant-numeric:tabular-nums;">${m.value}${m.value_sub ? `<span style="font-size:19px; font-weight:600; color:#898781; margin-left:8px;">${m.value_sub}</span>` : ''}</div>
        <div style="font-size:23px; font-weight:700; color:${c};">${m.delta}</div>
      </div>
      ${note ? `<div style="font-size:21px; color:#a9a89f; margin-top:8px; line-height:1.38;">${note}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="font-size:42px; font-weight:800; margin:26px 0 22px;">${t('시장 한눈에', 'Markets at a glance')}</div>
      <div style="flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; grid-auto-rows:1fr; gap:16px;">${tiles}</div>
      <div style="font-size:23px; color:#898781; margin-top:22px; margin-bottom:30px; line-height:1.5;">※ ${t(data.market_note_ko, data.market_note_en)}</div>
    </div>`;
}

function newsCard(title, items, dotColor) {
  const blocks = items.map(n => {
    const badge = n.catchup
      ? `<span style="font-size:20px; font-weight:700; color:#e0a94f; background:rgba(224,169,79,0.14); border-radius:8px; padding:4px 12px; margin-left:12px; vertical-align:middle; white-space:nowrap;">${t('아침 브리핑 보충', 'Catch-up')}</span>`
      : '';
    // 기록·지표 항목은 출처나 시각이 없을 수 있다 (우리가 직접 계산한 값).
    const meta = [n.src, n.time].filter(Boolean).join(' · ');
    return `
    <div style="background:#1a1a19; border-left:6px solid ${dotColor}; border-radius:14px; padding:26px 30px; margin-bottom:20px;">
      <div style="font-size:33px; font-weight:800; line-height:1.35; margin-bottom:12px;">${t(n.headline_ko, n.headline_en)}${badge}</div>
      <div style="font-size:27px; line-height:1.5; color:#d7d6cf;">${t(n.body_ko, n.body_en)}</div>
      ${meta ? `<div style="font-size:22px; color:#898781; margin-top:14px;">${meta}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="display:flex; align-items:center; gap:16px; margin:32px 0 26px;">
        <span style="width:18px; height:18px; border-radius:50%; background:${dotColor};"></span>
        <span style="font-size:42px; font-weight:800;">${title}</span>
      </div>
      ${blocks}
    </div>`;
}

// ---------- 데이터 카드 (문장 대신 수치를 형태로 보여준다) ----------
// 상승 빨강 / 하락 파랑 — 한국 증시에서 쓰는 그대로다. 색약이어도 두 색이 구분되고
// 어두운 배경 위에서 글자가 읽히는지 확인했다.
// 등락은 시장 카드와 같은 ▲/▼ 로 적는다. +/− 부호는 카드마다 표기가 달라 보이므로 쓰지 않는다.
const UP = '#e66767', DOWN = '#3987e5', FLAT = '#6b6a63';
const sign = v => (v > 0 ? UP : v < 0 ? DOWN : FLAT);
const fmtPct = v => `${v > 0 ? '▲' : v < 0 ? '▼' : ''}${Math.abs(v).toFixed(2)}%`;

function sectionShell(title, dotColor, body, note) {
  return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="display:flex; align-items:center; gap:16px; margin:32px 0 30px;">
        <span style="width:18px; height:18px; border-radius:50%; background:${dotColor};"></span>
        <span style="font-size:42px; font-weight:800;">${title}</span>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center; min-height:0;">
        ${body}
        ${note ? `<div style="font-size:25px; color:#a9a89f; line-height:1.5; margin-top:30px;">${note}</div>` : ''}
      </div>
    </div>`;
}

// 큰 숫자 몇 개 + 상승/하락 종목 수 막대. 문장으로 늘어놓지 않는다.
//
// 배치는 `cols` 로 고른다 (기본 2열, 타일이 하나면 1열).
//   cols: 1 -> 가로로 긴 행을 위에서 아래로 쌓는다. 라벨·부연이 왼쪽, 큰 숫자가
//             오른쪽에 붙어 표처럼 읽힌다. 지수 3개처럼 "같은 종류를 순서대로
//             비교하는" 데이터에 맞다.
//   cols: 2 -> 타일을 2열 격자로 놓는다. 성격이 다른 지표를 여러 개(4~6개)
//             늘어놓을 때 맞다.
function cardStats(s) {
  const cols = s.cols || ((s.stats || []).length === 1 ? 1 : 2);
  const wide = cols === 1;
  const tiles = (s.stats || []).map(x => wide ? `
    <div style="background:#1a1a19; border-radius:18px; padding:44px 36px; display:flex; align-items:center; gap:26px;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:29px; color:#898781; font-weight:700; letter-spacing:0.02em;">${t(x.label_ko, x.label_en)}</div>
        ${x.sub_ko || x.sub_en ? `<div style="font-size:24px; color:#a9a89f; margin-top:9px;">${t(x.sub_ko, x.sub_en)}</div>` : ''}
      </div>
      <div style="display:flex; align-items:baseline; gap:14px; white-space:nowrap;">
        <span style="font-size:56px; font-weight:800; letter-spacing:-0.02em;">${x.value}</span>
        ${x.delta ? `<span style="font-size:30px; font-weight:800; color:${x.dir === 'up' ? UP : x.dir === 'down' ? DOWN : FLAT};">${x.delta}</span>` : ''}
      </div>
    </div>` : `
    <div style="background:#1a1a19; border-radius:16px; padding:26px 30px; min-width:0;">
      <div style="font-size:24px; color:#898781; font-weight:700; letter-spacing:0.02em;">${t(x.label_ko, x.label_en)}</div>
      <div style="display:flex; align-items:baseline; gap:14px; margin-top:10px; flex-wrap:wrap;">
        <span style="font-size:56px; font-weight:800; letter-spacing:-0.02em;">${x.value}</span>
        ${x.delta ? `<span style="font-size:30px; font-weight:800; color:${x.dir === 'up' ? UP : x.dir === 'down' ? DOWN : FLAT};">${x.delta}</span>` : ''}
      </div>
      ${x.sub_ko || x.sub_en ? `<div style="font-size:23px; color:#a9a89f; margin-top:8px;">${t(x.sub_ko, x.sub_en)}</div>` : ''}
    </div>`).join('');

  const breadth = (s.breadth || []).map(b => {
    const total = b.up + b.flat + b.down || 1;
    const seg = (n, c) => `<div style="width:${(n / total * 100).toFixed(2)}%; background:${c}; height:100%;"></div>`;
    return `
    <div style="margin-top:26px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
        <span style="font-size:27px; font-weight:800;">${t(b.label_ko, b.label_en)}</span>
        <span style="font-size:25px; color:#a9a89f;">
          <b style="color:${UP};">▲ ${b.up.toLocaleString()}</b> &nbsp; ${b.flat.toLocaleString()} &nbsp; <b style="color:${DOWN};">▼ ${b.down.toLocaleString()}</b>
        </span>
      </div>
      <div style="display:flex; gap:2px; height:36px; border-radius:8px; overflow:hidden; background:#0d0d0d;">
        ${seg(b.up, UP)}${seg(b.flat, FLAT)}${seg(b.down, DOWN)}
      </div>
    </div>`;
  }).join('');

  // 투자자별 순매수 — 라벨+값은 flex 행(겹침 불가), 그 아래 0 기준 발산 막대는 순수 시각용(텍스트 없음).
  // 예전에는 값 텍스트를 막대 위에 겹쳐 그렸으나, 카드가 1080px 논리 뷰포트라 폭이 좁아
  // 라벨 칸과 값 텍스트가 만나는 위치 계산이 값·언어(한글/영문 단위 폭 차이)마다 달라져
  // 자꾸 겹치는 사고가 났다(2026-08-14 확인). flex 행은 브라우저가 폭을 알아서 나눠주므로
  // 이 종류의 겹침이 구조적으로 발생하지 않는다.
  const f = s.flows;
  const flows = f ? (() => {
    const max = Math.max(...f.rows.map(r => Math.abs(r.value)), 0.01);
    const CENTER = 50;
    const rows = f.rows.map(r => {
      const w = Math.abs(r.value) / max * (CENTER - 4);
      const pos = r.value >= 0 ? `left:${CENTER}%; width:${w}%;` : `right:${100 - CENTER}%; width:${w}%;`;
      const radius = r.value >= 0 ? '0 4px 4px 0' : '4px 0 0 4px';
      return `
      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
          <span style="font-size:26px; font-weight:700; color:#e8e7e0;">${t(r.label_ko, r.label_en)}</span>
          <span style="font-size:25px; font-weight:800; color:${sign(r.value)}; white-space:nowrap;">${r.value > 0 ? '+' : '−'}${Math.abs(r.value).toFixed(1)}${t(f.unit_ko, f.unit_en)}</span>
        </div>
        <div style="position:relative; height:14px;">
          <div style="position:absolute; left:${CENTER}%; top:0; bottom:0; width:2px; background:#3a3936;"></div>
          <div style="position:absolute; ${pos} height:14px; background:${sign(r.value)}; border-radius:${radius};"></div>
        </div>
      </div>`;
    }).join('');
    return `
    <div style="margin-top:30px;">
      <div style="font-size:27px; font-weight:800; margin-bottom:14px;">${t(f.label_ko, f.label_en)}</div>
      ${rows}
    </div>`;
  })() : '';

  return sectionShell(t(s.title_ko, s.title_en), s.color || UP,
    `<div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:18px;">${tiles}</div>${breadth}${flows}`,
    t(s.note_ko, s.note_en));
}

// 0을 기준으로 좌우로 뻗는 발산 막대. 업종별 등락처럼 부호가 핵심인 데이터용.
function cardBars(s) {
  const rows = s.bars || [];
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 0.01);
  const CENTER = 52;                      // 0선의 가로 위치(%)
  const body = rows.map(r => {
    const w = Math.abs(r.value) / max * (r.value > 0 ? 100 - CENTER - 12 : CENTER - 26);
    const pos = r.value >= 0
      ? `left:${CENTER}%; width:${w}%;`
      : `right:${100 - CENTER}%; width:${w}%;`;
    const radius = r.value >= 0 ? '0 6px 6px 0' : '6px 0 0 6px';
    // 막대가 충분히 길면 수치를 막대 안에 넣는다. 밖에 두면 긴 막대에서 업종명과 겹친다.
    // 음수 쪽은 최대폭이 CENTER-26(%)로 양수 쪽(100-CENTER-12)보다 훨씬 좁다. 전체 최댓값이
    // 양수 쪽에서 나온 날(흔한 경우)은 같은 절대 %fmt 임계값을 쓰면 음수 막대가 라벨 텍스트보다
    // 좁은 상자에 갇혀 겹치거나 축선을 침범한다 — 음수 쪽만 임계값을 높여 그 구간을 "밖" 표기로 돌린다.
    const inside = r.value >= 0 ? w >= 10 : w >= 14;
    const label = inside
      ? `<div style="position:absolute; ${pos} height:26px; display:flex; align-items:center;
                     justify-content:${r.value >= 0 ? 'flex-end' : 'flex-start'}; padding:0 10px;
                     font-size:23px; font-weight:800; color:#0d0d0d; white-space:nowrap;">${fmtPct(r.value)}</div>`
      : `<div style="position:absolute; ${r.value >= 0 ? `left:calc(${CENTER}% + ${w}% + 12px)` : `right:calc(${100 - CENTER}% + ${w}% + 12px)`};
                     font-size:25px; font-weight:800; color:${sign(r.value)}; white-space:nowrap;">${fmtPct(r.value)}</div>`;
    return `
    <div style="position:relative; height:52px; display:flex; align-items:center;">
      <div style="position:absolute; left:0; width:${CENTER - 26}%; text-align:right; padding-right:16px;
                  font-size:26px; font-weight:700; color:#e8e7e0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(r.label_ko, r.label_en)}</div>
      <div style="position:absolute; ${pos} height:26px; background:${sign(r.value)}; border-radius:${radius};"></div>
      ${label}
    </div>`;
  }).join('');
  const axis = `<div style="position:absolute; left:${CENTER}%; top:0; bottom:0; width:2px; background:#3a3936;"></div>`;
  return sectionShell(t(s.title_ko, s.title_en), s.color || '#e0a94f',
    `<div style="position:relative;">${axis}${body}</div>`, t(s.note_ko, s.note_en));
}

// 순위 표 + 구성비 띠. 상위 몇 종목이 얼마나 차지했는지를 한눈에.
//
// 열 구성: 순위 · 이름 · 값 · 등락률 · 공매도 비중(rows 에 short 가 있을 때만).
// 공매도 비중은 미국장 카드에서 쓴다. FINRA 일별 공매도 거래량 기준이라 시장조성자
// 헤지가 대량 섞여 있고, 어느 날이든 전체 합산이 45~50% 에서 움직인다. 절대값에는
// 정보가 없으므로 **같은 날 종목 사이의 차이**로만 읽는다
// (scripts/fetch-us-flows.mjs 머리주석 참고).
function cardRank(s) {
  const hasShort = (s.rows || []).some(r => r.short != null);
  const head = `
    <div style="display:flex; align-items:center; gap:20px; padding:0 26px 12px; font-size:21px; color:#57564f; font-weight:700; white-space:nowrap;">
      <span style="width:34px;"></span>
      <span style="flex:1; min-width:0;">${t(s.col_name_ko || '종목', s.col_name_en || 'Name')}</span>
      <span style="width:200px; text-align:right;">${t(s.col_value_ko || '거래대금', s.col_value_en || 'Value')}</span>
      <span style="width:130px; text-align:right;">${t('등락률', 'Change')}</span>
      ${hasShort ? `<span style="width:130px; text-align:right;">${t('공매도 비중', 'Short %')}</span>` : ''}
    </div>`;

  const rows = (s.rows || []).map((r, i) => `
    <div style="display:flex; align-items:center; gap:20px; padding:17px 26px; background:${i % 2 ? '#151514' : '#1a1a19'}; border-radius:12px; margin-bottom:7px;">
      <span style="font-size:26px; font-weight:800; color:#898781; width:34px;">${i + 1}</span>
      <span style="font-size:29px; font-weight:700; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(r.name_ko, r.name_en)}</span>
      <span style="font-size:28px; font-weight:800; width:200px; text-align:right; font-variant-numeric:tabular-nums;">${r.value}</span>
      <span style="font-size:26px; font-weight:800; width:130px; text-align:right; font-variant-numeric:tabular-nums; color:${r.pct != null ? sign(r.pct) : '#57564f'};">${r.pct != null ? fmtPct(r.pct) : '—'}</span>
      ${hasShort ? `<span style="font-size:26px; font-weight:800; width:130px; text-align:right; font-variant-numeric:tabular-nums; color:#c3c2b7;">${r.short != null ? r.short.toFixed(1) + '%' : '—'}</span>` : ''}
    </div>`).join('');

  const sh = s.share;
  const legend = segs => `<div style="display:flex; gap:24px; margin-top:12px; font-size:23px; color:#a9a89f;">
      ${segs.map(g => `<span><span style="display:inline-block; width:14px; height:14px; border-radius:4px; background:${g.color}; margin-right:8px;"></span>${t(g.label_ko, g.label_en)}</span>`).join('')}
    </div>`;

  // mode:'nested'(기본) — 하나의 전체를 조각으로 나눈 값. 합이 100 이라 한 줄에 이어 붙인다.
  const nested = x => `
    <div style="display:flex; gap:2px; height:40px; border-radius:8px; overflow:hidden; background:#0d0d0d;">
      ${x.segments.map(g => `<div style="width:${g.pct}%; background:${g.color}; height:100%; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:#0d0d0d;">${g.pct >= 12 ? g.pct.toFixed(1) + '%' : ''}</div>`).join('')}
    </div>${legend(x.segments)}`;

  // mode:'compare' — 서로 독립인 비율(예: 종목별 공매도 비중). 각자 0~100 축 위의 제 막대로 그린다.
  // nested 처럼 한 줄에 이어 붙이면 조각 사이에 구분선이 생겨 "합쳐서 100%" 로 읽힌다.
  // 47.5% 와 60.1% 를 나란히 붙이면 합이 107% 인 그림이 나온다 — 완전히 틀린 표현이다
  // (2026-08-22 확인). baseline 을 주면 견줄 기준선(표본 평균)을 함께 세운다.
  const compare = x => `
    ${x.segments.map(g => `
      <div style="display:flex; align-items:center; gap:18px; margin-bottom:11px;">
        <span style="width:220px; font-size:25px; font-weight:700; color:#e8e7e0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(g.label_ko, g.label_en)}</span>
        <div style="flex:1; position:relative; height:26px; background:#0d0d0d; border-radius:6px; overflow:hidden;">
          <div style="position:absolute; left:0; top:0; bottom:0; width:${g.pct}%; background:${g.color}; border-radius:6px;"></div>
          ${x.baseline != null ? `<div style="position:absolute; left:${x.baseline}%; top:0; bottom:0; width:2px; background:#8a8880;"></div>` : ''}
        </div>
        <span style="width:96px; text-align:right; font-size:25px; font-weight:800; font-variant-numeric:tabular-nums;">${g.pct.toFixed(1)}%</span>
      </div>`).join('')}
    ${x.baseline != null ? `<div style="font-size:22px; color:#898781; margin-top:8px;">│ ${t(x.baseline_label_ko || '표본 평균', x.baseline_label_en || 'Sample average')} ${x.baseline.toFixed(1)}%</div>` : ''}`;

  const shareBar = sh ? `
    <div style="margin-top:26px;">
      <div style="font-size:26px; font-weight:800; margin-bottom:14px;">${t(sh.label_ko, sh.label_en)}</div>
      ${sh.mode === 'compare' ? compare(sh) : nested(sh)}
    </div>` : '';

  return sectionShell(t(s.title_ko, s.title_en), s.color || '#e0a94f', head + rows + shareBar, t(s.note_ko, s.note_en));
}

// 실적 · 지표 발표. 발표된 숫자(실측)를 시장 예상과 나란히 놓아 "예상보다 좋았나" 가
// 한눈에 보이게 한다. 문장으로 풀면 카드 한 장에 서너 건밖에 못 담는다.
//
// 한국 항목을 먼저 둔다 — 한국 독자가 보는 카드이므로 region:'KR' 을 위로 올린다.
// 미국 실적 실측치는 Alpha Vantage EARNINGS 의 reportedEPS·estimatedEPS·surprisePercentage,
// 한국 실적은 공시(DART), 한국 지표는 ECOS·KOSIS 에서 온다
// (scripts/fetch-kr-trade.mjs 가 수출입을 뽑아 준다).
function cardEcon(s) {
  const rows = [...(s.rows || [])].sort((a, b) => (a.region === 'KR' ? 0 : 1) - (b.region === 'KR' ? 0 : 1));

  // '실측'·'예상' 은 열 제목으로 한 번만 쓴다. 행마다 되풀이하면 다섯 줄이면 열 번이 찍혀
  // 정작 읽어야 할 숫자를 가린다 (2026-08-23 확인).
  //
  // 마지막 열은 기본이 '예상 대비'(서프라이즈)지만, 예상치가 없는 지표는 전년동월 대비
  // 증감률이 들어간다. 그럴 때는 col_delta_ko 로 열 제목을 바꾸고, 각 행의 sub 에
  // 무엇과 견준 값인지 적는다.
  const head = `
    <div style="display:flex; align-items:center; gap:18px; padding:0 24px 12px; font-size:21px; color:#57564f; font-weight:700; white-space:nowrap;">
      <span style="width:52px;"></span>
      <span style="flex:1; min-width:0;">${t(s.col_name_ko || '발표 항목', s.col_name_en || 'Item')}</span>
      <span style="width:150px; text-align:right;">${t('실측', 'Actual')}</span>
      <span style="width:130px; text-align:right;">${t('예상', 'Est.')}</span>
      <span style="width:150px; text-align:right;">${t(s.col_delta_ko || '예상 대비', s.col_delta_en || 'vs Est.')}</span>
    </div>`;

  const body = rows.map((r, i) => `
    <div style="display:flex; align-items:center; gap:18px; padding:20px 24px; background:${i % 2 ? '#151514' : '#1a1a19'}; border-radius:12px; margin-bottom:8px;">
      <span style="width:52px; font-size:20px; font-weight:800; color:#57564f;">${r.region === 'KR' ? t('한국', 'KR') : t('미국', 'US')}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-size:28px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(r.name_ko, r.name_en)}</div>
        ${r.sub_ko || r.sub_en ? `<div style="font-size:22px; color:#898781; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(r.sub_ko, r.sub_en)}</div>` : ''}
      </div>
      <span style="width:150px; text-align:right; font-size:29px; font-weight:800; font-variant-numeric:tabular-nums;">${r.actual}</span>
      <span style="width:130px; text-align:right; font-size:27px; font-weight:700; color:#a9a89f; font-variant-numeric:tabular-nums;">${r.estimate == null ? '—' : r.estimate}</span>
      <span style="width:150px; text-align:right; font-size:26px; font-weight:800; font-variant-numeric:tabular-nums; color:${r.surprise == null ? '#57564f' : sign(r.surprise)};">${r.surprise == null ? '—' : fmtPct(r.surprise)}</span>
    </div>`).join('');

  return sectionShell(t(s.title_ko, s.title_en), s.color || '#5b8dd6', head + body, t(s.note_ko, s.note_en));
}

function cardSchedule() {
  const hours = data.market_hours;
  const hoursLines = t(hours.lines_ko, hours.lines_en)
    .map(l => `<div style="font-size:28px; line-height:1.55; color:#d7d6cf;">${l}</div>`).join('');
  // 운영시간이 평소와 같은 날에는 '정규장 개장' 같은 항목을 따로 두지 않는다.
  // 바로 위 운영시간 안내에 이미 들어 있어 칸만 차지한다. 휴장·조기폐장처럼
  // 평소와 다른 날은 market_hours.lines_ko/en 배열에 안내 줄을 추가해 알린다
  // (별도 필드 없음 — FORMAT_BRIEFING.md §5 고정 문구의 market_hours 절 참고).
  const ROUTINE_OPEN = /^(미국 증시 정규장 개장|미국 증시 개장|한국 증시 개장|코스피 개장|US Regular Session Opens|US Market Opens|Korea Market Opens|Kospi Opens)$/;
  const rows = data.schedule
    .filter(s => !(ROUTINE_OPEN.test((s.title_ko || '').trim()) || ROUTINE_OPEN.test((s.title_en || '').trim())))
    .map(s => {
    const hi = s.importance === 'high';
    return `
    <div style="display:flex; gap:22px; align-items:flex-start; background:#1a1a19; border-left:6px solid ${hi ? '#e0a94f' : 'rgba(255,255,255,0.14)'}; border-radius:14px; padding:24px 28px; margin-bottom:18px;">
      <div style="min-width:170px; font-size:26px; font-weight:800; color:${hi ? '#e0a94f' : '#c3c2b7'}; font-variant-numeric:tabular-nums; padding-top:3px;">${s.time}</div>
      <div style="flex:1;">
        <div style="font-size:30px; font-weight:800; line-height:1.35;">${t(s.title_ko, s.title_en)}${hi ? `<span style="font-size:20px; font-weight:700; color:#e0a94f; background:rgba(224,169,79,0.14); border-radius:8px; padding:4px 12px; margin-left:12px; vertical-align:middle;">${t('주목', 'Watch')}</span>` : ''}</div>
        ${s.detail_ko || s.detail_en ? `<div style="font-size:25px; line-height:1.5; color:#a9a89f; margin-top:8px;">${t(s.detail_ko, s.detail_en)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `
    <div class="pad">
      <div class="brandbar">${BRAND(34)}<div class="date">${dateLabel}</div></div>
      <div style="display:flex; align-items:center; gap:16px; margin:32px 0 26px;">
        <span style="width:18px; height:18px; border-radius:50%; background:#e0a94f;"></span>
        <span style="font-size:42px; font-weight:800;">${t(data.schedule_title_ko, data.schedule_title_en)}</span>
      </div>
      <div style="background:rgba(57,135,229,0.10); border:1px solid rgba(57,135,229,0.35); border-radius:16px; padding:26px 30px; margin-bottom:26px;">
        <div style="font-size:26px; font-weight:800; color:#3987e5; margin-bottom:10px;">🕘 ${t(hours.title_ko, hours.title_en)}</div>
        ${hoursLines}
      </div>
      ${rows}
    </div>`;
}

function cardOutro() {
  const nextBrief = t(data.next_brief_ko, data.next_brief_en);
  return `
    <div class="pad" style="justify-content:center; align-items:center; text-align:center;">
      <div style="margin-bottom:40px;">${BRAND(58)}</div>
      <div style="font-size:52px; font-weight:800; line-height:1.3;">${t(data.outro_tagline_ko, data.outro_tagline_en) || t('매일 아침·저녁, 경제와 AI를<br>한눈에 정리합니다', 'Economy & AI at a glance,<br>every morning & night')}</div>
      ${nextBrief ? `<div style="font-size:32px; font-weight:700; color:#3987e5; margin-top:36px;">${nextBrief}</div>` : ''}
      <div style="font-size:34px; color:#c3c2b7; margin-top:44px; line-height:1.5;">${t('팔로우하고 놓치지 마세요', 'Follow so you never miss it')}<br>🔖 ${t('저장', 'Save')} · 📤 ${t('공유', 'Share')} · 💬 ${t('댓글', 'Comment')}</div>
      <div style="font-size:28px; color:#898781; margin-top:56px;">@luckyon_77</div>
      <div style="font-size:22px; color:#57564f; margin-top:20px;">${t('정보 제공 목적 · 투자 조언 아님', 'For information only · not investment advice')}</div>
    </div>`;
}

// 본문 카드는 sections 가 있으면 그것을 따르고, 없으면 기존 econ/ai 6+6 구성으로 그린다.
// (구버전 content/*.json 을 그대로 다시 렌더할 수 있어야 하므로 폴백을 남긴다.)
const SECTION_RENDERERS = { stats: cardStats, bars: cardBars, rank: cardRank, econ: cardEcon };
const bodyCards = Array.isArray(data.sections) && data.sections.length
  ? data.sections.map(s => (SECTION_RENDERERS[s.type] || (x => newsCard(t(x.title_ko, x.title_en), x.items || [], x.color || '#e66767')))(s))
  : [
      newsCard(t('경제 · 금융 ①', 'Economy ①'), data.econ.slice(0, 3), '#e66767'),
      newsCard(t('경제 · 금융 ②', 'Economy ②'), data.econ.slice(3, 6), '#e66767'),
      newsCard(t('AI · 테크 ①', 'AI & Tech ①'), data.ai.slice(0, 3), '#9085e9'),
      newsCard(t('AI · 테크 ②', 'AI & Tech ②'), data.ai.slice(3, 6), '#9085e9'),
    ];

const inners = [
  cardHook(),
  cardMarkets(),
  ...bodyCards,
  ...(data.schedule && data.market_hours ? [cardSchedule()] : []),
  cardOutro(),
];
const cards = inners.map((inner, i) => page(inner, i + 1, inners.length));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pageObj = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
for (let i = 0; i < cards.length; i++) {
  await pageObj.setContent(cards[i], { waitUntil: 'networkidle' });
  const file = path.join(outDir, `card${i + 1}.png`);
  await pageObj.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
console.log(`\n✅ ${lang.toUpperCase()}${session ? ' ' + session.toUpperCase() : ''} ${cards.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
