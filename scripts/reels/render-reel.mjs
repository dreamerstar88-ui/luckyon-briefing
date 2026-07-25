// render-reel.mjs
// data/reels/<date>-open30.json 을 읽어 인스타 릴스용 세로 영상(1080x1920)을 만든다.
// 캔들이 왼쪽부터 순차적으로 그려지며, 마지막에 한 줄 코멘트가 떠오른다.
//
// 사용법: node scripts/reels/render-reel.mjs <date> [ko|en]
//   예)   node scripts/reels/render-reel.mjs 2026-07-24 ko
//
// 산출물: cards/reels/<date>/<lang>/reel.mp4 (+ cover.png)
// 프레임 PNG 는 임시 폴더에 만들고 영상 생성 후 지운다 (저장소에 커밋하지 않음).
//
// 의존성: playwright(chromium), ffmpeg-static

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

const t = (ko, en) => (lang === 'ko' ? ko : en);

// ---------- 영상 타이밍 ----------
const FPS = 30;
const REVEAL_SEC = 3.2;   // 캔들이 그려지는 구간
const HOLD_SEC = 4.3;     // 코멘트 노출 후 정지 구간
const TOTAL_FRAMES = Math.round((REVEAL_SEC + HOLD_SEC) * FPS);
const REVEAL_FRAMES = Math.round(REVEAL_SEC * FPS);

// ---------- 색 (기존 카드와 동일 팔레트) ----------
// 한국식 색상 관례: 상승=빨강, 하락=파랑
const UP = '#e66767';
const DOWN = '#3987e5';

