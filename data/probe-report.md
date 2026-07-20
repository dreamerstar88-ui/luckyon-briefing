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
| WTI 원유 | 성공 | $79.2/배럴 / 2026-07-13 | AV `WTI` (interval=daily) | FMP `commodity.commodities-quote CLUSD`는 "requires a higher plan"로 실패 → AV로 대체 성공 (순차 재검증, 아래 5번 참고) |
| 비트코인(USD) | 성공 | 63910.85 (FMP) / 63907.81 (AV) / 2026-07-18 | FMP `crypto.cryptocurrency-quote BTCUSD`, AV `CURRENCY_EXCHANGE_RATE BTC→USD` | 두 소스 모두 성공, 순차 재검증으로 AV도 확인됨 |

## 3. 분석 기능 테스트

- **FMP RSI(14일, SPY)**: 성공 — 2026-07-17 종가 기준 RSI 48.42 (`technicalIndicators.relative-strength-index`). 응답이 전체 일별 시계열(1255건)로 와서 토큰 한도를 초과해 파일로 오프로드됨 — 실제 사용 시 `from_date`/`to_date`로 범위 제한 필요.
- **FMP SMA(20일, SPY)**: 성공 — 2026-07-17 기준 SMA 745.02. 동일하게 전체 시계열 반환, 범위 제한 필요.
- **AV RSI(14일, SPY)**: 성공하지만 미리보기(preview)만 반환 — 총 6703건 중 최신 2건만 확인(2026-07-17: 48.7718, 2026-07-16: 54.7392). 전체 데이터는 32000토큰 초과로 `return_full_data=true` 필요.
- **AV SMA(20일, SPY)**: 순차 재검증 결과 성공 — 2026-07-17 기준 SMA 745.02 (FMP 값과 완전히 일치).
- **FMP 실적 캘린더 (오늘~+3일, 2026-07-18~21)**: 성공 — 2건 (GM 7/21, GOOGL 7/21).
- **FMP 경제지표 캘린더 (오늘~+3일)**: 성공 — 다수 건(90+, 각국 CPI·고용·금리 등) 확인.

## 4. 레이트 리밋 체감 기록

- **Alpha Vantage**: 무료 티어 한도 — "25 requests per day", "1 request per second"(버스트 제한). 1차 점검에서 병렬로 여러 도구를 동시 호출하자 (`GLOBAL_QUOTE` 1건 성공 이후) 대부분 `rate_limit` 에러 발생. **5번(순차 재검증)에서 확인한 결과, 이는 대부분 초당 1건 버스트 제한 때문이었고 한 번에 하나씩 호출하면 정상 동작함** → **AV 도구는 반드시 순차 호출(≥1초 간격)해야 하며, 하루 25건 한도 안에서 브리핑에 필요한 호출을 계획해야 함.**
- **AV INDEX_DATA는 레이트리밋과 무관한 진짜 플랜 제한**: 순차로 단독 호출해도 동일하게 "You are not yet entitled to index data access... subscribe to any premium plan" 반환 — 무료 키로는 근본적으로 사용 불가한 기능(속도 문제 아님, 5번 참고).
- **FMP**: 429는 관측되지 않았으나, 다수 엔드포인트에서 `ACCESS DENIED: ... requires a higher plan` 에러가 반복됨 — `quote`(DIA/QQQ/ES=F/NQ=F), `forex`(USDKRW), `commodity`(CLUSD), `indexes`(^KS11/^KQ11). 같은 도구의 다른 심볼(SPY quote, GCUSD, ^GSPC 등)은 성공했으므로, 심볼/엔드포인트 단위로 플랜 등급이 갈리는 것으로 보임(전체 차단이 아님).
- FMP `technicalIndicators`, AV `RSI`/`SMA`/`WTI`/`TREASURY_YIELD`는 날짜 범위를 지정하지 않으면 대량(수천~수만 행) 데이터를 반환해 세션 토큰 한도를 초과 — 실사용 시 FMP는 `from_date`/`to_date`, AV는 최신값만 필요하면 미리보기(preview)로 충분하고 전체 시계열이 필요할 때만 `return_full_data=true` 사용.

## 5. 순차 재검증 (2026-07-18, WTI 등)

1차 점검에서 병렬 호출로 인해 `rate_limit`으로 실패했던 AV 항목들을 한 건씩 순차 호출로 재확인:

| 항목 | 결과 | 값 | 비고 |
|---|---|---|---|
| AV `WTI` | 성공 | $79.2/배럴 (2026-07-13) | **1차 점검 때 "실패"로 기록했던 WTI가 실제로는 사용 가능함 — 순차 호출이면 문제 없음** |
| AV `SMA` (SPY, 20일) | 성공 | 745.02 (2026-07-17) | FMP 값과 일치 |
| AV `CURRENCY_EXCHANGE_RATE` (BTC→USD) | 성공 | 63907.81 | FMP BTCUSD(63910.85)와 거의 일치 |
| AV `TREASURY_YIELD` (10년물) | 성공 | 4.57% (2026-07-16) | FMP 값(4.55%, 07-17)과 근접, 소스 간 1일 시차 정도 |
| AV `INDEX_DATA` (SPX) | 실패 (재확인) | - | 순차 호출에도 동일하게 "not yet entitled to index data access" — **진짜 플랜 게이트, 레이트리밋 아님** |

