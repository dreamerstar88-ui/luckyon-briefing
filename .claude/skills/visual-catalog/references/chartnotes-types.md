# 차트 노트(투자 3분 노트) — 이미 있는 카드 타입 12종

**갱신 2026-08-31.** 출처: `luckyon-briefing/ROUTINE_PROMPT_CHARTNOTES.md`
렌더러: `luckyon-briefing/scripts/chart-notes/render-chartnotes.mjs`

---

## 먼저 읽을 것 — 새로 만들기 전에 여기서 찾는다

절차서가 못 박아 둔 문장이다.

> **"타입을 새로 만들 일은 거의 없다. 위 12종이 로드맵 24회차의 그림을 사실상 전부 덮는다"**
> `lines` 하나가 골든크로스·지지저항·추세선·VIX·볼린저밴드·배당락을 다 그리고,
> `bars` 하나가 거래량·시가총액·PER·PBR·EPS·배당수익률·ROE 를 다 그린다.
> **주제가 바뀌어도 바뀌는 것은 숫자와 라벨뿐이지 타입이 아니다.**

**후보를 낼 때는 이 12종에서 먼저 고른다.** 밖(Monocharts 등)은 12종으로 안 될 때만 본다.

---

## 12종

| type | 쓰임 | 주요 필드 |
|---|---|---|
| `cover` | p.01 표지 | `title` `sub` `cta` `annot`(`\|`로 줄바꿈) `overlay`(선택) |
| `intro` | p.02 도입 | `title` `body` `caption` |
| **`pricevol`** | **주가 + 거래량 2단 패널** — 실제 차트가 생긴 그대로 | `mode`(`candle`\|`line`) `bars[].{o,h,l,c,v,hi}` `avg` `avg_label` `callout.{i,text}` `xlabels[].{i,text}` `price_label` `panel_label` `frame` `closing` |
| **`lines`** | **선 그래프** — 선 여러 개·교차점·수평선·밴드 | `series[].points` `marker` `levels[]` `band` `closing` |
| **`bars`** | **막대 비교** — 종목 간 순위 | `items[].label/value/display/highlight` 또는 `sections[].{heading,items}` |
| `example` | **실제 시세 사례** (캔들 한 개) | `sub` `direction` `values.{high,close,open,low}` `conclusion` `note` |
| `formula` | **공식** — 분수 + 항 설명 + 계산 예시 | `formula.{numerator,denominator,result}` `parts[]` `example` |
| `anatomy` | 구조를 화살표로 분해 | `labels.upper/body/lower` |
| `compare` | 둘을 나란히 비교 | `legend[]` `rows[]` `closing` |
| `checklist` | 용어 여러 개 나열 | `items[].term/desc` `closing` |
| `numbered` | 번호 매긴 3가지 + 경고 | `items[].title/desc` `warn_title` `warn_body` |
| `recap` | p.08 요약 + 다음 편 예고 | `points[]` `ctas[]` `next_label` `next` `disclaimer` |

모든 텍스트 필드는 `_ko` / `_en` 접미사로 두 언어를 각각 쓴다. `title` 은 `<br>` 로 줄바꿈.

### 표지 `overlay` 4종

| 값 | 그림 | 쓸 때 |
|---|---|---|
| (없음) | 캔들만 | 주석이 캔들을 가리킬 때 |
| `ma` | 이동평균선 곡선 **1개** | 주석이 '선 하나'를 가리킬 때 |
| `cross` | 교차하는 곡선 **2개** + 붉은 원 | 주석이 '두 선이 만나는 순간'을 말할 때 |
| `volume` | 캔들 + **아래 거래량 칸** 2단 | 주석이 '가격 아래 칸'을 가리킬 때 |

**주석(`annot`)이 가리키는 대상이 실제로 그려지는지 확인한다.**
EP.03 을 `ma` 로 두었더니 주석은 "선 두 개가 만나는 순간"인데 화면에는 선이 하나뿐이라
**가리킬 교차점이 없었다**(검증에서 적발).

---

## 건드리면 안 되는 것

