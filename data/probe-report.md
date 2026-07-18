# 커넥터 커버리지 점검 리포트

- 실행일시: 2026-07-18 (스케줄 루틴, PROBE_CONNECTORS.md 절차 수행)
- 대상: FMP MCP, Alpha Vantage MCP
- 범위: 시세 커버리지·분석 기능·레이트 리밋 확인. 카드 생성/Instagram 발행/claude live 푸시는 수행하지 않음.

## 1. 도구 확인

- **FMP MCP**: 연결됨. 관련 도구 확인 — `quote`, `indexes`, `commodity`, `crypto`, `forex`, `technicalIndicators`, `calendar`, `economics` 등.
- **Alpha Vantage MCP**: 연결됨. 관련 도구 확인 — `GLOBAL_QUOTE`, `INDEX_DATA`, `INDEX_CATALOG`, `RSI`, `SMA`, `TREASURY_YIELD`, `CURRENCY_EXCHANGE_RATE`, `GOLD_SILVER_SPOT`, `WTI` 등.

두 커넥터 모두 세션에 로드되어 있어 5단계(도구 없음 시 스킵)는 해당 없음.

## 2. 시세 커버리지

| 항목 | 결과 | 값 / 기준시각 | 사용 도구·심볼 | 비고 |
|---|---|---|---|---|
| S&P 500 | 성공 | 7457.78 (-1.01%) / 2026-07-17 | FMP `indexes.index-quote` `^GSPC` | |
| Dow Jones | 성공 | 52146.42 (-0.77%) / 2026-07-17 | FMP `indexes.index-quote` `^DJI` | |
| Nasdaq Composite | 성공 | 25520.24 (-1.40%) / 2026-07-17 | FMP `indexes.index-quote` `^IXIC` | |
| S&P 500 선물 | 실패 | - | FMP `quote` `ES=F` | "requires a higher plan" (플랜 제한) |
| 나스닥 선물 | 실패 | - | FMP `quote` `NQ=F` | "requires a higher plan" (플랜 제한) — 선물 심볼 자체 미지원 가능성도 있음 |
| KOSPI | 실패 | - | FMP `indexes.index-quote` `^KS11` | "requires a higher plan" (플랜 제한) |
| KOSDAQ | 실패 | - | FMP `indexes.index-quote` `^KQ11` | "requires a higher plan" (플랜 제한) |
| 닛케이 225 | 성공 | 64141.12 (-4.03%) / 2026-07-17 | FMP `indexes.index-quote` `^N225` | |
| VIX | 성공 | 18.77 (+12.19%) / 2026-07-17 | FMP `indexes.index-quote` `^VIX` | |
| 미 10년물 국채 수익률 | 성공 | 4.55% / 2026-07-17 | FMP `economics.treasury-rates` | 최근 5영업일 시계열 포함 |
| 원/달러 (USD/KRW) | 성공 | 1487.47 / 2026-07-18 02:14 UTC | AV `CURRENCY_EXCHANGE_RATE` (from=USD,to=KRW) | FMP `forex.forex-quote USDKRW`는 "requires a higher plan"로 실패, AV로 대체 성공 |
| 금 현물/선물 | 성공 | 4018.80 (선물, FMP) / 4017.73 (현물, AV) / 2026-07-17~18 | FMP `commodity.commodities-quote GCUSD`, AV `GOLD_SILVER_SPOT GOLD` | 두 소스 모두 성공, 상호 검증 가능 |
| WTI 원유 | 실패 | - | FMP `commodity.commodities-quote CLUSD` | "requires a higher plan". AV `WTI`는 레이트리밋으로 검증 못함(아래 4번 참고) |
| 비트코인(USD) | 성공 | 63910.85 (+0.04%) / 2026-07-18 | FMP `crypto.cryptocurrency-quote BTCUSD` | AV `CURRENCY_EXCHANGE_RATE BTC→USD`는 레이트리밋으로 실패 |

## 3. 분석 기능 테스트

