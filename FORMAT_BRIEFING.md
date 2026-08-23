# 브리핑 카드 구조·양식 (FORMAT)

> **이 문서가 정의하는 것**: `scripts/render-cards.mjs` 가 그리는 카드의 **구조·스키마·분량**.
> 렌더러와의 계약서이며 **평일 브리핑(am·pm)과 주말 브리핑(sat·sun)이 공용으로 따른다.**
>
> **이 문서가 정의하지 않는 것**
> - 무엇을 조사하고 무엇을 쓸지 → 축별 절차서(`ROUTINE_PROMPT.md`, `ROUTINE_PROMPT_WEEKEND.md`)
> - 어떻게 검증하고 발행할지 → `ROUTINE_COMMON.md`
>
> **왜 따로 뺐나**: 예전에는 이 내용이 평일 절차서 안에만 있었다. 주말 브리핑은 **같은 렌더러·같은 경로**를 쓰면서도 절차서가 달라, 2026-08-03 에 추가된 데이터 카드(stats·bars·rank)와 `summary` 훅을 주말 축은 전혀 알지 못했다. 구조·양식을 한 곳에 두면 이 어긋남이 구조적으로 사라진다.
>
> **스토리·차트노트·릴스는 렌더러가 달라 이 문서를 쓰지 않는다.**

---

## 1. 카드 구성

| 카드 | 내용 | 근거 필드 |
|---|---|---|
| ① | 훅 | `headline_*` + `summary` (또는 `hook_bull`/`hook_bear`) |
| ② | 시장 한눈에 (10칸 격자) | `markets[]` x10, `market_note_*` |
| ③④⑤⑥⑦ | 본문 5장 | `sections[]` x5 |
| ⑧ | 주요 일정 | `market_hours`, `schedule[]` |
| ⑨ | 아웃트로 | `next_brief_*`, `outro_tagline_*` |

- **총 장수 = `sections.length` + 4.** `sections` 6장이면 10장이다 (2026-08-23 개편 이후 아침·저녁 모두 6장).
  **인스타그램 캐러셀 상한이 10장이므로 `sections` 는 6장을 넘길 수 없다.** 7장이 되면 발행이 거부된다. 단 **`schedule` 과 `market_hours` 가 둘 다 있어야** ⑧이 그려진다 — 하나라도 빠지면 렌더러가 일정 카드를 통째로 건너뛰어 오류 없이 8장만 나온다. §6 에서 장수를 셀 때 이것부터 본다.
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

공통 필드는 `title_ko/en`, `color`, `note_ko/en` (모든 유형 동일).

- **`type` 을 비워 두지 않는다.** 없으면 문장만 나열한 글 카드가 되어 "수치를 형태로 보여준다"는 개편 목적이 사라진다. 2026-08-04 am 세션이 실제로 네 장 모두 글 카드로 발행한 사고가 있었다.
- **수치 카드가 최소 두 장은 되어야 한다.** 그날 재료가 축별 표의 성격과 안 맞으면 유형을 바꿔도 되지만, 전부 글 카드가 되면 안 된다.
- **`type` 을 넣었다고 검증(`ROUTINE_COMMON.md` §3)이 면제되지 않는다.** 카드 형태만 바뀔 뿐 내용 기준은 같다.

### `stats` 의 `cols`

`1` 이면 가로로 긴 행(라벨·부연 왼쪽, 큰 숫자 오른쪽)을 위에서 아래로 쌓고, `2`(기본값)면 2열 격자로 놓는다. 타일이 하나뿐이면 자동으로 1열이다.

- **같은 종류를 순서대로 비교시키는 데이터는 `cols: 1`** — 지수 3개처럼. 표처럼 세로로 훑힌다.
- **성격이 다른 지표를 4~6개 늘어놓을 때는 `cols: 2`.**

---

## 3. 훅 카드 (①)

### 3.1 `summary` — 이미 벌어진 일을 정리하는 세션의 기본값

**am · pm · sat 세션은 `summary` 를 쓴다.**

- 스키마: `"summary": {"lines_ko":[...], "lines_en":[...]}` — 그날(그 주)의 핵심을 불릿 3~4개로, 각 1문장.
- 쓰는 순서: 결과 → 무엇이 그렇게 만들었나 → 수급·거래대금 → 반대로 움직인 것. 이렇게 쓰면 자연스럽다.
- **왜 호재/악재로 안 가르나**: 호재·악재는 **앞으로 벌어질 일의 '재료'** 를 가리키는 말이다. am·pm·sat 은 **이미 끝난 장의 결과**를 다루므로 확정된 결과를 그렇게 가르면 어색하다. (2026-08-03 사용자 결정, 2026-08-04 에 sat 까지 확대)

