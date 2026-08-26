// fetch-fear-greed.mjs
// CNN Fear & Greed Index를 원본 데이터 API에서 직접 받는다.
//
// 2026-08-24 am 부터 2026-08-26 pm 까지 6회 연속 WebSearch가 "55 · 8/25 기준"이라는
// 같은 요약을 반복해 사용자가 발견했다(DATA_SOURCES.md 참고). 조사 결과 WebSearch가 아니라
// cnn.com·cnn.io 가 이 환경 아웃바운드 허용목록에 없어 직접 조회 자체가 막혀 있었던 것이
// 근본 원인이었다. 2026-08-26 저녁 사용자가 `cnn.com`·`*.cnn.io`를 허용목록에 추가한 뒤
// 아래 엔드포인트가 실제로 열리는 것을 확인했다(HTTP 200, 그날 실시간 timestamp).
//
// 사용법: NODE_USE_ENV_PROXY=1 node scripts/fetch-fear-greed.mjs
//   **NODE_USE_ENV_PROXY=1 접두어를 반드시 붙인다.** Node 내장 fetch(undici)는 HTTPS_PROXY를
//   기본으로 읽지 않아, 이 접두어 없이 부르면 이 환경의 egress 프록시를 안 타고 그냥 실패한다
//   (스크립트 안에서 process.env 로 뒤늦게 설정해봐도 소용없다 — 실제로 시도해서 확인함,
//   Node 프로세스 시작 시점에 이미 결정되는 값이라 그렇다). /root/.ccr/README.md 참고.
//
//   표준출력에 JSON 한 줄: {"score":55,"rawScore":55.29,"rating":"greed","timestamp":"...",
//                          "previousClose":58.8,"previous1Week":57.2,"previous1Month":41.3,
//                          "previous1Year":55.4}
//
// 종료 코드: 0 성공 / 1 네트워크·파싱 실패(허용목록에서 cnn.com·*.cnn.io 가 빠졌거나
//   NODE_USE_ENV_PROXY=1 을 안 붙였을 가능성이 가장 크다 — DATA_SOURCES.md 의 Fear & Greed 항목을 본다)
//
// 주의: 이 API 는 www.cnn.com/markets/fear-and-greed 페이지가 클라이언트에서 비동기로
// 불러오는 비공식 엔드포인트다. CNN 이 스키마를 바꾸면 이 스크립트도 함께 고쳐야 한다.

const URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

const res = await fetch(URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.cnn.com/markets/fear-and-greed',
  },
});
if (!res.ok) {
  console.error(`HTTP ${res.status} — cnn.com/*.cnn.io 가 허용목록에 있는지 확인 (DATA_SOURCES.md Fear & Greed 항목)`);
  process.exit(1);
}
const data = await res.json();
const fg = data.fear_and_greed;
if (!fg || typeof fg.score !== 'number') {
  console.error('응답 스키마가 예상과 다르다 — fear_and_greed.score 없음. CNN 이 API를 바꿨을 수 있다.');
  process.exit(1);
}

console.log(JSON.stringify({
  score: Math.round(fg.score),
  rawScore: fg.score,
  rating: fg.rating,
  timestamp: fg.timestamp,
  previousClose: fg.previous_close,
  previous1Week: fg.previous_1_week,
  previous1Month: fg.previous_1_month,
  previous1Year: fg.previous_1_year,
}));
