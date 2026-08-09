// render-cards-sun.mjs
// 일요일(다음 주 일정) 전용 렌더러. content/<date>-sun.json 을 읽어 1080x1350 PNG 10장을 만든다.
//
// 이 파일은 직접 호출하지 않는다 — render-cards.mjs 가 session === 'sun' 일 때 위임한다.
//   node scripts/render-cards.mjs 2026-08-09 ko sun
//
// ── 왜 평일 렌더러에서 갈라져 나왔나
// 2026-08-08 에 토요일이 먼저 갈라졌다(고정 10장·밝은 바탕). 일요일도 성격이 평일과 다르다 —
// 평일 am·pm 은 «오늘 무슨 일이 있었나»라 sections 배열을 그대로 카드로 펴면 되지만,
// 일요일은 «다음 주 무엇을 봐야 하나»라 요일 그리드·컨센서스처럼 미리 정해진 칸이 필요하다.
// 세 회차를 한 파일에 두면 규칙이 서로를 갉아먹으므로 고정 편성인 쪽을 따로 뺐다.
//
// ── 토요일과의 관계
// 바탕(종이색)과 부품(봉차트·스파크라인·알약칩·로고배지)은 토요일과 같은 «주말 가족»이고,
// 강조색만 다르다: 토요일 딥그린 #2f5d50 ↔ 일요일 딥인디고 #4b4180.
// 부품은 지금 «복제»해 둔다. 공용 lib 로 뽑는 것이 깔끔하지만, 토요일 새 포맷의 첫 무인 실행이
// 2026-08-15 라 그 전에 공용 코드를 건드리면 토요일까지 같이 위험해진다. 양쪽이 한 번씩
// 실전을 통과한 뒤 «동작 변화 없음»만 확인하는 별도 커밋에서 합친다.
//
// ── 시각 언어: 화살표(→)
// 일요일 카드는 «무엇에서 무엇으로 갈 것인가»를 반복해 보여준다.
//   ③ 경제 지표  직전치 → 컨센서스
//   ④ 실적       전년 동기 EPS → 컨센서스
// 토요일 ⑤가 «예상 → 실제»로 결과를 보여준 것과 정확히 대칭이다.
// 색은 좋고 나쁨이 아니라 «방향»만 뜻한다 (토요일 ⑤와 같은 규칙).
//
// ── 색 규칙: 한국 관행대로 상승 빨강 / 하락 파랑. 미국 종목도 같은 규칙을 쓴다.
//
// 스키마는 FORMAT_BRIEFING.md 의 «일요일(sun) 카드» 절 참고.
// 견본: content/example-sun.json (node scripts/render-cards.mjs example ko sun)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', `${date}-sun.json`), 'utf8'));

// 스키마를 여기서 막는다. 2026-08-09 개편 전 sun 콘텐츠에는 cover 가 없어 그대로 태우면
// cardCover() 가 undefined 를 읽고 죽는데, 그 죽는 자리가 «어디가 잘못됐는지»를 말해주지 않는다.
if (!data.cover) {
  console.error(`\n❌ cover 가 없습니다: content/${date}-sun.json`);
  console.error(`   일요일 콘텐츠는 표지 필드가 필요합니다 (FORMAT_BRIEFING.md §2-B, 견본 content/example-sun.json).`);
  console.error(`   2026-08-09 이전 콘텐츠를 그때 모습대로 다시 그리려면 그 시점 렌더러를 꺼내 씁니다:`);
  console.error(`     git checkout <그 시점 커밋> -- scripts/render-cards.mjs`);
  process.exit(1);
}

const outDir = path.join(root, 'cards', date, 'sun', lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);

// 로고 캐시(logos-cache 워크플로가 커밋해 둔 base64 사전). 없어도 렌더는 된다 —
// 그 종목은 모노그램으로 나간다. badge() 가 항상 모노그램 대체 경로를 갖는다.
const LOGO_FILE = path.join(root, 'data', 'logos.json');
const LOGOS = fs.existsSync(LOGO_FILE)
  ? (JSON.parse(fs.readFileSync(LOGO_FILE, 'utf8')).logos || {})
  : {};

