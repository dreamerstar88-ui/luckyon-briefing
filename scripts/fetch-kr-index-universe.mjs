// fetch-kr-index-universe.mjs
// 한국 종목의 코스피200·코스닥150 "기본 확인 유니버스"를 시가총액 순위로 근사한다.
// ROUTINE_PROMPT.md 의 "기업 실적·공시의 기본 확인 대상" 절이 이 출력을 쓴다.
//
// 정식 코스피200·코스닥150 편입종목 API 는 이 세션에서 조회 경로가 확인되지 않았다
// (DATA_SOURCES.md 참고 — KRX 계열 차단, Twelve Data 세션 미로드). 대신 이미
// fetch-krx.mjs 가 쓰는 FinanceDataReader 미러(전종목 스냅샷에 Marcap 컬럼 포함)에서
// 코스피 시가총액 상위 200·코스닥 상위 150을 뽑아 근사 유니버스로 쓴다 — 정식 편입종목과
// 소수 종목이 다를 수 있지만(유동성 심사 등 추가 기준), 시총 상위권은 사실상 겹친다.
//
// 사용법:
//   node scripts/fetch-kr-index-universe.mjs              # 오늘(KST) 기준
//   node scripts/fetch-kr-index-universe.mjs 2026-08-26   # 특정 거래일
//
// 출력: {date, kospi200:[{code,name,marcap}], kosdaq150:[...]}
// 종목은 "티커"가 아니라 6자리 종목코드(code)와 기업명(name)으로 식별한다.

const BASE = 'https://raw.githubusercontent.com/FinanceData/fdr_krx_data_cache/refs/heads/master/data';

function kstToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  return kst.toISOString().slice(0, 10);
}

async function getCsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'luckyon-briefing' } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim() || text.startsWith('404')) return null;
  return text;
}

// listing/krx 스냅샷은 값에 쉼표가 든 필드가 없어 단순 split 으로 충분하다
// (업종명이 섞이는 listing/desc 와 달리 이 파일은 숫자·코드·종목명뿐이다).
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].replace(/^﻿/, '').split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

async function main() {
  const date = process.argv[2] || kstToday();
  const text = await getCsv(`${BASE}/listing/krx/${date}.csv`);
  if (!text) {
    console.error(`⏭  ${date} 전종목 스냅샷 없음 — 휴장일이거나 스냅샷 미수집(2026-03-11 이후만 존재).`);
    process.exit(2);
  }
  const rows = parseCsv(text);
  const byMarcapDesc = (a, b) => (Number(b.Marcap) || 0) - (Number(a.Marcap) || 0);
  const pick = (market, n) => rows
    .filter(r => r.Market === market)
    .sort(byMarcapDesc)
    .slice(0, n)
    .map(r => ({ code: r.Code, name: r.Name, marcap: Number(r.Marcap) || 0 }));

  const out = {
    date,
    source: 'FinanceDataReader listing/krx 미러 · 시가총액 상위 근사(정식 편입종목 아님)',
    kospi200: pick('KOSPI', 200),
    kosdaq150: pick('KOSDAQ', 150),
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error('❌ 실행 실패:', err.message);
  process.exit(1);
});
