// render-cards-day.mjs
// 평일 브리핑(am·pm) 카드 10장. 2026-08-22 에 사용자와 확정한 디자인이다.
// `render-cards.mjs <date> <lang> am|pm` 이 이 파일로 위임한다 (주말과 같은 패턴).
//
// 이 디자인이 이전과 다른 점
//   · 카드마다 **그 내용으로 만든 사진**이 배경에 깔린다 (scripts/gen-card-photos.mjs).
//   · 수치를 문장이 아니라 **선 차트·발산 막대·순위 막대·비율 띠**로 보여준다.
//   · 본문이 5장에서 8장으로 늘어 총 10장이다 (인스타 캐러셀 상한).
//
// 장 구성 (고정)
//   1 표지 · 2 시장 한눈에 · 3 지수 기록 · 4 섹터별 등락 · 5 거래대금 상위
//   6 실적·지표 발표 · 7 AI·반도체 · 8 주요 소식 · 9 일정 · 10 아웃트로

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  W, H, M, PAL, FONT_CSS, esc, dirColor, pctColor, fmtPct,
  photoLayer, proLine, proBars, hbarRank, breadthRow, flowRows, timeline, ICONS,
} from './lib/cardkit.mjs';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const session = process.argv[4];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const C = JSON.parse(fs.readFileSync(path.join(root, 'content', `${date}-${session}.json`), 'utf8'));
const outDir = path.join(root, 'cards', date, session, lang);
fs.mkdirSync(outDir, { recursive: true });

const t = (ko, en) => (lang === 'ko' ? ko : en);
// 언어무관(invariant) 필드 자리에 {ko,en} 객체를 넣으면 번역, 문자열이면 그대로(invariant) —
// cover_kicker/cover_facts 와 같은 이유(§4). "예상 X 상회" 같은 문장형 delta 가 stats 에도
// 새어 들어간 적이 있어(2026-08-25) stats[].delta 에도 같은 탈출구를 둔다.
const tf = v => (v && typeof v === 'object') ? t(v.ko, v.en) : v;
const DATE_LABEL = t(C.dateLabel_ko, C.dateLabel_en);

// 영어 카드를 그릴 때 invariant 필드에 한글이 남아 있으면 **렌더 로그에 크게 경고한다.**
// 문서(§4)와 검증 에이전트에만 맡겼더니 목록에서 빠진 필드가 그대로 새어 나갔다 —
// rank_title/econ_title/rank_unit/sector_title 이 8/24~8/26 회차 영어 카드에 한글로
// 나간 것을 사용자가 발견했다(2026-08-26). 사람이 목록을 관리하는 대신 렌더러가
// 매번 스스로 검사하게 한다. 고치는 법은 그 필드를 {ko,en} 객체로 감싸는 것이다.
const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;
if (lang === 'en') {
  const flat = v => (v && typeof v === 'object' && !Array.isArray(v)) ? '' : String(v ?? '');
  const bad = [];
  const chk = (name, v) => { if (HANGUL.test(flat(v))) bad.push(`${name}: ${flat(v)}`); };
  for (const k of ['chart_title', 'chart_sub', 'chart_note', 'sector_title', 'rank_title',
                   'econ_title', 'rank_unit', 'tile_lead', 'main_tile_note', 'sector_sub',
                   'rank_sub', 'econ_sub', 'schedule_sub', 'record_kicker', 'rank_kicker',
                   'econ_kicker', 'schedule_kicker', 'cover_kicker']) chk(k, C[k]);
  (C.markets || []).forEach((m, i) => { chk(`markets[${i}].label`, m.label); chk(`markets[${i}].delta`, m.delta); chk(`markets[${i}].value_sub`, m.value_sub); });
  (C.schedule || []).forEach((x, i) => chk(`schedule[${i}].time`, x.time));
  (C.sections || []).forEach(sec => {
    (sec.stats || []).forEach((x, i) => { chk(`${sec.title_ko}.stats[${i}].value`, x.value); chk(`${sec.title_ko}.stats[${i}].delta`, x.delta); });
    (sec.rows || []).forEach((x, i) => chk(`${sec.title_ko}.rows[${i}].value`, x.value));
    (sec.items || []).forEach((x, i) => { chk(`${sec.title_ko}.items[${i}].src`, x.src); chk(`${sec.title_ko}.items[${i}].time`, x.time); });
  });
  if (bad.length) {
    console.warn(`\n⚠️  영어 카드인데 언어무관 필드에 한글이 남아 있다 (${bad.length}건) — {ko,en} 객체로 감싸라:`);
    bad.forEach(b => console.warn(`   · ${b}`));
    console.warn('');
  }
}
const TOTAL = 10;

