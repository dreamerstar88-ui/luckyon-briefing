import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// 경로는 이 파일 위치에서 계산한다. 어느 컴퓨터에서든 그대로 돈다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
// 저장소 뿌리를 위로 올라가며 찾는다 — 이 파일을 어느 폴더로 복사해도 그대로 돈다.
function findRoot(from){
  let d = from;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'assets', 'fonts'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  throw new Error('저장소 뿌리를 못 찾았다. luckyon-briefing 체크아웃 안에서 실행해야 한다.');
}
const R    = findRoot(HERE);                                 // 저장소 뿌리
const F    = path.join(R, 'assets', 'fonts');               // 폰트(woff2)
const args = Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true]}));
const SCENE = args.scene || path.join(HERE, 'scene.js');
const OUT   = args.out   || path.join(R, 'out', 'frames');
const DATA  = args.data  || path.join(R, 'data', 'weekly-shorts', '2026-09-14.5m.json');
const W=1080,H=1920,FPS=30,DUR=35.0;

// ── 데이터: 3회차 2026-09-14(월) 개장 ~ 09-18(금) 마감. 휴장 없는 5거래일.
// 심볼은 그 주 실제 월물(NQZ26.CME). 연속 심볼 NQ=F 는 09-14 11:30(동부)에
// 12월물로 갈아타며 +1.295% 짜리 가짜 봉을 만든다 — 지침서 2-9.
const all=JSON.parse(fs.readFileSync(DATA,'utf8'));
const raw=all.filter(x=>'2026-09-14 09:30'<=x.d&&x.d<='2026-09-18 16:00');
const kstOf=et=>{const d=new Date(et.replace(' ','T')+'Z');d.setUTCHours(d.getUTCHours()+13);
  const w='일월화수목금토'[d.getUTCDay()];
  return `${d.getUTCMonth()+1}/${d.getUTCDate()} ${w} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;};
const BARS=raw.map(x=>({d:x.d,o:x.o,h:x.h,l:x.l,c:x.c,kst:kstOf(x.d)}));
const DAYS=[...new Set(BARS.map(x=>x.d.slice(0,10)))];
const idxOf=d=>BARS.findIndex(x=>x.d===d);
const lo=Math.min(...BARS.map(b=>b.l)),hi=Math.max(...BARS.map(b=>b.h)),pad=(hi-lo)*.14;
let pk=-1e9,pi=0,mdd=0,mp=0,mt=0;
BARS.forEach((b,i)=>{if(b.h>pk){pk=b.h;pi=i;}const dd=b.l/pk-1;if(dd<mdd){mdd=dd;mp=pi;mt=i;}});
const STATS={weekPct:(BARS[BARS.length-1].c/BARS[0].o-1)*100,peakIdx:mp,troughIdx:mt,mdd:mdd*100,n:BARS.length};
console.log(`봉 ${BARS.length} · 주간 ${STATS.weekPct.toFixed(2)}% · 최대낙폭 ${STATS.mdd.toFixed(2)}% (${BARS[mp].kst} → ${BARS[mt].kst})`);
const C={down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d'};
const d0=BARS[0].d.slice(0,10), d1=BARS.at(-1).d.slice(0,10);
const DOW='일월화수목금토';
const EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dw=x=>DOW[new Date(x+'T00:00:00Z').getUTCDay()];
const fmt0=n=>Math.round(n).toLocaleString('en-US');
// 사건 선정 규칙은 GUIDE_WEEKLY_SHORTS.md 4장. 경제지표뿐 아니라 기업 실적·뉴스도
// 후보이며, 훑었다는 기록을 매니페스트 coverage 에 남겨야 발행이 통과한다(4-1).
const chgAll=[];for(let k=1;k<BARS.length;k++)chgAll.push({d:BARS[k].d,p:(BARS[k].c/BARS[k-1].c-1)*100});
const rankOf=new Map([...chgAll].sort((a,b)=>Math.abs(b.p)-Math.abs(a.p)).map((x,k)=>[x.d,k+1]));
const pctOfET=new Map(chgAll.map(x=>[x.d,x.p]));
const colOf=p=>Math.abs(p)<0.05?C.hi:(p>0?C.up:C.down);
const RAW=[
 {et:"2026-09-14 11:30",stars:1,when:"월 장중 · 한국 화 새벽 12시 30분",
  l1:"6개월물 국채 입찰 4.060%.",l2:"직전은 3.890%였다.",tag:"국채입찰",
  en:"6-month Treasury bill auction 4.060%, up from 3.890%",
  te:"6-month bill auction",actual:"4.060%",cf:"previous",cv:"3.890%",
  why:"그날 ★★★ 없음 · 최고등급 ★ · 장중 · 같은 시각 둘"},
 {et:"2026-09-15 08:30",stars:2,when:"화 프리장 · 한국 화 밤 9시 30분",
  l1:"뉴욕 제조업 지수 7.6.",l2:"예상은 14.75였다.",tag:"제조업지수",
  en:"NY Empire State manufacturing 7.6, forecast 14.75",
  te:"ny empire state manufacturing index",actual:"7.60",cf:"consensus",cv:"14.75",
  why:"그날 ★★★ 없음 · 최고등급 ★★ · 장중 발표 없어 등락률로"},
 {et:"2026-09-16 08:30",stars:3,when:"수 프리장 · 한국 수 밤 9시 30분",
  l1:"소매판매 +1.2%.",l2:"예상은 +0.8%였다.",tag:"소매판매",
  en:"Retail sales +1.2% MoM, forecast +0.8%",
  te:"retail sales mom",actual:"1.2%",cf:"consensus",cv:"0.8%",
  why:"★★★ 전부 넣는다"},
 {et:"2026-09-16 14:00",stars:3,when:"수 장중 · 한국 목 새벽 3시",
  l1:"기준금리 4.00%.",l2:"예상도 4.00%였다.",tag:"금리결정",
  en:"Fed sets rates at 4.00%, matching forecast",
  te:"fed interest rate decision",actual:"4%",cf:"consensus",cv:"4%",
  why:"★★★ 전부 넣는다"},
 {et:"2026-09-16 14:30",stars:3,when:"수 장중 · 한국 목 새벽 3시 30분",
  l1:"연준 기자회견 시작.",l2:"금리 결정 30분 뒤였다.",tag:"기자회견",
  en:"Fed press conference begins, 30 minutes after the decision",
  te:"fed press conference",actual:"",cf:"",cv:"",
  why:"★★★ 전부 넣는다"},
 {et:"2026-09-17 08:30",stars:3,when:"목 프리장 · 한국 목 밤 9시 30분",
  l1:"주택 착공 127.5만 채.",l2:"예상은 131만이었다.",tag:"주택착공",
  en:"Housing starts 1.275M, forecast 1.31M",
  te:"housing starts",actual:"1.275M",cf:"consensus",cv:"1.31M",
  why:"★★★ 전부 넣는다"},
 {et:"2026-09-18 11:45",stars:2,when:"금 장중 · 한국 토 새벽 12시 45분",
  l1:"연준 슈미트 연설.",l2:"이번 주 마지막 연준 발언이었다.",tag:"연준발언",
  en:"Fed Schmid speaks, the week’s last Fed remarks",
  te:"fed schmid speech",actual:"",cf:"",cv:"",
  why:"그날 ★★★ 없음 · 최고등급 ★★ · 장중 둘 중 등락률로"},
];
const EVENTS=RAW.map(e=>{const p=pctOfET.get(e.et);
  return {...e,i:idxOf(e.et),pct:+p.toFixed(3),rank:rankOf.get(e.et),col:colOf(p)};})
  .filter(e=>e.i>0).sort((a,b)=>a.i-b.i);
if(EVENTS.length!==RAW.length){console.error('사건 인덱스 실패');process.exit(1);}
// 이번 회차 질문: 금리 결정과 기자회견 중 어느 쪽이 지수를 움직였나
const PAIR=['금리결정','기자회견'];
const pairEv=PAIR.map(t=>EVENTS.find(e=>e.tag===t));
if(pairEv.some(e=>!e)){console.error('짝 사건을 못 찾았다',PAIR);process.exit(1);}
const top=pairEv.reduce((a,b)=>Math.abs(b.pct)>Math.abs(a.pct)?b:a);
top.rankTop=true;
EVENTS.forEach((e,k)=>console.log(`  사건${k+1} ${e.et} ${'★'.repeat(e.stars)} ${e.pct>=0?'+':''}${e.pct}% ${e.rank}위 — ${e.l1}${e===top?'  ← 정답':''}`));

const NAMES={'금리결정':'금리 결정','기자회견':'기자회견','국채입찰':'6개월물 국채 입찰',
             '제조업지수':'뉴욕 제조업 지수','소매판매':'소매판매','주택착공':'주택 착공','연준발언':'연준 발언'};
const QUIZ={ans:PAIR.indexOf(top.tag),opts:PAIR.map(t=>NAMES[t])};
if(QUIZ.ans<0){console.error('정답 사건이 보기에 없다:',top.tag);process.exit(1);}
const rank3=[...EVENTS].sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,3);
const sgn=v=>(v>=0?'+':'')+v.toFixed(2)+'%';
const other=pairEv.find(e=>e!==top);
const COPY={
  kicker:`지난주 나스닥 · ${dw(d0)} 개장 ~ ${dw(d1)} 마감`,
  span:`${dw(d0)}요일 개장 → ${dw(d1)}요일 마감`,
  q1:'수요일, 3년 만의 첫 금리 인상.',
  q2:'지수를 움직인 건 어느 쪽?',
  enHook:`Nasdaq 100, ${EN[new Date(d0+'T00:00:00Z').getUTCDay()]} to ${EN[new Date(d1+'T00:00:00Z').getUTCDay()]}. The decision, or the presser?`,
  ansName:NAMES[top.tag],
  ansBig:sgn(top.pct),
  ansSub1:`${NAMES[other.tag]}은 ${sgn(other.pct)}에 그쳤다`,
  ansSub2:`5분봉 ${chgAll.length.toLocaleString('en-US')}개 변동 중 ${top.rank}위`,
  enAnswer:`The press conference — ${sgn(top.pct)} against ${sgn(other.pct)} for the decision`,
  summ1:'금리는 예상대로였다.',
  summ2:'움직인 건 그 30분 뒤였다.',
  // 범위를 반드시 밝힌다. 이 표는 «고른 사건 7개» 중 순위이지 그 주 5분봉 1,178개
  // 전체의 순위가 아니다. 3위 금리 결정은 주 전체로는 53위다. 2회차는 이 줄이
  // «of the week» 이라 틀린 채로 나갔다(그때 표의 실제 주간 순위는 1·6·17위).
  rowsScope:'이번 주 고른 사건 7개 중 · 5분봉 전체 순위는 아니다',
  enSumm:'The three biggest moves among this week’s scheduled events',
  // 1위(-0.283)와 2위(+0.277)가 두 자리에서는 둘 다 0.28 로 찍혀 왜 이 순서인지
  // 화면만 보고는 알 수 없다. 이 표에서만 세 자리로 쓴다.
  rows:rank3.map((e,k)=>[`${k+1}위 · ${NAMES[e.tag]}`,(e.pct>=0?'+':'')+e.pct.toFixed(3)+'%',e.pct>=0?'up':'down']),
  // 기자회견은 «발표» 가 아니다. 지표든 회견이든 맞는 말로 둔다.
  loopLabel:'지수를 움직인 건', loopBig:NAMES[top.tag], loopTail:`5분 만에 ${sgn(top.pct)}`,
};
console.log(`질문: ${NAMES[top.tag]} ${sgn(top.pct)} vs ${NAMES[other.tag]} ${sgn(other.pct)}`);

const b64=p=>fs.readFileSync(p).toString('base64');
const photo='data:image/jpeg;base64,'+b64(`${R}/data/card-photos/2026-08-28-pm/card3.jpg`);
const scene=String(SCENE).split(',').map(f=>fs.readFileSync(path.isAbsolute(f)||f.includes('/')?f:path.join(HERE,f),'utf8')).join('\n');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:PD;src:url(data:font/woff2;base64,${b64(`${F}/Pretendard-Medium.woff2`)}) format('woff2');font-weight:500}
@font-face{font-family:PD;src:url(data:font/woff2;base64,${b64(`${F}/Pretendard-Bold.woff2`)}) format('woff2');font-weight:700}
@font-face{font-family:PD;src:url(data:font/woff2;base64,${b64(`${F}/Pretendard-Black.woff2`)}) format('woff2');font-weight:900}
@font-face{font-family:PEN;src:url(data:font/woff2;base64,${b64(`${F}/NanumPenScript-Korean.woff2`)}) format('woff2');font-weight:400}
*{margin:0;padding:0}html,body{width:1080px;height:1920px;overflow:hidden;background:#000}
canvas{display:block}</style></head><body>
<canvas id="c" width="1080" height="1920"></canvas>
<img id="p" src="${photo}" style="display:none">
<script>${scene}
window.__init=function(data){BARS=data.bars;EVENTS=data.events;DAYS=data.days;STATS=data.stats;COPY=data.copy;QUIZ=data.quiz;
 LO=data.lo;HI=data.hi;buildSchedule();buildBg(document.getElementById('p'));return SCHED.length;};
window.__draw=function(t){draw(t);};
</script></body></html>`;

// 브라우저 경로를 박지 않는다. playwright 가 이 컴퓨터의 캐시에서 알아서 찾는다.
// (원본은 클라우드의 /opt/pw-browsers 를 가리켜 이 컴퓨터에서는 못 돌았다.)
const browser=await chromium.launch({args:['--force-color-profile=srgb','--disable-lcd-text']});
const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
page.on('pageerror',e=>console.error('PAGEERROR',e.message));
await page.setContent(html,{waitUntil:'load'});
await page.evaluate(()=>document.fonts.ready);
await page.evaluate(()=>new Promise(r=>{const i=document.getElementById('p');i.complete?r():i.onload=r;}));
const nseg=await page.evaluate(d=>window.__init(d),{bars:BARS,events:EVENTS,days:DAYS,stats:STATS,lo:lo-pad,hi:hi+pad,copy:COPY,quiz:QUIZ});
console.log('구간',nseg);
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
if(args.sample){
  for(const t of String(args.sample).split(',').map(Number)){
    await page.evaluate(s=>window.__draw(s),t);
    await page.screenshot({path:`${OUT}/t${String(t).replace('.','_')}.png`});console.log('샘플',t);}
}else{
  const N=Math.round(DUR*FPS),t0=Date.now();
  for(let f=0;f<N;f++){
    await page.evaluate(s=>window.__draw(s),f/FPS);
    await page.screenshot({path:`${OUT}/f${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});
    if(f%150===0)console.log(`  ${f}/${N}  ${((Date.now()-t0)/1000).toFixed(0)}초`);}
  console.log(`프레임 ${N}장 완료 ${((Date.now()-t0)/1000).toFixed(0)}초`);
}
await browser.close();
