#!/usr/bin/env node
// 캡션 검사 — 위반 시 종료코드 1 (발행 중단)
// 사용: node scripts/lint-caption.mjs --stamp 2026-08-12-ep01

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 스크립트가 scripts/ 에 있든 scripts/backtest/ 에 있든 동작하도록
// package.json 을 찾을 때까지 상위 폴더로 올라간다
function findRoot(start) {
  let d = start
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(d, 'package.json'))) return d
    d = join(d, '..')
  }
  return join(start, '..')
}
const ROOT = findRoot(dirname(fileURLToPath(import.meta.url)))

// 권유로 읽히는 "표현 패턴"만 잡는다.
// "매 거래일 매수했습니다" 같은 사실 서술은 통과해야 하므로 단어 단독 금지는 쓰지 않는다.
const BANNED = [
  { re: /매수\s*(하세요|추천|하시길|권장)/, msg: '매수 권유 표현' },
  { re: /매도\s*(하세요|추천|하시길|권장)/, msg: '매도 권유 표현' },
  { re: /지금\s*(사|매수|들어가)/, msg: '타이밍 권유' },
  { re: /(무조건|반드시)\s*(오|올라|상승|수익|버|먹)/, msg: '수익 단정' },
  { re: /(보장|확정)(합니다|됩니다|드립니다|된다)/, msg: '수익 보장 표현' },
  { re: /필승|절대\s*안전|손실\s*없/, msg: '위험 부정 표현' },
  { re: /강추|적극\s*추천|강력\s*추천/, msg: '종목 추천' },
  { re: /\b(buy|sell)\s+now\b/i, msg: 'timing call' },
  { re: /\bguaranteed?\s+(returns?|profits?|gains?)\b/i, msg: 'guaranteed return' },
  { re: /\b(will|must)\s+(definitely|surely)\b/i, msg: 'certainty claim' },
  { re: /\brisk[- ]free\b/i, msg: 'risk-free claim' },
]

const REQUIRED = [
  { re: /(투자 권유가 아닙니다|Not investment advice)/i, msg: '면책 문구 누락' },
  { re: /(보장하지 않습니다|does not guarantee)/i, msg: '과거성과 고지 누락' },
]

const MAX_HASHTAGS = 5
const MAX_LEN = { ko: 900, en: 1100 }

function lintOne(text, lang, label) {
  const problems = []

  for (const b of BANNED) {
    const m = text.match(b.re)
    if (m) problems.push(`금지 표현 — ${b.msg}: "${m[0]}"`)
  }

  for (const r of REQUIRED) {
    if (!r.re.test(text)) problems.push(`필수 항목 — ${r.msg}`)
  }

  const tags = text.match(/#[^\s#]+/g) ?? []
  if (tags.length > MAX_HASHTAGS) {
    problems.push(`해시태그 ${tags.length}개 (상한 ${MAX_HASHTAGS}): ${tags.join(' ')}`)
  }

  if (text.length > MAX_LEN[lang]) {
    problems.push(`캡션 ${text.length}자 (권장 상한 ${MAX_LEN[lang]})`)
  }

  // 훅은 앞 40자 안에 숫자가 있어야 한다 (피드에서 2줄만 노출)
  const hook = text.split('\n')[0] ?? ''
  if (!/\d/.test(hook.slice(0, 40))) {
    problems.push(`훅 앞 40자에 숫자 없음: "${hook.slice(0, 40)}"`)
  }

  return problems
}

async function main() {
  const idx = process.argv.indexOf('--stamp')
  const stamp = idx === -1 ? null : process.argv[idx + 1]
  if (!stamp) {
    console.error('사용법: node scripts/lint-caption.mjs --stamp 2026-08-12-ep01')
    process.exit(1)
  }

  const base = join(ROOT, 'cards', 'backtest', stamp)
  const langs = await readdir(base)
  let failed = 0

  for (const lang of langs) {
    const text = (await readFile(join(base, lang, 'caption.txt'), 'utf8')).replace(/^﻿/, '')
    const problems = lintOne(text, lang, `${stamp}/${lang}`)
    if (problems.length) {
      failed += problems.length
      console.error(`\n  x ${lang}`)
      for (const p of problems) console.error(`      - ${p}`)
    } else {
      console.log(`  ok ${lang}: 통과 (${text.length}자, 해시태그 ${(text.match(/#[^\s#]+/g) ?? []).length}개)`)
    }
  }

  if (failed) {
    console.error(`\n검사 실패 — 위반 ${failed}건. 발행을 중단한다.`)
    process.exit(1)
  }
  console.log('\n캡션 검사 통과.')
}

main().catch((err) => {
  console.error('실패:', err.message)
  process.exit(1)
})
