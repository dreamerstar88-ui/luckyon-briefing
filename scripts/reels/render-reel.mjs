// render-reel.mjs
// data/reels/<stamp>.json 을 읽어 인스타 릴스용 세로 영상(1080x1920)을 만든다.
//
// 컨셉: "장 보다가 스마트폰으로 차트를 찍어서, 그 위에 펜으로 혼잣말을 갈겨쓴 화면"
//   - 차트가 화면을 꽉 채운다 (정보 카드 아님)
//   - 손글씨는 '그날 차트가 비워 둔 자리'에 쓴다. 캔들이 아래로 흐르면 위쪽 여백에,
//     위로 오르면 아래쪽 여백에 — 매일 위치가 달라진다.
//
// 사용법: node scripts/reels/render-reel.mjs <stamp|latest> [ko|en]
// 산출물: cards/reels/<date>/<lang>/reel.mp4 (+ cover.png)

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildComment } from './comment.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const dataDir = path.join(root, 'data', 'reels');

// 스탬프를 생략하면 마지막으로 수집한 구간을 쓴다
let stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp || stamp === 'latest') {
  const p = path.join(dataDir, 'latest.txt');
  if (!fs.existsSync(p)) {
    console.error('Usage: node scripts/reels/render-reel.mjs <stamp|latest> [ko|en]');
    console.error('  (먼저 scripts/reels/fetch-window.mjs 를 실행하세요)');
    process.exit(1);
  }
  stamp = fs.readFileSync(p, 'utf8').trim();
}

const data = JSON.parse(fs.readFileSync(path.join(dataDir, `${stamp}.json`), 'utf8'));
const outDir = path.join(root, 'cards', 'reels', stamp, lang);
fs.mkdirSync(outDir, { recursive: true });

// 상황 문맥(지표 발표 전 / 방금 나온 뉴스)은 절차서가 JSON 에 넣어 준다.
// atOpen 은 수집 단계에서 판정한 값 — 화법을 개장 직후 / 장 중으로 가른다.
const ctx = { ...(data.context || {}), atOpen: !!data.atOpen };
const t = (ko, en) => (lang === 'ko' ? ko : en);

const nasdaq = data.symbols.nasdaq;
const sp500 = data.symbols.sp500;
const comment = buildComment(nasdaq, sp500, ctx, stamp);
const lines = lang === 'ko' ? comment.ko : comment.en;

// ---------- 타이밍 ----------
const FPS = 30;
const CHART_SEC = 1.4;
const PER_LINE_SEC = 0.8;
const HOLD_SEC = 2.8;
const TOTAL_SEC = CHART_SEC + PER_LINE_SEC * lines.length + HOLD_SEC;
const TOTAL_FRAMES = Math.round(TOTAL_SEC * FPS);

const UP = '#e66767';
const DOWN = '#3987e5';
const PEN = '#ffd54a';

const fontB64 = fs.readFileSync(path.join(root, 'assets', 'fonts', 'NanumPenScript-Korean.woff2')).toString('base64');
const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// epoch(초) → 미 동부시간 "HH:MM"
const etHM = (sec) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(sec * 1000));

// ---------- 차트 기하 ----------
// 화면에서 차트가 차지하는 영역 (상단 헤더 아래 ~ 릴스 UI 가림선 위)
const CHART = { x: 0, y: 300, w: 1080, h: 1230 };
const PAD = { l: 34, r: 158, t: 24, b: 96 };

function geometry(sym) {
  const bars = sym.bars;
  const openPx = bars[0].o;
  let hi = Math.max(...bars.map((b) => b.h), openPx);
  let lo = Math.min(...bars.map((b) => b.l), openPx);
  const pad = (hi - lo) * 0.14 || 1;
  hi += pad; lo -= pad;

  const plotL = PAD.l, plotR = CHART.w - PAD.r;
  const plotT = PAD.t, plotB = CHART.h - PAD.b;
  const colW = (plotR - plotL) / bars.length;
  return {
    bars, openPx, hi, lo, plotL, plotR, plotT, plotB, colW,
    x: (i) => plotL + colW * (i + 0.5),
    y: (p) => plotT + (plotB - plotT) * (1 - (p - lo) / (hi - lo)),
  };
}

