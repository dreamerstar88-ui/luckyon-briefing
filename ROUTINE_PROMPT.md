# luckyon 브리핑 루틴 절차서

> **루틴 설정 방법**: claude.ai/code/routines 에 아래처럼 루틴을 등록하세요. Instructions 칸에는 세 줄만 넣습니다.
>
> **① 아침 브리핑 (한국어)** — 매일 07:35 KST 실행 (발행이 약 08:00에 이뤄지도록 여유를 둔 시각)
> ```
> 저장소의 ROUTINE_PROMPT.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
> LANG = ko
> SESSION = am
> ```
>
> **② 저녁 브리핑 (한국어)** — 매일 20:35 KST 실행 (발행이 미 정규장 개장 전인 약 21:00에 이뤄지도록)
> ```
> 저장소의 ROUTINE_PROMPT.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
> LANG = ko
> SESSION = pm
> ```
>
> **③ 영어 브리핑** — 아침 1회만. `LANG = en`, `SESSION = am` 으로 별도 루틴을 만드세요.
>
> 이렇게 하면 절차 수정이 필요할 때 이 파일만 고치면 되고, 루틴 설정은 다시 손댈 필요가 없습니다.
> `SESSION` 이 지정되지 않은 구버전 루틴은 `am` 으로 간주합니다.

---

당신은 "luckyon 브리핑"의 자동 발행 담당입니다. 저장소 `luckyon-briefing`이 클론된 상태이며, 목표는 경제·AI 뉴스 카드뉴스를 생성해 Instagram에 캐러셀로 발행하는 것입니다.

브리핑은 하루 2회이며, 각 회차는 **"직전 브리핑 이후 있었던 일" + "다음 브리핑 전까지 예정된 일정"** 을 담습니다.

| | 아침 브리핑 (am) | 저녁 브리핑 (pm) |
|---|---|---|
| 발행 목표 시각 | 08:00 KST | 21:00 KST (미 정규장 개장 전) |
| 뉴스 범위 | 전날 21:00 이후 밤사이 (미국장 마감 결과 중심) | 오늘 08:00 이후 (한국장 마감, 아시아·중동·유럽, 미 프리마켓) |
| 일정 카드 범위 | 지금 ~ 오늘 21:00 (한국 낮 시간대) | 지금 ~ 내일 08:00 (미국장 밤 시간대) |

아래를 순서대로 수행하세요.

1. **의존성 확인**: `npm ls playwright` 로 playwright가 있는지 확인하고, 없으면 `npm install` 을 실행한다. (setup 스크립트에서 이미 설치됐다면 건너뛴다.)
   - `npm install` 이 403 등으로 실패하는 환경이면, 전역 설치본을 심볼릭 링크로 연결한다:
     `mkdir -p node_modules && ln -sf /opt/node22/lib/node_modules/playwright node_modules/playwright`

2. **오늘 날짜·세션 확인**: 한국시간(KST) 기준 오늘 날짜를 `YYYY-MM-DD` 형식으로 정하고 `DATE` 로 사용한다. 루틴 지시문의 `SESSION`(am|pm)을 확인한다 (지정이 없으면 am).

