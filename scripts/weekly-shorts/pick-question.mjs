// pick-question.mjs — 이번 주에 쓸 질문을 고른다.
//
// 고르는 기준은 "이번 주 답이 평소와 얼마나 다른가" 다. 늘 같은 질문을 쓰면 시리즈가
// 지루해지고, 무엇보다 그 주의 진짜 이야기를 놓친다(1회차가 그랬다 — 그 주의 가장 큰
// 움직임은 상승 +2.69% 였는데 낙폭 -2.18% 를 물었다).
//
// 사용법: node scripts/weekly-shorts/pick-question.mjs <5분봉> <1시간봉> <대상주 시작일> [--used a,b,c]
import fs from 'node:fs';
import { QUESTIONS, buildCtx } from './questions.mjs';

const [f5, f1h, weekStart] = process.argv.slice(2);
const usedIdx = process.argv.indexOf('--used');
const used = usedIdx >= 0 ? process.argv[usedIdx + 1].split(',') : [];

const cut = (all, minBars) => {
  const m = new Map();
  for (const b of all) {
    const d = new Date(b.d.slice(0, 10) + 'T00:00:00Z'), dw = d.getUTCDay();
    if (dw === 0 || dw === 6) continue;
    const mo = new Date(d); mo.setUTCDate(d.getUTCDate() - (dw - 1));
    const k = mo.toISOString().slice(0, 10);
    if (!m.has(k)) m.set(k, []); m.get(k).push(b);
  }
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).filter(([, v]) => v.length >= minBars);
};
const W5 = cut(JSON.parse(fs.readFileSync(f5, 'utf8')), 400);
const W1 = cut(JSON.parse(fs.readFileSync(f1h, 'utf8')), 40);

const target5 = W5.find(([k]) => k === weekStart);
const ti = W1.findIndex(([k]) => k === weekStart);
if (!target5 || ti < 0) { console.error('대상 주를 못 찾았다:', weekStart); process.exit(1); }

const ctx5 = buildCtx(target5[1], W5.slice(Math.max(0, W5.indexOf(target5) - 4), W5.indexOf(target5)).flatMap(([, v]) => v));
const ctx1 = buildCtx(W1[ti][1], W1.slice(Math.max(0, ti - 4), ti).flatMap(([, v]) => v));

const rows = [];
for (const Q of QUESTIONS) {
  if (Q.needsEvents) continue;                       // 지표 질문은 캘린더가 붙은 뒤에 따로 고른다
  let ans5; try { ans5 = Q.fn(ctx5); } catch { continue; }
  if (ans5 === undefined || ans5 === null) continue;
  if (typeof ans5 === 'number' && !isFinite(ans5)) continue;
  // 과거 분포는 1시간봉으로 낸다 — 표본이 100주 넘게 필요해서다
  const hist = [];
  for (let i = 4; i < W1.length; i++) {
    if (i === ti) continue;
    try { const v = Q.fn(buildCtx(W1[i][1], W1.slice(i - 4, i).flatMap(([, x]) => x)));
      if (v !== undefined && v !== null && !(typeof v === 'number' && !isFinite(v))) hist.push(v); } catch { /* 건너뛴다 */ }
  }
  if (hist.length < 30) { rows.push({ Q, ans5, pct: null, note: '과거 표본 부족' }); continue; }
  let pctile, note;
  if (typeof ans5 === 'string') {
    const share = hist.filter((v) => v === ans5).length / hist.length;
    pctile = (1 - share) * 100;                       // 드문 답일수록 높게
    note = `이 답이 나온 주 ${(share * 100).toFixed(0)}%`;
  } else {
    let a1; try { a1 = Q.fn(ctx1); } catch { a1 = ans5; }
    const below = hist.filter((v) => v < a1).length;
    pctile = below / hist.length * 100;
    note = `과거 중앙값 ${[...hist].sort((x, y) => x - y)[Math.floor(hist.length / 2)].toFixed(2)}`;
  }
  const surprise = typeof ans5 === 'string' ? pctile : Math.abs(pctile - 50) * 2;
  rows.push({ Q, ans5, pct: pctile, surprise, note, recentlyUsed: used.includes(Q.id) });
}
rows.sort((a, b) => (b.surprise ?? -1) - (a.surprise ?? -1));

const W = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`대상 주 ${weekStart} · 후보 ${rows.length}개 (최근 쓴 것 ${used.length}개 제외 표시)\n`);
console.log(W('순', 3), W('id', 16), W('이번 주 답', 14), W('특이도', 7), W('참고', 22), '질문');
console.log('─'.repeat(120));
rows.slice(0, 15).forEach((r, i) => {
  const a = typeof r.ans5 === 'number' ? r.ans5.toFixed(2) + (r.Q.unit === '%' ? '%' : '') : r.ans5;
  console.log(W(i + 1, 3), W(r.Q.id + (r.recentlyUsed ? '*' : ''), 16), W(a, 14),
    W((r.surprise ?? 0).toFixed(0) + '점', 7), W(r.note, 22), r.Q.ko);
});
console.log('\n* = 최근에 쓴 질문. 특이도 100점 = 과거 100주 중 가장 극단.');
