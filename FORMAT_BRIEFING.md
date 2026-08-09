# 브리핑 카드 구조·양식 (FORMAT)

> **이 문서가 정의하는 것**: 카드의 **구조·스키마·분량**. 렌더러와의 계약서다.
>
> **세션마다 따르는 절이 다르다.**
>
> | 세션 | 편성 | 따르는 절 | 렌더러 |
> |---|---|---|---|
> | `am` · `pm` | `sections` 5장 + 4 = **9장** | §1 · §2 · §3 · §5 | `render-cards.mjs` |
> | `sat` | 고정 **10장** | **§2-A** | `render-cards-sat.mjs` |
> | `sun` | 고정 **10장** | **§2-B** | `render-cards-sun.mjs` |
>
> **주말은 둘 다 고정 편성이다.** 토요일이 2026-08-08 에, 일요일이 2026-08-09 에 갈라져 나왔다.
> 호출 명령은 셋 다 같다 — `render-cards.mjs` 가 `sat`·`sun` 을 알아서 전용 렌더러로 넘긴다.
> **§1 의 `sections` 규칙은 주말에 적용되지 않는다.** §4(언어 무관 필드)·§6(분량 확인)·§7 은 전 세션 공용이다.
>
> **이 문서가 정의하지 않는 것**
> - 무엇을 조사하고 무엇을 쓸지 → 축별 절차서(`ROUTINE_PROMPT.md`, `ROUTINE_PROMPT_WEEKEND.md`)
> - 어떻게 검증하고 발행할지 → `ROUTINE_COMMON.md`
>
> **왜 따로 뺐나**: 예전에는 이 내용이 평일 절차서 안에만 있었다. 주말 브리핑은 **같은 렌더러·같은 경로**를 쓰면서도 절차서가 달라, 2026-08-03 에 추가된 데이터 카드(stats·bars·rank)와 `summary` 훅을 주말 축은 전혀 알지 못했다. 구조·양식을 한 곳에 두면 이 어긋남이 구조적으로 사라진다.
>
> **스토리·차트노트·릴스는 렌더러가 달라 이 문서를 쓰지 않는다.**

---

## 1. 카드 구성 (am · pm)

> **주말은 이 표를 쓰지 않는다** → 토요일 §2-A, 일요일 §2-B

| 카드 | 내용 | 근거 필드 |
|---|---|---|
| ① | 훅 | `headline_*` + `summary` |
| ② | 시장 한눈에 (10칸 격자) | `markets[]` x10, `market_note_*` |
| ③④⑤⑥⑦ | 본문 5장 | `sections[]` x5 |
| ⑧ | 주요 일정 | `market_hours`, `schedule[]` |
| ⑨ | 아웃트로 | `next_brief_*`, `outro_tagline_*` |

- **`sections` 는 필수다.** 없으면 렌더러가 «오류로» 멈춘다 — 예전에는 구버전 `econ`/`ai` 6+6
  구성으로 조용히 내려앉는 폴백이 있었으나 2026-08-09 에 걷어냈다(§7 참고).
- **총 장수 = `sections.length` + 4.** `sections` 5장이면 9장이다. 단 **`schedule` 과 `market_hours` 가 둘 다 있어야** ⑧이 그려진다 — 하나라도 빠지면 렌더러가 일정 카드를 통째로 건너뛰어 오류 없이 8장만 나온다. §6 에서 장수를 셀 때 이것부터 본다.
- **인스타 캐러셀 한도는 10장**이라 본문을 더 늘릴 여지는 한 장뿐이다.
- 재료가 정말 부족하면 `sections` 를 줄여도 레이아웃은 깨지지 않는다(카드 수만 준다). 다만 이는 최후 수단이고, 빈칸을 메우려고 확인 안 된 내용을 넣는 것보다 낫다는 뜻일 뿐이다.
- **각 축의 ③~⑦ 주제 배정은 축별 절차서에 있다.** 이 문서는 그 자리에 쓸 수 있는 **유형**만 정의한다.

---

## 2. 섹션 카드 유형 (`sections[].type`)

`type` 을 지정하면 아래 세 가지 데이터 카드 중 하나로 그리고, **`type` 을 안 쓰면 글 카드**(`items` 배열)로 그린다.

| `type` | 쓰임 | 필드 |
|---|---|---|
| (없음) | 서술형 — 공시·정책 발표·인물 동정처럼 문장 설명이 필요한 항목 | `items:[{headline_ko/en, body_ko/en, src(선택), time(선택)}]` |
| `stats` | 큰 숫자 몇 개 + (선택) 등락 종목 수 + (선택) 투자자별 순매수 | `stats:[{label_ko/en, value, delta, dir, sub_ko/en}]`, `cols`(선택), `breadth:[{label_ko/en, up, flat, down}]`(선택), `flows:{label_ko/en, unit_ko/en, rows:[{label_ko/en, value}]}`(선택) |
| `bars` | 업종·섹터별 등락처럼 부호가 핵심인 데이터 | `bars:[{label_ko/en, value}]` — value 는 %, 0 기준 발산 막대, 상승 빨강·하락 파랑 자동 |
| `rank` | 순위 + 상위 항목이 차지하는 비중 | `rows:[{name_ko/en, value, pct}]`, `share:{label_ko/en, segments:[{label_ko/en, pct, color}]}`(선택) |

공통 필드는 `title_ko/en`, `color` (모든 유형 동일).

