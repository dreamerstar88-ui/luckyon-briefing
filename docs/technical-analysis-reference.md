# 기술적 차트 분석(TA) 참고 문서 — luckyon-briefing `comment.mjs` 개선용

이 문서는 `scripts/reels/comment.mjs`가 나스닥/S&P 선물 1분봉을 보고 손글씨 코멘트를 생성할 때 쓸 수 있는
기술적 차트 분석(technical analysis) 기법을 폭넓게 조사하고, "1분봉 수십 개짜리 짧은 창" 안에서 실제로
계산 가능한 형태로 정리한 것이다. 저장소에 커밋하지 않는 로컬 참고 자료다.

## 0. 전제와 오늘 사고 케이스

**데이터 형태**: `fetch-window.mjs`가 만드는 `bars`는 `{ t, o, h, l, c, v }`(시각, 시가, 고가, 저가, 종가,
거래량) 배열이다. `comment.mjs`가 다루는 창은 보통 개장 후 19분(약 19개 봉) ~ 장중 롤링 몇십 개 봉 수준으로
매우 짧다. 이 문서의 모든 "계산 가능성" 판단은 "이 정도 길이의 배열 하나만 가지고, 무거운 라이브러리 없이
순수 JS로" 라는 조건을 기준으로 한다.

**오늘 사고**: 나스닥 선물이 29,589~29,605 구간을 여러 번 건드리기만 하고 뚫지 못한 채 되돌아왔다. 이건
전형적인 "저항선 다중 터치 + 돌파 실패(rejection)" 상황인데, 스크립트에는 지지/저항·돌파 개념이 아예 없어서
`fadeFromHighPct`/`bounceFromLowPct`류의 "고점 대비 되돌림" 판정만 돌다가 `gapUpHolding`("위로 열고 그대로
밀고 가는 중") 같은 낙관적 지속형 문구로 잘못 표현됐다. 이 케이스는 아래 **2장(지지·저항)**과 **3장(돌파
판정)**에서 구체적으로 다시 다룬다.

**공통 함정**: 1분봉 20~40개짜리 창은 노이즈가 매우 크다. 검색 결과에서도 "1분봉은 진짜 신호 하나당
가짜 신호가 수십 개"라는 지적이 반복적으로 나온다(FX2 Funding, American Dream Trading 등). 이 창에서
쓸 계산은 전부 아래 원칙을 따라야 한다.
- 극값(고가/저가) 1틱보다는 종가 기준, 혹은 최근 N봉 평균으로 판정한다(이미 `shapeOf`가 하고 있음).
- "패턴이 있다"고 우기기보다 "패턴이 없다/불확실하다"를 기본값으로 둔다 — 짧은 창에서 헤드앤숄더나 삼각형
  같은 다봉(多峰) 패턴을 억지로 찾으면 과적합된 가짜 신호만 늘어난다.
- 이동평균·RSI·MACD 등 표준 기간(20, 14, 26...) 지표는 30봉 안팎에서는 warm-up이 안 끝나거나 극단값만
  나온다 — 기간을 창 길이에 맞게 줄이거나 아예 쓰지 않는 편이 낫다.

---

## 1. 추세 분석 — 추세선, 채널, 다우 이론

**추세선(trendline)**: 상승추세에서는 연속된 스윙 저점 2개 이상을 이은 직선(지지 추세선), 하락추세에서는
연속된 스윙 고점 2개 이상을 이은 직선(저항 추세선). 기울기가 추세의 방향과 속도를 보여준다.

**채널(channel)**: 추세선과 평행한 반대편 선을 하나 더 그어 상단·하단 두 선 사이에 가격이 오가는 구간.
상승채널/하락채널/수평채널(레인지, 박스권)로 나뉜다.

**다우 이론 핵심 원칙**(6개 정도로 요약됨):
1. 시장은 모든 것을 반영한다(지수가 이미 모든 정보를 가격에 담고 있다).
2. 추세는 3가지 층위로 존재한다 — 1차 추세(수개월~수년), 2차 추세(수주~수개월, 1차 추세에 대한 조정),
   3차 추세(수일 이하, 노이즈에 가까움).
3. 1차 추세는 3국면(축적 → 대중 참여 → 분산)을 거친다.
4. 지수(평균)는 서로 확인해야 한다(다우 산업평균과 운송평균이 같은 방향을 가리켜야 신뢰).
5. 거래량이 추세를 확인해야 한다 — 상승추세면 오를 때 거래량 증가·내릴 때 감소, 하락추세면 반대.
6. 추세는 명확한 반전 신호가 나오기 전까지 유효하다고 가정한다.

**계산 가능성**: 순수한 다우 이론(1차/2차/3차 추세 구분, 지수 간 확인)은 "몇 달~몇 년" 스케일 개념이라
19분~수십 분 창에는 원리 그대로 적용할 수 없다. 다만 **원칙 2, 5, 6은 축소된 형태로 쓸 수 있다**:
- 원칙 5(거래량 확인)는 그대로 가져올 수 있다: 방향 전환 시점의 거래량이 그 전 N봉 평균보다 높은지 체크.
- 원칙 4(지수 간 확인)는 지금 스크립트의 `diverging` 판정이 이미 이걸 하고 있다(나스닥 vs S&P).
- 추세선/채널 자체는 계산 가능하다: 스윙 저점(또는 고점) 2개 이상을 골라 최소자승 회귀(linear regression)
  또는 단순히 두 점을 직선으로 잇고, 최근 종가가 그 직선의 어느 쪽에 있는지로 "추세선 상단/하단 이탈" 여부를
  판정할 수 있다. 짧은 창에서는 점이 2~3개뿐이라 통계적 신뢰도는 낮지만, "지금 캔들이 최근 저점들을 이은
  선 아래로 내려갔다" 같은 정성적 신호는 낼 수 있다.

**짧은 창 함정**: 스윙점이 2~3개밖에 안 나올 수 있어 추세선 자체가 불안정하다(점을 하나만 바꿔도 기울기가
크게 흔들림). 채널은 최소 4개 접점(상단 2, 하단 2)이 필요한데 30분 안에 이만큼 나오는 경우는 드물다 — 채널
판정은 이 창 길이에서는 거의 항상 "판정 불가"로 처리하는 게 맞다.

---

## 2. 지지·저항 — 스윙 고점/저점, 피봇 포인트, 심리적 가격대, 역할 전환, 다중 터치

