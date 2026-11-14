// 올린 회차를 올린 쪽 응답과 별개로 다시 조회한다 — 유튜브(공개·처리·자막·댓글) · 인스타(형식·캡션 글자 대조).
//   node scripts/weekly-shorts/check-published.mjs --ep=10 --stamp=2026-11-09
// 인증은 두 곳에서 읽는다(값은 찍지 않는다): 유튜브 keys.env · 인스타 ~/.secrets/luckyon-ig.env
// 2026-11-14: 예전에는 세션 임시 폴더의 스크립트로 했는데 임시 폴더가 정리돼 사라졌다. 저장소에 둔다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const EP = Number(args.ep), STAMP = args.stamp;
const rec = JSON.parse(fs.readFileSync(`out/ep${EP}/publish.json`, 'utf8'));
const env = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]));

// 유튜브
const K = env('C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env');
const tk = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
  client_id: K.GOOGLE_CLIENT_ID, client_secret: K.GOOGLE_CLIENT_SECRET, refresh_token: K.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
if (!tk.access_token) { console.log('유튜브 토큰 갱신 실패', tk.error); process.exit(1); }
const H = { Authorization: `Bearer ${tk.access_token}` }, G = 'https://www.googleapis.com/youtube/v3/';
const id = rec.youtube?.video_id;
const v = (await (await fetch(`${G}videos?part=status,processingDetails,snippet&id=${id}`, { headers: H })).json()).items?.[0];
if (!v) { console.log('유튜브 영상 없음', id); process.exit(1); }
console.log(`유튜브 ${id} · 공개 ${v.status.privacyStatus} · 업로드 ${v.status.uploadStatus} · 처리 ${v.processingDetails?.processingStatus} · 채널 ${v.snippet.channelTitle}`);
const wantTitle = fs.readFileSync(`out/ep${EP}/제목.txt`, 'utf8').trim();
console.log(`  제목 ${v.snippet.title === wantTitle ? '파일과 같음' : `다름 «${v.snippet.title}»`}`);
const caps = (await (await fetch(`${G}captions?part=snippet&videoId=${id}`, { headers: H })).json()).items || [];
console.log(`  자막 ${caps.map((c) => `${c.snippet.language}/${c.snippet.trackKind}/${c.snippet.status}`).join(' · ')}`);
const cm = (await (await fetch(`${G}commentThreads?part=snippet&videoId=${id}&maxResults=5`, { headers: H })).json()).items || [];
const mine = cm.find((c) => c.id === rec.youtube?.pinned_comment?.id);
console.log(`  고정용 댓글 ${mine ? `달림 · «${mine.snippet.topLevelComment.snippet.textOriginal.split('\n')[0]}»` : '못 찾음'}`);

// 인스타
const I = env(path.join(os.homedir(), '.secrets', 'luckyon-ig.env'));
const tokKey = Object.keys(I).find((k) => /TOKEN/i.test(k) && !/EXPIRES/i.test(k));
const mid = rec.instagram?.media_id;
const j = await (await fetch(`https://graph.instagram.com/v21.0/${mid}?fields=caption,media_type,media_product_type,permalink,timestamp&access_token=${encodeURIComponent(I[tokKey])}`)).json();
if (j.error) { console.log('인스타 조회 실패', j.error.message); process.exit(1); }
const want = fs.readFileSync(`out/ep${EP}/live/cards/reels/nasdaq-week-${STAMP}/ko/caption.txt`, 'utf8').replace(/\r\n/g, '\n').trim();
const got = (j.caption || '').replace(/\r\n/g, '\n').trim();
console.log(`인스타 ${j.media_type}/${j.media_product_type} · ${j.timestamp} · ${j.permalink}`);
console.log(`  캡션 실제 ${got.length}자 / 올릴 파일 ${want.length}자 → ${got === want ? '글자 하나까지 같음' : '다름'}`);