- **`note_ko/en` 은 데이터 카드(`stats`·`bars`·`rank`)에만 그려진다.** 글 카드(`type` 없음)는 렌더러가 `newsCard()` 로 그리는데 여기엔 note 자리가 없어, 넣어도 **오류 없이 조용히 사라진다** (2026-08-08 sat 세션에서 ⑥ AI 카드의 note 한 줄이 그대로 증발했다). 글 카드에 붙이고 싶은 관찰은 **항목(`items`) 하나로 만들거나, 바로 옆 데이터 카드의 `note` 로 옮긴다.**

- **`type` 을 비워 두지 않는다.** 없으면 문장만 나열한 글 카드가 되어 "수치를 형태로 보여준다"는 개편 목적이 사라진다. 2026-08-04 am 세션이 실제로 네 장 모두 글 카드로 발행한 사고가 있었다.
- **수치 카드가 최소 두 장은 되어야 한다.** 그날 재료가 축별 표의 성격과 안 맞으면 유형을 바꿔도 되지만, 전부 글 카드가 되면 안 된다.
- **`type` 을 넣었다고 검증(`ROUTINE_COMMON.md` §3)이 면제되지 않는다.** 카드 형태만 바뀔 뿐 내용 기준은 같다.

### `stats` 의 `cols`

`1` 이면 가로로 긴 행(라벨·부연 왼쪽, 큰 숫자 오른쪽)을 위에서 아래로 쌓고, `2`(기본값)면 2열 격자로 놓는다. 타일이 하나뿐이면 자동으로 1열이다.

- **같은 종류를 순서대로 비교시키는 데이터는 `cols: 1`** — 지수 3개처럼. 표처럼 세로로 훑힌다.
- **성격이 다른 지표를 4~6개 늘어놓을 때는 `cols: 2`.**

---

## 2-A. 토요일(sat) 카드 — 별도 편성

렌더러: `scripts/render-cards-sat.mjs` · 견본: `content/example-sat.json`
확인: `node scripts/render-cards.mjs example ko sat` (·`en`) → `cards/example/sat/<lang>/card1..10.png`

**평일과 다른 점 셋.** ① `sections` 배열이 없다 — 카드 10장이 각자 전용 필드를 읽는 고정 편성이다.
② 바탕이 밝다(따뜻한 종이색). ③ `summary`·`hook_bull`·`markets`·`schedule` 을 쓰지 않는다.
장수는 **고정 10장**이고 늘릴 수 없다(인스타 캐러셀 한도).

### 카드 편성과 근거 필드

| 카드 | 내용 | 서식 | 근거 필드 |
|---|---|---|---|
| ① | 표지 | 30 | `weekLabel_*`, `cover{headline_*, hero{}, points[], tiles_title_*, tiles[]}` |
| ② | 지수 주간 등락 | 27 | `indexes[]`, `indexNote_*`, `valuation` |
| ③ | 주간 차트 (봉차트 5개) | 27 | `indexes[]` (같은 배열을 다시 읽는다) |
| ④ | 지수 외 지표 (2열 10칸) | 27 | `metrics[]`, `metricsNote_*` |
| ⑤ | 발표 결과 (예상 → 실제) | 28 | `calendar[]` |
| ⑥ | 한 주를 움직인 것 | 30 | `news{title_*, sub_*, items[], note_*}` |
| ⑦ | 주간 섹터 등락 | 27 | `sectors[]`, `sectorsSub_*`, `sectorsNote_*` |
| ⑧ | 대형주 (좌우 2단) | 27 | `movers{kr{}, us{}, note_*}` |
| ⑨ | AI · 반도체 | 30 | `ai{}` — ⑥과 같은 구조 |
| ⑩ | 아웃트로 | 30 | `outro{tagline_*, next_*}` |

**서식**은 노션 «노트북LM 슬라이드 스타일 가이드북(50종)» 번호다.
27 = SaaS 대시보드(칼럼 헤더 + 타일 + 등락 알약칩 + 카드 안 차트), 28 = Before/After(예상 → 실제 분할),
30 = 카드뉴스형(번호 배지 + 굵은 산세리프 제목 + 블록 분리).
**27번 원문의 `white and blue corporate palette` 는 따르지 않는다** — 파랑은 이 브리핑에서 이미 '하락'이라
UI 색으로 겸용하면 등락 신호가 흐려진다. 색은 브랜드 팔레트를 유지하고 서식의 **구조**만 가져왔다.

### 스키마

