// fetch-futures.mjs
// Apify 스토어 액터(automation-lab/yahoo-finance-scraper 등)를 동기 실행해
// S&P 500 선물·나스닥 선물 markets 타일 2개를 JSON으로 출력한다.
// apify/futures-scraper/README.md 참고.
//
// 사용법:
//   node scripts/fetch-futures.mjs                 # 실제 액터 호출 (토큰 필요)
//   APIFY_SELFTEST_FILE=sample.json node scripts/fetch-futures.mjs   # 액터 없이 파싱만 검증
//
// 필요한 환경변수(실제 호출 시):
//   APIFY_TOKEN     - Apify 개인 API 토큰
//   APIFY_ACTOR_ID  - 실행할 액터 ID (예: automation-lab~yahoo-finance-scraper)
//   APIFY_INPUT_JSON- (선택) 액터 입력 JSON. 기본값은 {"tickers":["ES=F","NQ=F"]}.
//                     액터가 다른 입력 키를 쓰면(예: symbols) 이 값을 맞게 지정한다.
//
// 액터 출력 스키마(automation-lab/yahoo-finance-scraper, 실측):
//   { symbol, name, price:Number, change:Number, changePercent:"+1.23%"|"-4.68%",
//     volume, marketCap, exchange, currency }
//
// 출력: markets 타일 스키마({label,value,delta,dir,symbol}) 배열을 stdout에 JSON으로 찍는다.
//   ROUTINE_PROMPT.md 3-a(pm 세션)에서 이 출력을 나스닥·S&P 선물 타일에 넣고
//   한 줄 해석(note_ko/note_en)만 그 시점 상황에 맞게 덧붙이면 된다.
//
// 캐시 폴백: Claude 세션 환경변수에 APIFY_TOKEN 을 못 넣는 경우(플랫폼 저장 한도 등)를 위해,
// .github/workflows/futures-cache.yml 이 GitHub 저장소 시크릿의 APIFY_TOKEN 으로 이 스크립트를
// 직접 실행하고 결과를 data/futures-cache.json 에 커밋해 둔다. 세션에 APIFY_TOKEN 이 없으면
// 이 캐시 파일이 충분히 최신(기본 6시간 이내)일 때 그 값을 그대로 쓴다.

import fs from 'node:fs';
import path from 'node:path';

const CACHE_PATH = path.join(process.cwd(), 'data', 'futures-cache.json');
const CACHE_MAX_AGE_MS = (Number(process.env.FUTURES_CACHE_MAX_AGE_HOURS) || 6) * 60 * 60 * 1000;

// GitHub Actions(.github/workflows/futures-cache.yml)가 채워둔 캐시가 충분히 최신이면 그 타일을 그대로 쓴다.
// 캐시가 없거나, 형식이 안 맞거나, 오래됐으면 null 을 반환해 기존 대체(직전 종가) 경로로 넘어간다.
function readFreshCache() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(cache?.tiles) || !cache.fetchedAt) return null;
  const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
  if (!(ageMs >= 0) || ageMs > CACHE_MAX_AGE_MS) return null;
  return cache;
}

// 조회할 선물 심볼 → 카드 라벨 (라벨은 한/영 공용 중립 표기)
const SYMBOL_LABELS = {
  'NQ=F': { label: 'NASDAQ Fut' },
  'ES=F': { label: 'S&P 500 Fut' },
};

function toTile(item) {
  const map = SYMBOL_LABELS[item.symbol] || { label: item.symbol };
  if (item.error || item.price == null) {
    return { label: map.label, value: '조회 실패', delta: '-', dir: 'flat', symbol: item.symbol };
  }
  // dir 은 change(숫자) 부호로 유도. change 가 없으면 changePercent 문자열에서 파싱.
  const changeNum = typeof item.change === 'number'
    ? item.change
    : parseFloat(String(item.changePercent || '').replace('%', '')) || 0;
  const dir = changeNum > 0 ? 'up' : changeNum < 0 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '·';
  // changePercent 는 "+1.23%" / "-4.68%" 형태의 문자열 → 부호 떼고 절댓값만 사용
  const pct = String(item.changePercent ?? '').replace(/^[+\-]/, '').trim();
  return {
    label: map.label,
    value: Number(item.price).toLocaleString('en-US'),
    delta: pct ? `${arrow} ${pct}` : arrow,
    dir,
    symbol: item.symbol,
  };
}

function emit(items) {
  if (!Array.isArray(items) || items.length === 0) {
    console.error('❌ 빈 결과입니다.');
    process.exit(1);
  }
  // 요청한 심볼 순서(NQ=F, ES=F)대로 정렬해 출력
  const order = Object.keys(SYMBOL_LABELS);
  const sorted = [...items].sort(
    (a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol),
  );
  console.log(JSON.stringify(sorted.map(toTile), null, 2));
  const failed = items.filter((it) => it.error || it.price == null);
  if (failed.length) {
    console.error(`⚠️  ${failed.length}건 실패/누락: ${failed.map((f) => f.symbol).join(', ')}`);
  }
}

async function main() {
  // 자체 검증 모드: 액터 없이 저장된 샘플 JSON 으로 파싱만 확인
  if (process.env.APIFY_SELFTEST_FILE) {
    emit(JSON.parse(fs.readFileSync(process.env.APIFY_SELFTEST_FILE, 'utf8')));
    return;
  }

  // ACTOR_ID 는 비밀이 아니므로 기본값을 둔다. TOKEN 만 없으면 캐시 → 대체(fallback) 순으로 넘어간다.
  const ACTOR_ID = process.env.APIFY_ACTOR_ID || 'automation-lab~yahoo-finance-scraper';
  const TOKEN = process.env.APIFY_TOKEN;
  if (!TOKEN) {
    const cache = readFreshCache();
    if (cache) {
      console.error(`ℹ️  APIFY_TOKEN 미설정 → GitHub Actions 캐시(${cache.fetchedAt}) 사용`);
      console.log(JSON.stringify(cache.tiles, null, 2));
      return;
    }
    console.error('⏭  APIFY_TOKEN 미설정 및 캐시 없음/오래됨 → 선물 조회 건너뜀. pm 세션은 S&P·나스닥을 직전 미국장 종가(전일 종가·개장 전)로 대체하고 발행은 계속한다.');
    process.exit(2);
  }
  const input = process.env.APIFY_INPUT_JSON
    || JSON.stringify({ tickers: Object.keys(SYMBOL_LABELS) });

  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/run-sync-get-dataset-items?token=${TOKEN}&timeout=90`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: input,
  });
  if (!res.ok) {
    console.error(`❌ Apify 호출 실패: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  emit(await res.json());
}

main().catch((err) => {
  console.error('❌ 실행 실패:', err.message);
  process.exit(1);
});
