// comment.mjs
// "주린이가 장 보다가 차트 위에 펜으로 갈겨쓴 혼잣말"을 만든다.
//
// 원칙
//  - 독백체(혼잣말). 남에게 설명하지 않는다. "~습니다"체 금지.
//  - 숫자를 쓰지 않는다. 수치는 이미 차트에 다 나와 있다.
//  - 완결된 문장이 아니어도 된다. 조각난 말, 한숨, 바람도 괜찮다.
//  - 분석하지 않는다. 전망·매매 판단은 절대 넣지 않는다.

// ---------- 30분 궤적의 '모양' 판정 ----------
// 시가 대비 등락만 보면 "올랐다 밀린" 흐름을 "계속 내린" 것으로 잘못 쓰게 된다.
export function shapeOf(sym) {
  const b = sym.bars;
  const open = b[0].o;
  const last = b[b.length - 1].c;
  const n = b.length;
  const third = Math.max(1, Math.floor(n / 3));
  const avg = (a) => a.reduce((s, x) => s + x.c, 0) / a.length;
  const early = avg(b.slice(0, third));
  const late = avg(b.slice(-third));

  let hiIdx = 0, loIdx = 0;
  b.forEach((x, i) => {
    if (x.h > b[hiIdx].h) hiIdx = i;
    if (x.l < b[loIdx].l) loIdx = i;
  });

  const hi = Math.max(...b.map((x) => x.h));
  const lo = Math.min(...b.map((x) => x.l));
  const pct = ((last - open) / open) * 100;
  const earlyPct = ((early - open) / open) * 100;
  const latePct = ((late - open) / open) * 100;
  const pos = (last - lo) / (hi - lo || 1);

  const peakedEarly = hiIdx < n * 0.45 && latePct < earlyPct - 0.05;
  const troughEarly = loIdx < n * 0.45 && latePct > earlyPct + 0.05;

  return {
    pct,
    rangePct: ((hi - lo) / open) * 100,
    peakedEarly,
    troughEarly,
    // "얼마나 되돌렸는가"를 실제 고점·저점(hi·lo, 틱 단위) 대비 최근 구간
    // '평균'(late)으로 잰다. 극값 위치는 정확한 틱으로 잡아야 창이 길어져도
    // 초반 1/3 평균에 고점과 그 뒤 하락이 섞여 신호가 흐려지지 않고(2026-08-19
    // 낮, 113봉짜리 긴 창에서 이 문제로 뚜렷한 V자 회복을 놓칠 뻔했다), "지금"은
    // 마지막 한 틱이 아니라 최근 구간 평균으로 재야 막판 한 봉의 심지 노이즈에
    // 안 흔들린다(2026-08-19 아침, 초반 고점 이후 계속 하락 중이었는데 막판 1봉의
    // 미세 반등만으로 '회복 중'으로 잘못 분류된 사고). peakedEarly/troughEarly가
    // 아니면(=고점·저점이 창 앞쪽에 있지 않으면) 0 — '몇 시간 전 살짝 고점'을
    // 지금의 하락으로 착각하지 않도록 위치 조건은 그대로 남긴다.
    fadeFromHighPct: peakedEarly ? ((hi - late) / hi) * 100 : 0,
    bounceFromLowPct: troughEarly ? ((late - lo) / lo) * 100 : 0,
    quiet: ((hi - lo) / open) * 100 < 0.25,
    nearHigh: pos >= 0.75,
    nearLow: pos <= 0.25,
    big: Math.abs(pct) >= 0.5,
  };
}

// 날짜를 씨앗으로 변형을 고른다 (같은 날은 항상 같은 문구, 날마다는 달라짐)
function seedOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const pick = (arr, seed) => arr[seed % arr.length];

