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

**평일은 카드 10장 고정 편성이다.** 2026-08-23 개편. 장마다 모양이 다르므로
`scripts/render-cards.mjs` 가 `scripts/render-cards-day.mjs` 로 위임한다 (주말과 같은 방식).

| 장 | 카드 | 무엇이 그려지나 | 근거 필드 |
|---|---|---|---|
| 1 | 표지 | 위 절반 사진 + 헤드라인 + 부제 + 아이콘 붙은 핵심 3줄 | `headline_ko/en`, `headline_sub_ko/en`, `cover_kicker`, `cover_facts` |
| 2 | 시장 한눈에 | 큰 타일 1개(**선 차트 포함**) + 옆 타일 2개 + 아래 4+3 = **지표 10개 전부** | `markets`, `tile_main`, `tile_side`, `tile_rest`, `chart_series_values` |
| 3 | 지수 기록 | **선 차트** + 지수 2개 큰 숫자 + **등락 종목수 띠** + **투자자별 순매수 막대** | `chart_*`, 섹션 `stats`·`breadth`·`flows` |
| 4 | 섹터별 등락 | 0 기준 **발산 막대** (업종 10~15개) | 섹션 `bars` |
| 5 | 거래대금 상위 | **순위 가로 막대** + 등락률·공매도 열 + 비중 띠 | 섹션 `rows`·`share` |
| 6 | 실적 · 지표 발표 | 2열 큰 숫자 타일 (최대 8개, 4행) | 섹션 `stats` |
| 7 | AI · 반도체 | 아이콘 + 헤드라인 + 본문 (최대 6건) | 섹션 `items` |
| 8 | 주요 소식 | 01~06 번호 + 헤드라인 + 본문 (최대 6건 — 2026-08-23 카드7과 같은 크기로 맞춰 6건까지 늘렸다) | 섹션 `items` |
| 9 | 주요 일정 | 타임라인 + 운영시간 상자 | `schedule`, `market_hours` |
| 10 | 아웃트로 | 로고 · 태그라인 · 다음 회차 · 핸들 | `outro_tagline_ko/en`, `next_brief_ko/en` |

- **본문 카드(3~8)는 `sections` 를 제목으로 찾아 쓴다.** `sections[].type` 을 보지 않는다 —
  어느 장에 무엇이 오는지가 편성으로 정해져 있기 때문이다. 제목이 없으면 그 카드는 비고,
  브리핑은 멈추지 않는다. 찾는 제목은 §5 스키마의 `sections` 항목에 적었다.
- **배경 사진은 그날 내용으로 만든다.** `node scripts/gen-card-photos.mjs <DATE> <SESSION>` 을
  렌더 전에 돌린다. 만들지 못한 장은 저장소에 든 사진으로 내려가고 발행은 그대로 진행된다.
- 캐러셀 상한이 10장이므로 **장수를 늘릴 수 없다.** 재료가 남으면 카드 안에서 항목을 늘린다.
- 주말(sat·sun)은 편성이 다르다 — §2-A·§2-B.

## 2. 섹션 카드 유형 (`sections[].type`)

`type` 을 지정하면 아래 세 가지 데이터 카드 중 하나로 그리고, **`type` 을 안 쓰면 글 카드**(`items` 배열)로 그린다.

| `type` | 쓰임 | 필드 |
|---|---|---|
| (없음) | 서술형 — 공시·정책 발표·인물 동정처럼 문장 설명이 필요한 항목 | `items:[{headline_ko/en, body_ko/en, src(선택), time(선택)}]` |
| `stats` | 큰 숫자 몇 개 + (선택) 등락 종목 수 + (선택) 투자자별 순매수 | `stats:[{label_ko/en, value, delta, dir, sub_ko/en}]`, `cols`(선택), `breadth:[{label_ko/en, up, flat, down}]`(선택), `flows:{label_ko/en, unit_ko/en, rows:[{label_ko/en, value}]}`(선택) |
| `bars` | 업종·섹터별 등락처럼 부호가 핵심인 데이터 | `bars:[{label_ko/en, value}]` — value 는 %, 0 기준 발산 막대, 상승 빨강·하락 파랑 자동 |
| `rank` | 순위 + 상위 항목이 차지하는 비중 | `rows:[{name_ko/en, value, pct, short(선택)}]`, `col_name_ko/en`·`col_value_ko/en`(선택, 열 제목), `share:{label_ko/en, mode, segments:[{label_ko/en, pct, color}], baseline(선택), baseline_label_ko/en(선택)}`(선택) |
| `econ` | 실적·지표 발표 — 실측치를 예상치와 나란히 놓아 "예상보다 좋았나"를 보여준다 | `rows:[{region:"KR"|"US", name_ko/en, sub_ko/en(선택), actual, estimate(없으면 null), surprise(없으면 null)}]`, `col_delta_ko/en`(선택) |

