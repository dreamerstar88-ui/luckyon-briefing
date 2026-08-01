# luckyon 브리핑 — 주말 루틴 절차서 (토: 주간 결산 / 일: 다음 주 일정)

> **아직 비활성 상태입니다.** 주말 브리핑을 시작하기로 하면 claude.ai/code/routines 에 아래 두 루틴을 등록하기만 하면 됩니다. 코드(카드 8장 렌더러·발행 스크립트)는 이미 sat/sun 세션을 지원합니다.
>
> **① 토요일 주간 결산** — 매주 토요일 07:35 KST 실행 (금요일 미국장 마감 직후, 발행 약 08:00)
> ```
> 저장소의 ROUTINE_PROMPT_WEEKEND.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
> LANG = ko
> SESSION = sat
> ```
>
> **② 일요일 다음 주 일정** — 매주 일요일 20:30 KST 실행 (발행 약 21:00, 월요일 대비)
> ```
> 저장소의 ROUTINE_PROMPT_WEEKEND.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
> LANG = ko
> SESSION = sun
> ```
>
> 영어본은 각각 `LANG = en` 으로 별도 루틴을 만드세요.
> 주말 루틴을 활성화한 뒤에는, 평일 절차서(ROUTINE_PROMPT.md)의 금요일 저녁 `next_brief` 문구를 "내일 아침 8시, 한 주 결산"으로 바꾸는 것을 잊지 마세요 (아래 참고).

---

당신은 "luckyon 브리핑"의 자동 발행 담당입니다. 저장소 `luckyon-briefing`이 클론된 상태이며, 목표는 주말용 카드뉴스를 생성해 Instagram에 캐러셀로 발행하는 것입니다.

주말 브리핑은 평일(아침/저녁)과 역할이 다릅니다:

| | 토요일 (sat) — 주간 결산 | 일요일 (sun) — 다음 주 일정 |
|---|---|---|
| 발행 목표 시각 | 08:00 KST | 21:00 KST |
| 다루는 범위 | 지난 월요일 ~ 금요일(미국장은 금요일 마감까지) 한 주 정리 | 다음 주 월요일 ~ 금요일 예정 일정 |
| 성격 | "이번 주 무슨 일이 있었나" | "다음 주 무엇을 봐야 하나" |

카드 8장 구조와 스키마는 평일과 동일하고, **각 칸에 채우는 내용만 다릅니다.** 아래를 순서대로 수행하세요.

1. **의존성 확인**: `npm ls playwright` 로 playwright가 있는지 확인하고, 없으면 `npm install` 을 실행한다.
   - `npm install` 이 403 등으로 실패하는 환경이면: `mkdir -p node_modules && ln -sf /opt/node22/lib/node_modules/playwright node_modules/playwright`

2. **날짜·세션 확인**: 한국시간(KST) 기준 오늘 날짜를 `YYYY-MM-DD` 형식으로 `DATE` 로 정한다. `SESSION` 은 sat 또는 sun.

3. **리서치**: WebSearch로 조사한다. 지난 한 주의 평일 콘텐츠 파일들(`content/` 의 이번 주 am/pm JSON)을 먼저 읽으면 한 주 흐름을 빠르게 파악할 수 있다 — 단, 주간 등락률·최신 일정은 반드시 웹에서 다시 확인한다.

   **SESSION = sat (주간 결산)일 때:**
   - **markets 10타일 — 주간 등락**: S&P 500, NASDAQ, DOW, KOSPI, KOSDAQ, 미 10년물, 원/달러, 금, WTI, 비트코인. `value` 는 금요일 마감가, `delta` 는 **주간 등락률** ("▲ 주간 +2.1%" 형식, dir 도 주간 방향).
   - **econ 6건**: 이번 주 경제·금융을 움직인 핵심 이슈 6건. 단신 나열이 아니라 "한 주의 흐름"으로 정리한다 (무슨 일이 → 시장에 어떤 영향). `time` 은 발생 요일로 표기 (예: "7/14(화)").
   - **ai 6건**: 이번 주 AI·테크 핵심 이슈 6건. 같은 방식.
   - **market_hours 박스 재활용** → `title_ko`: "이번 주 시장 한 줄 평", `lines_ko`: 한 주 총평 1~2줄 (예: "CPI 둔화에도 중동 리스크로 유가·금리 상승", "나스닥 주간 +1.2%로 3주 연속 상승").
   - **schedule 4~6건**: **다음 주 핵심 일정 미리 보기** (요일+시각 KST, 예: "월 22:30"). 상세한 일정은 일요일 브리핑이 다루므로 여기서는 가장 굵직한 것만.
   - `schedule_title_ko`: "다음 주 미리 보기"

   **SESSION = sun (다음 주 일정)일 때:**
   - **markets 10타일 — 금요일 마감 스냅샷**: 토요일과 같은 10개 지표, `delta` 는 주간 등락 유지. `market_note` 에 "금요일 마감 기준" 을 명시.
   - **econ 6건 → 다음 주 경제 일정 6건**: 지표 발표·중앙은행 이벤트를 일정마다 한 건으로. `headline` = 일정명(요일 포함, 예: "수요일 밤 미국 6월 CPI 발표"), `body` = 왜 중요한지·컨센서스·관전 포인트, `src` = 발표 기관, `time` = "수 7/22 21:30 KST" 형식.
   - **ai 6건 → 다음 주 실적·테크 이벤트 6건**: 주요 기업 실적 발표(장전/장후 구분)와 AI·테크 행사. 같은 형식.
   - **market_hours 박스** → `title_ko`: "다음 주 증시 개장", `lines_ko`: ["한국 정규장 월~금 09:00 ~ 15:30", "미국 정규장 월~금 22:30 ~ 익일 05:00 (서머타임 기준)"] — 11월 초~3월 초에는 미국을 "23:30 ~ 익일 06:00" 으로. 다음 주에 휴장일이 있으면 한 줄 추가한다 (예: "미국 월요일 휴장 — 노동절").
   - **schedule 4~6건**: 다음 주 일정 중 **시장 영향이 가장 큰 TOP 픽**만 추려 하이라이트. econ/ai 카드와 겹쳐도 된다 — 이 카드는 "이것만은 캘린더에 적어두세요" 역할.
   - `schedule_title_ko`: "다음 주 TOP 픽"

   - 중요 일정은 `"importance": "high"` (카드에 "주목" 배지), 나머지는 `"mid"`.
   - 각 항목은 결론부터 1~2문장, 한국어·영어 두 버전 모두 작성한다.
   - 위 예시처럼 delta·time·src 에 한국어가 들어가면("▲ 주간 +2.1%", "7/14(화)", "수 7/22 21:30 KST") 반드시 `_ko`/`_en` 으로 분리해 영어판에는 영어 표기("▲ +2.1% w/w", "Tue 7/14", "Wed 7/22 21:30 KST")를 쓴다. 수치는 일의 자리까지 정확하게 (근사치 "62K대" 금지). — 상세 규칙은 ROUTINE_PROMPT.md 4단계 참조.