```
{
  "dateLabel_ko","dateLabel_en",
  "weekLabel_ko","weekLabel_en",              // 표지 라벨칩. 예: "주간 결산 · 8월 첫째 주"
  "cover": {
    "headline_ko","headline_en",              // <br> 로 두 줄. 48px 라 한 줄 20자 안쪽
    "hero": {"label_ko","label_en","value","dir","sub_ko","sub_en"},   // value 는 문자열 그대로 출력
    "points":[{"title_ko","title_en","body_ko","body_en"} x3],
    "tiles_title_ko","tiles_title_en",
    "tiles":[{"label_ko","label_en","value"} x3]                       // value 는 숫자(%), 부호로 색이 갈린다
  },
  "indexes":[{                                // ②③이 같이 읽는다. 5개 고정. ← fetch-sat-indexes.mjs 출력을 그대로 복사
    "key","name_ko","name_en",
    "close", "wk",                            // 숫자. wk = 주간 등락률(%)
    "hi","hiLabel_ko","hiLabel_en",           // 기간 고점과 그 라벨("52주 고점"/"60일 고점")
    "ma50","ma100","ma200",                   // 선택. 있는 것만 후보에 든다
    "note_ko","note_en",
    "ohlc":[[o,h,l,c], ...]                   // 일봉. MA20·RSI 를 여기서 직접 계산한다
  } x5],
  "indexNote_ko","indexNote_en",
  "valuation": {                              // ← data/index-valuation.json 에서 복사
    "rows":[{"key","name_ko","name_en","per","perYearAgo","perEstimate"}],
    "note_ko","note_en"                       // 출처·기준 필수. 빈 rows 면 '비어 있음' 안내로 대체
  },
  "metrics":[{"emoji","name_ko","name_en","value","delta","dir"} x10],
  "metricsNote_ko","metricsNote_en",
  "calendar":[{                               // 요일 칼럼. 보통 5개(월~금)
    "day_ko","day_en",
    "rows":[{"name_ko","name_en","est","act","dir"} x4~7]        // est/act 는 §4 참고
  }],
  "news": {"title_ko","title_en","sub_ko","sub_en","note_ko","note_en",
           "items":[{"emoji" | "icon":"chip", "headline_ko","headline_en","body_ko","body_en","src"} x3~4]},
  "sectors":[{"label_ko","label_en","value"} x12],
  "sectorsSub_ko","sectorsSub_en","sectorsNote_ko","sectorsNote_en",
  "movers": {
    "kr": {"flag","head_ko","head_en","items":[{
        "name_ko","name_en","mono_ko","mono_en","color",
        "logo",                                // 선택. 티커. data/logos.json 에 있으면 로고 배지
        "px_ko","px_en","pct","seq":[...]      // seq[0]=전주 금요일 종가, 이후 5개가 이번 주 종가
    } x3]},
    "us": { ...같은 구조... },
    "note_ko","note_en"
  },
  "ai": { ...news 와 같은 구조... },
  "outro": {"tagline_ko","tagline_en","next_ko","next_en"},
  "caption_ko","caption_en","sources":[...]
}
```

### 토요일에서 특히 조심할 것

- **`indexes[]` 는 손으로 만들지 않는다.** `node scripts/fetch-sat-indexes.mjs <금요일 날짜>` 출력의
  `indexes` 배열이 이 스키마와 필드 이름이 같다. **그대로 복사하고 `note_ko`/`note_en` 만 채운다.**
  `_check` 는 대조용이라 옮기지 않는다. (`data/sat-indexes.json` 은 예비용 — 러너에서는 미국 지수가
  비므로 미국의 근거로 쓰지 않는다. ROUTINE_PROMPT_WEEKEND.md §B2 기법 1)
- **`ohlc` 는 70봉(약 3.3개월)이 기본이다.** RSI(14)는 Wilder 방식이라 워밍업이 짧으면 값이 흔들린다 —
  23봉으로도 그림은 나오지만 RSI 숫자를 신뢰할 수 없다. 70봉이면 캔들도 아직 또렷하게 읽힌다.
- **`hi` 가 캔들 범위에서 25% 넘게 벗어나면 렌더러가 고점선을 알아서 생략한다.** 오류가 아니다 —
  억지로 범위에 넣으면 캔들이 납작해져 차트가 아무것도 못 보여준다(코스피 60일 고점 9,115 vs 종가 6,259).
  이때 숫자는 그대로 남으니, 카드 하단 범례의 "고점이 화면 밖이면 선은 생략" 문구를 지우지 말 것.
- **이동평균선은 20/50/100/200 중 이격이 가장 작은 2개만 적힌다.** 넷을 다 넣어도 두 개만 나온다.
- **`valuation` 은 `data/index-valuation.json` 에서 복사하고 `note` 에 출처를 반드시 적는다.**
  같은 날 S&P 500 PER 이 WSJ 26.02 / multpl 29.88 / iShares 30.65 로 벌어진다 — 이익 계열이 기관마다
  다르다. 세 지수를 한 소스에서 받아 같은 방법론으로 비교하는 것이 이 칸의 규칙이다.
  **EPS 는 쓰지 않는다**(소스에 없고 역산하면 오차가 값처럼 보인다). 현재 PER 옆에 1년 전 대비가
  자동으로 붙는다(오르면 빨강·내리면 파랑).
- **한국 지수는 `valuation` 에 넣지 않는다.** 코스피·코스닥 지수 PER/PBR 은 확보 경로가 없다.
  무엇을 시도해 왜 실패했는지는 `DATA_SOURCES.md` §4 에 전부 있다 — **그 표를 다시 훑지 않는다.**
- **`calendar[].rows` 는 요일마다 개수가 달라도 된다.** 타일이 남는 세로를 나눠 채우므로 발표가 적은
  날은 타일이 커진다. 의도된 동작이다(빈칸을 남기지 말라는 요구를 따른 결과).
- **배지는 `logo` → 로고, 없으면 `mono_*` → 모노그램 순으로 그려진다.** `logo` 에 티커를 적으면
  `data/logos.json`(logos-cache 워크플로가 커밋해 둔 base64 사전)에서 찾는다. **캐시에 없으면 조용히
  모노그램으로 내려앉는다** — 배지가 빈칸으로 나가는 일은 없다. 한국 종목은 CDN 이 미국 티커만
  주므로 항상 모노그램이다. `mono_*` 는 로고를 쓸 때도 **반드시 채워 둔다**(대체 경로가 그것이다).
