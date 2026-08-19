// verify-alt-text.mjs
// 발행된 Instagram 캐러셀의 슬라이드별 alt_text 가 우리가 넣으려던 값과
// 실제로 일치하는지 확인한다.
//
// 왜 필요한가: Graph API 는 모르는 파라미터를 오류 없이 조용히 무시하기도 한다.
// 즉 "발행 성공"이 곧 "alt_text 적용됨"은 아니다. 실제로 읽어와 대조해야 확실하다.
//
// 사용법:
//   node scripts/verify-alt-text.mjs <date> <lang> <session>
//     예) node scripts/verify-alt-text.mjs 2026-08-03 ko am
//     → 계정의 최근 게시물에서 해당 날짜/언어의 캐러셀을 캡션으로 찾아 대조한다.
//
//   node scripts/verify-alt-text.mjs <date> <lang> <session> --media-id=<id>
//     → 게시물을 직접 지정한다 (캡션 매칭이 실패할 때).
//
// 필요한 환경변수: IG_ACCESS_TOKEN, IG_USER_ID
//   GRAPH_VERSION - (선택) 기본 v21.0
//   LOOKBACK      - (선택) 최근 몇 건에서 찾을지, 기본 25

import fs from 'node:fs';
import path from 'node:path';
import { buildAltTexts } from './lib/alt-text.mjs';
import { fileURLToPath } from 'node:url';

const [date, lang = 'ko', session = ''] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const mediaIdArg = (process.argv.find(a => a.startsWith('--media-id=')) || '').split('=')[1];

if (!date) {
  console.error('Usage: node scripts/verify-alt-text.mjs <date> <lang> <session> [--media-id=<id>]');
  process.exit(1);
}

const TOKEN = required('IG_ACCESS_TOKEN');
const IG_USER = required('IG_USER_ID');
const VER = process.env.GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.instagram.com/${VER}`;
const LOOKBACK = Number(process.env.LOOKBACK || 25);

function required(k) {
  const v = process.env[k];
  if (!v) { console.error(`❌ 환경변수 ${k} 가 없습니다.`); process.exit(1); }
  return v;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentFile = session ? `${date}-${session}.json` : `${date}.json`;
const contentPath = path.join(root, 'content', contentFile);
if (!fs.existsSync(contentPath)) {
  console.error(`❌ 콘텐츠 파일이 없습니다: content/${contentFile}`);
  console.error('   날짜·세션 인자를 확인하세요 (예: 2026-08-02 ko sun).');
  process.exit(1);
}
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const expected = buildAltTexts(content, lang);
const caption = lang === 'ko' ? content.caption_ko : content.caption_en;

async function get(pathPart, params = {}) {
  const url = new URL(`${BASE}/${pathPart}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', TOKEN);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    const err = new Error(json.error?.message || JSON.stringify(json));
    err.graph = json.error;
    throw err;
  }
  return json;
}

// 캡션 앞부분으로 게시물을 찾는다 (캡션은 ko/en 이 달라 언어 구분도 겸한다)
async function findMedia() {
  if (mediaIdArg) return mediaIdArg;
  const key = (caption || '').split('\n')[0].trim();
  if (!key) throw new Error('콘텐츠 JSON 에 캡션이 없어 게시물을 찾을 수 없습니다. --media-id 로 지정하세요.');
  const { data = [] } = await get(`${IG_USER}/media`, {
    fields: 'id,caption,media_type,timestamp',
    limit: String(LOOKBACK),
  });
  const hit = data.find(m => (m.caption || '').includes(key));
  if (!hit) {
    console.error(`❌ 최근 ${LOOKBACK}건에서 캡션이 "${key}" 로 시작하는 게시물을 찾지 못했습니다.`);
    console.error('   아직 발행 전이거나, --media-id=<id> 로 직접 지정해야 합니다.');
    process.exit(1);
  }
  if (hit.media_type !== 'CAROUSEL_ALBUM') {
    console.log(`⚠️  찾은 게시물이 캐러셀이 아닙니다 (media_type=${hit.media_type}).`);
  }
  console.log(`· 게시물 발견: ${hit.id} (${hit.timestamp})`);
  return hit.id;
}

