// publish-reel.mjs
// GitHub Pages 에 올라간 mp4 를 Instagram 릴스로 발행한다.
// (캐러셀용 publish-instagram.mjs 와 같은 API 를 쓰지만 media_type=REELS 경로다.
//  영상은 서버가 인코딩하므로 컨테이너가 FINISHED 될 때까지 더 오래 기다린다.)
//
// 사용법: node scripts/reels/publish-reel.mjs <stamp|latest> [ko|en]
//   예)   node scripts/reels/publish-reel.mjs week-2026-07-20
//         node scripts/reels/publish-reel.mjs latest --dry-run
//
// 필요한 환경변수: IG_ACCESS_TOKEN, IG_USER_ID, PAGES_BASE_URL
//   (선택) GRAPH_VERSION, SKIP_PAGES_WAIT=1

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const positional = argv.filter((a) => !a.startsWith('--'));
const lang = positional[1] || 'ko';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.join(root, 'data', 'reels');

let stamp = positional[0];
if (!stamp || stamp === 'latest') {
  const p = path.join(dataDir, 'latest.txt');
  if (!fs.existsSync(p)) {
    console.error('Usage: node scripts/reels/publish-reel.mjs <stamp|latest> [ko|en]');
    process.exit(1);
  }
  stamp = fs.readFileSync(p, 'utf8').trim();
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

// 발행할 파일
const relDir = `cards/reels/${stamp}/${lang}`;
const localMp4 = path.join(root, ...relDir.split('/'), 'reel.mp4');
if (!fs.existsSync(localMp4)) {
  console.error(`❌ 영상이 없습니다: ${relDir}/reel.mp4\n   먼저 render-reel.mjs 를 실행하세요.`);
  process.exit(1);
}
const videoUrl = `${PAGES}/${relDir}/reel.mp4`;
// 표지는 **JPEG 를 먼저 쓴다.** 인스타 cover_url 은 JPEG 를 요구한다 —
//   PNG 를 주면 컨테이너 생성에서 막힐 수 있다. cover.jpg 가 있으면 그것을,
//   없으면 예전처럼 cover.png 를 쓴다. (2026-08-31)
const coverName = fs.existsSync(path.join(root, ...relDir.split('/'), 'cover.jpg')) ? 'cover.jpg' : 'cover.png';
const coverUrl = `${PAGES}/${relDir}/${coverName}`;

// 캡션
const captionFile = path.join(root, ...relDir.split('/'), 'caption.txt');
if (!fs.existsSync(captionFile)) {
  console.error(`❌ 캡션 파일이 없습니다: ${relDir}/caption.txt`);
  process.exit(1);
}
const caption = fs.readFileSync(captionFile, 'utf8').trim();

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
  const res = await fetch(`${BASE}/${id}?fields=status_code,status&access_token=${TOKEN}`);
  const j = await res.json();
  return { code: j.status_code, detail: j.status };
}

// 영상은 인코딩 때문에 이미지보다 훨씬 오래 걸린다 (최대 ~5분 대기)
async function waitFinished(id, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const { code, detail } = await getStatus(id);
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`컨테이너 상태 ${code}${detail ? ` — ${detail}` : ''}`);
    }
    if (i % 5 === 0) process.stdout.write(`  인코딩 대기… ${i * 5}s\r`);
    await sleep(5000);
  }
  throw new Error('영상 컨테이너가 시간 내 FINISHED 되지 않음');
}

async function waitForPages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략');
    return;
  }
  console.log('· GitHub Pages 반영 대기…');
  for (const u of [videoUrl, coverUrl]) {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(u, { method: 'HEAD' })).ok) { ok = true; break; } } catch {}
      await sleep(6000);
    }
    if (!ok) throw new Error(`아직 공개되지 않음: ${u}`);
  }
  console.log('· 공개 확인됨 ✅');
}

async function main() {
  const sizeMb = (fs.statSync(localMp4).size / 1048576).toFixed(2);
  console.log(`\n▶ 릴스 발행 [${lang.toUpperCase()}] ${stamp} (${sizeMb} MB)`);
  console.log(`  video: ${videoUrl}`);
  console.log(`  cover: ${coverUrl}`);
  console.log(`  caption:\n${caption.split('\n').map((l) => '    ' + l).join('\n')}`);

  if (DRY) { console.log('\n· --dry-run: 실제 발행은 하지 않습니다.'); return; }

  await waitForPages();

  // 1) 릴스 컨테이너 생성
  const c = await api(`${IG_USER}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    cover_url: coverUrl,
    caption,
    share_to_feed: 'true',
  });
  console.log(`· 컨테이너 생성: ${c.id}`);

  // 2) 인코딩 완료 대기
  await waitFinished(c.id);
  console.log('\n· 인코딩 완료 ✅');

  // 3) 발행
  const pub = await api(`${IG_USER}/media_publish`, { creation_id: c.id });
  console.log(`\n✅ 발행 완료! media id = ${pub.id}`);
}

main().catch((e) => { console.error(`\n❌ 발행 실패: ${e.message}`); process.exit(1); });
