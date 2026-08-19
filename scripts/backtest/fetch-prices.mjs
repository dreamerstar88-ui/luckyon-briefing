#!/usr/bin/env node
// 일별 종가 수집 — Yahoo Finance chart API (키 불필요, 배당조정 종가 제공)
// 사용: node scripts/fetch-prices.mjs TQQQ QQQ QLD
//
// 저장: data/prices/<TICKER>.json
//   close    = 분할 반영 종가 (배당 미반영)
//   adjclose = 분할 + 배당 반영 종가  ← 총수익 백테스트는 이 값을 쓴다

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
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
const OUT_DIR = join(ROOT, 'data', 'prices')

// 상장일 — 이보다 앞선 구간은 실제 데이터가 없다. 백테스트에서 경고 근거로 쓴다.
const INCEPTION = {
  QQQ: '1999-03-10',
  QLD: '2006-06-21',
  TQQQ: '2010-02-11',
  SPY: '1993-01-29',
  UPRO: '2009-06-25',
}

const nyDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

async function fetchChart(ticker, attempt = 1) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=0&period2=9999999999&interval=1d&events=div%2Csplit`
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * attempt))
      return fetchChart(ticker, attempt + 1)
    }
    throw new Error(`${ticker}: HTTP ${res.status}`)
  }
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`${ticker}: 응답에 result 없음 — ${JSON.stringify(json).slice(0, 120)}`)
  return result
}

function toRows(result) {
  const ts = result.timestamp ?? []
  const close = result.indicators?.quote?.[0]?.close ?? []
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? []

  const rows = []
  for (let i = 0; i < ts.length; i++) {
    const c = close[i]
    const a = adj[i] ?? c
    // 휴장·결측 구간은 null로 오므로 버린다
    if (!Number.isFinite(c) || !Number.isFinite(a) || c <= 0 || a <= 0) continue
    rows.push({
      date: nyDate.format(new Date(ts[i] * 1000)),
      close: Number(c.toFixed(6)),
      adjclose: Number(a.toFixed(6)),
    })
  }
  rows.sort((x, y) => (x.date < y.date ? -1 : 1))

  // 같은 날짜가 중복되면 마지막 값만 남긴다
  const seen = new Map()
  for (const r of rows) seen.set(r.date, r)
  return [...seen.values()]
}

async function main() {
  const tickers = process.argv.slice(2).map((t) => t.toUpperCase())
  if (!tickers.length) {
    console.error('사용법: node scripts/fetch-prices.mjs TQQQ QQQ QLD')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  for (const ticker of tickers) {
    const result = await fetchChart(ticker)
    const rows = toRows(result)
    if (rows.length < 100) throw new Error(`${ticker}: 데이터가 너무 적다 (${rows.length}행)`)

    const firstTrade = result.meta?.firstTradeDate
      ? nyDate.format(new Date(result.meta.firstTradeDate * 1000))
      : null
    const inception = INCEPTION[ticker] ?? null

    if (inception && firstTrade && firstTrade !== inception) {
      console.warn(`  ! ${ticker}: 상장일 불일치 — 표(${inception}) vs 응답(${firstTrade})`)
    }

    const payload = {
      ticker,
      source: 'Yahoo Finance chart API',
      source_url: `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
      fetched_at: new Date().toISOString(),
      inception: inception,
      first_trade_date: firstTrade,
      currency: result.meta?.currency ?? null,
      adjustment: 'close=분할 반영 / adjclose=분할+배당 반영',
      first: rows[0].date,
      last: rows.at(-1).date,
      count: rows.length,
      rows,
    }

    await writeFile(join(OUT_DIR, `${ticker}.json`), JSON.stringify(payload))
    console.log(
      `  ok ${ticker}: ${rows.length}행  ${rows[0].date} ~ ${rows.at(-1).date}` +
        `  종가 ${rows.at(-1).close} / 조정 ${rows.at(-1).adjclose}`,
    )
  }
}

main().catch((err) => {
  console.error('실패:', err.message)
  process.exit(1)
})