### 3.2 `hook_bull` / `hook_bear` — 아직 안 벌어진 일을 다루는 세션 전용

**`sun` 세션에만 쓴다.** 다음 주를 미리 보는 회차라 아직 결과가 없고, 재료를 기대/경계로 가르는 것이 자연스럽다.

- 스키마: `"hook_bull": {"body_ko","body_en"}`, `"hook_bear": {...}` — 각 1~2문장.
- `sun` 에서는 렌더러가 라벨을 **'기대 요인 / 경계 요인'** 으로 바꿔 출력한다 (색·화살표는 그대로).
- **구체적인 종목·수치·사건**을 담는다. "투자심리가 개선됐습니다" 같은 뭉뚱그린 말은 쓰지 않는다. 각각 **단일 사실 하나씩**만 담고 여러 개를 나열하지 않는다.
- **확실한 것만 넣는다 — 한쪽만 뚜렷하면 그쪽만 넣는다.** 억지 낙관으로 빈칸을 채우지 않는다. 한쪽만 있으면 렌더러가 `headline_sub` 를 함께 노출해 카드가 비어 보이지 않게 한다.

### 3.3 렌더러 우선순위 (중요)

**`summary` 가 있으면 렌더러가 무조건 이것을 쓴다** — `hook_bull`/`hook_bear` 를 함께 넣어도 무시된다. 그러므로 **둘을 같이 채우지 말고 세션에 맞는 하나만** 쓴다.

| 세션 | 훅 필드 |
|---|---|
| `am` · `pm` · `sat` | `summary` |
| `sun` | `hook_bull` / `hook_bear` |

---

## 4. 언어 무관(invariant) 필드 — 사고가 가장 잦은 지점

아래 필드는 렌더 스크립트가 `${LANG}` 분기 없이 **base 필드 이름 그대로** 출력한다. 즉 **한국어 카드와 영어 카드에 똑같이 박힌다.**

```
markets[].label   markets[].value   markets[].value_sub   markets[].delta
sections[].items[].src            sections[].items[].time
sections[].stats[].value          sections[].stats[].delta
sections[].rows[].value
schedule[].time
```

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

## 5. 콘텐츠 JSON 스키마

