// gen-card-photos.mjs
// 카드 배경 사진을 **그날 내용에 맞게 만들어** 둔다. 렌더러(render-cards-day.mjs)가
// data/card-photos/<date>-<session>/card<n>.jpg 를 찾아 쓰고, 없으면 번들 사진으로 내려간다.
//
// 사용법:
//   node scripts/gen-card-photos.mjs <YYYY-MM-DD> <am|pm>
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
// 실패해도 브리핑을 멈추지 않는다
//   키가 없거나 생성이 실패하면 그 카드만 번들 사진으로 내려가고 exit 0 으로 끝난다.
//   발행이 사진 때문에 막히는 것이 사진이 평범한 것보다 나쁘다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  fs.writeFileSync(outFile, Buffer.from(blob.data, 'base64'));
  return fs.statSync(outFile).size;
}

const contentFile = path.join(root, 'content', `${date}-${session}.json`);
if (!fs.existsSync(contentFile)) { console.error('❌ 콘텐츠 파일이 없습니다:', contentFile); process.exit(1); }
const C = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
const wanted = C.card_photos || {};
const nums = Object.keys(wanted).filter(n => /^([1-9]|10)$/.test(n));

if (!nums.length) {
  console.log('⏭  card_photos 가 비어 있습니다 — 번들 사진으로 진행합니다.');
  process.exit(0);
}

const outDir = path.join(root, 'data', 'card-photos', `${date}-${session}`);
fs.mkdirSync(outDir, { recursive: true });

let ok = 0, fail = 0;
for (const n of nums) {
  const out = path.join(outDir, `card${n}.jpg`);
  if (fs.existsSync(out)) { console.log(`↺ card${n} 이미 있음 — 건너뜀`); ok++; continue; }
  try {
    const size = await generate(wanted[n], out);
    console.log(`✅ card${n}  ${(size / 1024).toFixed(0)}KB  ${wanted[n].slice(0, 44)}…`);
    ok++;
  } catch (e) {
    console.error(`⚠️  card${n} 실패 (${e.message}) — 이 카드는 번들 사진을 씁니다.`);
    fail++;
  }
}
console.log(`\n생성 ${ok}장 · 실패 ${fail}장 -> ${path.relative(root, outDir)}/`);
if (fail && !ok) console.error('전부 실패했습니다. 키(GEMINI_API_KEY)를 확인하십시오 — 다만 브리핑은 그대로 진행합니다.');
