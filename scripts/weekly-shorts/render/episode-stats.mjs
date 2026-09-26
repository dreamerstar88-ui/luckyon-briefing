// 주간복기 회차별 성적을 유튜브 분석 API 에서 받는다.
// 다음 회차를 어떻게 만들지 정하려면 이 숫자가 먼저 있어야 한다.
//
//   node scripts/weekly-shorts/render/episode-stats.mjs
//   node scripts/weekly-shorts/render/episode-stats.mjs --from=2026-09-01 --to=2026-09-26
//
// 인증은 keys.env 의 GOOGLE_REFRESH_TOKEN (한국어 채널). --channel=en 이면 영어 채널.
// 공개 조회수는 누구나 볼 수 있지만 **평균 시청 시간·유입 경로는 소유자만** 볼 수 있다.
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));

const KEYS = args.keys || 'C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env';
const WHICH = args.channel === 'en' ? 'GOOGLE_REFRESH_TOKEN_EN' : 'GOOGLE_REFRESH_TOKEN';
const FROM = args.from || '2026-09-01';
const TO = args.to || new Date().toISOString().slice(0, 10);

// 회차 목록. 새 회차를 발행하면 여기에 한 줄 더한다.
const EPISODES = [
  { n: 1, id: 'dIfR_J4TrAA', week: '2026-08-31', published: '2026-09-08' },
  { n: 2, id: 'OSLaKuhQNtg', week: '2026-09-08', published: '2026-09-13' },
  { n: 3, id: 'ZfVRdo2eL08', week: '2026-09-14', published: '2026-09-19' },
];

const env = {};
for (const line of fs.readFileSync(KEYS, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
if (!env[WHICH]) { console.error(`${WHICH} 가 인증 파일에 없다`); process.exit(1); }

const tr = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env[WHICH], grant_type: 'refresh_token',
  }),
});
const tj = await tr.json();
if (tj.error) { console.error('토큰 갱신 실패:', tj.error, tj.error_description || ''); process.exit(1); }
const H = { Authorization: `Bearer ${tj.access_token}` };

const A = 'https://youtubeanalytics.googleapis.com/v2/reports';
async function q(params) {
  const u = A + '?' + new URLSearchParams({ ids: 'channel==MINE', startDate: FROM, endDate: TO, ...params });
  const j = await (await fetch(u, { headers: H })).json();
  if (j.error) return { error: j.error.message };
  return { cols: (j.columnHeaders ?? []).map(c => c.name), rows: j.rows ?? [] };
}

const secs = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

console.log(`기간 ${FROM} ~ ${TO} · 채널 ${WHICH === 'GOOGLE_REFRESH_TOKEN_EN' ? '영어' : '한국어'}\n`);

console.log('── 회차별 ──────────────────────────────────────────────');
console.log('회차  발행일        조회수   평균시청   길이대비   시청시간(분)');
for (const ep of EPISODES) {
  const r = await q({
    dimensions: 'video',
    metrics: 'views,averageViewDuration,averageViewPercentage,estimatedMinutesWatched',
    filters: `video==${ep.id}`,
  });
  if (r.error) { console.log(`${String(ep.n).padStart(2)}회차  ${ep.published}   오류: ${r.error.slice(0, 60)}`); continue; }
  const row = r.rows[0];
  if (!row) { console.log(`${String(ep.n).padStart(2)}회차  ${ep.published}   (행 없음 — 기간 밖이거나 조회 0)`); continue; }
  const [, views, avgDur, avgPct, mins] = row;
  console.log(`${String(ep.n).padStart(2)}회차  ${ep.published}  ${String(views).padStart(7)}   ${secs(avgDur).padStart(6)}   ${Number(avgPct).toFixed(1).padStart(6)}%   ${String(Math.round(mins)).padStart(8)}`);
}

console.log('\n── 회차별 유입 경로 (조회수) ───────────────────────────');
for (const ep of EPISODES) {
  const r = await q({
    dimensions: 'insightTrafficSourceType', metrics: 'views',
    filters: `video==${ep.id}`, sort: '-views',
  });
  if (r.error) { console.log(`${ep.n}회차: 오류 ${r.error.slice(0, 50)}`); continue; }
  const total = r.rows.reduce((a, b) => a + Number(b[1]), 0) || 1;
  const parts = r.rows.map(([src, v]) => `${src} ${v}(${(v / total * 100).toFixed(0)}%)`).join(' · ');
  console.log(`${ep.n}회차: ${parts || '(없음)'}`);
}

console.log('\n── 채널 일별 ───────────────────────────────────────────');
const d = await q({ dimensions: 'day', metrics: 'views,averageViewDuration,subscribersGained' });
if (d.error) console.log('오류:', d.error);
else {
  console.log('날짜         조회수  평균시청  구독증가');
  for (const [day, views, avg, subs] of d.rows.slice(-14)) {
    console.log(`${day}  ${String(views).padStart(6)}   ${secs(avg).padStart(6)}   ${String(subs).padStart(6)}`);
  }
}
