// render-reel.mjs
// data/reels/<date>-open30.json 을 읽어 인스타 릴스용 세로 영상(1080x1920)을 만든다.
//
// 컨셉: "주린이가 장 보다가 스마트폰으로 차트를 찍어서, 그 위에 펜으로 지금 기분을 갈겨쓴 화면"
//   - 배경은 트레이딩 앱 화면처럼 보이는 캔들 차트 하나 (정보 카드가 아니다)
//   - 그 위에 손글씨가 한 줄씩 '써지듯' 나타난다
//   - 움직임은 최소한. 정지 캡처처럼 보이되 릴스로 올릴 수 있는 영상.
//
// 사용법: node scripts/reels/render-reel.mjs <date> [ko|en]
// 산출물: cards/reels/<date>/<lang>/reel.mp4 (+ cover.png)
//
// 의존성: playwright(chromium), ffmpeg-static

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildComment } from './comment.mjs';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!date) {
  console.error('Usage: node scripts/reels/render-reel.mjs <YYYY-MM-DD> [ko|en]');
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'reels', `${date}-open30.json`), 'utf8'));
const outDir = path.join(root, 'cards', 'reels', date, lang);
fs.mkdirSync(outDir, { recursive: true });

// 상황 문맥(지표 발표 전 / 방금 나온 뉴스)은 절차서에서 JSON 에 넣어 준다.
const ctx = data.context || {};
const t = (ko, en) => (lang === 'ko' ? ko : en);

const nasdaq = data.symbols.nasdaq;
const sp500 = data.symbols.sp500;
const comment = buildComment(nasdaq, sp500, ctx);
const lines = lang === 'ko' ? comment.ko : comment.en;

// ---------- 타이밍 ----------
const FPS = 30;
const CHART_SEC = 1.4;             // 차트가 그려지는 구간 (짧게 — 캡처처럼 보이도록)
const PER_LINE_SEC = 0.75;         // 손글씨 한 줄이 써지는 시간
const HOLD_SEC = 2.6;              // 다 쓴 뒤 머무는 시간
const TOTAL_SEC = CHART_SEC + PER_LINE_SEC * lines.length + HOLD_SEC;
const TOTAL_FRAMES = Math.round(TOTAL_SEC * FPS);

const UP = '#e66767';   // 한국식: 상승 빨강
const DOWN = '#3987e5'; // 하락 파랑
const PEN = '#ffd54a';  // 형광펜 노랑

const fontB64 = fs.readFileSync(path.join(root, 'assets', 'fonts', 'NanumPenScript-Korean.woff2')).toString('base64');

const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- 캔들 차트 (화면을 꽉 채우는 앱 화면처럼) ----------
function chartSvg(sym, reveal) {
  const W = 1080, H = 700;
  const padL = 40, padR = 150, padT = 30, padB = 30;
  const bars = sym.bars;
  const shown = bars.slice(0, Math.max(1, reveal));

  const openPx = bars[0].o;
  let hi = Math.max(...bars.map((b) => b.h), openPx);
  let lo = Math.min(...bars.map((b) => b.l), openPx);
  const pad = (hi - lo) * 0.16 || 1;
  hi += pad; lo -= pad;

  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i) => padL + (plotW / bars.length) * (i + 0.5);
  const y = (p) => padT + plotH * (1 - (p - lo) / (hi - lo));
  const cw = Math.max(7, (plotW / bars.length) * 0.6);

  const candles = shown.map((b, i) => {
    const col = b.c >= b.o ? UP : DOWN;
    const yo = y(b.o), yc = y(b.c);
    return `<line x1="${x(i).toFixed(1)}" y1="${y(b.h).toFixed(1)}" x2="${x(i).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${col}" stroke-width="2.4"/>`
      + `<rect x="${(x(i) - cw / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(2.5, Math.abs(yc - yo)).toFixed(1)}" fill="${col}"/>`;
  }).join('');

  // 가로 눈금 (앱 화면 느낌)
  const grid = [0.2, 0.4, 0.6, 0.8].map((f) => {
    const gy = padT + plotH * f;
    const gp = lo + (hi - lo) * (1 - f);
    return `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#232323" stroke-width="1"/>`
      + `<text x="${(W - padR + 14).toFixed(1)}" y="${(gy + 9).toFixed(1)}" fill="#5c5c5c" font-size="25" font-family="system-ui">${fmt(gp, 0)}</text>`;
  }).join('');

  const yOpen = y(openPx);
  const openLine = `<line x1="${padL}" y1="${yOpen.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yOpen.toFixed(1)}" stroke="#7a7a72" stroke-width="1.6" stroke-dasharray="9 9"/>`;

  const cur = shown[shown.length - 1];
  const yCur = y(cur.c);
  const curCol = cur.c >= openPx ? UP : DOWN;
  const curTag = `<line x1="${padL}" y1="${yCur.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yCur.toFixed(1)}" stroke="${curCol}" stroke-width="1.6" opacity="0.6"/>`
    + `<rect x="${(W - padR + 6).toFixed(1)}" y="${(yCur - 23).toFixed(1)}" width="132" height="46" rx="5" fill="${curCol}"/>`
    + `<text x="${(W - padR + 72).toFixed(1)}" y="${(yCur + 9).toFixed(1)}" fill="#000" font-size="27" font-weight="700" font-family="system-ui" text-anchor="middle">${fmt(cur.c, 0)}</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${openLine}${candles}${curTag}</svg>`;
}