/* ───────── 팔레트 ───────── */
// paper·card·line·ink·mute 는 토요일과 같다(주말은 한 가족으로 읽혀야 한다).
// accent 만 딥인디고 — 일요일 밤 발행이라는 성격에 맞고, 상승 빨강·하락 파랑과도
// 토요일 딥그린과도 겹치지 않는다.
const P = {
  paper: '#f2efe6', card: '#fffdf8', line: '#ddd6c6', ink: '#1f1d19', mute: '#6f685b',
  accent: '#4b4180', up: '#c2382e', dn: '#26618c',
};
const HI = '#b8860b';                       // '주목' — 평일 카드의 주목 배지와 같은 계열
const UPDN = v => (v > 0 ? P.up : v < 0 ? P.dn : P.mute);
const fmt = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = v => `${v > 0 ? '▲' : v < 0 ? '▼' : ''}${Math.abs(v).toFixed(2)}%`;

/* ───────── 공통 스타일 ───────── */
const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px}
body{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans KR","Noto Color Emoji",sans-serif;
 background:${P.paper};color:${P.ink};width:1080px;height:1350px;display:flex;flex-direction:column;
 position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
.pad{padding:62px 58px 96px;flex:1;display:flex;flex-direction:column}
.bar{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:30px}
.bd{font-size:27px;font-weight:800;letter-spacing:-.01em}
.bd i{font-style:normal;color:${P.accent}}
.dt{font-size:22px;color:${P.mute};font-weight:700}
.ttl{font-size:46px;font-weight:800;letter-spacing:-.025em;margin-bottom:26px;display:flex;align-items:center;gap:16px}
.ttl s{width:16px;height:16px;border-radius:50%;background:${P.accent};display:inline-block;text-decoration:none;flex:none}
.ttl u{font-size:23px;font-weight:700;color:${P.mute};letter-spacing:0;text-decoration:none}
.foot{position:absolute;left:58px;bottom:46px;font-size:20px;color:${P.mute}}
.pg{position:absolute;right:58px;bottom:46px;font-size:21px;color:${P.mute};font-weight:800}
.blk{background:${P.card};border:1px solid ${P.line};border-radius:22px}
.num{font-variant-numeric:tabular-nums}
.note{font-size:20px;color:${P.mute};margin-top:14px;line-height:1.45}
`;

// 브랜드의 "luckyon 브리핑" 은 영어 카드에서도 한글 그대로 둔다 (다른 렌더러와 같은 규칙).
const page = (inner, i, n) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
<body>${inner}<div class="foot">luckyon 브리핑</div><div class="pg">${i} / ${n}</div></body></html>`;
const bar = () => `<div class="bar"><div class="bd">luckyon <i>${t('브리핑', 'Briefing')}</i></div>
  <div class="dt">${t(data.dateLabel_ko, data.dateLabel_en)}</div></div>`;
const title = (main, sub) => `<div class="ttl"><s></s>${main}${sub ? `<u>${sub}</u>` : ''}</div>`;
const note = s => (s ? `<div class="note">${s}</div>` : '');

const dashHead = cells => `<div style="display:flex;align-items:center;gap:20px;padding:0 26px 10px;
  font-size:17px;font-weight:800;color:${P.mute};letter-spacing:.1em">
  ${cells.map(([txt, st]) => `<div style="${st}">${txt}</div>`).join('')}</div>`;
const chip = (txt, col, fs = 22) => `<span class="num" style="background:${col}18;color:${col};
  padding:5px 13px;border-radius:999px;font-size:${fs}px;font-weight:800;white-space:nowrap">${txt}</span>`;
const numBadge = i => `<div style="width:38px;height:38px;border-radius:11px;background:${P.accent};color:#fff;
  display:grid;place-items:center;font-size:20px;font-weight:800;flex:none">${i}</div>`;

// 스파크라인. SVG 를 absolute 로 박아 둔다 — height:100% 만 주면 flex 아이템이
// viewBox 비율만큼 부풀어 카드가 푸터 밖으로 밀려난다(토요일에서 실제로 터진 적이 있다).
function spark(seq, col, w = 190, h = 80) {
  const lo = Math.min(...seq), hi = Math.max(...seq), sp = (hi - lo) || 1;
  const pts = seq.map((v, i) => `${(i / (seq.length - 1) * w).toFixed(1)},${(h - (v - lo) / sp * (h - 10) - 5).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
    style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <polyline points="${pts.join(' ')} ${w},${h} 0,${h}" fill="${col}" fill-opacity="0.07" stroke="none"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.6"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${lx}" cy="${ly}" r="4.2" fill="${col}"/></svg>`;
}

// 배지: 캐시에 로고가 있으면 로고, 없으면 모노그램. 한국 종목은 로고 캐시가 없어
// 항상 모노그램으로 나간다(CDN 이 미국 티커만 준다). mono_* 는 로고를 쓸 때도 반드시 채워 둔다.
// 로고 배지는 흰 바탕에 둔다 — 브랜드색 위에 얹으면 로고 자체 색과 부딪힌다.
function badge(s, size = 54) {
  const L = s.logo && LOGOS[s.logo];
  if (L) {
    return `<div style="width:${size}px;height:${size}px;border-radius:15px;background:#fff;border:1px solid ${P.line};
      display:grid;place-items:center;flex:none;overflow:hidden;padding:7px">
      <img src="${L.dataUri}" alt="" style="width:100%;height:100%;object-fit:contain;display:block"></div>`;
  }
  const mono = t(s.mono_ko, s.mono_en) || '';
  return `<div style="width:${size}px;height:${size}px;border-radius:15px;background:${s.color || P.accent};color:#fff;
    display:grid;place-items:center;font-size:${mono.length > 2 ? 17 : 21}px;font-weight:800;flex:none;letter-spacing:-.02em">${mono}</div>`;
}

// 화살표 쌍 — 일요일의 시각 언어. 왼쪽은 이미 확정된 과거값(직전치·전년 동기),
// 오른쪽은 시장 컨센서스. 색은 «방향»만 뜻하며 좋고 나쁨이 아니다.
function arrowPair(prev, est, dir, big = false) {
  const col = dir > 0 ? P.up : dir < 0 ? P.dn : '#8d8677';
  const fsL = big ? 22 : 19, fsR = big ? 24 : 20;
  return `<div style="display:flex;align-items:center;gap:8px;min-width:0">
    <div class="num" style="flex:1;min-width:0;text-align:center;font-size:${fsL}px;color:${P.mute};font-weight:700;
         background:${P.paper};border-radius:8px;padding:5px 4px;white-space:nowrap;overflow:hidden">${prev ?? '—'}</div>
    <div style="flex:none;font-size:16px;font-weight:800;color:${col}">→</div>
    <div class="num" style="flex:1;min-width:0;text-align:center;font-size:${fsR}px;font-weight:800;color:#fff;
         background:${col};border-radius:8px;padding:5px 4px;white-space:nowrap;overflow:hidden">${est ?? '—'}</div>
  </div>`;
}

/* ═════════ ① 표지 ═════════ */
function cardCover() {
  const c = data.cover;
  return `<div class="pad">
  ${bar()}
  <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:10px;background:${P.accent};color:#fff;
       border-radius:999px;padding:9px 20px;font-size:21px;font-weight:800;letter-spacing:.06em;margin-bottom:22px">
    ${t(data.weekLabel_ko, data.weekLabel_en)}</div>
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:20px">
    <div style="flex:none;font-size:48px;font-weight:800;line-height:1.24;letter-spacing:-.035em">${t(c.headline_ko, c.headline_en)}</div>
    <div class="blk" style="flex:1;min-height:0;padding:34px 36px 30px;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="font-size:27px;font-weight:800;color:${P.mute}">${t(c.hero.label_ko, c.hero.label_en)}</div>
        <div class="num" style="font-size:176px;font-weight:800;letter-spacing:-.055em;line-height:1.04;color:${P.accent}">${c.hero.value}</div>
        <div style="font-size:28px;color:${P.mute};margin-top:6px">${t(c.hero.sub_ko, c.hero.sub_en)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${(c.points || []).map(p => `<div style="display:flex;gap:16px;align-items:baseline">
          <div style="width:9px;height:9px;border-radius:50%;background:${P.accent};flex:none;transform:translateY(-4px)"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:25px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px">${t(p.title_ko, p.title_en)}</div>
            <div style="font-size:22px;color:#4a453c;line-height:1.42">${t(p.body_ko, p.body_en)}</div>
          </div></div>`).join('')}
      </div>
      <div>
        <div style="height:1px;background:${P.line};margin-bottom:24px"></div>
        <div style="font-size:21px;font-weight:800;color:${P.mute};letter-spacing:.08em;margin-bottom:16px">${t(c.tiles_title_ko, c.tiles_title_en)}</div>
        <div style="display:flex;gap:13px">
          ${(c.tiles || []).map(x => `<div style="flex:1;background:${P.paper};border-radius:16px;padding:18px 20px">
            <div style="font-size:20px;color:${P.mute};font-weight:700">${t(x.label_ko, x.label_en)}</div>
            <div class="num" style="font-size:37px;font-weight:800;color:${UPDN(x.value)};margin-top:4px">${x.value > 0 ? '+' : '−'}${Math.abs(x.value).toFixed(2)}%</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div></div>`;
}

/* ═════════ ② 다음 주 캘린더 — 일요일의 간판 카드 ═════════ */
// 토요일 ⑤가 «지난 한 주에 무엇이 나왔나»를 요일 그리드로 보여준 것의 앞면이다.
// 여기서는 예상/실제가 아직 없으므로 타일에 «시각 + 이벤트»만 담고,
// 색은 등락 방향이 아니라 **중요도**를 뜻한다 (high = 주목).
function cardWeek() {
  const w = data.week;
  return `<div class="pad">
  ${bar()}${title(t('다음 주 캘린더', 'The week ahead'), t('모든 시각 KST', 'All times KST'))}
  <div style="flex:1;min-height:0;display:flex;align-items:center">
  <div style="width:100%;display:grid;grid-template-columns:repeat(${w.days.length},1fr);gap:9px;align-items:start">
    ${w.days.map(d => `<div style="display:flex;flex-direction:column;gap:8px;min-width:0;justify-content:flex-start">
      <div style="background:${P.ink};color:${P.paper};border-radius:12px;padding:9px 6px;text-align:center;font-size:20px;font-weight:800;flex:none">${t(d.day_ko, d.day_en)}</div>
      ${(d.rows || []).map(r => {
        const hi = r.importance === 'high';
        // 타일은 남는 세로를 나눠 갖되 상한(200px)을 둔다. 상한이 없으면 하루 2건뿐인 열에서
        // 타일 하나가 350px 까지 부풀어 텅 비어 보이고, 상한만 있고 늘어나지 않으면
        // 반대로 카드 아래가 통째로 빈다. 요일당 2~4건이면 이 범위에서 자연스럽게 채워진다.
        return `<div class="blk" style="padding:18px 15px;min-width:0;flex:none;
             display:flex;flex-direction:column;gap:7px;
             ${hi ? `border-color:${HI};background:${HI}0f` : ''}">
          <div class="num" style="font-size:18px;font-weight:800;color:${hi ? HI : P.mute}">${r.time}</div>
          <div style="font-size:20px;font-weight:800;line-height:1.28;letter-spacing:-.02em">${t(r.name_ko, r.name_en)}</div>
          ${r.tag_ko || r.tag_en ? `<div style="font-size:16px;color:${P.mute};line-height:1.32">${t(r.tag_ko, r.tag_en)}</div>` : ''}
        </div>`; }).join('')}
      ${!(d.rows || []).length ? `<div class="blk" style="flex:none;padding:22px 10px;text-align:center;background:${P.paper};border-style:dashed">
        <div style="font-size:16px;color:${P.mute}">${t('예정 없음', 'Nothing set')}</div></div>` : ''}
    </div>`).join('')}
  </div></div>
  <div style="font-size:19px;color:${P.mute};margin-top:13px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <span style="display:flex;align-items:center;gap:7px"><i style="width:15px;height:15px;border-radius:4px;background:${HI}33;border:1px solid ${HI};display:inline-block"></i>${t('주목', 'Watch')}</span>
    <span>${t(w.note_ko, w.note_en) || ''}</span>
  </div></div>`;
}

/* ═════════ ③ 미국·글로벌 경제 지표 — 직전치 → 컨센서스 ═════════ */
function cardEcon() {
  const e = data.econ;
  return `<div class="pad">
  ${bar()}${title(t(e.title_ko, e.title_en), t(e.sub_ko, e.sub_en))}
  ${dashHead([[t('지표', 'RELEASE'), 'flex:1'], [t('직전치 → 컨센서스', 'PRIOR → CONSENSUS'), 'width:330px;text-align:center']])}
  <div style="display:flex;flex-direction:column;gap:12px;flex:1">
    ${e.rows.map(r => `<div class="blk" style="flex:1;min-height:0;padding:20px 26px;display:flex;align-items:center;gap:22px">
      <div style="flex:1;min-width:0">
        <div style="font-size:27px;font-weight:800;letter-spacing:-.02em;line-height:1.25">${t(r.name_ko, r.name_en)}</div>
        <div class="num" style="font-size:19px;color:${P.mute};margin-top:4px">${r.when}</div>
      </div>
      <div style="width:330px;flex:none">${arrowPair(r.prev, r.est, r.dir, true)}</div>
    </div>`).join('')}
  </div>
  <div style="font-size:19px;color:${P.mute};margin-top:13px">
    ${t('※ 색은 컨센서스가 직전치보다 높은지(빨강)·낮은지(파랑)만 뜻하며 좋고 나쁨이 아닙니다',
        '※ Colour shows only whether consensus sits above (red) or below (blue) the prior reading — not good or bad')}
    ${t(e.note_ko, e.note_en) ? ' · ' + t(e.note_ko, e.note_en) : ''}
  </div></div>`;
}

/* ═════════ ④ 미국 대형주 실적 — 전년 동기 EPS → 컨센서스 ═════════ */
function cardEarnings() {
  const e = data.earnings;
  return `<div class="pad">
  ${bar()}${title(t(e.title_ko, e.title_en), t(e.sub_ko, e.sub_en))}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;flex:1;align-content:space-evenly">
    ${e.items.map(s => `<div class="blk" style="padding:24px 22px;display:flex;flex-direction:column;justify-content:center;gap:15px;min-width:0">
      <div style="display:flex;align-items:center;gap:14px;min-width:0">
        ${badge(s, 48)}
        <div style="flex:1;min-width:0">
          <div style="font-size:25px;font-weight:800;letter-spacing:-.03em;line-height:1.2">${t(s.name_ko, s.name_en)}</div>
          <div class="num" style="font-size:18px;color:${P.mute};margin-top:3px">${s.when} · ${t(s.slot_ko, s.slot_en)}</div>
        </div>
      </div>
      ${arrowPair(s.epsPrev, s.eps, s.dir)}
    </div>`).join('')}
  </div>
  <div style="font-size:19px;color:${P.mute};margin-top:13px">
    ${t('※ 주당순이익(EPS) 전년 동기 실적 → 이번 분기 컨센서스', '※ EPS: year-ago actual → consensus for this quarter')}
    ${t(e.note_ko, e.note_en) ? ' · ' + t(e.note_ko, e.note_en) : ''}
  </div></div>`;
}

/* ═════════ ⑤⑥⑧⑨ 글 카드 (한국 · 주말 소식 · AI · 놓치면 안 될 것) ═════════ */
// 반도체에는 쓸 만한 이모지가 없다(💾·🖥 는 칩이 아니다). icon:"chip" 이면 이 SVG 를 쓴다.
const CHIP_SVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${P.accent}" stroke-width="1.7"
  stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="1.6"/>
  <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/></svg>`;
const mark = n => (n.icon === 'chip'
  ? `<div style="width:38px;height:38px;border-radius:11px;background:${P.accent}1a;display:grid;place-items:center">${CHIP_SVG}</div>`
  : n.emoji);
const newsBlock = (i, n) => `<div class="blk" style="padding:22px 26px;flex:1;min-height:0;display:flex;gap:16px;align-items:center">
  ${numBadge(i)}
  <div style="flex:1;min-width:0">
    <div style="display:flex;gap:11px;align-items:center;margin-bottom:8px">
      <div style="font-size:28px;line-height:1.15;flex:none">${mark(n)}</div>
      <div style="flex:1;min-width:0;font-size:29px;font-weight:800;line-height:1.26;letter-spacing:-.03em">${t(n.headline_ko, n.headline_en)}</div>
    </div>
    <div style="font-size:22px;line-height:1.5;color:#4a453c">${t(n.body_ko, n.body_en)}</div>
    <div style="font-size:18px;color:${P.mute};margin-top:9px">${n.src}</div>
  </div></div>`;

const cardNews = key => () => {
  const s = data[key];
  return `<div class="pad">
  ${bar()}${title(t(s.title_ko, s.title_en), t(s.sub_ko, s.sub_en))}
  <div style="display:flex;flex-direction:column;gap:14px;flex:1">
    ${s.items.map((n, i) => newsBlock(i + 1, n)).join('')}
  </div>
  ${note(t(s.note_ko, s.note_en))}</div>`;
};

/* ═════════ ⑦ 출발선 — 금요일 마감 스냅샷 ═════════ */
// 회고는 이 한 장으로 끝낸다. 지난주 지수·섹터 상세는 토요일 회차가 통째로 다루므로,
// 여기서 되풀이하면 하루 만에 같은 내용이 다시 나간다.
function cardStart() {
  const s = data.start;
  return `<div class="pad">
  ${bar()}${title(t('다음 주 출발선', 'Where next week starts'), t('금요일 마감 기준', 'At Friday\'s close'))}
  <div style="display:flex;flex-direction:column;gap:12px;flex:none;margin-bottom:16px">
    ${s.indexes.map(x => `<div class="blk" style="padding:18px 26px;display:flex;align-items:center;gap:20px">
      <div style="flex:1;min-width:0;font-size:27px;font-weight:800;letter-spacing:-.02em">${t(x.name_ko, x.name_en)}</div>
      <div style="flex:none">${chip(pct(x.wk), UPDN(x.wk), 22)}</div>
      <div class="num" style="width:190px;flex:none;text-align:right;font-size:33px;font-weight:800;letter-spacing:-.03em">${fmt(x.close)}</div>
    </div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;align-content:space-evenly">
    ${s.metrics.map(m => `<div class="blk" style="padding:22px 22px;display:flex;flex-direction:column;justify-content:center;gap:8px">
      <div style="display:flex;align-items:center;gap:9px;font-size:19px;color:${P.mute};font-weight:700">
        <span style="font-size:23px;line-height:1">${m.emoji}</span>${t(m.name_ko, m.name_en)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div class="num" style="font-size:32px;font-weight:800;letter-spacing:-.03em">${m.value}</div>
        ${chip(m.delta, UPDN(m.dir), 19)}
      </div></div>`).join('')}
  </div>
  ${note(t(s.note_ko, s.note_en))}</div>`;
}

/* ═════════ ⑩ 아웃트로 ═════════ */
function cardOutro() {
  const o = data.outro;
  return `<div class="pad" style="justify-content:center;align-items:center;text-align:center">
  <div class="bd" style="font-size:36px;margin-bottom:44px">luckyon <i>${t('브리핑', 'Briefing')}</i></div>
  <div style="font-size:52px;font-weight:800;line-height:1.32;letter-spacing:-.03em">${t(o.tagline_ko, o.tagline_en)}</div>
  <div style="font-size:29px;font-weight:800;color:${P.accent};margin-top:40px">${t(o.next_ko, o.next_en)}</div>
  <div style="font-size:30px;color:#4a453c;margin-top:46px;line-height:1.5">
    ${t('팔로우하고 놓치지 마세요', 'Follow so you never miss it')}<br>
    🔖 ${t('저장', 'Save')} · 📤 ${t('공유', 'Share')} · 💬 ${t('댓글', 'Comment')}</div>
  <div style="font-size:26px;color:${P.mute};margin-top:52px">@luckyon_77</div>
  <div style="font-size:20px;color:#8d8677;margin-top:18px">${t('정보 제공 목적 · 투자 조언 아님', 'For information only · not investment advice')}</div></div>`;
}

/* ───────── 렌더 ───────── */
// 고정 10장. 인스타 캐러셀 상한이 10장이라 여기서 더 늘릴 수 없다.
// 이 순서는 scripts/lib/alt-text.mjs 의 sunAltTexts() 와 반드시 같아야 한다 —
// 어긋나면 대체텍스트가 엉뚱한 슬라이드에 붙는다.
// 순서는 «먼저 주말 사이 있었던 일부터, 그럼 다음 주는» 이라는 시간 흐름을 따른다.
// ⑨ 출발선만 예외로 뒤에 둔다 — 뉴스가 아니라 «금요일 종가»라는 기준값이라
// 시간 순서의 일부로 읽히지 않고, 마지막에 참조로 붙는 편이 자연스럽다.
const inners = [
  cardCover(),            // ①
  cardNews('weekend')(),  // ② 주말 사이 있었던 일
  cardWeek(),             // ③ ─── 여기서부터 다음 주
  cardEcon(),             // ④
  cardEarnings(),         // ⑤
  cardNews('korea')(),    // ⑥
  cardNews('ai')(),       // ⑦
  cardNews('watch')(),    // ⑧
  cardStart(),            // ⑨ 참조 — 어디서 출발하나
  cardOutro(),            // ⑩
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pageObj = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
for (let i = 0; i < inners.length; i++) {
  await pageObj.setContent(page(inners[i], i + 1, inners.length), { waitUntil: 'networkidle' });
  const file = path.join(outDir, `card${i + 1}.png`);
  await pageObj.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('wrote', path.relative(root, file));
}
await browser.close();
console.log(`\n✅ ${lang.toUpperCase()} SUN ${inners.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
