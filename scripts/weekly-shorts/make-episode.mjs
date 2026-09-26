// 주간 쇼츠 한 회차를 명령 하나로 만든다 — 2026-09-26 대표 지시 «쓸데없는 거 다 빼고 간결하게».
//
//   node scripts/weekly-shorts/make-episode.mjs --stamp=2026-09-28 --ep=5 --fetch
//
// 사람이 먼저 할 일은 둘뿐이다.
//   1) 매니페스트 content/weekly-shorts/<stamp>.json — 창·사건·질문·보기·화면/자막 문구
//   2) 회차 폴더(docs/samples/weekly-shorts/ep<NN>/)의 발행문구.md — 앞 회차 것을 복사해 고친다
// 이 명령이 하는 일(실패하면 그 자리에서 멈춘다):
//   [--fetch 5분봉·1시간봉 받기] → 틀 복사 → 렌더(글꼴·겹침·줄 폭 자동 검사) → 인코딩·음악·표지
//   → 자막 → 기계 검사(약 10초, 두 번째 출처·영상 파일·발행문구까지) → 장면표본 한 장 → 올릴 파일 모으기
// 올리기는 publish-episode.mjs 가 한다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import FF from 'ffmpeg-static';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const STAMP = args.stamp, EP = Number(args.ep);
if (!STAMP || !EP) die('--stamp=<그 주 월요일> --ep=<회차 번호> 가 필요하다');
const NN = String(EP).padStart(2, '0');
const DIR = args.dir || `docs/samples/weekly-shorts/ep${NN}`;
const OUT = args.out || `out/ep${EP}`;
const MANI = `content/weekly-shorts/${STAMP}.json`;
const HIST = 'data/weekly-shorts/us1h_nqf.json';
const at = (p) => path.join(R, p);
if (!fs.existsSync(at(MANI))) die(`매니페스트가 없다: ${MANI}`);
if (!fs.existsSync(at(path.join(DIR, '발행문구.md')))) die(`${DIR}/발행문구.md 를 먼저 쓴다(앞 회차 것을 복사해 고친다)`);
const M = JSON.parse(fs.readFileSync(at(MANI), 'utf8'));
const t0 = Date.now();
const run = (name, cmd, argv) => {
  console.log(`\n▶ ${name}`);
  const r = spawnSync(cmd, argv, { cwd: R, stdio: 'inherit' });
  if (r.status !== 0) die(`${name} 실패 — 여기서 멈춘다`);
};
const node = process.execPath;
const fri = new Date(STAMP + 'T00:00:00Z'); fri.setUTCDate(fri.getUTCDate() + 4);
const FRI = fri.toISOString().slice(0, 10);

if (args.fetch) {
  run('5분봉 받기', node, ['scripts/weekly-shorts/render/fetch-week.mjs', `--symbol=${M.window.symbol}`, `--from=${STAMP}`, `--to=${FRI}`]);
  run('1시간봉 2년 받기', node, ['scripts/weekly-shorts/render/fetch-week.mjs', '--symbol=NQ=F', '--interval=1h', '--range=2y', `--from=${STAMP}`, `--to=${FRI}`, `--out=${HIST}`]);
}

// 틀 복사 — 폴더에 없을 때만. 날짜(STAMP)와 자막 이름(BASE) 줄은 자동으로 바꾼다.
fs.mkdirSync(at(DIR), { recursive: true });
for (const f of ['render.mjs', 'scene.js', 'srt2.mjs']) {
  const dst = at(path.join(DIR, f));
  if (fs.existsSync(dst)) continue;
  let s = fs.readFileSync(at(path.join('scripts/weekly-shorts/render', f)), 'utf8');
  s = s.replace(/const STAMP = args\.stamp \|\| '[^']*';/, `const STAMP = args.stamp || '${STAMP}';`)
       .replace(/const BASE  = args\.base \|\| '[^']*';/, `const BASE  = args.base || 'luckyon-nasdaq-week${EP}';`);
  fs.writeFileSync(dst, s);
  console.log(`· 틀 복사: ${DIR}/${f}`);
}

run('렌더 (1,050프레임)', node, [path.join(DIR, 'render.mjs'), `--out=${OUT}/frames`]);