**스윙 고점/저점(swing high/low)**: 좌우 N개 봉보다 고가(저가)가 더 높은(낮은) 지점. 표준적으로는
"프랙탈(fractal)" 정의를 쓴다 — Bill Williams Fractal은 N=2(좌우 2봉씩, 총 5봉 창)가 고전값. 공식:
`스윙 고점(i) = h[i] > h[i-1] && h[i] > h[i-2] && h[i] > h[i+1] && h[i] > h[i+2]` (N은 조절 가능). 프랙탈은
확정되려면 이후 N봉이 더 나와야 하므로(2봉 뒤에야 "그 봉이 스윙고점이었다"를 알 수 있음) 항상 N봉만큼
지연 확인되는 지표다.

**피봇 포인트(pivot point)**: 전일 고가·저가·종가로 오늘의 지지/저항 후보 가격을 미리 계산하는 방법.
`PP = (전일고가 + 전일저가 + 전일종가) / 3`, `R1 = 2×PP − 전일저가`, `S1 = 2×PP − 전일고가`,
`R2 = PP + (전일고가−전일저가)`, `S2 = PP − (전일고가−전일저가)`. 원래 데이 트레이더용으로 만들어진
지표라 이 스크립트 맥락(전일 종가 정보 이미 있음 — `overnight` 필드)과 궁합이 좋다.

**심리적 가격대(라운드 넘버)**: 사람이 기억하기 쉬운 정수·반올림 단위(나스닥 선물이면 29,600 같은 100
단위, 크게는 1000 단위)에서 매수·매도 주문이 몰려 실제로 지지/저항처럼 작동하는 현상("더블 제로"라고도
불림). 순수하게 심리적 근거지만 실전에서 반복 관찰된다.

**지지·저항 역할 전환(role reversal / polarity flip)**: 저항선이 뚫리면 그 뒤로는 지지선이 되고, 지지선이
무너지면 그 뒤로는 저항선이 된다는 원칙. "돌파 후 되돌아와서 그 레벨에서 다시 튀는지"를 보면 돌파의
진위를 검증하는 용도로도 쓰인다(예: 저항 돌파 후 눌림에서 그 가격대가 지지로 작동하면 돌파가 진짜였을
가능성이 높음, 다시 뚫고 내려가면 가짜 돌파였을 가능성).

**다중 터치(multiple touch)의 의미**: 같은 가격대를 여러 번 건드리고도 뚫지 못하면 그 레벨의 "강도"가
세다는 신호로 해석하는 게 전통적 견해다(더 많은 참여자가 그 가격을 지지/저항으로 인식하고 있다는 뜻).
다만 실전에서는 "여러 번 건드릴수록 다음엔 뚫릴 확률이 올라간다"는 반대 해석도 있다 — 매물이 계속
소진되기 때문. 어느 쪽이든 "여러 번 건드리고도 못 뚫었다"는 사실 자체는 "그대로 계속 밀고 간다"와
정반대의 상태이므로, 최소한 "지속형" 서술을 자동으로 배제하는 근거로는 확실히 쓸 수 있다.

**계산 가능성 — 이 창에서 실전 적용 가장 유력한 항목**:
- 스윙 고점/저점: 위 프랙탈 공식으로 계산 가능. N=1~2 정도로 낮춰야 20~40봉 창에서 점이 나온다.
- **저항/지지 "구간"(zone) 클러스터링**: 오늘 사고를 직접 잡아낼 수 있는 로직. 고가들을 좁은 밴드(예:
  가격의 0.05~0.1% 폭)로 묶어서, 같은 밴드 안에 봉의 고가가 K회 이상(예: 3회 이상) 들어오는지 카운트.
  의사코드:
  ```js
  function findTouchZone(bars, bandPct = 0.001, minTouches = 3) {
    const highs = bars.map(b => b.h);
    // 상위 근접값들을 정렬 후 인접한 값끼리 밴드로 묶는다
    const sorted = [...highs].sort((a, b) => a - b);
    // sliding window로 bandPct 폭 안에 minTouches개 이상 모이는 구간을 찾는다
    for (let i = 0; i + minTouches - 1 < sorted.length; i++) {
      const lo = sorted[i], hi = sorted[i + minTouches - 1];
      if ((hi - lo) / lo <= bandPct) {
        const touches = highs.filter(h => h >= lo - lo*bandPct && h <= hi + hi*bandPct).length;
        if (touches >= minTouches) return { zoneLo: lo, zoneHi: hi, touches };
      }
    }
    return null;
  }
  ```
  이 결과에 "그 구간 위쪽으로 종가가 한 번도 못 넘었다"는 조건을 더하면(3장 돌파 판정과 결합) 바로
  "저항선 테스트 중, 못 뚫음" 판정이 나온다 — 오늘 사고의 정확한 해법.
- 피봇 포인트: `overnight`에 이미 전일 고가·저가·종가가 있다면(없다면 fetch 단계에서 추가 필요) 순수
  산술이라 계산 매우 쉽다. 다만 이 스크립트가 다루는 건 지수 "선물"이라 정규장 종가 기준 피봇이 그대로
  맞는지(선물은 거의 24시간 거래) 확인 필요.
- 라운드 넘버: 나스닥 선물 기준 100 단위(29,600 / 29,700...)로 반올림해서 `현재가와 가장 가까운 라운드
  넘버까지 남은 거리`를 %로 계산하면 됨. `Math.round(price / 100) * 100`.
- 역할 전환: "예전에 저항이었던 zoneHi를 지금 종가가 넘었고, 그 후 눌림에서 zoneHi 근처에서 저가가
  지지받았는가"를 체크하는 다단계 로직. 20~40봉 안에서 "돌파 → 되돌림 → 지지 확인"까지 다 나오려면 꽤
  긴 창이 필요해서, 이 스크립트의 짧은 창에서는 흔치 않은 케이스일 것.

**짧은 창 함정**: 밴드 폭(bandPct)을 너무 좁게 잡으면 노이즈로 우연히 겹치는 걸 "저항선"으로 오판하고,
너무 넓게 잡으면 사실상 항상 저항선이 "있다"고 나온다. 나스닥 선물처럼 가격대가 큰 자산은 %가 아니라
절대 포인트(예: ±10pt) 기준이 더 안정적일 수 있다. 최소 터치 횟수(minTouches)는 최소 3으로 잡는 걸
권장 — 2번은 우연일 확률이 높다.

