// verify-shorts.mjs
// 주간 쇼츠 회차의 수치를 원본에서 다시 뽑아 매니페스트와 대조한다.
//
// 이 스크립트는 "만든 값을 다시 읽는" 것이 아니라 **원본 데이터를 새로 받아 독립적으로
// 재계산**한다. 만든 세션의 중간 산출물(us5m_*.json, events_collapsed.json 등)은 쓰지 않는다.
// ROUTINE_COMMON.md §3 이 요구하는 독립 검증의 기계 검사 부분이다.
//
// 사용법: node scripts/weekly-shorts/verify-shorts.mjs <manifest.json> [--srt <dir>]
//   예)   node scripts/weekly-shorts/verify-shorts.mjs content/weekly-shorts/2026-08-31.json \
//              --srt docs/samples/weekly-shorts/v7-test-video
//
// 종료코드 0 = 전부 통과, 1 = 하나라도 불일치(발행 금지).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// node 의 전역 fetch 는 HTTPS_PROXY 환경변수를 스스로 타지 않는다. 그대로 두면 에이전트
// 프록시를 건너뛰고 방화벽에 직접 부딪혀 "Host not in allowlist" 403 이 돌아온다 —
// 허용 목록과는 아무 상관이 없는 오류다. (2026-09-08 에 이걸 허용 목록 문제로 오진했다.)
// NODE_USE_ENV_PROXY 는 시작 전에 정해져야 하므로, 없으면 그 값을 켜고 자기 자신을 다시 띄운다.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && process.env.NODE_USE_ENV_PROXY !== '1') {
  const r = spawnSync(process.execPath, [process.argv[1], ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
}

const argv = process.argv.slice(2);
const manifestPath = argv.find((a) => !a.startsWith('--'));
if (!manifestPath) {
  console.error('Usage: node scripts/weekly-shorts/verify-shorts.mjs <manifest.json> [--srt <dir>]');
  process.exit(1);
}
const srtDirIdx = argv.indexOf('--srt');
const srtDir = srtDirIdx >= 0 ? argv[srtDirIdx + 1] : null;
const M = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
let fails = 0, passes = 0;
const ok = (label, got, want) => { passes++; console.log(`  ✅ ${label}: ${got}`); };
const bad = (label, got, want) => { fails++; console.log(`  ❌ ${label}: 매니페스트 ${want} · 재계산 ${got}`); };
const cmp = (label, got, want, tol = 0) => {
  const same = typeof want === 'number' ? Math.abs(got - want) <= tol : String(got) === String(want);
  // 오차 범위로 통과했는데 값이 다르면 그 사실을 숨기지 않는다.
  // 예전에는 주간 최고 29705(재계산) vs 29704(매니페스트)가 ✅ 뒤에 가려졌다.
  if (same && String(got) !== String(want)) ok(`${label} (오차 내)`, `${got} · 매니페스트 ${want}`);
  else if (same) ok(label, got);
  else bad(label, got, want);
  return same;
};

// ── 1. 5분봉 원본을 새로 받는다 ───────────────────────────────────────────────
console.log(`\n[1] 5분봉 원본 재수집 — ${M.window.symbol} ${M.window.interval}`);
const ET_OFFSET = -4 * 3600; // 미 동부 서머타임(EDT). 11월 첫 일요일 이후 회차는 -5 로 바꾼다.
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(M.window.symbol)}?interval=${M.window.interval}&range=1mo`;
let BARS;
try {
  const j = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  const res = j.chart?.result?.[0];
  if (!res) throw new Error('야후 응답에 chart.result 가 없다');
  const ts = res.timestamp, q = res.indicators.quote[0];
  BARS = ts.map((t, i) => ({
    d: new Date((t + ET_OFFSET) * 1000).toISOString().slice(0, 16).replace('T', ' '),
    o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i],
  })).filter((x) => x.c != null && x.d >= M.window.from_et && x.d <= M.window.to_et);
} catch (e) {
  console.log(`  ❌ 원본 수집 실패: ${e.message}`);
  console.log('     야후 5분봉은 약 1개월치만 준다. 회차가 그보다 오래됐으면 이 검사는 불가능하다.');
  process.exit(1);
}

// ── 2. 봉 개수·주간 등락률·최대낙폭을 독립 재계산 ─────────────────────────────
console.log(`\n[2] 기본 수치 재계산`);
cmp('봉 개수', BARS.length, M.numbers.bars);
cmp('변화 개수', BARS.length - 1, M.numbers.changes);
cmp('주간 등락률(%)', +((BARS.at(-1).c / BARS[0].o - 1) * 100).toFixed(2), M.numbers.week_pct, 0.01);

let peak = -Infinity, peakIdx = 0, mdd = 0, mp = 0, mt = 0;
BARS.forEach((b, i) => {
  if (b.h > peak) { peak = b.h; peakIdx = i; }
  const dd = b.l / peak - 1;
  if (dd < mdd) { mdd = dd; mp = peakIdx; mt = i; }
});
cmp('최대낙폭(%)', +(mdd * 100).toFixed(2), M.numbers.mdd_pct, 0.01);
cmp('낙폭 시작 고점', Math.round(BARS[mp].h), M.numbers.peak, 1);
cmp('낙폭 바닥 저점', Math.round(BARS[mt].l), M.numbers.trough, 1);
cmp('주간 최고', Math.round(Math.max(...BARS.map((b) => b.h))), M.numbers.week_high, 1);
cmp('주간 최저', Math.round(Math.min(...BARS.map((b) => b.l))), M.numbers.week_low, 1);

// 불변식: 정답 보기와 실제 낙폭이 어긋나면 퀴즈가 거짓말이 된다
const answer = M.quiz.options[M.quiz.answer_index - 1];
const answerNum = parseFloat(answer);
if (Math.abs(answerNum - M.numbers.mdd_pct) <= 0.1) ok('퀴즈 정답 보기', `${answer} ≈ ${M.numbers.mdd_pct}%`);
else bad('퀴즈 정답 보기', `${answer}`, `${M.numbers.mdd_pct}% 에 가장 가까운 보기`);

// ── 3. 사건별 등락률·순위를 독립 재계산 ──────────────────────────────────────
console.log(`\n[3] 사건별 반응 재계산`);
const chg = [];
for (let i = 1; i < BARS.length; i++) chg.push({ d: BARS[i].d, pct: (BARS[i].c / BARS[i - 1].c - 1) * 100 });
const ranked = [...chg].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
const rank = new Map(ranked.map((x, i) => [x.d, i + 1]));
const byD = new Map(chg.map((x) => [x.d, x.pct]));
for (const e of M.events) {
  if (!byD.has(e.et)) { bad(`사건${e.n} 봉 존재`, '없음', e.et); continue; }
  cmp(`사건${e.n} 등락률(%)`, +byD.get(e.et).toFixed(3), e.pct, 0.001);
  cmp(`사건${e.n} 순위`, rank.get(e.et), e.rank);
  // 사건 색은 그 봉의 반응을 따른다 — |등락률| 0.05% 미만이면 노랑(hi), 상승이면 초록(up),
  // 하락이면 빨강(down). 2회차에서 +0.19% 짜리 사건이 노랑으로 나갈 뻔했는데 검사 항목이
  // 없어 49건 통과가 그걸 잡지 못했다. 그래서 여기에 넣는다.
  const p0 = byD.get(e.et);
  const want = Math.abs(p0) < 0.05 ? 'hi' : (p0 > 0 ? 'up' : 'down');
  cmp(`사건${e.n} 색`, want, e.color);
}

// 규칙 검사: 요일당 최소 1개
console.log(`\n[4] 사건 선정 규칙`);
const days = new Set(M.events.map((e) => e.et.slice(0, 10)));
const winDays = new Set(BARS.map((b) => b.d.slice(0, 10)).filter((d) => {
  return BARS.some((b) => b.d.startsWith(d) && b.d.slice(11) >= '09:30' && b.d.slice(11) <= '16:00');
}));
cmp('사건이 있는 요일 수', days.size, winDays.size);
// 규칙: 「같은 조건이면 장중 우선」은 동점일 때의 우선순위지 필수 조건이 아니다.
// 그날 후보가 하나뿐이면 프리장이어도 정당하다. 그래서 실패가 아니라 확인 항목으로 남기고,
// 장 밖 사건에는 매니페스트에 사유(session_exception)를 적어 두게 한다.
for (const e of M.events) {
  const hhmm = e.et.slice(11);
  if (hhmm >= '09:30' && hhmm <= '16:00') { ok(`사건${e.n} 장중 발표`, hhmm); continue; }
  if (e.session_exception) ok(`사건${e.n} 장 밖 발표(사유 있음)`, `${hhmm} — ${e.session_exception}`);
  else bad(`사건${e.n} 장 밖 발표`, `${hhmm} · 사유 없음`, 'session_exception 에 그날 후보가 하나뿐인 이유를 적어라');
}

// ── 5. 트레이딩이코노믹스 캘린더로 별표·실제값·예상값 대조 ────────────────────
console.log(`\n[5] 트레이딩이코노믹스 캘린더 대조`);
const d1 = M.window.from_et.slice(0, 10), d2 = M.window.to_et.slice(0, 10);
try {
  const resp = await fetch(`https://tradingeconomics.com/united-states/calendar?d1=${d1}&d2=${d2}`,
    { headers: { 'User-Agent': UA } });
  let html = await resp.text();
  if (!resp.ok || /Host not in allowlist/.test(html)) {
    throw new Error(`BLOCKED:${resp.status} ${html.slice(0, 120)}`);
  }
  // 사이트가 대상 주를 안 주면(지난 주는 GET 으로 못 받는다) 제작 시점에 받아 둔 스냅샷을 쓴다.
  // 스냅샷은 사이트가 준 원본 HTML 이지 우리가 만든 값이 아니다. 다만 실시간 재조회보다
  // 증거력이 약하므로 그 사실을 반드시 화면에 남긴다.
  if (!new RegExp(`class='\\s*${d1}'`).test(html) && M.calendar_snapshot && fs.existsSync(M.calendar_snapshot)) {
    html = fs.readFileSync(M.calendar_snapshot, 'utf8');
    console.log(`  ⚠ 사이트가 대상 주를 주지 않아 제작 시점 스냅샷으로 대조한다 — ${M.calendar_snapshot}`);
  }
  const rows = html.split(/<tr\s+data-url=/).slice(1);
  const table = new Map();
  let outOfRange = 0;
  for (const r0 of rows) {
    const r = r0.replace(/\s+/g, ' ');
    const name = (r.match(/data-event="([^"]*)"/) || [])[1];
    const imp = (r.match(/calendar-date-(\d)/) || [])[1];
    const day = (r.match(/class='\s*(\d{4}-\d{2}-\d{2})'/) || [])[1];
    if (!name || !imp) continue;
    // 트레이딩이코노믹스는 GET 의 d1/d2 를 무시하고 현재 주를 돌려줄 때가 있다.
    // 행에 찍힌 날짜를 확인하지 않으면 다른 주의 값과 대조하게 된다 — 실제로 그런 적이 있다.
    if (!day || day < d1 || day > d2) { outOfRange++; continue; }
    const get = (id) => { const m = r.match(new RegExp(`id='${id}'[^>]*>([^<]*)<`)); return m ? m[1].trim() : ''; };
    table.set(name, { stars: +imp, actual: get('actual'), previous: get('previous'), consensus: get('consensus') });
  }
  if (table.size === 0) {
    throw new Error(outOfRange > 0
      ? `RANGE:대상 주(${d1}~${d2}) 행이 하나도 없다. 받은 ${outOfRange}건은 전부 다른 날짜다`
      : '캘린더 행을 하나도 파싱하지 못했다 (페이지 구조 변경 의심)');
  }
  console.log(`  · 캘린더 ${table.size}건 파싱`);
  for (const e of M.events) {
    const row = table.get(e.te_event);
    if (!row) { bad(`사건${e.n} 캘린더 항목`, '없음', e.te_event); continue; }
    cmp(`사건${e.n} 별표`, row.stars, e.stars);
    cmp(`사건${e.n} 실제값`, row.actual, e.actual);
    cmp(`사건${e.n} ${e.compare_field}`, row[e.compare_field], e.compare);
  }
} catch (err) {
  fails++;
  if (err.message.startsWith('RANGE:')) {
    console.log(`  ⛔ ${err.message.slice(6)}`);
    console.log('     트레이딩이코노믹스는 지난 주 구간을 GET 으로 주지 않는다(항상 현재 주부터 돌려준다).');
    console.log('     → 캘린더 HTML 은 그 주가 끝난 직후 제작 단계에서 받아 두고,');
    console.log('        검증은 지표별 페이지(예: /united-states/non-manufacturing-pmi)에서 확인한다.');
    console.log('     대조하지 못한 항목은 통과가 아니다.');
  } else if (err.message.startsWith('BLOCKED:')) {
    console.log(`  ⛔ 캘린더에 접속하지 못했다 — ${err.message.slice(8)}`);
    console.log('     이 세션의 네트워크 허용 목록에 tradingeconomics.com 이 없다.');
    console.log('     클로드 환경 편집 > 접속 가능 사이트에 추가해야 별표·실제값·예상값을 대조할 수 있다.');
    console.log('     대조하지 못한 항목은 통과가 아니다. 사람이 캘린더를 직접 열어 확인하거나');
    console.log('     허용 목록을 고친 뒤 다시 돌린다.');
  } else {
    console.log(`  ❌ 캘린더 대조 실패: ${err.message}`);
  }
}

