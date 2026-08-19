#!/usr/bin/env node
// 적립식(DCA) / 일시불(lump) 백테스트
// 사용: node scripts/run-backtest.mjs --tickers TQQQ --amount 1 --stamp 2026-08-12-ep01
//       node scripts/run-backtest.mjs --tickers QQQ --amount 5000 --mode lump --stamp ...
//
// 비교군
//   dca  → 적금 (1년 만기, 만기마다 원리금 재예치 = 연복리)
//   lump → 예금 (연복리)
//
// 가정
//   - 매 거래일 종가 매수, 소수점 주식 허용
//   - adjclose(분할+배당 반영) 사용 → 배당 재투자 가정
//   - 수수료·세금·슬리피지 미반영 (적금 이자소득세도 미반영)

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
const PRICE_DIR = join(ROOT, 'data', 'prices')
const OUT_DIR = join(ROOT, 'content')

const DAY = 86400000

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, '')
    if (k) out[k] = argv[i + 1]
  }
  return out
}

async function loadPrices(ticker) {
  const raw = await readFile(join(PRICE_DIR, `${ticker}.json`), 'utf8')
  const data = JSON.parse(raw)
  if (!data.rows?.length) throw new Error(`${ticker}: 가격 데이터가 비어 있다`)
  return data
}

/**
 * 적금 잔액 시뮬레이션 — 1년 만기 + 만기 원리금 재예치(연복리)
 *
 * 실제 정기적금 구조를 따른다.
 *   · 그 해에 납입한 돈은 "남은 기간만큼만" 이자가 붙는다 (단리 누적)
 *   · 1년이 지나면 원금+이자가 확정되어 예치금으로 넘어간다
 *   · 넘어간 예치금은 그 다음부터 연복리로 굴러간다
 *
 * 매 거래일 일정액을 넣는 우리 조건에 이 규칙을 그대로 적용한 것이다.
 */
function makeSavingsAccount(rate) {
  let pool = 0 // 만기가 지나 연복리로 굴러가는 원리금
  let curr = 0 // 이번 회차 적금에 넣은 원금
  let currInt = 0 // 이번 회차 적금에 붙은 이자 (단리)
  let lastDate = null
  let cycleStart = null

  return {
    /** 하루 경과시키고 deposit 만큼 납입한 뒤 현재 평가액을 돌려준다 */
    step(dateStr, deposit) {
      const t = new Date(dateStr).getTime()
      if (lastDate === null) {
        lastDate = t
        cycleStart = t
      }
      const dt = (t - lastDate) / DAY

      if (dt > 0) {
        // 예치금은 연복리
        pool *= Math.pow(1 + rate, dt / 365)
        // 이번 회차 적금 잔액에는 단리 이자가 일할로 붙는다
        currInt += curr * rate * (dt / 365)
        lastDate = t
      }

      // 만기(1년) 도래 → 원리금을 예치금으로 이월
      while ((t - cycleStart) / DAY >= 365) {
        pool += curr + currInt
        curr = 0
        currInt = 0
        cycleStart += 365 * DAY
      }

      curr += deposit
      return pool + curr + currInt
    },
  }
}

/** 예금 — 목돈을 한 번에 넣고 연복리 */
function makeDepositAccount(rate, principal, startDate) {
  const t0 = new Date(startDate).getTime()
  return {
    valueAt(dateStr) {
      const days = (new Date(dateStr).getTime() - t0) / DAY
      return principal * Math.pow(1 + rate, days / 365)
    },
  }
}

function simulate(rows, amount, rate, mode) {
  const series = []
  let shares = 0
  let invested = 0

  if (mode === 'lump') {
    shares = amount / rows[0].adjclose
    invested = amount
    const acct = makeDepositAccount(rate, amount, rows[0].date)
    for (const r of rows) {
      series.push({
        date: r.date,
        invested,
        value: shares * r.adjclose,
        benchmark: acct.valueAt(r.date),
        price: r.close, // 분할 반영 종가 (화면에 주가로 표시)
      })
    }
    return series
  }

  const acct = makeSavingsAccount(rate)
  for (const r of rows) {
    shares += amount / r.adjclose
    invested += amount
    series.push({
      date: r.date,
      invested,
      value: shares * r.adjclose,
      benchmark: acct.step(r.date, amount),
      price: r.close,
    })
  }
  return series
}