---

## 3. 돌파(breakout) 판정 — 진짜 돌파 vs 가짜 돌파(false breakout/fakeout)

**정의**: 가격이 지지/저항 레벨을 뚫고 나갔다가 금방 원래 레인지 안으로 되돌아오는 것이 페이크아웃/가짜
돌파. 반대로 그 레벨 밖에서 자리를 잡으면 진짜 돌파.

**구분 기준(검색 결과 공통 항목들)**:
1. **종가 기준 vs 고가/저가 기준**: 심지(wick)만 레벨을 건드리고 종가는 레벨 안쪽으로 돌아온 경우는
   돌파로 인정하지 않는 게 표준적. "레벨을 넘는 확실한 종가(solid close)"를 기다리라는 게 정석 조언.
   고가/저가만 보는 방식은 신호가 빠르지만 가짜가 많다.
2. **거래량 동반 여부**: 진짜 돌파는 대개 평소보다 뚜렷하게 큰 거래량을 동반한다(참여자가 많다는 뜻).
   기준으로 자주 인용되는 값은 "최근 20봉 평균 거래량의 1.5~2배 이상" — 이 밑이면 돌파보다는 유동성
   훑기(liquidity sweep)일 가능성이 높다는 지적.
3. **되돌림 폭**: 돌파 후 다시 그 레벨 쪽으로 얼마나 되돌아왔는지. 되돌림이 얕고(레벨 근처에서 다시
   지지/저항으로 작동) 빠르게 재차 밀고 나가면 진짜 돌파를 다시 확인하는 신호, 레벨 안쪽으로 깊이
   되돌아오면 가짜였을 가능성.
4. **돌파 후 지속 시간**: 레벨 밖에서 몇 봉 이상 버텼는지도 확인 기준으로 쓰인다.

**계산 가능성**:
```js
function classifyBreakout(bars, level, direction /* 'up' | 'down' */, opts = {}) {
  const { volMult = 1.5, holdBars = 2 } = opts;
  const avgVol = average(bars.slice(0, -holdBars).map(b => b.v));
  const recent = bars.slice(-holdBars);
  const touchedLevel = recent.some(b => direction === 'up' ? b.h > level : b.l < level);
  if (!touchedLevel) return 'noTouch';

  const closedThrough = recent.every(b => direction === 'up' ? b.c > level : b.c < level);
  const volOk = recent.some(b => b.v >= avgVol * volMult);

  if (closedThrough && volOk) return 'confirmedBreakout';
  if (closedThrough && !volOk) return 'weakBreakout'; // 거래량 부족 — 되돌림 경계
  return 'falseBreakout'; // 건드리기만 하고 종가는 안쪽
}
```
이 로직을 2장의 `findTouchZone` 결과(zoneHi)와 결합하면 바로 오늘 사고를 정확히 판정할 수 있다: 여러 봉의
고가가 29,589~29,605를 건드렸지만(`touchedLevel = true`) 종가는 매번 그 아래로 돌아왔다면
(`closedThrough = false`) → `falseBreakout` → "저항선 테스트, 못 뚫음" 문구로 연결.

**짧은 창 함정**: 
- `holdBars`(돌파 후 버틴 봉 수)를 너무 짧게 잡으면 판정이 너무 성급하고, 너무 길게 잡으면 창이 끝날 때까지
  판정 자체가 안 나온다. 19~30봉 창에서는 1~2봉 정도가 현실적 상한.
- 선물 거래량은 종종 스파이크성이라 "평균의 몇 배"라는 임계값이 종목/시간대별로 안정적이지 않을 수 있다 —
  절대 배수보다는 창 내 상대 순위(top 20%)로 잡는 게 더 안전할 수 있다.
- 종가 기준 확인은 그 자체로 1~2봉의 지연을 만든다 — "지금 이 순간"을 다루는 스토리 특성상, 판정이 항상
  약간 늦게 나온다는 걸 감안해야 한다(신선함 vs 정확도 트레이드오프).

---

## 4. 반전형 차트 패턴

| 패턴 | 핵심 정의 | 신호 |
|---|---|---|
| 헤드앤숄더(H&S) | 세 개의 고점(왼쪽 어깨 < 머리 > 오른쪽 어깨), 두 저점을 이은 넥라인 | 상승추세 끝, 넥라인 이탈 시 하락 반전 |
| 역헤드앤숄더 | H&S를 상하 반전한 형태 | 하락추세 끝, 넥라인(저항) 돌파 시 상승 반전 |
| 더블탑 | 비슷한 높이의 고점 2번(M자) | 상승 → 하락 반전, 두 고점 사이 저점(넥라인) 이탈로 확정 |
| 더블바텀 | 비슷한 높이의 저점 2번(W자) | 하락 → 상승 반전 |
| 트리플탑/바텀 | 비슷한 높이의 고점/저점 3번 | 더블탑/바텀보다 더 강한 저항/지지 확인, 패턴 지지선 이탈로 확정 |
| V자 반전 | 급락 후 뚜렷한 저점 없이 바로 급반등(또는 반대) | 빠르고 급격한 추세 전환, 통상적 패턴과 달리 "형성 시간"이 거의 없음 |

**계산 가능성**: 이 패턴들은 전부 "여러 개의 스윙 고점/저점이 특정 순서·비율 관계를 만족"해야 확정되는
다봉(多峰) 패턴이다. 30봉 안팎에서 H&S(어깨-머리-어깨, 최소 5개의 스윙점 필요)나 트리플탑(최소 5개
스윙점) 같은 패턴이 통계적으로 유의미하게 나오는 경우는 드물다. 다만 **더블탑/더블바텀은 2개의 스윙점만
있으면 되므로 이 창 길이에서도 시도해볼 만하다**:
```js
// 최근 스윙고점 2개가 서로 tolerance% 이내로 비슷한 높이이고,
// 그 사이 저점이 그 고점들보다 충분히 낮으면 더블탑 후보
function isDoubleTop(swingHighs, betweenLow, tolerancePct = 0.001, minDipPct = 0.001) {
  if (swingHighs.length < 2) return false;
  const [h1, h2] = swingHighs.slice(-2);
  const closeEnough = Math.abs(h1.h - h2.h) / h1.h <= tolerancePct;
  const dippedEnough = (h1.h - betweenLow.l) / h1.h >= minDipPct;
  return closeEnough && dippedEnough;
}
```
V자 반전은 스윙점 1개(급격한 저점/고점)와 그 앞뒤 기울기 비교만으로 계산 가능 — 사실 지금 `shapeOf`의
`peakedEarly`/`troughEarly` + `fadeFromHighPct`/`bounceFromLowPct` 로직이 이미 V자/역V자를 근사적으로
잡아내고 있다고 볼 수 있다.

