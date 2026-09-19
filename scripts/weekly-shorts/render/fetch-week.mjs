// 대상 주의 5분봉을 야후에서 받아 {d,o,h,l,c} 배열로 저장한다.
// d 는 미 동부 시각 "YYYY-MM-DD HH:MM". verify-shorts.mjs 와 같은 규칙이다.
//
//   node scripts/weekly-shorts/render/fetch-week.mjs \
//        --symbol=NQZ26.CME --from=2026-09-21 --to=2026-09-25 --out=data/weekly-shorts/2026-09-21.5m.json
//
// 심볼은 그 주의 실제 월물이다. 연속 심볼 NQ=F 는 쓰지 않는다(지침서 2장).
// 11월 첫 일요일 이후 회차는 --etoffset=-5 를 준다.
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));

const SYMBOL = args.symbol || 'NQZ26.CME';
const FROM = args.from, TO = args.to;
const INTERVAL = args.interval || '5m';
const ET_OFFSET = Number(args.etoffset ?? -4) * 3600;
if (!FROM || !TO) { console.error('--from=YYYY-MM-DD --to=YYYY-MM-DD 가 필요하다'); process.exit(1); }

const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}`
          + `?interval=${INTERVAL}&range=1mo`;

const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) { console.error(`야후 응답 ${res.status}. 프록시 환경이면 NODE_USE_ENV_PROXY=1 을 켠다.`); process.exit(1); }
const j = await res.json();
const r = j?.chart?.result?.[0];
if (!r) { console.error('야후가 자료를 주지 않았다:', JSON.stringify(j).slice(0, 300)); process.exit(1); }

const q = r.indicators.quote[0];
const all = [];
r.timestamp.forEach((t, i) => {
  if (q.close[i] == null) return;
  all.push({
    d: new Date((t + ET_OFFSET) * 1000).toISOString().slice(0, 16).replace('T', ' '),
    o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i],
  });
});

const lo = `${FROM} 09:30`, hi = `${TO} 16:00`;
const bars = all.filter(x => lo <= x.d && x.d <= hi);
if (!bars.length) { console.error(`대상 주(${lo} ~ ${hi})에 봉이 없다. 야후 5분봉은 약 1개월치만 준다.`); process.exit(1); }

const OUT = args.out || `data/weekly-shorts/${FROM}.5m.json`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all));

const wk = (bars.at(-1).c / bars[0].o - 1) * 100;
console.log(`심볼 ${r.meta.symbol} · 받은 봉 ${all.length}개 (전체 1개월)`);
console.log(`대상 주 ${lo} ~ ${hi} · 봉 ${bars.length}개 · 주간 ${wk >= 0 ? '+' : ''}${wk.toFixed(3)}%`);
console.log(`저장: ${OUT}`);
if (bars.length < 1100 || bars.length > 1260) {
  console.log(`⚠ 봉 개수가 평소(약 1,180개)와 다르다. 휴장일이 낀 주인지 확인한다.`);
}