// 음악은 3회차부터 같은 값: 곡의 첫 정점(29초)이 정답 공개 시각에 오게 자르고, 요약 시작부터 줄인다.
const S = M.video.sections, DUR = M.video.duration;
const cut = (29 - S.answer[0]).toFixed(1), fo = S.summ[0], fd = (DUR - S.summ[0]).toFixed(1);
const VID = path.join(DIR, `reel${EP}_35s.mp4`), COVER = path.join(DIR, `cover_ep${EP}.png`);
run('인코딩', FF, ['-v', 'error', '-y', '-framerate', '30', '-i', `${OUT}/frames/f%05d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/silent.mp4`]);
run(`음악 (곡 ${cut}초부터 · ${fo}초부터 ${fd}초 페이드아웃)`, FF, ['-v', 'error', '-y', '-ss', cut, '-i', 'assets/bgm/lyria-build-v1.mp3', '-t', String(DUR),
  '-af', `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=3.0,afade=t=out:st=${fo}:d=${fd}:curve=ipar`, '-ar', '48000', '-ac', '2', `${OUT}/bgm.wav`]);
run('합치기', FF, ['-v', 'error', '-y', '-i', `${OUT}/silent.mp4`, '-i', `${OUT}/bgm.wav`, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', VID]);
run('표지 (훅 글이 다 뜬 4.0초 프레임)', FF, ['-v', 'error', '-y', '-i', VID, '-ss', '4.0', '-frames:v', '1', COVER]);
run('자막', node, [path.join(DIR, 'srt2.mjs')]);
run('기계 검사', node, ['scripts/weekly-shorts/verify-shorts.mjs', MANI, '--srt', DIR, '--hist', HIST]);

// 장면표본 한 장: 0초 + 자막 구간마다 끝나기 0.6초 전(그 장면 글이 다 뜬 뒤). 사람은 이 한 장만 본다.
const srt = fs.readFileSync(at(fs.readdirSync(at(DIR)).filter((f) => f.endsWith('.ko.srt')).map((f) => path.join(DIR, f))[0]), 'utf8');
const ends = [...srt.matchAll(/--> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000);
const times = [0, ...ends.map((e) => Math.min(e - 0.6, DUR - 0.05))];
const sel = times.map((t) => `eq(n\\,${Math.round(t * 30)})`).join('+');
const cols = 6, rows = Math.ceil(times.length / cols);
const SHEET = `${OUT}/장면표본.png`;
run('장면표본 한 장', FF, ['-v', 'error', '-y', '-i', VID, '-vf', `select='${sel}',scale=360:640,tile=${cols}x${rows}`, '-frames:v', '1', '-vsync', 'vfr', SHEET]);

// 올릴 파일 모으기 (공개 주소용 브랜치에 들어갈 다섯 개 + 유튜브 문구)
const doc = fs.readFileSync(at(path.join(DIR, '발행문구.md')), 'utf8');
const block = (h) => (doc.match(new RegExp('##\\s*' + h + '[^\\n]*\\n+```\\n([\\s\\S]*?)\\n```')) || [])[1] || '';
const LIVE = `${OUT}/live/cards/reels/nasdaq-week-${STAMP}/ko`;
fs.mkdirSync(at(LIVE), { recursive: true });
const ko = fs.readdirSync(at(DIR)).find((f) => f.endsWith('.ko.srt')), en = fs.readdirSync(at(DIR)).find((f) => f.endsWith('.en.srt'));
fs.copyFileSync(at(VID), at(`${LIVE}/reel.mp4`));
fs.copyFileSync(at(COVER), at(`${LIVE}/cover.png`));
fs.copyFileSync(at(path.join(DIR, ko)), at(`${LIVE}/subtitles.ko.srt`));
fs.copyFileSync(at(path.join(DIR, en)), at(`${LIVE}/subtitles.en.srt`));
fs.writeFileSync(at(`${LIVE}/caption.txt`), block('5\\.') + '\n');
fs.writeFileSync(at(`${OUT}/제목.txt`), (doc.match(/##\s*1\.[^\n]*\n+\*\*(.+?)\*\*/) || [])[1] || '');
fs.writeFileSync(at(`${OUT}/설명란.txt`), block('2\\.') + '\n');
fs.writeFileSync(at(`${OUT}/태그.txt`), block('3\\.').replace(/\n/g, ' ').split(',').map((t) => t.trim()).filter(Boolean).join(', ') + '\n');
fs.writeFileSync(at(`${OUT}/고정댓글.txt`), block('5-1\\.') + '\n');

console.log(`\n✅ ${EP}회차 완성 (${Math.round((Date.now() - t0) / 1000)}초)`);
console.log(`   영상 ${VID}`);
console.log(`   장면표본 ${SHEET}  ← 이 한 장만 보고 확인한다`);
console.log(`   올리기: node scripts/weekly-shorts/publish-episode.mjs --stamp=${STAMP} --ep=${EP}${args.dir ? ` --dir=${DIR}` : ''} --confirm`);