4. **콘텐츠 JSON 작성**: `content/<DATE>-<SESSION>.json` 으로 저장한다. 스키마는 평일(ROUTINE_PROMPT.md 4단계)과 동일하며, 아래 주말 전용 값을 쓴다.
   - `headline`: sat = 이번 주 최대 이슈 요약 / sun = 다음 주 최대 관전 포인트.
   - `next_brief` 고정 문구:
     - `sat`: "📅 다음 브리핑 — 내일 저녁 9시, 다음 주 일정 총정리" / "📅 Next brief — Sunday 9 PM KST, the week ahead"
     - `sun`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next brief — 8 AM KST, US close wrap-up"
   - `outro_tagline` (주말 전용, 아웃트로 큰 문구를 교체한다):
     - `outro_tagline_ko`: "평일엔 매일 아침·저녁,<br>주말엔 한 주를 한눈에"
     - `outro_tagline_en`: "Twice daily on weekdays,<br>the full week on weekends"
   - caption: sat 은 "한 주 결산" 임을, sun 은 "다음 주 일정" 임을 첫 줄에 밝힌다. 요약 + 팔로우/저장 유도 + 해시태그 15개 내외 + next_brief 예고 한 줄.
   - **한국어 맞춤법·띄어쓰기 검증**: 저장 전에 모든 한국어 텍스트를 다시 읽으며 점검한다 (평일 절차서와 동일 기준). 특히 "주간 +2.1%" 처럼 단위·기호 표기를 통일한다.

5. **카드 이미지 생성**:
   - `node scripts/render-cards.mjs <DATE> ${LANG} <SESSION>`
   - `cards/<DATE>/<SESSION>/${LANG}/` 에 card1~8.png 확인.

6. **고정 브랜치 `claude/live` 에 커밋 & 푸시** (평일과 동일):
   ```
   git fetch origin claude/live
   git checkout -B claude/live FETCH_HEAD          # 항상 원격 최신 기준
   git add content/<DATE>-<SESSION>.json cards/<DATE>/<SESSION>
   git commit -m "brief: <DATE> <SESSION> (${LANG})"
   git push origin claude/live
   git rev-parse HEAD origin/claude/live           # 두 해시가 같은지 확인
   ```
   **`git add -A` 를 쓰지 않는다.** 이 계정은 여러 콘텐츠 축(브리핑·스토리·릴스·차트 노트)을 함께 운영하며
   축마다 별도 세션이 돈다. `-A` 는 다른 축이 만들다 만 파일까지 끌고 들어와 검증 안 된 콘텐츠를 발행시킬 수 있다.
   **자기 축 경로만 명시해서 add** 하고, push 가 거부되면 `--force` 대신 `git fetch` 부터 다시 한다.

7. **토큰 만료 점검**: `IG_TOKEN_EXPIRES_AT` 가 오늘로부터 10일 이내면 PushNotification으로 "인스타 토큰 갱신 필요 (만료 임박)" 알림.

8. **Instagram 발행**:
   - `node scripts/publish-instagram.mjs <DATE> ${LANG} <SESSION>`
   - 성공 시 media id 를 로그에 남기고, 실패 시 원인(토큰/권한/URL)을 판단해 PushNotification으로 알린다.

9. **마무리 보고**: 세션, 언어, media id, 카드 수, 실패 내용을 요약한다.

### 활성화할 때 평일 절차서에 반영할 것 (사람이 직접 또는 Claude에게 요청)
ROUTINE_PROMPT.md 4단계의 `next_brief` 규칙에 아래 예외를 추가하세요:
- 금요일 `pm`: "📊 다음 브리핑 — 내일 아침 8시, 한 주 결산" / "📊 Next brief — 8 AM KST, the week in review"
(주말 루틴이 없는 동안 금요일 저녁 카드가 "내일 아침 8시"를 예고하면 실제로는 월요일에야 다음 브리핑이 나가므로, 활성화 전까지는 금요일 pm 의 next_brief 를 "다음 브리핑 — 월요일 아침 8시" 로 쓰는 것이 정확합니다.)

### 이 루틴의 언어·세션 설정
LANG = ko        ← 영어본 루틴에서는 en 으로.
SESSION = sat    ← 토요일 루틴은 sat, 일요일 루틴은 sun.