**짧은 창 함정**: H&S나 트리플탑은 "패턴이 있다고 우기면 어디서든 찾을 수 있다"는 게 TA 비판의 단골
소재다 — 30봉 안에서 이런 패턴을 억지로 검출하면 과적합된 잡음일 확률이 매우 높다. 이 카테고리는 **더블
탑/바텀과 V자 반전 정도만 시도하고 나머지(H&S, 트리플탑)는 이 창 길이에서는 포기하는 걸 권장**한다.

---

## 5. 지속형 차트 패턴

| 패턴 | 핵심 정의 |
|---|---|
| 대칭삼각형 | 고점은 낮아지고 저점은 높아지며 수렴(위아래 추세선이 서로를 향해 좁혀짐) |
| 상승삼각형 | 저항선은 수평, 지지선은 우상향(저점이 계속 높아짐) — 상방 돌파 우세 |
| 하강삼각형 | 지지선은 수평, 저항선은 우하향(고점이 계속 낮아짐) — 하방 돌파 우세 |
| 깃발형(flag) | 급격한 직선 움직임(깃대) 후, 그와 반대 방향으로 살짝 기운 평행한 두 선 사이의 좁은 조정 구간 |
| 페넌트(pennant) | 깃발형과 비슷하지만 조정 구간이 평행이 아니라 수렴하는 작은 대칭삼각형 모양 |
| 쐐기형(wedge) | 두 추세선이 같은 방향으로 기울며 수렴. 상승추세 중 하락쐐기가 위로 뚫리면 지속형, 하락추세 중 상승쐐기가 아래로 뚫리면 지속형(반대 상황이면 반전형) |
| 컵앤핸들 | U자형 완만한 저점(컵) 뒤에 작은 하락 조정(핸들)이 붙고, 핸들 상단 돌파 시 상승 지속 |

**계산 가능성**: 전부 "추세선 2개가 수렴/평행하는지"를 판정해야 하므로 1장의 추세선 계산과 같은 한계를
공유한다. 게다가 삼각형·깃발형은 형성에 보통 최소 여러 시간~며칠이 걸리는 패턴이라, 개장 후 19~30분
창 안에서 "진짜 삼각형이 완성됐다"고 볼 근거는 거의 없다. 컵앤핸들은 수 주~수개월 스케일 패턴이라 이
맥락에서는 사실상 적용 불가.

굳이 계산한다면 **변동성 수축(range narrowing)** 정도까지만 근사할 수 있다 — 삼각형/쐐기형의 공통점은
"고점과 저점의 폭이 시간이 갈수록 좁아진다"는 것이므로:
```js
// 창을 전반부/후반부로 나눠 (고가-저가) 폭이 줄어드는지만 본다
function isContracting(bars) {
  const half = Math.floor(bars.length / 2);
  const rangeOf = (arr) => Math.max(...arr.map(b => b.h)) - Math.min(...arr.map(b => b.l));
  const first = rangeOf(bars.slice(0, half));
  const second = rangeOf(bars.slice(half));
  return second < first * 0.6; // 폭이 40% 이상 줄었으면 수축 중
}
```
이건 "삼각형이다"라고 단정하지는 못해도 "숨죽이는 중"(`quiet`류 문구가 이미 표현하는 뉘앙스) 판정을
좀 더 정교하게 뒷받침하는 데는 쓸 수 있다.

**짧은 창 함정**: 이 카테고리 전체가 "이 스크립트 창 길이에서는 원칙적으로 검출하지 않는 게 맞다"는
결론에 가깝다. 억지로 삼각형/깃발형 라벨을 붙이면 대부분 우연의 노이즈다. 방향성 있는 지속(`climbing`,
`drifting` 등)은 이미 `shapeOf`가 잘 표현하고 있으므로, 이 카테고리에서 얻을 건 "수축 중이다"라는 보조
신호 정도로 기대치를 낮게 잡는 게 맞다.

---

## 6. 캔들스틱 패턴

| 패턴 | 정의 | 신호 |
|---|---|---|
| 도지(doji) | 시가 ≈ 종가(몸통이 매우 작음), 위아래 꼬리는 있을 수 있음 | 매수·매도 균형/방향성 부재, 추세 끝 무렵에 나오면 반전 예고로 해석되기도 함 |
| 해머(hammer) | 몸통 작고 위쪽 꼬리 거의 없음, 아래꼬리가 몸통의 2배 이상. 하락추세 끝에 등장 | 저가에서 매도가 거부당함 → 상승 반전 후보 |
| 행잉맨(hanging man) | 해머와 모양은 같지만 상승추세 끝에 등장 | 고가에서 매수세 약화 → 하락 반전 후보 |
| 장악형(engulfing) | 이전 봉의 몸통을 다음 봉의(반대색) 몸통이 완전히 감쌈 | 강세장악형=상승 반전, 약세장악형=하락 반전(특히 저항/지지 근처에서 나오면 신뢰도↑) |
| 샛별(morning star) | 3봉: 긴 음봉 → 몸통 작은 봉(갭 有 가능) → 긴 양봉(첫봉 몸통 중간 이상 회복) | 하락 → 상승 반전 |
| 석별(evening star) | 샛별의 반대(긴 양봉 → 작은 몸통 → 긴 음봉) | 상승 → 하락 반전 |
| 핀바(pin bar) | 몸통 작고 한쪽 꼬리가 몸통의 2배 이상 — 해머/행잉맨/슈팅스타를 포괄하는 일반명 | 꼬리 방향의 가격이 강하게 거부됨(rejection) → 반대 방향 반전 후보 |