// ---------- 상황별 문구 풀 ----------
// 각 항목은 손글씨 2~3줄. 숫자 없음.
//
// '흐르다'/'흘러내리다'는 하락 전용으로 쓴다. 이 동사는 방향과 무관하게
// 쓰이는 게 아니라 '흘러내리다·새다'처럼 소극적·하방 뉘앙스를 내포한다
// (아래로 흐르는 물처럼). "위로 흐르는 중"은 방향과 동사가 충돌하는
// 어색한 조합이었다 (2026-08-10 사용자 지적으로 발견, rising.ko[0] 수정).
// 상승엔 '올라가다/오르다/치솟다' 계열을 쓴다.
const POOL = {
  pendingQuiet: {
    ko: (e) => [
      [`${e} 앞두고`, `다들 숨죽이고 있네`, `발표 나면 어디로...?`],
      [`${e} 대기중`, `조용해도 너무 조용해`, `이따 한번 흔들리겠지`],
    ],
    en: (e) => [
      [`Everyone holding still`, `before ${e}...`, `which way after??`],
      [`Waiting on ${e}`, `too quiet out here`, `something's coming`],
    ],
  },
  pendingMoving: {
    ko: (e) => [
      [`${e} 아직 안 나왔는데`, `벌써 이러네`, `발표 후엔 또 어떻게...`],
      [`${e} 전부터`, `이미 움직이는 중`, `본게임은 이따부터인가`],
    ],
    en: (e) => [
      [`${e} isn't even out yet`, `and it's already moving`, `what happens after??`],
      [`Moving ahead of ${e}`, `main event still to come`, `hm...`],
    ],
  },
  // 2026-08-27 사고 이후 재설계: 뉴스가 있다고 그 방향의 움직임을 뉴스 "때문"이라고
  // 단정하지 않는다 (좋은 뉴스인데 창이 근소하게 빨갛다고 "이거 때문에 빠지네"라고 썼던 사고).
  // 차트 모양 판정이 이미 끝난 뒤, 그 위에 "혹시 이거 때문인가?" 정도의 추측 한 줄만 얹는다.
  newsMaybe: {
    ko: (n) => [
      `${n} 때문인가?`,
      `혹시 ${n} 때문에?`,
      `${n}... 영향 있나`,
    ],
    en: (n) => [
      `is it the ${n}?`,
      `${n}... maybe why?`,
      `could be the ${n}`,
    ],
  },
  // ---- 밤사이 흐름을 아는 문구 ----
  // 창(개장 후 30분~1시간)만 보면 "밤새 크게 빠진 뒤의 소폭 반등"을 그냥 상승으로 읽는다.
  // 전일 종가·갭을 알면 그날의 위치감이 맞는 말이 나온다.
  gapDownFalling: {
    ko: [
      [`밤새 빠지더니`, `열려서도 계속 아래로`, `어디까지 가려나`],
      [`아래로 열었는데`, `멈출 생각을 안하네`],
    ],
    en: [
      [`Fell all night`, `and keeps falling after the open`, `how far`],
      [`Opened down`, `and no sign of stopping`],
    ],
  },
  gapDownRecovering: {
    ko: [
      [`밤사이 빠진 거`, `조금씩 만회하는 중`, `갈 길 멀다`],
      [`아래로 열었지만`, `생각보다 잘 버티네`],
    ],
    en: [
      [`Clawing back some of`, `what it lost overnight`, `long way to go`],
      [`Opened down but`, `holding up better than expected`],
    ],
  },
  gapUpHolding: {
    ko: [
      [`밤새 오르더니`, `열려서도 잘 가네`, `이대로만`],
      [`위로 열고`, `그대로 밀고 가는 중`],
    ],
    en: [
      [`Up all night and`, `still going after the open`, `just stay like this`],
      [`Gapped up`, `and pushing on`],
    ],
  },
  gapUpFading: {
    ko: [
      [`위로 열었는데`, `자꾸 반납하네`, `아깝다`],
      [`좋게 시작해놓고`, `계속 까먹는 중`],
    ],
    en: [
      [`Gapped up`, `and giving it back`, `such a waste`],
      [`Nice start,`, `slowly handing it over`],
    ],
  },
  belowPrevRising: {
    ko: [
      [`아직 어제보다 아래`, `그래도 올라오는 중`],
      [`어제 자리까지는`, `아직 멀었네`, `그래도 방향은 위`],
    ],
    en: [
      [`Still under yesterday`, `but climbing`],
      [`Long way back to`, `where it closed`, `at least it's up`],
    ],
  },
  abovePrevFalling: {
    ko: [
      [`어제보단 위인데`, `자꾸 밀리네`],
      [`아직 어제 위지만`, `계속 까먹는 중`, `버텨줘`],
    ],
    en: [
      [`Still above yesterday`, `but sliding`],
      [`Above yesterday, sure`, `but giving it up`, `hold on`],
    ],
  },

  // ---- 개장 전 흐름까지 아는 문구 ----
  // 갭(전일 종가 -> 시가)만 보면 '어디서 열었나'만 알 수 있고,
  // 열기 직전까지 어느 쪽으로 흐르고 있었는지는 모른다.
  // 프리장 방향을 함께 보면 '개장 후 갑자기 뒤집힌 것'과 '아까부터 그랬던 것'을 구분할 수 있다.
  preFadeContinued: {
    ko: [
      [`열기 전부터 밀리더니`, `열리고도 그대로네`],
      [`아까부터 계속 흘러내리는 중`, `언제 멈추려나`],
    ],
    en: [
      [`Was sliding before the bell`, `and just kept going`],
      [`Bleeding since before the open`, `when does it stop`],
    ],
  },
  preRallyReversed: {
    ko: [
      [`열기 직전까진 좋았는데`, `막상 열리니까 뒤집혔다`],
      [`분위기 좋다가`, `종 치자마자 밀리네`, `뭐야 이거`],
    ],
    en: [
      [`Looked good right up to the bell`, `then flipped`],
      [`All fine until the open`, `and down it went`, `seriously?`],
    ],
  },
  preFadeReversed: {
    ko: [
      [`열기 전엔 계속 빠지더니`, `열리고 나서 살아나네`, `이런 날도 있구나`],
      [`아까까진 최악이었는데`, `열고 반등 중`],
    ],
    en: [
      [`Kept falling before the bell`, `then turned after the open`, `didn't expect that`],
      [`Looked awful earlier`, `bouncing since the open`],
    ],
  },
  preRallyContinued: {
    ko: [
      [`열기 전부터 좋더니`, `그대로 밀고 가네`, `계속 가자`],
      [`아까부터 분위기 좋았는데`, `열고도 이어진다`],
    ],
    en: [
      [`Strong before the bell`, `and still pushing`, `keep going`],
      [`Good vibes earlier`, `carried right through the open`],
    ],
  },
  preWildThenQuiet: {
    ko: [
      [`열기 전엔 요동치더니`, `정작 열리니까 잠잠하네`],
      [`아까 그렇게 흔들리고`, `지금은 조용`, `뭐지`],
    ],
    en: [
      [`Wild before the bell`, `dead quiet since the open`],
      [`All that thrashing earlier`, `now nothing`, `huh`],
    ],
  },

  quiet: {
    ko: [
      [`계속 제자리`, `이렇게 조용해도 되나`, `불안한데`],
      [`아무일도 안 일어남`, `이러다 갑자기 튀지`],
      [`숨만 쉬는 중`, `누가 먼저 움직이나 보자`],
    ],
    en: [
      [`Going nowhere`, `is it supposed to be this quiet`, `feels off`],
      [`Absolutely nothing happening`, `so it'll snap later`],
      [`Just breathing`, `who blinks first`],
    ],
  },
  diverging: {
    ko: [
      [`둘이 딴 데 보고있네`, `누구 말을 믿어야 하나`],
      [`나스닥이랑 S&P가`, `따로 노는 중`, `헷갈린다`],
    ],
    en: [
      [`These two disagree`, `who do I believe`],
      [`Nasdaq and S&P`, `going separate ways`, `confusing`],
    ],
  },
  // 아래 세 가지는 "창의 앞쪽"을 가리키는 표현이 들어가므로,
  // 창이 개장에서 시작할 때(open)와 장 중일 때(roll)를 나눠 둔다.
  fadeFromHigh: {
    ko: {
      open: [
        [`출발은 좋았는데`, `왜 자꾸 밀리냐`],
        [`아까 그 기세 어디감`, `...`],
      ],
      roll: [
        [`잘 가더니 갑자기`, `왜 자꾸 밀리냐`],
        [`위에서부터 계속 흘러내림`, `잠깐 쉬는거였으면`],
        [`아까 그 기세 어디감`, `...`],
      ],
    },
    en: {
      open: [[`Started so well`, `why does it keep sliding`], [`Where'd that momentum go`, `...`]],
      roll: [[`Was going fine, then`, `why does it keep sliding`], [`Where'd that momentum go`, `...`]],
    },
  },
  bounceFromLow: {
    ko: {
      open: [
        [`열자마자 훅 빠지더니`, `슬금슬금 올라오는 중`, `이대로 가자`],
        [`바닥 찍고 기어올라옴`, `살아나는건가 이거`],
      ],
      roll: [
        [`훅 빠지더니`, `슬금슬금 올라오는 중`, `이대로 가자`],
        [`바닥 찍고 기어올라옴`, `살아나는건가 이거`],
      ],
    },
    en: {
      open: [[`Dumped at the open`, `crawling back now`, `keep going`], [`Bottomed and climbing`, `waking up?`]],
      roll: [[`Dumped, then`, `crawling back now`, `keep going`], [`Bottomed and climbing`, `waking up?`]],
    },
  },
  recovered: {
    ko: {
      open: [
        [`초반엔 흔들리더니`, `결국 올라왔네`, `버틴 보람이 있다`],
        [`아침에 놀랐는데`, `다시 위로`, `휴...`],
      ],
      roll: [
        [`흔들리더니`, `결국 올라왔네`, `버틴 보람이 있다`],
        [`아까 놀랐는데`, `다시 위로`, `휴...`],
      ],
    },
    en: {
      open: [[`Shaky start`, `but it came back`, `worth holding on`], [`Scared me earlier`, `back up now`, `phew`]],
      roll: [[`Wobbled, then`, `came right back`, `worth holding on`], [`Scared me earlier`, `back up now`, `phew`]],
    },
  },
  sinking: {
    ko: [
      [`계속 아래로만`, `멈출 생각을 안하네`],
      [`바닥에서 못 올라옴`, `여기서 그만 좀...`],
      [`빨간건 어디갔나`, `온통 파랗다`],
    ],
    en: [
      [`Just keeps going down`, `no sign of stopping`],
      [`Stuck at the bottom`, `please stop here`],
      [`All red, no green`, `great`],
    ],
  },
  drifting: {
    ko: [
      [`슬금슬금 흘러내리는 중`, `어디서 멈추려나`],
      [`조금씩 새고 있음`, `티 안나게 아프다`],
    ],
    en: [
      [`Slowly leaking lower`, `where does it stop`],
      [`Quietly bleeding`, `the worst kind`],
    ],
  },
  coolingOff: {
    ko: [
      [`확 올랐다가 식는 중`, `그래도 아직 위`, `지켜라 제발`],
      [`아까가 고점이었나`, `그래도 나쁘진 않네`],
    ],
    en: [
      [`Popped then cooled`, `still green though`, `hold it please`],
      [`Was that the top?`, `not bad still`],
    ],
  },
  climbing: {
    ko: [
      [`계속 위로 간다`, `오늘은 좀 다르네`, `쭉 가자`],
      [`꾸준히 올라가는 중`, `이런 날도 있어야지`],
    ],
    en: [
      [`Straight up`, `today feels different`, `keep it going`],
      [`Grinding higher`, `we needed this`],
    ],
  },
  rising: {
    ko: [
      [`천천히 올라가는 중`, `나쁘지 않아`],
      [`살살 올라가네`, `이대로만`],
    ],
    en: [
      [`Drifting up`, `not bad`],
      [`Easing higher`, `just stay like this`],
    ],
  },
};

