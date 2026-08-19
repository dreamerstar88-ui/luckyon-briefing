#!/usr/bin/env node
// 캡션·대체텍스트 생성 — 기획안 §7 규격
// 사용: node scripts/write-caption.mjs --stamp 2026-08-12-ep01
//
// 출력: cards/backtest/<stamp>/{ko,en}/caption.txt , alt.txt
// 숫자는 전부 content/<stamp>.json 에서 읽는다. 손으로 적지 않는다.

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

const DISCLAIMER = {
  ko: '과거 데이터 기반 시뮬레이션이며 수수료·세금은 반영하지 않았습니다. 과거 성과가 미래 수익을 보장하지 않습니다. 투자 권유가 아닙니다.',
  en: 'Simulation based on historical data; fees and taxes are not reflected. Past performance does not guarantee future results. Not investment advice.',
}

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US')

// 원화 환산은 한국어판 최종 결과에만 붙인다 (현재 환율 기준 근사치)
function krw(amount, rate) {
  const won = amount * rate
  const eok = Math.floor(won / 1e8)
  const man = Math.floor((won % 1e8) / 1e4)
  return eok > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${man.toLocaleString('ko-KR')}만원`
}

function hashtags(lang, tickers) {
  const fixed = lang === 'ko' ? ['#luckyon', '#백테스트'] : ['#luckyon', '#backtest']
  const variable =
    lang === 'ko'
      ? [`#${tickers[0]}`, '#적립식투자', '#미국주식']
      : [`#${tickers[0]}`, '#dollarcostaveraging', '#ETF']
  return [...fixed, ...variable].slice(0, 5).join(' ') // 인스타그램 상한 5개
}

// 유형 A — 단일 종목 적립식
function captionA(data, lang) {
  const r = data.results[0]
  const s = r.stats
  const amt = data.rule.amount_per_trading_day

  const rate = (data.rule.benchmark_rate * 100).toFixed(0)
  const bm = data.rule.benchmark_kind === 'deposit' ? '예금' : '적금'

  if (lang === 'ko') {
    return [
      `매일 $${amt}씩 ${s.years}년. ${bm}이면 ${usd(s.benchmark_value)}, ${r.ticker}는 ${usd(s.final_value)}이 됐습니다.`,
      '',
      `${r.ticker} 적립식(DCA) 백테스트 결과입니다. ${r.inception} 상장일부터 매 거래일 종가에 ${amt}달러씩 사 모았을 때의 누적 평가액과 최대낙폭을, 같은 돈을 연 ${rate}% ${bm}(1년 만기 후 재예치)에 넣었을 경우와 나란히 계산했습니다.`,
      `배당은 재투자한 것으로 가정했습니다.`,
      '',
      `기간 ${data.rule.start} ~ ${data.rule.end}`,
      `투입 ${usd(s.invested)} → 평가 ${usd(s.final_value)} (${s.multiple}배, 연환산 ${s.irr_pct}%)`,
      data.fx ? `원화로는 약 ${krw(s.final_value, data.fx)} (환율 ${Math.round(data.fx).toLocaleString('ko-KR')}원 기준)` : null,
      `같은 돈을 ${bm}에 넣었다면 ${usd(s.benchmark_value)} — 차이 ${usd(s.vs_benchmark)}`,
      `최대낙폭 ${s.mdd_pct}% (${s.mdd_peak_date} → ${s.mdd_date}), 고점 회복까지 ${s.mdd_recovery_days ?? '미회복'}거래일`,
      '',
      DISCLAIMER.ko,
      '',
      '다음엔 어떤 종목으로 돌려볼까요? 댓글에 남겨주세요.',
      '',
      hashtags('ko', [r.ticker]),
    ]
      .filter((line) => line !== null)
      .join('\n')
  }

  return [
    `$${amt} a day for ${s.years} years: ${usd(s.benchmark_value)} in a savings plan, ${usd(s.final_value)} in ${r.ticker}.`,
    '',
    `A dollar-cost-averaging backtest on ${r.ticker}. Starting from its ${r.inception} inception, we bought ${amt} dollar at every trading day's close and tracked the portfolio value and maximum drawdown.`,
    `Dividends are assumed reinvested.`,
    '',
    `Period ${data.rule.start} to ${data.rule.end}`,
    `Invested ${usd(s.invested)} → Value ${usd(s.final_value)} (${s.multiple}x, ${s.irr_pct}% annualized)`,
    `The same money in a ${rate}% recurring savings plan (rolled over yearly): ${usd(s.benchmark_value)} — a ${usd(s.vs_benchmark)} gap`,
    `Max drawdown ${s.mdd_pct}% (${s.mdd_peak_date} → ${s.mdd_date}), ${s.mdd_recovery_days ?? 'not yet'} trading days to recover`,
    '',
    DISCLAIMER.en,
    '',
    'Which ticker should we run next? Drop it in the comments.',
    '',
    hashtags('en', [r.ticker]),
  ].join('\n')
}

