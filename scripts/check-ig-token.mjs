// check-ig-token.mjs
// 인스타 액세스 토큰이 «실제로» 살아 있는지 API 에 직접 물어본다.
//
// 왜 필요한가: ROUTINE_COMMON.md §5 의 만료 점검은 원래 환경변수
// `IG_TOKEN_EXPIRES_AT` 하나만 읽었다. 그 값은 사람이 손으로 적어 두는 것이라
// 토큰을 갱신하고 값을 안 고치면 조용히 어긋난다 — 2026-09-20 차트노트 EP.08
// 발행 시점에 그 값은 `2026-09-12`(8일 지난 날짜)였는데 발행은 정상이었다.
// 즉 «만료됐다»는 경고가 거짓이었고, 반대로 진짜 만료가 다가와도 이 방식으로는
// 못 잡는다. 사람의 기억에 기대는 점검은 반드시 썩는다.
//
// 사용법
//   node scripts/check-ig-token.mjs            # 읽기 전용. 토큰이 유효한지 확인만 한다
//   node scripts/check-ig-token.mjs --refresh  # 장기 토큰을 갱신하고 새 만료일을 알려준다
//   node scripts/check-ig-token.mjs --refresh --out <경로>   # 새 토큰을 그 파일에 쓴다
//
// 필요한 환경변수: IG_ACCESS_TOKEN · (선택) IG_TOKEN_EXPIRES_AT · (선택) GRAPH_VERSION
//
// ⚠️ 토큰 값은 **절대 표준출력에 찍지 않는다.** 로그·트랜스크립트에 남으면 그 자체가 유출이다.
//    `--refresh` 는 새 토큰을 파일로만 내보내고, 화면에는 만료일과 파일 경로만 보여준다.

import fs from 'node:fs';
import path from 'node:path';

const VER = process.env.GRAPH_VERSION || 'v21.0';
const TOKEN = process.env.IG_ACCESS_TOKEN;
const DECLARED = process.env.IG_TOKEN_EXPIRES_AT || null;   // YYYY-MM-DD, 사람이 적어 둔 값
const argv = process.argv.slice(2);
const DO_REFRESH = argv.includes('--refresh');
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : null; })();

if (!TOKEN) {
  console.error('❌ IG_ACCESS_TOKEN 이 없습니다. 루틴 환경 설정을 확인하세요.');
  process.exit(1);
}

// KST 기준 오늘 — 존파일이 없는 컨테이너를 대비해 UTC+9 산술로 구한다(ROUTINE_COMMON §1 과 같은 이유).
const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const j = async (url) => {
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
};

// ---------- 1. 토큰이 지금 실제로 먹히는가 (읽기 전용) ----------
const me = await j(`https://graph.instagram.com/${VER}/me?fields=id,username&access_token=${TOKEN}`);
if (!me.ok) {
  const e = me.body?.error || {};
  console.error(`❌ 토큰이 거부됐습니다 (HTTP ${me.status}) — ${e.message || JSON.stringify(me.body)}`);
  console.error('   code 190 이면 만료·무효입니다. --refresh 로 갱신하거나 토큰을 새로 발급하세요.');
  process.exit(1);
}
console.log(`✅ 토큰 유효 — @${me.body.username} (id ${me.body.id})`);

// ---------- 2. 사람이 적어 둔 만료일과 대조 ----------
if (!DECLARED) {
  console.log('⚠️  IG_TOKEN_EXPIRES_AT 이 비어 있습니다 — 만료가 다가와도 아무도 못 알아챕니다.');
} else {
  const left = daysBetween(todayKST, DECLARED);
  if (left < 0) {
    console.log(`⚠️  IG_TOKEN_EXPIRES_AT(${DECLARED})은 ${-left}일 지난 날짜인데 토큰은 살아 있습니다.`);
    console.log('    → 적어 둔 값이 낡은 것입니다. 이 상태로 두면 §5 의 만료 경고가 매 회차 거짓으로 울리고,');
    console.log('      정작 진짜 만료는 못 잡습니다. --refresh 로 실제 만료일을 받아 환경변수를 고치세요.');
  } else if (left <= 10) {
    console.log(`⚠️  만료까지 ${left}일 남았습니다 (${DECLARED}). --refresh 로 갱신하세요.`);
  } else {
    console.log(`· 만료까지 ${left}일 남음 (${DECLARED}).`);
  }
}

// ---------- 3. 갱신 (명시적으로 요청했을 때만) ----------
if (!DO_REFRESH) {
  console.log('\n※ 읽기 전용으로 확인만 했습니다. 갱신하려면 --refresh 를 붙이세요.');
  process.exit(0);
}

const rf = await j(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${TOKEN}`);
if (!rf.ok || !rf.body?.access_token) {
  const e = rf.body?.error || {};
  console.error(`❌ 갱신 실패 (HTTP ${rf.status}) — ${e.message || JSON.stringify(rf.body)}`);
  console.error('   장기 토큰은 발급 후 24시간이 지나야 갱신할 수 있고, 만료된 토큰은 갱신되지 않습니다.');
  process.exit(1);
}

const expiresIn = Number(rf.body.expires_in || 0);                 // 초
const newExpiry = new Date(Date.now() + expiresIn * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10);
const outPath = OUT || path.join(process.env.TMPDIR || '/tmp', 'ig-access-token.txt');
fs.writeFileSync(outPath, rf.body.access_token, { mode: 0o600 });

console.log(`\n✅ 갱신 완료 — 새 만료일 ${newExpiry} (${Math.round(expiresIn / 86400)}일 뒤)`);
console.log(`   새 토큰을 ${outPath} 에 썼습니다 (화면에는 찍지 않습니다).`);
console.log('   루틴 환경 설정에 아래 둘을 넣어 주세요:');
console.log(`     IG_ACCESS_TOKEN      = (위 파일의 내용)`);
console.log(`     IG_TOKEN_EXPIRES_AT  = ${newExpiry}`);
console.log('   ※ 이 컨테이너는 세션이 끝나면 사라지므로 파일도 함께 사라집니다.');
