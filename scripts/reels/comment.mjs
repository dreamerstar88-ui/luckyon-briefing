// comment.mjs
// "주린이가 차트 보다가 스마트폰으로 찍어서 펜으로 갈겨쓴 한마디"를 만든다.
//
// 원칙
//  - 짧고 끊어지는 구어체. 완결된 문장으로 정리하지 않는다 ("~습니다" 금지).
//  - 지금 화면에 보이는 것만 말한다. 전망·매매 판단은 하지 않는다.
//  - 상황(지표 발표 전/후, 뉴스 유무)에 따라 말투가 달라진다.

// 30분 궤적의 '모양'을 판정한다.
// 시가 대비 등락만 보면 "올랐다 밀린" 흐름을 "계속 내린" 것으로 잘못 쓰게 된다.
export function shapeOf(sym) {
  const b = sym.bars;
  const open = b[0].o;
  const last = b[b.length - 1].c;
  const n = b.length;
  const third = Math.max(1, Math.floor(n / 3));
  const avg = (arr) => arr.reduce((s, x) => s + x.c, 0) / arr.length;
  const early = avg(b.slice(0, third));
  const late = avg(b.slice(-third));

  let hiIdx = 0, loIdx = 0;
  b.forEach((x, i) => {
    if (x.h > b[hiIdx].h) hiIdx = i;
    if (x.l < b[loIdx].l) loIdx = i;
  });

  const pct = ((last - open) / open) * 100;
  const hi = Math.max(...b.map((x) => x.h));
  const lo = Math.min(...b.map((x) => x.l));
  const rangePct = ((hi - lo) / open) * 100;
  const earlyPct = ((early - open) / open) * 100;
  const latePct = ((late - open) / open) * 100;

  // 마지막 5분이 직전 대비 어느 쪽으로 움직였는지 (지금 이 순간의 결)
  const tailFrom = Math.max(0, n - 5);
  const tailPct = ((last - b[tailFrom].o) / b[tailFrom].o) * 100;

  return {
    pct, rangePct, earlyPct, latePct, tailPct, hiIdx, loIdx, n,
    peakedEarly: hiIdx < n * 0.45 && latePct < earlyPct - 0.05,
    troughEarly: loIdx < n * 0.45 && latePct > earlyPct + 0.05,
    quiet: rangePct < 0.25,
    nearHigh: (last - lo) / (hi - lo || 1) >= 0.75,
    nearLow: (last - lo) / (hi - lo || 1) <= 0.25,
  };
}

const pctTxt = (p) => `${p > 0 ? '+' : ''}${p.toFixed(2)}%`;