// ---------- 주간 되돌아보기 + 다음 주 바람 ----------
// 주말 편. 이번 주가 어땠는지 한 줄, 다음 주엔 어땠으면 좋겠는지 한 줄.
// 역시 숫자는 쓰지 않는다.
const WEEK_POOL = {
  hardDown: {
    ko: [
      [`이번 주는 좀 아팠다`, `다음 주엔 좀 쉬어가자`],
      [`한 주 내내 밀렸네`, `다음 주엔 반등 좀`],
      [`계좌가 많이 야위었다`, `다음 주엔 살 좀 붙자`],
    ],
    en: [
      [`Rough week`, `let's ease up next week`],
      [`Down all week`, `give us a bounce next week`],
    ],
  },
  mildDown: {
    ko: [
      [`조금씩 흘러내린 한 주`, `다음 주엔 방향 좀 잡자`],
      [`크게 다치진 않았지만`, `다음 주엔 웃어보자`],
    ],
    en: [
      [`Slowly bled all week`, `let's find a direction next week`],
      [`Not badly hurt, but`, `let's smile next week`],
    ],
  },
  choppy: {
    ko: [
      [`오르락내리락만 하다 끝난 주`, `다음 주엔 한쪽으로 좀`],
      [`왔다갔다 정신없었다`, `다음 주는 좀 순하게`],
    ],
    en: [
      [`All chop, no progress`, `pick a side next week`],
      [`Whipsawed all week`, `go easy on us next week`],
    ],
  },
  mildUp: {
    ko: [
      [`조용히 잘 버틴 한 주`, `다음 주도 이대로만`],
      [`나쁘지 않았다`, `다음 주엔 좀 더 가보자`],
    ],
    en: [
      [`Quietly held up`, `just keep this next week`],
      [`Not bad at all`, `let's push a bit next week`],
    ],
  },
  strongUp: {
    ko: [
      [`오랜만에 기분 좋은 주`, `다음 주도 부탁해`],
      [`이번 주는 잘 갔다`, `다음 주엔 더 가자`],
    ],
    en: [
      [`Best week in a while`, `same again next week please`],
      [`Strong week`, `let's go further next week`],
    ],
  },
  // 주 중반까지 올랐다가 후반에 무너진 주 — 가장 흔하면서
  // '내내 밀렸다'로 뭉뚱그리면 사실과 어긋나는 모양이다.
  gaveItBack: {
    ko: [
      [`중간까진 좋았는데`, `후반에 다 반납했다`, `다음 주엔 좀 지켜내자`],
      [`잘 가다가 막판에 무너짐`, `다음 주엔 끝까지 가보자`],
    ],
    en: [
      [`Great until midweek`, `gave it all back after`, `let's hold it next week`],
      [`Fine until it broke late`, `let's finish strong next week`],
    ],
  },
  // 초반에 밀렸다가 후반에 살아난 주
  cameBack: {
    ko: [
      [`초반엔 힘들었는데`, `끝은 나쁘지 않았다`, `다음 주도 이렇게`],
      [`중간에 포기할 뻔`, `그래도 살아났네`, `다음 주엔 편하게 가자`],
    ],
    en: [
      [`Rough start`, `but it finished fine`, `same again next week`],
      [`Almost gave up midweek`, `it came back`, `let's cruise next week`],
    ],
  },
};