- **로고를 원격 URL 로 걸지 않는다.** 렌더러는 Playwright 로 로컬 HTML 을 그리므로 렌더 시점에
  네트워크를 타야 하고, 그때 막히면 배지가 빈칸으로 나간 걸 아무도 모른다. base64 만 쓴다.
- **`sectors` 막대 최대폭은 막대칸의 29%로 고정돼 있다.** 이 상한은 수치 라벨까지 칸 안에 들어가게
  계산된 값이다. 늘리면 반도체(최댓값) 수치가 박스를 넘는다 — 실제로 46%·36%에서 넘쳤다.

---

## 2-B. 일요일(sun) 카드 — 별도 편성

렌더러: `scripts/render-cards-sun.mjs` · 견본: `content/example-sun.json`
확인: `node scripts/render-cards.mjs example ko sun` (·`en`) → `cards/example/sun/<lang>/card1..10.png`

**토요일과 같은 «주말 가족»이다.** 바탕은 같은 종이색이고 부품(알약칩·로고 배지·번호 배지)도 같다.
**강조색만 다르다** — 토요일 딥그린 `#2f5d50` ↔ 일요일 딥인디고 `#4b4180`.
`sections`·`summary`·`hook_*`·`markets`·`schedule`·`market_hours` 를 **쓰지 않는다.** 장수는 고정 10장이다.

### 시각 언어: 화살표(→)

일요일은 «무엇에서 무엇으로 갈 것인가»를 반복해 보여준다. 토요일 ⑤가 «예상 → 실제»로 결과를
보여준 것의 정확한 앞면이다.

| 카드 | 왼쪽 (이미 확정된 과거) | 오른쪽 (시장 컨센서스) |
|---|---|---|
| ④ 경제 지표 | 직전치 | 컨센서스 |
| ⑤ 실적 | 전년 동기 EPS 실적 | 이번 분기 컨센서스 |

**색은 방향만 뜻한다** — `dir:1` = 오른쪽이 왼쪽보다 **높음**(빨강), `-1` = 낮음(파랑), `0` = 같음.
좋고 나쁨으로 정하지 않는다. 실업수당처럼 '낮으면 좋은' 지표도 낮으면 `-1` 이다 (토요일 ⑤와 같은 규칙).

### 카드 편성과 근거 필드

**순서는 «먼저 주말 사이 있었던 일부터, 그럼 다음 주는»** 이라는 시간 흐름을 따른다.
⑨ 출발선만 예외로 뒤에 둔다 — 뉴스가 아니라 «금요일 종가»라는 기준값이라 시간 순서의 일부로
읽히지 않고, 마지막에 참조로 붙는 편이 자연스럽다.

| 카드 | 내용 | 시점 | 근거 필드 |
|---|---|---|---|
| ① | 표지 | | `weekLabel_*`, `cover{headline_*, hero{}, points[], tiles_title_*, tiles[]}` |
| ② | 주말 사이 소식 | **지난 주말** | `weekend{}` — 글 카드 구조 |
| ③ | **다음 주 캘린더 (월~금 그리드)** | 다음 주 | `week{note_*, days[]}` |
| ④ | 미국 · 글로벌 경제 지표 | 다음 주 | `econ{title_*, sub_*, note_*, rows[]}` |
| ⑤ | 미국 대형주 실적 | 다음 주 | `earnings{title_*, sub_*, note_*, items[]}` |
| ⑥ | 한국 다음 주 | 다음 주 | `korea{}` — 글 카드 구조 |
| ⑦ | AI · 반도체 | 다음 주 | `ai{}` — 글 카드 구조 |
| ⑧ | 놓치면 안 될 것 | 다음 주 | `watch{}` — 글 카드 구조 |
| ⑨ | 다음 주 출발선 | 금요일 마감 | `start{note_*, indexes[], metrics[]}` |
| ⑩ | 아웃트로 | | `outro{tagline_*, next_*}` |

**②⑥⑦⑧ 은 같은 «글 카드» 구조를 쓴다**: `{title_ko/en, sub_ko/en, note_ko/en, items:[{emoji | icon:"chip", headline_ko/en, body_ko/en, src} x3]}`.
토요일 ⑥⑨와 같은 모양이라 렌더러도 같은 함수를 쓴다.

**같은 항목이 두 카드에 실리지 않게 시점으로 자른다.**

| | ② 주말 소식 | ⑦ AI · 반도체 |
|---|---|---|
| 담는 것 | 토요일 낮 ~ 일요일 저녁에 **이미 일어난** 일 | 다음 주에 **예정된** AI·반도체 일정 |
| AI 소식이면 | 주말에 나온 모델·칩 소식은 **여기** | 다음 주 발표 예정인 것만 |

- **한 항목은 한 카드에만 싣는다.** 주말에 나온 AI 소식을 ⑦로 올리기로 했으면 ②에서 뺀다.
- **⑤ 실적과 ⑦ AI 도 각을 나눈다** — ⑤는 «숫자»(컨센서스 EPS·발표 시각), ⑦은 «무엇을 볼 것인가»
  (가이던스·기술 쟁점). 같은 기업이 양쪽에 나와도 되지만 같은 말을 반복하면 안 된다.

### 스키마