**계산 가능성**: 캔들 패턴은 애초에 "봉 1~3개짜리 정의"라서 이 문서의 모든 카테고리 중 **가장 이
스크립트 창 길이에 잘 맞는다**. 1분봉 하나만으로 계산 가능:
```js
function bodyRange(b) {
  const body = Math.abs(b.c - b.o);
  const upperWick = b.h - Math.max(b.c, b.o);
  const lowerWick = Math.min(b.c, b.o) - b.l;
  const range = b.h - b.l || 1e-9;
  return { body, upperWick, lowerWick, range };
}

function isDoji(b, bodyMaxPct = 0.1) {
  const { body, range } = bodyRange(b);
  return body / range <= bodyMaxPct;
}

function isPinBar(b, wickMinRatio = 2) {
  const { body, upperWick, lowerWick } = bodyRange(b);
  if (body === 0) return null;
  if (lowerWick >= body * wickMinRatio && lowerWick > upperWick) return 'bullish'; // 해머류
  if (upperWick >= body * wickMinRatio && upperWick > lowerWick) return 'bearish'; // 슈팅스타/행잉맨류
  return null;
}

function isEngulfing(prev, cur) {
  const prevUp = prev.c > prev.o, curUp = cur.c > cur.o;
  if (prevUp === curUp) return null;
  const engulfs = curUp
    ? cur.o <= prev.c && cur.c >= prev.o
    : cur.o >= prev.c && cur.c <= prev.o;
  return engulfs ? (curUp ? 'bullish' : 'bearish') : null;
}
```
샛별/석별(3봉)도 같은 방식으로 조건 3개(첫봉 몸통 크기, 둘째봉 몸통 작음, 셋째봉이 첫봉 몸통을 얼마나
회복했는지)를 이어 붙이면 계산 가능하다.

**짧은 창 함정**: 1분봉은 캔들 하나하나가 원래도 노이즈에 가깝다 — "긴 아래꼬리"가 진짜 매도 거부인지
그냥 스프레드/체결 튐인지 구분이 어렵다. 또한 해머/행잉맨/핀바는 "어떤 추세 뒤에 나왔는가"(맥락)가
패턴 자체보다 중요한데, 30분 안에서는 "추세"라 부를 만한 게 아직 형성 전일 수 있다. **1분봉 단일 패턴
하나만으로 신호를 내지 말고, 반드시 2장/3장의 지지·저항 근처("레벨 근처에서 나온 핀바/장악형")라는
위치 조건과 결합해야 신뢰도가 올라간다** — 이게 검색 결과에서도 "약세장악형은 특히 저항 근처에서
나오면 신뢰도가 높다"는 형태로 반복 언급된 부분이다.

---

## 7. 주요 보조지표

| 지표 | 정의 | 신호 |
|---|---|---|
| SMA/EMA | 단순/지수 이동평균 | 가격과의 관계로 추세 방향 판단, 지지/저항으로도 쓰임 |
| 골든크로스/데드크로스 | 단기 MA가 장기 MA를 상향/하향 돌파 | 중장기 추세 전환 신호(전통적으로 50일/200일) |
| MACD | 12EMA − 26EMA(MACD선), 그 9EMA(시그널선) | MACD가 시그널선 상향/하향 돌파 시 모멘텀 전환, 다이버전스는 추세 약화 신호 |
| RSI | 최근 N기간 상승폭/하락폭 비율을 0~100로 정규화(Wilder, 보통 14기간) | 70 이상 과매수, 30 이하 과매도, 다이버전스는 추세 전환 경고 |
| 스토캐스틱 | 현재 종가가 최근 N기간 고저 범위에서 어디에 위치하는지(%K), 그 이동평균(%D) | 80 이상 과매수, 20 이하 과매도; 골든/데드 크로스도 봄 |
| 볼린저 밴드 | N기간 SMA ± k×표준편차(보통 20기간, 2배) | 밴드 폭 = 변동성(좁으면 스퀴즈=변동성 축소, 곧 확대 가능성), 밴드 터치/이탈은 과매수·과매도 근사 |
| ATR | 최근 N기간 true range(고가-저가, 고가-전종가, 저가-전종가 중 최대)의 평균 | 방향성 없는 순수 변동성 크기 지표 — 손절폭·"조용함" 판정에 활용 |
| OBV | 종가 상승일 거래량을 더하고 하락일은 빼는 누적 지표 | 가격과 OBV의 다이버전스는 추세 신뢰도 확인/경고 |
| VWAP | 거래량가중평균가 = Σ(체결가×거래량)/Σ거래량 (보통 당일 누적) | 기관 매매 기준가로 널리 쓰임 — 현재가가 VWAP 위/아래인지가 그날의 "우세" 판단 기준 |

**계산 가능성**: 산술 자체는 전부 쉽다. 다만 기간(period) 선택이 문제:
- **ATR, VWAP, SMA(짧은 기간), OBV**는 이 창 길이에서도 바로 쓸 수 있다. 특히 **ATR은 지금 `shapeOf`가
  `(hi-lo)/open < 0.25%`로 임시로 하고 있는 `quiet` 판정을 더 정교하게 대체할 수 있는 정석 변동성 지표**다.
  ```js
  function atr(bars, period = 10) {
    const trs = bars.slice(1).map((b, i) => {
      const prevClose = bars[i].c;
      return Math.max(b.h - b.l, Math.abs(b.h - prevClose), Math.abs(b.l - prevClose));
    });
    const window = trs.slice(-period);
    return window.reduce((s, x) => s + x, 0) / window.length;
  }
  ```
  VWAP도 `bars` 안의 `v`(거래량) 필드로 바로 계산 가능:
  ```js
  function vwap(bars) {
    let pv = 0, vol = 0;
    for (const b of bars) {
      const typical = (b.h + b.l + b.c) / 3;
      pv += typical * b.v;
      vol += b.v;
    }
    return vol ? pv / vol : null;
  }
  ```
- **RSI, MACD, 스토캐스틱, 볼린저밴드**는 표준 기간(14, 26, 20 등)을 그대로 쓰면 20~40봉 창에서는
  워밍업 구간이 절반 가까이 잡아먹혀 신호가 거의 안 나오거나 극단값에 붙어버린다. 쓰려면 기간을
  5~10 정도로 대폭 줄여야 하고, 그래도 "표준 RSI"가 아니라는 걸 감안해야 한다(30/70 같은 표준 임계값의
  통계적 근거도 약해짐).
- **골든/데드크로스**는 원래 일봉 50/200 기준의 중장기 신호라 이 창에는 개념 자체가 안 맞는다. 억지로
  단축(예: 5봉/15봉 이동평균 교차)하면 "골든크로스"라는 이름값에 안 맞는 완전히 다른 신호가 된다 — 굳이
  쓴다면 "단기/초단기 이동평균 교차" 정도로 표현을 낮춰야 한다.
