// fetch-kr-trade.mjs
// 한국 수출입을 품목(성질)별로 뽑아 JSON 으로 낸다.
// ROUTINE_PROMPT.md 리서치 B절 pm ⑥ (실적·지표 발표) 의 한국 지표 자리가 이 출력을 쓴다.
//
// 사용법:
//   node scripts/fetch-kr-trade.mjs           # 가장 최근 확정 월
//   node scripts/fetch-kr-trade.mjs 202607    # 특정 월
//
// 출처가 둘인 이유
//   1순위 관세청 수출입무역통계 (공공데이터포털 1220000/Itemtrade) — HS 코드 기준 세부 품목.
//          2026-08-23 현재 이 계정 인증키가 해당 서비스에 등록돼 있지 않아
//          `등록되지 않은 서비스키`(코드 30) 가 돌아온다. 승인되면 자동으로 이쪽을 쓴다.
//   2순위 한국은행 ECOS — 성질별 수출입(901Y092)·수출입 총괄(901Y118). 지금 바로 된다.
//          HS 세부 품목은 없지만 중화학공업품·경공업품·원자재·자본재·소비재로 갈라져
//          "무엇을 팔아 벌었나" 를 카드 한 장에 담기에는 오히려 이쪽이 읽기 쉽다.
//
// 그래서 이 스크립트는 관세청을 먼저 두드리고, 안 열리면 ECOS 로 내려간다.
// 어느 쪽을 썼는지는 출력의 `source` 에 남는다 — 카드 각주에 그대로 쓴다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 키는 환경변수(클라우드) 우선, 없으면 로컬 keys.env.
// ROUTINE_COMMON.md §1 준비 의 'API 키' 항목과 같은 규칙이다.
function key(name) {
  if (process.env[name]) return process.env[name].trim();
  // 윈도우 경로라도 슬래시로 쓴다 — 역슬래시는 JS 문자열 이스케이프로 먹혀 경로가 깨진다.
  const f = 'C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env';
  try {
    const line = fs.readFileSync(f, 'utf8').split('\n').find(l => l.startsWith(name + '='));
    return line ? line.slice(name.length + 1).trim() : '';
  } catch { return ''; }
}

const ECOS = 'https://ecos.bok.or.kr/api';
const 성질별 = '901Y092';
const 총괄   = '901Y118';

// 성질별 수출입의 항목 코드. ECOS 가 주는 ITEM_NAME1 을 그대로 믿지 않고
// 코드로 집어 쓴다 — 표기가 바뀌어도 스크립트가 안 깨진다.
const 수출품목 = [
  { code: 'E104', ko: '중화학 공업품', en: 'Heavy & chemical' },
  { code: 'E103', ko: '경공업품',      en: 'Light industry'   },
  { code: 'E102', ko: '원료 및 연료',  en: 'Raw materials & fuel' },
  { code: 'E101', ko: '식료 및 직접소비재', en: 'Food & consumer' },
];
const 수입품목 = [
  { code: 'I102', ko: '원자재', en: 'Raw materials' },
  { code: 'I103', ko: '자본재', en: 'Capital goods' },
  { code: 'I101', ko: '소비재', en: 'Consumer goods' },
];

async function ecos(stat, from, to) {
  const url = `${ECOS}/StatisticSearch/${key('ECOS_API_KEY')}/json/kr/1/500/${stat}/M/${from}/${to}`;
  const res = await fetch(url);
  const j = await res.json();
  if (j.RESULT) throw new Error(`ECOS ${stat}: ${j.RESULT.MESSAGE}`);
  return j.StatisticSearch?.row || [];
}

