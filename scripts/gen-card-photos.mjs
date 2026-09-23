// gen-card-photos.mjs
// 카드 배경 사진을 **그날 내용에 맞게 만들어** 둔다. 렌더러(render-cards-day.mjs)가
// data/card-photos/<date>-<session>/card<n>.jpg 를 찾아 쓰고, 없으면 번들 사진으로 내려간다.
//
// 사용법:
//   node scripts/gen-card-photos.mjs <YYYY-MM-DD> <am|pm>
//
// 키가 세션 환경에 없을 때 (클라우드 기본값)
//   저장소 시크릿 GEMINI_API_KEY 를 쓰는 워크플로(card-photos.yml)를 대신 돌린다.
//   루틴 클라우드 세션에는 gh CLI 가 없으므로 GitHub MCP 도구
//   (mcp__github__actions_run_trigger → mcp__github__actions_list 로 대기 →
//   git checkout origin/main -- data/card-photos)로 부른다.
//   자세한 절차는 ROUTINE_PROMPT.md 의 배경 사진 항목이 정본이다.
//
// 무엇을 만드나
//   content/<date>-<session>.json 의 `card_photos` 를 읽는다. 카드 번호 → 장면 설명이다.
//   ```
//   "card_photos": {
//     "1": "뉴욕증권거래소 객장, 장 마감 직후, 트레이더들의 실루엣",
//     "3": "전광판에 지수가 흐르는 어두운 객장"
//   }
//   ```
//   적지 않은 번호는 번들 사진을 그대로 쓴다. 전부 적을 필요는 없다.
//
// 왜 사진을 새로 만드나
//   같은 스톡 사진이 매일 돌면 계정이 금세 지루해진다. 그날 기사에 맞는 장면이면
//   표지만 봐도 무슨 이야기인지 짐작이 간다. 다만 **사진은 배경으로 크게 흐려지고
//   어두워지므로** 세부 묘사보다 구도·명암·색조가 중요하다 — 프롬프트도 그렇게 쓴다.
//
// 3단계 폴백 (2026-09-23 도입)
//   ① Gemini 로 그날 내용에 맞춰 새로 생성 (가장 맞춤) — GEMINI_API_KEY
//   ② ①이 실패하면(크레딧 소진 HTTP 402 등) Pexels 무료 스톡사진에서 프롬프트
//      키워드로 검색해 받는다 (맞춤도는 낮지만 카드 번호 고정인 ③보다 낫다) — PEXELS_API_KEY
//      Pexels License 는 상업적 재사용에 출처 표기를 요구하지 않는다
//      (https://www.pexels.com/license/). 일반 웹 이미지 검색은 라이선스가
//      불명확해 쓰지 않는다.
//   ③ ①·②가 모두 실패하거나 키가 없으면 렌더러(render-cards-day.mjs)가
//      카드 번호별 고정 번들 사진(assets/photos/*)으로 내려간다 — 이 스크립트가
//      아니라 렌더러 쪽 로직이다.
//   어느 단계가 빠져도(키 미설정 등) 조용히 다음 단계로 넘어가고, 다 실패해도
//   exit 0 으로 끝난다. 발행이 사진 때문에 막히는 것이 사진이 평범한 것보다 나쁘다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2];
const session = process.argv[3];
if (!date || !['am', 'pm'].includes(session || '')) {
  console.error('Usage: node scripts/gen-card-photos.mjs <YYYY-MM-DD> <am|pm>');
  process.exit(1);
}

// 키는 환경변수(클라우드) 우선, 없으면 로컬 keys.env.
// ROUTINE_COMMON.md §1 준비 의 'API 키' 항목과 같은 규칙이다.
function key(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const f = 'C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env';
    const line = fs.readFileSync(f, 'utf8').split('\n').find(l => l.startsWith(name + '='));
    return line ? line.slice(name.length + 1).trim() : '';
  } catch { return ''; }
}

