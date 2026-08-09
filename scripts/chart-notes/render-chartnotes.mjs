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
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div class="ttl" style="font-size:70px">${markLastLine(t(c, 'title'))}</div>
        <svg data-fit=".ttl-last" width="480" height="26" viewBox="0 0 480 26"
             preserveAspectRatio="none" style="margin-top:10px">
          <path d="M 4 10 Q 120 2, 240 11 T 476 8" stroke="${C.red}" stroke-width="4" fill="none" vector-effect="non-scaling-stroke"/>
          <path d="M 4 19 Q 140 11, 260 20 T 470 16" stroke="${C.red}" stroke-width="3" fill="none" opacity="0.75" vector-effect="non-scaling-stroke"/>
        </svg>
        <div style="font-family:${FONT_TITLE};font-size:34px;font-weight:700;color:${C.navy};margin-top:26px">${esc(t(c, 'sub'))}</div>
        <div style="margin-top:30px"><span class="chip">${esc(t(c, 'cta'))} ▶</span></div>
      </div>
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
    const W = 900, H = 470, P = 30;
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
      <text x="${px(MARKER.x)}" y="${py(MARKER.y) - 32}" text-anchor="middle" font-family="${FONT_TITLE}"
            font-size="28" font-weight="800" fill="${C.red}"
            stroke="${C.paper}" stroke-width="8" paint-order="stroke">${esc(t(MARKER, 'label'))}</text>` : '';
    const legend = SERIES.filter(s => t(s, 'label')).map(s => `
      <span style="display:inline-flex;align-items:center;gap:12px;margin-right:34px">
        <span style="width:38px;height:7px;background:${s.color || C.navy};border-radius:4px"></span>
        <span style="font-family:${FONT_TITLE};font-size:26px;font-weight:700;color:${C.body}">${esc(t(s, 'label'))}</span>
      </span>`).join('');
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="flex:1;display:flex;align-items:center">
        <svg width="900" height="${H}" viewBox="0 0 ${W} ${H}">
          <line x1="${px(0)}" y1="${py(0)}" x2="${px(100)}" y2="${py(0)}" stroke="#c9c6bc" stroke-width="3"/>
          ${band}${levels}${series}${mk}
        </svg>
      </div>
      ${legend ? `<div style="margin-bottom:14px">${legend}</div>` : ''}
      ${t(c, 'closing') ? `<div style="margin-bottom:20px"><span style="background:${C.yellow};padding:9px 18px;font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</span></div>` : ''}
    </div>`;
  },

  // 막대 비교: 거래량·시가총액·PER 등 "숫자 몇 개를 나란히" 보여줄 때
  bars(c) {
    const ITEMS = d(c, 'items', []);
    const max = Math.max(...ITEMS.map(i => Math.abs(i.value) || 0), 1);
    const rows = ITEMS.map(it => {
      const w = Math.max((Math.abs(it.value) / max) * 100, 3);
      const hi = it.highlight;
      return `<div style="margin-bottom:26px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px">
          <span style="font-family:${FONT_TITLE};font-size:29px;font-weight:${hi ? 800 : 700};color:${hi ? C.red : C.ink}">${esc(t(it, 'label'))}</span>
          <span style="font-family:${FONT_TITLE};font-size:31px;font-weight:800;color:${hi ? C.red : C.ink}">${esc(it.display ?? it.value)}</span>
        </div>
        <div style="height:34px;background:#eceade;border-radius:6px;overflow:hidden">
          <div style="width:${w}%;height:100%;background:${it.color || (hi ? C.red : C.navy)};opacity:${hi ? 1 : 0.72}"></div>
        </div>
      </div>`;
    }).join('');
    return `<div class="pad">
      <div class="ttl sm">${t(c, 'title')}</div>
      ${t(c, 'body') ? `<div class="body">${t(c, 'body')}</div>` : ''}
      <div style="margin-top:34px">${rows}</div>
      <div style="flex:1"></div>
      ${t(c, 'closing') ? `<div class="box" style="margin-bottom:22px"><div style="font-family:${FONT_TITLE};font-size:29px;font-weight:800;color:${C.ink}">${esc(t(c, 'closing'))}</div></div>` : ''}
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
