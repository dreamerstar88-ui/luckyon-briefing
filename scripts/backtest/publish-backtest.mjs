// publish-backtest.mjs
// GitHub Pages 에 올라간 백테스트 릴스 mp4 를 Instagram 릴스로 발행한다.
// scripts/reels/publish-reel.mjs 와 같은 Graph API 경로를 쓰되 두 가지가 다르다.
//   · 경로를 fileURLToPath 로 푼다 (윈도우에서 /C:/... + %20 로 깨지는 문제 회피)
//   · 발행 직전에 캡션 안전장치를 한 번 더 확인한다 (되돌릴 수 없는 작업이므로)
//
// 사용법 (저장소 루트에서):
//   node --env-file="C:/Users/PSJ_1/.secrets/luckyon-ig.env" \
//     scripts/backtest/publish-backtest.mjs <STAMP> [ko|en] [--dry-run]
//
// --env-file 을 쓰는 이유: 값이 셸 히스토리에 남지 않는다. Node 20.6+ 필요.
//
// 필요한 환경변수: IG_ACCESS_TOKEN, IG_USER_ID, PAGES_BASE_URL
//   (선택) GRAPH_VERSION, SKIP_PAGES_WAIT=1  ← 로컬 윈도우에서는 주지 말 것

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const positional = argv.filter((a) => !a.startsWith('--'))
const stamp = positional[0]
const lang = positional[1] || 'ko'

if (!stamp) {
  console.error('사용법: node scripts/backtest/publish-backtest.mjs <STAMP> [ko|en] [--dry-run]')
  process.exit(1)
}

