// publish-instagram.mjs
// GitHub Pages에 올라간 카드 이미지들을 Instagram 캐러셀로 발행한다.
// Instagram API with Instagram Login (graph.instagram.com) 사용.
//
// 사용법: node scripts/publish-instagram.mjs <date> <lang> <session:am|pm>
//   예)   node scripts/publish-instagram.mjs 2026-07-16 ko am
//   session 을 생략하면 구버전 content/<date>.json / cards/<date>/<lang>/ 경로로 동작한다.
//
// 필요한 환경변수:
//   IG_ACCESS_TOKEN  - 장기(60일) 인스타 액세스 토큰
//   IG_USER_ID       - 인스타 비즈니스/크리에이터 계정 ID (예: 27358818657120221)
//   PAGES_BASE_URL   - GitHub Pages 기본 주소
//                      (예: https://dreamerstar88-ui.github.io/luckyon-briefing)
//   GRAPH_VERSION    - (선택) 그래프 API 버전, 기본 v21.0

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAltTexts } from './lib/alt-text.mjs';

const date = process.argv[2];
const lang = process.argv[3] || 'ko';
const session = process.argv[4] || '';
if (!date) { console.error('Usage: node scripts/publish-instagram.mjs <date> <lang> <session:am|pm|sat|sun>'); process.exit(1); }
if (session && !['am', 'pm', 'sat', 'sun'].includes(session)) { console.error(`session 은 am|pm|sat|sun 중 하나여야 합니다: ${session}`); process.exit(1); }

const TOKEN = required('IG_ACCESS_TOKEN');
const IG_USER = required('IG_USER_ID');
const PAGES = required('PAGES_BASE_URL').replace(/\/$/, '');
const VER = process.env.GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.instagram.com/${VER}`;

function required(k) {
  const v = process.env[k];
  if (!v) { console.error(`❌ 환경변수 ${k} 가 없습니다.`); process.exit(1); }
  return v;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentFile = session ? `${date}-${session}.json` : `${date}.json`;
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', contentFile), 'utf8'));
const caption = lang === 'ko' ? content.caption_ko : content.caption_en;

// 슬라이드별 대체 텍스트 (생성 로직·이유는 scripts/lib/alt-text.mjs 참고)
const altTexts = buildAltTexts(content, lang);

// 로컬에 렌더된 카드 수를 세어 슬라이드 수를 정한다 (구버전 7장 / 신버전 8장 모두 대응)
const cardSubPath = session ? `cards/${date}/${session}/${lang}` : `cards/${date}/${lang}`;
const localCardDir = path.join(root, ...cardSubPath.split('/'));
const CARD_COUNT = fs.readdirSync(localCardDir).filter(f => /^card\d+\.png$/.test(f)).length;
if (CARD_COUNT < 2) { console.error(`❌ ${cardSubPath}/ 에 카드 이미지가 없습니다.`); process.exit(1); }

// 이미지 공개 URL 목록
// CACHE_BUST 를 지정하면(예: 커밋 SHA) 쿼리스트링으로 붙여 GitHub Pages CDN의
// 이전 배포 캐시를 우회한다 — 같은 경로에 이미지를 다시 렌더링해 재발행할 때 필수.
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
  const url = `${BASE}/${containerId}?fields=status_code&access_token=${TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.status_code; // IN_PROGRESS | FINISHED | ERROR | EXPIRED
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

// GitHub Pages가 이미지를 실제로 서빙할 때까지 대기 (푸시 직후 반영 지연 대비)
// SKIP_PAGES_WAIT=1 이면 건너뛴다 (세션 네트워크 정책이 github.io 접근을 막는 환경용;
// 실제 이미지 fetch는 Instagram 서버가 수행하므로 발행 자체에는 영향 없음)
async function waitForImages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략');
    return;
  }
  console.log('· GitHub Pages 이미지 반영 대기…');
  for (const u of imageUrls) {
    let ok = false;
    for (let i = 0; i < 40; i++) { // 최대 ~4분
      try {
        const r = await fetch(u, { method: 'HEAD' });
        if (r.ok) { ok = true; break; }
      } catch {}
      await sleep(6000);
    }
    if (!ok) throw new Error(`이미지 URL이 아직 공개되지 않음: ${u}`);
  }
  console.log('· 모든 이미지 공개 확인됨 ✅');
}

async function main() {
  console.log(`\n▶ Instagram 발행 시작 [${lang.toUpperCase()}${session ? ' ' + session.toUpperCase() : ''}] ${date} (${CARD_COUNT}장)`);
  await waitForImages();

  // 1) 슬라이드별 아이템 컨테이너 생성
  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const params = { image_url: imageUrls[i], is_carousel_item: 'true' };
    if (altTexts[i]) params.alt_text = altTexts[i];
    const r = await api(`${IG_USER}/media`, params);
    childIds.push(r.id);
    console.log(`· 슬라이드 ${i + 1} 컨테이너 생성: ${r.id}`);
  }

  // 2) 각 아이템 처리 완료 대기
  for (let i = 0; i < childIds.length; i++) {
    await waitFinished(childIds[i], `슬라이드 ${i + 1}`);
  }

  // 3) 캐러셀(부모) 컨테이너 생성
  const parent = await api(`${IG_USER}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  });
  console.log(`· 캐러셀 컨테이너 생성: ${parent.id}`);
  await waitFinished(parent.id, '캐러셀');

  // 4) 발행 (컨테이너가 FINISHED여도 잠시 뒤에야 발행 가능한 경우가 있어 재시도)
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
  console.log(`\n✅ 발행 완료! media id = ${published.id} [${lang.toUpperCase()}${session ? ' ' + session.toUpperCase() : ''}]`);
  return published.id;
}

main().catch(err => {
  console.error(`\n❌ 발행 실패 [${lang}]:`, err.message);
  process.exit(1);
});