const MODEL = 'gemini-3-pro-image';
const ENDPOINT = k => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`;

// 카드마다 다른 장면이어도 **한 계정의 사진처럼** 보여야 한다. 톤을 고정한다.
const STYLE = [
  'Photorealistic editorial photograph, cinematic.',
  'Deep shadows, single dominant light source, muted desaturated palette.',
  'Wide composition with generous empty space; the subject sits off-centre.',
  'Shot on full-frame, 35mm, shallow depth of field, natural film grain.',
  'No text, no logos, no watermarks, no charts, no user interface.',
].join(' ');

async function generate(prompt, outFile) {
  const k = key('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY 없음');
  const res = await fetch(ENDPOINT(k), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\n${STYLE}` }] }],
      generationConfig: { imageConfig: { aspectRatio: '4:5', imageSize: '2K' } },
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const blob = parts.map(p => p.inlineData || p.inline_data).find(Boolean);
  if (!blob) throw new Error('응답에 이미지가 없음 ' + JSON.stringify(j).slice(0, 200));
  await shrink(blob.data, outFile);
  return fs.statSync(outFile).size;
}

// --- 2순위: Pexels 무료 스톡사진 (Gemini 크레딧 소진 등으로 생성이 막혔을 때) ---
// Gemini 가 그 회차 내용에 맞춰 새로 "만드는" 것과 달리, 이미 찍힌 사진 중
// 내용과 가장 가까운 것을 "찾는" 방식이다. 맞춤도는 떨어지지만 번들 사진(카드
// 번호 고정, 내용 무관)보다는 낫고, 비용이 없다(무료 등급 월 2만 요청).
// Pexels License 는 상업적 사용·재가공을 허용하고 출처 표기도 요구하지 않는다
// (https://www.pexels.com/license/) — 인스타그램 발행에 문제가 없다. 반대로
// 일반 웹 이미지 검색(네이버 등) 결과는 라이선스가 불명확해 상업 계정에는
// 쓰지 않는다.
const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'and', 'or', 'is',
  'are', 'to', 'from', 'into', 'near', 'beside', 'amid', 'shot', 'wide', 'close-up', 'closeup']);

// 영문 장면 설명에서 핵심 명사 위주로 4~6단어를 뽑아 검색어로 쓴다. 프롬프트
// 전체를 그대로 넘기면(구도·조명 지시까지 섞여) 검색 적중률이 떨어진다.
function keywordsFrom(prompt) {
  const words = prompt
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  return words.slice(0, 6).join(' ');
}

