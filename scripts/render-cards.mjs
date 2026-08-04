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

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const session = process.argv[4] || '';
if (!date) { console.error('Usage: node scripts/render-cards.mjs <date> <lang> <session:am|pm|sat|sun>'); process.exit(1); }
if (session && !['am', 'pm', 'sat', 'sun'].includes(session)) { console.error(`session 은 am|pm|sat|sun 중 하나여야 합니다: ${session}`); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const contentFile = session ? `${date}-${session}.json` : `${date}.json`;
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', contentFile), 'utf8'));
const outDir = session
  ? path.join(root, 'cards', date, session, lang)
  : path.join(root, 'cards', date, lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);
const dateLabel = t(data.dateLabel_ko, data.dateLabel_en);

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
  <body>${inner}<div class="foot">luckyon 브리핑</div><div class="pageno">${pageno} / ${total}</div></body></html>`;
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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

  // 투자자별 순매수 — 0을 기준으로 좌우로 뻗는 막대. 사는 쪽 빨강, 파는 쪽 파랑.
  const f = s.flows;
  const flows = f ? (() => {
    const max = Math.max(...f.rows.map(r => Math.abs(r.value)), 0.01);
    const CENTER = 50;
    const rows = f.rows.map(r => {
      const w = Math.abs(r.value) / max * 38;
      const pos = r.value >= 0 ? `left:${CENTER}%; width:${w}%;` : `right:${100 - CENTER}%; width:${w}%;`;
      const radius = r.value >= 0 ? '0 6px 6px 0' : '6px 0 0 6px';
      return `
      <div style="position:relative; height:50px; display:flex; align-items:center;">
        <div style="position:absolute; left:0; width:${CENTER - 22}%; text-align:right; padding-right:16px;
                    font-size:26px; font-weight:700; color:#e8e7e0;">${t(r.label_ko, r.label_en)}</div>
        <div style="position:absolute; ${pos} height:26px; background:${sign(r.value)}; border-radius:${radius};"></div>
        ${w >= 14
          ? `<div style="position:absolute; ${pos} height:26px; display:flex; align-items:center;
                         justify-content:${r.value >= 0 ? 'flex-end' : 'flex-start'}; padding:0 10px;
                         font-size:23px; font-weight:800; color:#0d0d0d; white-space:nowrap;">${r.value > 0 ? '+' : '−'}${Math.abs(r.value).toFixed(1)}${t(f.unit_ko, f.unit_en)}</div>`
          : `<div style="position:absolute; ${r.value >= 0 ? `left:calc(${CENTER}% + ${w}% + 12px)` : `right:calc(${100 - CENTER}% + ${w}% + 12px)`};
                         font-size:25px; font-weight:800; color:${sign(r.value)}; white-space:nowrap;">${r.value > 0 ? '+' : '−'}${Math.abs(r.value).toFixed(1)}${t(f.unit_ko, f.unit_en)}</div>`}
      </div>`;
    }).join('');
    return `
    <div style="margin-top:30px;">
      <div style="font-size:27px; font-weight:800; margin-bottom:14px;">${t(f.label_ko, f.label_en)}</div>
      <div style="position:relative;">
        <div style="position:absolute; left:${CENTER}%; top:0; bottom:0; width:2px; background:#3a3936;"></div>
        ${rows}
      </div>
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
    const inside = w >= 10;
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
function cardRank(s) {
  const rows = (s.rows || []).map((r, i) => `
    <div style="display:flex; align-items:center; gap:20px; padding:19px 26px; background:${i % 2 ? '#151514' : '#1a1a19'}; border-radius:12px; margin-bottom:8px;">
      <span style="font-size:26px; font-weight:800; color:#898781; width:34px;">${i + 1}</span>
      <span style="font-size:30px; font-weight:700; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t(r.name_ko, r.name_en)}</span>
      <span style="font-size:29px; font-weight:800; font-variant-numeric:tabular-nums;">${r.value}</span>
      ${r.pct != null ? `<span style="font-size:26px; font-weight:800; color:${sign(r.pct)}; width:130px; text-align:right; font-variant-numeric:tabular-nums;">${fmtPct(r.pct)}</span>` : ''}
    </div>`).join('');

  const sh = s.share;
  const shareBar = sh ? `
    <div style="margin-top:28px;">
      <div style="font-size:26px; font-weight:800; margin-bottom:12px;">${t(sh.label_ko, sh.label_en)}</div>
      <div style="display:flex; gap:2px; height:40px; border-radius:8px; overflow:hidden; background:#0d0d0d;">
        ${sh.segments.map(g => `<div style="width:${g.pct}%; background:${g.color}; height:100%;
            display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:#0d0d0d;">${g.pct >= 12 ? g.pct.toFixed(1) + '%' : ''}</div>`).join('')}
      </div>
      <div style="display:flex; gap:24px; margin-top:12px; font-size:23px; color:#a9a89f;">
        ${sh.segments.map(g => `<span><span style="display:inline-block; width:14px; height:14px; border-radius:4px; background:${g.color}; margin-right:8px;"></span>${t(g.label_ko, g.label_en)}</span>`).join('')}
      </div>
    </div>` : '';

  return sectionShell(t(s.title_ko, s.title_en), s.color || '#e0a94f', rows + shareBar, t(s.note_ko, s.note_en));
}

function cardSchedule() {
  const hours = data.market_hours;
  const hoursLines = t(hours.lines_ko, hours.lines_en)
    .map(l => `<div style="font-size:28px; line-height:1.55; color:#d7d6cf;">${l}</div>`).join('');
  // 운영시간이 평소와 같은 날에는 '정규장 개장' 같은 항목을 따로 두지 않는다.
  // 바로 위 운영시간 안내에 이미 들어 있어 칸만 차지한다. 휴장·조기폐장처럼
  // 평소와 다른 날은 market_hours.lines_ko/en 배열에 안내 줄을 추가해 알린다
  // (별도 필드 없음 — ROUTINE_PROMPT.md 의 market_hours 문서 참고).
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
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
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
      <div class="brand" style="font-size:40px; margin-bottom:40px;">luckyon<span class="k"> 브리핑</span></div>
      <div style="font-size:52px; font-weight:800; line-height:1.3;">${t(data.outro_tagline_ko, data.outro_tagline_en) || t('매일 아침·저녁, 경제와 AI를<br>한눈에 정리합니다', 'Economy & AI at a glance,<br>every morning & night')}</div>
      ${nextBrief ? `<div style="font-size:32px; font-weight:700; color:#3987e5; margin-top:36px;">${nextBrief}</div>` : ''}
      <div style="font-size:34px; color:#c3c2b7; margin-top:44px; line-height:1.5;">${t('팔로우하고 놓치지 마세요', 'Follow so you never miss it')}<br>🔖 ${t('저장', 'Save')} · 📤 ${t('공유', 'Share')} · 💬 ${t('댓글', 'Comment')}</div>
      <div style="font-size:28px; color:#898781; margin-top:56px;">@luckyon_77</div>
      <div style="font-size:22px; color:#57564f; margin-top:20px;">${t('정보 제공 목적 · 투자 조언 아님', 'For information only · not investment advice')}</div>
    </div>`;
}

// 본문 카드는 sections 가 있으면 그것을 따르고, 없으면 기존 econ/ai 6+6 구성으로 그린다.
// (구버전 content/*.json 을 그대로 다시 렌더할 수 있어야 하므로 폴백을 남긴다.)
const SECTION_RENDERERS = { stats: cardStats, bars: cardBars, rank: cardRank };
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
