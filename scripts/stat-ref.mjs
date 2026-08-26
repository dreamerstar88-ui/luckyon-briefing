#!/usr/bin/env node
// stat-ref.mjs — 카드6 기준 문구(ref) 사전 조회·점검 도구.
//
//   node scripts/stat-ref.mjs "미국 8월 컨퍼런스보드 소비자신뢰지수"   # 한 건 조회
//   node scripts/stat-ref.mjs --list                                  # 사전 전체
//   node scripts/stat-ref.mjs --check 2026-08-26 am                   # 그 회차 카드6 커버리지
//
// 렌더러가 ref 를 자동으로 채우므로 보통은 --check 만 쓰면 된다. 안 잡히는 지표가
// 있으면 data/stat-refs.json 에 alias 를 추가하거나, 그 회차에만 쓰는 문구라면
// 콘텐츠의 stats[].ref_ko/ref_en 에 직접 적는다(그쪽이 사전을 이긴다).
//
// **--check 출력은 검증 에이전트에게 그대로 넘긴다** (ROUTINE_COMMON §3). 자동으로
// 채워지는 문구는 콘텐츠 JSON 에 없어서, 이 출력을 넘기지 않으면 에이전트가 그 줄을
// 아예 못 본다 — 카드에는 나가는데 게이트는 통과하지 않는 내용이 된다. 게다가 ref 는
// "1985년 = 100", "중립금리 2.5~3%" 처럼 **사실 주장**이라 틀리면 매 회차 반복된다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupRef, allRefs } from './lib/stat-refs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [a, b, c] = process.argv.slice(2);

if (!a) {
  console.log('사용법:\n  node scripts/stat-ref.mjs "<지표 이름>"\n  node scripts/stat-ref.mjs --list\n  node scripts/stat-ref.mjs --check <DATE> <SESSION>');
  process.exit(1);
}

if (a === '--list') {
  const all = allRefs();
  console.log(`사전 ${Object.keys(all).length}건\n`);
  for (const [k, v] of Object.entries(all)) {
    console.log(`▸ ${k}`);
    console.log(`   ko: ${v.ref_ko}`);
    console.log(`   en: ${v.ref_en}`);
    console.log(`   alias: ${v.aliases.join(' · ')}\n`);
  }
  process.exit(0);
}

if (a === '--check') {
  if (!b || !c) { console.error('--check 에는 <DATE> <SESSION> 이 필요하다'); process.exit(1); }
  const f = path.join(root, 'content', `${b}-${c}.json`);
  if (!fs.existsSync(f)) { console.error(`콘텐츠가 없다: ${f}`); process.exit(2); }
  const C = JSON.parse(fs.readFileSync(f, 'utf8'));
  const sec = (C.sections || []).find(s => s.title_ko === '실적 · 지표 발표');
  if (!sec) { console.error('카드6 섹션("실적 · 지표 발표")이 없다'); process.exit(2); }
  const stats = sec.stats || [];
  let own = 0, dict = 0, miss = 0;
  console.log(`카드6 기준줄 — 이 문구가 실제로 카드에 나간다 (타일 ${stats.length}개)`);
  console.log('검증 에이전트에게 이 출력을 그대로 넘긴다 — 사실 주장이므로 수치·기준연도를 확인시킨다.\n');
  for (const s of stats) {
    const label = s.label_ko || s.label_en;
    if (s.ref_ko || s.ref_en) {
      own++;
      console.log(`  ✎ ${label}   [콘텐츠에 직접 작성]`);
      console.log(`      ko: ${s.ref_ko || '(비어 있음 — 한국어 카드에서 이 줄이 안 나온다)'}`);
      console.log(`      en: ${s.ref_en || '(비어 있음 — 영어 카드에서 이 줄이 안 나온다)'}\n`);
      continue;
    }
    const hit = lookupRef(s.label_ko, s.label_en);
    if (hit) {
      dict++;
      console.log(`  ✓ ${label}   [사전 ${hit.key} · alias "${hit.matched}"]`);
      console.log(`      ko: ${hit.ref_ko}`);
      console.log(`      en: ${hit.ref_en}\n`);
    } else {
      miss++;
      console.log(`  ✗ ${label}   [사전에 없음 — 이 타일은 기준줄 없이 나간다]`);
      console.log(`      → data/stat-refs.json 에 alias 를 추가하거나 stats[].ref_ko/ref_en 을 직접 쓴다\n`);
    }
  }
  console.log(`직접 ${own} · 사전 ${dict} · 미매칭 ${miss}`);
  console.log('\n고치는 곳: 사전 문구가 틀렸으면 data/stat-refs.json (다음 회차부터 전부 반영) ·');
  console.log('           이번 회차에만 다르게 쓸 거면 콘텐츠의 stats[].ref_ko/ref_en (그쪽이 이긴다)');
  process.exit(miss ? 3 : 0);
}

const hit = lookupRef(a, a);
if (!hit) { console.log(`✗ "${a}" — 사전에 없다. data/stat-refs.json 에 alias 를 추가하거나 ref 를 직접 쓴다.`); process.exit(3); }
console.log(`✓ ${hit.key}  (alias "${hit.matched}" 로 매칭)`);
console.log(`  ko: ${hit.ref_ko}`);
console.log(`  en: ${hit.ref_en}`);