- **OBV**는 선물 거래량 데이터의 신뢰도(체결 데이터 소스에 따라 거래량이 거칠게 들쭉날쭉할 수 있음)에
  달려 있다 — 계산은 쉽지만 해석은 불안정할 수 있다.

**짧은 창 함정**: 기간 기반 지표는 전부 "기간이 창 길이에 비해 너무 길면 계산이 안 되고, 너무 짧으면
지표 본연의 통계적 의미가 사라진다"는 트레이드오프를 안고 있다. 이 카테고리에서는 **ATR과 VWAP를 최우선
후보**로, RSI/스토캐스틱은 "기간을 확 줄인 근사치"로 신중하게, 골든크로스류·MACD는 이 창 길이에서는
사실상 의미가 옅다고 보는 게 정직한 평가다.

---

## 8. 피보나치 되돌림/확장

**정의**: 직전의 뚜렷한 고점-저점 구간(스윙)을 100%로 놓고, 되돌림 구간에서는 38.2%/50%/61.8%(및
23.6%, 78.6%) 같은 되돌림 비율선을, 그 구간을 넘어서는 목표가 예측에는 확장 비율(127.2%, 161.8%,
261.8%)을 쓰는 기법. 50%는 엄밀히는 피보나치 수열에서 나온 비율이 아니지만 관습적으로 항상 포함된다.

**신호**: 상승(또는 하락) 이후 조정이 어느 되돌림선 부근에서 멈추는지를 보고 "얕은 되돌림(38.2%) →
추세 강함", "깊은 되돌림(61.8%) → 추세 약화 가능성"으로 해석. 확장 비율은 돌파 후 목표가·이익실현
구간 후보로 쓰인다.

**계산 가능성**: 산술은 매우 단순하다 — 창 안의 최고가·최저가(또는 뚜렷한 스윙 고점/저점) 두 점만
있으면 즉시 계산된다.
```js
function fibLevels(swingLow, swingHigh) {
  const range = swingHigh - swingLow;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return Object.fromEntries(ratios.map(r => [r, swingHigh - range * r]));
}
```
이미 `shapeOf`가 계산하는 `hi`, `lo`, `pos`(=현재가가 hi-lo 구간에서 어디 있는지, 사실상 되돌림 비율의
역산)가 이 개념과 사실상 같은 것을 이미 다른 이름으로 하고 있다. 여기서 한 단계 더 나아가려면 "지금
되돌림이 38.2%선 근처인지 61.8%선 근처인지"로 되돌림의 "깊이감"을 이산적으로 분류해 코멘트 어휘를
세분화할 수 있다("살짝 눌렸다" vs "거의 다 반납했다").

**짧은 창 함정**: 피보나치 되돌림은 원래 "많은 시장 참여자가 같은 레벨을 보고 있어서 자기실현적으로
작동한다"는 전제가 강한 기법인데, 이건 유동성이 크고 여러 시간대 참여자가 공존하는 시장(일봉/주봉)에서
더 성립하는 이야기다. 개장 직후 30분짜리 초단기 스윙에서 38.2%/61.8% 같은 정밀한 비율선이 실제로
의미 있게 작동한다는 근거는 약하다 — 정확한 몇 %인지보다는 "얕게 눌렸다/깊게 눌렸다" 정도의 정성적
구간(예: 0~30% / 30~60% / 60%+)으로만 쓰는 게 과신을 피하는 방법이다.

---

## 9. 엘리엇 파동 이론 (개념만)

**기본 구조**: 추세 방향으로 5개 파동(1-2-3-4-5, 이 중 1·3·5는 추세 방향 "임펄스", 2·4는 그 사이의
조정)이 나온 뒤, 그 반대 방향으로 3개 파동(A-B-C, "조정파")이 나오는 8파동 사이클이 모든 시간대에서
반복(프랙탈적)된다는 이론. 3번 파동이 가장 강하고 길다는 것, 4번 파동이 1번 파동의 영역을 침범하지
않는다는 것 등 세부 규칙이 있다.

**신호**: "지금이 몇 번째 파동인가"를 판단해 다음 움직임의 방향과 대략적 크기를 예상하는 데 쓰인다.

**계산 가능성**: 사실상 계산 불가에 가깝다. 파동 카운팅은 스윙점을 최소 5~8개 이상 필요로 하고, 무엇보다
"어디서부터 1번 파동으로 셀 것인가" 자체가 분석가의 주관적 선택(카운팅이 여러 갈래로 갈릴 수 있음)이라
규칙 기반 알고리즘화가 TA 기법 중 가장 어렵다고 알려져 있다. 20~40봉짜리 창에서 신뢰할 만한 파동 카운트가
나올 가능성은 거의 없다.

**짧은 창 함정**: 이 항목은 **이 스크립트에는 적용하지 않는 것을 권장**한다. 억지로 "지금 3번 파동"
같은 서술을 만들면 검증 불가능한 주장이 되고, "분석하지 않는다"는 스크립트의 원칙과도 정면으로 충돌한다.
개념적으로만 알아두고 실전 로직에는 반영하지 않는 게 맞다.

---

## 10. 가격 행동(price action) / 시장 구조

**고점-저점 갱신 패턴**:
- 상승추세(불리시 구조) = 고점을 갱신할 때마다 이전 고점보다 높고(Higher High, HH), 저점도 이전
  저점보다 높다(Higher Low, HL).
- 하락추세(베어리시 구조) = 저점을 갱신할 때마다 이전 저점보다 낮고(Lower Low, LL), 고점도 이전
  고점보다 낮다(Lower High, LH).
- **구조 전환(break of structure)**: HH-HL이 이어지던 중 처음으로 이전 스윙 저점 아래로 저점이
  깨지면(LL 등장) 상승 구조가 깨진 것으로 본다. 반대도 마찬가지.

**레인지(횡보) vs 추세 구간 구분**: 추세는 한쪽 방향으로 스윙점이 계속 갱신되는 상태, 레인지는 고점도
저점도 특정 상단·하단 범위 안에서만 오가며 갱신되지 않는 상태(어느 쪽도 지배력이 없음). 고점은 낮아지고
저점은 높아지는 수렴 구간(=5장의 삼각형과 사실상 같은 개념)은 "추세가 힘을 모으는 중"이라는 제3의
해석도 있다.