// 캔들이 비워 둔 가장 넓은 자리를 찾는다.
// 글자 상자(boxW x boxH)가 들어갈 수 있는 구간을 가로로 훑으며,
// 캔들 위쪽 여백과 아래쪽 여백 중 가장 여유 있는 곳을 고른다.
function findFreeSpot(g, boxW, boxH) {
  const { bars, plotL, plotR, plotT, plotB, colW, y } = g;
  const top = bars.map((b) => y(b.h));   // 값이 작을수록 화면 위
  const bot = bars.map((b) => y(b.l));
  const win = Math.min(bars.length, Math.max(1, Math.ceil(boxW / colW)));

  let best = null;
  for (let i = 0; i + win <= bars.length; i++) {
    const minTop = Math.min(...top.slice(i, i + win));
    const maxBot = Math.max(...bot.slice(i, i + win));
    const above = minTop - plotT;
    const below = plotB - maxBot;
    const left = Math.min(plotL + i * colW, plotR - boxW);

    // 여백이 글자 상자보다 커야 후보가 된다. 여유가 클수록 점수가 높다.
    if (above >= boxH && (!best || above > best.score)) {
      best = { score: above, left, top: plotT + (above - boxH) / 2 };
    }
    if (below >= boxH && (!best || below > best.score)) {
      best = { score: below, left, top: maxBot + (below - boxH) / 2 };
    }
  }
  // 어디에도 안 들어가면 여백이 그나마 큰 쪽에 얹는다 (fits=false → 글자를 줄여 재시도)
  const fits = !!best;
  if (!best) {
    const aboveAll = Math.min(...top) - plotT;
    const belowAll = plotB - Math.max(...bot);
    best = aboveAll >= belowAll
      ? { left: plotL + 16, top: plotT + 10 }
      : { left: plotL + 16, top: plotB - boxH - 10 };
  }
  return {
    fits,
    left: Math.max(plotL + 8, Math.min(best.left, plotR - boxW)),
    top: Math.max(plotT + 8, Math.min(best.top, plotB - boxH)),
  };
}

function chartSvg(g, reveal) {
  const { bars, openPx, plotL, plotR, plotT, plotB, colW, x, y, hi, lo } = g;
  const shown = bars.slice(0, Math.max(1, reveal));
  const cw = Math.max(8, colW * 0.6);

  const grid = [0.25, 0.5, 0.75].map((f) => {
    const gy = plotT + (plotB - plotT) * f;
    const gp = lo + (hi - lo) * (1 - f);
    return `<line x1="${plotL}" y1="${gy.toFixed(1)}" x2="${plotR.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#1f1f1f" stroke-width="1"/>`
      + `<text x="${(plotR + 14).toFixed(1)}" y="${(gy + 10).toFixed(1)}" fill="#565656" font-size="27" font-family="system-ui">${fmt(gp, 0)}</text>`;
  }).join('');

  const yOpen = y(openPx);
  const openLine = `<line x1="${plotL}" y1="${yOpen.toFixed(1)}" x2="${plotR.toFixed(1)}" y2="${yOpen.toFixed(1)}" stroke="#7a7a72" stroke-width="1.6" stroke-dasharray="10 10"/>`;

  const candles = shown.map((b, i) => {
    const col = b.c >= b.o ? UP : DOWN;
    const yo = y(b.o), yc = y(b.c);
    return `<line x1="${x(i).toFixed(1)}" y1="${y(b.h).toFixed(1)}" x2="${x(i).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${col}" stroke-width="2.6"/>`
      + `<rect x="${(x(i) - cw / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(3, Math.abs(yc - yo)).toFixed(1)}" fill="${col}"/>`;
  }).join('');

  const cur = shown[shown.length - 1];
  const yCur = y(cur.c);
  const curCol = cur.c >= openPx ? UP : DOWN;
  const tag = `<line x1="${plotL}" y1="${yCur.toFixed(1)}" x2="${plotR.toFixed(1)}" y2="${yCur.toFixed(1)}" stroke="${curCol}" stroke-width="1.6" opacity="0.65"/>`
    + `<rect x="${(plotR + 6).toFixed(1)}" y="${(yCur - 25).toFixed(1)}" width="140" height="50" rx="5" fill="${curCol}"/>`
    + `<text x="${(plotR + 76).toFixed(1)}" y="${(yCur + 10).toFixed(1)}" fill="#000" font-size="29" font-weight="700" font-family="system-ui" text-anchor="middle">${fmt(cur.c, 0)}</text>`;

  return `<svg width="${CHART.w}" height="${CHART.h}" viewBox="0 0 ${CHART.w} ${CHART.h}" xmlns="http://www.w3.org/2000/svg">${grid}${openLine}${candles}${tag}</svg>`;
}

