// 주간 쇼츠 한 회차를 명령 하나로 올린다 — make-episode.mjs 다음에 쓴다(2026-09-26).
//
//   node scripts/weekly-shorts/publish-episode.mjs --stamp=2026-09-28 --ep=5            # 무엇을 올릴지 보여 주기만
//   node scripts/weekly-shorts/publish-episode.mjs --stamp=2026-09-28 --ep=5 --confirm  # 올리기
//   일부만 다시: --only=live,youtube,captions,instagram,comment   이미 올린 유튜브 영상: --video=<번호>
//
// 순서: live(공개 주소용 claude/live 브랜치에 파일 5개 — 2.9GB 브랜치를 꺼내지 않고 커밋만 얹는다)
//     → youtube(영상+자막. --video 를 주면 자막만) → instagram(공개 주소가 열릴 때까지 최대 15분 기다린 뒤)
//     → comment(고정 댓글. 고정 자체는 API 에 없어 스튜디오에서 한 번 누른다)
// 유튜브는 하루 사용 한도가 있다. 걸리면(quotaExceeded) 한국시간 오후 4시 뒤에 --only=captions,comment 로 다시 한다.
// 결과는 out/ep<N>/publish.json 과 매니페스트 publish 에 적는다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const STAMP = args.stamp, EP = Number(args.ep), GO = args.confirm === true;
if (!STAMP || !EP) die('--stamp=<그 주 월요일> --ep=<회차 번호> 가 필요하다');
const NN = String(EP).padStart(2, '0');
const DIR = args.dir || `docs/samples/weekly-shorts/ep${NN}`;
const OUT = args.out || `out/ep${EP}`, SLUG = `nasdaq-week-${STAMP}`, LIVE = `${OUT}/live/cards/reels/${SLUG}/ko`;
const MANI = `content/weekly-shorts/${STAMP}.json`;
const KEYS = 'C:/Users/PSJ_1/.claude/SJ PARK Project/api-keys/keys.env';
const IGENV = path.join(os.homedir(), '.secrets', 'luckyon-ig.env');
const ONLY = new Set(String(args.only || 'live,youtube,instagram,comment').split(','));
if (ONLY.has('youtube')) ONLY.add('captions');
const at = (p) => path.join(R, p);
const git = (...a) => spawnSync('git', a, { cwd: R, encoding: 'utf8' });
const LOG = at(`${OUT}/publish.json`);
const rec = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
const save = () => fs.writeFileSync(LOG, JSON.stringify(rec, null, 2));
const FILES = ['reel.mp4', 'cover.png', 'caption.txt', 'subtitles.ko.srt', 'subtitles.en.srt'];
for (const f of FILES) if (!fs.existsSync(at(`${LIVE}/${f}`))) die(`${LIVE}/${f} 가 없다 — make-episode.mjs 를 먼저 돌린다`);
const PAGES = (fs.readFileSync(IGENV, 'utf8').match(/^PAGES_BASE_URL=(.*)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
const url = (f) => `${PAGES}/cards/reels/${SLUG}/ko/${f}`;
console.log(`${GO ? '▶ 올린다' : '미리보기(아무것도 안 올림)'} — ${EP}회차 ${STAMP} · 단계 ${[...ONLY].join(', ')}`);

// 1) 공개 주소용 브랜치: 기존 브랜치 위에 파일 다섯 개만 얹은 커밋. 이미 같은 파일이 있으면 건너뛴다.
if (ONLY.has('live')) {
  git('fetch', '-q', 'origin', 'claude/live');
  const base = git('rev-parse', 'origin/claude/live').stdout.trim();
  const same = FILES.every((f) => git('rev-parse', `${base}:cards/reels/${SLUG}/ko/${f}`).stdout.trim() === git('hash-object', `${LIVE}/${f}`).stdout.trim());
  if (same) console.log('· live: 이미 같은 파일이 올라가 있다 — 건너뜀');
  else if (!GO) console.log(`· live: claude/live(${base.slice(0, 7)}) 위에 cards/reels/${SLUG}/ko/ 파일 5개를 얹는다`);
  else {
    const idx = path.join(os.tmpdir(), `live-${Date.now()}.index`), env = { ...process.env, GIT_INDEX_FILE: idx };
    const g = (...a) => { const r = spawnSync('git', a, { cwd: R, encoding: 'utf8', env }); if (r.status !== 0) die(`git ${a[0]} 실패: ${r.stderr}`); return r.stdout.trim(); };
    g('read-tree', base);
    for (const f of FILES) g('update-index', '--add', '--cacheinfo', `100644,${g('hash-object', '-w', `${LIVE}/${f}`)},cards/reels/${SLUG}/ko/${f}`);
    const tree = g('write-tree'); fs.rmSync(idx, { force: true });
    const c = spawnSync('git', ['commit-tree', tree, '-p', base, '-m', `주간복기 ${NN} 발행본 — ${STAMP} 주 나스닥 되감기\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`], { cwd: R, encoding: 'utf8' }).stdout.trim();
    const p = git('push', 'origin', `${c}:refs/heads/claude/live`);
    if (p.status !== 0) die(`claude/live 푸시 실패: ${p.stderr}`);
    rec.live = { commit: c, at: new Date().toISOString() }; save();
    console.log(`✅ live: ${c.slice(0, 7)} 푸시`);
  }
}

// 2) 유튜브: 영상 + 자막 (--video 가 있으면 자막만)
const VID = args.video || rec.youtube?.video_id;
if (ONLY.has('youtube') || ONLY.has('captions')) {
  const a = ['scripts/weekly-shorts/render/publish-youtube.mjs', `--ko=${LIVE}/subtitles.ko.srt`, `--en=${LIVE}/subtitles.en.srt`];
  if (ONLY.has('youtube') && !VID) a.push(`--video=${LIVE}/reel.mp4`, `--title=${fs.readFileSync(at(`${OUT}/제목.txt`), 'utf8').trim()}`, `--desc-file=${OUT}/설명란.txt`, `--tags-file=${OUT}/태그.txt`);
  else if (VID) a.push(`--existing=${VID}`);
  else die('자막만 올리려면 --video=<유튜브 번호> 가 필요하다');
  if (GO) a.push('--confirm');
  const r = spawnSync(process.execPath, a, { cwd: R, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  out.split('\n').filter((l) => /채널|영상|제목|자막|미리보기|✅|❌/.test(l) && !/token/i.test(l)).forEach((l) => console.log('  ' + l.trim().slice(0, 160)));
  const id = (out.match(/영상 올림: (\S+)/) || [])[1];
  if (id) rec.youtube = { ...(rec.youtube || {}), video_id: id, url: `https://www.youtube.com/watch?v=${id}`, at: new Date().toISOString() };
  for (const lang of ['ko', 'en']) {
    if (new RegExp(`✅ ${lang} 자막`).test(out)) (rec.youtube ||= {}).captions = { ...(rec.youtube?.captions || {}), [lang]: 'ok' };
    if (new RegExp(`❌ ${lang} 자막`).test(out)) (rec.youtube ||= {}).captions = { ...(rec.youtube?.captions || {}), [lang]: /quota/.test(out) ? '한도 초과 — 오후 4시 뒤 --only=captions' : '실패' };
  }
  if (GO) save();
}

// 3) 인스타그램: 공개 주소가 열릴 때까지 기다린 뒤 올린다(4회차에서 4분 기다림으로는 모자랐다)
if (ONLY.has('instagram')) {
  if (rec.instagram?.media_id) console.log(`· instagram: 이미 올렸다 (${rec.instagram.media_id}) — 건너뜀`);
  else if (!GO) console.log(`· instagram: ${url('reel.mp4')} 가 열리면 릴스로 올린다`);
  else {
    for (let i = 0; ; i++) {
      const ok = await Promise.all(['reel.mp4', 'cover.png'].map((f) => fetch(url(f), { method: 'HEAD' }).then((x) => x.ok).catch(() => false)));
      if (ok.every(Boolean)) break;
      if (i >= 90) die('15분이 지나도 공개 주소가 안 열린다 — GitHub Pages 배포를 확인한다');
      await new Promise((s) => setTimeout(s, 10000));
    }
    const tool = at(`${OUT}/live/scripts/reels/publish-reel.mjs`);
    fs.mkdirSync(path.dirname(tool), { recursive: true });
    fs.writeFileSync(tool, git('show', 'origin/claude/live:scripts/reels/publish-reel.mjs').stdout);
    const r = spawnSync(process.execPath, [`--env-file=${IGENV}`, tool, SLUG, 'ko'], { cwd: at(`${OUT}/live`), encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    const mid = (out.match(/media id = (\d+)/) || [])[1];
    if (!mid) die(`인스타 실패: ${out.split('\n').filter((l) => /❌|오류|실패/.test(l)).join(' ').slice(0, 300)}`);
    const env = Object.fromEntries(fs.readFileSync(IGENV, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]));
    const pj = await (await fetch(`https://graph.instagram.com/v21.0/${mid}?fields=permalink&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN)}`)).json();
    rec.instagram = { media_id: mid, permalink: pj.permalink || null, at: new Date().toISOString() }; save();
    console.log(`✅ instagram: ${pj.permalink || mid}`);
  }
}

// 4) 고정 댓글 (backtest-reels 의 attach-youtube-extras.mjs — 한국 채널이 기본)
if (ONLY.has('comment')) {
  const id = args.video || rec.youtube?.video_id;
  const cf = at(`${OUT}/고정댓글.txt`);
  // 파일이 없으면 댓글 도구가 경로 글자를 그대로 댓글로 단다(4회차 미리보기에서 발견). 꼭 확인한다.
  if (!id) console.log('· comment: 유튜브 번호가 없어 건너뜀');
  else if (!fs.existsSync(cf) || !fs.readFileSync(cf, 'utf8').trim()) die(`고정 댓글 파일이 없다: ${OUT}/고정댓글.txt (발행문구 5-1 절)`);
  else if (rec.youtube?.pinned_comment?.id) console.log(`· comment: 이미 달았다 (${rec.youtube.pinned_comment.id}) — 건너뜀`);
  else {
    const a = [`--env-file=${KEYS}`, 'scripts/attach-youtube-extras.mjs', '--video', id, '--comment', at(`${OUT}/고정댓글.txt`)];
    if (!GO) a.push('--dry-run');
    const r = spawnSync(process.execPath, a, { cwd: path.join(R, '..', 'backtest-reels'), encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    out.split('\n').filter((l) => /댓글|고정|dry/i.test(l)).forEach((l) => console.log('  ' + l.trim().slice(0, 160)));
    const cid = (out.match(/댓글 달림 — id (\S+)/) || [])[1];
    if (cid) { (rec.youtube ||= {}).pinned_comment = { id: cid, pinned: false }; save(); }
  }
}

// 매니페스트 publish 에 옮겨 적는다
if (GO) {
  const M = JSON.parse(fs.readFileSync(at(MANI), 'utf8'));
  M.publish = { ...(typeof M.publish === 'object' ? M.publish : {}), ...rec, published_at: M.publish?.published_at || new Date(Date.now() + 9 * 3600e3).toISOString().replace('Z', '+09:00').slice(0, 19) + '+09:00' };
  fs.writeFileSync(at(MANI), JSON.stringify(M, null, 2) + '\n');
  console.log(`\n· 기록: ${OUT}/publish.json · ${MANI} 의 publish`);
}
