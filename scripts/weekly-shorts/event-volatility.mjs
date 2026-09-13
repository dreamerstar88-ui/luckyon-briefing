// event-volatility.mjs — 그 회차 사건들의 변동성을 표로 낸다.
//
// 왜 스크립트로 만들었나: 2026-09-12 에 이 표를 손으로 만들어 대표께 보고했다가
// "5분" 칸이 실제로는 10분인 채로 나갔다. 발표 시각 T 의 5분 영향은
// "T 봉의 종가 ÷ 직전 봉 종가" 다. 한 칸 밀리면 숫자가 통째로 달라진다.
// 보고용 숫자도 영상 숫자와 같은 경로로 계산해야 한다.
//
// 사용법: node scripts/weekly-shorts/event-volatility.mjs <매니페스트> <5분봉json>
import fs from 'node:fs';

const [mf, barsFile] = process.argv.slice(2);
if (!mf || !barsFile) { console.error('사용법: node event-volatility.mjs <매니페스트> <5분봉json>'); process.exit(1); }
const M = JSON.parse(fs.readFileSync(mf, 'utf8'));
const all = JSON.parse(fs.readFileSync(barsFile, 'utf8'));
const B = all.filter((x) => x.d >= M.window.from_et && x.d <= M.window.to_et);
const chg = [];
for (let i = 1; i < B.length; i++) chg.push({ d: B[i].d, p: (B[i].c / B[i - 1].c - 1) * 100 });
const rank = new Map([...chg].sort((a, b) => Math.abs(b.p) - Math.abs(a.p)).map((x, i) => [x.d, i + 1]));

const DOW = '일월화수목금토';
const w = (s, n) => String(s).padEnd(n);
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(3) + '%';

console.log(`${M.stamp} · 봉 ${B.length}개 · 변동 ${chg.length}개\n`);
console.log(w('#', 3), w('한국시간', 15), w('등급', 5), w('지표', 16), w('5분', 9), w('순위', 6),
  w('15분', 9), w('30분', 9), w('60분', 9), '1시간 최대폭');
console.log('─'.repeat(112));
const rows = [];
for (const e of M.events) {
  const j = B.findIndex((x) => x.d === e.et);
  if (j <= 0) { console.log(w(e.n, 3), '봉을 못 찾음', e.et); continue; }
  const base = B[j - 1].c;                       // 발표 직전 봉의 종가가 기준선
  const at = (min) => { const k = Math.min(B.length - 1, j + (min / 5 - 1)); return (B[k].c / base - 1) * 100; };
  const win = B.slice(j, Math.min(B.length, j + 12));
  const rng = (Math.max(...win.map((b) => b.h)) / Math.min(...win.map((b) => b.l)) - 1) * 100;
  const kst = e.kst_label || e.et;
  const p5 = at(5);
  rows.push({ n: e.n, tag: e.tag, p5, rng });
  console.log(w(e.n, 3), w(kst.split(' · ')[1] || kst, 15), w('★'.repeat(e.stars), 5), w(e.tag, 16),
    w(f(p5), 9), w(rank.get(e.et) + '위', 6), w(f(at(15)), 9), w(f(at(30)), 9), w(f(at(60)), 9), rng.toFixed(3) + '%');
  // 매니페스트에 적힌 값과 어긋나면 바로 알린다
  if (Math.abs(p5 - e.pct) > 0.001) console.log(`     ⚠ 매니페스트 pct ${e.pct} 와 재계산 ${p5.toFixed(3)} 이 다르다`);
}
const byAbs = [...rows].sort((a, b) => Math.abs(b.p5) - Math.abs(a.p5));
console.log('\n발표 직후 5분 충격 순위');
byAbs.forEach((r, i) => console.log(`  ${i + 1}위  ${w(r.tag, 14)} ${f(r.p5)}`));
console.log('\n발표 후 1시간 흔들림 1위:', [...rows].sort((a, b) => b.rng - a.rng)[0].tag);
if (M.question?.id === 'evmaxwhich') {
  const okv = byAbs[0].tag === M.question.answer_value;
  console.log(`\n매니페스트 정답 "${M.question.answer_value}" · 재계산 1위 "${byAbs[0].tag}" → ${okv ? '일치' : '불일치'}`);
  if (!okv) process.exit(1);
}