**되돌림(retracement) vs 추세 전환의 구분 기준**(검색 결과 종합):
1. **구조**: 되돌림 중에는 여전히 HH-HL(또는 LH-LL) 패턴이 유지된다. 구조가 깨져야(HL 붕괴 등) 전환.
2. **거래량**: 되돌림은 대개 거래량이 평소보다 줄어든 상태(차익실현 성격), 전환은 거래량이 크게
   튀는 경우가 많다(추세 참여자의 실제 이탈).
3. **모멘텀 다이버전스**: 가격은 신고점을 갱신하는데 RSI/MACD 같은 모멘텀 지표는 이전 고점보다 낮은
   고점을 만들면(다이버전스) 추세 힘이 빠지고 있다는 경고로 해석.

**계산 가능성**: 이 카테고리는 **1분봉 짧은 창에 가장 잘 맞는 축에 속한다** — 스윙 고점/저점 몇 개만
있으면 계산 가능한 "구조 판정"이기 때문.
```js
// swings: 시간순 정렬된 스윙포인트 배열 [{type:'high'|'low', price, idx}, ...]
function marketStructure(swings) {
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  if (highs.length < 2 || lows.length < 2) return 'insufficient';

  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;

  if (hh && hl) return 'uptrend';
  if (lh && ll) return 'downtrend';
  if (hh && ll) return 'expandingRange'; // 변동성 확대
  if (lh && hl) return 'contractingRange'; // 수렴 (삼각형류와 근접)
  return 'mixed';
}
```
"구조가 깨졌는지"(전환 후보)는 `직전 스윙 저점을 종가가 하향 이탈`했는지로 간단히 체크 가능:
```js
function structureBroken(bars, lastSwingLow, direction /* 'up' */) {
  return direction === 'up'
    ? bars.some(b => b.c < lastSwingLow.price)
    : bars.some(b => b.c > lastSwingHigh.price);
}
```
되돌림/전환 구분의 거래량 조건도 `v` 필드로 바로 계산 가능(최근 구간 평균 거래량 vs 그 전 구간 평균
거래량 비교).

**짧은 창 함정**: 스윙점이 최소 2개(직전+직전전)씩 있어야 HH/HL 판정이 가능한데, 20분 안에서는 스윙점
자체가 1~2개뿐인 경우가 흔하다 — 그때는 `insufficient`(판정 불가)로 정직하게 처리하는 게 맞고, 억지로
방향을 단정하면 안 된다. 이 개념은 사실 지금 `shapeOf`의 `peakedEarly`/`troughEarly` 로직이 하고 있는
일과 철학적으로 매우 가깝다(초반 고점/저점 위치 + 그 뒤 방향 전환 여부) — **차이는 지금 로직이 "평균값"
기반 근사인 반면, 이 절의 방식은 스윙점을 명시적으로 찾아 구조로 판정한다는 점**이다. 후자가 더 견고하지만
구현 난이도도 더 높다.

---

## 종합: 오늘 사고에 이 개념들을 적용했다면

오늘 사고(29,589~29,605 다중 터치, 돌파 실패를 지속형으로 오판)는 **2장(지지·저항 다중 터치)**과
**3장(종가 기준 돌파 판정)**만 있었어도 막을 수 있었던 케이스다. 순서로 보면:

1. `findTouchZone`으로 최근 N봉의 고가들이 좁은 밴드 안에서 3회 이상 겹치는 저항 구간을 찾는다.
2. `classifyBreakout`으로 그 구간을 "종가 기준"으로 넘었는지 확인한다 — 오늘은 `falseBreakout` 또는
   최소 `weakBreakout`이 나왔을 것.
3. 이 판정을 `gapUpHolding`/`gapUpFading` 같은 기존 밤사이-흐름 문구보다 **먼저** 체크하도록 순서를
   조정한다 — 지금 `comment.mjs`는 "고점 대비 되돌림"(`fadeFromHighPct`)만 뚜렷한 방향 전환 신호로
   보고, "레벨을 못 뚫고 옆으로 반복 왕복하는" 상태는 아예 분류 대상에 없다. 새 상태(`resistanceTest`
   /`rejectedAtLevel` 류)를 하나 추가해야 한다.

---

## 이 스크립트에 바로 적용 가능한 것 — 우선순위

**1순위 (계산 쉽고, 오늘 사고를 직접 해결)**
- **저항/지지 구간 다중 터치 판정** (2장) + **종가 기준 돌파/가짜돌파 판정** (3장): 오늘 사고의 직접적
  해법. `POOL`에 `resistanceTest`/`supportTest` 같은 새 상태를 추가하고, `base` 판정 체인에서
  `fadeFromHigh`/`bounceFromLow`보다 우선 체크하도록 넣는다.
- **캔들 1~2봉 패턴(장악형, 핀바/해머/도지)** (6장): 계산이 가장 쉽고(봉 1~3개만 필요) 위 저항/지지
  판정과 결합하면("저항선에서 핀바 나옴") 신뢰도 높은 문구를 만들 수 있다.
- **ATR 기반 변동성 판정** (7장): 지금 `quiet = (hi-lo)/open < 0.25%`라는 임시 임계값을 표준 지표로
  교체할 수 있다. 계산 난이도 낮음.

**2순위 (계산 가능하지만 설계 손질 필요)**
- **시장 구조 HH/HL 판정** (10장): `shapeOf`의 근사 로직을 스윙점 기반의 더 견고한 구조 판정으로
  대체/보강할 수 있다. 스윙점이 부족할 때 "판정 불가" 처리를 잘 넣는 게 관건.
- **VWAP** (7장): "지금 VWAP 위/아래"라는 한 줄짜리 상태를 손쉽게 추가 가능. 거래량 데이터 신뢰도만
  확인하면 됨.
- **피보나치 되돌림 깊이(이산 구간)** (8장): 지금 있는 `pos`(고저 구간 내 위치)를 "38%/61%" 같은
  전통적 구간명으로 라벨링하는 정도의 가벼운 개선.

**3순위 (계산은 되지만 이 창 길이에서 신뢰도 낮음 — 신중히)**
- 더블탑/더블바텀(4장), 삼각형 수축 근사(5장): 시도는 가능하나 과적합 위험이 커서 임계값을 보수적으로
  잡아야 한다.
- RSI/스토캐스틱/MACD(7장 일부): 기간을 줄여 근사할 수는 있으나 "표준 지표"라는 이름값에는 안 맞는다.

