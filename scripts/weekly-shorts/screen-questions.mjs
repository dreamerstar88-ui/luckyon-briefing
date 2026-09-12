// screen-questions.mjs — 질문 은행을 과거 주들에 돌려 "답이 미리 정해진 질문"을 걸러낸다.
//
// 왜: 2회차에서 "이번 주 바닥도 꼭대기도 한국 밤에 나왔다"를 발견인 양 내보낼 뻔했다.
// 미국 정규장이 한국시간 밤 10:30~새벽 5:00 이니 그건 정의다. 이런 건 사람이 매번
// 알아채는 대신 기계가 걸러야 한다. 답이 매주 거의 같으면 질문으로 쓰지 않는다.
//
// 사용법: node scripts/weekly-shorts/screen-questions.mjs <시간봉 json>
import fs from 'node:fs';
import { QUESTIONS, buildCtx } from './questions.mjs';

const file = process.argv[2] || 'us1h_nqf.json';
const all = JSON.parse(fs.readFileSync(file, 'utf8'));

// 주 단위로 자른다 — 그 주의 첫 거래일 09:30 부터 마지막 거래일 16:00 까지
const byWeek = new Map();
for (const b of all) {
  const d = new Date(b.d.slice(0, 10) + 'T00:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) continue;
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1));
  const key = mon.toISOString().slice(0, 10);
  if (!byWeek.has(key)) byWeek.set(key, []);
  byWeek.get(key).push(b);
}
const weeks = [...byWeek.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([k, v]) => [k, v.filter((b) => { const t = b.d.slice(11); return true; })])
  .filter(([, v]) => v.length >= 40);
console.log(`주 ${weeks.length}개 · ${weeks[0][0]} ~ ${weeks.at(-1)[0]}\n`);

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };

const rows = [];
for (const Q of QUESTIONS) {
  if (Q.needsEvents) { rows.push({ id: Q.id, cat: Q.cat, note: '지표 캘린더 필요 — 이 검사로는 못 봄', flag: '미검증' }); continue; }
  const vals = [];
  for (let i = 4; i < weeks.length; i++) {
    const bars = weeks[i][1];
    const hist = weeks.slice(Math.max(0, i - 4), i).flatMap(([, v]) => v);
    if (Q.needsHist && hist.length < 40) continue;
    try { const v = Q.fn(buildCtx(bars, hist)); if (v !== undefined && v !== null && !(typeof v === 'number' && !isFinite(v))) vals.push(v); }
    catch { /* 계산 실패는 아래 표본수로 드러난다 */ }
  }
  if (vals.length < 20) { rows.push({ id: Q.id, cat: Q.cat, note: `표본 ${vals.length}개뿐`, flag: '표본부족' }); continue; }
  if (typeof vals[0] === 'string') {
    const cnt = new Map(); vals.forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1));
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
    const share = top[0][1] / vals.length;
    rows.push({ id: Q.id, cat: Q.cat, n: vals.length, kinds: top.length,
      note: top.slice(0, 4).map(([k, v]) => `${k} ${(v / vals.length * 100).toFixed(0)}%`).join(' · '),
      flag: share > 0.7 ? '자명(한쪽 쏠림)' : (top.length < 3 ? '선택지 적음' : 'OK') });
  } else {
    const p10 = q(vals, 0.1), p50 = med(vals), p90 = q(vals, 0.9);
    const spread = Math.abs(p90 - p10);
    const scale = Math.max(Math.abs(p50), 1e-9);
    const cv = spread / scale;
    const sameSign = Math.max(vals.filter((v) => v > 0).length, vals.filter((v) => v < 0).length) / vals.length;
    rows.push({ id: Q.id, cat: Q.cat, n: vals.length, p10, p50, p90, cv, sameSign,
      note: `${p10.toFixed(2)} / ${p50.toFixed(2)} / ${p90.toFixed(2)}`,
      // 30분 구간을 보는 질문은 1시간봉으로는 전부 0이 나온다. 자명해서가 아니라
      // 자료 해상도가 모자라서다. 5분봉으로 따로 확인한다.
      flag: (p10 === 0 && p50 === 0 && p90 === 0) ? '미검증(5분봉 필요)'
          : (cv < 0.25 ? '자명(거의 고정)' : 'OK') });
  }
}

const W = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(W('id', 16), W('분류', 6), W('n', 4), W('10%/중앙/90%', 30), '판정');
console.log('─'.repeat(78));
for (const r of rows) console.log(W(r.id, 16), W(r.cat, 6), W(r.n ?? '-', 4), W(r.note, 30), r.flag);
const bad = rows.filter((r) => r.flag.startsWith('자명'));
const ok = rows.filter((r) => r.flag === 'OK');
console.log(`\n쓸 수 있는 질문 ${ok.length}개 · 자명해서 뺄 것 ${bad.length}개 · 이 검사로 못 본 것 ${rows.length - ok.length - bad.length}개`);
if (bad.length) console.log('뺄 것:', bad.map((r) => r.id).join(', '));