// 손글씨 상자 크기는 추정하지 않고 브라우저에서 실제로 재서 쓴다.
// (글자폭을 어림하면 줄바꿈이 생겨 배치가 어긋난다.)
// 영어는 같은 내용도 훨씬 넓어지므로, 차트 여백에 들어갈 때까지 크기를 줄인다.
const PEN_SIZES = [86, 78, 70, 63, 56, 50];
let PEN_SIZE = PEN_SIZES[0];
let BOX_W = 600, BOX_H = 300;
const geo = geometry(nasdaq);
let spot = { left: geo.plotL + 16, top: geo.plotT + 16 };

async function measure(page, size) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Pen';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-display:block;}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:1080px;background:#000;}
    .pen{font-family:'Pen';font-size:${size}px;line-height:1.16;display:inline-block;}
    .pen div{white-space:nowrap;}
  </style></head><body>
    <div class="pen" id="m">${lines.map((l, i) => `<div style="margin-left:${[0, 22, 8][i % 3]}px">${l}</div>`).join('')}</div>
  </body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const r = document.getElementById('m').getBoundingClientRect();
    return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  });
}

// 캔들을 가리지 않고 들어갈 수 있는 가장 큰 글자 크기를 고른다
async function fitText(page) {
  let fallback = null;
  for (const size of PEN_SIZES) {
    const m = await measure(page, size);
    const w = m.w + 24, h = m.h + 16;
    const s = findFreeSpot(geo, w, h);
    if (s.fits) return { size, w, h, spot: s };
    if (!fallback) fallback = { size, w, h, spot: s };
  }
  return fallback; // 그래도 안 되면 가장 큰 크기로 얹는다
}