// ── 6. 화면 문구가 그 숫자를 실제로 담고 있는지 ──────────────────────────────
console.log(`\n[6] 화면 문구와 숫자 일치`);
// 캘린더는 162K·7.271M 로, 화면은 16.2만·727만 으로 쓴다. 같은 값인지 보려면 단위를 맞춰야 한다.
const toNum = (raw) => {
  const m = String(raw).match(/(-?[\d.,]+)\s*([KMB만억%]?)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(v)) return null;
  const mul = { K: 1e3, M: 1e6, B: 1e9, '만': 1e4, '억': 1e8 }[m[2]] || 1;
  return v * mul;
};
const near = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(Math.abs(b) * 0.005, 1e-9);
const lineHas = (line, want) => {
  const w = toNum(want);
  for (const tok of line.match(/-?[\d.,]+\s*[KMB만억]?/g) || []) if (near(toNum(tok), w)) return true;
  return false;
};
for (const e of M.events) {
  lineHas(e.l1, e.actual) ? ok(`사건${e.n} 첫 줄에 실제값`, `${e.l1} ← ${e.actual}`)
                          : bad(`사건${e.n} 첫 줄에 실제값`, e.l1, e.actual);
  lineHas(e.l2, e.compare) ? ok(`사건${e.n} 둘째 줄에 비교값`, `${e.l2} ← ${e.compare}`)
                           : bad(`사건${e.n} 둘째 줄에 비교값`, e.l2, e.compare);
}

