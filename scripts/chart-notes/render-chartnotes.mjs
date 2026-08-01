// render-chartnotes.mjs
// content/chart-notes/<stamp>.json 의 cards 배열을 읽어 "주식 차트 3분 노트" 카드 PNG(1080x1350)를 만든다.
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

const stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/chart-notes/render-chartnotes.mjs <stamp> <lang:ko|en>');
  process.exit(1);
}
if (!['ko', 'en'].includes(lang)) { console.error(`lang 은 ko|en 중 하나여야 합니다: ${lang}`); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
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
const SERIES = lang === 'ko' ? (data.series || '주식 차트 3분 노트') : (data.series_en || '3-Min Stock Chart Notes');
const FOOTER = lang === 'ko' ? '매일 3분씩 배우는 주식 차트' : '3 minutes a day, one chart at a time';
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
  ${spiral()}<div class="foot">${esc(FOOTER)}</div></body></html>`;
}

// ---------- 카드 타입별 마크업 ----------
const R = {
  // 표지: 캔들 두 개 + 큰 제목 + 밑줄 + 부제 + CTA + 바이라인
  cover(c) {
    return `<div class="pad">
      <svg width="956" height="300" viewBox="0 0 956 300" style="margin-top:8px">
        ${candleSVG({ x: 190, w: 104, open: 190, close: 78, high: 30, low: 250, color: C.red, id: 'a' })}
        ${candleSVG({ x: 420, w: 104, open: 190, close: 78, high: 30, low: 250, color: C.green, id: 'b' })}
        <path d="M 600 128 L 545 136" stroke="${C.red}" stroke-width="3" fill="none"/>
        ${String(t(c, 'annot')).split('|').map((ln, i) =>
      `<text x="606" y="${118 + i * 34}" font-family="${FONT_SANS}" font-size="26" fill="${C.red}">${esc(ln.trim())}</text>`).join('')}
      </svg>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div class="ttl" style="font-size:70px">${t(c, 'title')}</div>
        <svg width="480" height="26" style="margin-top:10px">
          <path d="M 4 10 Q 120 2, 240 11 T 476 8" stroke="${C.red}" stroke-width="4" fill="none"/>
          <path d="M 4 19 Q 140 11, 260 20 T 470 16" stroke="${C.red}" stroke-width="3" fill="none" opacity="0.75"/>
        </svg>
        <div style="font-family:${FONT_TITLE};font-size:34px;font-weight:700;color:${C.navy};margin-top:26px">${esc(t(c, 'sub'))}</div>
        <div style="margin-top:30px"><span class="chip">${esc(t(c, 'cta'))} ▶</span></div>
      </div>
      <div style="text-align:right;font-family:${FONT_MONO};font-size:26px;color:${C.muted}">${esc(data.byline || 'by luckyon')}</div>
    </div>`;
  },

  // 도입: 큰 제목 + 짧은 밑줄 + 본문 + 스케치 꺾은선 + 캡션
  intro(c) {
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      <svg width="160" height="14" style="margin-top:12px"><path d="M 2 7 Q 60 1, 156 8" stroke="${C.red}" stroke-width="5" fill="none"/></svg>
      <div class="body" style="margin-top:28px">${t(c, 'body')}</div>
      <div style="flex:1;display:flex;align-items:center">
        <svg width="900" height="260" viewBox="0 0 900 260">
          <polyline points="20,220 130,120 200,170 330,70 430,30 620,30 760,150 830,215"
                    stroke="#7d7a72" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          <text x="812" y="90"  font-size="62" font-weight="800" fill="${C.red}">?</text>
          <text x="866" y="132" font-size="42" font-weight="800" fill="${C.red}">?</text>
          <text x="820" y="168" font-size="34" font-weight="800" fill="${C.red}">?</text>
        </svg>
      </div>
      <div style="font-family:${FONT_TITLE};font-size:27px;font-weight:700;color:${C.navy};margin-bottom:18px">${esc(t(c, 'caption'))}</div>
    </div>`;
  },

  // 체크리스트: 제목 + 본문 + 용어 4개 (체크박스 + 형광펜 칩 + 점선 + 설명)
  checklist(c) {
    const rows = (c.items || []).map(it => `
      <div style="display:flex;align-items:center;gap:22px;margin-bottom:${(c.items.length > 3) ? 26 : 34}px">
        <div class="cb"></div>
        <span style="background:${C.yellow};padding:6px 16px;font-family:${FONT_TITLE};font-size:32px;font-weight:800;color:${it.color || C.ink};white-space:nowrap">${esc(t(it, 'term'))}</span>
        <span class="dash"></span>
        <span style="font-size:29px;color:${C.body};white-space:nowrap">${esc(t(it, 'desc'))}</span>
      </div>`).join('');
    return `<div class="pad">
      <div class="ttl">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin-top:38px">${rows}</div>
      <div style="flex:1"></div>
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
    const v = c.values || {};
    const rowsY = { high: 118, close: 205, open: 452, low: 512 };
    const call = (key, label, val) => `
      <circle cx="356" cy="${rowsY[key]}" r="9" fill="${C.red}"/>
      <path d="M 366 ${rowsY[key]} Q 430 ${rowsY[key] - 8}, 500 ${rowsY[key]}" stroke="#9a968c" stroke-width="3" fill="none"/>
      <text x="520" y="${rowsY[key] + 11}" font-family="${FONT_TITLE}" font-size="33" font-weight="700" fill="${C.navy}">${esc(label)}</text>
      <text x="940" y="${rowsY[key] + 11}" font-family="${FONT_TITLE}" font-size="35" font-weight="800" fill="${C.ink}" text-anchor="end">${esc(val)}</text>`;
    const up = c.direction !== 'down';
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

// ---------- 렌더 ----------
const htmls = data.cards.map((c, i) => {
  const fn = R[c.type];
  if (!fn) { console.error(`❌ 카드 ${i + 1}: 알 수 없는 type "${c.type}". 가능한 값: ${Object.keys(R).join(', ')}`); process.exit(1); }
  return page(fn(c), i + 1);
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (let i = 0; i < htmls.length; i++) {
  await pg.setContent(htmls[i], { waitUntil: 'networkidle' });
  const file = path.join(outDir, `card${i + 1}.png`);
  await pg.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
console.log(`\n✅ ${lang.toUpperCase()} ${htmls.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
console.log('※ 렌더 후 반드시 각 카드를 열어 텍스트가 넘치거나 겹치지 않는지 확인하세요 (절차서 5단계).');
