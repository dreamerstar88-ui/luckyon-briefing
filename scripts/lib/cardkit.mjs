// cardkit.mjs
// 평일 카드(am·pm)가 쓰는 그림 조각들. 2026-08-22 에 사용자와 확정한 디자인을
// 파이썬 시안(PIL)에서 옮겨 온 것이다.
//
// 왜 SVG 인가
//   원본 시안은 PIL 로 픽셀을 직접 찍었다. 이 저장소의 렌더러는 playwright 로
//   HTML 을 찍으므로 좌표 계산을 그대로 옮기되 출력만 SVG 로 바꾼다. 선·축·눈금은
//   SVG 가 훨씬 정확하고, 글자는 브라우저가 폭을 재 주므로 라벨 겹침 계산이 사라진다.
//
// 좌표 규약
//   시안은 SCALE=2 로 2160x2700 을 그렸고 모든 수치를 `n*SCALE` 로 썼다.
//   여기서는 1080x1350 논리 픽셀에 deviceScaleFactor=2 로 찍으므로
//   **시안의 `n*SCALE` 이 그대로 n 논리픽셀**이 된다. 숫자를 바꾸지 않고 옮겼다.

export const W = 1080, H = 1350;
export const M = 70;                        // 좌우 여백 (시안 70*SCALE)

// 확정 팔레트. 시안 fullset_am.py 의 P 를 그대로 옮겼다.
export const PAL = {
  bg: '#090a0c', text: '#f6f4f0', body: '#cecbc4', dim: '#92908a',
  faint: '#686662', accent: '#ffc400',
  up: '#e86048', down: '#609ee0', flat: '#787671',
  grid: 'rgba(246,244,240,0.10)', axis: 'rgba(246,244,240,0.25)',
  rule: 'rgba(246,244,240,0.16)',
  tile: 'rgba(255,255,255,0.047)', tile2: 'rgba(255,255,255,0.078)',
};

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const dirColor = d => (d === 'up' ? PAL.up : d === 'down' ? PAL.down : PAL.dim);
export const pctColor = v => (v > 0 ? PAL.up : v < 0 ? PAL.down : PAL.dim);
export const fmtPct = v => `${v > 0 ? '▲' : v < 0 ? '▼' : '−'}${Math.abs(v).toFixed(2)}%`;

// ── 폰트 ────────────────────────────────────────────────────────────
// 카드 HTML 을 파일로 쓴 뒤 file:// 로 열기 때문에 상대경로가 그대로 통한다.
// base64 로 심으면 카드 한 장마다 4MB 가 붙어 렌더가 눈에 띄게 느려진다.
export const FONT_CSS = ['Regular', 'Medium', 'Bold', 'ExtraBold', 'Black'].map((w, i) => `
@font-face {
  font-family: 'Pretendard'; font-style: normal;
  font-weight: ${[400, 500, 700, 800, 900][i]};
  src: url('../../assets/fonts/Pretendard-${w}.woff2') format('woff2');
  font-display: block;
}`).join('');

// ── 사진 배경 ───────────────────────────────────────────────────────
// 시안 bg_photo(): 사진을 어둡게 깔고 색조(tint)를 얹은 뒤 비네팅으로 가장자리를 눌렀다.
// strength 26 / blur 7 은 시안 값 그대로다. 사진이 글자를 먹지 않을 만큼만 남긴다.
//
// `src` 는 카드 HTML 이 놓이는 cards/.tmp/ 기준 상대경로다.
export function photoLayer(src, tint, { strength = 26, blur = 7 } = {}) {
  if (!src) return '';
  return `
  <div style="position:absolute; inset:0; overflow:hidden; z-index:0;">
    <div style="position:absolute; inset:-${blur * 3}px;
                background:url('${src}') center/cover no-repeat;
                filter:blur(${blur}px) grayscale(0.35) brightness(${(strength / 100).toFixed(3)});"></div>
    <div style="position:absolute; inset:0; background:${tint}; mix-blend-mode:overlay; opacity:0.30;"></div>
    <div style="position:absolute; inset:0;
                background:radial-gradient(120% 85% at 50% 42%, rgba(9,10,12,0.35) 0%, rgba(9,10,12,0.86) 68%, rgba(9,10,12,0.97) 100%);"></div>
  </div>`;
}