function stats(series) {
  const last = series.at(-1)

  let peak = 0
  let mdd = 0
  let mddDate = null
  let peakDate = null
  let mddPeakDate = null
  let worstVsInvested = Infinity
  let worstVsInvestedDate = null

  for (const p of series) {
    if (p.value > peak) {
      peak = p.value
      peakDate = p.date
    }
    if (peak > 0) {
      const dd = p.value / peak - 1
      if (dd < mdd) {
        mdd = dd
        mddDate = p.date
        mddPeakDate = peakDate
      }
    }
    if (p.invested > 0) {
      const vs = p.value / p.invested - 1
      if (vs < worstVsInvested) {
        worstVsInvested = vs
        worstVsInvestedDate = p.date
      }
    }
  }

  let recoveryDays = null
  if (mddDate) {
    const peakValue = series.find((p) => p.date === mddPeakDate)?.value ?? 0
    const fromIdx = series.findIndex((p) => p.date === mddDate)
    const recIdx = series.findIndex((p, i) => i > fromIdx && p.value >= peakValue)
    recoveryDays = recIdx === -1 ? null : recIdx - fromIdx
  }

  const years = (new Date(last.date) - new Date(series[0].date)) / (365.25 * DAY)
  const irr = annualIrr(series)

  return {
    days: series.length,
    years: Number(years.toFixed(2)),
    invested: Math.round(last.invested),
    final_value: Math.round(last.value),
    benchmark_value: Math.round(last.benchmark),
    vs_benchmark: Math.round(last.value - last.benchmark),
    vs_benchmark_multiple: Number((last.value / last.benchmark).toFixed(2)),
    multiple: Number((last.value / last.invested).toFixed(2)),
    total_return_pct: Number(((last.value / last.invested - 1) * 100).toFixed(1)),
    irr_pct: irr === null ? null : Number((irr * 100).toFixed(1)),
    mdd_pct: Number((mdd * 100).toFixed(1)),
    mdd_date: mddDate,
    mdd_peak_date: mddPeakDate,
    mdd_recovery_days: recoveryDays,
    worst_vs_invested_pct: Number((worstVsInvested * 100).toFixed(1)),
    worst_vs_invested_date: worstVsInvestedDate,
  }
}