공통 필드는 `title_ko/en`, `color` (모든 유형 동일).

**브랜드 표기는 글자로 그리지 않고 `assets/brand/` 의 로고 파일을 쓴다.** 로고의 `o` 자리는
**앰버 원판 안의 흰 네잎클로버**라 글자로는 재현할 수 없다. 배경 밝기에 따라 파일이 다르다.

| 렌더러 | 종이색 | 쓰는 파일 | 비고 |
|---|---|---|---|
| 평일 `render-cards.mjs` | 어두움 `#0d0d0d` | `wordmark-briefing.png` | luckyon+브리핑 통짜. 이 축은 영문 카드에서도 `브리핑` 을 한글로 둔다 |
| 주말 `render-cards-sat/sun.mjs` | 크림 `#f2efe6` | `wordmark-luckyon-ink.png` | **먹색 글자판.** luckyon 까지만이고 `브리핑`/`Briefing` 은 글자로 남긴다 |

주말이 통짜 로고를 못 쓰는 이유는 두 가지다. 첫째, 그 축은 영문 카드에서 `Briefing` 으로
**번역**하고 색도 `P.accent`(sat 초록·sun 보라)를 따르는데, 통짜 로고를 넣으면 둘 다 사라진다.
둘째, 어두운 배경용 로고(흰 글자)를 크림 종이에 얹으면 `luckyon` 이 묻혀 **앰버 클로버만**
뜬다 (2026-08-23 에 실제로 그렇게 나왔다).

- **`flows.unit_ko/en` 은 부호+숫자 바로 뒤에 공백 없이 그대로 이어 붙는다** (`${sign}${value}${unit}`). `unit_en` 을 `"KRW tn"` 처럼 두면 `+1.7KRW tn` 로 붙어버린다 — 앞에 공백을 넣어 `" tn"` 처럼 쓰면 `+1.7 tn` 로 자연스럽게 나온다 (2026-08-20 pm 세션에서 실제로 이 사고가 있었다). `unit_ko` 는 `"조원"` 처럼 공백 없이 붙어도 한국어라 자연스러우므로 그대로 둔다.
- **`rank` 의 `rows[].pct` 는 "그 종목 자체의 등락률"이지, 상위 종목이 전체에서 차지하는 비중이 아니다.** 비중(거래대금 집중도 등)은 별도 필드인 `share.segments[].pct` 로 표현한다. 둘을 헷갈려 `rows[].pct` 에 비중을 넣으면 순위표 옆 등락 표시가 그 종목의 실제 등락과 달라진다.
- **`rows[].value` 는 언어 무관(invariant) 필드다** (`FORMAT_BRIEFING.md` §4). 원화 단위를 넣을 때 `"9.11조"` 처럼 한글을 넣으면 영어 카드에도 그대로 새어 나간다 — `"₩9.11T"` 처럼 중립 표기를 쓴다.
- **`rank` 의 `share.mode` 를 반드시 고른다.** 기본값은 `nested` 다.
  - `nested` — 하나의 전체를 조각으로 나눈 값(합이 100). 예: "상위 2종목 52.4% / 나머지 47.6%". 한 줄에 이어 붙인다.
  - `compare` — 서로 독립인 비율. 예: 종목별 공매도 비중. 각자 0~100 축 위의 제 막대로 그린다.
    독립인 값을 `nested` 로 그리면 조각 사이에 구분선이 생겨 "합쳐서 100%" 로 읽힌다 —
    47.5% 와 60.1% 를 이어 붙이면 합이 107% 인 그림이 나온다 (2026-08-22 실제 사고).
    `baseline` 에 표본 평균을 주면 견줄 기준선이 함께 선다.
- **`rank` 의 `rows[].short` 는 공매도 비중(%)이다.** 한 행이라도 있으면 열이 생기고 없는 행은 `—` 로 나온다.
  FINRA 일별 공매도 거래량 기준이라 시장조성자 헤지가 섞여 있다 — 절대값이 아니라 **표본 평균과의 거리**로 읽는다.
- **`econ` 의 마지막 열은 기본이 "예상 대비"(서프라이즈)다.** 예상치가 없는 지표에 전년동월
  대비 증감률을 넣을 때는 `col_delta_ko` 로 열 제목을 바꾸고, 각 행의 `sub` 에 무엇과 견준
  값인지 적는다. 열 제목이 "예상 대비" 인 채로 전년 대비 숫자를 넣으면 독자가 오해한다.
