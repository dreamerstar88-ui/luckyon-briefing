// 유튜브에 영상과 자막을 올린다. keys.env 의 구글 인증을 그대로 쓴다.
//
// 3회차까지는 Zapier 를 거쳐 올렸다. 그 세션에 유튜브 커넥터가 없었기 때문이고,
// Zapier 의 유튜브 연결이 둘이라 올리기 전에 채널을 확인해야 했다.
// 이 도구는 그 우회가 필요 없다 — 토큰 자체가 채널이라 엉뚱한 채널로 갈 수 없다.
//
//   # 먼저 반드시 미리보기로 확인한다 (아무것도 올리지 않는다)
//   node scripts/weekly-shorts/render/publish-youtube.mjs \
//        --video=out/ep4/reel.mp4 --title="..." --desc-file=out/ep4/설명란.txt \
//        --tags-file=out/ep4/태그.txt --ko=out/ep4/subtitles.ko.srt --en=out/ep4/subtitles.en.srt
//
//   # 확인이 끝난 뒤에만 --confirm 을 붙인다
//   ... --confirm
//
// --channel=en 을 주면 영어 채널(luckyon numberview)로 간다. 기본은 한국어 채널.
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));

const KEYS = args.keys || 'C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env';
const CONFIRM = args.confirm === true;
const CH = args.channel === 'en' ? 'GOOGLE_REFRESH_TOKEN_EN' : 'GOOGLE_REFRESH_TOKEN';

// 채널 관행. 2·3회차 실제 발행값을 따른다.
// (ROUTINE_PROMPT_WEEKLY_SHORTS.md 11장 표에는 카테고리가 25 로 적혀 있으나,
//  2회차·3회차 모두 실제로는 27 로 나갔다. 회차끼리 비교하려면 같은 값을 쓴다.)
const CATEGORY = String(args.category || '27');
const PRIVACY  = String(args.privacy || 'public');
const LANG     = String(args.lang || 'ko');

function loadEnv(p) {
  if (!fs.existsSync(p)) throw new Error(`인증 파일이 없다: ${p}`);
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

async function accessToken(env) {
  if (!env[CH]) throw new Error(`${CH} 가 인증 파일에 없다`);
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env[CH], grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`토큰 갱신 실패: ${j.error || r.status} ${j.error_description || ''}`);
  return j.access_token;
}

const need = k => { if (!args[k]) { console.error(`--${k} 가 필요하다`); process.exit(1); } return args[k]; };
const readIf = p => (p && fs.existsSync(p)) ? fs.readFileSync(p, 'utf8') : null;

// --existing=<영상번호> 를 주면 영상은 올리지 않고 자막만 그 영상에 붙인다.
// 4회차에서 영상은 올라갔는데 하루 사용 한도(quotaExceeded)에 걸려 자막만 실패했다(2026-09-26).
const EXISTING = args.existing ? String(args.existing) : null;
const VIDEO = EXISTING ? (args.video || null) : need('video');
const TITLE = EXISTING ? String(args.title || '') : need('title');
const DESC  = readIf(args['desc-file']) ?? (args.desc || '');
const TAGS  = (readIf(args['tags-file']) ?? (args.tags || ''))
                .split(/[\n,]/).map(s => s.trim()).filter(Boolean);
const KO = args.ko, EN = args.en;

for (const [label, p] of [['영상', VIDEO], ['한국어 자막', KO], ['영어 자막', EN]]) {
  if (!p) continue;
  if (!fs.existsSync(p)) { console.error(`${label} 파일이 없다: ${p}`); process.exit(1); }
}

const env = loadEnv(KEYS);
const token = await accessToken(env);

// 어느 채널인지 먼저 보여 준다
const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
  { headers: { Authorization: `Bearer ${token}` } });
const chJson = await chRes.json();
const ch = (chJson.items || [])[0];

const size = VIDEO ? fs.statSync(VIDEO).size : 0;
console.log('─────────── 올릴 내용 ───────────');
console.log(`  채널    : ${ch ? ch.id + ' — ' + ch.snippet.title : '(조회 실패)'}`);
console.log(EXISTING ? `  영상    : 이미 올린 영상 ${EXISTING} — 자막만 올린다` : `  영상    : ${VIDEO} (${(size / 1048576).toFixed(2)} MB)`);
if (!EXISTING) {
  console.log(`  제목    : ${TITLE}`);
  console.log(`  제목 끝 : ${/\[.+ \d\d\] #Shorts$/.test(TITLE) ? '관행에 맞음' : '⚠ «[시리즈 nn] #Shorts» 형식이 아니다'}`);
}
console.log(`  설명란  : ${DESC ? DESC.split('\n').length + '줄 / ' + DESC.length + '자' : '(비어 있음)'}`);
console.log(`  태그    : ${TAGS.length}개`);
console.log(`  카테고리: ${CATEGORY} · 언어: ${LANG} · 공개: ${PRIVACY} · 아동용: false`);
console.log(`  자막    : ko ${KO ? '있음' : '없음'} / en ${EN ? '있음' : '없음'}`);
console.log('─────────────────────────────────');

if (!CONFIRM) {
  console.log('\n미리보기입니다. 아무것도 올리지 않았습니다.');
  console.log('확인이 끝났으면 같은 명령에 --confirm 을 붙여 다시 실행하세요.');
  process.exit(0);
}

let vj;
if (EXISTING) {
  vj = { id: EXISTING };
  console.log(`
· 영상은 이미 올라가 있다: ${EXISTING} — 자막만 올린다`);
} else {
  // ── 영상 올리기 (재개 가능 업로드)
  const meta = {
    snippet: { title: TITLE, description: DESC, tags: TAGS, categoryId: CATEGORY,
               defaultLanguage: LANG, defaultAudioLanguage: LANG },
    status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false },
  };
  const init = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
                 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
      body: JSON.stringify(meta) });
  if (!init.ok) { console.error('업로드 시작 실패:', init.status, (await init.text()).slice(0, 400)); process.exit(1); }
  const loc = init.headers.get('location');

  const put = await fetch(loc, { method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
    body: fs.readFileSync(VIDEO), duplex: 'half' });
  vj = await put.json();
  if (!put.ok || !vj.id) { console.error('업로드 실패:', put.status, JSON.stringify(vj).slice(0, 400)); process.exit(1); }
  console.log(`\n✅ 영상 올림: ${vj.id}  https://www.youtube.com/watch?v=${vj.id}`);
}

// ── 자막 올리기 (Zapier 때는 원시 multipart 를 손으로 만들어야 했다)
for (const [lang, p] of [['ko', KO], ['en', EN]]) {
  if (!p) continue;
  const B = '===luckyon' + Date.now() + '===';
  const snip = JSON.stringify({ snippet: { videoId: vj.id, language: lang, name: '', isDraft: false } });
  const body = Buffer.concat([
    Buffer.from(`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${snip}\r\n`),
    Buffer.from(`--${B}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n`),
    fs.readFileSync(p), Buffer.from(`\r\n--${B}--\r\n`),
  ]);
  const r = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart',
    { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${B}` },
      body, duplex: 'half' });
  const cj = await r.json();
  console.log(r.ok && cj.id ? `✅ ${lang} 자막: ${cj.snippet?.status || 'ok'} (${cj.id})`
                            : `❌ ${lang} 자막 실패: ${JSON.stringify(cj).slice(0, 300)}`);
}
console.log('\n매니페스트의 publish 항목에 영상 번호와 자막 번호를 적어 두세요 (매뉴얼 13장).');