function html(frame) {
  const sec = frame / FPS;

  // 차트 드로잉
  const cp = Math.min(1, sec / CHART_SEC);
  const reveal = Math.max(1, Math.round((1 - Math.pow(1 - cp, 2)) * nasdaq.bars.length));

  const shown = nasdaq.bars.slice(0, reveal);
  const last = shown[shown.length - 1].c;
  const pct = ((last - nasdaq.bars[0].o) / nasdaq.bars[0].o) * 100;
  const col = pct >= 0 ? UP : DOWN;

  const spShown = sp500.bars.slice(0, reveal);
  const spLast = spShown[spShown.length - 1].c;
  const spPct = ((spLast - sp500.bars[0].o) / sp500.bars[0].o) * 100;
  const spCol = spPct >= 0 ? UP : DOWN;

  const minsIn = Math.round((reveal / nasdaq.bars.length) * 30);
  const clock = minsIn >= 30 ? '10:00' : `09:${String(30 + minsIn).padStart(2, '0')}`;

  // 손글씨: 줄마다 왼쪽부터 써지는 것처럼 clip 폭을 늘린다
  const penHtml = lines.map((text, i) => {
    const startAt = CHART_SEC + PER_LINE_SEC * i;
    const prog = Math.max(0, Math.min(1, (sec - startAt) / PER_LINE_SEC));
    if (prog <= 0) return '';
    // 줄마다 살짝 다른 기울기 — 손으로 쓴 티
    const rot = [-1.6, 0.9, -0.7][i % 3];
    const indent = [0, 26, 12][i % 3];
    return `<div style="
        margin-top:${i === 0 ? 0 : 14}px; margin-left:${indent}px;
        transform:rotate(${rot}deg); transform-origin:left center;
        clip-path:inset(0 ${((1 - prog) * 100).toFixed(2)}% 0 0);
      ">${text}</div>`;
  }).join('');

  // 다 쓰고 난 뒤 밑줄이 그어진다
  const uEnd = CHART_SEC + PER_LINE_SEC * lines.length;
  const uProg = Math.max(0, Math.min(1, (sec - uEnd) / 0.5));

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Pen';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-display:block;}
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1920px;}
    body{background:#0b0b0b;color:#fff;width:1080px;height:1920px;overflow:hidden;
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}
    /* 하단 300px 은 릴스 UI(캡션·버튼)가 덮으므로 비워 둔다 */
    .screen{position:absolute;top:0;left:0;right:0;bottom:300px;display:flex;flex-direction:column;}
    .pen{font-family:'Pen';color:${PEN};font-size:82px;line-height:1.18;
      text-shadow:0 3px 14px rgba(0,0,0,0.85);}
  </style></head><body>
    <div class="screen">
      <!-- 앱 화면 상단: 종목 / 현재가 -->
      <div style="padding:132px 44px 0;">
        <div style="display:flex;align-items:baseline;gap:16px;">
          <div style="font-size:44px;font-weight:800;letter-spacing:-0.01em;">${t('나스닥 선물', 'Nasdaq Futures')}</div>
          <div style="font-size:27px;color:#6f6f6f;font-weight:700;">NQ · 1m</div>
          <div style="margin-left:auto;font-size:27px;color:#6f6f6f;font-weight:700;font-variant-numeric:tabular-nums;">${clock} ET</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:20px;margin-top:10px;">
          <div style="font-size:82px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">${fmt(last, 2)}</div>
          <div style="font-size:44px;font-weight:800;color:${col};">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%</div>
        </div>
      </div>

      <div style="margin-top:6px;">${chartSvg(nasdaq, reveal)}</div>

      <!-- S&P 는 한 줄 요약으로만 -->
      <div style="margin:2px 44px 0;padding-top:18px;border-top:1px solid #1e1e1e;
                  display:flex;align-items:baseline;gap:14px;">
        <div style="font-size:32px;font-weight:700;color:#9a9a9a;">${t('S&P 500 선물', 'S&P 500 Futures')}</div>
        <div style="font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;">${fmt(spLast, 2)}</div>
        <div style="font-size:32px;font-weight:800;color:${spCol};">${spPct >= 0 ? '▲' : '▼'} ${Math.abs(spPct).toFixed(2)}%</div>
      </div>

      <!-- 펜으로 쓴 한마디 -->
      <div style="margin:40px 52px 0;position:relative;">
        <div class="pen">${penHtml}</div>
        <div style="height:9px;width:${(uProg * 62).toFixed(1)}%;margin-top:22px;margin-left:10px;
                    background:${PEN};border-radius:6px;opacity:0.9;
                    transform:rotate(-0.8deg);transform-origin:left center;"></div>
      </div>

      <div style="margin-top:auto;padding:0 44px 26px;font-size:23px;color:#4a4a4a;">
        ${t('※ 투자 권유가 아닌 시황 기록', '※ Market log, not investment advice')} · luckyon
      </div>
    </div>
  </body></html>`;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luckyon-reel-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  console.log(`▶ 릴스 렌더링 [${lang.toUpperCase()}] ${date} — ${TOTAL_FRAMES}프레임 (${TOTAL_SEC.toFixed(1)}초)`);
  console.log(`  펜: ${lines.join(' / ')}`);

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
    // 무음 트랙: 오디오 없는 영상을 거르는 경우가 있어 넣어둔다
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', mp4,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n✅ ${path.relative(root, mp4)} (${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB)`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