```
{
  "session": "sun",
  "dateLabel_ko","dateLabel_en",
  "weekLabel_ko","weekLabel_en",              // 표지 라벨칩. 예: "다음 주 미리 보기 · 8월 둘째 주"
  "cover": {
    "headline_ko","headline_en",              // <br> 로 두 줄. 48px 라 한 줄 20자 안쪽
    "hero": {"label_ko","label_en","value","sub_ko","sub_en"},  // value 는 문자열 그대로 출력
    "points":[{"title_ko","title_en","body_ko","body_en"} x3],
    "tiles_title_ko","tiles_title_en",
    "tiles":[{"label_ko","label_en","value"} x3]                // value 는 숫자(%), 부호로 색이 갈린다
  },
  "week": {                                   // ③ 요일 그리드. 보통 5개(월~금)
    "note_ko","note_en",
    "days":[{"day_ko","day_en",
             "rows":[{"time","name_ko","name_en","tag_ko","tag_en","importance":"high|mid"} x3~4]}]
  },
  "econ": {                                   // ④ 직전치 → 컨센서스
    "title_ko","title_en","sub_ko","sub_en","note_ko","note_en",
    "rows":[{"name_ko","name_en","when","prev","est","dir"} x4~5]
  },
  "earnings": {                               // ⑤ 전년 동기 → 컨센서스
    "title_ko","title_en","sub_ko","sub_en","note_ko","note_en",
    "items":[{"name_ko","name_en","logo","mono_ko","mono_en","color",
              "when","slot_ko","slot_en","epsPrev","eps","dir"} x6]
  },
  "korea": { ...글 카드... }, "weekend": { ...글 카드... },
  "ai":    { ...글 카드... }, "watch":   { ...글 카드... },
  "start": {                                  // ⑨ 금요일 마감 스냅샷
    "note_ko","note_en",
    "indexes":[{"name_ko","name_en","close","wk"} x3],          // 숫자. wk = 주간 등락률(%)
    "metrics":[{"emoji","name_ko","name_en","value","delta","dir"} x6]
  },
  "outro": {"tagline_ko","tagline_en","next_ko","next_en"},
  "caption_ko","caption_en","sources":[...]
}
```

### 일요일에서 특히 조심할 것

- **`hero` 는 «컨센서스»다. 예측이 아니다.** 라벨에 반드시 «컨센서스»임을 밝히고(`美 7월 CPI 컨센서스`),
  `sub` 에 직전치와 발표 시각을 붙여 무엇과 비교하는 숫자인지 드러낸다. 라벨을 «美 7월 CPI» 로만 적으면
  독자는 이미 나온 값으로 읽는다.
- **`week.days[].rows`(③) 는 요일당 3~4건이 기본이다.** 2건 이하로 떨어지면 카드가 눈에 띄게 빈다
  (렌더러가 블록을 세로 중앙에 두어 완화하지만 한계가 있다). 지표만으로 모자라면 실적·개장/만기·
  해외 지표를 함께 넣어 채운다. **정말 비는 요일은 «예정 없음» 타일이 자동으로 들어간다.**
- **`importance:"high"` 는 요일당 최대 1건.** 전부 high 면 아무것도 강조되지 않는다.
- **`tiles` 는 지난주 «주간 등락률»이다** (금요일 종가가 아니라 %). 숫자로 넣으면 부호에 따라 색이 갈린다.
- **`⑨ start` 는 회고를 여기서 끝낸다.** 지수 3개 + 지표 6개까지다. 지난주 지수 상세·섹터·대형주는
  토요일 회차가 통째로 다루므로, 일요일이 되풀이하면 하루 만에 같은 내용이 다시 나간다.
- **배지는 `logo` → 로고, 없으면 `mono_*` → 모노그램 순으로 그려진다.** `logo` 에 티커를 적으면
  `data/logos.json`(logos-cache 워크플로가 커밋해 둔 base64 사전)에서 찾는다. **캐시에 없으면 조용히
  모노그램으로 내려앉는다.** 한국 종목은 CDN 이 미국 티커만 주므로 항상 모노그램이다.
  `mono_*` 는 로고를 쓸 때도 **반드시 채워 둔다**(대체 경로가 그것이다). 원격 URL 은 쓰지 않는다.
- **`slot_ko`/`slot_en` 은 번역 필드다** (`장 마감 후` / `After close`). 여기에 한쪽 언어만 넣지 않는다.

---

## 3. 훅 카드 (①) — am · pm 전용

### 3.1 `summary` — 평일 훅 카드

**am · pm 세션은 `summary` 를 쓴다.**

- 스키마: `"summary": {"lines_ko":[...], "lines_en":[...]}` — 그날의 핵심을 불릿 3~4개로, 각 1문장.
- 쓰는 순서: 결과 → 무엇이 그렇게 만들었나 → 수급·거래대금 → 반대로 움직인 것. 이렇게 쓰면 자연스럽다.
- **왜 호재/악재로 안 가르나**: 호재·악재는 **앞으로 벌어질 일의 '재료'** 를 가리키는 말이다. am·pm 은 **이미 끝난 장의 결과**를 다루므로 확정된 결과를 그렇게 가르면 어색하다. (2026-08-03 사용자 결정)

### 3.2 주말은 훅 카드를 쓰지 않는다 — 표지 카드로 대체됐다

`sat`·`sun` 은 **첫 카드가 표지(`cover`)** 다. §2-A·§2-B 를 본다.

