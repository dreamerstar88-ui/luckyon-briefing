// fetch-futures.mjs
// Apify에 배포한(또는 스토어에서 고른) 액터를 동기 실행해
// S&P 500 선물·나스닥 선물 markets 타일 2개를 JSON으로 출력한다.
// apify/futures-scraper/README.md 참고.
//
// 사용법: node scripts/fetch-futures.mjs
//
// 필요한 환경변수:
//   APIFY_TOKEN     - Apify 개인 API 토큰
//   APIFY_ACTOR_ID  - 실행할 액터 ID
//                     (커스텀 배포 시 예: your-username~index-futures-quote-scraper
//                      스토어 액터를 쓸 경우 그 액터의 ID)
//
// 출력: markets 타일 스키마({label,value,delta,dir}) 배열을 stdout에 JSON으로 찍는다.
//   ROUTINE_PROMPT.md 3-a 단계에서 이 출력을 pm 세션 markets 배열에 그대로 이어붙이면 된다.
//   (아직 ROUTINE_PROMPT.md에는 자동 연결되어 있지 않음 — 실제 토큰으로 검증 후 수동으로 반영할 것)

const TOKEN = required('APIFY_TOKEN');
const ACTOR_ID = required('APIFY_ACTOR_ID');

function required(k) {
  const v = process.env[k];
  if (!v) { console.error(`❌ 환경변수 ${k} 가 없습니다.`); process.exit(1); }
  return v;
}

function toTile(item) {
  if (!item || item.error || item.price == null) {
    return { label: item?.label ?? item?.symbol ?? '?', value: '조회 실패', delta: '-', dir: 'flat' };
  }
  const pct = item.changePercent;
  const arrow = item.dir === 'up' ? '▲' : item.dir === 'down' ? '▼' : '-';
  return {
    label: item.label,
    value: Number(item.price).toLocaleString(),
    delta: pct == null ? '-' : `${arrow} ${Math.abs(pct).toFixed(2)}%`,
    dir: item.dir ?? 'flat',
  };
}

async function main() {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/run-sync-get-dataset-items?token=${TOKEN}&timeout=90`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    console.error(`❌ Apify 호출 실패: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    console.error('❌ Apify가 빈 결과를 반환했습니다.');
    process.exit(1);
  }

  const tiles = items.map(toTile);
  console.log(JSON.stringify(tiles, null, 2));

  const failed = items.filter((it) => it.error);
  if (failed.length) {
    console.error(`⚠️  ${failed.length}건 실패: ${failed.map((f) => f.symbol).join(', ')}`);
  }
}

main().catch((err) => {
  console.error('❌ 실행 실패:', err.message);
  process.exit(1);
});