// ── 7. 영상 타임라인 산술 ────────────────────────────────────────────────────
console.log(`\n[7] 타임라인 산술`);
const S = M.video.sections, order = ['hook', 'replay', 'answer', 'summ'];
let contiguous = true;
for (let i = 1; i < order.length; i++) if (S[order[i]][0] !== S[order[i - 1]][1]) contiguous = false;
contiguous ? ok('구간 연속', order.map((k) => S[k].join('~')).join(' ')) : bad('구간 연속', '끊김', '앞 구간 끝 = 뒤 구간 시작');
cmp('전체 길이', S.summ[1], M.video.duration, 0.001);
// 예전 검사는 (a-b)-((a-b)-c) === c 라는 항등식이라 무엇도 검증하지 않았다.
// 이제 scene.js 에 박힌 실제 상수를 읽어 매니페스트와 대조한다.
const sceneCandidates = [
  process.env.SCENE_JS,
  srtDir && path.join(srtDir, 'scene.js'),
].filter(Boolean).filter((f) => fs.existsSync(f));
if (sceneCandidates.length === 0) {
  console.log('  ⛔ scene.js 를 못 찾아 훅 정지 시간을 대조하지 못했다 (SCENE_JS 로 경로를 주면 된다)');
  fails++;
} else {
  const src = fs.readFileSync(sceneCandidates[0], 'utf8');
  const hh = src.match(/const\s+HOOK_HOLD\s*=\s*([\d.]+)/);
  const hk = src.match(/const\s+HOOK\s*=\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/);
  hh ? cmp('훅 정지 시간(scene.js)', +hh[1], M.video.hook_hold, 0.001)
     : bad('훅 정지 시간', 'HOOK_HOLD 상수를 못 찾음', M.video.hook_hold);
  if (hk) cmp('훅 구간(scene.js)', `${+hk[1]}~${+hk[2]}`, `${S.hook[0]}~${S.hook[1]}`);
}
const replayTotal = S.replay[1] - S.replay[0];
const drawT = replayTotal - M.video.hold * M.events.length;
drawT > 0 ? ok('되감기 그리기 시간', `${drawT.toFixed(2)}초`) : bad('되감기 그리기 시간', `${drawT.toFixed(2)}초`, '0보다 커야 한다');