// 유형 B — 다중 비교
function captionB(data, lang) {
  const base = data.results[0]
  const top = data.results.reduce((a, b) => (b.stats.multiple > a.stats.multiple ? b : a))
  const edge = (top.stats.multiple / base.stats.multiple).toFixed(1)
  const list = data.results
    .map((r) => `${r.ticker} ${r.stats.multiple}배 (최대낙폭 ${r.stats.mdd_pct}%)`)
    .join(' · ')
  const listEn = data.results
    .map((r) => `${r.ticker} ${r.stats.multiple}x (max DD ${r.stats.mdd_pct}%)`)
    .join(' · ')

  if (lang === 'ko') {
    return [
      `1배·2배·3배를 같은 조건으로 돌렸습니다. ${top.ticker}는 ${base.ticker}의 ${edge}배를 벌었습니다.`,
      '',
      `레버리지 ETF 적립식 백테스트 비교입니다. 세 종목 모두 ${data.rule.start}부터 매 거래일 $${data.rule.amount_per_trading_day}씩 동일하게 매수했습니다.`,
      `다만 이 구간은 금융위기 직후에 시작해 레버리지에 유리한 출발점이라는 점을 함께 봐야 합니다.`,
      '',
      list,
      `투입은 셋 다 ${usd(base.stats.invested)}로 같습니다.`,
      '',
      DISCLAIMER.ko,
      '',
      '저장해두고 비교해보세요.',
      '',
      hashtags('ko', ['레버리지ETF']),
    ].join('\n')
  }

  return [
    `1x vs 2x vs 3x, same rule. ${top.ticker} returned ${edge}x what ${base.ticker} did.`,
    '',
    `A leveraged-ETF dollar-cost-averaging comparison. All three bought $${data.rule.amount_per_trading_day} at every trading day's close from ${data.rule.start}.`,
    `Note the starting point sits right after the financial crisis, which favors leverage.`,
    '',
    listEn,
    `Contributions are identical at ${usd(base.stats.invested)}.`,
    '',
    DISCLAIMER.en,
    '',
    'Save this one for later.',
    '',
    hashtags('en', ['leveragedETF']),
  ].join('\n')
}

function altText(data, lang) {
  const lines = data.results.map((r) =>
    lang === 'ko'
      ? `${r.ticker}: 투입 ${usd(r.stats.invested)}, 최종 평가액 ${usd(r.stats.final_value)}, ${r.stats.multiple}배, 최대낙폭 ${r.stats.mdd_pct}%`
      : `${r.ticker}: invested ${usd(r.stats.invested)}, final value ${usd(r.stats.final_value)}, ${r.stats.multiple}x, max drawdown ${r.stats.mdd_pct}%`,
  )
  const head =
    lang === 'ko'
      ? `검은 배경에 누적 평가액 곡선이 그려지는 세로 영상. 기간 ${data.rule.start}부터 ${data.rule.end}까지, 매 거래일 $${data.rule.amount_per_trading_day} 적립.`
      : `Vertical video of a portfolio value curve drawn on a black background. Period ${data.rule.start} to ${data.rule.end}, $${data.rule.amount_per_trading_day} invested each trading day.`
  return [head, ...lines].join('\n')
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, cur, i, arr) => {
      if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]])
      return acc
    }, []),
  )
  const stamp = args.stamp
  if (!stamp) {
    console.error('사용법: node scripts/write-caption.mjs --stamp 2026-08-12-ep01')
    process.exit(1)
  }

  const data = JSON.parse(await readFile(join(ROOT, 'content', `${stamp}.json`), 'utf8'))

  // 환율은 있으면 쓰고, 없으면 원화 표기를 생략한다
  try {
    const fx = JSON.parse(await readFile(join(ROOT, 'data', 'prices', 'KRW=X.json'), 'utf8'))
    data.fx = fx.rows.at(-1).close
  } catch {
    data.fx = null
  }

  const build = data.type === 'B-compare' ? captionB : captionA

  for (const lang of ['ko', 'en']) {
    const dir = join(ROOT, 'cards', 'backtest', stamp, lang)
    await mkdir(dir, { recursive: true })

    const caption = build(data, lang)
    await writeFile(join(dir, 'caption.txt'), caption)
    await writeFile(join(dir, 'alt.txt'), altText(data, lang))

    console.log(`  ok ${lang}: caption.txt (${caption.length}자) + alt.txt`)
  }

  console.log(`\n--- 미리보기 (ko) ---\n`)
  console.log(build(data, 'ko'))
}

main().catch((err) => {
  console.error('실패:', err.message)
  process.exit(1)
})
