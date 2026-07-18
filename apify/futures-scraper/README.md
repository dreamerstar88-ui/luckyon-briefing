# index-futures-quote-scraper

야후 파이낸스에서 S&P 500 선물(`ES=F`)·나스닥 선물(`NQ=F`) 시세를 읽어오는 Apify 액터.
luckyon 브리핑 pm 세션의 markets 10개 타일 중 FMP·Alpha Vantage·PlayMCP로 못 채우던
마지막 2개 항목(지수 선물)을 채우기 위한 용도.

## 배포 전 먼저 시도해볼 것

직접 만들지 않고 Apify 스토어의 기존 액터로 먼저 테스트해보는 걸 권장합니다.
`ES=F`/`NQ=F` 선물까지 지원한다고 알려진 후보:

- https://apify.com/kaix/yahoo-finance-scraper
- https://apify.com/automation-lab/yahoo-finance-scraper

Apify 콘솔에서 무료로 한 번 실행해보고 결과에 선물 가격·등락률이 정상적으로 나오면,
아래 커스텀 액터는 배포하지 않고 바로 `scripts/fetch-futures.mjs`의 `APIFY_ACTOR_ID`를
그 액터 ID로 지정해 쓰면 됩니다. 안 나오거나 유료 과금이 부담되면 이 커스텀 액터를 배포하세요.

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