// 일별 현금흐름 IRR (이분법)
function annualIrr(series) {
  const n = series.length
  const startMs = new Date(series[0].date).getTime()
  const endMs = new Date(series.at(-1).date).getTime()
  const finalValue = series.at(-1).value
  const perDay = series[0].invested

  const npv = (rate) => {
    let sum = 0
    for (let i = 0; i < n; i++) {
      const t = (new Date(series[i].date).getTime() - startMs) / (365.25 * DAY)
      sum -= perDay / Math.pow(1 + rate, t)
    }
    sum += finalValue / Math.pow(1 + rate, (endMs - startMs) / (365.25 * DAY))
    return sum
  }

  let lo = -0.95
  let hi = 5
  if (npv(lo) * npv(hi) > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(lo) * npv(mid) <= 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

// 일봉을 전량 보존한다 (다운샘플하면 애니메이션이 계단처럼 끊긴다)
function downsample(series, maxPoints = 8000) {
  if (series.length <= maxPoints) return series
  const stepSize = series.length / maxPoints
  const out = []
  for (let i = 0; i < maxPoints; i++) out.push(series[Math.floor(i * stepSize)])
  if (out.at(-1).date !== series.at(-1).date) out.push(series.at(-1))
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const tickers = (args.tickers ?? 'TQQQ').split(',').map((t) => t.trim().toUpperCase())
  const amount = Number(args.amount ?? 1)
  const stamp = args.stamp ?? 'draft'
  const mode = args.mode === 'lump' ? 'lump' : 'dca'
  const rate = Number(args.rate ?? 0.03)

  const label = mode === 'lump'
    ? `예금(연 ${(rate * 100).toFixed(0)}%, 연복리)`
    : `적금(연 ${(rate * 100).toFixed(0)}%, 1년 만기 후 재예치)`

  const loaded = []
  for (const t of tickers) loaded.push(await loadPrices(t))

  const startDate = args.start ?? loaded.map((d) => d.first).sort().at(-1)
  const endDate = args.end ?? loaded.map((d) => d.last).sort()[0]

  const results = []
  for (const data of loaded) {
    const rows = data.rows.filter((r) => r.date >= startDate && r.date <= endDate)
    if (!rows.length) throw new Error(`${data.ticker}: ${startDate}~${endDate} 구간에 데이터가 없다`)

    const series = simulate(rows, amount, rate, mode)
    results.push({
      ticker: data.ticker,
      inception: data.inception,
      synthetic: startDate < (data.inception ?? startDate),
      stats: stats(series),
      series: downsample(series).map((p) => ({
        d: p.date,
        i: Math.round(p.invested),
        v: Math.round(p.value),
        s: Math.round(p.benchmark),
        p: Number(p.price.toFixed(4)),
      })),
    })
  }

  const payload = {
    stamp,
    type: tickers.length > 1 ? 'B-compare' : mode === 'lump' ? 'C-lump' : 'A-dca',
    mode,
    generated_at: new Date().toISOString(),
    rule: {
      amount_per_trading_day: mode === 'dca' ? amount : null,
      lump_amount: mode === 'lump' ? amount : null,
      currency: 'USD',
      start: startDate,
      end: endDate,
      benchmark_kind: mode === 'lump' ? 'deposit' : 'installment',
      benchmark_label: label,
      benchmark_rate: rate,
      assumptions: [
        mode === 'lump' ? '시작일 종가에 전액 매수' : '매 거래일 종가 매수, 소수점 주식 허용',
        '배당 재투자 가정 (adjclose 사용)',
        '수수료·세금·슬리피지 미반영',
        mode === 'lump'
          ? `예금 비교선은 연 ${(rate * 100).toFixed(0)}% 연복리`
          : `적금 비교선은 연 ${(rate * 100).toFixed(0)}%, 1년 만기 시 원리금을 재예치해 연복리로 굴린 값 (이자소득세 미반영)`,
      ],
    },
    data_source: { name: loaded[0].source, fetched_at: loaded[0].fetched_at },
    results,
  }

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, `${stamp}.json`)
  await writeFile(outPath, JSON.stringify(payload, null, 2))

  console.log(
    `\n조건: ${mode === 'lump' ? `일시불 $${amount}` : `매 거래일 $${amount}`}` +
      `  |  ${startDate} ~ ${endDate}  |  비교군: ${label}\n`,
  )
  for (const r of results) {
    const s = r.stats
    console.log(
      `  ${r.ticker.padEnd(5)} 투입 $${s.invested.toLocaleString()}` +
        ` → 평가 $${s.final_value.toLocaleString()}  (${s.multiple}배, IRR ${s.irr_pct}%)`,
    )
    console.log(
      `        ${mode === 'lump' ? '예금' : '적금'}이었다면 $${s.benchmark_value.toLocaleString()}` +
        `  →  ${s.vs_benchmark >= 0 ? '+' : ''}$${s.vs_benchmark.toLocaleString()} (${s.vs_benchmark_multiple}배)`,
    )
    console.log(
      `        MDD ${s.mdd_pct}% (${s.mdd_peak_date}→${s.mdd_date})` +
        `  회복 ${s.mdd_recovery_days ?? '미회복'}거래일`,
    )
  }
  console.log(`\n저장: ${outPath}`)
}

main().catch((err) => {
  console.error('실패:', err.message)
  process.exit(1)
})
