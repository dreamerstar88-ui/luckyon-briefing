// render-chartnotes.mjs
// content/chart-notes/<stamp>.json 의 cards 배열을 읽어 "투자 3분 노트" 카드 PNG(1080x1350)를 만든다.
//
// 사용법: node scripts/chart-notes/render-chartnotes.mjs <stamp> <lang:ko|en>
//   예)   node scripts/chart-notes/render-chartnotes.mjs 2026-08-09-ep02 ko
//
// 산출물: cards/chart-notes/<stamp>/<lang>/card1..N.png
//
// 디자인은 EP.01(캔들차트 기초)에서 확정된 시리즈 아이덴티티를 코드로 옮긴 것이다.
// 크림색 모눈 노트 + 스프링 제본 + 감청색 헤더 + 붉은 포인트 + 노란 형광펜.
// **회차마다 이 톤을 바꾸지 않는다** — 피드에서 한 시리즈로 보여야 한다.
//
// 의존성: playwright (chromium)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/chart-notes/render-chartnotes.mjs <stamp> <lang:ko|en>');
  process.exit(1);
}
if (!['ko', 'en'].includes(lang)) { console.error(`lang 은 ko|en 중 하나여야 합니다: ${lang}`); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataPath = path.join(root, 'content', 'chart-notes', `${stamp}.json`);
if (!fs.existsSync(dataPath)) { console.error(`❌ ${path.relative(root, dataPath)} 이 없습니다.`); process.exit(1); }
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
if (!Array.isArray(data.cards) || !data.cards.length) {
  console.error('❌ JSON 에 cards 배열이 없습니다. 절차서 3단계(원고 작성)를 먼저 하세요.');
  process.exit(1);
}

const outDir = path.join(root, 'cards', 'chart-notes', stamp, lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (o, key) => (o?.[`${key}_${lang}`] ?? o?.[key] ?? '');
// 데이터 필드(차트 좌표·시세 값)도 언어별로 갈라 쓸 수 있게 한다.
// 절차서 3단계가 "예시 종목도 독자에 맞춰 바꾼다"(EP.01 = 삼성전자 / 애플)고 정해 두었는데,
// cards 배열은 ko·en 렌더가 함께 읽으므로 텍스트만 갈라서는 그 요구를 지킬 수 없다.
// d() 는 `<key>_ko` / `<key>_en` 이 있으면 그것을, 없으면 공용 `<key>` 를 쓴다(기존 회차 그대로 동작).
const d = (o, key, fallback) => (o?.[`${key}_${lang}`] ?? o?.[key] ?? fallback);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- 시리즈 디자인 토큰 ----------
const C = {
  bg: '#a89e91',          // 바깥 배경 (책상 느낌의 웜 그레이)
  paper: '#fdfcf3',       // 노트 종이
  grid: '#dde5ee',        // 모눈
  ink: '#23221f',         // 제목
  body: '#4c4b47',        // 본문
  muted: '#8d8a82',       // 보조
  navy: '#3d4a68',        // 헤더·강조
  red: '#c0523c',         // 포인트
  redSoft: '#d98a78',
  yellow: '#ddc158',      // 형광펜
  green: '#3f8f6d',       // 상승(글로벌)
  blue: '#5b7fb5',        // 하락(동아시아)
};
const SERIES = lang === 'ko' ? (data.series || '투자 3분 노트') : (data.series_en || '3-Min Investing Notes');
const FOOTER = lang === 'ko' ? '매일 3분씩 배우는 투자 공부' : '3 minutes a day, one idea at a time';
const FONT_SANS = `system-ui, -apple-system, 'Segoe UI', 'Noto Sans KR', sans-serif`;
const FONT_MONO = `'DejaVu Sans Mono', 'Liberation Mono', monospace`;
// 영어판은 제목을 고정폭으로 — EP.01 에서 확정된 언어별 차이다.
const FONT_TITLE = lang === 'ko' ? FONT_SANS : FONT_MONO;

// 캔들 색은 언어권 관행을 따른다 — 이 시리즈가 EP.01 에서 가르친 내용 그 자체다.
//   한국어판(동아시아): 상승 = 빨강, 하락 = 파랑
//   영어판(서구·글로벌): 상승 = 초록, 하락 = 빨강
// 카드 JSON 은 방향(up/down)만 지정하고 색은 여기서 정한다 — 언어별로 틀리게 쓸 여지를 없앤다.
const UP = lang === 'ko' ? C.red : C.green;
const DOWN = lang === 'ko' ? C.blue : C.red;

// ---------- 공통 조각 ----------
function spiral() {
  const rings = Array.from({ length: 12 }, (_, i) => {
    const x = 96 + i * 74;
    return `<g>
      <path d="M ${x} 92 C ${x - 20} 60, ${x + 22} 42, ${x + 6} 88"
            stroke="#4c4c54" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.92"/>
      <circle cx="${x + 3}" cy="118" r="9" fill="#8d8478"/>
    </g>`;
  }).join('');
  return `<svg class="spiral" width="1080" height="150" viewBox="0 0 1080 150">${rings}</svg>`;
}

// 제목의 마지막 줄만 <span> 으로 감싼다. 밑줄 스퀴글이 그 줄의 실제 너비를 따라가게 하기 위한 것.
// 제목은 <br> 를 허용하는 raw HTML 이므로 이스케이프하지 않고 그대로 다시 잇는다.
function markLastLine(html) {
  const parts = String(html).split(/<br\s*\/?>/i);
  const last = parts.pop();
  const head = parts.length ? `${parts.join('<br>')}<br>` : '';
  return `${head}<span class="ttl-last">${last}</span>`;
}

function candleSVG({ x, w, open, close, high, low, color, id }) {
  // open/close/high/low 는 SVG 좌표(px). 위가 작은 값.
  const bodyTop = Math.min(open, close);
  const bodyH = Math.max(Math.abs(close - open), 6);
  const cx = x + w / 2;
  return `
    <defs>
      <pattern id="h${id}" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
        <rect width="10" height="10" fill="${C.paper}"/>
        <line x1="0" y1="0" x2="0" y2="10" stroke="${color}" stroke-width="4"/>
      </pattern>
    </defs>
    <line x1="${cx}" y1="${high}" x2="${cx}" y2="${low}" stroke="${C.ink}" stroke-width="7"/>
    <rect x="${x}" y="${bodyTop}" width="${w}" height="${bodyH}" fill="url(#h${id})" stroke="${C.ink}" stroke-width="5"/>`;
}

function page(inner, pageno) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1350px}
  body{background:${C.bg};font-family:${FONT_SANS};position:relative;overflow:hidden}
  .paper{position:absolute;left:56px;right:56px;top:118px;bottom:74px;background:${C.paper};
         border-radius:3px;box-shadow:0 18px 42px rgba(0,0,0,0.22);overflow:hidden;
         background-image:linear-gradient(${C.grid} 1px,transparent 1px),linear-gradient(90deg,${C.grid} 1px,transparent 1px);
         background-size:46px 46px;background-position:-1px -1px}
  .spiral{position:absolute;left:0;top:0;z-index:3}
  .hd{position:absolute;left:0;right:0;top:0;height:112px;background:${C.paper};
      display:flex;align-items:center;justify-content:space-between;padding:0 42px;
      border-bottom:2px solid ${C.red}}
  .hd .s{font-family:${FONT_SANS};font-size:27px;font-weight:800;color:${C.navy};letter-spacing:0.01em}
  .hd .p{font-family:${FONT_SANS};font-size:27px;font-weight:800;color:${C.navy}}
  .pad{position:absolute;left:0;right:0;top:112px;bottom:0;padding:52px 62px;display:flex;flex-direction:column}
  .ttl{font-family:${FONT_TITLE};font-size:64px;font-weight:800;color:${C.ink};line-height:1.22;letter-spacing:-0.01em}
  .ttl.sm{font-size:52px}
  .body{font-family:${FONT_SANS};font-size:30px;color:${C.body};line-height:1.55;margin-top:20px}
  .foot{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:22px;color:#6f675e}
  .chip{display:inline-block;background:${C.yellow};padding:10px 22px;font-size:29px;font-weight:800;color:${C.ink}}
  .box{border:3px solid ${C.red};border-radius:14px;padding:26px 30px}
  .box.up{border-color:${UP}}
  .dash{flex:1;border-top:3px dashed #bfbcb2;margin:0 18px}
  .cb{width:44px;height:44px;border:4px solid ${C.ink};border-radius:6px;position:relative;flex:none}
  .cb::after{content:'';position:absolute;left:9px;top:2px;width:16px;height:28px;border:solid ${C.red};
             border-width:0 6px 6px 0;transform:rotate(42deg)}
  </style></head><body>
  <div class="paper"><div class="hd"><div class="s">${esc(SERIES)} · ${esc(data.episode || '')}</div>
  <div class="p">p.${String(pageno).padStart(2, '0')}</div></div>${inner}</div>
  ${spiral()}<div class="foot">${esc(FOOTER)} · ${esc(data.byline || 'by luckyon')}</div>
  <script>
  // 밑줄 스퀴글을 대상 텍스트의 실제 렌더 너비에 맞춘다.
  // 고정 너비로 두면 언어마다 글자 폭이 달라 한쪽은 줄 전체를 덮고 다른 쪽은 문장 중간에서 끊긴다
  // (EP.02 에서 한국어는 마지막 줄을 다 덮고 영어는 "'it will go" 까지만 그어졌다).
  (function () {
    var OVER = 28; // 손으로 그은 듯 살짝 넘겨 긋는 여유
    document.querySelectorAll('svg[data-fit]').forEach(function (s) {
      var el = document.querySelector(s.getAttribute('data-fit'));
      if (!el) return;
      var w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) s.setAttribute('width', w + OVER);
    });
  })();
  </script></body></html>`;
}

// ---------- 카드 타입별 마크업 ----------
const R = {
  // 표지: 캔들 두 개 + 큰 제목 + 밑줄 + 부제 + CTA + 바이라인
  cover(c) {
    // overlay:'volume' — 표지 그림 자체를 «캔들 + 그 아래 거래량 막대» 2단으로 바꾼다.
    // 주석이 아래 칸(거래량)을 가리키는 회차에서 쓴다. 캔들 두 개만 있는 기본 표지는
    // 회차가 쌓일수록 서로 구별되지 않는데(EP.01~03 이 사실상 같은 그림이었다),
    // 표지가 그 회차의 주제를 그림으로 말해주지 못하면 표지를 두는 뜻이 없다.
    if (c.overlay === 'volume') {
      const seq = [ // o,c,h,l 은 SVG y(px). 아래로 갈수록 큰 값. v 는 막대 높이 비율.
        { o: 128, c: 104, h: 92, l: 138, v: 0.34 }, { o: 106, c: 118, h: 98, l: 128, v: 0.28 },
        { o: 118, c: 92, h: 84, l: 126, v: 0.44 }, { o: 92, c: 100, h: 82, l: 112, v: 0.30 },
        { o: 100, c: 132, h: 96, l: 146, v: 0.55 }, { o: 134, c: 168, h: 128, l: 178, v: 1.0 },
        { o: 166, c: 150, h: 142, l: 176, v: 0.62 },
      ];
      const x0 = 66, step = 62, bw = 30;
      const VB = 286, VT = 196;      // 거래량 칸 바닥·천장
      const cand = seq.map((s, i) => {
        const cxp = x0 + i * step, col = s.c < s.o ? UP : DOWN;  // y 가 작을수록 높은 가격
        return `<line x1="${cxp}" y1="${s.h}" x2="${cxp}" y2="${s.l}" stroke="${col}" stroke-width="3"/>
                <rect x="${cxp - bw / 2}" y="${Math.min(s.o, s.c)}" width="${bw}"
                      height="${Math.max(Math.abs(s.c - s.o), 4)}" fill="${col}" opacity="0.85"/>`;
      }).join('');
      const vol = seq.map((s, i) => {
        const cxp = x0 + i * step, h = (VB - VT) * s.v, spike = s.v === 1;
        // 급증 막대도 방향 색 그대로 — 강조는 테두리로 한다(pricevol 과 같은 이유).
        return `<rect x="${cxp - bw / 2}" y="${VB - h}" width="${bw}" height="${h}"
                      fill="${s.c < s.o ? UP : DOWN}" opacity="${spike ? 1 : 0.5}"
                      ${spike ? `stroke="${C.ink}" stroke-width="4"` : ''}/>`;
      }).join('');
      const spikeX = x0 + 5 * step;
      return `<div class="pad">
        <svg width="956" height="300" viewBox="0 0 956 300" style="margin-top:8px">
          <line x1="40" y1="186" x2="500" y2="186" stroke="#c9c6bc" stroke-width="3"/>
          <line x1="40" y1="${VB}" x2="500" y2="${VB}" stroke="#c9c6bc" stroke-width="3"/>
          ${cand}${vol}
          <path d="M 600 232 L ${spikeX + 22} ${VB - (VB - VT) - 6}" stroke="${C.red}" stroke-width="3" fill="none"/>
          ${String(t(c, 'annot')).split('|').map((ln, i) =>
        `<text x="606" y="${222 + i * 34}" font-family="${FONT_SANS}" font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
        </svg>
        ${R._coverText(c)}
      </div>`;
    }
    // overlay:'trend' — 캔들의 «저점들이 하나의 비스듬한 선 위에 얹혀» 계단처럼 올라가는 그림.
    // 주석이 그 기울어진 선을 가리키는 회차(추세선·채널)에서 쓴다. 'levels' 는 가로선이라
    // «저점이 점점 높아진다»를 말할 수 없고, 'ma'·'cross' 의 곡선은 «두 점을 이어 그은 직선»이
    // 아니라서 이 회차가 가르치는 것과 다른 그림이 된다.
    // overlay:'trend2' — 기울어진 선 «두 개»를 나란히. 왼쪽은 저점을 이어 우상향, 오른쪽은 고점을
    // 이어 우하향. 선이 향한 쪽에서 «방향»이, 기울어진 정도에서 «속도»가 한눈에 읽힌다.
    // 추세선은 이 둘을 «함께» 보는 도구인데 표지가 한 방향만 그리면 방향이 이미 정해진 것처럼 읽힌다
    // (EP.06 초안이 그랬다). 캔들 색까지 상승·하락이 갈려 언어권 관행도 같이 보인다.
    if (c.overlay === 'trend2') {
      const LINE_A = [[36, 242], [444, 130]], LINE_B = [[486, 130], [890, 242]];
      const SEQ_A = [ // 우상향: 저점이 계단처럼 올라간다 (전부 상승 캔들)
        { o: 220, c: 190, h: 180, l: 228 }, { o: 194, c: 166, h: 156, l: 198 },
        { o: 174, c: 144, h: 134, l: 180 }, { o: 146, c: 118, h: 108, l: 150 },
        { o: 126, c: 94, h: 84, l: 132 },
      ];
      const SEQ_B = [ // 우하향: 고점이 계단처럼 내려온다 (전부 하락 캔들)
        { o: 149, c: 181, h: 143, l: 187 }, { o: 174, c: 206, h: 168, l: 212 },
        { o: 202, c: 234, h: 196, l: 240 }, { o: 222, c: 254, h: 216, l: 260 },
        { o: 247, c: 278, h: 241, l: 284 },
      ];
      const bw = 34, step = 88;
      const group = (seq, x0) => seq.map((s, i) => {
        const cxp = x0 + i * step, col = s.c < s.o ? UP : DOWN;
        return `<line x1="${cxp}" y1="${s.h}" x2="${cxp}" y2="${s.l}" stroke="${col}" stroke-width="3"/>
                <rect x="${cxp - bw / 2}" y="${Math.min(s.o, s.c)}" width="${bw}"
                      height="${Math.max(Math.abs(s.c - s.o), 4)}" fill="${col}" opacity="0.85"/>`;
      }).join('');
      const tline = (p) => `<line x1="${p[0][0]}" y1="${p[0][1]}" x2="${p[1][0]}" y2="${p[1][1]}"
            stroke="${C.red}" stroke-width="5" stroke-dasharray="15 10" stroke-linecap="round"/>`;
      return `<div class="pad">
        <svg width="956" height="356" viewBox="0 0 956 356" style="margin-top:4px">
          ${group(SEQ_A, 80)}${group(SEQ_B, 530)}${tline(LINE_A)}${tline(LINE_B)}
          ${String(t(c, 'annot')).split('|').map((ln, i) =>
        `<text x="468" y="${312 + i * 34}" text-anchor="middle" font-family="${FONT_SANS}"
               font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
        </svg>
        ${R._coverText(c)}
      </div>`;
    }
    if (c.overlay === 'trend') {
      // 붉은 추세선: (30,268) → (500,120). 아래 캔들의 저가(l) 중 다섯 개가 이 선에 닿고
      // 나머지는 그 위에 뜬다 — «닿은 자리»가 있어야 주석이 가리킬 대상이 생긴다.
      const TX1 = 30, TY1 = 268, TX2 = 500, TY2 = 120;
      const ty = (x) => TY1 + ((x - TX1) / (TX2 - TX1)) * (TY2 - TY1);
      const seq = [ // o,c,h,l 은 SVG y(px). 아래로 갈수록 낮은 가격.
        { o: 252, c: 222, h: 212, l: 260 }, { o: 230, c: 204, h: 196, l: 236 },
        { o: 218, c: 190, h: 180, l: 224 }, { o: 170, c: 200, h: 160, l: 206 },
        { o: 184, c: 156, h: 148, l: 189 }, { o: 162, c: 134, h: 126, l: 168 },
        { o: 148, c: 122, h: 116, l: 154 }, { o: 130, c: 100, h: 94, l: 136 },
      ];
      const x0 = 52, step = 56, bw = 28;
      const cand = seq.map((s, i) => {
        const cxp = x0 + i * step, col = s.c < s.o ? UP : DOWN;   // y 가 작을수록 높은 가격
        return `<line x1="${cxp}" y1="${s.h}" x2="${cxp}" y2="${s.l}" stroke="${col}" stroke-width="3"/>
                <rect x="${cxp - bw / 2}" y="${Math.min(s.o, s.c)}" width="${bw}"
                      height="${Math.max(Math.abs(s.c - s.o), 4)}" fill="${col}" opacity="0.85"/>`;
      }).join('');
      return `<div class="pad">
        <svg width="956" height="300" viewBox="0 0 956 300" style="margin-top:8px">
          ${cand}
          <line x1="${TX1}" y1="${TY1}" x2="${TX2}" y2="${TY2}" stroke="${C.red}"
                stroke-width="4" stroke-dasharray="14 10"/>
          <path d="M 600 128 L 506 ${Math.round(ty(500)) + 2}" stroke="${C.red}" stroke-width="3" fill="none"/>
          ${String(t(c, 'annot')).split('|').map((ln, i) =>
        `<text x="606" y="${118 + i * 34}" font-family="${FONT_SANS}" font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
        </svg>
        ${R._coverText(c)}
      </div>`;
    }
    // overlay:'levels' — 캔들이 «두 가로선 사이»를 오가는 그림. 주석이 그 수평선을 가리키는
    // 회차(지지선·저항선·박스권)에서 쓴다. 'ma'·'cross' 는 비스듬한 곡선이라 «가격이 자꾸
    // 멈춘 높이»를 가리킬 대상이 화면에 없다 — EP.03 이 그 이유로 검증에서 걸렸다.
    if (c.overlay === 'levels') {
      const RES = 76, SUP = 246;
      const seq = [ // o,c,h,l 은 SVG y(px). 아래로 갈수록 낮은 가격.
        { o: 230, c: 200, h: 190, l: 242 }, { o: 200, c: 120, h: 110, l: 205 },
        { o: 120, c: 92, h: 80, l: 125 }, { o: 92, c: 150, h: 88, l: 158 },
        { o: 150, c: 225, h: 145, l: 243 }, { o: 225, c: 160, h: 152, l: 238 },
        { o: 160, c: 110, h: 84, l: 165 }, { o: 110, c: 180, h: 105, l: 190 },
        { o: 180, c: 232, h: 175, l: 244 },
      ];
      const x0 = 46, step = 54, bw = 26;
      const cand = seq.map((s, i) => {
        const cxp = x0 + i * step, col = s.c < s.o ? UP : DOWN;   // y 가 작을수록 높은 가격
        return `<line x1="${cxp}" y1="${s.h}" x2="${cxp}" y2="${s.l}" stroke="${col}" stroke-width="3"/>
                <rect x="${cxp - bw / 2}" y="${Math.min(s.o, s.c)}" width="${bw}"
                      height="${Math.max(Math.abs(s.c - s.o), 4)}" fill="${col}" opacity="0.85"/>`;
      }).join('');
      const lvl = (y) => `<line x1="30" y1="${y}" x2="530" y2="${y}" stroke="${C.red}"
                                stroke-width="4" stroke-dasharray="14 10"/>`;
      return `<div class="pad">
        <svg width="956" height="300" viewBox="0 0 956 300" style="margin-top:8px">
          ${cand}${lvl(RES)}${lvl(SUP)}
          <path d="M 600 220 L 532 ${SUP}" stroke="${C.red}" stroke-width="3" fill="none"/>
          ${String(t(c, 'annot')).split('|').map((ln, i) =>
        `<text x="606" y="${226 + i * 34}" font-family="${FONT_SANS}" font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
        </svg>
        ${R._coverText(c)}
      </div>`;
    }
    return `<div class="pad">
      <svg width="956" height="300" viewBox="0 0 956 300" style="margin-top:8px">
        ${candleSVG({ x: 190, w: 104, open: 190, close: 78, high: 30, low: 250, color: C.red, id: 'a' })}
        ${candleSVG({ x: 420, w: 104, open: 190, close: 78, high: 30, low: 250, color: C.green, id: 'b' })}
        ${/* overlay:'ma'    — 캔들 위에 이동평균선 곡선 하나를 얹는다. 표지 주석이 '선'을 가리키는
                              회차(이동평균선·추세선 등)에서 쓴다.
              overlay:'cross' — 선 두 개가 (545,136) 에서 정확히 교차한다. 주석 지시선이 가리키는 끝점이
                              바로 그 좌표라, 주석이 '두 선이 만나는 순간'을 말하는 회차
                              (골든크로스·MACD·볼린저밴드 등)에서 쓴다. 'ma' 로 두면 선이 하나뿐이라
                              주석이 가리킬 교차점이 화면에 없다 — EP.03 검증에서 실제로 지적된 사고다.
              값이 없으면 EP.01 과 똑같이 캔들만 그린다. */
      c.overlay === 'ma'
        ? `<path d="M 56 212 Q 168 118, 300 168 T 545 136" stroke="${C.navy}" stroke-width="6"
                 fill="none" stroke-linecap="round" opacity="0.9"/>`
        : c.overlay === 'cross'
          ? /* 두 곡선은 교차점(545,136)에서 '끝난다' — 오른쪽으로 더 뻗으면 x=606 부터 시작하는
               주석 글자를 관통한다(실제로 그렇게 그려 봤다). 주석 문구가 '만나는 순간' 이므로
               만나는 지점에서 멈추는 편이 그림과 글이 정확히 일치한다. */
            `<path d="M 56 192 C 260 186, 430 164, 545 136" stroke="${C.red}"
                   stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
             <path d="M 56 264 C 260 254, 430 210, 545 136" stroke="${C.navy}"
                   stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
             <circle cx="545" cy="136" r="15" fill="none" stroke="${C.red}" stroke-width="5"/>` : ''}
        <path d="M 600 128 L 545 136" stroke="${C.red}" stroke-width="3" fill="none"/>
        ${String(t(c, 'annot')).split('|').map((ln, i) =>
      `<text x="606" y="${118 + i * 34}" font-family="${FONT_SANS}" font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
      </svg>
      ${R._coverText(c)}
    </div>`;
  },

  // 표지의 글자 블록 — 그림만 다른 표지 변형들이 공유한다.
  _coverText(c) {
    return `<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div class="ttl" style="font-size:70px">${markLastLine(t(c, 'title'))}</div>
        <svg data-fit=".ttl-last" width="480" height="26" viewBox="0 0 480 26"
             preserveAspectRatio="none" style="margin-top:10px">
          <path d="M 4 10 Q 120 2, 240 11 T 476 8" stroke="${C.red}" stroke-width="4" fill="none" vector-effect="non-scaling-stroke"/>
          <path d="M 4 19 Q 140 11, 260 20 T 470 16" stroke="${C.red}" stroke-width="3" fill="none" opacity="0.75" vector-effect="non-scaling-stroke"/>
        </svg>
        <div style="font-family:${FONT_TITLE};font-size:34px;font-weight:700;color:${C.navy};margin-top:26px">${esc(t(c, 'sub'))}</div>
        <div style="margin-top:30px"><span class="chip">${esc(t(c, 'cta'))} ▶</span></div>
      </div>`;
  },

  // 도입: 큰 제목 + 짧은 밑줄 + 본문 + 스케치 + 캡션
  //
  // `sketch` 로 그림을 고른다. **회차마다 반드시 골라 준다** — 예전에는 스케치가 코드에
  // 하나만 박혀 있어서 EP.02·EP.03·EP.05 의 p.02 가 «픽셀 단위로 같은 그림»이었다
  // (2026-08-30 이슈 #25: "시각적 자료가 이전 회차와 똑같은 그림도 있고 심심합니다").
  // 도입 카드는 그 회차의 질문을 그림으로 던지는 자리이므로, 제목이 묻는 것이 화면에
  // 실제로 그려져 있어야 한다 — EP.05 제목은 «가로선»을 묻는데 그림에는 가로선이
  // 한 줄도 없었다.
  //
  //   'zigzag'         — 꺾은선 + 물음표 (EP.02·03 이 쓴 기본 그림)
  //   'mystery-levels' — 꺾은선 위에 정체불명의 붉은 가로선 두 줄 + 물음표
  //                      («이 선은 누가 왜 그었나»를 묻는 회차)
  //   'mystery-slope'  — 꺾은선 아래에 정체불명의 붉은 «비스듬한» 선 한 줄 + 물음표
  //                      («이 기울어진 선은 어떻게 그은 건가»를 묻는 회차 — 추세선·채널)
  intro(c) {
    const sketch = d(c, 'sketch', 'zigzag');
    const q = (x, y, size) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" fill="${C.red}">?</text>`;
    let fig;
    if (sketch === 'mystery-slope') {
      // 꺾은선의 «저점 다섯 개»가 이 비스듬한 선 위에 얹혀 있다. 제목이 묻는 것(비스듬한 선)이
      // 화면에 실제로 있어야 하므로 가로선(mystery-levels)을 돌려 쓰지 않는다.
      fig = `<svg width="900" height="270" viewBox="0 0 900 270">
          <polyline points="20,252 90,225 155,160 230,194 300,120 370,162 440,96 510,131 580,70 650,100 720,42 780,66"
                    stroke="#7d7a72" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          <line x1="30" y1="240" x2="790" y2="70" stroke="${C.red}" stroke-width="5"
                stroke-dasharray="16 11" opacity="0.9"/>
          ${q(802, 84, 54)}${q(858, 132, 36)}${q(806, 178, 40)}
        </svg>`;
    } else if (sketch === 'mystery-levels') {
      const RES = 63, SUP = 203;
      const lvl = (y) => `<line x1="40" y1="${y}" x2="790" y2="${y}" stroke="${C.red}" stroke-width="5"
                                stroke-dasharray="16 11" opacity="0.9"/>`;
      // 꺾은선은 x=780 에서 끝낸다 — 물음표는 «이 가로선들이 뭐냐»를 묻는 것이므로
      // 선의 오른쪽 끝(=가로선이 끝나는 자리) 바깥에 있어야 가리키는 대상이 분명해진다.
      fig = `<svg width="900" height="270" viewBox="0 0 900 270">
          <polyline points="20,235 110,64 200,160 300,203 400,110 500,63 600,170 700,203 780,140"
                    stroke="#7d7a72" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          ${lvl(RES)}${lvl(SUP)}
          ${q(798, 84, 54)}${q(798, 224, 54)}${q(852, 156, 34)}
        </svg>`;
    } else {
      fig = `<svg width="900" height="270" viewBox="0 0 900 270">
          <polyline points="20,225 130,125 200,175 330,75 430,35 620,35 760,155 830,220"
                    stroke="#7d7a72" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          ${q(812, 95, 62)}${q(866, 137, 42)}${q(820, 173, 34)}
        </svg>`;
    }
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      <svg width="160" height="14" style="margin-top:12px"><path d="M 2 7 Q 60 1, 156 8" stroke="${C.red}" stroke-width="5" fill="none"/></svg>
      <div class="body" style="margin-top:28px">${t(c, 'body')}</div>
      <div style="flex:1;display:flex;align-items:center">${fig}</div>
      <div style="font-family:${FONT_TITLE};font-size:27px;font-weight:700;color:${C.navy};margin-bottom:18px">${esc(t(c, 'caption'))}</div>
    </div>`;
  },

  // 체크리스트: 제목 + 본문 + 용어 4개 (체크박스 + 형광펜 칩 + 점선 + 설명)
  //
  // `figure` 를 주면 용어 목록 아래에 «그 이름들이 차트 어디에 있는지» 한 장으로 보여준다.
  // 용어만 네 줄 늘어놓으면 카드 아래 절반이 통째로 비어 «공부 못하는 사람이 정리한 노트»가
  // 된다(2026-08-30 이슈 #25). 이름을 그림 위 제자리에 얹어야 그 다음 카드부터 그 이름이
  // 무엇을 가리키는지 알고 읽는다.
  //
  //   figure: { kind:'levels-map', resistance, support, range, breakout }  ← 각 필드 _ko/_en
  checklist(c) {
    const FIG = d(c, 'figure', null);
    const tight = !!FIG;
    const rows = (c.items || []).map(it => `
      <div style="display:flex;align-items:center;gap:22px;margin-bottom:${tight ? 18 : ((c.items.length > 3) ? 26 : 34)}px">
        <div class="cb"></div>
        <span style="background:${C.yellow};padding:6px 16px;font-family:${FONT_TITLE};font-size:32px;font-weight:800;color:${it.color || C.ink};white-space:nowrap">${esc(t(it, 'term'))}</span>
        <span class="dash"></span>
        <span style="font-size:29px;color:${C.body};white-space:nowrap">${esc(t(it, 'desc'))}</span>
      </div>`).join('');

    // levels-map — 저항선·지지선 두 줄, 그 사이 박스권 띠, 오른쪽 끝에서 위로 뚫고 나가는 돌파.
    // 네 용어가 한 그림 안에서 서로의 관계로 정의된다.
    let fig = '';
    if (FIG && d(FIG, 'kind', 'levels-map') === 'levels-map') {
      // 라벨은 그림 **왼쪽 바깥**에 세로로 쌓는다. 오른쪽에 붙이면 돌파해 올라가는 선의
      // 끝과 겹치고(실제로 겹쳤다), 띠 한가운데에 «박스권»을 놓으면 꺾은선이 그 글자를
      // 관통한다. 왼쪽 여백은 가격이 절대 가지 않는 자리라 어느 회차에서도 비어 있다.
      const RES = 58, SUP = 212, X0 = 200, X1 = 760, LX = 186;
      const lvl = (y) => `<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="${C.red}"
                                stroke-width="4" stroke-dasharray="14 10"/>`;
      const lab = (txt, y, col, op) => `<text x="${LX}" y="${y + 9}" text-anchor="end" font-family="${FONT_TITLE}"
              font-size="26" font-weight="800" fill="${col}" opacity="${op}">${esc(txt)}</text>`;
      fig = `<svg width="900" height="272" viewBox="0 0 900 272">
        <rect x="${X0}" y="${RES}" width="${X1 - X0}" height="${SUP - RES}" fill="${C.navy}" opacity="0.07"/>
        ${lvl(RES)}${lvl(SUP)}
        <polyline points="200,184 240,60 285,166 330,212 378,60 425,209 470,116 515,190 560,212 610,138 700,26 820,14"
                  stroke="${C.navy}" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="672" cy="${RES}" r="15" fill="none" stroke="${C.red}" stroke-width="5"/>
        <path d="M 706 96 L 684 70" stroke="${C.red}" stroke-width="3" fill="none"/>
        <text x="710" y="106" font-family="${FONT_TITLE}" font-size="26" font-weight="800"
              fill="${C.red}">${esc(t(FIG, 'breakout'))}</text>
        ${lab(t(FIG, 'resistance'), RES, C.red, 1)}
        ${lab(t(FIG, 'range'), (RES + SUP) / 2, C.navy, 0.6)}
        ${lab(t(FIG, 'support'), SUP, C.red, 1)}
      </svg>`;
    }

    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin-top:${tight ? 28 : 38}px">${rows}</div>
      ${fig ? `<div style="flex:1;display:flex;align-items:center">${fig}</div>` : `<div style="flex:1"></div>`}
      <div style="font-family:${FONT_TITLE};font-size:30px;font-weight:800;color:${C.navy};margin-bottom:22px">${esc(t(c, 'closing'))}</div>
    </div>`;
  },

  // 구조 분해: 제목 + 본문 + 캔들 + 화살표 3개 콜아웃
  anatomy(c) {
    const L = c.labels || {};
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      <div class="body">${t(c, 'body')}</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">
        <svg width="956" height="560" viewBox="0 0 956 560">
          ${candleSVG({ x: 150, w: 160, open: 400, close: 190, high: 60, low: 500, color: C.red, id: 'c' })}
          <path d="M 480 120 L 330 145" stroke="${C.red}" stroke-width="5" fill="none" marker-end="url(#ar)"/>
          <path d="M 480 300 L 340 300" stroke="${C.red}" stroke-width="5" fill="none" marker-end="url(#ar)"/>
          <path d="M 480 500 L 330 470" stroke="${C.red}" stroke-width="5" fill="none" marker-end="url(#ar)"/>
          <defs><marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M 10 5 L 0 0 L 0 10 z" fill="${C.red}"/></marker></defs>
          <text x="500" y="115" font-family="${FONT_TITLE}" font-size="36" font-weight="800" fill="${C.ink}">${esc(t(L.upper || {}, 'main'))}</text>
          <text x="500" y="156" font-family="${FONT_SANS}" font-size="26" fill="${C.muted}">${esc(t(L.upper || {}, 'sub'))}</text>
          <text x="500" y="295" font-family="${FONT_TITLE}" font-size="36" font-weight="800" fill="${C.ink}">${esc(t(L.body || {}, 'main'))}</text>
          <text x="500" y="336" font-family="${FONT_SANS}" font-size="26" fill="${C.muted}">${esc(t(L.body || {}, 'sub'))}</text>
          <text x="500" y="495" font-family="${FONT_TITLE}" font-size="36" font-weight="800" fill="${C.ink}">${esc(t(L.lower || {}, 'main'))}</text>
          <text x="500" y="536" font-family="${FONT_SANS}" font-size="26" fill="${C.muted}">${esc(t(L.lower || {}, 'sub'))}</text>
        </svg>
      </div>
    </div>`;
  },

  // 비교: 제목 + 캔들 2개 + 라벨 + 테두리 행 2개 + 형광펜 마무리
  compare(c) {
    const rows = (c.rows || []).map(r => `
      <div style="border:3px solid ${C.ink};border-radius:16px;padding:22px 28px;margin-bottom:20px;display:flex;align-items:center;gap:22px">
        <span style="width:30px;height:30px;border-radius:50%;background:${r.dot1 || C.red};flex:none"></span>
        <span style="width:30px;height:30px;border-radius:50%;background:${r.dot2 || C.blue};flex:none;margin-left:-8px"></span>
        <div style="margin-left:10px">
          <div style="font-family:${FONT_TITLE};font-size:31px;font-weight:800;color:${C.ink}">${esc(t(r, 'title'))}</div>
          <div style="font-size:25px;color:${C.muted};margin-top:5px">${esc(t(r, 'desc'))}</div>
        </div>
      </div>`).join('');
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      <svg width="956" height="290" viewBox="0 0 956 290" style="margin-top:26px">
        ${candleSVG({ x: 220, w: 104, open: 200, close: 84, high: 30, low: 258, color: UP, id: 'd' })}
        ${candleSVG({ x: 620, w: 104, open: 84, close: 200, high: 30, low: 258, color: DOWN, id: 'e' })}
      </svg>
      <div style="display:flex;margin-top:6px">
        ${[0, 1].map(i => `<div style="flex:1;text-align:center">
          <div style="font-family:${FONT_TITLE};font-size:28px;font-weight:800;color:${C.ink}">${esc(t((c.legend || [])[i] || {}, 'main'))}</div>
          <div style="font-size:26px;color:${C.muted};margin-top:6px">${esc(t((c.legend || [])[i] || {}, 'sub'))}</div>
        </div>`).join('')}
      </div>
      <div style="margin-top:34px">${rows}</div>
      <div style="flex:1"></div>
      <div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.red}">${esc(t(c, 'closing'))}</span></div>
    </div>`;
  },

  // 실제 사례: 제목 + 감청색 부제 + 캔들 + OHLC 콜아웃 + 결론 박스
  example(c) {
    const v = d(c, 'values', {});
    const rowsY = { high: 118, close: 205, open: 452, low: 512 };
    const call = (key, label, val) => `
      <circle cx="356" cy="${rowsY[key]}" r="9" fill="${C.red}"/>
      <path d="M 366 ${rowsY[key]} Q 430 ${rowsY[key] - 8}, 500 ${rowsY[key]}" stroke="#9a968c" stroke-width="3" fill="none"/>
      <text x="520" y="${rowsY[key] + 11}" font-family="${FONT_TITLE}" font-size="33" font-weight="700" fill="${C.navy}">${esc(label)}</text>
      <text x="940" y="${rowsY[key] + 11}" font-family="${FONT_TITLE}" font-size="35" font-weight="800" fill="${C.ink}" text-anchor="end">${esc(val)}</text>`;
    const up = d(c, 'direction', 'up') !== 'down';
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      <div style="font-family:${FONT_TITLE};font-size:28px;font-weight:800;color:${C.navy};margin-top:12px">${esc(t(c, 'sub'))}</div>
      <div style="flex:1;display:flex;align-items:center">
        <svg width="956" height="580" viewBox="0 0 956 580">
          ${candleSVG({ x: 190, w: 150, open: 452, close: 205, high: 118, low: 512, color: up ? UP : DOWN, id: 'f' })}
          ${call('high', t(v.high || {}, 'label'), v.high?.value ?? '')}
          ${call('close', t(v.close || {}, 'label'), v.close?.value ?? '')}
          ${call('open', t(v.open || {}, 'label'), v.open?.value ?? '')}
          ${call('low', t(v.low || {}, 'label'), v.low?.value ?? '')}
        </svg>
      </div>
      <div class="box ${up ? 'up' : ''}" style="margin-bottom:22px">
        <div style="font-family:${FONT_TITLE};font-size:32px;font-weight:800;color:${C.ink}">${esc(t(c, 'conclusion'))}</div>
        <div style="font-size:26px;color:${C.muted};margin-top:12px">${esc(t(c, 'note'))}</div>
      </div>
    </div>`;
  },

  // 한 걸음 더: 제목 + 번호 항목 3개 + 붉은 경고 박스
  numbered(c) {
    const items = (c.items || []).map((it, i) => `
      <div style="display:flex;gap:26px;align-items:flex-start;padding:22px 0">
        <div style="width:56px;height:56px;border:4px solid ${C.red};border-radius:50%;display:flex;align-items:center;
                    justify-content:center;font-family:${FONT_TITLE};font-size:30px;font-weight:800;color:${C.red};flex:none">${i + 1}</div>
        <div>
          <div style="font-family:${FONT_TITLE};font-size:36px;font-weight:800;color:${C.ink}">${esc(t(it, 'title'))}</div>
          <div style="font-size:28px;color:${C.body};margin-top:8px">${esc(t(it, 'desc'))}</div>
        </div>
      </div>
      ${i < c.items.length - 1 ? `<div style="border-top:3px dashed #cac7bd"></div>` : ''}`).join('');
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      <div style="margin-top:26px">${items}</div>
      <div style="flex:1"></div>
      <div class="box" style="margin-bottom:24px">
        <div style="font-family:${FONT_TITLE};font-size:30px;font-weight:800;color:${C.red}">${esc(t(c, 'warn_title'))}</div>
        <div style="font-family:${FONT_TITLE};font-size:29px;font-weight:700;color:${C.ink};margin-top:12px">${esc(t(c, 'warn_body'))}</div>
      </div>
    </div>`;
  },

  // 선 그래프: 선 여러 개 + 교차점 + 수평선(지지·저항) + 밴드
  // 이동평균선/골든크로스·지지저항·추세선·VIX·볼린저밴드·배당락 등에 두루 쓴다.
  // points 는 0~100 정규화 좌표 (x 왼→오, y 아래→위). 실제 픽셀은 렌더러가 계산한다.
  lines(c) {
    // `note` 를 주면 그림 아래에 붉은 세로줄 문단이 붙는다(`flip.note` 와 같은 장치).
    // 그림은 한 방향만 그리고 «반대 방향도 같다»는 글로 마저 채우는 자리다 — 두 방향을 다 그리면
    // 선이 둘이 되어 그림의 요점이 무너진다(EP.05 에서 확인된 것과 같은 이유). 문단이 들어가는
    // 만큼 그림 높이를 줄여야 카드 밖으로 밀리지 않는다.
    const NOTE = t(c, 'note');
    const W = 900, H = NOTE ? 372 : 470, P = 30;
    const px = (x) => P + (x / 100) * (W - P * 2);
    const py = (y) => (H - P) - (y / 100) * (H - P * 2);
    const SERIES = d(c, 'series', []), MARKER = d(c, 'marker', null);
    const bd = d(c, 'band', null);
    const band = bd ? `<polygon points="${[...bd.upper.map(p => `${px(p[0])},${py(p[1])}`),
    ...[...bd.lower].reverse().map(p => `${px(p[0])},${py(p[1])}`)].join(' ')}"
      fill="${C.navy}" opacity="0.10"/>` : '';
    const levels = (d(c, 'levels', [])).map(l => `
      <line x1="${px(0)}" y1="${py(l.y)}" x2="${px(100)}" y2="${py(l.y)}"
            stroke="${l.color || C.red}" stroke-width="4" stroke-dasharray="14 10"/>
      <text x="${px(100)}" y="${py(l.y) - 12}" text-anchor="end" font-family="${FONT_TITLE}"
            font-size="25" font-weight="800" fill="${l.color || C.red}"
            stroke="${C.paper}" stroke-width="7" paint-order="stroke">${esc(t(l, 'label'))}</text>`).join('');
    const series = SERIES.map(s => `
      <polyline points="${s.points.map(p => `${px(p[0])},${py(p[1])}`).join(' ')}"
                stroke="${s.color || C.navy}" stroke-width="${s.width || 6}" fill="none"
                stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="12 9"' : ''}/>`).join('');
    const mk = MARKER ? `
      <circle cx="${px(MARKER.x)}" cy="${py(MARKER.y)}" r="17" fill="none" stroke="${C.red}" stroke-width="6"/>
      ${/* marker 가 기준선에 가까우면 라벨을 위에 두었을 때 그 선이 글자를 관통한다(en 판에서 실제로
            «Tre—nd break» 로 갈렸다). `below: true` 면 점 아래로 내린다 — 위아래 중 «선이 없는 쪽»을 고른다. */''}
      <text x="${px(MARKER.x)}" y="${py(MARKER.y) + (MARKER.below ? 46 : -32)}" text-anchor="middle" font-family="${FONT_TITLE}"
            font-size="28" font-weight="800" fill="${C.red}"
            stroke="${C.paper}" stroke-width="8" paint-order="stroke">${esc(t(MARKER, 'label'))}</text>` : '';
    const legend = SERIES.filter(s => t(s, 'label')).map(s => `
      <span style="display:inline-flex;align-items:center;gap:12px;margin-right:34px">
        <span style="width:38px;height:7px;background:${s.color || C.navy};border-radius:4px"></span>
        <span style="font-family:${FONT_TITLE};font-size:26px;font-weight:700;color:${C.body}">${esc(t(s, 'label'))}</span>
      </span>`).join('');
    // touches: [{x,y,n}] — 선이 그 높이에서 «몇 번째로» 멈췄는지 번호를 매겨 짚는다.
    // 「한 번은 우연, 두 번부터 자리」가 이 시리즈의 핵심 문장인데 그림이 세어 주지 않으면
    // 독자는 그 말을 글로만 읽는다. 번호가 붙으면 카드가 스스로 근거를 보여 준다.
    const touches = (d(c, 'touches', [])).map(p => `
      <circle cx="${px(p.x)}" cy="${py(p.y)}" r="16" fill="${C.paper}" stroke="${C.red}" stroke-width="5"/>
      <text x="${px(p.x)}" y="${py(p.y) + 9}" text-anchor="middle" font-family="${FONT_TITLE}"
            font-size="24" font-weight="800" fill="${C.red}">${esc(String(p.n))}</text>`).join('');
    // 바닥 축선은 «0 이 의미 있는» 그림(VIX·거래대금 등)에서만 쓸모가 있다. 데이터가 0 근처에
    // 가지 않는 그림(지지·저항처럼 가격대만 보는 것)에서는 화면 한가운데 떠 있는 회색 선이
    // 되어 정체불명의 세 번째 수평선으로 읽힌다 — EP.05 p.04 에서 실제로 그랬다.
    const axis = d(c, 'axis', true)
      ? `<line x1="${px(0)}" y1="${py(0)}" x2="${px(100)}" y2="${py(0)}" stroke="#c9c6bc" stroke-width="3"/>` : '';
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      ${/* 본문이 한 줄만 길어져도(ko·en 모두 4줄이 되는 회차가 있다) 고정 높이 그림이 종이 아래로
            밀려 마무리 칩이 잘렸다 — EP.06 p.06 이 ko·en 양쪽에서 그랬다. `min-height:0` 으로 이 칸이
            줄어들 수 있게 하고 그림에 `max-height:100%` 를 줘서, 자리가 모자라면 그림이 «비율 그대로
            조금 작아지도록» 한다. 본문을 깎아 사실을 버리는 것보다 그림이 몇 % 작아지는 편이 낫다. */''}
      <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">
        <svg width="900" height="${H}" viewBox="0 0 ${W} ${H}"
             style="max-width:100%;max-height:100%">
          ${axis}${band}${levels}${series}${mk}${touches}
        </svg>
      </div>
      ${legend ? `<div style="margin-bottom:14px">${legend}</div>` : ''}
      ${NOTE ? `<div style="border-left:6px solid ${C.red};padding:6px 0 6px 20px;margin-bottom:18px;
             font-family:${FONT_TITLE};font-size:26px;font-weight:700;line-height:1.5;color:${C.body}">${esc(NOTE)}</div>` : ''}
      ${t(c, 'closing') ? `<div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 막대 비교: 거래량·시가총액·PER 등 "숫자 몇 개를 나란히" 보여줄 때
  //
  // 단위가 다른 지표 두 벌을 한 카드에서 견주려면 `sections` 를 쓴다
  // (예: 같은 날 두 종목의 «거래량(주)» 과 «거래대금(원)»).
  // 막대 길이는 **섹션 안에서만** 정규화하므로 주(株)와 원(₩)이 한 자에 섞이지 않는다.
  // `items` 만 주면 예전처럼 이름 없는 섹션 하나로 동작한다(기존 회차 그대로).
  bars(c) {
    const SECTIONS = d(c, 'sections', null) || [{ items: d(c, 'items', []) }];
    const block = (sec) => {
      const items = d(sec, 'items', []);
      const max = Math.max(...items.map(i => Math.abs(i.value) || 0), 1);
      const heading = t(sec, 'heading');
      const rows = items.map(it => {
        const w = Math.max((Math.abs(it.value) / max) * 100, 3);
        const hi = it.highlight;
        return `<div style="margin-bottom:22px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px">
            <span style="font-family:${FONT_TITLE};font-size:29px;font-weight:${hi ? 800 : 700};color:${hi ? C.red : C.ink}">${esc(t(it, 'label'))}</span>
            <span style="font-family:${FONT_TITLE};font-size:31px;font-weight:800;color:${hi ? C.red : C.ink}">${esc(t(it, 'display') || it.value)}</span>
          </div>
          <div style="height:34px;background:#eceade;border-radius:6px;overflow:hidden">
            <div style="width:${w}%;height:100%;background:${it.color || (hi ? C.red : C.navy)};opacity:${hi ? 1 : 0.72}"></div>
          </div>
        </div>`;
      }).join('');
      return `${heading ? `<div style="font-family:${FONT_TITLE};font-size:27px;font-weight:800;color:${C.navy};margin-bottom:16px">${esc(heading)}</div>` : ''}
        ${rows}`;
    };
    const blocks = SECTIONS.map((s, i) => `<div style="margin-bottom:${i < SECTIONS.length - 1 ? 30 : 0}px">${block(s)}</div>`
      + (i < SECTIONS.length - 1 ? `<div style="border-top:3px dashed #cac7bd;margin-bottom:28px"></div>` : '')).join('');
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin-top:30px">${blocks}</div>
      <div style="flex:1"></div>
      ${t(c, 'closing') ? `<div class="box" style="margin-bottom:22px"><div style="font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</div></div>` : ''}
    </div>`;
  },

  // 개념 대 개념: 헷갈리는 둘을 «같은 항목별로» 한 줄씩 맞대어 놓는다.
  //
  // `compare` 는 캔들 두 개가 코드에 박혀 있어 «상승 캔들 vs 하락 캔들» 밖에 못 그린다.
  // 그림으로 갈리지 않는 개념 쌍(거래량 vs 거래대금, PER vs PBR, 현물 vs 선물,
  // 액면분할 전 vs 후)은 «항목별 표»여야 차이가 보인다. EP.04 의 p.06 이 이 타입이
  // 없어 `bars` 로 만들어졌다가 "거래량을 강조하는 건지 주식 수를 강조하는 건지
  // 모르겠다"는 지적을 받았다(2026-08-23 이슈 #23).
  //
  // **왼쪽 칸이 그 회차의 주제다** — 감청색으로 칠해져 "이 편이 다루는 건 이쪽"이
  // 한눈에 보인다. 오른쪽은 «구별해야 할 다른 것»이므로 눌러 둔다. 순서를 뒤집으면
  // 강조가 엉뚱한 개념에 붙으므로 바꾸지 않는다.
  //
  //   columns: [{ name, unit }] — 정확히 2개
  //   rows:    [{ label, left, right, highlight }] — highlight 는 오른쪽 값을 붉게 짚는다
  versus(c) {
    const cols = d(c, 'columns', []);
    const head = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      ${[0, 1].map(i => {
        const col = cols[i] || {};
        const main = i === 0;
        return `<div style="border-radius:14px;padding:14px 18px;text-align:center;background:${main ? C.navy : '#eceade'}">
          <div style="font-family:${FONT_TITLE};font-size:32px;font-weight:800;color:${main ? C.paper : C.ink}">${esc(t(col, 'name'))}</div>
          <div style="font-size:24px;margin-top:4px;color:${main ? '#c9d1e2' : C.muted}">${esc(t(col, 'unit'))}</div>
        </div>`;
      }).join('')}
    </div>`;
    const rows = d(c, 'rows', []).map(r => `
      <div style="margin-top:22px">
        <div style="font-size:26px;color:${C.muted};margin-bottom:9px">${esc(t(r, 'label'))}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          ${['left', 'right'].map((k, i) => {
            const hot = r.highlight && i === 1;
            return `<div style="border:3px solid ${hot ? C.red : '#cac7bd'};border-radius:14px;padding:15px 12px;text-align:center;display:flex;align-items:center;justify-content:center;min-height:44px">
              <span style="font-family:${FONT_TITLE};font-size:29px;font-weight:800;line-height:1.25;color:${i === 0 ? C.navy : (hot ? C.red : C.body)}">${esc(t(r, k))}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin-top:30px">${head}${rows}</div>
      <div style="flex:1"></div>
      ${t(c, 'closing') ? `<div style="margin-bottom:22px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.red}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 역할 반전: «뚫린 저항선이 지지선이 된다»를 선 하나로 보여준다.
  //
  // 이 개념은 지지·저항 회차의 핵심인데 `versus` 표의 한 칸이나 `numbered` 의 한 줄로는
  // 전달되지 않는다 — 「위에서 누르는 자리로」라는 말만 읽고 그림을 못 본다.
  // 사용자가 EP.05 검토에서 이 부분을 콕 집어 보강을 요청했다(2026-08-30 이슈 #25).
  //
  // 그림의 요점은 «선이 하나뿐»이라는 것이다. 되밀린 자리와 받쳐 준 자리가 같은 높이임을
  // 눈으로 확인해야 "이름만 바뀐다"는 말이 들어온다. 그래서 선을 두 개로 나눠 그리지
  // 않고, 하나의 가로선 위아래에 라벨을 갈라 붙인다 — 라벨은 각각 «가격이 아직 닿지 않은
  // 쪽»의 빈 공간에 놓이므로 겹치지 않는다.
  //
  //   before / after — 돌파 전·후의 이름 (예: 저항선 / → 이제는 지지선)
  //   break / retest — 돌파 지점·되돌아와 멈춘 지점의 문구
  flip(c) {
    const W = 900, H = 440, LV = 210;
    const arrow = (x, y1, y2) => {
      const dir = y2 > y1 ? 1 : -1;
      return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${C.red}" stroke-width="5"
                    stroke-linecap="round" opacity="0.85"/>
              <path d="M ${x - 11} ${y2 - dir * 14} L ${x} ${y2} L ${x + 11} ${y2 - dir * 14}"
                    stroke="${C.red}" stroke-width="5" fill="none" stroke-linejoin="round"
                    stroke-linecap="round" opacity="0.85"/>`;
    };
    const mark = (x, y) => `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${C.red}" stroke-width="6"/>`;
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      ${/* 본문이 한 줄만 길어져도(ko·en 모두 4줄이 되는 회차가 있다) 고정 높이 그림이 종이 아래로
            밀려 마무리 칩이 잘렸다 — EP.06 p.06 이 ko·en 양쪽에서 그랬다. `min-height:0` 으로 이 칸이
            줄어들 수 있게 하고 그림에 `max-height:100%` 를 줘서, 자리가 모자라면 그림이 «비율 그대로
            조금 작아지도록» 한다. 본문을 깎아 사실을 버리는 것보다 그림이 몇 % 작아지는 편이 낫다. */''}
      <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">
        <svg width="900" height="${H}" viewBox="0 0 ${W} ${H}"
             style="max-width:100%;max-height:100%">
          <line x1="24" y1="${LV}" x2="${W - 24}" y2="${LV}" stroke="${C.red}" stroke-width="5"
                stroke-dasharray="16 11"/>
          <polyline points="30,380 140,216 240,330 350,214 445,340 560,122 625,104 700,205 800,96 870,62"
                    stroke="${C.navy}" stroke-width="7" fill="none"
                    stroke-linejoin="round" stroke-linecap="round"/>
          ${arrow(140, 242, 292)}${arrow(350, 240, 290)}${arrow(768, 200, 156)}
          ${mark(514, LV)}${mark(700, 205)}
          <path d="M 462 158 L 503 200" stroke="${C.red}" stroke-width="3" fill="none"/>
          <text x="456" y="150" text-anchor="end" font-family="${FONT_TITLE}" font-size="27"
                font-weight="800" fill="${C.red}">${esc(t(c, 'break'))}</text>
          <text x="34" y="${LV - 20}" font-family="${FONT_TITLE}" font-size="28" font-weight="800"
                fill="${C.red}">${esc(t(c, 'before'))}</text>
          <path d="M 676 256 L 704 226" stroke="${C.red}" stroke-width="3" fill="none"/>
          <text x="${W - 24}" y="${LV + 62}" text-anchor="end" font-family="${FONT_TITLE}" font-size="28"
                font-weight="800" fill="${C.red}">${esc(t(c, 'after'))}</text>
          <text x="${W - 24}" y="${LV + 100}" text-anchor="end" font-family="${FONT_SANS}" font-size="25"
                fill="${C.muted}">${esc(t(c, 'retest'))}</text>
        </svg>
      </div>
      ${/* note — 그림이 한 방향만 보여 주므로 «반대 방향도 같다»를 글로 마저 채운다.
            지지선이 무너져 저항선이 되는 쪽까지 그리면 선이 둘이 되어 «같은 선 하나»라는
            그림의 요점이 무너진다. 사용자가 요청한 것은 양방향 개념이지 양방향 그림이 아니다. */
      t(c, 'note') ? `<div style="border-left:6px solid ${C.red};padding:6px 0 6px 20px;margin-bottom:20px;
             font-family:${FONT_TITLE};font-size:27px;font-weight:700;color:${C.body}">${esc(t(c, 'note'))}</div>` : ''}
      ${t(c, 'closing') ? `<div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 주가 + 거래량 2단 패널 — 실제 차트가 생긴 그대로.
  //
  // 거래량은 «가격 그래프 아래에 붙은 세로 막대»다. 그런데 이 렌더러에는 오랫동안
  // 그 그림이 없어서, EP.04(거래량) 초안이 가로 막대(`bars`)로 거래량을 설명했다 —
  // 그건 순위 비교용 그림이라 "이게 거래량 얘기인지 막대그래프 얘기인지 모르겠다"는
  // 지적을 받았다(2026-08-23 수정 요청). 거래량을 다루면서 거래량이 실제로 어떻게
  // 생겼는지 한 번도 안 보여준 셈이었다. 그래서 이 타입을 만든다.
  //
  // 앞으로 지지·저항, 이동평균선, 거래대금, 배당락처럼 «가격과 무엇을 나란히 봐야 하는»
  // 회차는 전부 이 타입 하나로 그린다.
  //
  //   mode: 'candle'(기본) — 캔들 + 거래량 막대 / 'line' — 종가 꺾은선 + 거래량 막대
  //   bars: [{ o,h,l,c, v, hi }]  ('line' 모드는 c·v 만 쓴다)
  //   avg:  거래량 평균선 값 (없으면 안 그린다) · avg_label 로 라벨
  //   frame: true 면 거래량 패널을 붉은 점선으로 감싼다 ("여기가 거래량입니다")
  //   xlabels: [{ i, text }] · callout: { i, text } 는 그 막대 위에 화살표+문구
  pricevol(c) {
    const W = 900, H = 620;
    const BARS = d(c, 'bars', []);
    const n = BARS.length || 1;
    const PADL = 14, PADR = 14;
    // 위: 주가 / 아래: 거래량. 사이를 확실히 띄워 "두 칸짜리 차트"로 읽히게 한다.
    // 주가:거래량 = 약 2:1 — 실제 HTS 보다 거래량 칸을 넉넉히 준다. 이 시리즈에서
    // 거래량은 곁다리가 아니라 본문이기 때문이다.
    const PT = 52, PB = 330;          // 주가 패널 위·아래
    const COY = 372;                  // 콜아웃 전용 줄 (아래 헤더와 절대 겹치지 않게 따로 뺀다)
    const HDY = 404;                  // 거래량 패널 머리글 줄: 왼쪽 패널명 · 오른쪽 평균선 범례
    const VT = 416, VB = 560;         // 거래량 패널 위·아래
    const slot = (W - PADL - PADR) / n;
    const cx = (i) => PADL + slot * (i + 0.5);
    const bw = Math.max(Math.min(slot * 0.62, 46), 6);

    const highs = BARS.map(b => b.h ?? b.c), lows = BARS.map(b => b.l ?? b.c);
    const hi = Math.max(...highs), lo = Math.min(...lows);
    const span = (hi - lo) || 1;
    const py = (v) => PB - ((v - (lo - span * 0.08)) / (span * 1.16)) * (PB - PT);

    const AVG = d(c, 'avg', null);
    const vmax = Math.max(...BARS.map(b => b.v || 0), AVG || 0, 1) * 1.14;
    const vy = (v) => VB - (v / vmax) * (VB - VT);

    const mode = d(c, 'mode', 'candle');
    const colOf = (b) => ((b.c ?? 0) >= (b.o ?? b.c ?? 0) ? UP : DOWN);

    const price = mode === 'line'
      ? `<polyline points="${BARS.map((b, i) => `${cx(i)},${py(b.c)}`).join(' ')}"
                   stroke="${C.navy}" stroke-width="6" fill="none"
                   stroke-linejoin="round" stroke-linecap="round"/>`
      : BARS.map((b, i) => {
        const col = colOf(b);
        const top = Math.min(py(b.o), py(b.c));
        const hgt = Math.max(Math.abs(py(b.c) - py(b.o)), 3);
        return `<line x1="${cx(i)}" y1="${py(b.h)}" x2="${cx(i)}" y2="${py(b.l)}" stroke="${col}" stroke-width="3"/>
                <rect x="${cx(i) - bw / 2}" y="${top}" width="${bw}" height="${hgt}"
                      fill="${col}" stroke="${col}" stroke-width="2" opacity="${b.hi ? 1 : 0.82}"/>`;
      }).join('');

    // 강조 막대도 **색은 방향 그대로** 두고 굵은 검정 테두리로만 짚는다.
    // 붉게 칠하면 한국어판에서 «빨강 = 상승» 과 정면으로 어긋난다 — 하락일 급증을
    // 빨간 막대로 그리면 EP.01 이 가르친 색 관행을 이 시리즈가 스스로 어기는 셈이다.
    const vbars = BARS.map((b, i) => {
      const y = vy(b.v || 0);
      return `<rect x="${cx(i) - bw / 2}" y="${y}" width="${bw}" height="${Math.max(VB - y, 2)}"
                    fill="${colOf(b)}" opacity="${b.hi ? 1 : 0.5}"
                    ${b.hi ? `stroke="${C.ink}" stroke-width="4"` : ''}/>`;
    }).join('');

    // 평균선 범례는 거래량 패널 «머리글 줄» 오른쪽 끝에 둔다. 막대 옆에 두면
    // 오른쪽 끝 막대들과 겹친다(실제로 겹쳤다).
    const avgLine = AVG ? `
      <line x1="${PADL}" y1="${vy(AVG)}" x2="${W - PADR}" y2="${vy(AVG)}"
            stroke="${C.ink}" stroke-width="4" stroke-dasharray="13 9"/>
      <line x1="${W - PADR - 215}" y1="${HDY - 8}" x2="${W - PADR - 171}" y2="${HDY - 8}"
            stroke="${C.ink}" stroke-width="4" stroke-dasharray="13 9"/>
      <text x="${W - PADR}" y="${HDY}" text-anchor="end" font-family="${FONT_TITLE}"
            font-size="25" font-weight="800" fill="${C.ink}">${esc(t(c, 'avg_label'))}</text>` : '';

    // 콜아웃은 평균선 범례보다 한 줄 위(COY)에 단독으로 놓는다. 같은 줄에 두었더니
    // 문구·지시선·점선 범례가 한 자리에서 엉켰다.
    // 막대가 오른쪽 절반이면 문구를 그 왼쪽에, 왼쪽 절반이면 오른쪽에 붙여 지시선이 짧게 떨어진다.
    const CO = d(c, 'callout', null);
    const callout = CO ? (() => {
      const x = cx(CO.i), yTop = vy(BARS[CO.i]?.v || 0);
      const right = x > W / 2;
      const anchor = right ? 'end' : 'start';
      const tx = right ? Math.max(x - 34, PADL + 60) : Math.min(x + 34, W - PADR - 60);
      // 지시선은 «가로로 빠졌다가 막대 바로 위에서 수직으로 내려꽂는» ㄱ자로 그린다.
      // 문구에서 막대까지 비스듬히 그으면 그 사선이 머리글 줄(HDY)을 가로질러
      // 평균선 범례의 점선 조각을 관통한다 — ko card6 에서 실제로 그랬다.
      // 수직 구간은 x = 막대 중심이라 오른쪽 끝에 있는 범례와 절대 만나지 않는다.
      return `<path d="M ${tx} ${COY + 10} L ${x} ${COY + 10} L ${x} ${yTop - 6}"
                    stroke="${C.red}" stroke-width="3" fill="none"
                    stroke-linejoin="round" stroke-linecap="round"/>
              <text x="${tx}" y="${COY}" text-anchor="${anchor}" font-family="${FONT_TITLE}"
                    font-size="27" font-weight="800" fill="${C.red}">${esc(t(CO, 'text'))}</text>`;
    })() : '';

    // levels: [{ price, to, label, color }] — 실제 가격 값에 가로 기준선을 긋는다
    // (지지선·저항선·목표가·배당락 기준가 등). 좌표가 아니라 «그 회차가 인용한 진짜 가격»을
    // 그대로 주므로, 4단계에서 대조한 수치와 그림이 어긋날 수 없다.
    // `to` 를 함께 주면 두 값 사이를 «구간»으로 칠한다 — 지지·저항은 한 값이 아니라 폭이 있는
    // 띠이고(그래서 카드도 그렇게 가르친다), 선 하나로 그리면 그림이 설명을 배반한다.
    const zones = (d(c, 'levels', [])).map((l) => {
      const col = l.color || C.red;
      const ya = py(l.price), yb = (l.to != null) ? py(l.to) : null;
      const top = (yb != null) ? Math.min(ya, yb) : ya;
      const band = (yb != null) ? `<rect x="${PADL}" y="${top}" width="${W - PADL - PADR}"
            height="${Math.max(Math.abs(yb - ya), 3)}" fill="${col}" opacity="0.20"/>` : '';
      const edges = [ya, yb].filter((v) => v != null).map((y) =>
        `<line x1="${PADL}" y1="${y}" x2="${W - PADR}" y2="${y}" stroke="${col}"
               stroke-width="4" stroke-dasharray="14 10"/>`).join('');
      return `${band}${edges}
        <text x="${W - PADR}" y="${top - 12}" text-anchor="end" font-family="${FONT_TITLE}"
              font-size="25" font-weight="800" fill="${col}"
              stroke="${C.paper}" stroke-width="7" paint-order="stroke">${esc(t(l, 'label'))}</text>`;
    }).join('');

    // trendline: { from:{i,price}, to:{i,price}, label } — 주가 패널에 «비스듬한» 기준선을 긋는다.
    // `levels` 는 가로선이라 추세선·채널을 그릴 수 없다. 두 끝점을 «봉 번호 + 실제 가격»으로 받으므로,
    // 4단계에서 대조한 저점(예: 7/30 저가 202,000원)이 그대로 선의 끝이 되어 그림이 설명을 배반할 수 없다.
    // 오른쪽 끝점에는 선을 늘려 얻은 «그 선 위의 값»을 넣는다 — 그래야 본문이 인용한 값과 그림이 일치한다.
    const TL = d(c, 'trendline', null);
    const trend = TL ? (() => {
      const x1 = cx(TL.from.i), y1 = py(TL.from.price), x2 = cx(TL.to.i), y2 = py(TL.to.price);
      // 라벨은 선의 72% 지점에 «가격이 아직 오지 않은 쪽»으로 붙인다 — 우상향 추세선이면 선 아래,
      // 우하향이면 선 위가 그 빈 공간이다. 끝점(오른쪽 끝)에 붙였더니 마지막 캔들·마지막 번호
      // 동그라미와 정확히 겹쳤다(ko·en 양쪽에서 실제로 겹쳤다).
      // `label_at`(0~1) 로 선 위 어디에 붙일지 회차가 정한다. 기본 0.72 가 늘 비어 있지는 않다 —
      // 그 자리에 `marks` 의 번호 동그라미가 있으면 정확히 겹친다(en 판에서 실제로 겹쳤다).
      // 번호 동그라미가 없는 구간을 골라 준다.
      const up = y2 < y1;   // SVG y 는 작을수록 높은 가격
      const at = d(TL, 'label_at', 0.72);
      const lx = x1 + (x2 - x1) * at, ly = y1 + (y2 - y1) * at;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.red}" stroke-width="5"
                    stroke-dasharray="15 10" stroke-linecap="round"/>
              ${t(TL, 'label') ? `<text x="${lx}" y="${ly + (up ? 38 : -22)}" text-anchor="middle"
                    font-family="${FONT_TITLE}" font-size="25" font-weight="800" fill="${C.red}"
                    stroke="${C.paper}" stroke-width="7" paint-order="stroke">${esc(t(TL, 'label'))}</text>` : ''}`;
    })() : '';

    // marks: [{ i, price, n, label }] — 그 선에서 «몇 번째로» 멈춘 날인지 번호 동그라미를 찍는다.
    // `lines.touches` 와 같은 역할이되 좌표가 아니라 실제 가격을 받는다. 카드가 "세 번 닿았다"고
    // 써 놓고 그림이 세어 주지 않으면 독자는 그 말을 글로만 읽는다(EP.05 에서 확인된 것과 같은 이유).
    //
    // `n` 을 빼면 빈 동그라미가 된다 — «세는 자리»가 아니라 «끊긴 자리»를 짚을 때 쓴다(추세 이탈).
    // `label` 은 그 위에 붙는다. 오른쪽 절반이면 글자를 왼쪽으로 뻗어 카드 밖으로 넘치지 않게 한다.
    // (거래량 패널을 가리키는 `callout` 과 혼동하지 말 것 — 그쪽은 막대를, 이쪽은 주가를 짚는다.)
    const marks = (d(c, 'marks', [])).map(m => {
      const mx = cx(m.i), my = py(m.price), right = mx > W / 2;
      return `
      <circle cx="${mx}" cy="${my}" r="16" fill="${C.paper}" stroke="${C.red}" stroke-width="5"/>
      ${m.n != null ? `<text x="${mx}" y="${my + 9}" text-anchor="middle" font-family="${FONT_TITLE}"
            font-size="24" font-weight="800" fill="${C.red}">${esc(String(m.n))}</text>` : ''}
      ${t(m, 'label') ? `<text x="${right ? Math.min(mx + 40, W - PADR) : Math.max(mx - 40, PADL)}"
            y="${my + 44}" text-anchor="${right ? 'end' : 'start'}" font-family="${FONT_TITLE}"
            font-size="25" font-weight="800" fill="${C.red}" stroke="${C.paper}" stroke-width="7"
            paint-order="stroke">${esc(t(m, 'label'))}</text>` : ''}`;
    }).join('');

    const frame = d(c, 'frame', false) ? `
      <rect x="${PADL - 10}" y="${VT - 6}" width="${W - PADL - PADR + 20}" height="${VB - VT + 22}"
            fill="none" stroke="${C.red}" stroke-width="4" stroke-dasharray="14 10" rx="12"/>` : '';

    const xlabels = (d(c, 'xlabels', [])).map(l => `
      <text x="${cx(l.i)}" y="${VB + 38}" text-anchor="middle" font-family="${FONT_TITLE}"
            font-size="24" font-weight="700" fill="${C.muted}">${esc(t(l, 'text'))}</text>`).join('');

    const tag = (label, y) => label ? `
      <text x="${PADL + 4}" y="${y}" font-family="${FONT_TITLE}" font-size="25" font-weight="800"
            fill="${C.navy}" stroke="${C.paper}" stroke-width="7" paint-order="stroke">${esc(label)}</text>` : '';

    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      ${/* 본문이 한 줄만 길어져도(ko·en 모두 4줄이 되는 회차가 있다) 고정 높이 그림이 종이 아래로
            밀려 마무리 칩이 잘렸다 — EP.06 p.06 이 ko·en 양쪽에서 그랬다. `min-height:0` 으로 이 칸이
            줄어들 수 있게 하고 그림에 `max-height:100%` 를 줘서, 자리가 모자라면 그림이 «비율 그대로
            조금 작아지도록» 한다. 본문을 깎아 사실을 버리는 것보다 그림이 몇 % 작아지는 편이 낫다. */''}
      <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">
        <svg width="900" height="${H}" viewBox="0 0 ${W} ${H}"
             style="max-width:100%;max-height:100%">
          <line x1="${PADL}" y1="${PB}" x2="${W - PADR}" y2="${PB}" stroke="#c9c6bc" stroke-width="3"/>
          <line x1="${PADL}" y1="${VB}" x2="${W - PADR}" y2="${VB}" stroke="#c9c6bc" stroke-width="3"/>
          ${frame}${zones}${price}${trend}${marks}${vbars}${avgLine}${callout}
          ${tag(t(c, 'price_label'), PT - 14)}
          ${tag(t(c, 'panel_label'), HDY)}
          ${xlabels}
        </svg>
      </div>
      ${t(c, 'closing') ? `<div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 거울 두 칸: 같은 방법이 «방향만 반대»로 쓰이는 것을 나란히 보여준다.
  //
  // 한 방향만 그린 그림은 한 방향만 가르치는 회차가 된다. EP.06(추세선) 이 그랬다 —
  // 하락 추세선을 본문 주석으로는 적었는데 그림 다섯 개가 전부 상승이라, 카드를 훑는 사람은
  // 상승만 가져갔다. 주석은 읽히지 않고 그림이 읽힌다.
  //
  // 왼쪽은 저점을 이어 «아래»에 긋는 선, 오른쪽은 고점을 이어 «위»에 긋는 선.
  // 선이 가격의 어느 쪽에 붙는지가 이 그림의 요점이라 두 칸을 반드시 나란히 둔다.
  // 갭 상승/하락, 골든/데드크로스, 상승/하락 채널처럼 대칭이 있는 회차에 그대로 쓴다.
  //
  //   left/right = { label, caption }  ← 각각 _ko/_en
  mirror(c) {
    const PW = 420, PH = 250, GAP = 50, H = 330, TOP = 44;
    const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${C.paper}" stroke="${C.red}" stroke-width="4"/>`;
    // 왼쪽: 저점 세 개가 우상향 직선 위에 얹힌다(선은 가격 «아래»).
    const UP_LINE = [[10, 215], [405, 95]];
    const UP_ZIG = [[20, 205], [60, 198], [110, 150], [180, 162], [240, 110], [300, 125], [360, 75], [405, 90]];
    const UP_DOTS = [[60, 198], [180, 162], [300, 125]];
    // 오른쪽: 고점 세 개가 우하향 직선에 닿는다(선은 가격 «위»).
    const DN_LINE = [[10, 95], [405, 215]];
    const DN_ZIG = [[20, 120], [60, 112], [110, 160], [180, 148], [240, 195], [300, 185], [360, 235], [405, 220]];
    const DN_DOTS = [[60, 112], [180, 148], [300, 185]];

    const panel = (ox, line, zig, dots, key) => `
      <g transform="translate(${ox},0)">
        <text x="${PW / 2}" y="26" text-anchor="middle" font-family="${FONT_TITLE}" font-size="30"
              font-weight="800" fill="${C.navy}">${esc(t(c, `${key}_label`))}</text>
        <g transform="translate(0,${TOP})">
          <rect x="0" y="0" width="${PW}" height="${PH}" fill="none" stroke="#dcd8cc" stroke-width="2" rx="10"/>
          <line x1="${line[0][0]}" y1="${line[0][1]}" x2="${line[1][0]}" y2="${line[1][1]}"
                stroke="${C.red}" stroke-width="5" stroke-dasharray="15 10" stroke-linecap="round"/>
          <polyline points="${zig.map(p => p.join(',')).join(' ')}" stroke="${C.navy}" stroke-width="6"
                    fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots.map(p => dot(p[0], p[1])).join('')}
        </g>
        <text x="${PW / 2}" y="${TOP + PH + 34}" text-anchor="middle" font-family="${FONT_SANS}"
              font-size="23" fill="${C.body}">${esc(t(c, `${key}_caption`))}</text>
      </g>`;

    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="flex:1;display:flex;align-items:center">
        <svg width="900" height="${H}" viewBox="0 0 ${PW * 2 + GAP} ${H}">
          ${panel(0, UP_LINE, UP_ZIG, UP_DOTS, 'left')}
          ${panel(PW + GAP, DN_LINE, DN_ZIG, DN_DOTS, 'right')}
        </svg>
      </div>
      ${t(c, 'note') ? `<div style="border-left:6px solid ${C.red};padding:6px 0 6px 20px;margin-bottom:18px;
             font-family:${FONT_TITLE};font-size:26px;font-weight:700;line-height:1.5;color:${C.body}">${esc(t(c, 'note'))}</div>` : ''}
      ${t(c, 'closing') ? `<div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 공식: 분수 꼴 수식 + 각 항 설명 + 실제 숫자로 계산해 보기
  // PER·PBR·EPS·배당수익률·ROE 처럼 "나누기 하나로 끝나는" 지표에 쓴다.
  formula(c) {
    const f = c.formula || {};
    const parts = (c.parts || []).map(p => `
      <div style="display:flex;gap:18px;align-items:baseline;margin-bottom:16px">
        <span style="font-family:${FONT_TITLE};font-size:28px;font-weight:800;color:${C.red};min-width:210px">${esc(t(p, 'term'))}</span>
        <span style="font-size:27px;color:${C.body}">${esc(t(p, 'desc'))}</span>
      </div>`).join('');
    const ex = c.example ? `
      <div class="box" style="margin-bottom:22px">
        <div style="font-family:${FONT_TITLE};font-size:26px;font-weight:800;color:${C.navy};margin-bottom:12px">${esc(t(c.example, 'title'))}</div>
        ${(c.example.lines || []).map(l => `<div style="font-family:${FONT_TITLE};font-size:29px;font-weight:700;color:${C.ink};margin-top:6px">${esc(t(l, 'text'))}</div>`).join('')}
      </div>` : '';
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin:38px 0 34px;display:flex;align-items:center;justify-content:center;gap:26px">
        <div style="text-align:center">
          <div style="font-family:${FONT_TITLE};font-size:38px;font-weight:800;color:${C.ink};padding:0 24px">${esc(t(f, 'numerator'))}</div>
          <div style="height:5px;background:${C.ink};margin:14px 0"></div>
          <div style="font-family:${FONT_TITLE};font-size:38px;font-weight:800;color:${C.ink};padding:0 24px">${esc(t(f, 'denominator'))}</div>
        </div>
        ${t(f, 'result') ? `<div style="font-family:${FONT_TITLE};font-size:38px;font-weight:800;color:${C.red};white-space:nowrap">= ${esc(t(f, 'result'))}</div>` : ''}
      </div>
      ${parts}
      <div style="flex:1"></div>
      ${ex}
    </div>`;
  },

  // 요약: 제목 + 체크 3줄 + 형광펜 CTA 2개 + 다음 편 예고 + 고지
  recap(c) {
    const lines = (c.points || []).map(p => `
      <div style="display:flex;align-items:center;gap:24px;margin-bottom:30px">
        <div class="cb"></div>
        <div style="font-family:${FONT_TITLE};font-size:35px;font-weight:800;color:${C.ink}">${esc(t(p, 'text'))}</div>
      </div>`).join('');
    const ctas = (c.ctas || []).map(x => `
      <div style="margin-bottom:18px"><span style="background:${C.yellow};padding:11px 20px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(x, 'text'))}</span></div>`).join('');
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      <div style="margin-top:44px">${lines}</div>
      <div style="margin-top:22px">${ctas}</div>
      <div style="margin-top:20px">
        <span style="font-family:${FONT_TITLE};font-size:33px;font-weight:700;color:${C.navy}">${esc(t(c, 'next_label'))} ▶ ${esc(t(c, 'next'))}</span>
        <svg width="680" height="14" style="display:block;margin-top:6px"><path d="M 2 7 Q 180 1, 360 8 T 676 6" stroke="${C.navy}" stroke-width="4" fill="none"/></svg>
      </div>
      <div style="flex:1"></div>
      <div style="font-size:25px;color:${C.muted};margin-bottom:22px">${esc(t(c, 'disclaimer'))}</div>
    </div>`;
  },
};

// ---------- 변종 이름 검사 ----------
// `type` 이 틀리면 아래에서 바로 죽지만, 그림을 «고르는» 값들(overlay·sketch·direction·mode)은
// 지금까지 모르는 값을 만나면 조용히 기본 그림으로 떨어졌다. 그러면 카드는 멀쩡히 만들어지는데
// 본문이 말하는 그림과 다른 그림이 실린다 — EP.06 에서 표지 제목은 «기울어진 선»을 말하는데
// overlay:'trend2' 가 없는 옛 렌더러로 돌아 선이 하나도 없는 표지가 나왔고, 렌더는 성공으로
// 끝나서 아무도 못 봤다. direction 은 더 위험하다: 'down' 을 조금이라도 다르게 적으면
// «하락»이라고 써 놓고 상승 그림이 그려진다. 그래서 모르는 값은 여기서 멈춘다.
const VARIANTS = {
  cover: { overlay: ['volume', 'trend', 'trend2', 'levels', 'ma', 'cross'] },
  intro: { sketch: ['zigzag', 'mystery-slope', 'mystery-levels'] },
  lines: { direction: ['up', 'down'] },
  pricevol: { mode: ['candle', 'line'] },
};
for (const [i, c] of data.cards.entries()) {
  for (const [field, allowed] of Object.entries(VARIANTS[c.type] || {})) {
    if (c[field] == null) continue;                     // 없으면 기본값 — 그건 의도된 것이다
    if (!allowed.includes(c[field])) {
      console.error(`❌ 카드 ${i + 1}(${c.type}): 알 수 없는 ${field} "${c[field]}". `
        + `가능한 값: ${allowed.join(', ')}\n`
        + `   ※ 값이 맞는데도 이 오류가 난다면 렌더러가 옛 버전이다. `
        + `스크립트 정본은 main 이므로 claude/live 에서 렌더하기 전에\n`
        + `     git fetch origin main && git checkout FETCH_HEAD -- scripts/chart-notes/`);
      process.exit(1);
    }
  }
}

// ---------- 렌더 ----------
const htmls = data.cards.map((c, i) => {
  const fn = c.type && !String(c.type).startsWith('_') ? R[c.type] : null;   // `_` 로 시작하는 것은 내부 조각이다
  if (!fn) { console.error(`❌ 카드 ${i + 1}: 알 수 없는 type "${c.type}". 가능한 값: ${Object.keys(R).filter(k => !k.startsWith('_')).join(', ')}`); process.exit(1); }
  return page(fn(c), i + 1);
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
// 넘침은 이 시리즈에서 가장 자주 난 사고다(한 회차에서만 여덟 번). 절차서는 «눈으로 확인»을
// 요구하지만 사람 눈은 여덟 번 중 몇 번을 놓친다 — 실제로 EP.06 p.06 은 ko·en 양쪽이 잘린 채
// 사용자에게 갔다. 그래서 브라우저에게 직접 묻는다: 종이(.paper) 안쪽 아래·오른쪽 경계를
// 넘어간 요소가 있나. 있으면 그 카드 번호와 요소를 찍고 렌더를 실패시킨다.
const overflowOf = () => pg.evaluate(() => {
  const paper = document.querySelector('.paper');
  if (!paper) return [];
  const pr = paper.getBoundingClientRect();
  const TOL = 2;                          // 반올림 오차
  const bad = [];
  paper.querySelectorAll('*').forEach((el) => {
    if (!el.getClientRects().length) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const over = Math.max(r.bottom - pr.bottom, r.right - pr.right);
    if (over <= TOL) return;
    if (el.querySelector('*')) return;     // 넘친 «가장 안쪽» 요소만 보고한다
    bad.push({ kind: 'over', over: Math.round(over), tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 40) });
  });

  // 넘침만 보면 놓치는 사고가 하나 더 있다: 종이 «안»에서 겹치는 것.
  // en p.04 는 표 칸 글씨가 두 줄로 늘어나 표가 커지자 노란 마무리 칩이 마지막 칸 위에 올라탔는데,
  // 종이 밖으로는 안 나가서 위 검사를 그대로 통과했다. 형광펜 칩은 늘 «단독으로» 놓이는 것이라
  // 다른 요소와 겹치면 그건 예외 없이 레이아웃 사고다. 그래서 칩만 따로 본다.
  const YELLOW = 'rgb(221, 193, 88)';
  // «내용이 있는» 것만 상대로 본다. 글자를 가진 가장 안쪽 요소와, 테두리가 그려진 상자다.
  // 자리만 밀어 주는 빈 `flex:1` 칸은 겹쳐도 눈에 보이는 사고가 아니므로 뺀다(ko p.04 오탐).
  // 반대로 표의 칸 상자는 안에 <span> 이 들어 있어 «가장 안쪽»이 아니지만, 테두리가 보이므로
  // 반드시 넣어야 한다 — 이걸 빼서 en p.04 의 실제 겹침을 놓쳤다.
  const candidates = [...paper.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    const bordered = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
    const texted = !el.querySelector('*') && (el.textContent || '').trim().length > 0;
    return bordered || texted;
  });
  paper.querySelectorAll('*').forEach((chip) => {
    if (getComputedStyle(chip).backgroundColor !== YELLOW) return;
    const cr = chip.getBoundingClientRect();
    candidates.forEach((el) => {
      if (chip.contains(el) || el.contains(chip)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dx = Math.min(cr.right, r.right) - Math.max(cr.left, r.left);
      const dy = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
      if (dx > 4 && dy > 4) {
        bad.push({ kind: 'hit', over: Math.round(dy), tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 40),
          chip: (chip.textContent || '').trim().slice(0, 30) });
      }
    });
  });
  return bad;
});

let clipped = 0;
for (let i = 0; i < htmls.length; i++) {
  await pg.setContent(htmls[i], { waitUntil: 'networkidle' });
  for (const b of await overflowOf()) {
    clipped++;
    console.error(b.kind === 'hit'
      ? `❌ 카드 ${i + 1}: 형광펜 «${b.chip}» 이 ${b.over}px 겹침 — <${b.tag}> "${b.text}"`
      : `❌ 카드 ${i + 1}: 종이 밖으로 ${b.over}px 넘침 — <${b.tag}> "${b.text}"`);
  }
  const file = path.join(outDir, `card${i + 1}.png`);
  await pg.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
if (clipped) {
  console.error(`\n❌ ${lang.toUpperCase()}: ${clipped}곳이 종이 밖으로 넘쳤다. PNG 는 남겨 두었으니 열어서 확인하고`
    + ` 본문·제목을 줄이거나 그림 높이를 고친 뒤 다시 렌더한다. 이 상태로 발행하지 않는다.`);
  process.exit(1);
}
console.log(`\n✅ ${lang.toUpperCase()} ${htmls.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
console.log('※ 넘침은 자동으로 검사했다. 그래도 각 카드를 열어 «그림이 본문과 맞는지»는 눈으로 확인하세요 (절차서 5단계).');