| 항목 | 규칙 |
|---|---|
| **캔들 색** | JSON 에서 지정하지 않는다. `direction: "up"\|"down"` 만 준다. 렌더러가 **언어권 관행**을 적용한다 — 한국어판 상승=빨강·하락=파랑 / 영어판 상승=초록·하락=빨강 |
| **급증일 강조** | `hi: true`. **색은 그대로 두고 검은 테두리로만** 짚는다. 붉게 칠하면 한국어판 «빨강=상승» 과 어긋난다 (하락일 급증에서 실제로 어긋난 적 있음) |
| **디자인 토큰·레이아웃** | 회차마다 바꾸지 않는다. 크림 모눈 노트 · 스프링 제본 · 감청색 헤더 · 붉은 포인트 · 노란 형광펜. 고칠 일이 있으면 **렌더러를 고쳐 전 회차에 같이** 적용한다 |
| **모노크롬 기법** | **쓰지 않는다.** Monocharts 의 "색 대신 채움/테두리" 방식은 이 시리즈와 충돌한다. 여기서는 색이 곧 의미다 |

---

## 흔한 잘못 — 실제로 겪은 것

| 잘못 | 무슨 일이 있었나 | 올바른 선택 |
|---|---|---|
| 거래량을 `bars` 로 | EP.04 초안이 거래량을 **가로 막대**로 설명했다가 *"막대그래프 얘기인지 거래량 얘기인지 모르겠다"* 는 지적을 받고 통째로 다시 만듦 (2026-08-23 이슈 #21) | **`pricevol`.** 가격과 나란히 봐야 하는 것은 전부 `pricevol` 이다. `bars` 는 **종목 간 비교**에만 |
| `overlay` 가 주석과 불일치 | EP.03 — 주석은 교차점을 말하는데 `ma` 라 선이 하나뿐 | 주석 문구를 고치기 전에 `overlay` 부터 본다 |

---

## 주제 → 타입 대응표 (후보를 낼 때 여기부터)

| 주제 | 타입 |
|---|---|
| 캔들·봉 읽는 법 | `example` (한 개) · `pricevol` (여러 개) |
| 이동평균선·추세선·지지저항 | `lines` |
| 골든크로스·데드크로스·MACD·볼린저밴드 | `lines` + `marker` · 표지 `overlay: cross` |
| 거래량·거래대금 | **`pricevol`** (`bars` 아님) · 표지 `overlay: volume` |
| VIX·배당락 | `lines` |
| 시가총액·PER·PBR·EPS·배당수익률·ROE 순위 | `bars` |
| PER·PBR 같은 **계산식** | `formula` |
| 두 개념 비교 (성장주 vs 가치주 등) | `compare` |
| 용어 여러 개 | `checklist` |
| 구조 분해 (봉 하나의 구성 등) | `anatomy` |

---

## 12종으로 안 되는 것 — 그때 밖을 본다

절차서의 예외 조항이다.

> *"정말 안 되는 그림(예: **호가창 표, ETF 구성 비율**)을 만나면 억지로 끼워 넣지 말고
> **렌더러에 새 타입을 추가**하고 위 표에 한 줄 적어 둔다. 그 타입은 다음 회차부터 재사용된다."*

**새 타입을 만들기 전에 `catalog-sites.md` 를 훑는다.** 아래는 12종에 없는 것들이다.

| 필요해질 주제 | Monocharts 에 있는 것 | 비고 |
|---|---|---|
| **ETF 구성 비율** | `Treemap` · `Donut` | 절차서가 예로 든 바로 그것 |
| 자산 배분·섹터 비중 | `Donut` · `Treemap` | |
| 자금 흐름 (매출→비용→이익) | `Sankey` | |
| 실적 증감 분해 | `Waterfall` | |
| 목표 대비 달성 | `Bullet` | |
| 공포탐욕지수·밸류에이션 수준 | `RadialGauge` · `Meter` · `GaugeArc` | |
| 섹터별 등락·상관관계 | `Heatmap` · `ActivityHeatmap` | |
| 종목 다면 비교 | `Radar` · `Polar` | |
| 위험 대비 수익 | `Scatter` · `Bubble` | |
| 52주 최고·최저 밴드 | `Range` | `lines` 의 `band` 로도 가능 — **먼저 그쪽을 본다** |
| **호가창 표** | **없음** | 새로 만들어야 한다 |

**가져올 때는 코드가 아니라 규격만 옮긴다.** 차트노트 렌더러는 자체 캔버스 구현이고
Monocharts 는 React + Recharts 다. → `transfer-notes.md`

---

## 새 타입을 추가했으면 할 일

1. `render-chartnotes.mjs` 의 `R` 객체에 타입을 추가한다
2. `ROUTINE_PROMPT_CHARTNOTES.md` 의 12종 표에 **한 줄 적는다**
3. **이 파일의 12종 표에도 적는다** — 안 적으면 다음 회차가 또 새로 만든다
