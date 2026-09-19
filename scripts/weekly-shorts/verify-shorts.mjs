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
const warn = (label, msg) => { console.log(`  ⚠ ${label}: ${msg}`); };
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

// ── 1-1. 월물 교체(롤오버)가 구간 안에 섞였는지 ─────────────────────────────
// 야후의 연속 심볼 `NQ=F` 는 만기가 다가오면 다음 월물로 갈아탄다. 그 순간 가격이
// 월물 간 가격차만큼 통째로 뛰는데, 캔들만 보면 시장이 움직인 것과 구별되지 않는다.
// 2026-09-14 11:30(동부)에 실제로 +1.295% 짜리 봉이 찍혔고, 그게 그 주 5분 변동
// 1위였다. 같은 시각 QQQ 는 +0.286% 였다 — 시장이 아니라 데이터가 움직인 것이다.
// 그대로 갔으면 "그 주 가장 큰 움직임"이 통째로 허구인 회차가 나갈 뻔했다.
//
// 막는 법: 지수 ETF(QQQ)와의 배율을 본다. 같은 지수를 따라가므로 배율은 하루에
// 0.05% 도 안 움직인다. 한 봉에 0.3% 이상 튀면 그건 시장이 아니라 월물 교체다.
console.log(`\n[1-1] 월물 교체 혼입 검사 (QQQ 대조)`);
try {
  const qurl = `https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=${M.window.interval}&range=1mo`;
  const qj = await (await fetch(qurl, { headers: { 'User-Agent': UA } })).json();
  const qres = qj.chart?.result?.[0];
  if (!qres) throw new Error('QQQ 응답에 chart.result 가 없다');
  const QC = new Map();
  qres.timestamp.forEach((t, i) => {
    const c = qres.indicators.quote[0].close[i];
    if (c != null) QC.set(new Date((t + ET_OFFSET) * 1000).toISOString().slice(0, 16).replace('T', ' '), c);
  });
  const pairs = BARS.filter((b) => QC.has(b.d)).map((b) => ({ d: b.d, r: b.c / QC.get(b.d) }));
  if (pairs.length < 50) {
    warn('월물 교체 검사', `QQQ 와 겹치는 봉이 ${pairs.length}개뿐이라 판정하지 않는다`);
  } else {
    let worst = { j: 0, d: '' };
    for (let i = 1; i < pairs.length; i++) {
      const j = Math.abs(pairs[i].r / pairs[i - 1].r - 1);
      if (j > worst.j) worst = { j, d: pairs[i].d };
    }
    if (worst.j > 0.003) {
      bad('월물 교체 혼입', '한 봉에 0.3% 미만', `${worst.d} 에 배율이 ${(worst.j * 100).toFixed(2)}% 튀었다 — 월물 교체로 보인다. 연속 심볼(NQ=F) 대신 그 주의 실제 월물(예: NQZ26.CME)로 다시 받아라`);
    } else {
      ok('월물 교체 혼입', `없음 (배율 최대 변동 ${(worst.j * 100).toFixed(3)}% @${worst.d})`);
    }
  }
} catch (e) {
  console.log(`  ⛔ QQQ 대조 실패 — ${e.message}`);
  console.log('     이 검사를 못 했으면 통과가 아니라 미검증이다. 월물 교체가 섞였는지 사람이 직접 확인한다.');
  fails++;
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

// 불변식: 정답 보기와 실제 값이 어긋나면 퀴즈가 거짓말이 된다.
// 회차마다 질문이 다르므로(1·2회차처럼 매번 최대 낙폭을 묻지 않는다) 질문 은행에서
// 그 회차 질문을 찾아 원본 봉으로 다시 계산해 맞춘다.
const answer = M.quiz.options[M.quiz.answer_index - 1];
const answerNum = parseFloat(answer);
if (M.question) {
  const { QUESTIONS, buildCtx } = await import('./questions.mjs');
  const Q = QUESTIONS.find((q) => q.id === M.question.id);
  if (!Q) bad('질문 은행', M.question.id, '은행에 없는 id');
  else {
    let got; try { got = Q.fn(buildCtx(BARS, [], M.events)); } catch (e) { got = null; }
    if (got === null) bad('질문 재계산', '계산 실패', M.question.id);
    else {
      cmp('질문 답 재계산', typeof got === 'number' ? +got.toFixed(2) : got,
          typeof M.question.answer_value === 'number' ? +M.question.answer_value.toFixed(2) : M.question.answer_value, 0.01);
      if (typeof M.question.answer_value === 'string') {
        // 고르는 형 질문은 정답 보기가 그 답을 담고 있어야 한다
        if (answer.includes(M.question.answer_value)) ok('퀴즈 정답 보기', `${answer} ⊇ ${M.question.answer_value}`);
        else bad('퀴즈 정답 보기', answer, `"${M.question.answer_value}" 를 담은 보기`);
      } else if (Number.isFinite(answerNum) && Number.isFinite(+M.question.answer_value)) {
        if (Math.abs(answerNum - +M.question.answer_value) <= 0.51)
          ok('퀴즈 정답 보기', `${answer} ≈ ${M.question.answer_value}${M.question.unit || ''}`);
        else bad('퀴즈 정답 보기', answer, `${M.question.answer_value}${M.question.unit || ''}`);
      }
    }
    // 자명한 질문을 거르는 근거가 적혀 있는지 본다. 2회차에서 "바닥도 꼭대기도 한국 밤에
    // 나왔다"(미국 정규장 = 한국 밤이라 정의상 참)를 발견인 양 쓸 뻔했다.
    if (M.question.guard && M.question.guard.length > 20) ok('질문 자명성 근거', '적혀 있음');
    else bad('질문 자명성 근거', '없음', '이 질문의 답이 미리 정해져 있지 않은 이유');
    // guard 에 적은 분포 수치가 맞는지는 문자열 길이로는 알 수 없다. 과거 봉을 주면 다시 센다.
    const histIdx = argv.indexOf('--hist');
    if (M.question.dist && histIdx >= 0) {
      const D = M.question.dist;
      const HB = JSON.parse(fs.readFileSync(argv[histIdx + 1], 'utf8'));
      const wk = new Map();
      for (const b0 of HB) {
        const dd = new Date(b0.d.slice(0, 10) + 'T00:00:00Z'), dw = dd.getUTCDay();
        if (dw === 0 || dw === 6) continue;
        const mo = new Date(dd); mo.setUTCDate(dd.getUTCDate() - (dw - 1));
        const k = mo.toISOString().slice(0, 10);
        if (!wk.has(k)) wk.set(k, []); wk.get(k).push(b0);
      }
      const RQ = QUESTIONS.find((q) => q.id === (D.ref_id || M.question.id));
      const vs = [...wk.values()].filter((v) => v.length >= 40).map((v) => RQ.fn(buildCtx(v, []))).sort((x, y) => x - y);
      const qq = (p) => vs[Math.floor(vs.length * p)];
      cmp('분포 표본 수', vs.length, D.n);
      cmp('분포 중앙값', +qq(0.5).toFixed(1), D.median, 0.2);
      cmp('분포 10%', +qq(0.1).toFixed(1), D.p10, 0.2);
      cmp('분포 90%', +qq(0.9).toFixed(1), D.p90, 0.2);
      if (D.zero_weeks !== undefined) cmp('0 인 주 수', vs.filter((v) => v === 0).length, D.zero_weeks);
    } else if (M.question.dist) {
      warn('분포 주장 재계산', '--hist <시간봉json> 을 주면 다시 센다');
    }
  }
} else if (Math.abs(answerNum - M.numbers.mdd_pct) <= 0.1) ok('퀴즈 정답 보기', `${answer} ≈ ${M.numbers.mdd_pct}%`);
else bad('퀴즈 정답 보기', `${answer}`, `${M.numbers.mdd_pct}% 에 가장 가까운 보기`);

// 영어 줄은 26px 까지 줄여도 가로 968px 안에 들어와야 한다. 넘치면 말없이 잘린다.
// 2회차에서 88자짜리 훅이 "…above the ope…" 로 잘린 채 표지에까지 들어갔다.
// 글자 폭을 여기서 정확히 잴 수는 없으니 글자 수로 막는다(26px 기준 약 74자가 한계).
const EN_MAX = 72;
console.log(`\n[2-2] 영어 줄 길이(최대 ${EN_MAX}자)`);
for (const e of M.events) {
  if (!e.en) continue;
  if (e.en.length <= EN_MAX) ok(`사건${e.n} 영어 줄`, `${e.en.length}자`);
  else bad(`사건${e.n} 영어 줄`, `${e.en.length}자`, `${EN_MAX}자 이하`);
}

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

// ── 3-1. 훑었다는 기록이 있는지 (지침서 4-1 확인 목록) ─────────────────────
// 이 검사만 «만든 것» 이 아니라 «안 만든 것» 을 본다. 나머지 검사는 매니페스트에
// 적힌 사건을 대조할 뿐이라, 애초에 후보로 올리지 않은 것은 영원히 안 걸린다.
// 3회차 준비에서 경제 캘린더만 보고 기업 실적과 뉴스를 확인하지 않은 채
// «규칙대로 골랐다» 고 보고했다. 지침서 4장에서 그 두 규칙이 빠져 있었고,
// 빠진 걸 아무도 못 봤다. 훑었다는 사실 자체를 적게 하고, 없으면 막는다.
console.log(`\n[3-1] 확인 목록 (지침서 4-1)`);
{
  const need = {
    econ_calendar: '경제 캘린더 — 스냅샷 경로와 파싱한 행 수',
    earnings: '기업 실적 — 그 주 발표한 나스닥100 종목. 없으면 «없음» 과 확인 경로',
    news_scan: '뉴스 — 5분 변동 상위 10개를 훑은 결과',
    data_crosscheck: '주가 대조 — 어느 두 소스와 맞춰 봤는지',
  };
  const cov = M.coverage || {};
  for (const [k, what] of Object.entries(need)) {
    const v = cov[k];
    if (!v || String(v).trim().length < 10) bad(`확인 목록 ${k}`, what, v ? `너무 짧다: ${v}` : '없음');
    else ok(`확인 목록 ${k}`, String(v).slice(0, 60) + (String(v).length > 60 ? '…' : ''));
  }
  // 뉴스 훑기는 상위 10개를 실제로 다뤘는지까지 본다
  const ns = String(cov.news_scan || '');
  const hit = (ns.match(/\d{2}-\d{2} \d{2}:\d{2}/g) || []).length;
  if (cov.news_scan && hit < 10) bad('확인 목록 news_scan 항목 수', '상위 10개 시각을 각각 적어라 (MM-DD HH:MM)', `${hit}개만 적혀 있다`);
  else if (cov.news_scan) ok('확인 목록 news_scan 항목 수', `${hit}개 시각`);
}

// ── 3-2. 요약 표가 범위를 속이지 않는가 ────────────────────────────────────
// 요약 화면의 1~3위는 «고른 사건» 중 순위다. 그 주 5분봉 전체의 순위가 아니다.
// 2회차는 영어 줄이 «The three biggest reactions of the week» 이었고 그 표의
// 실제 주간 순위는 1·6·17위였다 — 틀린 채로 발행됐다. 3회차도 같은 줄이었고
// 3위 금리 결정은 주 전체로는 53위였다. 더구나 2.1초 앞 정답 화면이 같은 사건을
// 두고 «1,178개 중 3위» 라고 말해 두 화면이 서로 어긋났다.
// 주간 순위가 1,2,3 이 아니면 머리말이 «그 주 최대» 라고 주장해선 안 된다.
console.log(`\n[3-2] 요약 표 범위`);
{
  const S = M.summary;
  if (!S) bad('요약 표 범위', 'summary 블록에 범위와 머리말을 적어라', '없음');
  else {
    const want = [...M.events].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3);
    const same = S.rows && S.rows.length === 3 && S.rows.every((r, k) => r.tag === want[k].tag && Math.abs(r.pct - want[k].pct) < 1e-9);
    same ? ok('요약 표 행', S.rows.map((r) => `${r.tag} ${r.pct >= 0 ? '+' : ''}${r.pct}%`).join(' / '))
         : bad('요약 표 행', want.map((e) => `${e.tag} ${e.pct}%`).join(' / '), (S.rows || []).map((r) => `${r.tag} ${r.pct}%`).join(' / '));
    S.rows && S.rows.forEach((r, k) => cmp(`요약 ${k + 1}위 주간 순위`, want[k] ? want[k].rank : '없음', r.week_rank));
    const weekTrue = S.rows && S.rows.every((r, k) => r.week_rank === k + 1);
    const claim = /of the week|week'?s (three )?biggest|그\s*주 (전체|최대)|이번\s*주 (전체|최대)/i;
    const heads = [S.ko || '', S.en || ''].join(' | ');
    if (!weekTrue && claim.test(heads)) {
      bad('요약 머리말 범위', `주간 순위가 ${S.rows.map((r) => r.week_rank).join('·')} 위다 — 머리말이 그 주 전체를 주장하면 안 된다`, heads);
    } else if (!S.ko || !S.en) {
      bad('요약 머리말 범위', 'ko·en 머리말을 둘 다 적어라', heads);
    } else {
      ok('요약 머리말 범위', `${S.ko} / ${S.en}`);
    }
  }
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
let CAL = null;   // 캘린더 파싱 결과 (6장에서 재사용)
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
  CAL = table;   // 아래 6장에서 «값이 없는 사건» 을 캘린더로 확인할 때 쓴다
  const all = [];
  let outOfRange = 0;
  for (const r0 of rows) {
    const r = r0.replace(/\s+/g, ' ');
    const name = (r.match(/data-event="([^"]*)"/) || [])[1];
    const imp = (r.match(/calendar-date-(\d)/) || [])[1];
    const day = (r.match(/class='\s*(\d{4}-\d{2}-\d{2})'/) || [])[1];
    // 캘린더가 찍는 시각은 협정세계시다(동부 08:30 → 12:30 PM). 같은 시각에 걸린
    // 지표들을 한 사건으로 묶으려면 이 값이 필요하다.
    const tm = (r.match(/calendar-date-\d"?>\s*([\d:]+\s*[AP]M)/) || [])[1];
    if (!name || !imp) continue;
    // 트레이딩이코노믹스는 GET 의 d1/d2 를 무시하고 현재 주를 돌려줄 때가 있다.
    // 행에 찍힌 날짜를 확인하지 않으면 다른 주의 값과 대조하게 된다 — 실제로 그런 적이 있다.
    if (!day || day < d1 || day > d2) { outOfRange++; continue; }
    const get = (id) => { const m = r.match(new RegExp(`id='${id}'[^>]*>([^<]*)<`)); return m ? m[1].trim() : ''; };
    const rec = { name, day, at: tm ? `${day} ${tm}` : '', stars: +imp,
      actual: get('actual'), previous: get('previous'), consensus: get('consensus') };
    table.set(name, rec);
    all.push(rec);
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
    // 기자회견·연설은 발표값이 없어 비교 필드도 비어 있다. 6장에서 캘린더가 정말로
    // 비어 있는지 따로 확인하므로 여기서는 건너뛴다.
    if (e.compare_field) cmp(`사건${e.n} ${e.compare_field}`, row[e.compare_field], e.compare);
    else ok(`사건${e.n} 비교값`, '발표값 없는 사건 — 6장에서 확인');
  }

  // ── 5-1. 같은 시각에 여러 지표가 걸렸을 때 대표를 제대로 골랐는지 ──────────
  // 지침서 4장 3번. 최고 등급이 여럿이면 예상을 벗어난 것을 대표로 쓴다.
  // 2회차 금요일 협정세계시 12:30 에 ★★★ 네 건이 동시에 걸렸고 그중 예상을
  // 벗어난 건 근원 소비자물가 전월비 하나뿐이었다. 그때는 규칙이 없어 제작자
  // 판단으로 골랐다 — 다음 회차에서 달라지지 않도록 기계가 본다.
  const num = (v) => { const m = String(v).match(/-?[\d.]+/); return m ? parseFloat(m[0]) : null; };
  for (const e of M.events) {
    const row = table.get(e.te_event);
    if (!row || !row.at) continue;
    const group = all.filter((r) => r.at === row.at);
    const maxStars = Math.max(...group.map((r) => r.stars));
    if (row.stars < maxStars) {
      bad(`사건${e.n} 대표 등급`, `같은 시각 최고 등급은 ★${maxStars}`, `★${row.stars}`);
      continue;
    }
    const top = group.filter((r) => r.stars === maxStars);
    if (top.length === 1) { ok(`사건${e.n} 같은 시각 묶음`, `★${maxStars} 단독`); continue; }
    const missed = top.filter((r) => r.consensus && r.actual && r.actual !== r.consensus);
    if (missed.length > 0) {
      if (!missed.some((r) => r.name === e.te_event)) {
        bad(`사건${e.n} 대표 선정`, `예상을 벗어난 ${missed.map((r) => r.name).join(' / ')} 중에서 골라야 한다`,
          `${e.te_event}(예상대로 나옴)`);
        continue;
      }
      if (missed.length > 1 && !e.tiebreak) {
        bad(`사건${e.n} 타이브레이크 사유`, `예상을 벗어난 게 ${missed.length}건이다 — tiebreak 에 고른 근거를 적어라`,
          '없음');
        continue;
      }
      ok(`사건${e.n} 대표 선정`, `★${maxStars} ${top.length}건 중 예상을 벗어난 ${missed.length}건 — 대표 맞음`);
    } else {
      // 예상을 벗어난 게 하나도 없다(전부 예상과 같거나, 국채 입찰처럼 애초에 예상치가 없다).
      // 이때는 직전값에서 가장 많이 움직인 것을 대표로 쓴다.
      const why0 = top.every((r) => !r.consensus) ? '예상치 없음' : '전부 예상대로';
      // 단위가 서로 다르면(% 와 만 채) 움직인 정도를 비교할 수 없다. 사람이 고르고 사유를 적는다.
      const unit = (v) => (String(v).match(/[%KMB]|만|억/) || [''])[0];
      const units = new Set(top.map((r) => unit(r.actual)));
      if (units.size > 1) {
        if (!e.tiebreak) { bad(`사건${e.n} 대표 선정`, `단위가 다른 ★${maxStars} ${top.length}건이라 tiebreak 에 사람이 고른 근거가 있어야 한다`, '사유 없음'); continue; }
        ok(`사건${e.n} 대표 선정`, `단위가 달라 기계 비교 불가 — tiebreak 사유로 확인`);
      } else {
        const moved = top.map((r) => ({ r, d: Math.abs((num(r.actual) ?? 0) - (num(r.previous) ?? 0)) }));
        const best = moved.reduce((a, b) => (b.d > a.d ? b : a));
        // 동률이면 규칙으로 못 가른다. 0.17000000000000037 과 0.17000000000000015 의
        // 차이로 승자를 정하면 안 된다 — 사람이 고르고 사유를 남긴 것을 인정한다.
        const tied = moved.filter((x) => Math.abs(x.d - best.d) < 1e-9);
        if (tied.length > 1) {
          if (!e.tiebreak) { bad(`사건${e.n} 대표 선정`, `직전값 변동이 ${tied.length}건 동률(${best.d.toFixed(3)})이라 규칙으로 못 가른다 — tiebreak 에 사람이 고른 근거를 적어라`, '사유 없음'); continue; }
          if (!tied.some((x) => x.r.name === e.te_event)) {
            bad(`사건${e.n} 대표 선정`, `동률인 ${tied.map((x) => x.r.name).join(' / ')} 중에서 골라야 한다`, e.te_event); continue;
          }
          ok(`사건${e.n} 대표 선정`, `★${maxStars} ${top.length}건 ${why0} · 직전값 변동 ${best.d.toFixed(3)} 동률 — tiebreak 사유로 확인`);
        } else if (best.r.name !== e.te_event) {
          bad(`사건${e.n} 대표 선정`, `${why0} 이니 직전값에서 가장 많이 움직인 ${best.r.name} 를 써야 한다`,
            e.te_event);
          continue;
        } else {
          ok(`사건${e.n} 대표 선정`, `★${maxStars} ${top.length}건 ${why0} — 직전값 변동 최대 선택`);
        }
      }
    }
    if (!e.tiebreak) bad(`사건${e.n} 타이브레이크 사유`, '같은 시각 최고 등급이 여럿이면 tiebreak 를 적어라', '없음');
    else ok(`사건${e.n} 타이브레이크 사유`, e.tiebreak.slice(0, 40) + '…');
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
  // 기자회견·연설처럼 애초에 발표값이 없는 사건이 있다. 그런 사건은 숫자 대조를 할 수 없다.
  // 다만 «값이 없다» 를 매니페스트가 스스로 주장하게 두면 숫자 검사를 피하는 구멍이 된다.
  // 그래서 캘린더 원본에 정말로 실제값·예상값·직전값이 전부 비어 있는지 확인하고 넘어간다.
  if (!e.actual && !e.compare) {
    if (!e.no_value) { bad(`사건${e.n} 값 없음`, '실제값·비교값이 비어 있다', 'no_value 에 사유를 적어라'); continue; }
    const row = CAL && CAL.get(e.te_event);
    if (!row) { warn(`사건${e.n} 값 없음`, `캘린더로 확인하지 못했다 — ${e.no_value}`); continue; }
    if (row.actual || row.consensus || row.previous) {
      bad(`사건${e.n} 값 없음`, `캘린더에 값이 있다 (실 ${row.actual} / 예 ${row.consensus} / 직전 ${row.previous})`, '값이 있으면 화면에 적어라');
    } else {
      ok(`사건${e.n} 값 없음`, `캘린더도 비어 있다 — ${e.no_value}`);
    }
    continue;
  }
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
  // 사건이 화면에 머무는 시간을 고르게 맞추느라 정지 시간이 사건마다 다르다.
  // 그 배분은 매니페스트 video.holds 가 갖고 있다(mkmanifest 가 정한다).
  const HS = M.video.holds || M.events.map(() => M.video.hold);
  cmp('정지 시간 합계', +HS.reduce((a2, b2) => a2 + b2, 0).toFixed(2), +(M.video.hold * M.events.length).toFixed(2), 0.02);
  if (HS.some((h) => h < 0.6)) bad('정지 시간 바닥', Math.min(...HS), '0.6초 이상');
  else ok('정지 시간 바닥', `${Math.min(...HS).toFixed(2)}초`);
  const holds = []; let prev = 0, t = 0;
  M.events.forEach((e, k) => { const i = idxOf(e.et); t += (i - prev) / N * drawT; holds.push(S.replay[0] + t); t += HS[k]; prev = i; });
  // 사건 하나가 화면에 머무는 시간이 너무 짧으면 두 줄을 못 읽는다
  const shown = holds.map((h, k) => (k < holds.length - 1 ? holds[k + 1] : S.replay[1]) - h);
  const minShown = Math.min(...shown);
  if (minShown >= 2.4) ok('사건 노출 최소', `${minShown.toFixed(2)}초`);
  else bad('사건 노출 최소', `${minShown.toFixed(2)}초`, '2.4초 이상');
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

    // 구간(시각)만 보면 본문이 틀려도 통과한다. 3회차에서 슈미트 직함을 화면·매니페스트·
    // 발행문구에서 지웠는데 자막 생성기의 문자열 배열만 남아 «연준 슈미트 위원 연설» 이
    // 자막으로 나갈 뻔했고, 검사 111건이 전부 통과했다 — 본문을 안 봤기 때문이다.
    // 사건 자막 큐(훅 다음부터 사건 수만큼)가 매니페스트 문구를 담고 있는지 본다.
    const blocks = body.trim().split(/\n\s*\n/).map((b) => b.split('\n').slice(2).join(' '));
    const ko = /\.ko\./.test(f);
    let textOk = true, firstBad = '';
    M.events.forEach((e, k) => {
      const cue = blocks[k + 1] || '';
      const need = ko ? [e.l1, e.l2] : [e.en];
      for (const w of need) {
        // 자막은 끝의 마침표를 떼고, 영어는 쉼표로 두 줄로 나눈다 — 글자만 보고 비교한다
        const norm = (x) => String(x).replace(/[.,·\s]/g, '');
        if (!norm(cue).includes(norm(w))) { textOk = false; if (!firstBad) firstBad = `사건${e.n}: 자막 «${cue}» 에 «${w}» 가 없다`; }
      }
    });
    textOk ? ok(`${f} 본문`, `사건 ${M.events.length}개 문구가 매니페스트와 일치`)
           : bad(`${f} 본문`, '매니페스트 문구를 그대로 담아야 한다', firstBad);
  }

  // 커밋된 생성기가 커밋된 자막을 그대로 만들어 내는가.
  // 3회차에서 srt2.mjs 의 대문자화를 고치고 자막을 다시 안 뽑아, 코드와 산출물이
  // 갈린 채 커밋됐다. 파일만 보면 멀쩡하고 검사도 통과하지만, 다음 회차에 자막을
  // 다시 뽑는 순간 다른 글자가 나온다. 산출물이 재현되지 않으면 발행하지 않는다.
  const gen = path.join(srtDir, 'srt2.mjs');
  if (fs.existsSync(gen)) {
    const before = fs.readdirSync(srtDir).filter((f) => f.endsWith('.srt'))
      .map((f) => [f, fs.readFileSync(path.join(srtDir, f), 'utf8')]);
    const r = spawnSync(process.execPath, [gen], { encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) {
      bad('자막 생성기 재현', '종료코드 0', `실패: ${(r.stderr || '').trim().slice(0, 120)}`);
    } else {
      const diff = before.filter(([f, b]) => fs.readFileSync(path.join(srtDir, f), 'utf8') !== b);
      diff.length === 0
        ? ok('자막 생성기 재현', `${before.length}개 파일 바이트 일치`)
        : bad('자막 생성기 재현', '다시 돌리면 같은 자막이 나와야 한다', `${diff.map(([f]) => f).join(', ')} 가 달라진다 — 고친 뒤 자막을 다시 뽑아라`);
      // 검사 때문에 파일이 바뀌면 안 된다. 원래대로 되돌린다.
      before.forEach(([f, b]) => fs.writeFileSync(path.join(srtDir, f), b));
    }
  }
}

// ── [9] 고정 댓글 ────────────────────────────────────────────────────────────
// 1·2회차는 유튜브에 댓글 하나 없이 나갔다. 규칙이 없어서 빠진 것이지 판단해서
// 뺀 게 아니었다(지침서 8-1). 문구를 발행문구.md 에 두게 하고, 정답이 새는지
// 여기서 같이 본다. 문구를 API 호출에만 적으면 다음 회차에 또 빠진다.
if (srtDir) {
  console.log(`\n[9] 고정 댓글`);
  const docs = fs.readdirSync(srtDir).filter((f) => f.endsWith('.md'));
  if (docs.length === 0) {
    bad('발행문구 문서', `${srtDir} 안에 .md 한 개`, '문서를 못 찾았다');
  } else {
    const doc = fs.readFileSync(path.join(srtDir, docs[0]), 'utf8');
    const m = doc.match(/##\s*5-1\.[^\n]*\n+```\n([\s\S]*?)\n```/);
    if (!m) {
      bad('고정 댓글 문구', '발행문구.md 에 «## 5-1. 고정 댓글» 절과 코드블록',
        '없다 — 지침서 8-1 대로 댓글 문구를 문서에 적어라');
    } else {
      const body = m[1].trim();
      body.length > 0
        ? ok('고정 댓글 문구', `${body.split('\n')[0].slice(0, 40)}…`)
        : bad('고정 댓글 문구', '내용', '비어 있다');
      // 정답 노출 검사. 보기를 나란히 다시 제시하는 건 노출이 아니다 — 그게 질문이다.
      // 노출은 두 가지다: ① 정답만 적고 다른 보기는 안 적는 것(한쪽만 말하면 그게 답이다)
      // ② 다른 보기를 «아니었다» 로 지우는 것(보기가 2개면 소거법이 곧 정답이다).
      const ans = String(M.question?.answer_value || '').trim();
      const opts = (M.quiz?.options || []).map((x) => String(x).trim()).filter(Boolean);
      const norm = (x) => x.replace(/[\s·.,]/g, '');
      const nb = norm(body);
      const shown = opts.filter((o) => nb.includes(norm(o)));
      const elim = opts.filter((o) => new RegExp(`${norm(o)}[가-힣]{0,4}(아니|없었|아닙)`).test(nb));
      if (elim.length > 0) {
        bad('고정 댓글 정답 노출', '소거법도 노출이다', `«${elim[0]}» 를 지우고 있다 — 보기가 ${opts.length}개다`);
      } else if (ans && nb.includes(norm(ans)) && shown.length < opts.length) {
        bad('고정 댓글 정답 노출', '정답만 따로 적지 않는다',
          `«${ans}» 는 있는데 «${opts.filter((o) => !nb.includes(norm(o))).join(', ')}» 는 없다`);
      } else {
        ok('고정 댓글 정답 노출', shown.length === opts.length
          ? `보기 ${opts.length}개를 나란히 제시 — 정답만 드러내지 않음`
          : (ans ? `«${ans}» 없음` : '정답 항목 없음 — 건너뜀'));
      }
      // 보기를 다시 제시했는지 (참여 유도)
      opts.length > 0 && shown.length === opts.length
        ? ok('고정 댓글 보기 제시', `보기 ${opts.length}개 모두 있음`)
        : bad('고정 댓글 보기 제시', '보기를 댓글에 다시 적는다',
            '없다 — 12초에 떠나는 시청자에게 고를 거리를 준다');
    }
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(fails === 0 ? `✅ 전부 통과 (${passes}건)` : `❌ ${fails}건 불일치 / ${passes}건 통과 — 발행 금지`);
process.exit(fails === 0 ? 0 : 1);
