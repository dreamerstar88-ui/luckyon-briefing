// fetch-saveticker.mjs
// 세이브티커 «SAVE 마감 리포트» 텍스트판을 받아 본문을 그대로 출력한다.
// 밤사이 미국장 요약 + 발표된 경제지표(예상·이전·실제) + 다음 날 주요 일정이 한 글에 있다.
//
// 사용법: node scripts/fetch-saveticker.mjs [YYYY-MM-DD]
//   인자는 **리포트 제목에 붙는 날짜 = 미국 거래일**이다. 생략하면 «어제(KST)» 를 쓴다.
//   am 세션(예: 8/14 아침)이 다루는 것은 8/13 미국장이므로 기본값이 곧 원하는 값이다.
//
// 종료 코드: 0 성공 / 2 아직 안 올라옴·못 찾음(조용히 건너뛰라는 뜻) / 1 네트워크·파싱 실패
//
// **이건 2차 자료다.** 카드에 싣는 수치의 근거로 쓰지 않는다 — 누락 점검(검증 D)과
// 일정 카드 후보, 연준 인사 성향·투표권 같은 메타데이터에만 쓴다. `DATA_SOURCES.md` §7 참고.
//
// 호스트 주의: `www.` 를 붙이면 프록시가 403 으로 막는다. bare 도메인만 쓴다.

const HOST = 'https://saveticker.com';          // www. 금지 (DATA_SOURCES.md §1·§7)
const UA = 'Mozilla/5.0';

const arg = process.argv[2];
const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
const kstYesterday = new Date(kstNow.getTime() - 24 * 3600 * 1000);
const target = arg ? new Date(`${arg}T00:00:00Z`) : kstYesterday;
if (Number.isNaN(target.getTime())) {
  console.error('날짜 형식은 YYYY-MM-DD 다.');
  process.exit(1);
}

// 제목 형식: "SAVE 마감 리포트｜ 26년 08월 13일 (목) - 텍스트"
const yy = String(target.getUTCFullYear()).slice(2);
const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
const dd = String(target.getUTCDate()).padStart(2, '0');
const stamp = `${yy}년 ${mm}월 ${dd}일`;

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
};

// Next.js flight 페이로드에서 본문을 꺼낸다. SSR HTML 의 <body> 에는 본문이 없다.
const decodeFlight = (html) => {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(m => m[1]);
  if (!chunks.length) return '';
  const joined = chunks.join('').replace(/\r?\n/g, '\\n');
  try { return JSON.parse(`"${joined}"`); } catch { return ''; }
};

const extractText = (flight) =>
  [...flight.matchAll(/\{"type":"text","content":"((?:[^"\\]|\\.)*)"\}/g)]
    .map(m => { try { return JSON.parse(`"${m[1]}"`); } catch { return ''; } })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

try {
  // 1) 목록에서 그날 글 ID 찾기. `?search=` 없이는 최신 20건만 나와 리포트가 안 잡힌다.
  const listRaw = await get(`${HOST}/api/news/list?search=${encodeURIComponent('마감 리포트')}`);
  const list = JSON.parse(listRaw)?.news_list ?? [];

  // 제목에 `- 텍스트` 가 붙은 판만 쓴다. 안 붙은 쌍둥이 글은 본문이 전부 이미지라 읽을 수 없다.
  const hit = list.find(n => (n.title || '').includes(stamp) && (n.title || '').includes('텍스트'));
  if (!hit) {
    console.error(`[saveticker] ${stamp} 텍스트판이 아직 없다 (보통 07:12~08:00 KST 사이 게시). 건너뛴다.`);
    process.exit(2);
  }

  // 2) 상세 페이지에서 본문 받기. 목록 API 의 content 는 83자로 잘려 있다.
  const body = extractText(decodeFlight(await get(`${HOST}/news/${hit.id}`)));
  if (!body) {
    console.error(`[saveticker] 본문 파싱 실패 (id=${hit.id}). 페이지 구조가 바뀌었을 수 있다.`);
    process.exit(1);
  }

  console.error(`[saveticker] ${hit.title} · id=${hit.id} · ${hit.created_at}`);
  console.log(body);
} catch (e) {
  console.error(`[saveticker] 실패: ${e.message}`);
  process.exit(1);
}
