// 이미 올린 영상의 자막 한 벌을 같은 자리에서 바꾼다(captions.update). 새 자막을 더하지 않는다.
//   node scripts/weekly-shorts/update-caption.mjs --video=<번호> --lang=en --file=<srt>            미리보기(목록만)
//   ... --confirm                                                                         실제로 바꾼다
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const env = {};
for (const line of fs.readFileSync('C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
const tj = await tr.json(); if (!tr.ok || tj.error) { console.error('토큰 갱신 실패:', tj.error); process.exit(1); }
const H = { Authorization: `Bearer ${tj.access_token}` };
const lr = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${args.video}`, { headers: H });
const lj = await lr.json(); if (!lr.ok) { console.error('목록 실패:', JSON.stringify(lj).slice(0, 300)); process.exit(1); }
for (const c of lj.items) console.log(`  자막 ${c.snippet.language} · 종류 ${c.snippet.trackKind} · 이름 «${c.snippet.name}» · 상태 ${c.snippet.status} · 고친 시각 ${c.snippet.lastUpdated} · ${c.id}`);
const mine = lj.items.filter(c => c.snippet.language === args.lang && c.snippet.trackKind === 'standard');
if (mine.length !== 1) { console.error(`${args.lang} 직접 올린 자막이 ${mine.length}개 — 하나여야 바꾼다`); process.exit(1); }
if (args.confirm !== true) { console.log(`미리보기: ${mine[0].id} 를 ${args.file} 로 바꾼다(--confirm 이 없어 안 바꿈)`); process.exit(0); }
const B = '===luckyon' + Date.now() + '===';
const meta = JSON.stringify({ id: mine[0].id, snippet: { isDraft: false } });
const body = Buffer.concat([
  Buffer.from(`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
  Buffer.from(`--${B}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n`), fs.readFileSync(args.file), Buffer.from(`\r\n--${B}--\r\n`)]);
const ur = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart',
  { method: 'PUT', headers: { ...H, 'Content-Type': `multipart/related; boundary=${B}` }, body, duplex: 'half' });
const uj = await ur.json();
console.log(ur.ok && uj.id ? `✅ ${args.lang} 자막 바꿈: ${uj.id} · 상태 ${uj.snippet?.status}` : `❌ 바꾸기 실패: ${JSON.stringify(uj).slice(0, 300)}`);
