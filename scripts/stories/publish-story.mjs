// publish-story.mjs
// GitHub Pages 에 올라간 이미지를 Instagram 스토리로 발행한다.
// 스토리는 24시간 뒤 사라지며, 캡션·해시태그를 받지 않는다 (이미지 자체가 전부다).
//
// 사용법: node scripts/stories/publish-story.mjs <stamp> [ko|en] [--dry-run]
//   예)   node scripts/stories/publish-story.mjs 2026-07-27-week-ahead ko
//
// 필요한 환경변수: IG_ACCESS_TOKEN, IG_USER_ID, PAGES_BASE_URL
//   (선택) GRAPH_VERSION, SKIP_PAGES_WAIT=1

import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const pos = argv.filter((a) => !a.startsWith('--'));
const stamp = pos[0];
const lang = pos[1] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/stories/publish-story.mjs <stamp> [ko|en] [--dry-run]');
  process.exit(1);
}

function required(k) {
  const v = process.env[k];
  if (!v) { console.error(`❌ 환경변수 ${k} 가 없습니다.`); process.exit(1); }
  return v;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOKEN = DRY ? 'dry' : required('IG_ACCESS_TOKEN');
const IG_USER = DRY ? 'dry' : required('IG_USER_ID');
const PAGES = required('PAGES_BASE_URL').replace(/\/$/, '');
const VER = process.env.GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.instagram.com/${VER}`;

// 경로에 공백이 있거나 윈도우에서 돌 때 URL.pathname 은 '/C:/…/SJ%20PARK%20Project/…' 를
// 돌려줘 파일을 못 찾는다. fileURLToPath 는 두 경우 모두 올바른 경로를 준다.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const relDir = `cards/stories/${stamp}/${lang}`;
const localPng = path.join(root, ...relDir.split('/'), 'story.png');
if (!fs.existsSync(localPng)) {
  console.error(`❌ 이미지가 없습니다: ${relDir}/story.png\n`
    + `   먼저 렌더링하세요: node scripts/reels/render-reel.mjs ${stamp} ${lang} --still\n`
    + `   (이 경로만 alt.txt 를 함께 남깁니다. scripts/stories/render-story.mjs 는\n`
    + `    data/stories/ 의 구버전 '주간 미리보기' 스토리 전용입니다.)`);
  process.exit(1);
}
const imageUrl = `${PAGES}/${relDir}/story.png`;

// 대체 텍스트 — 넘기지 않으면 인스타가 이미지 속 텍스트를 OCR 로 읽어 엉뚱한 설명을 붙인다.
// 손글씨 문구는 렌더 시점에만 만들어지므로 render-reel.mjs --still 이 alt.txt 로 남겨 둔다.
const altFile = path.join(root, ...relDir.split('/'), 'alt.txt');
const altText = fs.existsSync(altFile) ? fs.readFileSync(altFile, 'utf8').trim() : '';
if (!altText) console.warn('⚠️  alt.txt 가 없습니다 — 대체 텍스트 없이 발행합니다 (render-reel.mjs --still 를 최신 버전으로 다시 돌리면 생깁니다).');

async function api(pathPart, params) {
  const res = await fetch(new URL(`${BASE}/${pathPart}`), {
    method: 'POST',
    body: new URLSearchParams({ ...params, access_token: TOKEN }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`API 오류 (${pathPart}): ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function waitFinished(id, maxTries = 24) {
  for (let i = 0; i < maxTries; i++) {
    const res = await fetch(`${BASE}/${id}?fields=status_code,status&access_token=${TOKEN}`);
    const j = await res.json();
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') {
      throw new Error(`컨테이너 상태 ${j.status_code}${j.status ? ` — ${j.status}` : ''}`);
    }
    await sleep(2500);
  }
  throw new Error('컨테이너가 시간 내 FINISHED 되지 않음');
}

async function waitForPages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략');
    return;
  }
  console.log('· GitHub Pages 반영 대기…');
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(imageUrl, { method: 'HEAD' })).ok) { console.log('· 공개 확인됨 ✅'); return; } } catch {}
    await sleep(6000);
  }
  throw new Error(`아직 공개되지 않음: ${imageUrl}`);
}

async function main() {
  console.log(`\n▶ 스토리 발행 [${lang.toUpperCase()}] ${stamp}`);
  console.log(`  image: ${imageUrl} (${(fs.statSync(localPng).size / 1024).toFixed(0)} KB)`);
  if (DRY) { console.log('\n· --dry-run: 실제 발행은 하지 않습니다.'); return; }

  await waitForPages();

  // Graph API rejects alt_text for media_type=STORIES ("The param alt_text is not supported
  // for STORY", confirmed 2026-08-04) — stories publish without it regardless of altText.
  const params = { media_type: 'STORIES', image_url: imageUrl };
  const c = await api(`${IG_USER}/media`, params);
  console.log(`· 컨테이너 생성: ${c.id}`);
  await waitFinished(c.id);

  const pub = await api(`${IG_USER}/media_publish`, { creation_id: c.id });
  console.log(`\n✅ 스토리 발행 완료! media id = ${pub.id}  (24시간 후 사라짐)`);
}

main().catch((e) => { console.error(`\n❌ 발행 실패: ${e.message}`); process.exit(1); });