- **`hook_bull` / `hook_bear` 는 폐기됐다.** 2026-08-09 개편 전까지 `sun` 이 쓰던 필드로,
  라벨을 '기대 요인 / 경계 요인'으로 바꿔 출력했다. **지금은 어느 세션도 쓰지 않는다** —
  일요일 표지의 `cover.points` 가 그 자리를 대신한다.
- `summary` 도 주말에는 쓰지 않는다. 넣어도 주말 렌더러가 읽지 않아 조용히 사라진다.

### 3.3 세션별 첫 카드 (중요)

| 세션 | 첫 카드 | 필드 |
|---|---|---|
| `am` · `pm` | 훅 | `summary` (§3.1) |
| `sat` | 표지 | `cover` (§2-A) |
| `sun` | 표지 | `cover` (§2-B) |

**평일에서 `summary` 가 있으면 렌더러가 무조건 이것을 쓴다** — `hook_bull`/`hook_bear` 를 함께 넣어도 무시된다.

---

## 4. 언어 무관(invariant) 필드 — 사고가 가장 잦은 지점

아래 필드는 렌더 스크립트가 `${LANG}` 분기 없이 **base 필드 이름 그대로** 출력한다. 즉 **한국어 카드와 영어 카드에 똑같이 박힌다.**

```
# am · pm (§1)
markets[].label   markets[].value   markets[].value_sub   markets[].delta
sections[].items[].src            sections[].items[].time
sections[].stats[].value          sections[].stats[].delta
sections[].rows[].value
schedule[].time

# sat (§2-A)
cover.hero.value                  metrics[].value      metrics[].delta
calendar[].rows[].est / .act      news.items[].src     ai.items[].src
movers.*.items[].color            movers.*.items[].seq

# sun (§2-B)
cover.hero.value                  cover.tiles[].value  (숫자)
week.days[].rows[].time
econ.rows[].when   econ.rows[].prev   econ.rows[].est
earnings.items[].when   earnings.items[].eps   earnings.items[].epsPrev
earnings.items[].logo / .color
start.indexes[].close / .wk (숫자)   start.metrics[].value   start.metrics[].delta
korea/weekend/ai/watch .items[].src
```

- **토요일의 `calendar[].rows[].est` / `.act` 는 `_ko`/`_en` 쌍도 받는다.** `18.1억`·`7.0만` 처럼
  단위가 한글인 값이 실제로 영어 카드에 그대로 새어 나간 적이 있다. 숫자만 있는 값(`0.34`, `4.1%`)은
  단일 필드로 두고, **한글 단위가 붙는 값에만 `est_ko`/`est_en` 쌍을 쓴다.** 쌍이 있으면 그쪽이 이긴다.
  영어 환산은 억 → `$1.81B`, 만 → `+70K`·`202K`, 백만 → `1.790M` 처럼 중립 표기로.
- **`movers[].px_ko`/`px_en`(sat), `slot_ko`/`slot_en`(sun) 은 invariant 가 아니다.** 각각
  `33,900원` / `KRW 33,900`, `장 마감 후` / `After close` 로 갈린다. 한쪽만 채우면 다른 언어가 빈다.
- **일요일 `week.days[].rows[].time` 은 시각만 넣는다** (`21:30`). 날짜는 요일 헤더(`day_ko`/`day_en`)가
  이미 갖고 있고, 요일 헤더는 번역 필드라 `월 8/10` / `Mon 8/10` 으로 갈라 쓴다.

- 여기에 **한국어 조사·서술형 어미나 영어 문장을 넣지 않는다.** 처음 쓸 때부터 두 언어 모두에서 자연스러운 중립 표기로 쓴다.
  - 라벨은 `S&P 500 Fut` 처럼 영문 약어로
  - delta 는 `▼6.37%` 처럼 기호+숫자로
  - time 은 `7/16 15:30 KST`, `8/4` 처럼 숫자로
  - src 는 `KRX`, `DART`, `FMP`, `White House` 처럼 출처 표기로
- **실제 사고**: `stats[].delta` 에 "예상 상회"라는 한국어를 넣어 영문 카드에도 그대로 노출됨 (2026-08-04 am). `items[].src` 에 "대통령실 서면브리핑"을 넣어 같은 일이 반복됨.
- **반대로 아래는 번역되는 필드다.** 여기에 한국어가 있는 것은 정상이니 '오염'으로 오해해 base 필드로 합치지 않는다 — 합치면 렌더러가 못 읽어 **빈칸**이 된다.
  ```
  stats[].label_ko / label_en / sub_ko / sub_en
  bars[].label_ko / label_en
  rows[].name_ko / name_en
  breadth[].label_ko / label_en      flows.rows[].label_ko / label_en
  ```
- `_ko`/`_en` 접미사가 붙은 필드는 렌더러가 **invariant 자리에서는 아예 읽지 않는다.** 거기에 값을 넣어도 카드에 안 나온다.

---

## 5. 콘텐츠 JSON 스키마 (am · pm)

> **주말 스키마는 여기가 아니다** → 토요일 §2-A, 일요일 §2-B. 아래 `markets`·`sections`·
> `schedule`·`market_hours` 는 **평일에만** 쓴다.