// 캐러셀 자식의 alt_text 읽기. 자식 항목에서 이 필드가 지원되지 않는 경우가 있어
// 실패하면 이유를 명확히 알리고 앱 수동 확인으로 안내한다.
async function readChildAltTexts(mediaId) {
  try {
    const r = await get(`${mediaId}/children`, { fields: 'id,alt_text' });
    return { ok: true, children: r.data || [] };
  } catch (e) {
    const unsupported = /alt_text|nonexisting field|unknown field/i.test(e.message || '');
    return { ok: false, unsupported, error: e.message };
  }
}

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`\n▶ alt_text 검증 [${lang.toUpperCase()}${session ? ' ' + session.toUpperCase() : ''}] ${date}`);
  console.log(`· 기대 슬라이드 수: ${expected.length}`);

  const mediaId = await findMedia();
  const res = await readChildAltTexts(mediaId);

  if (!res.ok) {
    console.log('\n⚠️  API 로 alt_text 를 읽지 못했습니다.');
    console.log(`   사유: ${res.error}`);
    if (res.unsupported) {
      console.log('   → 이 계정/버전에서는 캐러셀 자식의 alt_text 읽기를 지원하지 않는 것으로 보입니다.');
    }
    console.log('\n   수동 확인: 인스타 앱 → 해당 게시물 → 우상단 ⋯ → 수정 → 슬라이드별 "대체 텍스트".');
    console.log('   아래 기대값과 눈으로 대조하세요:\n');
    expected.forEach((s, i) => console.log(`   [슬라이드 ${i + 1}] ${s}\n`));
    process.exit(2);
  }

  const children = res.children;
  console.log(`· 읽어온 슬라이드 수: ${children.length}\n`);

  let match = 0, mismatch = 0, empty = 0;
  const n = Math.max(children.length, expected.length);
  for (let i = 0; i < n; i++) {
    const want = expected[i];
    const got = children[i]?.alt_text;
    const label = `슬라이드 ${i + 1}`;
    if (want === undefined) {
      console.log(`⚠️  ${label}: 기대값 없음 (게시물 슬라이드가 더 많음) — 실제: ${trunc(got)}`);
      mismatch++;
    } else if (!got) {
      console.log(`❌ ${label}: alt_text 가 비어 있음 — 커스텀 값이 적용되지 않았습니다 (인스타 자동 생성 추정)`);
      console.log(`     기대: ${trunc(want)}`);
      empty++;
    } else if (norm(got) === norm(want)) {
      console.log(`✅ ${label}: 일치`);
      match++;
    } else {
      console.log(`⚠️  ${label}: 다름`);
      console.log(`     기대: ${trunc(want)}`);
      console.log(`     실제: ${trunc(got)}`);
      mismatch++;
    }
  }

  console.log(`\n결과: 일치 ${match} / 다름 ${mismatch} / 비어있음 ${empty}  (총 ${n})`);
  if (empty > 0) {
    console.log('→ alt_text 파라미터가 무시된 것으로 보입니다. publish-instagram.mjs 의 전달 방식을 점검하세요.');
    process.exit(1);
  }
  if (mismatch > 0) {
    console.log('→ 발행 후 콘텐츠 JSON 이 수정됐거나, 다른 회차의 게시물을 찾았을 수 있습니다.');
    process.exit(1);
  }
  console.log('→ 모든 슬라이드의 alt_text 가 의도한 값과 일치합니다. ✅');
}

function trunc(s, n = 110) {
  const one = norm(s);
  return one.length > n ? one.slice(0, n) + '…' : one;
}

main().catch(err => {
  console.error(`\n❌ 검증 실패: ${err.message}`);
  process.exit(1);
});