// 관세청이 열렸는지 한 번 찔러본다. 열려 있으면 HS 코드 기준 품목별을 쓴다.
async function customs(yyyymm) {
  const k = key('DATA_GO_KR_SERVICE_KEY');
  if (!k) return null;
  const url = `http://apis.data.go.kr/1220000/Itemtrade/getItemtradeList`
    + `?serviceKey=${k}&strtYymm=${yyyymm}&endYymm=${yyyymm}&hsSgn=85&type=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    if (/NOT_REGISTERED|등록되지 않은|NO_OPENAPI/.test(text)) return null;
    const j = JSON.parse(text);
    const rows = j?.response?.body?.items?.item;
    return rows && rows.length ? rows : null;
  } catch { return null; }
}

// 가장 최근 확정 월을 찾는다. 통관 통계는 익월 중순에 확정되므로
// 오늘 기준 2개월 전부터 거꾸로 훑어 값이 있는 첫 달을 쓴다.
function recentMonths(n = 26) {
  const now = new Date();
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

async function main() {
  const want = process.argv.find(a => /^\d{6}$/.test(a));
  const months = recentMonths();
  const from = months[months.length - 1], to = months[0];

  const [kind, total] = await Promise.all([ecos(성질별, from, to), ecos(총괄, from, to)]);
  const at = (rows, code, ym) =>
    Number(rows.find(r => r.ITEM_CODE1 === code && r.TIME === ym)?.DATA_VALUE ?? NaN);

  // 값이 실제로 들어온 가장 최근 달
  const ym = want || months.find(m => Number.isFinite(at(kind, 'E100', m)));
  if (!ym) { console.error('❌ ECOS 에 최근 확정 월 데이터가 없습니다.'); process.exit(2); }
  const yoyYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;

  const 수출합 = at(kind, 'E100', ym), 수입합 = at(kind, 'I100', ym);
  const pack = (list, rows, sum) => list.map(x => {
    const v = at(rows, x.code, ym), p = at(rows, x.code, yoyYm);
    return {
      code: x.code, name_ko: x.ko, name_en: x.en,
      value: v,
      sharePct: Number((v / sum * 100).toFixed(1)),
      yoyPct: Number.isFinite(p) && p ? Number(((v / p - 1) * 100).toFixed(1)) : null,
    };
  });

  const hs = await customs(ym);
  // 총액은 성질별 표의 합계 항목(E100/I100)에서 가져온다. 수출입 총괄 표(901Y118)는
  // 공표가 한 달 늦어 최근 달이 비어 있다 — 2026-08-23 확인: 성질별은 202607 까지 있는데
  // 총괄은 202606 까지였다. 총괄을 총액의 출처로 삼으면 가장 최근 달이 통째로 빈다.
  // 총괄은 값이 있을 때만 교차검증용으로 쓴다.
  const 수출총 = 수출합, 수입총 = 수입합;
  const 총괄수출 = at(total, 'T002', ym);

  console.log(JSON.stringify({
    month: ym,
    unit: '천달러',
    source: hs
      ? '관세청 수출입무역통계(HS 품목별) + 한국은행 ECOS'
      : '한국은행 ECOS 901Y092 성질별 수출입 · 901Y118 수출입 총괄',
    customsOpen: !!hs,
    total: {
      export: 수출총, import: 수입총,
      balance: Number.isFinite(수출총) && Number.isFinite(수입총) ? 수출총 - 수입총 : null,
      exportYoyPct: (() => { const p = at(kind, 'E100', yoyYm); return p ? Number(((수출총 / p - 1) * 100).toFixed(1)) : null; })(),
      crosscheck: Number.isFinite(총괄수출)
        ? (총괄수출 === 수출총 ? '총괄 표와 일치' : `총괄 표는 ${총괄수출}`)
        : '총괄 표는 이 달 아직 미공표',
    },
    exportByKind: pack(수출품목, kind, 수출합),
    importByKind: pack(수입품목, kind, 수입합),
    hsItems: hs ? hs.slice(0, 10) : null,
  }, null, 2));
}

main().catch(e => { console.error('❌ 실행 실패:', e.message); process.exit(1); });