// 윈도우 안전: new URL(...).pathname 은 /C:/... 와 %20 으로 깨진다
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function required(k) {
  const v = process.env[k]
  if (!v) {
    console.error(`환경변수 ${k} 가 없습니다. --env-file 로 주입했는지 확인하세요.`)
    process.exit(1)
  }
  return v
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TOKEN = DRY ? 'dry' : required('IG_ACCESS_TOKEN')
const IG_USER = DRY ? 'dry' : required('IG_USER_ID')
const PAGES = required('PAGES_BASE_URL').replace(/\/$/, '')
const VER = process.env.GRAPH_VERSION || 'v21.0'
const BASE = `https://graph.instagram.com/${VER}`

const relDir = `cards/backtest/${stamp}/${lang}`
const absDir = path.join(root, ...relDir.split('/'))

// 파일 이름에 티커가 붙는다 (reel_qqq_qld_tqqq.mp4). 예전 이름(reel.mp4)도 받아준다.
function pick(prefix, ext, legacy) {
  if (!fs.existsSync(absDir)) return path.join(absDir, legacy)
  const hit = fs
    .readdirSync(absDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort()
  return path.join(absDir, hit[0] ?? legacy)
}

const localMp4 = pick('reel', '.mp4', 'reel.mp4')
const localCover = pick('cover', '.png', 'cover.png')
const captionFile = path.join(absDir, 'caption.txt')

for (const [label, p] of [
  ['영상', localMp4],
  ['커버', localCover],
  ['캡션', captionFile],
]) {
  if (!fs.existsSync(p)) {
    console.error(`${label}이 없습니다: ${path.relative(root, p)}`)
    console.error('먼저 render-backtest-reel.mjs 와 write-caption.mjs 를 실행하세요.')
    process.exit(1)
  }
}

const caption = fs.readFileSync(captionFile, 'utf8').trim()

// ─── 발행 직전 안전장치 ──────────────────────────────────────────
// lint-caption.mjs 를 이미 돌렸더라도, 발행은 되돌릴 수 없으므로 최소한만 다시 본다.
const GUARDS = [
  { re: /(투자 권유가 아닙니다|Not investment advice)/i, msg: '면책 문구가 없습니다' },
  { re: /(보장하지 않습니다|does not guarantee)/i, msg: '과거성과 고지가 없습니다' },
]
const BANNED = [
  { re: /매수\s*(하세요|추천|하시길|권장)/, msg: '매수 권유 표현' },
  { re: /지금\s*(사|매수|들어가)/, msg: '타이밍 권유' },
  { re: /(무조건|반드시)\s*(오|올라|상승|수익)/, msg: '수익 단정' },
  { re: /(보장|확정)(합니다|됩니다|드립니다)/, msg: '수익 보장 표현' },
]
const problems = []
for (const g of GUARDS) if (!g.re.test(caption)) problems.push(g.msg)
for (const b of BANNED) {
  const m = caption.match(b.re)
  if (m) problems.push(`${b.msg}: "${m[0]}"`)
}
const tagCount = (caption.match(/#[^\s#]+/g) ?? []).length
if (tagCount > 5) problems.push(`해시태그 ${tagCount}개 (인스타그램 상한 5개)`)

if (problems.length) {
  console.error('\n캡션 안전장치에 걸렸습니다. 발행을 중단합니다.')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const videoUrl = `${PAGES}/${relDir}/${path.basename(localMp4)}`
const coverUrl = `${PAGES}/${relDir}/${path.basename(localCover)}`

async function api(pathPart, params) {
  const res = await fetch(new URL(`${BASE}/${pathPart}`), {
    method: 'POST',
    body: new URLSearchParams({ ...params, access_token: TOKEN }),
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`API 오류 (${pathPart}): ${JSON.stringify(json.error || json)}`)
  }
  return json
}

async function getStatus(id) {
  const res = await fetch(`${BASE}/${id}?fields=status_code,status&access_token=${TOKEN}`)
  const j = await res.json()
  return { code: j.status_code, detail: j.status }
}

// 영상은 서버 인코딩 때문에 오래 걸린다 (최대 5분)
async function waitFinished(id, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const { code, detail } = await getStatus(id)
    if (code === 'FINISHED') return
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`컨테이너 상태 ${code}${detail ? ` — ${detail}` : ''}`)
    }
    if (i % 5 === 0) process.stdout.write(`  인코딩 대기… ${i * 5}s\r`)
    await sleep(5000)
  }
  throw new Error('영상 컨테이너가 시간 내 FINISHED 되지 않음')
}

async function waitForPages() {
  if (process.env.SKIP_PAGES_WAIT === '1') {
    console.log('· SKIP_PAGES_WAIT=1 → Pages 반영 확인 생략 (로컬에서는 권장하지 않음)')
    return
  }
  console.log('· GitHub Pages 반영 대기…')
  for (const u of [videoUrl, coverUrl]) {
    let ok = false
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch(u, { method: 'HEAD' })).ok) {
          ok = true
          break
        }
      } catch {}
      await sleep(6000)
    }
    if (!ok) throw new Error(`아직 공개되지 않음: ${u}`)
  }
  console.log('· 공개 확인됨')
}

async function main() {
  const sizeMb = (fs.statSync(localMp4).size / 1048576).toFixed(2)
  console.log(`\n▶ 백테스트 릴스 발행 [${lang.toUpperCase()}] ${stamp} (${sizeMb} MB)`)
  console.log(`  video: ${videoUrl}`)
  console.log(`  cover: ${coverUrl}`)
  console.log(`  캡션 ${caption.length}자 · 해시태그 ${tagCount}개`)
  console.log(`\n${caption.split('\n').map((l) => '    ' + l).join('\n')}`)

  if (DRY) {
    console.log('\n· --dry-run: 실제 발행은 하지 않습니다.')
    return
  }

  await waitForPages()

  const c = await api(`${IG_USER}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    cover_url: coverUrl,
    caption,
    share_to_feed: 'true',
  })
  console.log(`· 컨테이너 생성: ${c.id}`)

  await waitFinished(c.id)
  console.log('\n· 인코딩 완료')

  const pub = await api(`${IG_USER}/media_publish`, { creation_id: c.id })
  console.log(`\n발행 완료. media id = ${pub.id}`)
}

main().catch((e) => {
  console.error(`\n발행 실패: ${e.message}`)
  process.exit(1)
})