**적용하지 않는 게 맞음**
- 엘리엇 파동(9장): 계산 알고리즘화 자체가 안 됨.
- 헤드앤숄더/트리플탑, 삼각형/깃발형/쐐기형/컵앤핸들의 "정식" 패턴 인식(4~5장), 다우 이론의 1~3차
  추세 구분, 골든/데드크로스: 전부 이 창 길이보다 훨씬 긴 시간 스케일 개념이라 억지로 넣으면 거짓
  확신을 만든다.

---

## 참고 출처

- [Dow Theory - Dukascopy](https://www.dukascopy.com/swiss/english/marketwatch/articles/dow-theory/)
- [Dow Theory - Britannica Money](https://www.britannica.com/money/dow-theory)
- [Dow Theory Trading Strategies – The 6 Tenets - naga.com](https://naga.com/en/academy/dow-theory)
- [Trend Channels - Strike Money](https://www.strike.money/technical-analysis/trend-channel)
- [How to Draw Trendlines - TrendSpider](https://trendspider.com/learning-center/how-to-draw-trendlines/)
- [Master Support and Resistance for Reversal Trading - LuxAlgo](https://www.luxalgo.com/blog/master-support-and-resistance-for-reversal-trading/)
- [What Is Support And Resistance? - Fidelity](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/support-and-resistance)
- [Support and Resistance - Kama Capital](https://kama-capital.com/education/articles/support-and-resistance-the-foundation-of-technical-analysis)
- [Pivot Point - SoFi](https://www.sofi.com/learn/content/what-is-a-pivot-point/)
- [Pivot Points: Complete Guide - Mudrex Learn](https://mudrex.com/learn/pivot-points/)
- [Breakout or Fakeout? The 3-Point Checklist - Bookmap](https://bookmap.com/blog/breakout-or-fakeout-the-3-point-checklist-for-confirmation)
- [False Breakout — LuxAlgo Library](https://www.luxalgo.com/library/concept/false-breakout/)
- [Volume Or Close: Breakout Confirmation Compared - Collin Seow](https://collinseow.com/breakout-confirmation/)
- [What are reversal chart patterns? - Bitstamp Learn](https://www.bitstamp.net/learn/crypto-trading/what-are-reversal-chart-patterns/)
- [11 Trading Chart Patterns You Should Know - FOREX.com](https://www.forex.com/en-us/learn-forex-trading/11-chart-patterns-you-should-know/)
- [Continuation Chart Patterns - Capital.com](https://capital.com/en-int/learn/technical-analysis/continuation-chart-patterns)
- [10 chart patterns every trader needs to know - IG UK](https://www.ig.com/uk/trading-strategies/10-chart-patterns-every-trader-needs-to-know-190514)
- [16 Candlestick Patterns Every Trader Should Know - IG International](https://www.ig.com/en/trading-strategies/16-candlestick-patterns-every-trader-should-know-180615)
- [Candlestick Pattern Dictionary - StockCharts ChartSchool](https://chartschool.stockcharts.com/table-of-contents/chart-analysis/candlestick-charts/candlestick-pattern-dictionary)
- [Pin Bar Candlestick Pattern - Strike Money](https://www.strike.money/technical-analysis/pin-bar)
- [Pin Bar Trading Strategy - PriceAction.com](https://priceaction.com/price-action-university/strategies/pin-bar/)
- [Trading the Death Cross - StockCharts ChartSchool](https://chartschool.stockcharts.com/table-of-contents/trading-strategies-and-models/trading-strategies/moving-average-trading-strategies/trading-the-death-cross)
- [Death Cross vs. Golden Cross Meaning - Britannica Money](https://www.britannica.com/money/golden-cross-vs-death-cross)
- [Technical Indicators & Overlays - StockCharts ChartSchool](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays)
- [On-Balance-Volume (OBV) - Strike Money](https://www.strike.money/technical-analysis/on-balance-volume)
- [On Balance Volume (OBV) - StockCharts ChartSchool](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/on-balance-volume-obv)
- [Stochastic Oscillator - Strike Money](https://www.strike.money/technical-analysis/stochastic)
- [Stochastic Oscillator (Fast, Slow, and Full) - StockCharts ChartSchool](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/stochastic-oscillator-fast-slow-and-full)
- [Fibonacci Retracement Levels, Extensions & Strategy - Britannica Money](https://www.britannica.com/money/fibonacci-trading-strategies)
- [Fibonacci Retracements and Extensions - CME Group](https://www.cmegroup.com/education/courses/technical-analysis/fibonacci-retracements-and-extensions)
- [Elliott Waves in a Nutshell - FXStreet Learning Center](https://learningcenter.fxstreet.com/education/learning-center/unit-2/chapter-3/elliott-waves-in-a-nutshell/index.html)
- [Corrective Waves - Elliott Wave International](https://www.elliottwave.com/waveopedia/corrective-waves/)
- [Price Action Trends: Higher-Highs and Higher-Lows - Forex.com](https://www.forex.com/en-us/news-and-analysis/price-action-trends-higher-highs-and-higher-lows-the-rhythm-of-life-03202024/)
- [Market Structure: Price Action Foundation Guide - AlgoStorm](https://algostorm.com/market-structure/)
- [Pullback Trading vs. Trend Reversals - LuxAlgo Blog](https://www.luxalgo.com/blog/pullback-trading-vs-trend-reversals-2/)
- [Price Retracement Vs. Reversal - Indicator Vault Blog](https://indicatorvault.com/price-retracement-vs-reversal/)
- [Swing High/low — Market Structure Concept - LuxAlgo Library](https://www.luxalgo.com/library/concept/swing-high-low/)
- [The Williams Fractals Swing Trading Strategy - Bhaskar Das (Medium)](https://medium.com/algorithmic-and-quantitative-trading/the-williams-fractals-swing-trading-strategy-pinpointing-support-resistance-for-high-probability-c0ced6c2e7c2)
- [Fractals - Swing Highs, Swing Lows - Linn Software](https://www.linnsoft.com/techind/fractals-swing-highs-swing-lows)
- [What Is Market Noise and How to Trade Without It? - FX2 Funding](https://fx2funding.com/blog/what-is-market-noise-and-how-to-trade-without-it/)
- [1-Minute vs 5-Minute vs 15-Minute Charts - American Dream Trading](https://www.americandreamtrading.com/blog/trading-chart-timeframes/)
