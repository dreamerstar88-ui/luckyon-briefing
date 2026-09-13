// questions.mjs — 주간 쇼츠의 "퀴즈 질문" 은행
//
// 왜 만들었나: 1·2회차가 둘 다 "그 사이 최대 낙폭은?" 이었다. 최대 낙폭은 정의상 늘 음수라
// 그 주가 오르든 내리든 정답이 매번 하락 숫자로 나온다. 실제로 1회차는 그 주의 가장 큰
// 움직임이 상승(+2.69%)이었는데도 낙폭(-2.18%)을 물었다. 데이터가 아니라 틀이 주제를 정했다.
//
// 더 나쁜 예: "이번 주 바닥도 꼭대기도 한국 밤에 나왔다". 미국 정규장이 한국시간 밤
// 10:30~새벽 5:00 이므로 이건 발견이 아니라 정의다. 주식 하는 시청자에게는 우스운 문장이다.
//
// 그래서 이 파일의 모든 질문에는 `guard` 를 단다 — "이 질문의 답이 미리 정해져 있지 않은
// 이유". guard 를 못 쓰는 질문은 은행에 넣지 않는다.
//
// 쓰는 법:
//   import { QUESTIONS, buildCtx } from './questions.mjs';
//   const ctx = buildCtx(weekBars, historyBars);
//   const a = QUESTIONS.find(q=>q.id==='mdd').fn(ctx);

const MULT = 20;               // E-mini 나스닥100(NQ) 1계약 = 지수 1포인트당 $20
const isReg = (d) => { const t = d.slice(11); return t >= '09:30' && t < '16:00'; };
const kstHour = (d) => { const x = new Date(d.replace(' ', 'T') + 'Z'); x.setUTCHours(x.getUTCHours() + 13); return x.getUTCHours(); };
const dow = (d) => '일월화수목금토'[new Date(d.slice(0, 10) + 'T00:00:00Z').getUTCDay()];
const pctOf = (a, b) => (a / b - 1) * 100;

export function buildCtx(bars, hist = [], events = []) {
  const days = [...new Set(bars.map((b) => b.d.slice(0, 10)))];
  const chg = [];
  for (let i = 1; i < bars.length; i++) chg.push({ d: bars[i].d, p: pctOf(bars[i].c, bars[i - 1].c) });
  let pk = -1e9, pi = 0, mdd = 0, mp = 0, mt = 0;
  bars.forEach((b, i) => { if (b.h > pk) { pk = b.h; pi = i; } const dd = b.l / pk - 1; if (dd < mdd) { mdd = dd; mp = pi; mt = i; } });
  let tr = 1e9, ti = 0, mru = 0, rp = 0, rt = 0;
  bars.forEach((b, i) => { if (b.l < tr) { tr = b.l; ti = i; } const ru = b.h / tr - 1; if (ru > mru) { mru = ru; rp = ti; rt = i; } });
  const hi = Math.max(...bars.map((b) => b.h)), lo = Math.min(...bars.map((b) => b.l));
  const hiI = bars.findIndex((b) => b.h === hi), loI = bars.findIndex((b) => b.l === lo);
  // 일별 정규장 등락
  const dayReg = days.map((d) => {
    const S = bars.filter((b) => b.d.startsWith(d) && isReg(b.d));
    return S.length > 1 ? { d, p: pctOf(S.at(-1).c, S[0].o) } : null;
  }).filter(Boolean);
  // 시간대별 기여 (곱으로 누적)
  const share = (pred) => { let r = 1; for (let i = 1; i < bars.length; i++) if (pred(bars[i].d)) r *= bars[i].c / bars[i - 1].c; return (r - 1) * 100; };
  const minutesBetween = (i, j) => (Date.parse(bars[j].d.replace(' ', 'T') + 'Z') - Date.parse(bars[i].d.replace(' ', 'T') + 'Z')) / 60000;
  return {
    bars, days, chg, hist, events,
    open: bars[0].o, close: bars.at(-1).c, hi, lo, hiI, loI,
    mdd: mdd * 100, mddFrom: mp, mddTo: mt,
    mru: mru * 100, mruFrom: rp, mruTo: rt,
    weekPct: pctOf(bars.at(-1).c, bars[0].o),
    dayReg, share, minutesBetween, isReg, kstHour, dow,
  };
}

// span: 분을 사람이 읽는 말로
const span = (m) => m < 60 ? `${Math.round(m)}분` : (m < 1440 ? `${(m / 60).toFixed(1)}시간` : `${(m / 1440).toFixed(1)}일`);
const pp = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d) + '%';