- **`econ` 은 `region:"KR"` 을 위로 올려 그린다.** JSON 순서와 무관하게 렌더러가 정렬한다 —
  한국 독자가 보는 카드이므로 한국 지표를 먼저 읽게 한다.

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

```jsonc
{
  "date":"YYYY-MM-DD", "session":"am"|"pm",
  "dateLabel_ko","dateLabel_en",

  // ── 1 표지 ────────────────────────────────────────────────
  "headline_ko","headline_en",                 // 한 줄. 40자 넘으면 두 줄로 접힌다
  "headline_sub_ko","headline_sub_en",
  "cover_kicker":"간밤 미국장 · 8/21 마감",     // 사진 위 작은 글씨
  "cover_facts":[                              // 3줄 고정. 아이콘 이름은 아래 목록에서
    ["shield","다우 +0.98% · S&P 500 +0.43%","53,277.01 / 7,674.37 · 3대 지수 모두 상승"]
  ],
  // 아이콘: shield · bond · chip · rate · ai · globe · clock · target

  // ── 2 시장 한눈에 ─────────────────────────────────────────
  "markets":[{"label","value","delta","dir":"up|down|flat","note_ko","note_en"}],  // 10개
  "tile_main":"NASDAQ",                        // 차트가 들어가는 큰 타일. pm 은 "KOSPI"
  "tile_side":["S&P 500","KOSPI"],             // 오른쪽 위아래 2개
  "tile_rest":["VIX","US 10Y","KOSDAQ","USD/KRW","Gold","WTI","Bitcoin"],  // 4+3
  "tile_lead":"...", "main_tile_note":"...",
  "market_note_ko","market_note_en",           // ※ 각주

  // ── 3 지수 기록 ───────────────────────────────────────────
  "chart_series_values":[26460.2, 26588.4, ...],   // 최근 9거래일 종가. 이게 없으면 차트가 안 그려진다
  "chart_series_labels":["8.11","8.12", ...],      // 같은 길이
  "chart_title":"지수는 올랐고 주간으로는 내렸다",
  "chart_sub":"나스닥종합 종가 · 최근 9거래일",
  "chart_note":"8.13 고점 26,803.03 → 8.20 저점 26,067.17 → 8.21 26,180.46",
  "record_section":"미국장 기록",               // pm 이면 "코스피 · 코스닥 기록"
  "record_kicker":"TODAY",

  // ── 4·5·6 카드 제목·부제 ──────────────────────────────────
  "sector_section":"섹터별 등락",  "sector_title","sector_sub",
  "rank_kicker","rank_title","rank_sub","rank_unit",
  "econ_kicker","econ_title","econ_sub",
  "tech_section":"AI · 반도체 기술",  "stories_section":"주요 소식",

  // ── 본문 6개 (제목으로 찾는다 — 순서는 무관) ───────────────
  "sections":[
    {"title_ko":"미국장 기록","title_en":"...",           // 또는 "코스피 · 코스닥 기록"
     "stats":[{"label_ko","label_en","value","delta","dir","sub_ko","sub_en"}],   // 2개
     "breadth":[{"label_ko","label_en","up","flat","down"}],                      // 1~2개
     "flows":{"label_ko","label_en","unit_ko","unit_en",
              "rows":[{"label_ko","label_en","value"}]},
     "note_ko","note_en"},
    {"title_ko":"섹터별 등락","bars":[{"label_ko","label_en","value"}],"note_ko","note_en"},
    {"title_ko":"거래대금 상위",
     "rows":[{"name_ko","name_en","value","pct","short"}],     // short 는 미국장만
     "share":{"label_ko","label_en","mode":"nested"|"compare",
              "segments":[{"label_ko","label_en","pct","color"}]},
     "note_ko","note_en"},
    {"title_ko":"실적 · 지표 발표",
     "stats":[{"label_ko","label_en","value","delta","dir","sub_ko","sub_en"}],   // 최대 8개
     "note_ko","note_en"},
    {"title_ko":"AI · 반도체 기술","items":[{"headline_ko","headline_en","body_ko","body_en"}]},  // 최대 6건
    {"title_ko":"주요 소식","items":[{"headline_ko","headline_en","body_ko","body_en"}]}          // 최대 6건
  ],

  // ── 9 일정 ────────────────────────────────────────────────
  "schedule_kicker","schedule_sub","schedule_title_ko","schedule_title_en",
  "market_hours":{"title_ko","title_en","lines_ko":[...],"lines_en":[...]},
  "schedule":[{"time","title_ko","title_en","detail_ko","detail_en","importance":"high|mid"}],  // 최대 7건

  // ── 10 아웃트로 ───────────────────────────────────────────
  "outro_tagline_ko","outro_tagline_en","next_brief_ko","next_brief_en",

  // ── 배경 사진 (선택이지만 권장) ───────────────────────────
  "card_photos":{                              // 카드 번호 → 장면 설명(영문이 잘 나온다)
    "1":"The NYSE trading floor moments after the closing bell, traders in silhouette…",
    "3":"A dark trading floor, index numbers streaming across a wall of screens…"
  },

  "caption_ko","caption_en","sources":[...]
}
```

