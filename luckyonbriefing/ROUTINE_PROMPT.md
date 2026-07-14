# 루틴에 붙여넣을 프롬프트 (그대로 복사)

> claude.ai/code/routines → New routine → Instructions 칸에 아래 전체를 붙여넣으세요.
> 한국어본과 영어본을 **별도 루틴 2개**로 만들 경우, 맨 아래 `LANG` 값만 각각 `ko` / `en` 으로 바꾸세요.

---

당신은 "luckyon 브리핑"의 자동 발행 담당입니다. 저장소 `luckyon-briefing`이 클론된 상태이며, 목표는 오늘자 경제·AI 뉴스 카드뉴스를 생성해 Instagram에 캐러셀로 발행하는 것입니다. 아래를 순서대로 수행하세요.

1. **의존성 확인**: `npm ls playwright` 로 playwright가 있는지 확인하고, 없으면 `npm install` 을 실행한다. (setup 스크립트에서 이미 설치됐다면 건너뛴다.)

2. **오늘 날짜 확인**: 한국시간(KST) 기준 오늘 날짜를 `YYYY-MM-DD` 형식으로 정하고 `DATE` 로 사용한다.

3. **뉴스 리서치**: WebSearch로 오늘 기준 최신 뉴스를 조사한다.
   - 먼저 시장 지표를 확인: 미국 3대 지수, VIX, Fear&Greed, 미 10년물 금리, 원/달러, 금, WTI 원유, 비트코인.
   - 경제/금융 뉴스 5건, AI/테크 뉴스 5건을 선별한다. 출처가 분명하고 최근 24시간 이내(또는 가장 최신)를 우선한다.
   - 각 뉴스는 결론부터 1~2문장으로, 한국어와 영어 두 버전을 모두 작성한다.

4. **콘텐츠 JSON 작성**: `content/<DATE>.json` 파일을 아래 스키마로 저장한다. (기존 `content/2026-07-14.json` 을 예시로 참고하되, 반드시 오늘 내용으로 새로 만든다. econ 5건, ai 5건, markets 10개 항목을 채운다.)

   ```
   {
     "date","dateLabel_ko","dateLabel_en",
     "headline_ko","headline_sub_ko","headline_en","headline_sub_en",
     "markets":[{"label","value","delta","dir(up|down|flat)"} x10],
     "market_note_ko","market_note_en",
     "econ":[{"headline_ko","headline_en","body_ko","body_en","src","time"} x5],
     "ai":[  {"headline_ko","headline_en","body_ko","body_en","src","time"} x5],
     "caption_ko","caption_en","sources":[...]
   }
   ```
   - `time` 은 한국시간(KST) 기준으로 표기한다.
   - caption 에는 요약 + 팔로우/저장 유도 문구 + 해시태그 15개 내외를 포함한다.

5. **카드 이미지 생성**: 다음을 실행한다.
   - `node scripts/render-cards.mjs <DATE> ko`
   - `node scripts/render-cards.mjs <DATE> en`
   - `cards/<DATE>/ko/` 와 `cards/<DATE>/en/` 에 각각 card1~7.png 가 생겼는지 확인한다.

6. **저장소에 커밋 & 푸시**: `git add -A && git commit -m "brief: <DATE>" && git push`. (이미지가 GitHub Pages로 공개되어야 인스타가 가져갈 수 있다.)

7. **토큰 만료 점검**: 환경변수 `IG_TOKEN_EXPIRES_AT`(YYYY-MM-DD)를 읽어, 오늘로부터 10일 이내면 PushNotification으로 "인스타 토큰 갱신 필요 (만료 임박)" 알림을 보낸다.

8. **Instagram 발행**: 아래를 실행한다. 스크립트가 GitHub Pages 반영을 스스로 기다린 뒤 캐러셀을 발행한다.
   - `PAGES_BASE_URL` 환경변수가 설정돼 있어야 한다 (예: https://dreamerstar88-ui.github.io/luckyon-briefing).
   - `node scripts/publish-instagram.mjs <DATE> ${LANG}`
   - 발행이 성공하면 media id 를 로그에 남긴다. 실패하면 에러 메시지를 그대로 남기고, 토큰/권한/URL 중 무엇이 원인인지 판단해 PushNotification으로 알린다.

9. **마무리 보고**: 무엇을 발행했는지(언어, media id, 카드 수)와 실패가 있었다면 그 내용을 요약한다.

### 이 루틴의 언어 설정
LANG = ko     ← 영어본 루틴에서는 이 값을 en 으로 바꾸세요.