```
{
  "date", "session",                          // session: "am" | "pm"
  "dateLabel_ko","dateLabel_en",
  "headline_ko","headline_sub_ko","headline_en","headline_sub_en",
  "summary":{"lines_ko":[...],"lines_en":[...]},   // §3.1
  "markets":[{"label","value","value_sub(선택)","delta","dir(up|down|flat)","note_ko","note_en"} x10],
  "market_note_ko","market_note_en",
  "sections":[                                 // 본문 5장. 순서대로 카드 ③④⑤⑥⑦
    {
      "title_ko","title_en",
      "color",                                 // 축별 절차서의 섹션 표에 있는 색
      "type",                                  // 선택: "stats"|"bars"|"rank". 없으면 items 로 그린다 (§2)
      "items":[{"headline_ko","headline_en","body_ko","body_en","src(선택)","time(선택)"}],  // type 없을 때
      "stats":[...], "cols", "breadth":[...], "flows":{...},   // type:"stats"
      "bars":[...],                                            // type:"bars"
      "rows":[...], "share":{...},                             // type:"rank"
      "note_ko","note_en"                                      // 모든 type 공통(선택)
    } x5
  ],
  "schedule_title_ko","schedule_title_en",     // 고정: "주요 일정" / "Key Schedule"
  "market_hours": { "title_ko","title_en","lines_ko":[...], "lines_en":[...] },
  "schedule":[{"time","title_ko","title_en","detail_ko","detail_en","importance(high|mid)"} x4~6],
  "next_brief_ko","next_brief_en",
  "outro_tagline_ko","outro_tagline_en",       // 선택. 없으면 렌더러 기본 문구
  "caption_ko","caption_en","sources":[...]
}
```

### 고정 문구

**`schedule_title`** — `"주요 일정"` / `"Key Schedule"`. **세션별로 바꾸지 않는다** (예전 "오늘 낮 주요 일정"은 am 에만 맞아 재사용이 안 됐다).

**`market_hours`** — **평일 전용이다.**
- `am`: 제목 "한국 증시 운영시간", 내용 "정규장 09:00 ~ 15:30 · 동시호가 08:30~09:00 / 15:20~15:30"
- `pm`: 제목 "미국 증시 운영시간", 내용 "정규장 22:30 ~ 익일 05:00 (서머타임 기준)" — 11월 초~3월 초에는 "23:30 ~ 익일 06:00". 프리마켓/애프터마켓 시간을 한 줄 더 넣어도 좋다.
- **주말은 `market_hours` 를 쓰지 않는다.** 개장 시각을 따로 실을 자리가 없어졌고, 그럴 필요도 없다 —
  일요일은 ② 캘린더의 요일 헤더와 각 항목 시각이 그 정보를 이미 담는다. **다음 주 휴장일은
  일요일 ⑧ «놓치면 안 될 것» 에 한 건으로 넣는다** (예: "한국 광복절 대체휴일 — 월요일 휴장").
- **휴장일 처리(평일)**: 해당 세션의 시장이 공휴일로 휴장이어도 브리핑을 건너뛰지 않는다. `lines` 에 "※ 오늘(M/D)은 ○○로 하루 휴장" 한 줄을 추가하고, `schedule` 첫 항목에 휴장 안내를 `importance: "high"` 로 넣고, 헤드라인·`market_note` 에도 반영한다.

**`next_brief`** — 평일은 최상위 `next_brief_*`, **주말은 `outro.next_*`** 에 넣는다.
- `am`: "🌙 다음 브리핑 — 오늘 밤 9시, 미국장 개장 전" / "🌙 Next brief — 9 PM KST, before the US open"
- `pm`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next brief — 8 AM KST, US close wrap-up"
- **금요일 `pm`**: "📊 다음 브리핑 — 내일 아침 8시, 한 주 결산" / "📊 Next brief — 8 AM KST, the week in review"
- `sat`: "🗓 다음 브리핑 — 내일 밤 9시, 다음 주 일정" / "🗓 Next brief — 9 PM KST tomorrow, the week ahead"
- `sun`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next up — 8am KST, the US close"

**아웃트로 큰 문구** — 평일은 `outro_tagline_*` 를 비워 두면 렌더러 기본 문구가 나온다.
**주말은 `outro.tagline_*`** 에 아래를 넣는다:
- `"평일엔 매일 아침·저녁,<br>주말엔 한 주를 한눈에"`
- `"Twice a day on weekdays,<br>the whole week on weekends"`

### 그 밖의 표기 규칙

- `time` 은 모두 **한국시간(KST)** 기준.
- **`schedule` 에 통상적인 "정규장 개장" 항목을 넣지 않는다.** 개장 시각은 이미 `market_hours` 박스에 있어 중복이다. **평소와 다른 경우(휴장·조기폐장·임시 개장시간)에만** 알리고, 그때는 위 `휴장일 처리`대로 `market_hours.lines` 에 줄을 추가한다. ("오늘 코스피가 반등할지" 같은 시황 코멘트는 개장 사실이 아니라 **관전 포인트**이므로 헤드라인·`summary` 에 담는다.)
  - 렌더러의 `ROUTINE_OPEN` 필터는 **정확히 일치할 때만** 걸러내며, 목록의 정본은 `render-cards.mjs` 의 `ROUTINE_OPEN` 정규식이다 (현재: "미국 증시 정규장 개장"·"미국 증시 개장"·"한국 증시 개장"·"코스피 개장"·"US Regular Session Opens"·"US Market Opens"·"Korea Market Opens"·"Kospi Opens"). 한 글자만 달라도 그대로 나가니 애초에 넣지 않는 것이 안전하다.