// ctx: { pendingEvent, recentNews } — 절차서에서 채워 넣는다 (없으면 순수 차트 반응)
//   pendingEvent: { title_ko, title_en }  아직 발표 전인 주요 지표
//   recentNews:   { title_ko, title_en }  방금 나온 뉴스
export function buildComment(nasdaq, sp500, ctx = {}) {
  const sh = shapeOf(nasdaq);
  const p = sh.pct;
  const down = p < -0.05;
  const up = p > 0.05;
  const spPct = sp500.stats.pctFromOpen;
  const diverging = (p < -0.05 && spPct > 0.05) || (p > 0.05 && spPct < -0.05);
  const v = pctTxt(p);

  // 1) 아직 발표 전인 지표가 있으면 그게 최우선 관심사
  if (ctx.pendingEvent) {
    const e = ctx.pendingEvent;
    return {
      ko: sh.quiet
        ? [`${e.title_ko} 앞두고`, `다들 눈치만 보는 중...`, `발표 후 어디로 갈건지??`]
        : [`${e.title_ko} 아직 남았는데`, `벌써 ${v}...`, `발표 후에 어떻게 될지?`],
      en: sh.quiet
        ? [`Everyone frozen ahead of`, `${e.title_en}...`, `which way after it drops??`]
        : [`${e.title_en} still ahead`, `and already ${v}...`, `what happens after??`],
    };
  }

  // 2) 방금 나온 뉴스가 있으면 그 영향으로 읽는다
  if (ctx.recentNews) {
    const nws = ctx.recentNews;
    if (down) {
      return {
        ko: [`${nws.title_ko}`, `이 뉴스로 빠지네요...`, `${v} 어디까지 갈지??`],
        en: [`${nws.title_en}`, `— and down it goes...`, `${v}. how far??`],
      };
    }
    if (up) {
      return {
        ko: [`${nws.title_ko}`, `이 뉴스에 오르네요!`, `${v} 이거 계속 갈까??`],
        en: [`${nws.title_en}`, `— and up it goes!`, `${v}. does it hold??`],
      };
    }
    return {
      ko: [`${nws.title_ko}`, `나왔는데 별 반응 없네...`, `${v} 뭐지??`],
      en: [`${nws.title_en}`, `and barely a reaction...`, `${v}. huh??`],
    };
  }

  // 3) 그 외에는 차트 모양 자체에 반응한다
  if (sh.quiet) {
    return {
      ko: [`30분째 제자리 (${v})`, `너무 조용한데...`, `이러다 갑자기 튀는거 아냐??`],
      en: [`30 min, going nowhere (${v})`, `way too quiet...`, `calm before something??`],
    };
  }
  if (diverging) {
    return {
      ko: [`나스닥이랑 S&P가`, `서로 딴 데 보고있네...`, `대체 어느 쪽이 맞는거야??`],
      en: [`Nasdaq and S&P`, `pointing opposite ways...`, `which one's right??`],
    };
  }
  if (sh.peakedEarly && down) {
    return {
      ko: [`출발은 좋았는데`, `고점 찍고 계속 밀리네...`, `${v} 잠깐 쉬는거면 좋겠다`],
      en: [`Started fine, then`, `peaked and kept sliding...`, `${v} just a breather??`],
    };
  }
  if (sh.troughEarly && down) {
    return {
      ko: [`열자마자 훅 빠지더니`, `조금씩 올라오는 중 (${v})`, `이거 반등 맞나??`],
      en: [`Dumped right at the open,`, `crawling back now (${v})`, `is this a bounce??`],
    };
  }
  if (sh.troughEarly && up) {
    return {
      ko: [`초반에 흔들리더니`, `결국 시가 위로 (${v})`, `이 분위기 계속 가나??`],
      en: [`Shaky start but`, `back above open (${v})`, `does this keep up??`],
    };
  }
  if (down && sh.nearLow) {
    return {
      ko: [`계속 아래로만...`, `저점에서 못 벗어나네 (${v})`, `여기서 더 빠지나??`],
      en: [`Just keeps sinking...`, `stuck at the lows (${v})`, `more downside??`],
    };
  }
  if (down) {
    return {
      ko: [`슬금슬금 흘러내리는 중`, `(${v})`, `어디서 멈추려나...`],
      en: [`Bleeding lower, slowly`, `(${v})`, `where does it stop...`],
    };
  }
  if (sh.peakedEarly && up) {
    return {
      ko: [`확 올랐다가 좀 식었는데`, `그래도 아직 위 (${v})`, `이거 지킬 수 있나??`],
      en: [`Popped, then cooled off,`, `still green though (${v})`, `can it hold??`],
    };
  }
  if (up && sh.nearHigh) {
    return {
      ko: [`계속 위로 가는 중!`, `(${v}) 고점 근처`, `이대로 쭉 가는거야??`],
      en: [`Grinding straight up!`, `(${v}) near the highs`, `does it just keep going??`],
    };
  }
  return {
    ko: [`위쪽으로 흐르는 중 (${v})`, `나쁘지 않은데...`, `계속 갈까??`],
    en: [`Drifting higher (${v})`, `not bad so far...`, `does it stick??`],
  };
}
