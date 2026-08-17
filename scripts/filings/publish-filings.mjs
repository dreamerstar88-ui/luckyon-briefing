// publish-filings.mjs
// '숫자로 보는 기업 공시' 시리즈를 Instagram 캐러셀로 발행한다.
// scripts/publish-instagram.mjs 와 같은 흐름이지만 경로 축이 다르다
// (브리핑용 content/ 루트를 건드리지 않기 위해 별도 축으로 분리).
//
// 사용법: node --env-file=<토큰파일> scripts/filings/publish-filings.mjs <stamp> <lang>
//   예)   node --env-file="C:/Users/PSJ_1/.secrets/luckyon-ig.env" \
//              scripts/filings/publish-filings.mjs 2026-08-17-nvda ko
//
// 읽는 경로:
//   content/filings/<stamp>.json      → caption_ko / caption_en, (선택) alt_ko / alt_en
//   cards/filings/<stamp>/<lang>/     → card1.png … cardN.png
//
// 필요한 환경변수: IG_ACCESS_TOKEN, IG_USER_ID, PAGES_BASE_URL, (선택) GRAPH_VERSION

import fs from 'node:fs';
import path from 'node:path';

const stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/filings/publish-filings.mjs <stamp> <lang>');
  process.exit(1);
}

function required(k) {
  const v = process.env[k];
  if (!v) { console.error(`❌ 환경변수 ${k} 가 없습니다.`); process.exit(1); }
  return v;
}

const TOKEN = required('IG_ACCESS_TOKEN');
const IG_USER = required('IG_USER_ID');
const PAGES = required('PAGES_BASE_URL').replace(/\/$/, '');
const VER = process.env.GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.instagram.com/${VER}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const content = JSON.parse(
  fs.readFileSync(path.join(root, 'content', 'filings', `${stamp}.json`), 'utf8'));
const caption = lang === 'ko' ? content.caption_ko : content.caption_en;
if (!caption) { console.error(`❌ caption_${lang} 이 비어 있습니다.`); process.exit(1); }
const altTexts = (lang === 'ko' ? content.alt_ko : content.alt_en) || [];

const cardSubPath = `cards/filings/${stamp}/${lang}`;
const localCardDir = path.join(root, ...cardSubPath.split('/'));
const CARD_COUNT = fs.readdirSync(localCardDir)
  .filter(f => /^card\d+\.png$/.test(f)).length;
if (CARD_COUNT < 2) { console.error(`❌ ${cardSubPath}/ 에 카드가 없습니다.`); process.exit(1); }
if (CARD_COUNT > 10) {
  console.error(`❌ 캐러셀은 최대 10장입니다. 현재 ${CARD_COUNT}장.`); process.exit(1);
}

const bust = process.env.CACHE_BUST ? `?v=${encodeURIComponent(process.env.CACHE_BUST)}` : '';
const imageUrls = Array.from({ length: CARD_COUNT }, (_, i) =>
  `${PAGES}/${cardSubPath}/card${i + 1}.png${bust}`);

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

async function getStatus(id) {
  const res = await fetch(`${BASE}/${id}?fields=status_code&access_token=${TOKEN}`);
  return (await res.json()).status_code;
}

async function waitFinished(id, label, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    const s = await getStatus(id);
    if (s === 'FINISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`${label} 컨테이너 상태 ${s}`);
    await sleep(3000);
  }
  throw new Error(`${label} 컨테이너가 시간 내 FINISHED 되지 않음`);
}

// GitHub Pages 반영 대기. 컨테이너가 github.io 를 막는 환경이면 SKIP_PAGES_WAIT=1.
// (실제 이미지 fetch 는 Instagram 서버가 하므로 발행 자체에는 영향 없음)
async function waitForImages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략'); return;
  }
  console.log('· GitHub Pages 이미지 반영 대기…');
  for (const u of imageUrls) {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(u, { method: 'HEAD' })).ok) { ok = true; break; } } catch {}
      await sleep(6000);
    }
    if (!ok) throw new Error(`이미지 URL이 아직 공개되지 않음: ${u}`);
  }
  console.log('· 모든 이미지 공개 확인됨 ✅');
}

async function main() {
  console.log(`\n▶ 공시 시리즈 발행 [${lang.toUpperCase()}] ${stamp} (${CARD_COUNT}장)`);
  await waitForImages();

  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const params = { image_url: imageUrls[i], is_carousel_item: 'true' };
    if (altTexts[i]) params.alt_text = altTexts[i];
    const r = await api(`${IG_USER}/media`, params);
    childIds.push(r.id);
    console.log(`· 슬라이드 ${i + 1} 컨테이너 생성: ${r.id}`);
  }
  for (let i = 0; i < childIds.length; i++) await waitFinished(childIds[i], `슬라이드 ${i + 1}`);

  const parent = await api(`${IG_USER}/media`, {
    media_type: 'CAROUSEL', children: childIds.join(','), caption,
  });
  console.log(`· 캐러셀 컨테이너 생성: ${parent.id}`);
  await waitFinished(parent.id, '캐러셀');

  let published;
  for (let i = 0; ; i++) {
    try { published = await api(`${IG_USER}/media_publish`, { creation_id: parent.id }); break; }
    catch (e) {
      if (i >= 5) throw e;
      console.log(`· 발행 재시도 ${i + 1}/5 (${e.message})`);
      await sleep(15000);
    }
  }
  console.log(`\n✅ 발행 완료! media id = ${published.id} [${lang.toUpperCase()}]`);
}

main().catch(err => { console.error(`\n❌ 발행 실패 [${lang}]:`, err.message); process.exit(1); });