const fmt = (n, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// ---------- 흐름의 '모양' 판정 ----------
// 고점·저점이 언제 나왔는지, 구간별 평균이 어떻게 움직였는지로 30분의 궤적을 분류한다.
// (단순히 시가 대비 등락만 보면 "올랐다 밀린" 흐름을 "계속 내린" 것으로 잘못 쓰게 된다.)
function shapeOf(sym) {
  const b = sym.bars;
  const open = b[0].o;
  const last = b[b.length - 1].c;
  const n = b.length;
  const third = Math.max(1, Math.floor(n / 3));
  const avg = (arr) => arr.reduce((s, x) => s + x.c, 0) / arr.length;
  const early = avg(b.slice(0, third));
  const late = avg(b.slice(-third));

  let hiIdx = 0, loIdx = 0;
  b.forEach((x, i) => {
    if (x.h > b[hiIdx].h) hiIdx = i;
    if (x.l < b[loIdx].l) loIdx = i;
  });

  const pct = ((last - open) / open) * 100;
  const rangePct = ((Math.max(...b.map((x) => x.h)) - Math.min(...b.map((x) => x.l))) / open) * 100;
  const earlyPct = ((early - open) / open) * 100;
  const latePct = ((late - open) / open) * 100;

  // 고점이 앞쪽에 있고 뒤로 갈수록 낮아지면 '초반 반짝 후 반락'
  const peakedEarly = hiIdx < n * 0.45 && latePct < earlyPct - 0.05;
  // 저점이 앞쪽이고 뒤로 갈수록 높아지면 '초반 급락 후 회복'
  const troughEarly = loIdx < n * 0.45 && latePct > earlyPct + 0.05;
  const quiet = rangePct < 0.25;

  return { pct, rangePct, peakedEarly, troughEarly, quiet, hiIdx, loIdx, n, earlyPct, latePct };
}

// ---------- 코멘트 생성 (주린이 시점) ----------
// 수집한 수치·궤적에서만 문장을 만든다. 전망이나 매매 판단은 넣지 않는다.
function buildComment(nasdaq, sp500) {
  const sh = shapeOf(nasdaq);
  const p = sh.pct;
  const mag = Math.abs(p);
  const down = p < -0.05;
  const up = p > 0.05;
  const nearFlat = !down && !up;
  const spDir = sp500.stats.pctFromOpen;
  const diverging = (p < -0.05 && spDir > 0.05) || (p > 0.05 && spDir < -0.05);
  const pctTxt = `${p > 0 ? '+' : ''}${p.toFixed(2)}%`;

  if (sh.quiet && nearFlat) {
    return {
      ko: `30분 동안 거의 제자리(${pctTxt})였습니다. 조용해도 너무 조용한데… 과연 이대로 갈까요?`,
      en: `Barely moved in 30 minutes (${pctTxt}). Almost too quiet — does it stay that way?`,
    };
  }
  if (diverging) {
    return {
      ko: '나스닥과 S&P가 서로 다른 쪽을 보고 있네요. 이럴 때가 제일 헷갈리던데… 과연 어느 쪽으로?',
      en: 'The Nasdaq and S&P are pointing opposite ways — the most confusing kind of open. Which way wins?',
    };
  }
  if (sh.peakedEarly && down) {
    return {
      ko: `출발은 좋았는데 초반 고점 찍고 계속 밀려서 지금 ${pctTxt}입니다. 잠깐 쉬는 건지 진짜 밀리는 건지… 과연?`,
      en: `Started fine, peaked early, then faded to ${pctTxt}. A breather or a real slide? We'll see.`,
    };
  }
  if (sh.troughEarly && down) {
    return {
      ko: `개장하자마자 훅 빠졌다가 조금씩 올라오는 중입니다(${pctTxt}). 이게 반등의 시작일지 과연?`,
      en: `Dropped hard at the open, grinding back since (${pctTxt}). Start of a bounce, or not? We'll see.`,
    };
  }
  if (sh.troughEarly && up) {
    return {
      ko: `초반에 흔들리더니 결국 시가 위로 올라왔습니다(${pctTxt}). 이 흐름 계속 갈지 과연?`,
      en: `Shaky at first, but it clawed back above the open (${pctTxt}). Can it keep going?`,
    };
  }
  if (down) {
    return {
      ko: `개장부터 아래쪽으로 흐르는 중입니다(${pctTxt}). 여기서 더 갈지, 이쯤에서 멈출지 과연?`,
      en: `Drifting lower since the open (${pctTxt}). Further to go, or does it stop here?`,
    };
  }
  if (sh.peakedEarly && up) {
    return {
      ko: `초반에 확 올랐다가 조금 힘이 빠졌지만 아직 시가 위(${pctTxt})입니다. 과연 지켜낼까요?`,
      en: `Jumped early, cooled off a bit, but still above the open (${pctTxt}). Does it hold?`,
    };
  }
  return {
    ko: `개장 30분 동안 위쪽으로 흐르고 있습니다(${pctTxt}). 이대로 쭉 갈지 과연 어떨지?`,
    en: `Grinding higher through the first 30 minutes (${pctTxt}). Does the move stick?`,
  };
}

const nasdaq = data.symbols.nasdaq;
const sp500 = data.symbols.sp500;
const comment = buildComment(nasdaq, sp500);

// ---------- 캔들 차트 SVG ----------
function chartSvg(sym, revealCount) {
  const W = 936, H = 366;
  const padL = 8, padR = 132, padT = 22, padB = 34;
  const bars = sym.bars;
  const shown = bars.slice(0, Math.max(1, revealCount));

  // 스케일은 전체 구간 기준으로 고정한다 (그려지는 동안 축이 흔들리지 않도록)
  const his = bars.map((b) => b.h);
  const los = bars.map((b) => b.l);
  let hi = Math.max(...his), lo = Math.min(...los);
  const prev = sym.prevClose;
  const openPx = bars[0].o;
  // 시가 기준선이 항상 보이도록 범위에 포함
  hi = Math.max(hi, openPx);
  lo = Math.min(lo, openPx);
  const pad = (hi - lo) * 0.12 || 1;
  hi += pad; lo -= pad;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i) => padL + (plotW / bars.length) * (i + 0.5);
  const y = (p) => padT + plotH * (1 - (p - lo) / (hi - lo));
  const cw = Math.max(6, (plotW / bars.length) * 0.62);

  const candles = shown
    .map((b, i) => {
      const up = b.c >= b.o;
      const col = up ? UP : DOWN;
      const yo = y(b.o), yc = y(b.c);
      const top = Math.min(yo, yc);
      const hgt = Math.max(2, Math.abs(yc - yo));
      return (
        `<line x1="${x(i).toFixed(1)}" y1="${y(b.h).toFixed(1)}" x2="${x(i).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${col}" stroke-width="2"/>` +
        `<rect x="${(x(i) - cw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${cw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${col}" rx="1"/>`
      );
    })
    .join('');

  // 시가 기준선
  const yOpen = y(openPx);
  const openLine =
    `<line x1="${padL}" y1="${yOpen.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yOpen.toFixed(1)}" stroke="#6a6a63" stroke-width="2" stroke-dasharray="10 8"/>` +
    `<text x="${(W - padR + 12).toFixed(1)}" y="${(yOpen + 8).toFixed(1)}" fill="#898781" font-size="21" font-weight="700">${t('시가', 'Open')}</text>`;

  // 현재가 표시
  const cur = shown[shown.length - 1];
  const yCur = y(cur.c);
  const curUp = cur.c >= openPx;
  const curCol = curUp ? UP : DOWN;
  const curMarker =
    `<line x1="${padL}" y1="${yCur.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yCur.toFixed(1)}" stroke="${curCol}" stroke-width="2" opacity="0.45"/>` +
    `<rect x="${(W - padR + 8).toFixed(1)}" y="${(yCur - 20).toFixed(1)}" width="116" height="40" rx="8" fill="${curCol}"/>` +
    `<text x="${(W - padR + 66).toFixed(1)}" y="${(yCur + 8).toFixed(1)}" fill="#0d0d0d" font-size="23" font-weight="800" text-anchor="middle">${fmt(cur.c, 0)}</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${openLine}${candles}${curMarker}
  </svg>`;
}