```
{
  "date", "session",                          // session: "am" | "pm" | "sat" | "sun"
  "dateLabel_ko","dateLabel_en",
  "headline_ko","headline_sub_ko","headline_en","headline_sub_en",
  "summary":{"lines_ko":[...],"lines_en":[...]},   // am·pm·sat (§3.1)
  "hook_bull":{"body_ko","body_en"},               // sun 전용 (§3.2)
  "hook_bear":{"body_ko","body_en"},               // sun 전용
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

**`market_hours`**
- `am`: 제목 "한국 증시 운영시간", 내용 "정규장 09:00 ~ 15:30 · 동시호가 08:30~09:00 / 15:20~15:30"
- `pm`: 제목 "미국 증시 운영시간", 내용 "정규장 22:30 ~ 익일 05:00 (서머타임 기준)" — 11월 초~3월 초에는 "23:30 ~ 익일 06:00". 프리마켓/애프터마켓 시간을 한 줄 더 넣어도 좋다.
- `sat`·`sun`: 제목 "다음 주 증시 개장" / "Next Week's Market Hours", 내용 두 줄 — "한국 정규장 월~금 09:00 ~ 15:30", "미국 정규장 월~금 22:30 ~ 익일 05:00 (서머타임 기준)". 주말 카드에 한 나라 운영시간만 싣는 것은 의미가 없다(둘 다 닫혀 있고 독자가 대비할 것은 다음 주다). **다음 주에 휴장일이 있으면 한 줄 추가한다** (예: "※ 미국 월요일 휴장 — 노동절").
- **휴장일 처리**: 해당 세션의 시장이 공휴일로 휴장이어도 브리핑을 건너뛰지 않는다. `lines` 에 "※ 오늘(M/D)은 ○○로 하루 휴장" 한 줄을 추가하고, `schedule` 첫 항목에 휴장 안내를 `importance: "high"` 로 넣고, 헤드라인·`market_note` 에도 반영한다.

**`next_brief`**
- `am`: "🌙 다음 브리핑 — 오늘 밤 9시, 미국장 개장 전" / "🌙 Next brief — 9 PM KST, before the US open"
- `pm`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next brief — 8 AM KST, US close wrap-up"
- **금요일 `pm`**: "📊 다음 브리핑 — 내일 아침 8시, 한 주 결산" / "📊 Next brief — 8 AM KST, the week in review"
- `sat`: "🗓 다음 브리핑 — 내일 밤 9시, 다음 주 일정" / "🗓 Next brief — 9 PM KST tomorrow, the week ahead"
- `sun`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next brief — 8 AM KST, US close wrap-up"

**`outro_tagline`** — 평일은 비워 두면 렌더러 기본 문구가 나온다. **주말(`sat`·`sun`)만 아래로 교체한다**:
- `outro_tagline_ko`: `"평일엔 매일 아침·저녁,<br>주말엔 한 주를 한눈에"`
- `outro_tagline_en`: `"Twice daily on weekdays,<br>the full week on weekends"`

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

`cards/<DATE>/<SESSION>/ko/`, `.../en/` 각각에 `card1~9.png` 가 생겼는지 확인한다.

- **훅 카드(①) 확인**: am·pm·sat 은 `summary` 불릿이 보이는 것이 정상이다. 호재·악재 블록이 보인다면 `summary` 를 안 넣었다는 뜻이니 §3 을 다시 본다. (`sun` 은 반대.)
- **카드 분량 초과 확인 (매번 필수 · 10장 전부, 두 언어 모두 눈으로 본다)**: 영어는 같은 내용도 줄바꿈이 많아져 카드 높이(1350px)를 넘기기 쉽다. **렌더 성공 로그만 보고 넘어가지 말고 이미지를 실제로 연다** — 스크립트는 넘쳐도 오류 없이 성공한다. 하단 텍스트가 푸터("luckyon 브리핑"·페이지 번호)와 겹치면 **그 언어 텍스트만** 줄여 재렌더링한다 (사실관계나 다른 언어 필드는 건드리지 않는다). 겹침이 없어질 때까지 반복한다.

자주 넘치는 곳과 대처:

| 카드 | 증상 | 대처 |
|---|---|---|
| 글 카드(`items`) | 항목 4~5건일 때 마지막 항목의 출처 줄이 푸터에 닿음 | 본문을 각 **1줄**로. 헤드라인이 2줄로 넘어가면 그것만으로 한 항목이 밀린다 |
| `stats` | `cols:2` 에서 타일 3개는 2행이 되고 라벨·부연이 길면 높이가 제각각 | `cols:1` 은 부연(`sub`)이 2줄로 넘어가지 않게 짧게 |
| `bars` | 라벨이 잘림(ellipsis) | 한글 8자·영문 15자 안쪽 (예: "커뮤니케이션 (XLC)"→"통신 (XLC)", "Industrials (XLI)"→"Indu. (XLI)") |
| 시장 카드(②) | 타일 note 가 3줄이 되면 10칸 격자가 밀림 | note 는 2줄 안쪽 |

---

## 7. 이 문서를 고칠 때

**`scripts/render-cards.mjs` 에 카드 유형·필드를 추가하면, 같은 커밋에서 이 문서도 고친다.** 세션이 아는 것은 문서뿐이라, 문서에 없는 필드는 쓰이지 않는다.

- 예시 콘텐츠(`content/*.json`)만 바꿔 두는 것으로는 부족하다 — 세션은 예시를 참고하되 스키마를 따른다.
- **실제로 그렇게 사고가 났다**: 2026-08-03 에 데이터 카드 3종과 `summary` 를 렌더러에 넣고 pm 콘텐츠에 적용했지만 문서를 고치지 않아, 다음 날 아침 세션이 글 카드 네 장만 만들어 발행했다.
- 사용자와 합의해 **기본값을 바꿨다면 그 결정을 문서에 반영한다.** 같은 사고에서 `summary` 를 기본으로 정했는데 문서에는 `hook_bull` 이 기본값으로 남아 있어 결정이 되돌려진 채 발행됐다.
- 변경 이유를 한 줄로 남긴다. 나중에 왜 그렇게 정했는지 모르면 다시 되돌려진다.
