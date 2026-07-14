// render-cards.mjs
// content/<date>.json 을 읽어 인스타 캐러셀용 카드 PNG(1080x1350)를 생성한다.
// 언어별(ko/en) 7장씩 -> cards/<date>/<lang>/card1..7.png
//
// 사용법: node scripts/render-cards.mjs <date> <lang>
//   예)   node scripts/render-cards.mjs 2026-07-14 ko
//
// 의존성: playwright (chromium)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!date) { console.error('Usage: node scripts/render-cards.mjs <date> <lang>'); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', `${date}.json`), 'utf8'));
const outDir = path.join(root, 'cards', date, lang);
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

function page(inner, pageno) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
  <body>${inner}<div class="foot">luckyon 브리핑</div><div class="pageno">${pageno} / 7</div></body></html>`;
}

// ---------- 카드별 마크업 ----------
function cardHook() {
  return page(`
    <div class="pad">
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:30px; color:#3987e5; font-weight:800; letter-spacing:0.08em; margin-bottom:28px;">${t('오늘의 핵심','TODAY')}</div>
        <div style="font-size:78px; font-weight:800; line-height:1.18; letter-spacing:-0.02em;">${t(data.headline_ko, data.headline_en)}</div>
        <div style="font-size:34px; color:#c3c2b7; margin-top:36px; line-height:1.45;">${t(data.headline_sub_ko, data.headline_sub_en)}</div>
      </div>
      <div style="font-size:26px; color:#898781;">${t('오른쪽으로 넘겨보세요','Swipe to read →')} →</div>
    </div>`, 1);
}

function cardMarkets() {
  const tiles = data.markets.map(m => {
    const c = m.dir === 'up' ? '#e66767' : m.dir === 'down' ? '#3987e5' : '#c3c2b7';
    return `<div style="background:#1a1a19; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px 26px;">
      <div style="font-size:23px; color:#898781; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">${m.label}</div>
      <div style="font-size:40px; font-weight:800; margin-top:8px; font-variant-numeric:tabular-nums;">${m.value}</div>
      <div style="font-size:26px; font-weight:700; color:${c}; margin-top:4px;">${m.delta}</div>
    </div>`;
  }).join('');
  return page(`
    <div class="pad">
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
      <div style="font-size:44px; font-weight:800; margin:36px 0 30px;">${t('시장 한눈에','Markets at a glance')}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">${tiles}</div>
      <div style="font-size:25px; color:#898781; margin-top:28px; line-height:1.5;">※ ${t(data.market_note_ko, data.market_note_en)}</div>
    </div>`, 2);
}

function newsCard(title, items, pageno, dotColor) {
  const blocks = items.map((n, i) => `
    <div style="background:#1a1a19; border-left:6px solid ${dotColor}; border-radius:14px; padding:26px 30px; margin-bottom:20px;">
      <div style="font-size:33px; font-weight:800; line-height:1.35; margin-bottom:12px;">${t(n.headline_ko, n.headline_en)}</div>
      <div style="font-size:27px; line-height:1.5; color:#d7d6cf;">${t(n.body_ko, n.body_en)}</div>
      <div style="font-size:22px; color:#898781; margin-top:14px;">${n.src} · ${n.time}</div>
    </div>`).join('');
  return page(`
    <div class="pad">
      <div class="brandbar"><div class="brand">luckyon<span class="k"> 브리핑</span></div><div class="date">${dateLabel}</div></div>
      <div style="display:flex; align-items:center; gap:16px; margin:32px 0 26px;">
        <span style="width:18px; height:18px; border-radius:50%; background:${dotColor};"></span>
        <span style="font-size:42px; font-weight:800;">${title}</span>
      </div>
      ${blocks}
    </div>`, pageno);
}

function cardOutro() {
  return page(`
    <div class="pad" style="justify-content:center; align-items:center; text-align:center;">
      <div class="brand" style="font-size:40px; margin-bottom:40px;">luckyon<span class="k"> 브리핑</span></div>
      <div style="font-size:52px; font-weight:800; line-height:1.3;">${t('매일 아침, 경제와 AI를<br>한 장으로 정리합니다','Economy & AI,<br>summarized every morning')}</div>
      <div style="font-size:34px; color:#c3c2b7; margin-top:44px; line-height:1.5;">${t('팔로우하고 놓치지 마세요','Follow so you never miss it')}<br>🔖 ${t('저장','Save')} · 📤 ${t('공유','Share')} · 💬 ${t('댓글','Comment')}</div>
      <div style="font-size:28px; color:#898781; margin-top:56px;">@luckyon_77</div>
      <div style="font-size:22px; color:#57564f; margin-top:20px;">${t('정보 제공 목적 · 투자 조언 아님','For information only · not investment advice')}</div>
    </div>`, 7);
}

const cards = [
  cardHook(),
  cardMarkets(),
  newsCard(t('경제 · 금융 ①','Economy ①'), data.econ.slice(0, 3), 3, '#e66767'),
  newsCard(t('경제 · 금융 ②','Economy ②'), data.econ.slice(3, 6), 4, '#e66767'),
  newsCard(t('AI · 테크 ①','AI & Tech ①'), data.ai.slice(0, 3), 5, '#9085e9'),
  newsCard(t('AI · 테크 ②','AI & Tech ②'), data.ai.slice(3, 6), 6, '#9085e9'),
  cardOutro(),
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pageObj = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
for (let i = 0; i < cards.length; i++) {
  await pageObj.setContent(cards[i], { waitUntil: 'networkidle' });
  const file = path.join(outDir, `card${i + 1}.png`);
  await pageObj.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
console.log(`\n✅ ${lang.toUpperCase()} ${cards.length}장 생성 완료 -> cards/${date}/${lang}/`);