// ── 눈금 고르기 ─────────────────────────────────────────────────────
// 시안 _nice_ticks(): 축 눈금이 1·2·2.5·5·10 배수에 떨어지게 만든다.
// 이걸 안 하면 "26,412.7" 같은 눈금이 나와 읽는 사람이 숫자를 세게 된다.
export function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

// ── 선 차트 ─────────────────────────────────────────────────────────
// 시안 pro_line(). 격자·축·눈금·면적 채움·마지막 점 강조까지 같은 구성이다.
export function proLine(vals, labels, {
  x = M, y = 0, w = W - M * 2, h = 240,
  color = PAL.up, fill = 'rgba(232,96,72,0.16)',
  yTicks = 4, lw = 4, labelEvery = 1, fmt = v => v.toLocaleString(),
} = {}) {
  if (!vals || vals.length < 2) return '';
  const padL = 74, padB = 34, padT = 10, padR = 12;
  const px0 = x + padL, px1 = x + w - padR;
  const py0 = y + padT, py1 = y + h - padB;

  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const pad = (hi0 - lo0) * 0.18 || Math.abs(hi0) * 0.01 || 1;
  const lo = lo0 - pad, hi = hi0 + pad;
  const Y = v => py1 - (v - lo) / (hi - lo) * (py1 - py0);
  const X = i => px0 + (px1 - px0) * i / (vals.length - 1);

  const ticks = niceTicks(lo, hi, yTicks);
  const grid = ticks.map(t => `
    <line x1="${px0}" y1="${Y(t).toFixed(1)}" x2="${px1}" y2="${Y(t).toFixed(1)}" stroke="${PAL.grid}" stroke-width="1"/>
    <text x="${px0 - 14}" y="${(Y(t) + 5).toFixed(1)}" fill="${PAL.faint}" font-size="14" font-weight="500" text-anchor="end">${esc(fmt(t))}</text>`).join('');

  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${px0},${py1} ${pts} ${px1},${py1}`;
  const dots = vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === vals.length - 1 ? 7 : 4}"
      fill="${i === vals.length - 1 ? '#ffffff' : color}" stroke="${color}" stroke-width="${i === vals.length - 1 ? 4 : 0}"/>`).join('');

  const xlab = (labels || []).map((l, i) =>
    (i % labelEvery === 0 || i === vals.length - 1)
      ? `<text x="${X(i).toFixed(1)}" y="${py1 + 26}" fill="${PAL.faint}" font-size="14" font-weight="500" text-anchor="middle">${esc(l)}</text>`
      : '').join('');

  return `<svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" style="position:absolute; left:${x}px; top:${y}px; overflow:visible;">
    ${grid}
    <polygon points="${area}" fill="${fill}"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="${PAL.axis}" stroke-width="1"/>
    ${xlab}
  </svg>`;
}