// 본문 섹션은 제목으로 찾는다. 없으면 null 을 돌려주고 카드가 알아서 비운다 —
// 그날 재료가 없다고 브리핑 전체를 멈추지 않는다.
const sec = nameKo => (C.sections || []).find(s => s.title_ko === nameKo) || null;

// 배경 사진: 그날 만든 것이 1순위, 없으면 번들 사진으로 내려간다.
// gen-card-photos.mjs 가 data/card-photos/<date>-<session>/card<n>.jpg 에 넣는다.
const FALLBACK = { 2: 'ticker.jpg', 3: 'nyse.jpg', 4: 'vaccine.jpg', 5: 'ticker.jpg',
                   6: 'datacenter.jpg', 7: 'semiconductor.jpg', 8: 'fed.jpg', 9: 'seoul.jpg' };
const TINT = { 2: '#96b4dc', 3: '#ffce8c', 4: '#96d7c8', 5: '#ffc88c',
               6: '#aacdf5', 7: '#c8d0e0', 8: '#c8c8d7', 9: '#ffc882' };

// 카드 HTML 은 cards/.tmp/ 에 놓이므로 assets·data 로 가는 상대경로는 ../.. 부터 시작한다.
function bg(n) {
  const gen = path.join(root, 'data', 'card-photos', `${date}-${session}`, `card${n}.jpg`);
  if (fs.existsSync(gen)) return photoLayer(`../../data/card-photos/${date}-${session}/card${n}.jpg`, TINT[n] || '#c8c8c8');
  return FALLBACK[n] ? photoLayer(`../../assets/photos/${FALLBACK[n]}`, TINT[n]) : '';
}

// 표지 사진은 흐리지 않고 위쪽 절반에 그대로 쓴다.
function coverSrc() {
  const gen = path.join(root, 'data', 'card-photos', `${date}-${session}`, 'card1.jpg');
  if (fs.existsSync(gen)) return `../../data/card-photos/${date}-${session}/card1.jpg`;
  return `../../assets/photos/${C.cover_photo || 'nyse.jpg'}`;
}

// ── 공통 조각 ───────────────────────────────────────────────────────
const BRAND_MAIN = `<img src="../../assets/brand/wordmark-briefing.png" style="height:23px; display:block;" alt="luckyon 브리핑">`;
const BRAND_FOOT = `<img src="../../assets/brand/wordmark-briefing.png" style="height:17px; display:block; opacity:0.62;" alt="luckyon 브리핑">`;

const header = () => `
  <div style="position:absolute; left:${M}px; right:${M}px; top:52px; display:flex; justify-content:space-between; align-items:center; z-index:2;">
    ${BRAND_MAIN}
    <div style="font-size:16px; font-weight:500; color:${PAL.dim};">${esc(DATE_LABEL)}</div>
  </div>`;

const footer = (n, left) => `
  <div style="position:absolute; left:${M}px; right:${M}px; bottom:58px; z-index:2;">
    <div style="height:1px; background:${PAL.rule}; margin-bottom:22px;"></div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      ${left ? `<div style="font-size:17px; color:${PAL.dim};">${esc(left)}</div>` : BRAND_FOOT}
      <div style="font-size:16px; font-weight:700; color:${PAL.text}; font-variant-numeric:tabular-nums;">${n} / ${TOTAL}</div>
    </div>
  </div>`;

const kicker = (y, label) => `
  <div style="position:absolute; left:${M}px; top:${y}px; display:flex; align-items:center; gap:14px; z-index:2;">
    <div style="width:34px; height:2px; background:${PAL.accent};"></div>
    <div style="font-size:14px; font-weight:700; color:${PAL.accent}; letter-spacing:0.16em;">${esc(label)}</div>
  </div>`;

const title = (y, txt, size = 42) => `
  <div style="position:absolute; left:${M}px; right:${M}px; top:${y}px; font-size:${size}px; font-weight:900;
              color:${PAL.text}; line-height:1.16; letter-spacing:-0.02em; z-index:2;">${esc(txt)}</div>`;

const subline = (y, txt) => txt ? `
  <div style="position:absolute; left:${M}px; right:${M}px; top:${y}px; font-size:17px; color:${PAL.dim}; z-index:2;">${esc(txt)}</div>` : '';

// ※ 각주 — 카드 아래쪽에 구분선과 함께. 푸터에 닿지 않도록 bottom 기준으로 앉힌다.
const noteBlock = (txt, bottom = 132) => txt ? `
  <div style="position:absolute; left:${M}px; right:${M}px; bottom:${bottom}px; z-index:2;">
    <div style="height:1px; background:${PAL.rule}; margin-bottom:22px;"></div>
    <div style="font-size:18px; line-height:1.55; color:${PAL.body};">※ ${esc(txt)}</div>
  </div>` : '';

