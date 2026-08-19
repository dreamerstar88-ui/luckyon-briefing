#!/usr/bin/env node
// 백테스트 릴스 렌더러 v3 — 시안 B(스위스 그리드) 확정판
// 사용: node scripts/render-backtest-reel.mjs --stamp 2026-08-12-ep01 --lang ko
//
// v2 대비 변경
//   · 서식을 스위스 그리드(오프화이트 + 벽돌색)로 교체, 서체는 Pretendard 단일 계열
//   · 일봉 4,149개 전량 사용 + 선단 소수점 보간  → 계단 현상 제거
//   · 도입부 재구성: 제목 → 1초 뒤 조건 순차 등장 → 3.4초 유지
//   · 장면 전환 크로스페이드
//   · 27.6초 → 61.5초
//   · 마지막에 요약표 + 원화 환산

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
// 시스템 PATH가 아니라 번들된 ffmpeg를 쓴다 (기존 scripts/reels/render-reel.mjs와 같은 방식)
import ffmpegPath from 'ffmpeg-static'

const execFileAsync = promisify(execFile)
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

const W = 1080
const H = 1920
const FPS = 30

// ─── 시안 B: 스위스 그리드 ───────────────────────────────────────
const T = {
  bg: '#f3f1ec',
  panel: '#e8e5de',
  text: '#15171b',
  muted: '#6a6a64',
  dim: '#9c998f',
  grid: '#dcd8cf',
  line: '#c8402f',
  fillTop: 'rgba(200,64,47,0.13)',
  up: '#c8402f',
  down: '#1f4fd8',
  invested: '#a9a69d',
  savings: '#1f4fd8',
  rule: '#15171b',
}

const F = join(ROOT, 'assets', 'fonts')
GlobalFonts.registerFromPath(join(F, 'Pretendard-Regular.otf'), 'PD')
GlobalFonts.registerFromPath(join(F, 'Pretendard-Medium.otf'), 'PDM')
GlobalFonts.registerFromPath(join(F, 'Pretendard-SemiBold.otf'), 'PDS')
GlobalFonts.registerFromPath(join(F, 'Pretendard-Bold.otf'), 'PDB')
GlobalFonts.registerFromPath(join(F, 'Pretendard-ExtraBold.otf'), 'PDX')

const r = (px) => `${px}px PD`
const m = (px) => `${px}px PDM`
const sb = (px) => `${px}px PDS`
const b = (px) => `${px}px PDB`
const x = (px) => `${px}px PDX`

// ─── 타임라인 ────────────────────────────────────────────────────
const INTRO = [0.0, 7.6]
const CHART = [7.6, 52.0]
const SUMM = [52.0, 61.5]
const FADE = 0.7

const CHART_DRAW_END = 44.5 // 차트가 다 그려지는 시점
const RESULT_AT = 44.5
const TWIST_AT = 48.5

const DURATION = SUMM[1]
const TOTAL_FRAMES = Math.round(DURATION * FPS)

const clamp01 = (t) => Math.max(0, Math.min(1, t))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// ─── 템포 가변 ───────────────────────────────────────────────────
// 구간마다 "머무는 시간"에 가중치를 주고, 그 누적분포를 뒤집어
// 재생시간 → 데이터 위치로 매핑한다. 총 길이는 그대로 두고 밀도만 재배분한다.
const TEMPO = {
  head: 3.0, // 시작 구간 (원금이 쌓이는 과정)
  tail: 3.0, // 마지막 구간
  event: 3.5, // 사건 전후
  high: 1.6, // 신고가 갱신일
  base: 1.0,
}