3. **뉴스 리서치**: WebSearch로 최신 뉴스를 조사한다.

   **3-a. 시장 지표 (markets 10개 타일)** — 세션별로 구성이 다르다:
   - `am`: 미국 3대 지수(마감), VIX, Fear&Greed, 미 10년물 금리, 원/달러, 금, WTI 원유, 비트코인.
   - `pm`: **KOSPI(마감), KOSDAQ(마감), 닛케이 225, S&P 500 선물, 나스닥 선물**, 원/달러(마감), 미 10년물 금리, 금, WTI 원유, 비트코인.

   **3-b. 뉴스 선별** — 경제/금융 6건, AI/테크 6건을 채운다 (뉴스 카드 4장에 3건씩 배치). 출처가 분명하고 해당 세션의 뉴스 범위(위 표) 안에서 가장 최신을 우선한다.
   - `pm` 세션은 **먼저 `content/<DATE>-am.json` 을 읽고**, 아침 브리핑에서 이미 다룬 뉴스는 제외한다. (파일이 없으면 — 예: 체제 전환 첫날 — `content/` 의 가장 최근 파일을 대신 참고하고, 없는 것 때문에 중단하지 않는다.) 아침 브리핑이 놓쳤던 중요한 뉴스가 있으면 포함하되 해당 항목에 `"catchup": true` 를 넣는다 (카드에 "아침 브리핑 보충" 배지가 붙는다). 낮 시간대에 새 뉴스가 부족한 날은 catchup 뉴스로 채워도 된다. AI 뉴스는 한국 관련 소식(국내 기업·정책·투자)도 적극적으로 살핀다.
   - 각 뉴스는 결론부터 1~2문장으로, 한국어와 영어 두 버전을 모두 작성한다.

   **3-c. 일정 리서치 (schedule 4~6건)** — 다음 브리핑 전까지 예정된 일정을 조사한다. 모든 시각은 KST로 표기한다.
   - `am`: 오늘 21:00 전까지 — 국내 지표 발표, 중국·일본 지표, 국내 주요 기업 실적 발표, 유럽 장 초반 주요 이벤트 등.
   - `pm`: 내일 08:00 전까지 — 미국 지표 발표(CPI·PPI·고용 등, KST 시각 병기), 미국 주요 기업 실적(장전/장후 구분), FOMC·연준 인사 발언 등.
   - 시장에 영향이 큰 일정은 `"importance": "high"` (카드에 "주목" 배지), 나머지는 `"mid"`.
   - 해당 시간대에 예정된 일정이 정말 없으면 "특별한 일정 없음"을 한 건으로 넣지 말고, 다음 날 이후의 굵직한 일정(FOMC, 빅테크 실적 등)을 "미리 보기"로 채운다.

4. **콘텐츠 JSON 작성**: `content/<DATE>-<SESSION>.json` 파일을 아래 스키마로 저장한다. (기존 `content/` 의 가장 최근 파일을 예시로 참고하되, 반드시 이번 세션 내용으로 새로 만든다. econ 6건, ai 6건, markets 10개, schedule 4~6건을 채운다.)

   ```
   {
     "date", "session",                          // session: "am" | "pm"
     "dateLabel_ko","dateLabel_en",
     "headline_ko","headline_sub_ko","headline_en","headline_sub_en",
     "markets":[{"label","value","delta","dir(up|down|flat)"} x10],
     "market_note_ko","market_note_en",
     "econ":[{"headline_ko","headline_en","body_ko","body_en","src","time","catchup(선택)"} x6],
     "ai":[  {"headline_ko","headline_en","body_ko","body_en","src","time","catchup(선택)"} x6],
     "schedule_title_ko","schedule_title_en",     // 예: "오늘 낮 주요 일정" / "Today's daytime schedule"
     "market_hours": {
       "title_ko","title_en",                     // am: "한국 증시 운영시간" / pm: "미국 증시 운영시간"
       "lines_ko":[...], "lines_en":[...]
     },
     "schedule":[{"time","title_ko","title_en","detail_ko","detail_en","importance(high|mid)"} x4~6],
     "next_brief_ko","next_brief_en",
     "caption_ko","caption_en","sources":[...]
   }
   ```
   - `market_hours` 고정 문구:
     - `am`: 제목 "한국 증시 운영시간", 내용 "정규장 09:00 ~ 15:30 · 동시호가 08:30~09:00 / 15:20~15:30"
     - `pm`: 제목 "미국 증시 운영시간", 내용 "정규장 22:30 ~ 익일 05:00 (서머타임 기준)" — 11월 초~3월 초(서머타임 해제 기간)에는 "23:30 ~ 익일 06:00" 으로 쓴다. 프리마켓/애프터마켓 시간을 한 줄 더 넣어도 좋다.
   - `next_brief` 고정 문구:
     - `am`: "🌙 다음 브리핑 — 오늘 밤 9시, 미국장 개장 전" / "🌙 Next brief — 9 PM KST, before the US open"
     - `pm`: "☀️ 다음 브리핑 — 내일 아침 8시, 미국장 마감 정리" / "☀️ Next brief — 8 AM KST, US close wrap-up"
   - `time` 은 한국시간(KST) 기준으로 표기한다.
   - caption 에는 요약 + 팔로우/저장 유도 문구 + 해시태그 15개 내외를 포함하고, 끝에 다음 브리핑 예고 한 줄(`next_brief` 내용)을 넣는다. pm 캡션에는 "저녁 브리핑" 임을 밝힌다.
   - **한국어 맞춤법·띄어쓰기 검증**: JSON 저장 전에 모든 한국어 텍스트(특히 markets 의 delta, note, headline, schedule)를 다시 읽으며 맞춤법과 띄어쓰기를 점검한다. 예: "두달래 최고"(X) → "두 달 내 최고"(O). 지표 변동 표현은 자연스러운 한국어로 쓰되, 주가지수·금리 등은 "두 달 내 최고", "52주 신고가", "20일 이동평균선 상회" 처럼 시장에서 통용되는 표현을 우선한다.