- **수치는 정확하게 (근사치 금지)**: `markets` 의 value 는 일의 자리까지. 비트코인 "$62K대"(X) → "$64,940"(O), WTI "$79대"(X) → "$79.75"(O). delta 도 "▲ 7%대" 대신 확인된 정확한 %("▲ 1.1%")를 쓰고, 정확한 값을 못 구했을 때만 방향+정성 표현을 쓴다.
- **caption** 에는 요약 + 팔로우/저장 유도 문구 + 해시태그 15개 내외를 넣고, 끝에 `next_brief` 내용을 한 줄 넣는다. pm 캡션에는 "저녁 브리핑"임을 밝힌다.

---

## 6. 카드 렌더링·분량 확인

```
node scripts/render-cards.mjs <DATE> ko <SESSION>
node scripts/render-cards.mjs <DATE> en <SESSION>
```

`cards/<DATE>/<SESSION>/ko/`, `.../en/` 각각에 카드가 다 생겼는지 확인한다 —
**평일 9장 · 토요일 10장 · 일요일 10장.** 장수가 다르면 스키마를 빠뜨린 것이다.

- **첫 카드 확인**: 평일은 `summary` 불릿, 주말은 라벨칩 + 굵은 두 줄 제목 + 큰 수치 카드가 보이는 것이 정상이다. 주말에서 호재·악재 블록이 보인다면 폐기된 `hook_*` 를 넣은 것이니 §3.2 를 다시 본다.
- **카드 분량 초과 확인 (매번 필수 · 전 장, 두 언어 모두 눈으로 본다)**: 영어는 같은 내용도 줄바꿈이 많아져 카드 높이(1350px)를 넘기기 쉽다. **렌더 성공 로그만 보고 넘어가지 말고 이미지를 실제로 연다** — 스크립트는 넘쳐도 오류 없이 성공한다. 하단 텍스트가 푸터("luckyon 브리핑"·페이지 번호)와 겹치면 **그 언어 텍스트만** 줄여 재렌더링한다 (사실관계나 다른 언어 필드는 건드리지 않는다). 겹침이 없어질 때까지 반복한다.
- **대체텍스트 개수 = 카드 수**를 확인한다. 어긋나면 대체텍스트가 엉뚱한 슬라이드에 붙는다.
  ```
  node -e "import('./scripts/lib/alt-text.mjs').then(async m=>{const fs=await import('node:fs');
    const c=JSON.parse(fs.readFileSync('content/<DATE>-<SESSION>.json','utf8'));
    for(const l of ['ko','en']) console.log(l, m.buildAltTexts(c,l).length)})"
  ```

자주 넘치는 곳과 대처:

| 카드 | 증상 | 대처 |
|---|---|---|
| 글 카드(`items`) | 항목 4~5건일 때 마지막 항목의 출처 줄이 푸터에 닿음 | 본문을 각 **1줄**로. 헤드라인이 2줄로 넘어가면 그것만으로 한 항목이 밀린다 |
| `stats` | `cols:2` 에서 타일 3개는 2행이 되고 라벨·부연이 길면 높이가 제각각 | `cols:1` 은 부연(`sub`)이 2줄로 넘어가지 않게 짧게 |
| `bars` | 라벨이 잘림(ellipsis) | 한글 8자·영문 15자 안쪽 (예: "커뮤니케이션 (XLC)"→"통신 (XLC)", "Industrials (XLI)"→"Indu. (XLI)") |
| 시장 카드(②) | 타일 note 가 3줄이 되면 10칸 격자가 밀림 | note 는 2줄 안쪽 |
| 일요일 ③ 캘린더 | 요일당 5건 이상이면 타일이 눌리고, 2건 이하면 카드가 빈다 | 요일당 **3~4건** (§2-B) |
| 일요일 ④ 지표 | 지표명이 2줄로 넘어감 | 한글 20자·영문 34자 안쪽 (`美 7월 소비자물가 (전년비)`) |
| 일요일 ⑤ 실적 | 기업명이 2줄로 넘어가 타일이 밀림 | 한글 12자 안쪽 (`어플라이드 머티어리얼즈` 가 상한) |

---

## 7. 이 문서를 고칠 때

**`scripts/render-cards.mjs` 에 카드 유형·필드를 추가하면, 같은 커밋에서 이 문서도 고친다.** 세션이 아는 것은 문서뿐이라, 문서에 없는 필드는 쓰이지 않는다.

- 예시 콘텐츠(`content/*.json`)만 바꿔 두는 것으로는 부족하다 — 세션은 예시를 참고하되 스키마를 따른다.
- **실제로 그렇게 사고가 났다**: 2026-08-03 에 데이터 카드 3종과 `summary` 를 렌더러에 넣고 pm 콘텐츠에 적용했지만 문서를 고치지 않아, 다음 날 아침 세션이 글 카드 네 장만 만들어 발행했다.
- 사용자와 합의해 **기본값을 바꿨다면 그 결정을 문서에 반영한다.** 같은 사고에서 `summary` 를 기본으로 정했는데 문서에는 `hook_bull` 이 기본값으로 남아 있어 결정이 되돌려진 채 발행됐다.
- 변경 이유를 한 줄로 남긴다. 나중에 왜 그렇게 정했는지 모르면 다시 되돌려진다.