**분량 상한** — 넘기면 푸터에 닿는다.

| 필드 | 상한 |
|---|---|
| `cover_facts` | 3줄. 첫 줄 한글 22자·영문 40자 |
| `markets` | 정확히 10개. `tile_main` 1 + `tile_side` 2 + `tile_rest` 7 |
| `chart_series_values` | 8~10점. 그보다 촘촘하면 x축 라벨이 겹친다 |
| `bars` | 10~15개 |
| `rows` (거래대금) | 5개 |
| `stats` (실적·지표) | 최대 8개 (2열 × 4행). 2026-08-23 에 타일을 190px 로 낮추고 글자를 줄여 6→8로 늘렸다 |
| `items` (AI·반도체, 카드7 / 주요 소식, 카드8) | 최대 6건씩. 본문 한글 90자·영문 160자 안쪽. 2026-08-23 에 두 카드의 글자·여백 크기를 통일해 카드8 도 카드7 과 같이 6건까지 늘렸다 |
| `schedule` | 최대 7건 |
| **채우는 순서**| 리서치 단계에서 이 상한보다 **여유 있게** 후보를 모아 두고(예: 실적·지표는 8~10개, 일정은 7~9개 조사), 검증을 통과한 것부터 상한까지 채운다. 상한에 못 미치게 조사해 놓고 빈 줄로 발행하지 않는다 — 아래 여백보다 촘촘한 카드가 낫다는 것이 2026-08-23 결정이다. |

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

### 수치 표기 — 비교 대상을 독자가 추측하게 두지 않는다

숫자에는 **«무엇과 비교한 것인가»** 가 반드시 붙는다. 아래는 특정 항목의 규칙이 아니라
**수치가 들어가는 모든 자리**(`markets` · `stats` · `schedule.detail` · 본문 `items.body`)에 적용된다.

**A. 변화를 무엇으로 말하는지에 따라 표기가 갈린다.**

| 대상 | 변화의 단위 | 표기 |
|---|---|---|
| 가격·지수 — 주가지수·환율·원자재·코인·VIX | **%** | `현재값` + `▲/▼x.xx%` |
| **그 자체가 이미 %이거나 점수인 것** — 금리·물가상승률·실업률·각종 확률·심리지수·Fear&Greed·스프레드 | **%p·포인트** | `이전값 → 현재값` + 화살표만 |

아래 칸이 이 규칙의 핵심이다. `4.63% ▼0.05%` 는 «4.63%가 0.05% 내렸다»로 읽혀 %와 %p 가 뒤엉킨다.
`4.68% → 4.63% ▼` 는 그 혼동이 원천적으로 없고 기준값을 따로 설명할 필요도 없다.
**10년물 국채만의 규칙이 아니다** — 위 성격이면 전부 같이 적용한다.
(2026-08-03 에 10년물을 직전 카드 값에서 임의로 가감해 틀리게 발행한 사고가 이 혼동에서 나왔다.)

- **양 끝값을 쓸 때 `delta` 에 숫자를 넣지 않는다.** 두 값이 이미 보이므로 중복인 데다,
  `markets` 타일에서 줄바꿈이 일어나 카드가 분량 초과된다(2026-08-14 실측). 화살표(`▲`·`▼`·`-`)만
  넣어 방향과 색만 남긴다.
- 양 끝값의 **기준 시점**이 자명하지 않으면 `note` 에 한 줄 밝힌다 (예: "전일 같은 시각 대비").

**B. 예상·이전은 문장이 아니라 고정 순서로 나열한다.**

서술어(하회·상회·기록했다)를 빼고 `시각 · 예상 X · 이전 Y` 순서로 고정한다. 판단은 독자 몫이다.

```
✗  전월비는 0.0%로 예상(+0.2%) 하회 · 전월 5.5%
✓  21:30 · 예상 +0.2% · 이전 -0.3%
```