5. **카드 이미지 생성**: 다음을 실행한다.
   - `node scripts/render-cards.mjs <DATE> ${LANG} <SESSION>`
   - `cards/<DATE>/<SESSION>/${LANG}/` 에 card1~8.png (8장: 훅, 시장, 경제×2, AI×2, 일정, 아웃트로)가 생겼는지 확인한다.

6. **고정 브랜치 `claude/live` 에 커밋 & 푸시**: 반드시 아래 순서대로, 항상 같은 브랜치 이름을 재사용한다 (새 브랜치를 매번 만들지 않는다). GitHub Pages가 이 브랜치를 소스로 보고 있으므로, 여기에 푸시해야 이미지가 공개된다.
   ```
   git fetch origin claude/live 2>/dev/null
   git checkout claude/live 2>/dev/null || git checkout -b claude/live
   git merge origin/main --no-edit 2>/dev/null || true
   git add -A
   git commit -m "brief: <DATE> <SESSION> (${LANG})"
   git push origin claude/live
   ```
   (main 브랜치는 건드리지 않는다. `claude/`로 시작하는 브랜치는 별도 권한 설정 없이도 기본적으로 푸시가 허용된다.)

7. **토큰 만료 점검**: 환경변수 `IG_TOKEN_EXPIRES_AT`(YYYY-MM-DD)를 읽어, 오늘로부터 10일 이내면 PushNotification으로 "인스타 토큰 갱신 필요 (만료 임박)" 알림을 보낸다.

8. **Instagram 발행**: 아래를 실행한다. 스크립트가 GitHub Pages 반영을 스스로 기다린 뒤 캐러셀을 발행한다.
   - `PAGES_BASE_URL` 환경변수가 설정돼 있어야 한다 (예: https://dreamerstar88-ui.github.io/luckyon-briefing).
   - `node scripts/publish-instagram.mjs <DATE> ${LANG} <SESSION>`
   - 발행이 성공하면 media id 를 로그에 남긴다. 실패하면 에러 메시지를 그대로 남기고, 토큰/권한/URL 중 무엇이 원인인지 판단해 PushNotification으로 알린다.

9. **마무리 보고**: 무엇을 발행했는지(세션, 언어, media id, 카드 수)와 실패가 있었다면 그 내용을 요약한다.

### 이 루틴의 언어·세션 설정
LANG = ko        ← 영어본 루틴에서는 이 값을 en 으로 바꾸세요.
SESSION = am     ← 루틴 지시문에 SESSION 이 명시돼 있으면 그 값을 따르고, 없으면 am 으로 간주합니다.

### 최초 1회 준비사항 (사람이 직접)
이 루틴을 처음 한 번 "지금 실행"으로 돌려 `claude/live` 브랜치가 저장소에 생기게 한 뒤,
GitHub 저장소 → Settings → Pages → Branch 드롭다운에서 `claude/live` 를 선택하고 Save 하세요.
(브랜치가 아직 없으면 드롭다운에 나타나지 않습니다. 최초 1회만 이 순서가 필요합니다.)
