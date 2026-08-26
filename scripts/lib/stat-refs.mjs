// stat-refs.mjs — 카드6 stats[].ref 기준 문구 사전 조회.
//
// 왜 있나: `ref` 는 "그 숫자를 읽는 법"이라 회차마다 달라지지 않는다. 매번 세션이
// 새로 쓰면 같은 지표인데 회차마다 문구가 달라지고 품질도 들쭉날쭉해진다.
// data/stat-refs.json 에 모아두고 라벨에서 찾아 쓴다 (2026-08-26 사용자 요청).
//
// 매칭 규칙
//   · 공백·가운뎃점·괄호를 지우고 소문자로 맞춘 뒤 alias 가 라벨에 들어 있는지 본다.
//   · **긴 alias 부터** 검사한다 — "근원 PCE" 가 "PCE" 보다, "ISM 서비스" 가 "PMI" 보다 먼저.
//   · alias 에 `+` 를 쓰면 **조각이 모두 들어 있어야** 매칭된다(순서 무관):
//     `미국+실업률` 은 "미국 8월 실업률" 에 걸리고 "한국 실업률" 에는 안 걸린다.
//     `수출`·`실업률`·`GDP` 처럼 두 나라에 다 쓰이는 말은 국가를 붙인 alias 를 함께 두고,
//     맨 alias 는 국가가 안 적힌 라벨을 위한 최후 수단으로 남긴다 — 긴 것부터 보므로
//     국가가 붙은 쪽이 항상 먼저 잡힌다. (안 그러면 한국 수출 타일에 미국 설명이 붙는다.)
//   · label_ko 를 먼저 보고, 못 찾으면 label_en 을 본다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let PAIRS = null;   // [{ alias, norm, key, ref_ko, ref_en }] — 긴 alias 순
let DICT = null;

function load() {
  if (PAIRS) return;
  DICT = JSON.parse(fs.readFileSync(path.join(root, 'data', 'stat-refs.json'), 'utf8'));
  PAIRS = [];
  for (const [key, v] of Object.entries(DICT)) {
    if (key.startsWith('_')) continue;
    for (const alias of v.aliases || []) {
      const parts = alias.split('+').map(norm).filter(Boolean);
      PAIRS.push({ alias, norm: parts.join(''), parts, key, ref_ko: v.ref_ko, ref_en: v.ref_en });
    }
  }
  PAIRS.sort((a, b) => b.norm.length - a.norm.length);
}

const norm = s => String(s ?? '').toLowerCase().replace(/[\s·()[\]{},]/g, '');

/** 라벨에서 기준 문구를 찾는다. 못 찾으면 null. */
export function lookupRef(labelKo, labelEn) {
  load();
  for (const label of [labelKo, labelEn]) {
    const n = norm(label);
    if (!n) continue;
    const hit = PAIRS.find(p => p.parts.every(q => n.includes(q)));
    if (hit) return { key: hit.key, matched: hit.alias, ref_ko: hit.ref_ko, ref_en: hit.ref_en };
  }
  return null;
}

/** 사전 전체 (CLI 용). */
export function allRefs() {
  load();
  return Object.fromEntries(Object.entries(DICT).filter(([k]) => !k.startsWith('_')));
}