function buildTempo(series, events) {
  const n = series.length
  const w = new Array(n).fill(TEMPO.base)

  const headN = Math.floor(n * 0.06)
  for (let i = 0; i < headN; i++) w[i] = TEMPO.head
  const tailN = Math.floor(n * 0.08)
  for (let i = n - tailN; i < n; i++) w[i] = TEMPO.tail

  // 신고가 갱신 지점
  let peak = 0
  for (let i = 0; i < n; i++) {
    if (series[i].v > peak) {
      peak = series[i].v
      w[i] = Math.max(w[i], TEMPO.high)
    }
  }

  // 사건 전후 ±40거래일
  for (const ev of events) {
    const idx = series.findIndex((p) => p.d >= ev.date)
    if (idx === -1) continue
    for (let i = Math.max(0, idx - 40); i < Math.min(n, idx + 40); i++) {
      w[i] = Math.max(w[i], TEMPO.event)
    }
  }

  const cdf = new Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += w[i]
    cdf[i] = sum
  }
  for (let i = 0; i < n; i++) cdf[i] /= sum
  return cdf
}

/** 진행률 u(0~1) → 데이터 위치(소수점 포함) */
function posFromTempo(cdf, u) {
  const t = clamp01(u)
  let lo = 0
  let hi = cdf.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cdf[mid] < t) lo = mid + 1
    else hi = mid
  }
  const prev = lo > 0 ? cdf[lo - 1] : 0
  const span = cdf[lo] - prev
  const frac = span > 0 ? (t - prev) / span : 0
  return Math.max(0, Math.min(cdf.length - 1, lo - 1 + frac))
}

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US')
const usdShort = (n) => (n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + Math.round(n))