- **한 타일 = 한 지표.** 전년비와 전월비는 서로 다른 지표다. 한 타일에 둘을 넣으면 제목·큰숫자와
  부연의 주어가 어긋난다 — 2026-08-14 am 에서 제목은 «PPI 전년비 4.7%» 인데 부연은 «전월비 0.0%» 로
  시작해 실제로 이 사고가 났다. 둘 다 중요하면 **타일을 나눈다.**
- `delta` 기준을 통일한다 — **예상치가 있으면 실제−예상, 없으면 실제−이전.** 어느 쪽인지 `note` 에 한 줄 밝힌다.
- **«예상치가 없다»는 조회로 확인한 뒤에만 말한다.** 정본은 `data/econ-calendar.json` 이고 **필드명은
  `consensus` 다 — `forecast` 가 아니다.** 이름을 잘못 짚으면 전 항목이 `None` 으로 나와 "예상치가
  없는 캘린더"로 오판하게 된다(2026-08-14 에 실제로 이 착오가 있었다). 같은 지표라도 전월비·전년비가
  각각 별도 이벤트로 들어 있으니 **쓰려는 그 이벤트**를 찾아 본다
  (예: 7월 PPI 는 전월비 예상 0.2%, **전년비 예상 4.9%** 가 둘 다 있었다).
- 그렇게 확인해도 정말 없으면 칸을 비우지 말고 **대체 기준**을 적는다 (국채 입찰이면 `WI`, 실적이면 전년 동기).

**C. 방향 기호는 방향만 뜻한다.** 좋고 나쁨을 담지 않는다 — 실업수당청구가 늘면 `▲` 이고,
그것이 나쁜 소식인지는 독자가 판단한다 (주말 축 §2-B 와 같은 규칙).

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
| `rank` | 이름 칸이 좁아 잘림(ellipsis). 고정 열(순위·값·등락률·공매도)이 554px 를 먹는다 | 종목명은 한글 10자·영문 18자 안쪽 |
| `econ` | 열 제목이 두 줄로 접힘 | `col_delta_ko` 는 8자 안쪽. 행은 6건까지 |
| 시장 카드(②) | 타일 note 가 3줄이 되면 10칸 격자가 밀림 | note 는 2줄 안쪽 |
| 일요일 ③ 캘린더 | 요일당 5건 이상이면 타일이 눌리고, 2건 이하면 카드가 빈다 | 요일당 **3~4건** (§2-B) |
| 일요일 ④ 지표 | 지표명이 2줄로 넘어감 | 한글 20자·영문 34자 안쪽 (`美 7월 소비자물가 (전년비)`) |
| 일요일 ⑤ 실적 | 기업명이 2줄로 넘어가 타일이 밀림 | 한글 12자 안쪽 (`어플라이드 머티어리얼즈` 가 상한) |
| 토요일 ② 지수 | 하단 `indexNote` 가 푸터와 겹침. 지수 note 5개가 각 3줄이고 `valuation.note` 까지 3줄이면 note 자리가 **아예 없다** (2026-08-15 실측 — 한 줄로 줄여도 겹쳤다) | 먼저 `valuation.note` 를 줄인다(출처·기준은 §2-A 필수라 남기고 벤더 편차 설명 같은 부연부터 뺀다). 그래도 겹치면 **`indexNote_ko` 를 빈 문자열로 둔다** — `t()` 는 언어 간 폴백이 없어 한쪽 언어만 비울 수 있고, 기준일은 `valuation.note` 와 카드 ④ `metricsNote` 가 이미 밝힌다. 영어는 지수 note 가 짧아 대개 그대로 들어간다 |

---

## 7. 이 문서를 고칠 때

**`scripts/render-cards.mjs` 에 카드 유형·필드를 추가하면, 같은 커밋에서 이 문서도 고친다.** 세션이 아는 것은 문서뿐이라, 문서에 없는 필드는 쓰이지 않는다.

- 예시 콘텐츠(`content/*.json`)만 바꿔 두는 것으로는 부족하다 — 세션은 예시를 참고하되 스키마를 따른다.
- **실제로 그렇게 사고가 났다**: 2026-08-03 에 데이터 카드 3종과 `summary` 를 렌더러에 넣고 pm 콘텐츠에 적용했지만 문서를 고치지 않아, 다음 날 아침 세션이 글 카드 네 장만 만들어 발행했다.
- 사용자와 합의해 **기본값을 바꿨다면 그 결정을 문서에 반영한다.** 같은 사고에서 `summary` 를 기본으로 정했는데 문서에는 `hook_bull` 이 기본값으로 남아 있어 결정이 되돌려진 채 발행됐다.
- 변경 이유를 한 줄로 남긴다. 나중에 왜 그렇게 정했는지 모르면 다시 되돌려진다.
