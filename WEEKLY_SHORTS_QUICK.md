# 주간 쇼츠 — 한 장짜리 절차 (2026-09-26부터 이것만 보고 만든다)

대표 지시(2026-09-26): «쓸데없는 거 다 빼고 간결하게», «검증에 필요한 건 다 넣고 시간은 1분 이내».
자세한 규칙과 과거 사례는 `GUIDE_WEEKLY_SHORTS.md` 에 있다. 여기에는 순서와 명령만 둔다.

## 사람이 정하는 것 — 이것 말고는 묻지 않는다

1. **사건** 6개 안팎 — 지침서 4장 규칙 그대로(★★★ 우선, 하루 최소 1개, 연준 연설은 올해 FOMC 투표권자만)
2. **질문과 보기** — 질문 은행(`scripts/weekly-shorts/questions.mjs`)에서
3. **화면·자막 문구** — 매니페스트 `copy`

한 번 정한 것은 다시 묻지 않는다. **대표가 쓴 말은 그 말의 표준 정의대로** 쓴다(예: «프리장» = 미 동부 04:00~09:30).

## 순서

**창**: 월요일 프리장 시작(04:00 ET · 한국 월 오후 5시) ~ 금요일 16:00 ET. 심볼은 그 주 실제 월물(예: `NQZ26.CME`).

**1. 자료와 사건 후보**

```bash
node scripts/weekly-shorts/render/fetch-week.mjs --symbol=NQZ26.CME --from=2026-09-28 --to=2026-10-02
```

```bash
curl -sSL -A "Mozilla/5.0" -H "Cookie: calendar-range=-2" https://tradingeconomics.com/united-states/calendar -o content/weekly-shorts/2026-09-28.calendar.html
```

```bash
node scripts/weekly-shorts/render/parse-calendar.mjs --html=content/weekly-shorts/2026-09-28.calendar.html --from=2026-09-28 --to=2026-10-02 --minstars=2
```

**2. 매니페스트와 발행문구** — 앞 회차 것을 복사해 고친다.
`content/weekly-shorts/<월요일>.json` · `docs/samples/weekly-shorts/ep<NN>/발행문구.md`

**3. 만들기 (약 70초)** — 렌더 → 영상·음악·표지 → 자막 → 기계 검사 → 장면표본 한 장 → 올릴 파일 모으기

```bash
node scripts/weekly-shorts/make-episode.mjs --stamp=2026-09-28 --ep=5 --fetch
```

- 렌더가 글꼴·겹침(원·라벨 상자·세로선·번호 원·주가 선·시가 이름표)·줄 폭을 재고, 어긋나면 멈춘다.
- 기계 검사 134건(약 10초): 원본 재수집, **두 번째 출처(CNBC)**, 과거 분포(1시간봉 재수집), 사건·캘린더, 자막,
  **영상 파일**(길이·소리 크기·검은 프레임·첫 프레임·표지), **발행문구**(숫자·정답 노출·금지 표현·면책·설명란).
- 사람은 `out/ep<N>/장면표본.png` **한 장만** 본다.

**4. 올리기**

```bash
node scripts/weekly-shorts/publish-episode.mjs --stamp=2026-09-28 --ep=5 --confirm
```

공개 주소용 브랜치(파일 5개) → 유튜브(영상·자막) → 인스타 → 고정 댓글. 고정은 스튜디오에서 한 번 누른다.
`--confirm` 없이 돌리면 무엇을 올릴지 보여 주기만 한다.

## 하지 않는 것

- 검증 에이전트 — 4회차에 두 번 56분 · 94만 토큰. 그 일은 전부 기계 검사로 옮겼다
- 그림 여러 장 열어 보기 — 장면표본 한 장
- 정한 것 다시 묻기, 대표 말을 내 해석으로 바꾸기

## 막히면

| 막힘 | 할 일 |
|---|---|
| 유튜브 인증 만료(7일마다) | `backtest-reels` 에서 `node --env-file="C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env" scripts/authorize-youtube.mjs` → 대표님이 브라우저에서 허용 |
| 유튜브 하루 한도(quotaExceeded) | 한국시간 오후 4시 뒤 `--only=captions,comment --confirm` |
| 인스타가 공개 주소를 못 받음 | `publish-episode` 가 15분까지 기다린다. 그래도 안 되면 GitHub Pages 배포를 본다 |
| 인스타 토큰 | `~/.secrets/luckyon-ig.env` (keys.env 가 아니다) |
| 야후 자료 빈칸 | 일요일 첫 10분·매일 자정 첫 5분이 없다. 검사 [1-2] 가 CNBC 로 대조해 정답이 바뀌는지 본다 |