function krw(amount, rate) {
  const won = amount * rate
  const eok = Math.floor(won / 1e8)
  const man = Math.floor((won % 1e8) / 1e4)
  return eok > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${man.toLocaleString('ko-KR')}만원`
}

function fit(ctx, text, font, maxW) {
  ctx.font = font
  const w = ctx.measureText(text).width
  if (w <= maxW) return font
  return font.replace(/^\d+/, String(Math.floor(parseInt(font, 10) * (maxW / w))))
}
function ctr(ctx, text, y, font, color, maxW = W - 144) {
  ctx.font = fit(ctx, text, font, maxW)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, W / 2, y)
}

function runningHead(ctx, label) {
  ctx.textAlign = 'left'
  ctx.font = sb(26)
  ctx.fillStyle = T.line
  ctx.fillText(label, 72, 118)
  ctx.strokeStyle = T.rule
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(72, 146)
  ctx.lineTo(W - 72, 146)
  ctx.stroke()
}

function footer(ctx) {
  ctx.textAlign = 'center'
  ctx.font = r(23)
  ctx.fillStyle = T.dim
  ctx.fillText(
    '과거 데이터 기반 시뮬레이션 · 주가는 분할 반영 종가 · 수수료·세금 미반영 · 투자 권유가 아닙니다',
    W / 2,
    H - 66,
  )
}

// ─── 씬 1: 도입 ──────────────────────────────────────────────────
function drawIntro(ctx, sec, D) {
  const { rule, res, bmShort, bmRate } = D
  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, W, H)
  runningHead(ctx, 'BACKTEST  /  EP.01')

  // 0.0~1.0 제목
  const tp = easeOutCubic(clamp01(sec / 1.0))
  ctx.save()
  ctx.globalAlpha = tp
  ctx.textAlign = 'left'
  ctx.font = x(116)
  ctx.fillStyle = T.text
  ctx.fillText(`매일 $${rule.amount_per_trading_day}씩`, 72, 400 + (1 - tp) * 24)
  ctx.fillStyle = T.line
  ctx.fillText(`${res.ticker}를 샀다면?`, 72, 530 + (1 - tp) * 24)
  ctx.font = m(34)
  ctx.fillStyle = T.muted
  ctx.fillText(`${rule.start}  —  ${rule.end}   ·   ${res.stats.years}년`, 72, 600)
  ctx.restore()

  // 1.0~4.2 조건 4줄 순차
  const lines = [
    `매 거래일 종가에 $${rule.amount_per_trading_day}`,
    '배당은 재투자',
    '수수료·세금은 제외',
    `${bmShort}(연 ${bmRate}%)과 비교`,
  ]
  lines.forEach((t, i) => {
    const a = easeOutCubic(clamp01((sec - (1.0 + i * 0.8)) / 0.55))
    if (a <= 0) return
    const y = 860 + i * 132
    ctx.save()
    ctx.globalAlpha = a
    ctx.textAlign = 'left'
    ctx.font = x(50)
    ctx.fillStyle = T.dim
    ctx.fillText(String(i + 1).padStart(2, '0'), 72 + (1 - a) * 18, y)
    ctx.font = m(48)
    ctx.fillStyle = T.text
    ctx.fillText(t, 175 + (1 - a) * 18, y)
    ctx.strokeStyle = T.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(72, y + 42)
    ctx.lineTo(W - 72, y + 42)
    ctx.stroke()
    ctx.restore()
  })

  // 4.4~ 티저
  const ta = easeOutCubic(clamp01((sec - 4.4) / 0.6))
  if (ta > 0) {
    ctx.save()
    ctx.globalAlpha = ta
    ctx.textAlign = 'left'
    ctx.font = x(64)
    ctx.fillStyle = T.line
    ctx.fillText('결과는 6자리였습니다', 72, 1560)
    ctx.font = m(34)
    ctx.fillStyle = T.muted
    ctx.fillText('16년 5개월치를 한 번에 돌려봤습니다', 72, 1620)
    ctx.restore()
  }

  footer(ctx)
}

// ─── 씬 2: 차트 ──────────────────────────────────────────────────
const PLOT = { x: 152, y: 700, w: 856, h: 640 }
// 주가는 선으로 그리지 않고 수치로만 보여준다.
// (비교 회차에서 종목이 2~3개가 되면 선이 너무 많아져 집중도가 떨어진다)
const PRICE_COLOR = '#7d8fa8'

function drawChartScene(ctx, sec, D) {
  const { rule, res, events, bmShort } = D
  const series = res.series
  const s = res.stats

  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, W, H)

  // 진행도 — 템포 가중치로 위치를 정하고, 선단은 소수점까지 보간한다
  const raw = clamp01((sec - CHART[0]) / (CHART_DRAW_END - CHART[0]))
  const fpos = posFromTempo(D.cdf, raw)
  const i0 = Math.max(1, Math.floor(fpos))
  const frac = fpos - i0
  const a0 = series[i0]
  const a1 = series[Math.min(i0 + 1, series.length - 1)]
  const head = {
    d: a1.d,
    i: a0.i + (a1.i - a0.i) * frac,
    v: a0.v + (a1.v - a0.v) * frac,
    s: a0.s + (a1.s - a0.s) * frac,
    p: a0.p + (a1.p - a0.p) * frac,
  }

  // 헤더
  ctx.textAlign = 'left'
  ctx.font = sb(26)
  ctx.fillStyle = T.line
  ctx.fillText('BACKTEST  /  EP.01', 72, 112)
  ctx.font = b(54)
  ctx.fillStyle = T.text
  ctx.fillText(`${res.ticker} 적립식`, 72, 186)
  ctx.font = m(30)
  ctx.fillStyle = T.muted
  ctx.fillText(`매 거래일 $${rule.amount_per_trading_day} · 배당 재투자`, 72, 236)

  ctx.textAlign = 'right'
  ctx.font = b(46)
  ctx.fillStyle = T.text
  ctx.fillText(head.d, W - 72, 186)
  ctx.font = m(28)
  ctx.fillStyle = T.muted
  const yrs = (new Date(head.d) - new Date(series[0].d)) / (365.25 * 864e5)
  ctx.fillText(`${yrs.toFixed(1)}년차`, W - 72, 236)

  ctx.strokeStyle = T.rule
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(72, 272)
  ctx.lineTo(W - 72, 272)
  ctx.stroke()

  // KPI — 좌측 3단 (주가 → 투입 원금 → 비교군)
  ctx.textAlign = 'left'
  ctx.font = m(26)
  ctx.fillStyle = T.muted
  ctx.fillText(`${res.ticker} 주가`, 72, 338)
  ctx.font = b(46)
  ctx.fillStyle = PRICE_COLOR
  ctx.fillText('$' + head.p.toFixed(2), 72, 390)

  ctx.font = m(26)
  ctx.fillStyle = T.muted
  ctx.fillText('투입 원금', 72, 450)
  ctx.font = b(46)
  ctx.fillStyle = T.invested
  ctx.fillText(usd(head.i), 72, 502)

  ctx.font = m(26)
  ctx.fillStyle = T.muted
  ctx.fillText(`${bmShort}이라면`, 72, 562)
  ctx.font = b(46)
  ctx.fillStyle = T.savings
  ctx.fillText(usd(head.s), 72, 614)

  ctx.textAlign = 'right'
  ctx.font = m(30)
  ctx.fillStyle = T.muted
  ctx.fillText('평가액', W - 72, 357)
  ctx.font = x(104)
  ctx.fillStyle = T.text
  ctx.fillText(usd(head.v), W - 72, 457)
  ctx.font = sb(34)
  ctx.fillStyle = T.line
  ctx.fillText(`원금의 ${(head.v / Math.max(1, head.i)).toFixed(1)}배`, W - 72, 525)

  // ── 차트 본체
  const upto = series.slice(0, i0 + 1)
  const maxV = Math.max(head.v, head.i, head.s, ...upto.map((q) => q.v))
  const yMax = maxV * 1.16
  const px = (i) => PLOT.x + (i / (series.length - 1)) * PLOT.w
  const py = (v) => PLOT.y + PLOT.h - (v / yMax) * PLOT.h

  const step = yMax > 150000 ? 50000 : yMax > 60000 ? 25000 : yMax > 20000 ? 10000 : 5000
  ctx.textAlign = 'right'
  ctx.font = r(23)
  for (let v = 0; v <= yMax; v += step) {
    const y = py(v)
    if (y < PLOT.y - 6) break
    ctx.strokeStyle = v === 0 ? T.dim : T.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PLOT.x, y)
    ctx.lineTo(PLOT.x + PLOT.w, y)
    ctx.stroke()
    ctx.fillStyle = T.dim
    ctx.fillText(usdShort(v), PLOT.x - 16, y + 8)
  }

  ctx.textAlign = 'center'
  for (let yr = 2010; yr <= 2026; yr += 4) {
    const idx = series.findIndex((q) => Number(q.d.slice(0, 4)) >= yr)
    if (idx === -1) continue
    ctx.fillStyle = T.dim
    ctx.font = r(23)
    ctx.fillText(String(yr), px(idx), PLOT.y + PLOT.h + 40)
  }

  const pathTo = (key, headVal) => {
    ctx.beginPath()
    for (let i = 0; i <= i0; i++) {
      const X = px(i)
      const Y = py(series[i][key])
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
    }
    ctx.lineTo(px(fpos), py(headVal))
  }

  // 채움
  const g = ctx.createLinearGradient(0, PLOT.y, 0, PLOT.y + PLOT.h)
  g.addColorStop(0, T.fillTop)
  g.addColorStop(1, 'rgba(200,64,47,0)')
  ctx.beginPath()
  ctx.moveTo(px(0), PLOT.y + PLOT.h)
  for (let i = 0; i <= i0; i++) ctx.lineTo(px(i), py(series[i].v))
  ctx.lineTo(px(fpos), py(head.v))
  ctx.lineTo(px(fpos), PLOT.y + PLOT.h)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  ctx.save()
  ctx.setLineDash([9, 7])
  pathTo('s', head.s)
  ctx.strokeStyle = T.savings
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()

  pathTo('i', head.i)
  ctx.strokeStyle = T.invested
  ctx.lineWidth = 2.5
  ctx.stroke()

  pathTo('v', head.v)
  ctx.strokeStyle = T.line
  ctx.lineWidth = 4.5
  ctx.lineJoin = 'round'
  ctx.stroke()

  // 사건 마커
  let prevX = -1e9
  let lane = 0
  for (const ev of events) {
    const idx = series.findIndex((q) => q.d >= ev.date)
    if (idx === -1 || idx > i0) continue
    const ex = px(idx)
    lane = ex - prevX < 100 ? (lane + 1) % 3 : 0
    prevX = ex
    ctx.save()
    ctx.setLineDash([4, 7])
    ctx.strokeStyle = T.dim
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ex, PLOT.y)
    ctx.lineTo(ex, PLOT.y + PLOT.h)
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.arc(ex, py(series[idx].v), 5.5, 0, Math.PI * 2)
    ctx.fillStyle = ev.kind === 'rally' ? T.line : T.savings
    ctx.fill()
    // 라벨 — 선 위에 겹쳐도 읽히도록 배경 칩을 깐다
    ctx.save()
    ctx.translate(ex + 9, PLOT.y + 14 + lane * 230)
    ctx.rotate(Math.PI / 2)
    ctx.font = m(22)
    ctx.textAlign = 'left'
    const lw = ctx.measureText(ev.label).width
    ctx.globalAlpha = 0.92
    ctx.fillStyle = T.bg
    ctx.fillRect(-6, -19, lw + 12, 26)
    ctx.globalAlpha = 1
    ctx.fillStyle = T.muted
    ctx.fillText(ev.label, 0, 0)
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(px(fpos), py(head.v), 8, 0, Math.PI * 2)
  ctx.fillStyle = T.line
  ctx.fill()

  // 범례
  const ly = PLOT.y + PLOT.h + 96
  ctx.textAlign = 'left'
  ctx.font = m(24)
  ctx.fillStyle = T.line
  ctx.fillText('— 평가액', PLOT.x, ly)
  ctx.fillStyle = T.invested
  ctx.fillText('— 투입 원금', PLOT.x + 170, ly)
  ctx.fillStyle = T.savings
  ctx.fillText(`--- ${bmShort}`, PLOT.x + 380, ly)

  // ── 하단 블록: 진행배수 → 결과 → 반전 (크로스디졸브)
  const aRun = 1 - clamp01((sec - RESULT_AT) / 0.5)
  const aRes = clamp01((sec - RESULT_AT) / 0.5) * (1 - clamp01((sec - TWIST_AT) / 0.5))
  const aTwi = clamp01((sec - TWIST_AT) / 0.5)

  if (aRun > 0) {
    ctx.save()
    ctx.globalAlpha = aRun
    ctr(ctx, `${(head.v / Math.max(1, head.i)).toFixed(1)}배`, 1660, x(148), T.line)
    ctr(ctx, '원금 대비', 1712, m(34), T.muted)
    ctx.restore()
  }
  if (aRes > 0) {
    ctx.save()
    ctx.globalAlpha = aRes
    ctr(ctx, `${s.multiple}배`, 1655, x(168), T.line)
    ctr(ctx, `연환산 ${s.irr_pct}% · ${bmShort}보다 ${usd(s.vs_benchmark)} 더`, 1715, m(38), T.text)
    ctx.restore()
  }
  if (aTwi > 0) {
    ctx.save()
    ctx.globalAlpha = aTwi
    ctr(ctx, '다만, 이걸 견뎌야 했습니다', 1520, m(38), T.muted)
    ctr(ctx, `${s.mdd_pct}%`, 1660, x(168), T.savings)
    ctr(ctx, `${s.mdd_peak_date} → ${s.mdd_date} · 회복까지 ${s.mdd_recovery_days}거래일`, 1716, m(32), T.muted)
    ctx.restore()
  }

  footer(ctx)
}

// ─── 씬 3: 요약 ──────────────────────────────────────────────────
function drawSummary(ctx, sec, D) {
  const { res, fx, bmShort, bmRate } = D
  const s = res.stats
  const t = sec - SUMM[0]

  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, W, H)
  runningHead(ctx, '결과 요약')

  ctx.textAlign = 'left'
  ctx.font = m(34)
  ctx.fillStyle = T.muted
  ctx.fillText(`${s.years}년 뒤`, 72, 290)

  ctx.font = b(68)
  ctx.fillStyle = T.invested
  ctx.fillText(usd(s.invested), 72, 388)
  ctx.font = m(42)
  ctx.fillStyle = T.muted
  ctx.fillText('▼', 72, 452)

  const ha = easeOutCubic(clamp01(t / 0.8))
  ctx.save()
  ctx.globalAlpha = ha
  ctx.font = x(124)
  ctx.fillStyle = T.line
  ctx.fillText(usd(s.final_value), 72, 572 + (1 - ha) * 16)
  ctx.restore()

  // 원화 환산 — 영상 통틀어 여기 한 번만
  const ka = easeOutCubic(clamp01((t - 0.6) / 0.7))
  if (ka > 0) {
    ctx.save()
    ctx.globalAlpha = ka
    ctx.font = sb(42)
    ctx.fillStyle = T.text
    ctx.fillText(`≈ ${krw(s.final_value, fx)}`, 72, 638)
    ctx.font = r(24)
    ctx.fillStyle = T.dim
    ctx.fillText(`환율 ${fx.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원 기준`, 72, 678)
    ctx.restore()
  }

  // 요약표 — 행 순차 등장
  const rows = [
    ['수익 배수', `${s.multiple}배`, T.line],
    ['연환산 수익률', `${s.irr_pct}%`, T.text],
    [`${bmShort}(연 ${bmRate}%)이었다면`, usd(s.benchmark_value), T.savings],
    [`${bmShort} 대비 차이`, `+${usd(s.vs_benchmark)}`, T.line],
    ['최대 낙폭', `${s.mdd_pct}%`, T.savings],
    ['고점 회복 기간', `${s.mdd_recovery_days}거래일`, T.text],
  ]
  const top = 780
  const pa = easeOutCubic(clamp01((t - 1.0) / 0.5))
  if (pa > 0) {
    ctx.save()
    ctx.globalAlpha = pa
    ctx.fillStyle = T.panel
    ctx.fillRect(72, top, W - 144, rows.length * 92 + 30)
    ctx.restore()
  }
  rows.forEach(([k, v, color], i) => {
    const a = easeOutCubic(clamp01((t - (1.2 + i * 0.18)) / 0.4))
    if (a <= 0) return
    const y = top + 68 + i * 92
    ctx.save()
    ctx.globalAlpha = a
    ctx.textAlign = 'left'
    ctx.font = m(34)
    ctx.fillStyle = T.muted
    ctx.fillText(k, 112, y)
    ctx.textAlign = 'right'
    ctx.font = b(46)
    ctx.fillStyle = color
    ctx.fillText(v, W - 112, y)
    if (i < rows.length - 1) {
      ctx.strokeStyle = T.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(112, y + 30)
      ctx.lineTo(W - 112, y + 30)
      ctx.stroke()
    }
    ctx.restore()
  })

  // 강조 문구 — Pretendard ExtraBold (본문과 같은 계열, 굵기로 위계)
  const qa = easeOutCubic(clamp01((t - 2.6) / 0.6))
  if (qa > 0) {
    ctx.save()
    ctx.globalAlpha = qa
    ctr(ctx, `${s.multiple}배를 벌려면 ${s.mdd_pct}%를 견뎌야 했습니다`, 1548, x(52), T.text)
    ctx.restore()
  }

  const ca = easeOutCubic(clamp01((t - 3.4) / 0.6))
  if (ca > 0) {
    ctx.save()
    ctx.globalAlpha = ca
    ctr(ctx, '다음엔 어떤 종목으로 돌려볼까요?', 1680, sb(46), T.text)
    ctr(ctx, '댓글에 남겨주세요', 1735, m(34), T.muted)
    ctx.restore()
  }

  footer(ctx)
}

// ─── 메인 ────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  const arg = (k, d) => {
    const i = argv.indexOf(`--${k}`)
    return i === -1 ? d : argv[i + 1]
  }
  const stamp = arg('stamp')
  const lang = arg('lang', 'ko')
  if (!stamp) {
    console.error('사용법: node scripts/render-backtest-reel.mjs --stamp 2026-08-12-ep01')
    process.exit(1)
  }

  const data = JSON.parse(await readFile(join(ROOT, 'content', `${stamp}.json`), 'utf8'))
  const evRaw = JSON.parse(await readFile(join(ROOT, 'data', 'backtest-events.json'), 'utf8'))
  const fxRaw = JSON.parse(await readFile(join(ROOT, 'data', 'prices', 'KRW=X.json'), 'utf8'))

  const events = evRaw.events
    .filter((e) => e.date >= data.rule.start && e.date <= data.rule.end)
    .sort((a, c) => (a.date < c.date ? -1 : 1))

  const D = {
    rule: data.rule,
    res: data.results[0],
    fx: fxRaw.rows.at(-1).close,
    events,
    // 비교군 표기 — 적립식이면 적금, 일시불이면 예금
    bmShort: data.rule.benchmark_kind === 'deposit' ? '예금' : '적금',
    bmRate: (data.rule.benchmark_rate * 100).toFixed(0),
    cdf: buildTempo(data.results[0].series, events),
  }

  const outDir = join(ROOT, 'cards', 'backtest', stamp, lang)
  const frameDir = join(ROOT, '.frames', stamp)
  await rm(frameDir, { recursive: true, force: true })
  await mkdir(frameDir, { recursive: true })
  await mkdir(outDir, { recursive: true })

  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cvA = createCanvas(W, H)
  const ctxA = cvA.getContext('2d')
  const cvB = createCanvas(W, H)
  const ctxB = cvB.getContext('2d')

  console.log(`데이터 ${D.res.series.length}점 · 사건 ${D.events.length}개 · ${DURATION}초 ${TOTAL_FRAMES}프레임`)

  let coverBuf = null
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const sec = f / FPS

    if (sec < CHART[0]) {
      drawIntro(ctx, sec, D)
    } else if (sec < CHART[0] + FADE) {
      drawIntro(ctxA, CHART[0], D)
      drawChartScene(ctxB, sec, D)
      ctx.globalAlpha = 1
      ctx.drawImage(cvA, 0, 0)
      ctx.globalAlpha = easeInOut((sec - CHART[0]) / FADE)
      ctx.drawImage(cvB, 0, 0)
      ctx.globalAlpha = 1
    } else if (sec < SUMM[0]) {
      drawChartScene(ctx, sec, D)
    } else if (sec < SUMM[0] + FADE) {
      drawChartScene(ctxA, SUMM[0], D)
      drawSummary(ctxB, sec, D)
      ctx.globalAlpha = 1
      ctx.drawImage(cvA, 0, 0)
      ctx.globalAlpha = easeInOut((sec - SUMM[0]) / FADE)
      ctx.drawImage(cvB, 0, 0)
      ctx.globalAlpha = 1
    } else {
      drawSummary(ctx, sec, D)
    }

    const buf = cv.toBuffer('image/png')
    await writeFile(join(frameDir, `f${String(f).padStart(5, '0')}.png`), buf)
    if (!coverBuf && sec >= SUMM[0] + 3.6) coverBuf = buf
    if (f % 200 === 0) process.stdout.write(`  ${f}/${TOTAL_FRAMES}\r`)
  }
  await writeFile(join(outDir, 'cover.png'), coverBuf)
  console.log(`  ${TOTAL_FRAMES}/${TOTAL_FRAMES} 완료`)

  const mp4 = join(outDir, 'reel.mp4')
  console.log('ffmpeg 인코딩...')
  await execFileAsync(ffmpegPath, [
    '-y', '-framerate', String(FPS),
    '-i', join(frameDir, 'f%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    '-preset', 'medium', '-movflags', '+faststart', mp4,
  ])

  // 세션에서 바로 보기 위한 GIF 미리보기
  const gifPal = join(frameDir, 'pal.png')
  const gif = join(outDir, 'preview.gif')
  await execFileAsync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', mp4,
    '-vf', 'fps=10,scale=324:-1:flags=lanczos,palettegen=max_colors=128', gifPal])
  await execFileAsync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', mp4, '-i', gifPal,
    '-lavfi', 'fps=10,scale=324:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=3', gif])

  await rm(frameDir, { recursive: true, force: true })
  console.log(`\n완성: ${mp4}\n미리보기: ${gif}`)
}

main().catch((err) => {
  console.error('실패:', err.message)
  process.exit(1)
})
