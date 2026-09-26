// 트레이딩이코노믹스 캘린더 HTML 을 읽어 대상 기간의 발표를 뽑는다.
//
//   node scripts/weekly-shorts/render/parse-calendar.mjs \
//        --html=content/weekly-shorts/2026-09-21.calendar.html \
//        --from=2026-09-21 --to=2026-09-25 [--minstars=2]
//
// 별표(중요도)는 CSS 클래스 calendar-date-1|2|3 에 들어 있다. 1=★ 2=★★ 3=★★★.
// 시각은 HTML 에 UTC 로 찍힌다. 미 동부는 서머타임에 따라 UTC−4(EDT)·UTC−5(EST), 한국은 UTC+9.
// 같은 시각의 세부 지표는 5분봉에서 한 봉이므로 묶어서 본다(지침서 3장).
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));
if (!args.html) { console.error('--html=<파일> 이 필요하다'); process.exit(1); }
const FROM = args.from || '0000-00-00', TO = args.to || '9999-99-99';
const MIN = Number(args.minstars ?? 1);
// 미 동부는 날짜마다 서머타임을 따져 바꾼다. 예전에는 −4 고정이라 11월 첫 일요일 뒤로는
// 모든 발표 시각이 한 시간 늦게 나왔다(2026-09-26 발견, 4회차까지는 EDT 라 영향 없음).
const ET_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const toET = (utc) => ET_FMT.format(new Date(utc.replace(' ', 'T') + ':00Z')).replace(',', '').slice(0, 16);

const html = fs.readFileSync(args.html, 'utf8');
const rows = html.split(/<tr\s+data-url=/).slice(1);
// 값은 <span id='actual'>0%</span> 또는 <a id='consensus' ...>-0.4%</a> 안에 있다.
// 여는 태그를 건너뛴 뒤 다음 '<' 까지를 값으로 본다.
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
  ev.push({ name: em[1].trim(), stars: +sm[1], utc, et: toET(utc), kst: shift(utc, 9),
            actual: val(r, 'actual'), consensus: val(r, 'consensus'), previous: val(r, 'previous') });
}

const inRange = ev.filter(e => e.et.slice(0, 10) >= FROM && e.et.slice(0, 10) <= TO && e.stars >= MIN);
inRange.sort((a, b) => a.et.localeCompare(b.et));

console.log(`HTML 행 ${rows.length}개 · 시각이 있는 발표 ${ev.length}건`);
console.log(`대상 기간 ${FROM} ~ ${TO} (미 동부 날짜) · ★${MIN} 이상 : ${inRange.length}건\n`);
if (ev.length && !inRange.length) {
  const ds = [...new Set(ev.map(e => e.et.slice(0, 10)))].sort();
  console.log(`⚠ 이 HTML 이 담고 있는 날짜: ${ds[0]} ~ ${ds.at(-1)}. 대상 기간이 안 들어 있다.`);
}
let day = '';
for (const e of inRange) {
  const d = e.et.slice(0, 10);
  if (d !== day) { day = d; const w = DOW[new Date(d + 'T00:00:00Z').getUTCDay()];
    const et930 = '', _ = et930;
    console.log(`── ${d} (${w}) 미 동부`); }
  const mark = '★'.repeat(e.stars);
  const sess = (e.et.slice(11) >= '09:30' && e.et.slice(11) <= '16:00') ? '장중' : '장밖';
  const nums = [e.actual && `실제 ${e.actual}`, e.consensus && `예상 ${e.consensus}`, e.previous && `직전 ${e.previous}`].filter(Boolean).join(' · ');
  console.log(`   ${e.et.slice(11)} ET / ${e.kst.slice(5)} KST  ${mark.padEnd(3)} ${sess}  ${e.name}${nums ? '  [' + nums + ']' : ''}`);
}