→ **결론: WTI는 더 이상 미확보 항목이 아님.** AV `WTI`로 대체 가능, FMP `commodity`(CLUSD)는 여전히 플랜 제한으로 사용 불가.

## PlayMCP 연동 검토 (2026-07-18)

이 세션(예약 실행 세션)에는 PlayMCP 도구가 로드되지 않아(`enabledInChat: false`), 사용자가 **별도의 새 대화**에서 직접 점검. 아래는 그 세션에서 사용자가 도구를 실제 호출해 확인한 결과를 옮긴 것 — 이 리포트를 작성한 세션 자체에서 재검증한 것은 아님.

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| PlayMCP 서버 연결 | 정상 | `KakaotalkChat`, `yakjalal`, `NaverSearch`, `UsStockInfo` 등 4개 그룹 도구 로드 성공 (이 리포트의 "예약 세션엔 미로드" 진단은 해당 세션에 국한된 문제였고, 새 세션에서는 정상) |
| KOSPI 지수 | 성공 | `UsStockInfo.get_stock_info(ticker="^KS11")` → "KOSPI Composite Index" 실데이터 |
| KOSDAQ 지수 | 성공 | `UsStockInfo.get_stock_info(ticker="^KQ11")` → "Kosdaq Composite Index" 실데이터 |
| WTI 유가 | PlayMCP 아님 | AV `WTI`로 이미 확보됨(5번 참고). PlayMCP 쪽 확인 불필요 |
| 국내 선물(코스피200 선물 등) | 미확인/지원 가능성 낮음 | KODEX 200 ETF(`108130.KS`)로 테스트 시 빈 값. `UsStockInfo`는 Yahoo Finance 기반 범용 티커 도구로 추정되며, 야후는 KRX 선물 상품을 일반적으로 지원하지 않아 선물은 어려울 것으로 판단 |

**핵심 발견**: `UsStockInfo`는 이름과 달리 미국 주식 전용이 아니라 야후 파이낸스 스타일 티커(`^KS11`, `^KQ11` 등)를 받는 범용 도구 — **KOSPI·KOSDAQ 지수를 이걸로 확보 가능**. 단, 종목/ETF 코드(`108130.KS`)는 빈 응답이 나와 지원이 일관되지 않고, 선물 코드 체계는 아직 미시도.

## 결론 (최신, PlayMCP 반영)

무료 티어로 아래 14개 세부 항목(브리핑 카드② 타일 관련) 중 **12개 확보 가능** (미국 3대 지수, 닛케이, VIX, 10년물 금리, 원/달러, 금, WTI, 비트코인, **KOSPI, KOSDAQ**).

**여전히 미확보인 항목** (지수 선물 2개만 남음):
- **S&P 500 선물 / 나스닥 선물**: FMP 플랜 제한, AV에는 선물 엔드포인트 자체 없음, PlayMCP `UsStockInfo`도 Yahoo Finance 기반이라 선물 지원 가능성 낮음(미확정). → 정확한 선물 티커 표기법으로 추가 테스트 필요, 그래도 안 되면 타일에서 제외 검토.

**소스별 무료 한도 요약 및 배분 제안**:
| 소스 | 무료 한도 | 확보한 역할 |
|---|---|---|
| FMP | 심볼/엔드포인트별로 플랜 게이트가 갈림 (일간 호출수 한도는 미확인, 429는 안 봄) | 미국 3대 지수, 닛케이, VIX, 10년물 금리, 금(선물), 비트코인, 실적/경제 캘린더, RSI/SMA — **1차 소스** |
| Alpha Vantage | 25 requests/day, 1 request/sec(버스트) — **순차 호출 필수** | 원/달러, 금(현물, FMP와 교차검증), **WTI**, RSI/SMA(FMP 실패 시 백업) — 브리핑 1회 발행 기준 AV 호출 예산 8~10건 이내로 설계 권장 |
| PlayMCP (`UsStockInfo`) | 미확인(호출 한도 테스트 안 됨) | **KOSPI·KOSDAQ 지수 — 3번째 소스로 편입.** 선물은 미지원 추정, 추가 확인 필요 |

**운영상 주의사항**:
- AV 호출은 반드시 순차(≥1초 간격)로, 하루 25건 한도 내에서 설계. 브리핑 1회 발행에 필요한 AV 호출 수를 미리 정해두고, 실패 시 재시도로 소진되지 않도록 순서를 고정할 것.
- FMP `technicalIndicators`, AV `RSI`/`SMA`/`WTI`/`TREASURY_YIELD` 호출 시 필요 이상으로 큰 시계열이 반환되므로, 최신값만 필요하면 preview 응답을 그대로 쓰고 전체 데이터는 요청하지 말 것(토큰 낭비 방지).
- FMP는 같은 도구라도 심볼별로 플랜 제한이 다르므로, 브리핑에 실제 쓸 심볼들을 사전에 개별 검증해야 함.
- AV `INDEX_DATA`는 순차 호출로도 동작하지 않는 진짜 플랜 게이트이므로 재시도로 시간 낭비하지 말 것.
- PlayMCP `UsStockInfo`의 무료 호출 한도·안정성은 아직 미검증 — 실제 브리핑에 편입하기 전 반복 호출 테스트 권장.
