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

  return {
    pct,
    rangePct: ((hi - lo) / open) * 100,
    peakedEarly: hiIdx < n * 0.45 && latePct < earlyPct - 0.05,
    troughEarly: loIdx < n * 0.45 && latePct > earlyPct + 0.05,
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
  newsDown: {
    ko: (n) => [
      [`${n}`, `이거 때문에 빠지네`, `어디까지 가려고...`],
      [`${n}`, `뜨자마자 쭉 미끄러짐`, `아 진짜...`],
    ],
    en: (n) => [
      [`${n}`, `and down it goes`, `how far...`],
      [`${n}`, `dropped the second it hit`, `ugh`],
    ],
  },
  newsUp: {
    ko: (n) => [
      [`${n}`, `이걸로 올라가네!`, `계속 가줬으면`],
      [`${n}`, `뜨자마자 튀어오름`, `오랜만이다 이런거`],
    ],
    en: (n) => [
      [`${n}`, `and up it goes!`, `keep going please`],
      [`${n}`, `popped right on the headline`, `been a while`],
    ],
  },
  newsFlat: {
    ko: (n) => [
      [`${n}`, `나왔는데 반응이 없네`, `다들 관심 없나`],
    ],
    en: (n) => [
      [`${n}`, `and... nothing`, `nobody cares?`],
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
      [`위로 흐르는 중`, `나쁘지 않아`],
      [`살살 올라가네`, `이대로만`],
    ],
    en: [
      [`Drifting up`, `not bad`],
      [`Easing higher`, `just stay like this`],
    ],
  },
};

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
    const a = { ko: ctx.pendingEvent.title_ko, en: ctx.pendingEvent.title_en };
    return out(sh.quiet ? 'pendingQuiet' : 'pendingMoving', a);
  }
  if (ctx.recentNews) {
    const a = { ko: ctx.recentNews.title_ko, en: ctx.recentNews.title_en };
    return out(down ? 'newsDown' : up ? 'newsUp' : 'newsFlat', a);
  }

  if (sh.quiet) return out('quiet', {});
  if (diverging) return out('diverging', {});
  if (sh.peakedEarly && down) return out('fadeFromHigh', {});
  if (sh.troughEarly && down) return out('bounceFromLow', {});
  if (sh.troughEarly && up) return out('recovered', {});
  if (down && sh.nearLow) return out('sinking', {});
  if (down) return out('drifting', {});
  if (sh.peakedEarly && up) return out('coolingOff', {});
  if (up && sh.nearHigh) return out('climbing', {});
  return out('rising', {});
}
