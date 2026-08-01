// publish-chartnotes.mjs
// "주식 차트 3분 노트"(chart-notes) 카드를 Instagram 캐러셀로 발행한다.
// 브리핑용 publish-instagram.mjs 와 완전히 분리된 스크립트다 — 스키마도 경로도 다르므로
// 어느 한쪽을 고쳐도 다른 축의 발행이 깨지지 않는다.
//
// 사용법: node scripts/chart-notes/publish-chartnotes.mjs <stamp> <lang>
//   예)   node scripts/chart-notes/publish-chartnotes.mjs 2026-08-01-ep01 ko
//
// 읽는 파일:
//   content/chart-notes/<stamp>.json      - caption_ko/caption_en, alt_ko/alt_en
//   cards/chart-notes/<stamp>/<lang>/card1..N.png
//
// 필요한 환경변수:
//   IG_ACCESS_TOKEN  - 장기(60일) 인스타 액세스 토큰
//   IG_USER_ID       - 인스타 비즈니스/크리에이터 계정 ID
//   PAGES_BASE_URL   - GitHub Pages 기본 주소
//   GRAPH_VERSION    - (선택) 그래프 API 버전, 기본 v21.0
//   CACHE_BUST       - (선택) 이미지 URL 에 ?v=... 를 붙여 CDN 캐시를 우회
//   SKIP_PAGES_WAIT  - (선택) '1' 이면 Pages 반영 확인을 건너뛴다.
//                      새 카드를 막 푸시한 직후에는 절대 켜지 말 것.

import fs from 'node:fs';
import path from 'node:path';

const stamp = process.argv[2];
const lang = process.argv[3] || 'ko';
if (!stamp) {
  console.error('Usage: node scripts/chart-notes/publish-chartnotes.mjs <stamp> <lang:ko|en>');
  console.error('  예)  node scripts/chart-notes/publish-chartnotes.mjs 2026-08-01-ep01 ko');
  process.exit(1);
}
if (!['ko', 'en'].includes(lang)) { console.error(`lang 은 ko|en 중 하나여야 합니다: ${lang}`); process.exit(1); }

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
const contentPath = path.join(root, 'content', 'chart-notes', `${stamp}.json`);
if (!fs.existsSync(contentPath)) {
  console.error(`❌ 콘텐츠 파일이 없습니다: content/chart-notes/${stamp}.json`);
  process.exit(1);
}
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const caption = lang === 'ko' ? content.caption_ko : content.caption_en;
const altTexts = lang === 'ko' ? content.alt_ko : content.alt_en;
if (!caption) { console.error(`❌ caption_${lang} 이 비어 있습니다.`); process.exit(1); }

const cardSubPath = `cards/chart-notes/${stamp}/${lang}`;
const localCardDir = path.join(root, ...cardSubPath.split('/'));
if (!fs.existsSync(localCardDir)) { console.error(`❌ 카드 디렉터리가 없습니다: ${cardSubPath}/`); process.exit(1); }
const CARD_COUNT = fs.readdirSync(localCardDir).filter(f => /^card\d+\.png$/.test(f)).length;
if (CARD_COUNT < 2) { console.error(`❌ ${cardSubPath}/ 에 카드 이미지가 부족합니다 (${CARD_COUNT}장).`); process.exit(1); }
if (altTexts && altTexts.length !== CARD_COUNT) {
  console.warn(`⚠️  alt_${lang} 이 ${altTexts.length}개인데 카드가 ${CARD_COUNT}장입니다 — 남는 슬라이드는 alt 없이 나갑니다.`);
}

const bust = process.env.CACHE_BUST ? `?v=${encodeURIComponent(process.env.CACHE_BUST)}` : '';
const imageUrls = Array.from({ length: CARD_COUNT }, (_, i) =>
  `${PAGES}/${cardSubPath}/card${i + 1}.png${bust}`);

async function api(pathPart, params) {
  const url = new URL(`${BASE}/${pathPart}`);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`API 오류 (${pathPart}): ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function getStatus(containerId) {
  const res = await fetch(`${BASE}/${containerId}?fields=status_code&access_token=${TOKEN}`);
  const json = await res.json();
  return json.status_code;
}

async function waitFinished(containerId, label, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    const s = await getStatus(containerId);
    if (s === 'FINISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`${label} 컨테이너 상태 ${s}`);
    await sleep(3000);
  }
  throw new Error(`${label} 컨테이너가 시간 내 FINISHED 되지 않음`);
}

async function waitForImages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략');
    return;
  }
  console.log('· GitHub Pages 이미지 반영 대기…');
  for (const u of imageUrls) {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(u, { method: 'HEAD' });
        if (r.ok) { ok = true; break; }
      } catch { /* 네트워크 순간 오류는 무시하고 재시도 */ }
      await sleep(6000);
    }
    if (!ok) throw new Error(`이미지 URL이 아직 공개되지 않음: ${u}`);
  }
  console.log('· 모든 이미지 공개 확인됨 ✅');
}

async function main() {
  console.log(`\n▶ Instagram 발행 시작 [${lang.toUpperCase()}] chart-notes ${stamp} (${CARD_COUNT}장)`);
  imageUrls.forEach(u => console.log('  -', u));
  await waitForImages();

  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const params = { image_url: imageUrls[i], is_carousel_item: 'true' };
    if (altTexts && altTexts[i]) params.alt_text = altTexts[i];
    const r = await api(`${IG_USER}/media`, params);
    childIds.push(r.id);
    console.log(`· 슬라이드 ${i + 1} 컨테이너 생성: ${r.id}`);
  }

  for (let i = 0; i < childIds.length; i++) {
    await waitFinished(childIds[i], `슬라이드 ${i + 1}`);
  }

  const parent = await api(`${IG_USER}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  });
  console.log(`· 캐러셀 컨테이너 생성: ${parent.id}`);
  await waitFinished(parent.id, '캐러셀');

  // 컨테이너가 FINISHED 여도 media_publish 가 잠시 9007 을 뱉는 경우가 있어 재시도한다.
  let published;
  for (let i = 0; ; i++) {
    try {
      published = await api(`${IG_USER}/media_publish`, { creation_id: parent.id });
      break;
    } catch (e) {
      if (i >= 5) throw e;
      console.log(`· 발행 재시도 ${i + 1}/5 (${e.message})`);
      await sleep(15000);
    }
  }
  console.log(`\n✅ 발행 완료! media id = ${published.id} [${lang.toUpperCase()}]`);

  const pl = await fetch(`${BASE}/${published.id}?fields=permalink&access_token=${TOKEN}`);
  const plJson = await pl.json();
  if (plJson.permalink) console.log(`🔗 ${plJson.permalink}`);
  console.log('\n※ content/chart-notes/_series.json 의 published 에 이 결과를 기록하세요.');
  return published.id;
}

main().catch(err => {
  console.error(`\n❌ 발행 실패 [${lang}]:`, err.message);
  process.exit(1);
});
