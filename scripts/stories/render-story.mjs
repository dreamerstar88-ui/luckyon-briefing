// render-story.mjs
// data/stories/<stamp>.json 을 읽어 인스타 스토리용 세로 이미지(1080x1920)를 만든다.
// 스토리는 영상이 아니어도 되므로 PNG 한 장만 뽑는다 (ffmpeg 불필요).
//
// 사용법: node scripts/stories/render-story.mjs <stamp> [ko|en]
//   예)   node scripts/stories/render-story.mjs 2026-07-27-week-ahead ko
//
// 산출물: cards/stories/<stamp>/<lang>/story.png

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/stories/render-story.mjs <stamp> [ko|en]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'stories', `${stamp}.json`), 'utf8'));
const outDir = path.join(root, 'cards', 'stories', stamp, lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);
const fontB64 = fs.readFileSync(path.join(root, 'assets', 'fonts', 'NanumPenScript-Korean.woff2')).toString('base64');

const ACCENT = '#3987e5';
const HI = '#e0a94f';   // '주목' 강조색 (브리핑 카드와 동일)
const PEN = '#ffd54a';

// 스토리 UI 안전영역: 위쪽 프로필/닫기, 아래쪽 답장창을 피한다
const SAFE_TOP = 250;
const SAFE_BOTTOM = 250;

function rowHtml(it) {
  const hi = it.highlight;
  return `
  <div style="display:flex;gap:26px;align-items:flex-start;
              background:${hi ? 'rgba(224,169,79,0.10)' : '#161615'};
              border-left:7px solid ${hi ? HI : '#2e2e2c'};
              border-radius:16px;padding:26px 28px;">
    <div style="min-width:186px;">
      <div style="font-size:27px;font-weight:800;color:${hi ? HI : '#8e8c85'};letter-spacing:0.01em;">
        ${t(it.day_ko, it.day_en)}
      </div>
      <div style="font-size:40px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;color:#fff;">
        ${t(it.time_ko, it.time_en)}
      </div>
    </div>
    <div style="flex:1;font-size:34px;font-weight:700;line-height:1.34;color:#e8e7e0;padding-top:4px;">
      ${t(it.title_ko, it.title_en)}
    </div>
  </div>`;
}

function html() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Pen';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-display:block;}
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1920px;}
    body{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans KR",sans-serif;
      background:#0d0d0d;color:#fff;width:1080px;height:1920px;overflow:hidden;}
    .wrap{position:absolute;top:${SAFE_TOP}px;left:0;right:0;bottom:${SAFE_BOTTOM}px;
      padding:0 62px;display:flex;flex-direction:column;}
    .pen{font-family:'Pen';color:${PEN};}
  </style></head><body>
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:32px;font-weight:800;">luckyon<span style="color:${ACCENT};"> ${t('브리핑', 'Briefing')}</span></div>
        <div style="font-size:28px;font-weight:700;color:#8e8c85;font-variant-numeric:tabular-nums;">
          ${t(data.rangeLabel_ko, data.rangeLabel_en)}
        </div>
      </div>

      <div style="margin-top:44px;">
        <div style="font-size:30px;font-weight:800;color:${ACCENT};letter-spacing:0.06em;">
          ${t('미리 보기', 'PREVIEW')}
        </div>
        <div style="font-size:76px;font-weight:800;line-height:1.14;letter-spacing:-0.02em;margin-top:12px;">
          ${t(data.title_ko, data.title_en)}
        </div>
        <div style="font-size:33px;color:#a9a79f;font-weight:600;margin-top:14px;line-height:1.4;">
          ${t(data.subtitle_ko, data.subtitle_en)}
        </div>
      </div>

      <div style="margin-top:40px;display:flex;flex-direction:column;gap:18px;">
        ${data.items.map(rowHtml).join('')}
      </div>

      <div style="margin-top:34px;">
        <div class="pen" style="font-size:60px;transform:rotate(-1.2deg);transform-origin:left center;">
          ${t(data.note_ko, data.note_en)}
        </div>
      </div>

      <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="font-size:24px;color:#6a6a63;line-height:1.5;">
          ${t(data.tzNote_ko, data.tzNote_en)}<br>
          ${t('※ 투자 권유가 아닌 일정 안내', '※ Schedule only, not investment advice')}
        </div>
      </div>
    </div>
  </body></html>`;
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(html(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(outDir, 'story.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`✅ ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
