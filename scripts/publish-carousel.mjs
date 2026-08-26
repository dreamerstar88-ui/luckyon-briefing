// publish-carousel.mjs
// 이미지 폴더 하나 + 캡션 파일 하나를 인스타 캐러셀로 발행한다.
// 정기 브리핑(publish-instagram.mjs)과 달리 content JSON 스키마에 매이지 않는 단발 게시용.
//
// 사용법:
//   node --env-file="C:/Users/PSJ_1/.secrets/luckyon-ig.env" \
//     scripts/publish-carousel.mjs <cards 아래 경로> [--dry-run]
//
//   예) node ... scripts/publish-carousel.mjs claude-memory --dry-run
//       → cards/claude-memory/ 의 *.jpg 를 이름순으로 올린다
//       → 캡션은 같은 폴더의 caption.txt
//       → 대체 텍스트는 같은 폴더의 alt.txt (한 줄에 한 장, 없으면 생략)
//
// 필요한 환경변수: IG_ACCESS_TOKEN · IG_USER_ID · PAGES_BASE_URL · GRAPH_VERSION(선택)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sub = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!sub) {
  console.error('Usage: node scripts/publish-carousel.mjs <cards 아래 경로> [--dry-run]');
  process.exit(1);
}

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
const dir = path.join(root, 'cards', ...sub.split('/'));
if (!fs.existsSync(dir)) { console.error(`❌ 폴더가 없습니다: ${dir}`); process.exit(1); }

const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();
if (files.length < 2 || files.length > 10) {
  console.error(`❌ 이미지가 ${files.length}장입니다. 캐러셀은 2~10장만 됩니다.`);
  process.exit(1);
}

const capPath = path.join(dir, 'caption.txt');
if (!fs.existsSync(capPath)) { console.error(`❌ caption.txt 가 없습니다: ${capPath}`); process.exit(1); }
const caption = fs.readFileSync(capPath, 'utf8').trim();
if (caption.length > 2200) { console.error(`❌ 캡션이 ${caption.length}자입니다. 한도 2,200자.`); process.exit(1); }

const altPath = path.join(dir, 'alt.txt');
const alts = fs.existsSync(altPath)
  ? fs.readFileSync(altPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  : [];

const imageUrls = files.map(f => `${PAGES}/cards/${sub}/${encodeURIComponent(f)}`);

async function api(pathname, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(`${BASE}/${pathname}`, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

async function waitFinished(id, label) {
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${BASE}/${id}?fields=status_code,status&access_token=${TOKEN}`);
    const j = await r.json();
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR') throw new Error(`${label} 처리 실패: ${j.status || ''}`);
    await sleep(3000);
  }
  throw new Error(`${label} 처리 시간 초과`);
}

async function waitForImages() {
  console.log('· GitHub Pages 공개 대기…');
  for (const u of imageUrls) {
    let ok = false;
    for (let i = 0; i < 50; i++) {          // 최대 ~5분
      try { const r = await fetch(u, { method: 'HEAD' }); if (r.ok) { ok = true; break; } } catch {}
      await sleep(6000);
    }
    if (!ok) throw new Error(`아직 공개되지 않음: ${u}`);
    console.log(`  · ${path.basename(u)} 공개됨`);
  }
}

async function main() {
  console.log(`\n▶ 캐러셀 발행 — cards/${sub} (${files.length}장)`);
  console.log(`· 캡션 ${caption.length}자 · 대체 텍스트 ${alts.length}개`);
  imageUrls.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2, '0')}. ${u}`));

  if (DRY) { console.log('\n[--dry-run] 여기까지. 실제 발행은 하지 않았습니다.'); return; }

  await waitForImages();

  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const params = { image_url: imageUrls[i], is_carousel_item: 'true' };
    if (alts[i]) params.alt_text = alts[i];
    const r = await api(`${IG_USER}/media`, params);
    childIds.push(r.id);
    console.log(`· 슬라이드 ${i + 1} 컨테이너: ${r.id}`);
  }
  for (let i = 0; i < childIds.length; i++) await waitFinished(childIds[i], `슬라이드 ${i + 1}`);

  const parent = await api(`${IG_USER}/media`, {
    media_type: 'CAROUSEL', children: childIds.join(','), caption,
  });
  console.log(`· 캐러셀 컨테이너: ${parent.id}`);
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
  console.log(`\n✅ 발행 완료! media id = ${published.id}`);
}

main().catch(e => { console.error('\n❌ 실패:', e.message); process.exit(1); });
