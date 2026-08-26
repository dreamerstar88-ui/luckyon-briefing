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
  console.log(`카드6 타일 ${stats.length}개\n`);
  for (const s of stats) {
    const label = s.label_ko || s.label_en;
    if (s.ref_ko || s.ref_en) { own++; console.log(`  ✎ ${label}\n      직접 작성: ${s.ref_ko || s.ref_en}`); continue; }
    const hit = lookupRef(s.label_ko, s.label_en);
    if (hit) { dict++; console.log(`  ✓ ${label}\n      사전(${hit.key}, "${hit.matched}"): ${hit.ref_ko}`); }
    else { miss++; console.log(`  ✗ ${label}\n      사전에 없음 — alias 를 추가하거나 ref 를 직접 쓴다`); }
  }
  console.log(`\n직접 ${own} · 사전 ${dict} · 미매칭 ${miss}`);
  process.exit(miss ? 3 : 0);
}

const hit = lookupRef(a, a);
if (!hit) { console.log(`✗ "${a}" — 사전에 없다. data/stat-refs.json 에 alias 를 추가하거나 ref 를 직접 쓴다.`); process.exit(3); }
console.log(`✓ ${hit.key}  (alias "${hit.matched}" 로 매칭)`);
console.log(`  ko: ${hit.ref_ko}`);
console.log(`  en: ${hit.ref_en}`);