const page = inner => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  ${FONT_CSS}
  html,body{width:${W}px;height:${H}px}
  body{font-family:'Pretendard',system-ui,sans-serif; background:${PAL.bg}; color:${PAL.text};
       width:${W}px; height:${H}px; position:relative; overflow:hidden;
       -webkit-font-smoothing:antialiased; word-break:keep-all; overflow-wrap:break-word;}
</style></head><body>${inner}</body></html>`;

// ══════════════════════════════════════════════════════════
// 1 — 표지
// ══════════════════════════════════════════════════════════
function card1() {
  const ph = Math.round(H * 0.50);
  const cover = coverSrc();

  // cover_kicker·cover_facts 도 tf() 로 {ko,en} 객체를 받는다(§4) — 2026-08-25
  // 사용자 피드백(한국어 카드 표지 하단이 통째로 영어로 나감)으로 추가했다.
  const kickerTxt = tf(C.cover_kicker);
  const facts = (C.cover_facts || []).map(([icon, a, b]) => `
    <div style="display:flex; align-items:flex-start; gap:26px; margin-bottom:30px;">
      ${(ICONS[icon] || ICONS.chip)(42, PAL.accent)}
      <div style="flex:1; min-width:0;">
        <div style="font-size:25px; font-weight:700; color:${PAL.text}; line-height:1.3;">${esc(tf(a))}</div>
        <div style="font-size:18px; color:${PAL.dim}; margin-top:8px; line-height:1.45;">${esc(tf(b))}</div>
      </div>
    </div>`).join('');

  return `
  <div style="position:absolute; left:0; top:0; width:${W}px; height:${ph}px; overflow:hidden;">
    <div style="position:absolute; inset:0; background:url('${cover}') center/cover no-repeat; filter:grayscale(0.3) brightness(0.62) sepia(0.25);"></div>
    <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(9,10,12,0.29) 0%, rgba(9,10,12,0.62) 55%, ${PAL.bg} 100%);"></div>
  </div>
  ${header()}
  <div style="position:absolute; left:${M}px; top:${ph - 70}px; font-size:15px; font-weight:700; color:${PAL.accent}; letter-spacing:0.18em; z-index:2;">${esc(kickerTxt || '')}</div>
  <div style="position:absolute; left:${M}px; right:${M}px; top:${ph + 40}px; z-index:2;">
    <div style="font-size:50px; font-weight:900; line-height:1.24; letter-spacing:-0.025em; color:${PAL.text};">${esc(t(C.headline_ko, C.headline_en))}</div>
    <div style="font-size:21px; color:${PAL.dim}; line-height:1.5; margin-top:20px;">${esc(t(C.headline_sub_ko, C.headline_sub_en))}</div>
    <div style="height:1px; background:${PAL.rule}; margin:34px 0 30px;"></div>
    ${facts}
  </div>
  ${footer(1, t('오른쪽으로 넘겨보세요 →', 'Swipe to read →'))}`;
}

// ══════════════════════════════════════════════════════════
// 2 — 시장 한눈에 (지표 10개)
// ══════════════════════════════════════════════════════════
function card2() {
  const Mk = Object.fromEntries((C.markets || []).map(m => [m.label, m]));
  const main = C.tile_main || 'NASDAQ';
  const m = Mk[main] || { value: '—', delta: '', dir: 'flat' };
  const side = (C.tile_side || ['S&P 500', 'KOSPI']).filter(k => Mk[k]);
  const rest = (C.tile_rest || []).filter(k => Mk[k]);

  const gy = 292, gap = 16, total = W - M * 2;
  const bw = Math.round(total * 0.585), sw = total - bw - gap, bh = 340;

  const chart = C.chart_series_values
    ? proLine(C.chart_series_values, C.chart_series_labels, {
        x: 28, y: 206, w: bw - 56, h: bh - 224, yTicks: 3, lw: 3, labelEvery: 2,
      })
    : '';

  const sideTiles = side.map((k, i) => {
    const mm = Mk[k], sh = (bh - gap) / 2;
    return `
    <div style="position:absolute; left:0; top:${i * (sh + gap)}px; width:${sw}px; height:${sh}px;
                background:${PAL.tile}; border-radius:16px; padding:22px 24px;">
      <div style="font-size:16px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em;">${esc(k)}</div>
      <div style="font-size:32px; font-weight:800; color:${PAL.text}; margin-top:8px;">${esc(mm.value)}</div>
      <div style="font-size:20px; font-weight:700; color:${dirColor(mm.dir)}; margin-top:11px;">${esc(tf(mm.delta))}</div>
      <div style="font-size:15px; color:${PAL.faint}; margin-top:11px; line-height:1.4;">${esc(t(mm.note_ko, mm.note_en))}</div>
    </div>`;
  }).join('');

  const tile = (k, i, cols, h2, y) => {
    const mm = Mk[k], u = (total - (cols - 1) * gap) / cols;
    return `
    <div style="position:absolute; left:${M + i * (u + gap)}px; top:${y}px; width:${u}px; height:${h2}px;
                background:${PAL.tile}; border-radius:14px; padding:20px 21px; z-index:2;">
      <div style="font-size:${cols === 4 ? 14 : 15}px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em;">${esc(k)}</div>
      <div style="font-size:${cols === 4 ? 25 : 28}px; font-weight:800; color:${PAL.text}; margin-top:8px;">${esc(mm.value)}</div>
      <div style="font-size:${cols === 4 ? 18 : 19}px; font-weight:700; color:${dirColor(mm.dir)}; margin-top:9px;">${esc(tf(mm.delta))}</div>
      <div style="font-size:${cols === 4 ? 14 : 15}px; color:${PAL.faint}; margin-top:10px; line-height:1.4;">${esc(t(mm.note_ko, mm.note_en))}</div>
    </div>`;
  };

  const h2 = 196, y2 = gy + bh + gap, y3 = y2 + h2 + gap;
  return `
  ${bg(2)}${header()}
  ${kicker(132, 'MARKETS AT A GLANCE')}
  ${title(168, t('시장 한눈에', 'Markets at a Glance'))}
  ${subline(226, tf(C.tile_lead))}
  <div style="position:absolute; left:${M}px; top:${gy}px; width:${bw}px; height:${bh}px;
              background:${PAL.tile}; border-radius:20px; z-index:2;">
    <div style="position:absolute; left:28px; top:26px; font-size:17px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em;">${esc(main)}</div>
    <div style="position:absolute; left:28px; top:56px; font-size:50px; font-weight:900; color:${PAL.text};">${esc(m.value)}</div>
    <div style="position:absolute; left:28px; top:126px; font-size:26px; font-weight:800; color:${dirColor(m.dir)};">${esc(tf(m.delta))}</div>
    <div style="position:absolute; left:28px; top:170px; font-size:17px; color:${PAL.dim};">${esc(tf(C.main_tile_note) || '')}</div>
    ${chart}
  </div>
  <div style="position:absolute; left:${M + bw + gap}px; top:${gy}px; width:${sw}px; height:${bh}px; z-index:2;">${sideTiles}</div>
  ${rest.slice(0, 4).map((k, i) => tile(k, i, 4, h2, y2)).join('')}
  ${rest.slice(4, 7).map((k, i) => tile(k, i, 3, h2, y3)).join('')}
  ${noteBlock(t(C.market_note_ko, C.market_note_en), 150)}
  ${footer(2)}`;
}

// ══════════════════════════════════════════════════════════
// 3 — 지수 기록 (차트 + 지수 2개 + 등락 종목수 + 수급)
// ══════════════════════════════════════════════════════════
function card3() {
  const s = sec(C.record_section || '미국장 기록') || sec('코스피 · 코스닥 기록') || { stats: [] };
  const stats = (s.stats || []).slice(0, 2);
  const u = (W - M * 2 - 24) / 2;

  const bigStats = stats.map((st, i) => `
    <div style="position:absolute; left:${M + i * (u + 24)}px; top:628px; width:${u}px; z-index:2;">
      <div style="font-size:17px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em;">${esc(t(st.label_ko, st.label_en))}</div>
      <div style="display:flex; align-items:baseline; gap:18px; margin-top:12px;">
        <span style="font-size:44px; font-weight:900; color:${PAL.text};">${esc(st.value)}</span>
        <span style="font-size:24px; font-weight:800; color:${dirColor(st.dir)};">${esc(tf(st.delta))}</span>
      </div>
      <div style="font-size:15px; color:${PAL.faint}; margin-top:16px; line-height:1.5;">${esc(t(st.sub_ko, st.sub_en))}</div>
    </div>`).join('');

  // 라벨 칸 폭은 실제 글자로 정한다 — 고정 150px 이면 긴 이름이 막대를 침범한다(2026-08-22 사고).
  const labels = [...(s.breadth || []).map(b => t(b.label_ko, b.label_en)),
                  ...((s.flows || {}).rows || []).map(r => t(r.label_ko, r.label_en))];
  const labelW = Math.max(150, ...labels.map(x => x.length * (lang === 'ko' ? 20 : 11) + 26));

  const breadth = (s.breadth || []).slice(0, 2)
    .map(b => breadthRow({ label: t(b.label_ko, b.label_en), up: b.up, flat: b.flat, down: b.down }, { labelW })).join('');

  const f = s.flows;
  const flows = f ? `
    <div style="font-size:17px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em; margin:22px 0 18px;">${esc(t(f.label_ko, f.label_en))}</div>
    ${flowRows((f.rows || []).map(r => ({ label: t(r.label_ko, r.label_en), value: r.value })), { labelW, unit: t(f.unit_ko, f.unit_en) })}` : '';

  return `
  ${bg(3)}${header()}
  ${kicker(132, tf(C.record_kicker) || 'TODAY')}
  ${title(168, tf(C.chart_title) || '', 40)}
  ${subline(228, tf(C.chart_sub))}
  ${C.chart_series_values ? proLine(C.chart_series_values, C.chart_series_labels, { y: 286, h: 244, yTicks: 4, lw: 4 }) : ''}
  <div style="position:absolute; left:${M}px; top:552px; font-size:17px; font-weight:700; color:${PAL.accent}; z-index:2;">${esc(tf(C.chart_note) || '')}</div>
  <div style="position:absolute; left:${M}px; right:${M}px; top:598px; height:1px; background:${PAL.rule}; z-index:2;"></div>
  ${bigStats}
  <div style="position:absolute; left:${M}px; right:${M}px; top:834px; z-index:2;">
    <div style="font-size:17px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em; margin-bottom:26px;">${t('등락 종목수', 'Advancers / Decliners')}</div>
    ${breadth}${flows}
  </div>
  ${noteBlock(t(s.note_ko, s.note_en), 132)}
  ${footer(3)}`;
}

// ══════════════════════════════════════════════════════════
// 4 — 섹터별 등락
// ══════════════════════════════════════════════════════════
function card4() {
  const s = sec(C.sector_section || '섹터별 등락') || sec('업종별 등락') || { bars: [] };
  const rows = (s.bars || []).map(b => ({ label: t(b.label_ko, b.label_en).split(' (')[0], value: b.value }));
  const labelW = Math.max(160, ...rows.map(r => r.label.length * (lang === 'ko' ? 19 : 10) + 30));
  return `
  ${bg(4)}${header()}
  ${kicker(132, 'SECTOR PERFORMANCE')}
  ${title(168, tf(C.sector_title) || t('섹터별 등락', 'Sector Performance'), 38)}
  ${subline(226, tf(C.sector_sub))}
  <div style="z-index:2;">${proBars(rows, { y: 300, h: 730, labelW })}</div>
  ${noteBlock(t(s.note_ko, s.note_en), 132)}
  ${footer(4)}`;
}

// ══════════════════════════════════════════════════════════
// 5 — 거래대금 상위
// ══════════════════════════════════════════════════════════
function card5() {
  const s = sec('거래대금 상위') || { rows: [] };
  const src = (s.rows || []).slice(0, 5);
  const rows = src.map(r => ({
    label: t(r.name_ko, r.name_en),
    num: Number(String(r.value).replace(/[^0-9.]/g, '')) || 0,
    valueText: r.value,
  }));
  const hasShort = src.some(r => r.short != null);
  const labelW = Math.max(170, ...rows.map(r => r.label.length * (lang === 'ko' ? 21 : 11) + 26));

  const top = 318, h = 388, rh = h / Math.max(rows.length, 1);
  const cols = src.map((r, i) => {
    const yc = top + i * rh + rh / 2 - 13;
    const pc = pctColor(r.pct ?? 0);
    // 공매도는 표본 평균(약 47%)과의 거리로 읽는다 — 높으면 매도 우위 쪽
    const sc = r.short == null ? PAL.dim : r.short >= 52 ? PAL.down : r.short <= 42 ? PAL.up : PAL.body;
    return `
      <div style="position:absolute; right:${hasShort ? 198 : M}px; top:${yc}px; font-size:19px; font-weight:700; color:${pc}; z-index:2;">${r.pct != null ? fmtPct(r.pct) : '—'}</div>
      ${hasShort ? `<div style="position:absolute; right:${M}px; top:${yc}px; font-size:19px; font-weight:700; color:${sc}; z-index:2;">${r.short != null ? r.short.toFixed(1) + '%' : '—'}</div>` : ''}`;
  }).join('');

  const sh = s.share || {};
  const segs = sh.segments || [];
  let shareBlock = '';
  if (segs.length && sh.mode === 'compare') {
    // 서로 독립인 값 — 한 줄에 이어 붙이면 "합쳐서 100%" 로 읽힌다. 각자 제 막대로 그린다.
    const lw2 = Math.max(...segs.map(g => t(g.label_ko, g.label_en).length * 18 + 22), 140);
    shareBlock = segs.map(g => `
      <div style="display:flex; align-items:center; gap:0; margin-bottom:14px;">
        <div style="width:${lw2}px; font-size:17px; font-weight:700; color:${PAL.body};">${esc(t(g.label_ko, g.label_en))}</div>
        <div style="flex:1; height:30px; background:${PAL.tile}; border-radius:6px; overflow:hidden;">
          <div style="width:${g.pct}%; height:100%; background:${g.color}; border-radius:6px;"></div>
        </div>
        <div style="width:86px; text-align:right; font-size:18px; font-weight:800; color:${g.color};">${g.pct.toFixed(1)}%</div>
      </div>`).join('');
  } else if (segs.length) {
    // 포함관계 — 큰 것부터 깔고 작은 것을 덮는다
    shareBlock = `
      <div style="position:relative; height:44px; background:${PAL.tile}; border-radius:8px; overflow:hidden;">
        ${[...segs].reverse().map(g => `<div style="position:absolute; left:0; top:0; height:44px; width:${g.pct}%; background:${g.color}; border-radius:8px;"></div>`).join('')}
      </div>
      <div style="display:flex; gap:34px; margin-top:20px;">
        ${segs.map(g => `<span style="font-size:17px; font-weight:700; color:${PAL.body};">
          <span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${g.color}; margin-right:10px;"></span>${esc(t(g.label_ko, g.label_en))} ${g.pct}%</span>`).join('')}
      </div>`;
  }

  return `
  ${bg(5)}${header()}
  ${kicker(132, tf(C.rank_kicker) || 'TOP TURNOVER')}
  ${title(168, tf(C.rank_title) || t('거래대금 상위', 'Top Value Traded'), 40)}
  ${subline(228, tf(C.rank_sub))}
  ${hasShort ? `
    <div style="position:absolute; right:198px; top:286px; font-size:13px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em; z-index:2;">${t('등락률', 'Change')}</div>
    <div style="position:absolute; right:${M}px; top:286px; font-size:13px; font-weight:700; color:${PAL.dim}; letter-spacing:0.06em; z-index:2;">${t('공매도', 'Short')}</div>` : ''}
  <div style="z-index:2;">${hbarRank(rows, { y: top, h, w: W - M - (hasShort ? 290 : 200) - M, labelW })}</div>
  ${cols}
  <div style="position:absolute; left:${M}px; top:752px; font-size:14px; color:${PAL.faint}; z-index:2;">${esc(tf(C.rank_unit) || '')}</div>
  <div style="position:absolute; left:${M}px; right:${M}px; top:800px; height:1px; background:${PAL.rule}; z-index:2;"></div>
  <div style="position:absolute; left:${M}px; right:${M}px; top:836px; z-index:2;">
    <div style="font-size:19px; font-weight:700; color:${PAL.text}; margin-bottom:28px;">${esc(t(sh.label_ko, sh.label_en) || '')}</div>
    ${shareBlock}
  </div>
  ${noteBlock(t(s.note_ko, s.note_en), 132)}
  ${footer(5)}`;
}

// ══════════════════════════════════════════════════════════
// 6 — 실적 · 지표 발표 (2열 타일)
// ══════════════════════════════════════════════════════════
function card6() {
  const s = sec('실적 · 지표 발표') || { stats: [] };
  const st = (s.stats || []).slice(0, 8);

  // 타일 개수에 따라 3단계로 크기를 고른다. 2026-08-26 사용자 요청으로 숫자(value)를
  // 뺀 글자(label·delta·sub)를 약 1.5배로 키웠고, 타일마다 남던 아래 여백에는
  // `ref_ko`/`ref_en`(그 지표의 기준값·의미 한 줄)을 바닥에 붙여 넣는다.
  //   ≤4 → 2행(큰 타일) · 5~6 → 3행(1.5배 확대가 온전히 들어가는 기본 크기)
  //   7~8 → 4행. 이 단계만은 1.5배를 다 못 준다 — 4행 × 확대 글자 + 기준줄은
  //         각주와 겹친다(실측). 재료가 7개 이상인 날은 약 1.2배로 물러선다.
  const tier = st.length <= 4 ? 'roomy' : st.length <= 6 ? 'mid' : 'tight';
  const G = {
    roomy: { h: 330, gap: 20, pad: '24px 26px', label: 24, value: 44, delta: 28, sub: 20, ref: 18 },
    mid:   { h: 256, gap: 18, pad: '20px 22px', label: 21, value: 34, delta: 24, sub: 18, ref: 16 },
    tight: { h: 190, gap: 16, pad: '15px 17px', label: 17, value: 34, delta: 19, sub: 14, ref: 13 },
  }[tier];
  const u = (W - M * 2 - G.gap) / 2, y0 = 296;

  const tiles = st.map((x, i) => {
    const r = Math.floor(i / 2), c = i % 2;
    const ref = t(x.ref_ko, x.ref_en);
    return `
    <div style="position:absolute; left:${M + c * (u + G.gap)}px; top:${y0 + r * (G.h + G.gap)}px; width:${u}px; height:${G.h}px;
                background:${PAL.tile}; border-radius:16px; padding:${G.pad}; z-index:2; overflow:hidden;
                display:flex; flex-direction:column;">
      <div style="font-size:${G.label}px; font-weight:700; color:${PAL.dim}; line-height:1.3;">${esc(t(x.label_ko, x.label_en))}</div>
      <div style="font-size:${G.value}px; font-weight:900; color:${PAL.text}; margin-top:10px; line-height:1.1;">${esc(x.value)}</div>
      <div style="font-size:${G.delta}px; font-weight:800; color:${dirColor(x.dir)}; margin-top:8px; line-height:1.2;">${esc(tf(x.delta) || '')}</div>
      <div style="font-size:${G.sub}px; color:${PAL.faint}; margin-top:9px; line-height:1.4;">${esc(t(x.sub_ko, x.sub_en))}</div>
      ${ref ? `<div style="margin-top:auto; padding-top:12px;">
        <div style="height:1px; background:${PAL.rule}; margin-bottom:9px;"></div>
        <div style="font-size:${G.ref}px; color:${PAL.dim}; line-height:1.35;">${esc(ref)}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  return `
  ${bg(6)}${header()}
  ${kicker(132, tf(C.econ_kicker) || 'EARNINGS · DATA')}
  ${title(168, tf(C.econ_title) || t('실적 · 지표 발표', 'Earnings & Data'), 40)}
  ${subline(228, tf(C.econ_sub))}
  ${tiles}
  ${noteBlock(t(s.note_ko, s.note_en), 132)}
  ${footer(6)}`;
}

// ══════════════════════════════════════════════════════════
// 7 · 8 — 글 카드 (아이콘형 / 번호형)
// ══════════════════════════════════════════════════════════
function cardItems(n, sectionName, kick, ttl, style) {
  const s = sec(sectionName) || { items: [] };
  // 번호형(카드8)의 글자·여백이 아이콘형(카드7)보다 커서 4건이 한계였다. 아이콘형과
  // 같은 촘촘한 크기로 맞춰 6건까지 늘렸다 — 빈칸보다 촘촘한 6개가 낫다는 판단
  // (2026-08-23). 두 스타일이 같은 크기를 쓰므로 style 에 따라 갈리는 건 아이콘·번호
  // 배지 모양과 그 칸 너비뿐이다.
  const items = (s.items || []).slice(0, 6);
  const icons = ['ai', 'chip', 'globe', 'target', 'rate', 'shield'];
  const body = items.map((it, i) => `
    <div style="display:flex; gap:26px; padding-bottom:30px;
                ${i < items.length - 1 ? `border-bottom:1px solid ${PAL.rule}; margin-bottom:30px;` : ''}">
      <div style="flex:none; width:${style === 'icon' ? 44 : 40}px; padding-top:4px;">
        ${style === 'icon'
          ? ICONS[icons[i]](42, PAL.accent)
          : `<span style="font-size:23px; font-weight:900; color:${PAL.accent};">0${i + 1}</span>`}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:24px; font-weight:700; color:${PAL.text}; line-height:1.32;">${esc(t(it.headline_ko, it.headline_en))}</div>
        <div style="font-size:18px; color:${PAL.body}; line-height:1.55; margin-top:12px;">${esc(t(it.body_ko, it.body_en))}</div>
      </div>
    </div>`).join('');
  return `
  ${bg(n)}${header()}
  ${kicker(132, kick)}
  ${title(168, ttl)}
  <div style="position:absolute; left:${M}px; right:${M}px; top:${style === 'icon' ? 262 : 292}px; bottom:130px; overflow:hidden; z-index:2;">${body}</div>
  ${footer(n)}`;
}

// ══════════════════════════════════════════════════════════
// 9 — 일정
// ══════════════════════════════════════════════════════════
function card9() {
  // 5건은 보수적으로 잡은 값이었다 — 항목당 시각·제목 한 줄+세부 한 줄 기준으로
  // 7건까지 운영시간 상자와 안 겹치는 것을 실측으로 확인했다. 세부 설명이 두 줄로
  // 넘어가는 긴 항목이 여럿이면 다시 좁아질 수 있다.
  const rows = (C.schedule || []).slice(0, 7).map(s => ({
    time: s.time, title: t(s.title_ko, s.title_en), detail: t(s.detail_ko, s.detail_en), high: s.importance === 'high',
  }));
  const mh = C.market_hours;
  return `
  ${bg(9)}${header()}
  ${kicker(132, tf(C.schedule_kicker) || 'SCHEDULE')}
  ${title(168, t(C.schedule_title_ko, C.schedule_title_en) || t('주요 일정', 'Key Schedule'))}
  ${subline(228, tf(C.schedule_sub))}
  <div style="position:absolute; left:${M}px; right:${M}px; top:296px; z-index:2;">${timeline(rows)}</div>
  ${mh ? `
  <div style="position:absolute; left:${M}px; right:${M}px; bottom:150px; background:${PAL.tile}; border-radius:16px;
              padding:30px 32px; display:flex; gap:26px; align-items:flex-start; z-index:2;">
    ${ICONS.clock(42, PAL.accent)}
    <div style="flex:1; min-width:0;">
      <div style="font-size:21px; font-weight:700; color:${PAL.text};">${esc(t(mh.title_ko, mh.title_en))}</div>
      <div style="font-size:18px; color:${PAL.body}; line-height:1.55; margin-top:12px;">${esc((t(mh.lines_ko, mh.lines_en) || [])[0] || '')}</div>
    </div>
  </div>` : ''}
  ${footer(9)}`;
}

// ══════════════════════════════════════════════════════════
// 10 — 아웃트로
// ══════════════════════════════════════════════════════════
function card10() {
  const nb = t(C.next_brief_ko, C.next_brief_en);
  return `
  ${bg(9) ? '' : ''}
  <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
              text-align:center; padding:80px ${M}px; z-index:2;">
    <img src="../../assets/brand/wordmark-briefing.png" style="height:44px; margin-bottom:40px;" alt="luckyon 브리핑">
    <div style="font-size:52px; font-weight:900; line-height:1.3; color:${PAL.text};">${esc(t(C.outro_tagline_ko, C.outro_tagline_en) || t('매일 아침·저녁, 경제와 AI를 한눈에 정리합니다', 'Economy & AI at a glance, every morning & night'))}</div>
    ${nb ? `<div style="font-size:32px; font-weight:700; color:${PAL.accent}; margin-top:44px;">${esc(nb)}</div>` : ''}
    <div style="font-size:34px; color:${PAL.body}; margin-top:56px; line-height:1.5;">
      ${t('팔로우하고 놓치지 마세요', 'Follow so you never miss it')}<br>🔖 ${t('저장', 'Save')} · 📤 ${t('공유', 'Share')} · 💬 ${t('댓글', 'Comment')}
    </div>
    <div style="font-size:28px; font-weight:700; color:${PAL.dim}; margin-top:56px;">@luckyon_77</div>
    <div style="font-size:22px; color:${PAL.faint}; margin-top:20px;">${t('정보 제공 목적 · 투자 조언 아님', 'For information only · not investment advice')}</div>
  </div>
  ${footer(10)}`;
}

// ── 렌더 ────────────────────────────────────────────────────────────
const cards = [
  card1(), card2(), card3(), card4(), card5(), card6(),
  cardItems(7, C.tech_section || 'AI · 반도체 기술', 'AI · SEMICONDUCTOR', t('AI · 반도체', 'AI & Semiconductors'), 'icon'),
  cardItems(8, C.stories_section || '주요 소식', 'TOP STORIES', t('주요 소식', 'Top Stories'), 'num'),
  card9(), card10(),
];

// HTML 을 파일로 쓰고 file:// 로 연다. setContent 를 쓰면 상대경로가 풀리지 않아
// 폰트·사진을 전부 base64 로 심어야 하고, 카드 한 장이 5MB 를 넘겨 렌더가 느려진다.
const tmpDir = path.join(root, 'cards', '.tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (let i = 0; i < cards.length; i++) {
  const f = path.join(tmpDir, `card${i + 1}.html`);
  fs.writeFileSync(f, page(cards[i]));
  await pg.goto('file://' + f.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const out = path.join(outDir, `card${i + 1}.png`);
  await pg.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  console.log('wrote', path.relative(root, out));
}
await browser.close();
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n✅ ${lang.toUpperCase()} ${session.toUpperCase()} ${cards.length}장 생성 완료 -> ${path.relative(root, outDir)}/`);