// ── 0 기준 발산 막대 ────────────────────────────────────────────────
// 시안 pro_bars(). 섹터별 등락처럼 부호가 핵심인 데이터.
// 라벨 칸 폭(labelW)을 고정으로 두면 긴 이름이 막대를 침범하므로 호출부에서 넘긴다.
export function proBars(rows, { x = M, y = 0, w = W - M * 2, h = 700, labelW = 200 } = {}) {
  if (!rows || !rows.length) return '';
  const valW = 92;
  const ax0 = x + labelW, ax1 = x + w - valW;
  const cx = (ax0 + ax1) / 2, half = (ax1 - ax0) / 2;
  const span = Math.max(...rows.map(r => Math.abs(r.value)), 0.01) * 1.12;
  const rh = h / rows.length, bh = Math.min(30, rh * 0.56);

  const body = rows.map((r, i) => {
    const yc = y + i * rh + rh / 2;
    const wpx = Math.abs(r.value) / span * half;
    const c = pctColor(r.value);
    const bx = r.value >= 0 ? cx : cx - wpx;
    return `
      <text x="${ax0 - 18}" y="${yc + 7}" fill="${PAL.text}" font-size="19" font-weight="600" text-anchor="end">${esc(r.label)}</text>
      <rect x="${bx.toFixed(1)}" y="${(yc - bh / 2).toFixed(1)}" width="${wpx.toFixed(1)}" height="${bh}" rx="3" fill="${c}"/>
      <text x="${ax1 + 16}" y="${yc + 7}" fill="${c}" font-size="18" font-weight="700">${r.value > 0 ? '+' : ''}${r.value.toFixed(2)}</text>`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" style="position:absolute; left:${x}px; top:${y}px; overflow:visible;">
    <line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h}" stroke="${PAL.axis}" stroke-width="1"/>
    ${body}
  </svg>`;
}

// ── 순위 가로 막대 ──────────────────────────────────────────────────
// 시안 hbar_rank(). 거래대금 상위처럼 "얼마나 컸나" 를 길이로 보여준다.
export function hbarRank(rows, { x = M, y = 0, w = W - M * 2 - 220, h = 388, labelW = 210 } = {}) {
  if (!rows || !rows.length) return '';
  const ax0 = x + labelW, ax1 = x + w;
  const mx = Math.max(...rows.map(r => r.num), 0.01) * 1.1;
  const rh = h / rows.length, bh = Math.min(34, rh * 0.5);

  const body = rows.map((r, i) => {
    const yc = y + i * rh + rh / 2;
    const wpx = r.num / mx * (ax1 - ax0);
    return `
      <text x="${ax0 - 20}" y="${yc + 8}" fill="${PAL.text}" font-size="21" font-weight="700" text-anchor="end">${esc(r.label)}</text>
      <rect x="${ax0}" y="${(yc - bh / 2).toFixed(1)}" width="${wpx.toFixed(1)}" height="${bh}" rx="4" fill="${PAL.accent}"/>
      <text x="${(ax0 + wpx + 16).toFixed(1)}" y="${yc + 8}" fill="${PAL.text}" font-size="20" font-weight="800">${esc(r.valueText)}</text>`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" style="position:absolute; left:${x}px; top:${y}px; overflow:visible;">${body}</svg>`;
}

// ── 등락 종목수 (상승·보합·하락 비율 띠) ────────────────────────────
export function breadthRow(b, { labelW, barRight = 260 }) {
  const up = b.up || 0, fl = b.flat || 0, dn = b.down || 0;
  const tot = Math.max(up + fl + dn, 1);
  const seg = (v, c) => `<div style="width:${(v / tot * 100).toFixed(3)}%; background:${c};"></div>`;
  return `
  <div style="display:flex; align-items:center; margin-bottom:32px;">
    <div style="width:${labelW}px; font-size:19px; font-weight:700; color:${PAL.text};">${esc(b.label)}</div>
    <div style="flex:1; display:flex; height:26px; border-radius:3px; overflow:hidden;">
      ${seg(up, PAL.up)}${seg(fl, PAL.flat)}${seg(dn, PAL.down)}
    </div>
    <div style="width:${barRight}px; padding-left:20px; display:flex; gap:26px; font-variant-numeric:tabular-nums;">
      <span style="font-size:17px; font-weight:700; color:${PAL.up};">▲${up.toLocaleString()}</span>
      <span style="font-size:16px; color:${PAL.faint};">${fl.toLocaleString()}</span>
      <span style="font-size:17px; font-weight:700; color:${PAL.down};">▼${dn.toLocaleString()}</span>
    </div>
  </div>`;
}

// ── 투자자별 순매수 (0 기준 좌우 막대) ──────────────────────────────
export function flowRows(rows, { labelW, unit = '', valW = 190 }) {
  if (!rows || !rows.length) return '';
  const mx = Math.max(...rows.map(r => Math.abs(r.value)), 0.0001);
  const body = rows.map(r => {
    const c = r.value >= 0 ? PAL.up : PAL.down;
    const pct = Math.abs(r.value) / mx * 46;      // 반폭 50% 중 46% 까지만 (끝이 잘리지 않게)
    return `
    <div style="display:flex; align-items:center; height:46px;">
      <div style="width:${labelW}px; font-size:18px; font-weight:700; color:${PAL.text};">${esc(r.label)}</div>
      <div style="flex:1; position:relative; height:24px;">
        <div style="position:absolute; left:50%; top:-11px; bottom:-11px; width:1px; background:${PAL.axis};"></div>
        <div style="position:absolute; ${r.value >= 0 ? `left:50%; width:${pct}%;` : `right:50%; width:${pct}%;`} top:0; height:24px; background:${c}; border-radius:2px;"></div>
      </div>
      <div style="width:${valW}px; padding-left:22px; font-size:17px; font-weight:700; color:${c}; font-variant-numeric:tabular-nums;">${r.value > 0 ? '+' : ''}${r.value.toFixed(2)}</div>
    </div>`;
  }).join('');
  return body + (unit ? `<div style="text-align:right; padding-right:${valW - 22}px; margin-top:-6px; font-size:13px; color:${PAL.faint};">${esc(unit)}</div>` : '');
}

// ── 일정 타임라인 ───────────────────────────────────────────────────
// 시안 timeline(). 왼쪽에 시각, 세로선 위의 점, 오른쪽에 제목·설명.
export function timeline(rows) {
  return rows.map((r, i) => `
  <div style="display:flex; gap:26px; position:relative; padding-bottom:${i === rows.length - 1 ? 0 : 34}px;">
    <div style="width:104px; text-align:right; font-size:22px; font-weight:900; color:${r.high ? PAL.accent : PAL.dim}; font-variant-numeric:tabular-nums; padding-top:2px;">${esc(r.time)}</div>
    <div style="position:relative; width:2px; background:${PAL.rule}; flex:none;">
      <div style="position:absolute; left:-6px; top:6px; width:14px; height:14px; border-radius:50%;
                  background:${r.high ? PAL.accent : PAL.bg}; border:3px solid ${r.high ? PAL.accent : PAL.dim};"></div>
      ${i === rows.length - 1 ? `<div style="position:absolute; left:-1px; top:22px; bottom:0; width:2px; background:${PAL.bg};"></div>` : ''}
    </div>
    <div style="flex:1; min-width:0; padding-left:6px;">
      <div style="font-size:23px; font-weight:700; color:${PAL.text}; line-height:1.35;">${esc(r.title)}</div>
      ${r.detail ? `<div style="font-size:16px; color:${PAL.dim}; line-height:1.5; margin-top:7px;">${esc(r.detail)}</div>` : ''}
    </div>
  </div>`).join('');
}

// ── 아이콘 (선화) ───────────────────────────────────────────────────
// 시안의 ico_* 를 SVG 로 옮겼다. 크기 s, 색 col.
const ico = (s, col, inner) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round" style="flex:none;">${inner}</svg>`;

export const ICONS = {
  chip: (s, c) => ico(s, c, `<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4"/>
    <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/>`),
  bond: (s, c) => ico(s, c, `<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>`),
  shield: (s, c) => ico(s, c, `<path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z"/><path d="M9.5 12l1.8 1.8L15 10"/>`),
  rate: (s, c) => ico(s, c, `<path d="M4 17l5-5 3 3 7-7"/><path d="M15 8h4v4"/>`),
  ai: (s, c) => ico(s, c, `<rect x="5" y="5" width="14" height="14" rx="3"/><circle cx="9.5" cy="10.5" r="1.2"/><circle cx="14.5" cy="10.5" r="1.2"/><path d="M9 15h6"/>`),
  globe: (s, c) => ico(s, c, `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 2.4 14 0 17M12 3.5c-2.4 2.5-2.4 14 0 17"/>`),
  clock: (s, c) => ico(s, c, `<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>`),
  target: (s, c) => ico(s, c, `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>`),
};