- **FMP RSI(14일, SPY)**: 성공 — 2026-07-17 종가 기준 RSI 48.42 (`technicalIndicators.relative-strength-index`). 응답이 전체 일별 시계열(1255건)로 와서 토큰 한도를 초과해 파일로 오프로드됨 — 실제 사용 시 `from_date`/`to_date`로 범위 제한 필요.
- **FMP SMA(20일, SPY)**: 성공 — 2026-07-17 기준 SMA 745.02. 동일하게 전체 시계열 반환, 범위 제한 필요.
- **AV RSI(14일, SPY)**: 성공하지만 미리보기(preview)만 반환 — 총 6703건 중 최신 2건만 확인(2026-07-17: 48.7718, 2026-07-16: 54.7392). 전체 데이터는 32000토큰 초과로 `return_full_data=true` 필요.
- **AV SMA(20일, SPY)**: 레이트리밋으로 실패(아래 참고).
- **FMP 실적 캘린더 (오늘~+3일, 2026-07-18~21)**: 성공 — 2건 (GM 7/21, GOOGL 7/21).
- **FMP 경제지표 캘린더 (오늘~+3일)**: 성공 — 다수 건(90+, 각국 CPI·고용·금리 등) 확인.

## 4. 레이트 리밋 체감 기록

- **Alpha Vantage**: 무료 티어 한도 — "25 requests per day", "1 request per second"(버스트 제한). 이번 점검에서 병렬로 여러 도구를 동시 호출하자 (`GLOBAL_QUOTE` 1건 성공 이후) 대부분 `rate_limit` 에러 발생: `INDEX_DATA`(SPX/VIX), `TREASURY_YIELD`, `CURRENCY_EXCHANGE_RATE`(BTC/USD), `WTI`, `SMA`, `INDEX_CATALOG`. → **AV 도구는 반드시 순차 호출(≥1초 간격)해야 하며, 하루 25건 한도 안에서 브리핑에 필요한 호출을 계획해야 함.**
- **AV INDEX_DATA는 레이트리밋과 별개로 플랜 제한**: "You are not yet entitled to index data access... subscribe to any premium plan" — 무료 키로는 아예 사용 불가한 기능으로 보임(속도 문제가 아님).
- **FMP**: 429는 관측되지 않았으나, 다수 엔드포인트에서 `ACCESS DENIED: ... requires a higher plan` 에러가 반복됨 — `quote`(DIA/QQQ/ES=F/NQ=F), `forex`(USDKRW), `commodity`(CLUSD), `indexes`(^KS11/^KQ11). 같은 도구의 다른 심볼(SPY quote, GCUSD, ^GSPC 등)은 성공했으므로, 심볼/엔드포인트 단위로 플랜 등급이 갈리는 것으로 보임(전체 차단이 아님).
- FMP `technicalIndicators`는 날짜 범위를 지정하지 않으면 대량(1200+행) 데이터를 반환해 세션 토큰 한도를 초과 — 실사용 시 `from_date`/`to_date` 필수.

## 결론

무료 티어로 위 14개 세부 항목(브리핑 카드② 타일 관련) 중 **9개 확보 가능** (미국 3대 지수, 닛케이, VIX, 10년물 금리, 원/달러, 금, 비트코인).

**대체/보완 필요 항목**:
- **지수 선물(S&P·나스닥)**: FMP 플랜 제한으로 불가. 대체 소스 필요(또는 타일에서 제외).
- **KOSPI·KOSDAQ**: FMP 플랜 제한으로 불가, AV도 인덱스 데이터는 프리미엄 전용이라 대체 어려움. 별도 무료 소스(예: 네이버 금융 스크래핑 등) 검토 필요.
- **WTI 원유**: FMP 플랜 제한, AV는 레이트리밋으로 미검증 — 순차 호출로 재시도하면 AV `WTI`가 대체 가능할 것으로 예상됨(다음 점검에서 우선 확인).

**운영상 주의사항**:
- AV 호출은 반드시 순차(≥1초 간격)로, 하루 25건 한도 내에서 설계.
- FMP `technicalIndicators` 호출 시 `from_date`/`to_date`로 범위를 좁힐 것(미지정 시 대량 응답으로 토큰 초과).
- FMP는 같은 도구라도 심볼별로 플랜 제한이 다르므로, 브리핑에 실제 쓸 심볼들을 사전에 개별 검증해야 함.
