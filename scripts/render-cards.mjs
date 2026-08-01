// render-cards.mjs
// content/<date>-<session>.json 을 읽어 인스타 캐러셀용 카드 PNG(1080x1350)를 생성한다.
// 언어별(ko/en) 8장씩 -> cards/<date>/<session>/<lang>/card1..8.png
//   (1 훅, 2 시장, 3-4 경제, 5-6 AI, 7 주요 일정, 8 아웃트로)
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

function page(inner, pageno, total) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
  <body>${inner}<div class="foot">luckyon 브리핑</div><div class="pageno">${pageno} / ${total}</div></body></html>`;
}

// ---------- 카드별 마크업 ----------
function cardHook() {
  // 호재/악재 분석 블록 (있으면 headline_sub 대신 노출)
  const point = (p, kind) => {
    if (!p) return '';
    const isBull = kind === 'bull';
    const color = isBull ? '#4fbf7b' : '#e66767';
    const arrow = isBull ? '▲' : '▼';
    const label = isBull ? t('호재', 'BULL') : t('악재', 'BEAR');
    return `<div style="background:#1a1a19; border-left:6px solid ${color}; border-radius:14px; padding:24px 28px; margin-top:18px;">
      <div style="font-size:23px; font-weight:800; color:${color}; letter-spacing:0.04em; margin-bottom:12px;">${arrow} ${label}</div>
      <div style="font-size:30px; font-weight:700; line-height:1.42; color:#e8e7e0;">${t(p.body_ko, p.body_en)}</div>
    </div>`;
  };
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
    return `
    <div style="background:#1a1a19; border-left:6px solid ${dotColor}; border-radius:14px; padding:26px 30px; margin-bottom:20px;">
      <div style="font-size:33px; font-weight:800; line-height:1.35; margin-bottom:12px;">${t(n.headline_ko, n.headline_en)}${badge}</div>
      <div style="font-size:27px; line-height:1.5; color:#d7d6cf;">${t(n.body_ko, n.body_en)}</div>
      <div style="font-size:22px; color:#898781; margin-top:14px;">${n.src} · ${n.time}</div>
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

function cardSchedule() {
  const hours = data.market_hours;
  const hoursLines = t(hours.lines_ko, hours.lines_en)
    .map(l => `<div style="font-size:28px; line-height:1.55; color:#d7d6cf;">${l}</div>`).join('');
  const rows = data.schedule.map(s => {
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

const inners = [
  cardHook(),
  cardMarkets(),
  newsCard(t('경제 · 금융 ①', 'Economy ①'), data.econ.slice(0, 3), '#e66767'),
  newsCard(t('경제 · 금융 ②', 'Economy ②'), data.econ.slice(3, 6), '#e66767'),
  newsCard(t('AI · 테크 ①', 'AI & Tech ①'), data.ai.slice(0, 3), '#9085e9'),
  newsCard(t('AI · 테크 ②', 'AI & Tech ②'), data.ai.slice(3, 6), '#9085e9'),
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