function symbolBlock(sym, revealCount) {
  const st = sym.stats;
  // 진행 중인 값도 "지금까지" 기준으로 같이 움직이게 한다
  const shown = sym.bars.slice(0, Math.max(1, revealCount));
  const last = shown[shown.length - 1].c;
  const pct = ((last - sym.bars[0].o) / sym.bars[0].o) * 100;
  const col = pct > 0 ? UP : pct < 0 ? DOWN : '#c3c2b7';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
  return `
    <div style="background:#1a1a19; border:1px solid rgba(255,255,255,0.08); border-radius:22px; padding:26px 28px 14px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <div style="font-size:34px; font-weight:800;">${t(sym.label_ko, sym.label_en)}</div>
        <div style="display:flex; align-items:baseline; gap:14px;">
          <div style="font-size:38px; font-weight:800; font-variant-numeric:tabular-nums;">${fmt(last, 2)}</div>
          <div style="font-size:30px; font-weight:800; color:${col};">${arrow} ${signed(pct)}</div>
        </div>
      </div>
      <div style="margin-top:6px;">${chartSvg(sym, revealCount)}</div>
    </div>`;
}

function pageHtml(frame) {
  // 0..1 진행도
  const p = Math.min(1, frame / REVEAL_FRAMES);
  // 살짝 감속시켜 마지막 캔들이 또렷하게 남도록
  const eased = 1 - Math.pow(1 - p, 2);
  const revealCount = Math.max(1, Math.round(eased * nasdaq.bars.length));

  // 코멘트는 캔들이 다 그려진 뒤 서서히 등장
  const after = Math.max(0, frame - REVEAL_FRAMES);
  const cOpacity = Math.min(1, after / (FPS * 0.5));
  const cShift = (1 - cOpacity) * 26;

  // 진행 중 시각 라벨 (09:30 ET + n분)
  const minsIn = Math.round((revealCount / nasdaq.bars.length) * 30);
  const clock = `09:${String(30 + minsIn).padStart(2, '0')}`.replace('09:60', '10:00');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1920px;}
    body{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans KR",sans-serif;
      background:#0d0d0d;color:#fff;width:1080px;height:1920px;overflow:hidden;position:relative;}
    /* 하단 300px 은 릴스 UI(캡션·버튼)가 덮으므로 콘텐츠를 넣지 않는다 */
    .wrap{padding:150px 72px 300px;height:100%;display:flex;flex-direction:column;}
    .brand{font-size:32px;font-weight:800;}
    .brand .k{color:#3987e5;}
  </style></head><body>
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="brand">luckyon<span class="k"> ${t('브리핑', 'Briefing')}</span></div>
        <div style="font-size:26px;color:#c3c2b7;font-weight:700;">${data.session}</div>
      </div>

      <div style="margin-top:34px;">
        <div style="font-size:30px;color:#3987e5;font-weight:800;letter-spacing:0.06em;">
          ${t('미국장 개장 30분', 'FIRST 30 MINUTES')}
        </div>
        <div style="font-size:62px;font-weight:800;line-height:1.16;letter-spacing:-0.02em;margin-top:14px;">
          ${t('지금까지 이런 흐름입니다', 'Here\'s how it opened')}
        </div>
        <div style="font-size:27px;color:#898781;font-weight:600;margin-top:12px;font-variant-numeric:tabular-nums;">
          ${t('미 동부 09:30 → ', 'ET 09:30 → ')}${clock} · ${t('1분봉', '1-min bars')}
        </div>
      </div>

      <div style="margin-top:30px;display:flex;flex-direction:column;gap:22px;">
        ${symbolBlock(nasdaq, revealCount)}
        ${symbolBlock(sp500, revealCount)}
      </div>

      <div style="margin-top:26px;opacity:${cOpacity.toFixed(3)};transform:translateY(${cShift.toFixed(1)}px);
                  background:#16213a;border-left:8px solid #3987e5;border-radius:18px;padding:28px 32px;">
        <div style="font-size:24px;font-weight:800;color:#7fb0ee;letter-spacing:0.04em;margin-bottom:12px;">
          ${t('주린이 한마디', 'A ROOKIE\'S TAKE')}
        </div>
        <div style="font-size:34px;font-weight:700;line-height:1.42;color:#e8e7e0;">
          ${t(comment.ko, comment.en)}
        </div>
      </div>
      <div style="margin-top:16px;font-size:23px;color:#6a6a63;">
        ${t('※ 투자 권유가 아닌 시황 기록입니다', '※ Market log, not investment advice')}
      </div>
    </div>
  </body></html>`;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luckyon-reel-'));
  // 이 환경은 playwright 번들 브라우저 대신 CHROMIUM_PATH 를 쓴다 (render-cards.mjs 와 동일)
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  console.log(`▶ 릴스 프레임 렌더링 [${lang.toUpperCase()}] ${date} — ${TOTAL_FRAMES}프레임`);
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    await page.setContent(pageHtml(f), { waitUntil: 'load' });
    await page.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`) });
    if (f % 30 === 0) process.stdout.write(`  ${f}/${TOTAL_FRAMES}\r`);
  }
  // 커버(썸네일)는 코멘트까지 다 뜬 마지막 프레임
  fs.copyFileSync(path.join(tmp, `f${String(TOTAL_FRAMES - 1).padStart(4, '0')}.png`), path.join(outDir, 'cover.png'));
  await browser.close();

  const mp4 = path.join(outDir, 'reel.mp4');
  execFileSync(
    ffmpegPath,
    [
      '-y', '-framerate', String(FPS),
      '-i', path.join(tmp, 'f%04d.png'),
      // 무음 오디오 트랙: 인스타가 오디오 없는 영상을 거르는 경우가 있어 넣어둔다
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest',
      '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '128k',
      mp4,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  fs.rmSync(tmp, { recursive: true, force: true });

  const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ ${path.relative(root, mp4)} (${mb} MB, ${(TOTAL_FRAMES / FPS).toFixed(1)}초)`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