async function fetchStock(prompt, outFile) {
  const k = key('PEXELS_API_KEY');
  if (!k) throw new Error('PEXELS_API_KEY 없음');
  const q = keywordsFrom(prompt);
  const res = await fetch(`${PEXELS_ENDPOINT}?query=${encodeURIComponent(q)}&per_page=1&orientation=portrait`, {
    headers: { Authorization: k },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  const photo = j.photos?.[0];
  if (!photo) throw new Error(`Pexels 검색 결과 없음 (검색어: "${q}")`);
  // 4:5 비율(카드와 같은 종횡비)로 잘라 받는다. 이미 압축된 JPEG라 shrink() 없이 그대로 저장한다.
  const src = `${photo.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=1600&h=2000`;
  const imgRes = await fetch(src, { signal: AbortSignal.timeout(30000) });
  if (!imgRes.ok) throw new Error(`Pexels 이미지 다운로드 실패 HTTP ${imgRes.status}`);
  fs.writeFileSync(outFile, Buffer.from(await imgRes.arrayBuffer()));
  return { size: fs.statSync(outFile).size, query: q, credit: photo.photographer };
}

// 생성본은 2K 라 한 장에 3MB 를 넘긴다. 회차마다 10장이면 저장소가 하루에 60MB 씩
// 불어난다. 카드는 1080 논리폭을 2배(2160)로 찍으므로 1600px 이면 눈에 띄는 차이가
// 없다 — 배경으로 쓰는 장은 어차피 크게 흐려진다.
//
// sharp 를 새로 넣지 않고 이미 있는 playwright 로 줄인다. 캔버스에 그려 다시 뽑는다.
const SAVE_W = 1600, SAVE_Q = 0.8;
let _browser = null;
async function shrink(b64, outFile) {
  _browser ||= await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pg = await _browser.newPage();
  const out = await pg.evaluate(async ({ b64, w, q }) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + b64; });
    const scale = Math.min(1, w / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, { b64, w: SAVE_W, q: SAVE_Q });
  await pg.close();
  fs.writeFileSync(outFile, Buffer.from(out, 'base64'));
}

// 장면 설명은 두 곳에서 온다.
//   1) 환경변수 CARD_PHOTOS — GitHub Actions 로 돌 때. 러너에는 세션이 방금 쓴
//      콘텐츠 파일이 없으므로 워크플로 입력으로 받아 넘긴다.
//   2) content/<date>-<session>.json 의 card_photos — 로컬에서 돌 때.
let wanted = {};
if (process.env.CARD_PHOTOS) {
  try { wanted = JSON.parse(process.env.CARD_PHOTOS); }
  catch (e) { console.error('❌ CARD_PHOTOS 가 JSON 이 아닙니다:', e.message); process.exit(1); }
} else {
  const contentFile = path.join(root, 'content', `${date}-${session}.json`);
  if (!fs.existsSync(contentFile)) { console.error('❌ 콘텐츠 파일이 없습니다:', contentFile); process.exit(1); }
  wanted = JSON.parse(fs.readFileSync(contentFile, 'utf8')).card_photos || {};
}
const nums = Object.keys(wanted).filter(n => /^([1-9]|10)$/.test(n));

if (!nums.length) {
  console.log('⏭  card_photos 가 비어 있습니다 — 번들 사진으로 진행합니다.');
  process.exit(0);
}

const outDir = path.join(root, 'data', 'card-photos', `${date}-${session}`);
fs.mkdirSync(outDir, { recursive: true });

let ok = 0, stock = 0, fail = 0;
for (const n of nums) {
  const out = path.join(outDir, `card${n}.jpg`);
  if (fs.existsSync(out)) { console.log(`↺ card${n} 이미 있음 — 건너뜀`); ok++; continue; }
  try {
    const size = await generate(wanted[n], out);
    console.log(`✅ card${n}  ${(size / 1024).toFixed(0)}KB  [gemini]  ${wanted[n].slice(0, 44)}…`);
    ok++;
    continue;
  } catch (e) {
    console.error(`⚠️  card${n} Gemini 실패 (${e.message})`);
  }
  // Gemini 가 막혔을 때(크레딧 소진 등)만 2순위로 내려간다. 두 단계 모두 실패하면
  // 이 카드는 그대로 번들 사진으로 내려간다(렌더러가 처리 — bg() 참고).
  try {
    const { size, query, credit } = await fetchStock(wanted[n], out);
    console.log(`✅ card${n}  ${(size / 1024).toFixed(0)}KB  [pexels: "${query}", ${credit}]`);
    stock++;
  } catch (e) {
    console.error(`⚠️  card${n} Pexels 도 실패 (${e.message}) — 이 카드는 번들 사진을 씁니다.`);
    fail++;
  }
}
// 축소에 쓴 브라우저를 반드시 닫는다. 열어 둔 채로 두면 node 가 끝나지 않고 프로세스가
// 그대로 남는다 — GitHub Actions 에서는 작업이 시간제한까지 매달린다.
// (2026-08-23 실제로 그렇게 됐다: 시험 실행 뒤 node 가 15분 넘게 살아 있었다.)
if (_browser) await _browser.close();

console.log(`\n생성 ${ok}장(gemini) · ${stock}장(pexels) · 실패 ${fail}장 -> ${path.relative(root, outDir)}/`);
if (fail && !ok && !stock) console.error('전부 실패했습니다. 키(GEMINI_API_KEY·PEXELS_API_KEY)를 확인하십시오 — 다만 브리핑은 그대로 진행합니다.');