// ── 8. 자막 구간이 사건 정지 시각과 맞는지 ───────────────────────────────────
if (srtDir) {
  console.log(`\n[8] 자막 구간 대조`);
  const idxOf = (et) => BARS.findIndex((b) => b.d === et);
  const N = BARS.length - 1;
  const holds = []; let prev = 0, t = 0;
  for (const e of M.events) { const i = idxOf(e.et); t += (i - prev) / N * drawT; holds.push(S.replay[0] + t); t += M.video.hold; prev = i; }
  const want = [S.hook[0], S.hook[1], ...holds.slice(1), S.answer[0], S.summ[0], S.summ[1]];
  for (const f of fs.readdirSync(srtDir).filter((f) => f.endsWith('.srt'))) {
    const body = fs.readFileSync(path.join(srtDir, f), 'utf8');
    const cues = [...body.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
    if (cues.length !== want.length - 1) { bad(`${f} 자막 개수`, cues.length, want.length - 1); continue; }
    let allOk = true;
    cues.forEach((m, i) => {
      const st = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
      const en = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
      if (Math.abs(st - want[i]) > 0.05 || Math.abs(en - want[i + 1]) > 0.05) allOk = false;
    });
    allOk ? ok(`${f} 구간`, `${cues.length}개 모두 사건 정지 시각과 일치`)
          : bad(`${f} 구간`, '어긋남', want.map((x) => x.toFixed(2)).join(' / '));
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(fails === 0 ? `✅ 전부 통과 (${passes}건)` : `❌ ${fails}건 불일치 / ${passes}건 통과 — 발행 금지`);
process.exit(fails === 0 ? 0 : 1);
