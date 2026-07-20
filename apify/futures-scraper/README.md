# index-futures-quote-scraper

야후 파이낸스에서 S&P 500 선물(`ES=F`)·나스닥 선물(`NQ=F`) 시세를 읽어오는 Apify 액터.
luckyon 브리핑 pm 세션의 markets 10개 타일 중 FMP·Alpha Vantage·PlayMCP로 못 채우던
마지막 2개 항목(지수 선물)을 채우기 위한 용도.

## APIFY_TOKEN 두 가지 경로

- **Claude 세션 환경변수**: `APIFY_TOKEN`을 세션 환경변수로 넣으면 `scripts/fetch-futures.mjs`가
  매 pm 세션마다 직접 액터를 호출한다.
- **GitHub Actions 캐시 (세션 환경변수 저장이 안 될 때)**: `../../.github/workflows/futures-cache.yml`이
  평일 20:20 KST에 저장소 시크릿의 `APIFY_TOKEN`으로 직접 조회해 `data/futures-cache.json`에 커밋한다.
  `fetch-futures.mjs`는 세션에 토큰이 없으면 이 캐시(6시간 이내)를 자동으로 쓴다. 저장소
  Settings → Secrets and variables → Actions 에 `APIFY_TOKEN`을 등록하면 된다.

## 채택: 스토어 액터 사용 (커스텀 배포 불필요)

`scripts/fetch-futures.mjs` 는 아래 스토어 액터를 그대로 호출하도록 맞춰져 있습니다
(사용자 테스트로 동작 확인). 이 디렉터리의 커스텀 액터는 **백업/대안**입니다.

- https://apify.com/automation-lab/yahoo-finance-scraper  ← 현재 기준 액터
- https://apify.com/kaix/yahoo-finance-scraper

**확인된 출력 스키마** (automation-lab, 실측):
```json
{ "symbol": "ES=F", "name": "S&P 500 Futures", "price": 7540.25,
  "change": -41.5, "changePercent": "-0.55%", "volume": 512345,
  "marketCap": null, "exchange": "CME", "currency": "USD" }
```
- `price` 는 숫자, `change` 는 숫자, `changePercent` 는 부호 포함 **문자열**("-0.55%").
- `dir` 필드는 없으므로 `fetch-futures.mjs` 가 `change` 부호로 유도한다.

**연결 절차**:
1. `APIFY_ACTOR_ID` 를 `automation-lab~yahoo-finance-scraper` 로 지정.
2. `APIFY_TOKEN` 설정 (Apify 콘솔 → Settings → API).
3. 액터 입력 키가 `tickers` 가 아니면(액터 Input 탭에서 확인) `APIFY_INPUT_JSON` 환경변수로
   올바른 입력 JSON을 지정한다. 기본값은 `{"tickers":["ES=F","NQ=F"]}`.
4. `node scripts/fetch-futures.mjs` 로 실값 확인.

> ✅ 확인됨: automation-lab 액터가 `ES=F`/`NQ=F` **선물 심볼**을 입력으로 받아 정상적으로
> price·change·changePercent 를 반환함(사용자 테스트 확인). 커스텀 액터는 백업으로만 유지.

파싱 로직만 먼저 검증하려면 토큰 없이:
```bash
APIFY_SELFTEST_FILE=sample.json node scripts/fetch-futures.mjs
```

## 배포 방법 (Apify CLI)

```bash
npm install -g apify-cli
apify login                 # Apify 계정 API 토큰 입력
cd apify/futures-scraper
apify push                  # 이 디렉터리를 액터로 빌드·배포
```

배포 후 Apify 콘솔에서 액터 ID(예: `your-username~index-futures-quote-scraper`)를 확인해
`APIFY_ACTOR_ID` 환경변수에 넣으세요. API 토큰은 Apify 콘솔 → Settings → API & Integrations
에서 발급받아 `APIFY_TOKEN`에 넣습니다.

## 로컬 테스트

```bash
cd apify/futures-scraper
npm install
apify run           # 로컬에서 Dockerfile 없이 바로 실행 (Apify CLI 필요)
```

## 무료 티어 감안 사항

- Apify 플랫폼 자체는 매달 $5 크레딧 무료 제공 ($0.20/CU, 1 CU = RAM 1GB × 1시간).
- 이 액터는 하루 1회(pm 세션당 1번, ko/en은 같은 데이터를 재사용), 티커 2개, 실행시간 1분 내외로
  예상되어 플랫폼 비용은 무료 크레딧 안에서 충분히 커버됩니다.
- 야후가 데이터센터 프록시를 자주 차단하는 편이라, 필요하면
  `Actor.createProxyConfiguration()` 호출에 `{ groups: ['RESIDENTIAL'] }`를 추가로 넘겨
  레지덴셜 프록시를 쓰는 것도 고려하세요(레지덴셜 프록시는 무료 크레딧 소모가 더 빠릅니다 —
  먼저 프록시 없이/데이터센터 프록시로 시도해보고 막히면 그때 전환).
- 셀렉터(`fin-streamer[data-symbol=...]`)는 야후가 페이지 구조를 바꾸면 깨질 수 있습니다.
  주기적으로(예: 월 1회) 실제 실행 결과를 확인하세요.