export function buildWeeklyComment(nasdaq, seedStr = '') {
  const st = nasdaq.stats;
  const sh = shapeOf(nasdaq);
  const seed = seedOf(seedStr || String(nasdaq.bars[0].t));
  const p = st.pctFromOpen;
  const mixed = st.upDays >= 2 && st.downDays >= 2;

  let key;
  // 모양을 먼저 본다. 주간 등락률만 보면 "올랐다 반납한 주"를 "내내 밀린 주"로 쓰게 된다.
  if (sh.peakedEarly && p < -0.4) key = 'gaveItBack';
  else if (sh.troughEarly && p > 0.4) key = 'cameBack';
  else if (p <= -2) key = 'hardDown';
  else if (p <= -0.4) key = mixed ? 'choppy' : 'mildDown';
  else if (p < 0.4) key = 'choppy';
  else if (p < 2) key = 'mildUp';
  else key = 'strongUp';

  const g = WEEK_POOL[key];
  return { ko: pick(g.ko, seed), en: pick(g.en, seed) };
}

// ctx: { pendingEvent:{title_ko,title_en}, recentNews:{title_ko,title_en} }
// 절차서에서 채워 넣는다. 없으면 순수하게 차트 모양에만 반응한다.
export function buildComment(nasdaq, sp500, ctx = {}, seedStr = '') {
  const sh = shapeOf(nasdaq);
  const seed = seedOf(seedStr || String(nasdaq.bars[0].t));
  const p = sh.pct;
  const down = p < -0.05;
  const up = p > 0.05;
  const spPct = sp500.stats.pctFromOpen;
  const diverging = (p < -0.05 && spPct > 0.05) || (p > 0.05 && spPct < -0.05);

  // 창이 개장에서 시작하면 '개장 직후' 화법, 아니면 장 중 화법을 쓴다.
  const variant = ctx.atOpen ? 'open' : 'roll';
  const resolve = (side, arg) => {
    if (typeof side === 'function') return side(arg);
    if (Array.isArray(side)) return side;
    return side[variant] || side.roll || side.open;
  };
  const out = (key, arg) => {
    const g = POOL[key];
    return {
      ko: pick(resolve(g.ko, arg.ko), seed),
      en: pick(resolve(g.en, arg.en), seed),
    };
  };

  if (ctx.pendingEvent) {
    // 앞으로 있을 이벤트는 인과 주장이 아니라 "대기 중"이라는 상태 묘사라 그대로 둔다.
    const a = { ko: ctx.pendingEvent.title_ko, en: ctx.pendingEvent.title_en };
    return out(sh.quiet ? 'pendingQuiet' : 'pendingMoving', a);
  }

  // ---- 차트 모양을 먼저 본다 — 뉴스 유무와 무관하게 항상 이 판정을 거친다 ----
  // (예전엔 ctx.recentNews 가 있으면 이 판정을 통째로 건너뛰고 "그 뉴스 때문에
  //  오르네/빠지네"로 단정했다. 좋은 뉴스인데 창이 근소하게 빨갛다는 이유만으로
  //  "이거 때문에 빠지네"가 나온 사고가 있었다 — 인과가 거꾸로였다.)
  const base = (() => {
    // 세션 안에서 뚜렷한 방향 전환(초반 고점→하락, 또는 초반 저점→반등)이
    // 있었는지를 밤사이 흐름 서사보다 먼저 본다 — 이 스토리의 요점은 지금 이
    // 순간이라, 몇 시간 전 프리장 방향보다 그 뒤에 일어난 전환이 더 현재를
    // 대표한다. "고점에서 얼마나 빠졌나"(fadeFromHighPct)와 "저점에서 얼마나
    // 올라왔나"(bounceFromLowPct)를 후보로 두고 점수(되돌린 폭)가 더 큰 쪽을
    // 쓴다 — 조건을 우선순위로 하나씩 쌓는 대신, 두 후보 중 지금 궤적에 더 잘
    // 맞는 쪽을 고르는 방식이다. 어느 쪽도 REVERSAL 이상으로 되돌리지 못했다면
    // "뚜렷한 전환"이라 부를 근거가 없다는 뜻이라 아래 단조 흐름 판정으로 넘어간다.
    const REVERSAL = 0.15;
    const { fadeFromHighPct, bounceFromLowPct } = sh;
    if (fadeFromHighPct >= REVERSAL || bounceFromLowPct >= REVERSAL) {
      if (fadeFromHighPct >= bounceFromLowPct) return out(down ? 'fadeFromHigh' : 'coolingOff', {});
      return out(down ? 'bounceFromLow' : 'recovered', {});
    }

    const ov0 = nasdaq.overnight;

    // 개장 전 흐름을 먼저 본다 — '아까부터 그랬던 것'과 '열자마자 뒤집힌 것'은 다른 이야기다.
    if (ov0 && ov0.preDirPct != null && ov0.preBars >= 60) {
      const preDir = ov0.preDirPct;
      const preWild = (ov0.preRangePct ?? 0) >= 0.8;
      const PRE_MOVE = 0.15;

      if (preWild && sh.quiet) return out('preWildThenQuiet', {});
      if (preDir <= -PRE_MOVE && down) return out('preFadeContinued', {});
      if (preDir >= PRE_MOVE && down) return out('preRallyReversed', {});
      if (preDir <= -PRE_MOVE && up) return out('preFadeReversed', {});
      if (preDir >= PRE_MOVE && up) return out('preRallyContinued', {});
    }

    if (sh.quiet) return out('quiet', {});
    if (diverging) return out('diverging', {});

    // 밤사이 흐름을 아는 문구를 먼저 시도한다.
    // 갭이 뚜렷하거나 전일 종가와 확실히 떨어져 있을 때만 쓴다 — 애매하면 창 모양으로 넘긴다.
    const ov = nasdaq.overnight;
    if (ov && ov.gapPct != null) {
      const gap = ov.gapPct;
      const vsPrev = ov.nowVsPrevPct;
      const BIG_GAP = 0.3;
      if (gap <= -BIG_GAP && down) return out('gapDownFalling', {});
      if (gap <= -BIG_GAP && up) return out('gapDownRecovering', {});
      if (gap >= BIG_GAP && up) return out('gapUpHolding', {});
      if (gap >= BIG_GAP && down) return out('gapUpFading', {});
      if (vsPrev <= -0.25 && up) return out('belowPrevRising', {});
      if (vsPrev >= 0.25 && down) return out('abovePrevFalling', {});
    }
    // 여기까지 왔다면 뚜렷한 방향 전환은 없었다는 뜻이다 — 지금 방향으로
    // 쭉 온 단조 흐름이니, 세션 극값 근처인지로만 표현 세기를 가른다.
    if (down && sh.nearLow) return out('sinking', {});
    if (down) return out('drifting', {});
    if (up && sh.nearHigh) return out('climbing', {});
    return out('rising', {});
  })();

  // ---- 그 다음, 뉴스를 "이거 때문인가?" 정도로만 얹는다 — 기본은 안 붙인다 ----
  // 2026-08-27 두 차례 사고로 확인된 두 가지 문제:
  //  ① ctx.recentNews 가 있으면 그 순간의 등락 부호만 보고 "그 뉴스 때문에
  //     오르네/빠지네"로 단정했다 (엔비디아의 좋은 실적을 "이거 때문에
  //     빠지네"로 엮음 — 인과가 거꾸로였다).
  //  ② ①을 "이거 때문인가?"라는 추측형으로 바꿔도, 이 스토리는 항상 개장
  //     후 19분 창에서 도는데 실적은 항상 전날 마감 후에 나와 그 시점엔
  //     이미 몇 시간~반나절 지난 뉴스다. 그 뉴스의 실제 효과(갭)는 이미
  //     차트가 "위로 열었는데"로 보여주고 있고, 지금 이 순간의 되돌림은
  //     뉴스와 무관한 라이브 수급이다 — 오래된 뉴스를 라이브 움직임에
  //     다시 갖다붙이는 억지였다.
  // 그래서 기본값은 "붙이지 않음"이다. 뉴스가 지금도 여전히 이 순간의
  // 움직임을 설명한다고 확신할 때만(대략 창 시작 기준 1~2시간 이내에 나온
  // 뉴스, 또는 그 자산이 지금도 그 뉴스로 튀는 게 화면에 보일 때)
  // recentNews.stillMoving = true 를 절차서 3단계에서 명시적으로 넣는다.
  // 전날 마감 후~오늘 개장 전 실적처럼 이미 지난 뉴스는 stillMoving 을
  // 넣지 않는다 — 갭이 이미 그 이야기를 하고 있다.
  if (ctx.recentNews && ctx.recentNews.stillMoving && sh.big) {
    const tagKo = pick(POOL.newsMaybe.ko(ctx.recentNews.title_ko), seed);
    const tagEn = pick(POOL.newsMaybe.en(ctx.recentNews.title_en), seed);
    const cap = (arr, tag) => (arr.length >= 3 ? [...arr.slice(0, 2), tag] : [...arr, tag]);
    return { ko: cap(base.ko, tagKo), en: cap(base.en, tagEn) };
  }
  return base;
}