// 보기 만들기: 정답을 중심으로 흩뿌리고, 정답 자리는 주차로 돌린다
export function makeOptions(ans, weekIdx, fmt = (v) => pp(v), spread = [0.55, 1, 1.6]) {
  const pos = weekIdx % 3;
  const mult = [[1, 1.6, 2.4], [0.55, 1, 1.6], [0.35, 0.65, 1]][pos];
  return { options: mult.map((m) => fmt(ans * m)), answerIndex: pos + 1 };
}

export const QUESTIONS = [
  // ── A. 변동의 크기 ───────────────────────────────────────────────
  { id: 'mdd', cat: '변동', unit: '%',
    ko: '그 사이 최대 낙폭은?', en: 'How deep was the drawdown?',
    fn: (c) => c.mdd,
    guard: '주간 등락률이 플러스인 주에도 낙폭은 생기고, 그 크기는 주마다 0.5%~5% 넘게 흩어진다.' },
  { id: 'mru', cat: '변동', unit: '%',
    ko: '그 사이 최대 상승폭은?', en: 'How big was the biggest run-up?',
    fn: (c) => c.mru,
    guard: '하락 주에도 반등 구간이 있다. 낙폭과 상승폭 중 어느 쪽이 큰지는 주마다 뒤집힌다.' },
  { id: 'range', cat: '변동', unit: '%',
    ko: '고가와 저가 사이는 몇 %였을까요?', en: 'How wide was the high-to-low range?',
    fn: (c) => pctOf(c.hi, c.lo),
    guard: '주간 등락률이 0에 가까워도 범위는 클 수 있다. 둘은 별개다.' },
  { id: 'bigbar', cat: '변동', unit: '%',
    ko: '가장 크게 움직인 5분봉 하나는 몇 %였을까요?', en: 'How big was the single biggest 5-minute bar?',
    fn: (c) => c.chg.reduce((a, x) => Math.abs(x.p) > Math.abs(a) ? x.p : a, 0),
    guard: '지표가 얼마나 세게 때렸는지에 달려 있다. 조용한 주는 0.1%, 고용지표 주는 0.5%를 넘는다.' },
  { id: 'bigday', cat: '변동', unit: '%',
    ko: '가장 크게 움직인 하루는 몇 %였을까요?', en: 'How much did the biggest day move?',
    fn: (c) => c.dayReg.reduce((a, x) => Math.abs(x.p) > Math.abs(a) ? x.p : a, 0),
    guard: '정규장 하루 등락은 주마다 0.1%~3% 로 흩어진다.' },
  { id: 'quietday', cat: '변동', unit: '%',
    ko: '가장 조용했던 하루는 몇 %였을까요?', en: 'How little did the quietest day move?',
    fn: (c) => c.dayReg.reduce((a, x) => Math.abs(x.p) < Math.abs(a) ? x.p : a, c.dayReg[0].p),
    guard: '어떤 주는 가장 조용한 날도 0.5% 움직이고, 어떤 주는 0.01% 에 그친다.' },
  { id: 'avgbar', cat: '변동', unit: '%',
    ko: '5분봉 하나가 평균 몇 % 움직였을까요?', en: 'How much did an average 5-minute bar move?',
    fn: (c) => c.chg.reduce((s, x) => s + Math.abs(x.p), 0) / c.chg.length,
    guard: '체감 변동성이다. 지표가 몰린 주와 없는 주가 2배 이상 차이 난다.' },
  { id: 'resultvsprocess', cat: '변동', unit: '배',
    ko: '한 주 움직인 거리는 결과의 몇 배였을까요?', en: 'How many times the net move did price actually travel?',
    fn: (c) => c.chg.reduce((s, x) => s + Math.abs(x.p), 0) / Math.max(0.01, Math.abs(c.weekPct)),
    guard: '결과가 0에 가까울수록 배수가 폭발한다. 주마다 5배에서 200배까지 벌어진다.' },

  // ── B. 시간대 ────────────────────────────────────────────────────
  { id: 'regshare', cat: '시간', unit: '%',
    ko: '이 중 미국 정규장이 만든 건 몇 %였을까요?', en: 'How much of it came from the US regular session?',
    fn: (c) => c.share((d) => isReg(d)),
    guard: '정규장이 다 만들 때도 있고, 정규장에서 번 걸 야간에 다 반납할 때도 있다. 1회차가 후자였다.' },
  { id: 'nightshare', cat: '시간', unit: '%',
    ko: '정규장 밖에서 만들어진 건 몇 %였을까요?', en: 'How much came from outside regular hours?',
    fn: (c) => c.share((d) => !isReg(d)),
    guard: '부호가 정규장과 반대인 주가 흔하다. 크기도 주마다 다르다.' },
  { id: 'krdayshare', cat: '시간', unit: '%',
    ko: '한국이 낮일 때(오전 9시~오후 6시) 움직인 건 몇 %였을까요?', en: 'How much moved during Korean business hours?',
    fn: (c) => c.share((d) => { const h = kstHour(d); return h >= 9 && h < 18; }),
    guard: '한국 낮은 미국 야간이라 거래가 얕지만, 아시아發 뉴스가 있으면 크게 움직인다.' },
  { id: 'open30', cat: '시간', unit: '%',
    ko: '개장 첫 30분이 만든 건 몇 %였을까요?', en: 'How much came from the first 30 minutes after the open?',
    fn: (c) => c.share((d) => { const t = d.slice(11); return t >= '09:30' && t < '10:00'; }),
    guard: '개장 30분이 하루를 결정하는 주도 있고, 열자마자 되돌리는 주도 있다.' },
  { id: 'close30', cat: '시간', unit: '%',
    ko: '마감 직전 30분이 만든 건 몇 %였을까요?', en: 'How much came from the last 30 minutes before the close?',
    fn: (c) => c.share((d) => { const t = d.slice(11); return t >= '15:30' && t < '16:00'; }),
    guard: '마감 직전은 기관 주문이 몰린다. 방향이 장중과 반대인 주가 자주 나온다.' },
  { id: 'lunch', cat: '시간', unit: '%',
    ko: '미국 점심시간(낮 12~1시)에 움직인 건 몇 %였을까요?', en: 'How much moved during the US lunch hour?',
    fn: (c) => c.share((d) => { const t = d.slice(11); return t >= '12:00' && t < '13:00'; }),
    guard: '보통 조용하지만, 그 시간에 헤드라인이 뜨면 뒤집힌다.' },
  { id: 'hiday', cat: '시간', unit: '요일',
    ko: '주간 최고가는 무슨 요일에 나왔을까요?', en: 'Which day printed the weekly high?',
    fn: (c) => dow(c.bars[c.hiI].d), kind: 'choice',
    guard: '요일은 5개(휴장 주는 4개) 중 하나로 매주 바뀐다. 월요일 고점과 금요일 고점은 뜻이 완전히 다르다.' },
  { id: 'loday', cat: '시간', unit: '요일',
    ko: '주간 최저가는 무슨 요일에 나왔을까요?', en: 'Which day printed the weekly low?',
    fn: (c) => dow(c.bars[c.loI].d), kind: 'choice',
    guard: '위와 같다. 고점·저점이 같은 날인 주도 있다.' },
  { id: 'hilogap', cat: '시간', unit: '시간',
    ko: '최고가와 최저가는 몇 시간 떨어져 있었을까요?', en: 'How far apart were the weekly high and low?',
    fn: (c) => Math.abs(c.minutesBetween(Math.min(c.hiI, c.loI), Math.max(c.hiI, c.loI))) / 60, kind: 'hours',
    guard: '같은 날 몇 시간 만에 끝나는 주도, 월요일과 금요일로 갈리는 주도 있다.' },

  // ── C. 되돌림과 모양 ─────────────────────────────────────────────
  { id: 'recover', cat: '모양', unit: '%',
    ko: '저점에서 얼마나 되돌렸을까요?', en: 'How far did it bounce off the low?',
    fn: (c) => pctOf(c.close, c.lo),
    guard: '저점에서 끝나는 주는 0에 가깝고, V자 반등 주는 3%를 넘는다.' },
  { id: 'giveback', cat: '모양', unit: '%',
    ko: '고점에서 얼마나 반납했을까요?', en: 'How much did it give back from the high?',
    fn: (c) => pctOf(c.close, c.hi),
    guard: '고점 마감이면 0, 고점 찍고 무너지면 3%를 넘는다.' },
  { id: 'closepos', cat: '모양', unit: '%',
    ko: '종가는 주간 범위의 몇 % 지점이었을까요?', en: 'Where in the weekly range did it close?',
    fn: (c) => (c.close - c.lo) / (c.hi - c.lo) * 100,
    guard: '0%(저점 마감)부터 100%(고점 마감)까지 고르게 흩어진다. 강세·약세를 한 숫자로 말해 준다.' },
  { id: 'mddtime', cat: '모양', unit: '시간',
    ko: '그 낙폭은 몇 시간 만에 벌어졌을까요?', en: 'How long did that drawdown take?',
    fn: (c) => c.minutesBetween(c.mddFrom, c.mddTo) / 60, kind: 'hours',
    guard: '한 시간 만에 끝나는 낙폭도, 사흘에 걸친 낙폭도 있다. 같은 크기라도 체감이 다르다.' },
  { id: 'mrutime', cat: '모양', unit: '시간',
    ko: '그 상승은 몇 시간 만에 나왔을까요?', en: 'How long did that run-up take?',
    fn: (c) => c.minutesBetween(c.mruFrom, c.mruTo) / 60, kind: 'hours',
    guard: '위와 같다.' },
  { id: 'swings', cat: '모양', unit: '번',
    ko: '1% 넘는 방향 전환이 몇 번 있었을까요?', en: 'How many 1% swings changed direction?',
    fn: (c) => { let n = 0, ref = c.bars[0].c, dir = 0;
      for (const b of c.bars) { const ch = pctOf(b.c, ref);
        if (ch > 1 && dir <= 0) { n++; dir = 1; ref = b.c; }
        else if (ch < -1 && dir >= 0) { n++; dir = -1; ref = b.c; }
        else if (dir > 0 && b.c > ref) ref = b.c; else if (dir < 0 && b.c < ref) ref = b.c; }
      return n; }, kind: 'count',
    guard: '추세 주는 1~2번, 톱니 주는 6번을 넘는다. 0인 주도 있다.' },
  { id: 'crossopen', cat: '모양', unit: '번',
    ko: '주간 시가를 몇 번 넘나들었을까요?', en: 'How many times did it cross back over the weekly open?',
    fn: (c) => { let n = 0, up = c.bars[0].c >= c.open;
      for (const b of c.bars) { const u = b.c >= c.open; if (u !== up) { n++; up = u; } } return n; }, kind: 'count',
    guard: '한 번도 안 돌아오는 추세 주가 있고, 수십 번 오가는 주가 있다.' },
  { id: 'aboveopen', cat: '모양', unit: '%',
    ko: '한 주 중 시가 위에 있던 시간은 몇 %였을까요?', en: 'What share of the week did it spend above the weekly open?',
    fn: (c) => c.bars.filter((b) => b.c >= c.open).length / c.bars.length * 100,
    guard: '결과가 같아도 과정이 다르다. 내내 위에 있다 끝에 무너진 주와 내내 아래였던 주가 구분된다.' },

  // ── D. 연속성 ────────────────────────────────────────────────────
  { id: 'aboveopencount', cat: '모양', unit: '개',
    ko: '시가 위에서 끝난 5분봉은 몇 개였을까요?', en: 'How many 5-minute bars closed above the opening price?',
    fn: (c) => c.bars.filter((b) => b.c >= c.open).length, kind: 'count',
    guard: 'aboveopen 과 같은 사실을 개수로 묻는다. 화면이 "개" 로 말하면 이쪽을 쓴다 — 매니페스트 단위와 은행 단위가 어긋나면 검증이 헛돈다.' },
  { id: 'upstreak', cat: '연속', unit: '개',
    ko: '가장 길게 연속으로 오른 5분봉은 몇 개였을까요?', en: 'What was the longest streak of rising 5-minute bars?',
    fn: (c) => { let b = 0, n = 0; for (const x of c.chg) { if (x.p > 0) { n++; b = Math.max(b, n); } else n = 0; } return b; }, kind: 'count',
    guard: '주마다 6개에서 20개까지 나온다.' },
  { id: 'downstreak', cat: '연속', unit: '개',
    ko: '가장 길게 연속으로 내린 5분봉은 몇 개였을까요?', en: 'What was the longest streak of falling 5-minute bars?',
    fn: (c) => { let b = 0, n = 0; for (const x of c.chg) { if (x.p < 0) { n++; b = Math.max(b, n); } else n = 0; } return b; }, kind: 'count',
    guard: '상승 연속과 길이가 다르다. 어느 쪽이 긴지도 주마다 뒤집힌다.' },
  { id: 'upratio', cat: '연속', unit: '%',
    ko: '오른 5분봉은 전체의 몇 %였을까요?', en: 'What share of 5-minute bars closed higher?',
    fn: (c) => c.chg.filter((x) => x.p > 0).length / c.chg.length * 100,
    guard: '50%에서 크게 안 벗어나지만, 그 편차가 그 주 성격을 말해 준다. 하락 주인데 오른 봉이 더 많은 경우도 있다.' },
  { id: 'updays', cat: '연속', unit: '일',
    ko: '정규장에서 오른 날은 며칠이었을까요?', en: 'How many days closed higher in the regular session?',
    fn: (c) => c.dayReg.filter((x) => x.p > 0).length, kind: 'count',
    guard: '주간 등락률과 안 맞는 주가 흔하다. 사흘 오르고 하루에 다 반납하기도 한다.' },
  { id: 'gapsum', cat: '연속', unit: '%',
    ko: '날마다 생긴 시가 갭을 다 더하면 몇 %였을까요?', en: 'How much did the daily opening gaps add up to?',
    fn: (c) => { let s = 0; for (let i = 1; i < c.days.length; i++) {
        const prev = c.bars.filter((b) => b.d.startsWith(c.days[i - 1]) && isReg(b.d)).at(-1);
        const cur = c.bars.filter((b) => b.d.startsWith(c.days[i]) && isReg(b.d))[0];
        if (prev && cur) s += pctOf(cur.o, prev.c); } return s; },
    guard: '갭이 한 방향으로 쌓이는 주와 서로 상쇄되는 주가 갈린다.' },
  { id: 'biggap', cat: '연속', unit: '%',
    ko: '가장 큰 하루 시가 갭은 몇 %였을까요?', en: 'What was the biggest single opening gap?',
    fn: (c) => { let m = 0; for (let i = 1; i < c.days.length; i++) {
        const prev = c.bars.filter((b) => b.d.startsWith(c.days[i - 1]) && isReg(b.d)).at(-1);
        const cur = c.bars.filter((b) => b.d.startsWith(c.days[i]) && isReg(b.d))[0];
        if (prev && cur) { const g = pctOf(cur.o, prev.c); if (Math.abs(g) > Math.abs(m)) m = g; } } return m; },
    guard: '야간에 무슨 일이 있었는지를 한 숫자로 보여 준다. 주마다 0.1%~2% 로 흩어진다.' },

  // ── E. 지표 반응 (매니페스트의 events 가 필요하다) ────────────────
  { id: 'evmax', cat: '지표', unit: '%', needsEvents: true,
    ko: '지표 발표 순간 가장 크게 움직인 건 몇 %였을까요?', en: 'What was the biggest move on a scheduled release?',
    fn: (c) => c.events.reduce((a, e) => Math.abs(e.pct) > Math.abs(a) ? e.pct : a, 0),
    guard: '어떤 지표가 그 주에 걸렸는지에 달려 있다. CPI·고용 주와 아닌 주가 크게 다르다.' },
  { id: 'evmaxwhich', cat: '지표', unit: '', needsEvents: true, kind: 'choice',
    ko: '지수를 가장 크게 움직인 발표는?', en: 'Which release moved the index most?',
    fn: (c) => c.events.reduce((a, e) => Math.abs(e.pct) > Math.abs(a.pct) ? e : a).tag,
    guard: '그 주에 어떤 지표가 걸렸는지, 그리고 시장이 그중 무엇에 반응했는지에 달려 있다. CPI 가 있는 주에도 CPI 가 1위가 아닌 경우가 흔하다 — 2회차가 그랬다(PPI 가 1위, CPI 는 3위).' },
  { id: 'evmin', cat: '지표', unit: '%', needsEvents: true,
    ko: '가장 반응이 없던 지표는 몇 %였을까요?', en: 'Which release moved it least?',
    fn: (c) => c.events.reduce((a, e) => Math.abs(e.pct) < Math.abs(a) ? e.pct : a, c.events[0].pct),
    guard: '중요도 ★★★ 인데 시장이 무시하는 일이 자주 있다. 그게 뉴스다.' },
  { id: 'evmiss', cat: '지표', unit: '개', needsEvents: true,
    ko: '예상을 빗나간 지표는 몇 개였을까요?', en: 'How many releases missed their forecast?',
    fn: (c) => c.events.filter((e) => e.compare_field === 'consensus' && e.actual !== e.compare).length, kind: 'count',
    guard: '전부 맞는 주도, 전부 빗나가는 주도 있다.' },
  { id: 'evrank', cat: '지표', unit: '번', needsEvents: true,
    ko: '지표 발표 시각이 그 주 변동 상위 20위 안에 몇 번 들었을까요?', en: 'How many releases ranked in the week\'s 20 biggest moves?',
    fn: (c) => c.events.filter((e) => e.rank <= 20).length, kind: 'count',
    guard: '지표가 정말 시장을 흔들었는지를 재는 값이다. 0인 주도 흔하다.' },
  { id: 'evpre', cat: '지표', unit: '%', needsEvents: true,
    ko: '프리장 지표와 장중 지표, 어느 쪽이 더 흔들었을까요?', en: 'Which moved it more, pre-market or regular-session releases?',
    fn: (c) => { const s = (f) => c.events.filter(f).reduce((a, e) => a + Math.abs(e.pct), 0);
      return s((e) => e.et.slice(11) < '09:30') - s((e) => e.et.slice(11) >= '09:30'); },
    guard: '미국 지표는 08:30 프리장과 10:00 장중으로 갈린다. 어느 쪽이 셌는지는 주마다 다르다.' },

  // ── F. 수준과 경계 (앞선 주들이 필요하다) ────────────────────────
  { id: 'vsprev', cat: '수준', unit: '%', needsHist: true,
    ko: '지난주 종가 대비 몇 %였을까요?', en: 'How did it finish against the prior week\'s close?',
    fn: (c) => pctOf(c.close, c.hist.at(-1).c),
    guard: '주간 등락률(시가 대비)과 다르다. 주말 갭이 그 차이다.' },
  { id: 'prevhigh', cat: '수준', unit: '%', needsHist: true,
    ko: '지난주 고점을 넘어섰을까요, 몇 % 차이였을까요?', en: 'Did it clear the prior week\'s high, and by how much?',
    fn: (c) => pctOf(c.hi, Math.max(...c.hist.slice(-40).map((b) => b.h))),
    guard: '돌파와 실패가 주마다 갈린다. 추세가 살아 있는지를 한 숫자로 본다.' },
  { id: 'prevlow', cat: '수준', unit: '%', needsHist: true,
    ko: '지난주 저점을 깼을까요, 몇 % 차이였을까요?', en: 'Did it break the prior week\'s low, and by how much?',
    fn: (c) => pctOf(c.lo, Math.min(...c.hist.slice(-40).map((b) => b.l))),
    guard: '위와 같다. 저점 이탈은 하락 추세의 신호로 읽힌다.' },
  { id: 'pos4w', cat: '수준', unit: '%', needsHist: true,
    ko: '종가는 최근 4주 범위의 몇 % 지점이었을까요?', en: 'Where did it close within the last four weeks\' range?',
    fn: (c) => { const H = c.hist.slice(-160); const hi = Math.max(...H.map((b) => b.h), c.hi), lo = Math.min(...H.map((b) => b.l), c.lo);
      return (c.close - lo) / (hi - lo) * 100; },
    guard: '한 주만 보면 안 보이는 위치를 보여 준다. 0~100% 전 구간에 흩어진다.' },
  { id: 'volvs4w', cat: '수준', unit: '배', needsHist: true,
    ko: '이번 주 변동폭은 최근 4주 평균의 몇 배였을까요?', en: 'How did this week\'s range compare with the last four weeks?',
    fn: (c) => { const H = c.hist.slice(-160); const r = pctOf(c.hi, c.lo);
      const w = []; for (let i = 0; i + 40 <= H.length; i += 40) { const S = H.slice(i, i + 40);
        w.push(pctOf(Math.max(...S.map((b) => b.h)), Math.min(...S.map((b) => b.l)))); }
      return r / (w.reduce((a, b) => a + b, 0) / Math.max(1, w.length)); },
    guard: '조용한 주와 사나운 주를 구분한다. 0.5배에서 2.5배까지 나온다.' },
  { id: 'vsma', cat: '수준', unit: '%', needsHist: true,
    ko: '종가는 20일 평균에서 몇 % 떨어져 있었을까요?', en: 'How far did it close from its 20-day average?',
    fn: (c) => { const H = [...c.hist, ...c.bars].slice(-20 * 8);
      const ma = H.reduce((a, b) => a + b.c, 0) / H.length; return pctOf(c.close, ma); },
    guard: '평균 위인지 아래인지, 얼마나 벌어졌는지가 주마다 바뀐다.' },

  // ── G. 돈으로 환산 ───────────────────────────────────────────────
  { id: 'dollarmdd', cat: '환산', unit: '달러',
    ko: '1계약 들고 있었다면 최대 평가손은 얼마였을까요?', en: 'On one contract, how big was the worst paper loss?',
    fn: (c) => (c.bars[c.mddTo].l - c.bars[c.mddFrom].h) * MULT, kind: 'usd',
    guard: '%로는 안 와닿는 크기를 돈으로 보여 준다. 지수 수준이 올라가면 같은 %도 금액이 커진다.' },
  { id: 'dollarrange', cat: '환산', unit: '달러',
    ko: '1계약 기준 고점과 저점 사이는 얼마였을까요?', en: 'On one contract, how many dollars between the high and low?',
    fn: (c) => (c.hi - c.lo) * MULT, kind: 'usd',
    guard: '주마다 $2,000 에서 $20,000 까지 벌어진다.' },
  { id: 'buyhigh', cat: '환산', unit: '%',
    ko: '주간 고점에 산 사람은 금요일에 몇 %였을까요?', en: 'If you bought the weekly high, where were you on Friday?',
    fn: (c) => pctOf(c.close, c.hi),
    guard: '최악의 타이밍이 실제로 얼마나 아팠는지. 주마다 -0.1%에서 -5%까지.' },
  { id: 'buylow', cat: '환산', unit: '%',
    ko: '주간 저점에 산 사람은 금요일에 몇 %였을까요?', en: 'If you bought the weekly low, where were you on Friday?',
    fn: (c) => pctOf(c.close, c.lo),
    guard: '최고의 타이밍이 실제로 얼마나 벌었는지. 되돌림이 없으면 작다.' },
  { id: 'travel', cat: '환산', unit: '%',
    ko: '5분봉을 다 더하면 한 주에 몇 % 움직였을까요?', en: 'Adding up every 5-minute move, how far did price travel?',
    fn: (c) => c.chg.reduce((s, x) => s + Math.abs(x.p), 0),
    guard: '실제 이동 거리다. 결과가 0이어도 거리는 20%를 넘는다.' },
  { id: 'efficiency', cat: '환산', unit: '%',
    ko: '움직인 거리 중 실제로 남은 건 몇 %였을까요?', en: 'Of all that travel, what share stuck?',
    fn: (c) => Math.abs(c.weekPct) / c.chg.reduce((s, x) => s + Math.abs(x.p), 0) * 100,
    guard: '추세 주는 10%를 넘고 횡보 주는 1% 아래다. 그 주가 추세였는지 톱니였는지를 한 숫자로 말한다.' },

  // ── H. 경계선 ────────────────────────────────────────────────────
  { id: 'round1000', cat: '경계', unit: '번',
    ko: '1,000 단위 가격선을 몇 번 넘나들었을까요?', en: 'How many times did it cross a round 1,000 level?',
    fn: (c) => { let n = 0, prev = Math.floor(c.bars[0].c / 1000);
      for (const b of c.bars) { const k = Math.floor(b.c / 1000); if (k !== prev) { n++; prev = k; } } return n; }, kind: 'count',
    guard: '지수가 라운드 넘버 근처에 있는 주에만 많이 나온다. 0인 주가 흔하다.' },
  { id: 'tolround', cat: '경계', unit: '포인트',
    ko: '주간 고점은 다음 1,000 단위까지 몇 포인트 남겨 뒀을까요?', en: 'How many points short of the next round 1,000 did the high stop?',
    fn: (c) => Math.ceil(c.hi / 1000) * 1000 - c.hi, kind: 'point',
    guard: '0~999 포인트 사이 어디든 나온다. 코앞에서 멈춘 주가 이야깃거리가 된다.' },
  { id: 'mostpassed', cat: '경계', unit: '번',
    ko: '가장 여러 번 지나간 가격대를 몇 번 지났을까요?', en: 'How many times did it cross its most-visited price?',
    fn: (c) => { const bin = new Map();
      for (let i = 1; i < c.bars.length; i++) { const a = c.bars[i - 1].c, b = c.bars[i].c;
        const lo2 = Math.min(a, b), hi2 = Math.max(a, b);
        for (let k = Math.ceil(lo2 / 50) * 50; k <= hi2; k += 50) bin.set(k, (bin.get(k) || 0) + 1); }
      return Math.max(0, ...bin.values()); }, kind: 'count',
    guard: '횡보 주는 수십 번, 추세 주는 한두 번이다.' },
  // ── I. 집중도와 방향 ─────────────────────────────────────────────
  { id: 'top10share', cat: '집중', unit: '%',
    ko: '가장 크게 움직인 5분봉 10개가 한 주 등락의 몇 %를 만들었을까요?', en: 'How much of the week came from just its ten biggest bars?',
    fn: (c) => { const top = [...c.chg].sort((a, b) => Math.abs(b.p) - Math.abs(a.p)).slice(0, 10);
      let r = 1; for (const x of top) r *= 1 + x.p / 100; return (r - 1) * 100; },
    guard: '1,000개 가까운 봉 중 10개가 전부를 만드는 주가 있고, 고르게 퍼지는 주가 있다. 어느 쪽인지는 미리 알 수 없다.' },
  { id: 'halfmove', cat: '집중', unit: '시간',
    ko: '한 주 움직임의 절반은 몇 시간 만에 나왔을까요?', en: 'How many hours did it take to make half the week move?',
    fn: (c) => { const tot = Math.abs(c.weekPct); if (tot < 0.01) return 0;
      let r = 1; for (let i = 1; i < c.bars.length; i++) { r *= c.bars[i].c / c.bars[i - 1].c;
        if (Math.abs((r - 1) * 100) >= tot / 2) return c.minutesBetween(0, i) / 60; }
      return c.minutesBetween(0, c.bars.length - 1) / 60; }, kind: 'hours',
    guard: '한 시간 만에 절반이 나오는 주도, 끝까지 가야 채워지는 주도 있다.' },
  { id: 'nightflip', cat: '집중', unit: '일',
    ko: '야간과 정규장의 방향이 서로 반대였던 날은 며칠이었을까요?', en: 'On how many days did the overnight and regular sessions move opposite ways?',
    fn: (c) => { let n = 0;
      for (const d of c.days) { const R = c.bars.filter((b) => b.d.startsWith(d) && isReg(b.d));
        const N = c.bars.filter((b) => b.d.startsWith(d) && !isReg(b.d));
        if (R.length < 2 || N.length < 2) continue;
        const r = pctOf(R.at(-1).c, R[0].o), nn = pctOf(N.at(-1).c, N[0].o);
        if (r * nn < 0) n++; }
      return n; }, kind: 'count',
    guard: '한국 시청자가 자는 동안과 깨어 있는 동안이 엇갈린 날을 센다. 0일부터 전부까지 나온다.' },
  { id: 'mondayfriday', cat: '집중', unit: '방향',
    ko: '첫날과 마지막 날은 같은 방향이었을까요?', en: 'Did the first and last day move the same way?',
    fn: (c) => { const a = c.dayReg[0].p, b = c.dayReg.at(-1).p;
      return a * b > 0 ? (a > 0 ? '둘 다 상승' : '둘 다 하락') : '서로 반대'; }, kind: 'choice',
    guard: '셋 중 하나이고 주마다 바뀐다. 주 초의 분위기가 끝까지 갔는지를 본다.' },
  { id: 'maxhourkst', cat: '집중', unit: '시',
    ko: '한 주에서 가장 크게 움직인 한 시간은 한국시간 몇 시였을까요?', en: 'Which Korean hour saw the biggest single-hour move?',
    fn: (c) => { const bin = new Map();
      for (let i = 1; i < c.bars.length; i++) { const h = kstHour(c.bars[i].d);
        bin.set(h, (bin.get(h) || 0) + Math.abs(pctOf(c.bars[i].c, c.bars[i - 1].c))); }
      let best = 0, bv = -1; for (const [h, v] of bin) if (v > bv) { bv = v; best = h; }
      return `${best}시`; }, kind: 'choice',
    guard: '지표 시각에 따라 밤 9시대와 밤 11시대가 갈리고, 아시아 시간에 몰리는 주도 있다.' },
  { id: 'weekendgap', cat: '집중', unit: '%', needsHist: true,
    ko: '주말 사이에 벌어진 갭은 한 주 등락의 몇 %였을까요?', en: 'How much of the week was the weekend gap alone?',
    fn: (c) => { const g = pctOf(c.open, c.hist.at(-1).c);
      return Math.abs(c.weekPct) < 0.01 ? g : g / c.weekPct * 100; },
    guard: '첫날 열자마자 한 주가 결정된 주와, 갭이 무의미했던 주가 갈린다.' },
  { id: 'backtostart', cat: '집중', unit: '시간',
    ko: '저점을 찍고 시가 자리로 돌아오는 데 몇 시간 걸렸을까요?', en: 'How long from the weekly low back to the opening price?',
    fn: (c) => { const lo = c.loI;
      for (let i = lo + 1; i < c.bars.length; i++) if (c.bars[i].c >= c.open) return c.minutesBetween(lo, i) / 60;
      return -1; }, kind: 'hours',
    guard: '끝내 못 돌아온 주는 -1 이 된다. 돌아온 주도 몇 시간 걸렸는지는 제각각이다.' },
];

export const BANK_SIZE = QUESTIONS.length;