function html(frame) {
  const sec = frame / FPS;
  const cp = Math.min(1, sec / CHART_SEC);
  const reveal = Math.max(1, Math.round((1 - Math.pow(1 - cp, 2)) * nasdaq.bars.length));

  const shown = nasdaq.bars.slice(0, reveal);
  const last = shown[shown.length - 1].c;
  const pct = ((last - nasdaq.bars[0].o) / nasdaq.bars[0].o) * 100;
  const col = pct >= 0 ? UP : DOWN;

  const spShown = sp500.bars.slice(0, reveal);
  const spPct = ((spShown[spShown.length - 1].c - sp500.bars[0].o) / sp500.bars[0].o) * 100;
  const spCol = spPct >= 0 ? UP : DOWN;

  // 시계는 실제로 그려진 마지막 봉의 시각을 보여 준다 (구간이 언제든 상관없이 맞는다)
  const clock = etHM(shown[shown.length - 1].t);

  const penHtml = lines.map((text, i) => {
    const startAt = CHART_SEC + PER_LINE_SEC * i;
    const prog = Math.max(0, Math.min(1, (sec - startAt) / PER_LINE_SEC));
    if (prog <= 0) return '';
    const rot = [-1.7, 0.8, -0.6][i % 3];
    const indent = [0, 22, 8][i % 3];
    return `<div style="margin-left:${indent}px;transform:rotate(${rot}deg);transform-origin:left center;
      clip-path:inset(0 ${((1 - prog) * 100).toFixed(2)}% -20% 0);">${text}</div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Pen';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-display:block;}
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1920px;}
    body{background:#0b0b0b;color:#fff;width:1080px;height:1920px;overflow:hidden;
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}
    .pen{font-family:'Pen';color:${PEN};font-size:${PEN_SIZE}px;line-height:1.16;
      text-shadow:0 2px 10px rgba(0,0,0,0.95),0 0 26px rgba(0,0,0,0.8);}
    .pen > div{white-space:nowrap;}
  </style></head><body>
    <!-- 상단: 앱 화면처럼 종목/현재가 -->
    <div style="padding:126px 34px 0;">
      <div style="display:flex;align-items:baseline;gap:16px;">
        <div style="font-size:46px;font-weight:800;letter-spacing:-0.01em;">${t('나스닥 선물', 'Nasdaq Futures')}</div>
        <div style="font-size:28px;color:#6b6b6b;font-weight:700;">NQ · 1m</div>
        <div style="margin-left:auto;font-size:28px;color:#6b6b6b;font-weight:700;font-variant-numeric:tabular-nums;">${clock} ET</div>
      </div>
      <div style="display:flex;align-items:baseline;gap:20px;margin-top:8px;">
        <div style="font-size:84px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">${fmt(last, 2)}</div>
        <div style="font-size:46px;font-weight:800;color:${col};">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%</div>
      </div>
    </div>

    <!-- 차트 (화면을 꽉 채움) + 그 위에 손글씨 -->
    <div style="position:absolute;left:${CHART.x}px;top:${CHART.y}px;width:${CHART.w}px;height:${CHART.h}px;">
      ${chartSvg(geo, reveal)}
      <div class="pen" style="position:absolute;left:${spot.left.toFixed(0)}px;top:${spot.top.toFixed(0)}px;width:${BOX_W.toFixed(0)}px;">
        ${penHtml}
      </div>
      <!-- 차트 하단: S&P 한 줄 -->
      <div style="position:absolute;left:34px;bottom:16px;display:flex;align-items:baseline;gap:14px;">
        <div style="font-size:31px;font-weight:700;color:#8e8e8e;">${t('S&P 500 선물', 'S&P 500 Futures')}</div>
        <div style="font-size:33px;font-weight:800;font-variant-numeric:tabular-nums;color:#ddd;">${fmt(spShown[spShown.length - 1].c, 2)}</div>
        <div style="font-size:31px;font-weight:800;color:${spCol};">${spPct >= 0 ? '▲' : '▼'} ${Math.abs(spPct).toFixed(2)}%</div>
      </div>
    </div>

    <div style="position:absolute;left:34px;top:${CHART.y + CHART.h + 14}px;font-size:23px;color:#454545;">
      ${t('※ 투자 권유가 아닌 시황 기록', '※ Market log, not investment advice')} · luckyon
    </div>
  </body></html>`;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luckyon-reel-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  console.log(`▶ 릴스 렌더링 [${lang.toUpperCase()}] ${stamp} — ${data.startEt}→${data.endEt} ET`
    + `${data.atOpen ? ' (개장 직후)' : ''} · ${TOTAL_FRAMES}프레임 ${TOTAL_SEC.toFixed(1)}초`);
  console.log(`  펜: ${lines.join(' / ')}`);

  // 글자를 실제로 재서, 캔들을 가리지 않고 들어갈 크기와 자리를 찾는다
  const fit = await fitText(page);
  PEN_SIZE = fit.size; BOX_W = fit.w; BOX_H = fit.h; spot = fit.spot;
  console.log(`  글자 ${PEN_SIZE}px · 상자 ${BOX_W}x${BOX_H} → x=${spot.left.toFixed(0)} y=${spot.top.toFixed(0)}${spot.fits ? '' : ' (여백 부족 — 겹침)'}`);

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    await page.setContent(html(f), { waitUntil: 'load' });
    await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`) });
    if (f % 30 === 0) process.stdout.write(`  ${f}/${TOTAL_FRAMES}\r`);
  }
  fs.copyFileSync(path.join(tmp, `f${String(TOTAL_FRAMES - 1).padStart(4, '0')}.png`), path.join(outDir, 'cover.png'));
  await browser.close();

  const mp4 = path.join(outDir, 'reel.mp4');
  execFileSync(ffmpegPath, [
    '-y', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', mp4,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n✅ ${path.relative(root, mp4)} (${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB)`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
