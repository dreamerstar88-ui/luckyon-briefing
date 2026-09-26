// 캘린더 발표에 그 시각 5분봉 등락률과 주간 순위를 붙여 후보를 뽑는다.
// 사건 선정 규칙(지침서 4장)을 기계가 대신 정하지는 않는다 — 고르는 데 필요한 숫자만 낸다.
//
//   node scripts/weekly-shorts/render/pick-events.mjs --stamp=2026-09-21 --from=2026-09-21 --to=2026-09-25
//
// 규칙 요약: 하루에 최소 1개 · ★★★ 우선, 그날 없으면 ★★ · 같은 조건이면 장중 우선 ·
// 움직임의 크기로 사건 여부를 판정하지 않는다(★★★이면 0에 가까워도 남긴다).
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));

const STAMP = args.stamp || '2026-09-21';
const FROM = args.from || STAMP;
const TO = args.to;
if (!TO) { console.error('--to=YYYY-MM-DD 가 필요하다'); process.exit(1); }
const ET_SHIFT = Number(args.etoffset ?? -4);
const MIN = Number(args.minstars ?? 2);

const DATA = args.data || path.join('data', 'weekly-shorts', `${STAMP}.5m.json`);
const HTML = args.html || path.join('content', 'weekly-shorts', `${STAMP}.calendar.html`);

// ── 5분봉과 봉별 등락률·순위
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const bars = all.filter(x => x.d >= `${FROM} 09:30` && x.d <= `${TO} 16:00`);
if (!bars.length) { console.error('대상 주에 봉이 없다'); process.exit(1); }
const chg = [];
for (let k = 1; k < bars.length; k++) chg.push({ d: bars[k].d, p: (bars[k].c / bars[k - 1].c - 1) * 100 });
const rank = new Map([...chg].sort((a, b) => Math.abs(b.p) - Math.abs(a.p)).map((x, i) => [x.d, i + 1]));
const pct = new Map(chg.map(x => [x.d, x.p]));
const weekPct = (bars.at(-1).c / bars[0].o - 1) * 100;

// ── 캘린더
const html = fs.readFileSync(HTML, 'utf8');
const rows = html.split(/<tr\s+data-url=/).slice(1);
const val = (r, id) => { const m = r.match(new RegExp(`id='${id}'[^>]*>([^<]*)`)); return m ? m[1].replace(/&nbsp;/g, '').trim() : ''; };
const pad = n => String(n).padStart(2, '0');
const shift = (s, h) => { const d = new Date(s.replace(' ', 'T') + 'Z'); d.setUTCHours(d.getUTCHours() + h);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const DOW = '일월화수목금토';

const ev = [];
for (const r of rows) {
  const em = r.match(/data-event="([^"]*)"/); if (!em) continue;
  const dm = r.match(/<td[^>]*class='\s*(\d{4}-\d{2}-\d{2})'/);
  const sm = r.match(/<span class="event-\d+ calendar-date-(\d)">\s*([\s\S]*?)<\/span>/);
  if (!dm || !sm) continue;
  const tm = sm[2].trim().match(/(\d{2}):(\d{2})\s*(AM|PM)/); if (!tm) continue;
  let hh = +tm[1] % 12; if (tm[3] === 'PM') hh += 12;
  const utc = `${dm[1]} ${pad(hh)}:${tm[2]}`;
  const et = shift(utc, ET_SHIFT);
  if (et.slice(0, 10) < FROM || et.slice(0, 10) > TO) continue;
  if (+sm[1] < MIN) continue;
  // 그 시각이 들어가는 5분봉 (분을 5의 배수로 내린다)
  const [d0, t0] = et.split(' ');
  const [H, Mi] = t0.split(':').map(Number);
  const barKey = `${d0} ${pad(H)}:${pad(Math.floor(Mi / 5) * 5)}`;
  ev.push({ name: em[1].trim(), stars: +sm[1], et, kst: shift(utc, 9), barKey,
            actual: val(r, 'actual'), consensus: val(r, 'consensus'), previous: val(r, 'previous') });
}

// ── 같은 봉에 들어가는 발표는 묶는다 (5분봉에서 한 봉이다)
const groups = new Map();
for (const e of ev) {
  if (!groups.has(e.barKey)) groups.set(e.barKey, []);
  groups.get(e.barKey).push(e);
}

console.log(`주간 ${weekPct >= 0 ? '+' : ''}${weekPct.toFixed(3)}% · 봉 ${bars.length}개 · 5분 변동 ${chg.length}개`);
console.log(`캘린더 ★${MIN} 이상 ${ev.length}건 → 같은 봉끼리 묶어 ${groups.size}개 후보\n`);

const byDay = new Map();
for (const [key, list] of groups) {
  const day = key.slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, []);
  byDay.get(day).push({ key, list });
}

for (const day of [...byDay.keys()].sort()) {
  const w = DOW[new Date(day + 'T00:00:00Z').getUTCDay()];
  const items = byDay.get(day);
  const maxStars = Math.max(...items.map(g => Math.max(...g.list.map(e => e.stars))));
  console.log(`── ${day} (${w}) · 그날 최고 등급 ★${maxStars}`);
  items.sort((a, b) => {
    const sa = Math.max(...a.list.map(e => e.stars)), sb = Math.max(...b.list.map(e => e.stars));
    if (sa !== sb) return sb - sa;
    return Math.abs(pct.get(b.key) ?? 0) - Math.abs(pct.get(a.key) ?? 0);
  });
  for (const { key, list } of items) {
    const p = pct.get(key), rk = rank.get(key);
    const top = list.reduce((a, b) => (b.stars > a.stars ? b : a));
    const sess = (key.slice(11) >= '09:30' && key.slice(11) <= '16:00') ? '장중' : '장밖';
    const move = p == null ? '   창 밖' : `${p >= 0 ? '+' : ''}${p.toFixed(3)}%`.padStart(8);
    const rkTxt = rk == null ? '' : ` ${String(rk).padStart(4)}위`;
    const same = list.length > 1 ? ` (같은 봉 ${list.length}건)` : '';
    const nums = [top.actual && `실제 ${top.actual}`, top.consensus && `예상 ${top.consensus}`, top.previous && `직전 ${top.previous}`].filter(Boolean).join(' · ');
    console.log(`   ${key.slice(11)} ET ${'★'.repeat(top.stars).padEnd(3)} ${sess} ${move}${rkTxt}  ${top.name}${same}`);
    if (nums) console.log(`        ${nums}`);
    if (list.length > 1) console.log(`        묶인 것: ${list.map(e => e.name).join(' / ')}`);
  }
  console.log();
}

console.log('── 그 주 5분 변동 상위 10개 (사건 없이도 큰 움직임이 있었는지 본다) ──');
[...chg].sort((a, b) => Math.abs(b.p) - Math.abs(a.p)).slice(0, 10).forEach((x, i) => {
  const hit = groups.get(x.d);
  console.log(`  ${String(i + 1).padStart(2)}위 ${x.d} ET  ${(x.p >= 0 ? '+' : '') + x.p.toFixed(3)}%  ${hit ? hit.map(e => e.name).join(' / ') : '(캘린더에 해당 발표 없음)'}`);
});
