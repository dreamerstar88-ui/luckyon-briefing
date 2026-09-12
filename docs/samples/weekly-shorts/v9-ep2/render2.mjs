import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const SP='/tmp/claude-0/-home-user-luckyon-briefing/4df77974-546d-5987-a418-39f318dc6bbd/scratchpad';
const R='/home/user/luckyon-briefing', F=`${R}/assets/fonts`;
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true]}));
const SCENE=args.scene||`${SP}/vid/scene.js`;
const OUT=args.out||`${SP}/vid/frames2`;
const W=1080,H=1920,FPS=30,DUR=35.0;

// ── 데이터: 2회차 2026-09-08(화) 개장 ~ 09-11(금) 마감. 9/7 월요일은 노동절 휴장.
const all=JSON.parse(fs.readFileSync(`${SP}/us5m_nqf.json`,'utf8'));
const raw=all.filter(x=>'2026-09-08 09:30'<=x.d&&x.d<='2026-09-11 16:00');
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
// 사건 선정: ① 거래일마다 1개 ② TE 중요도 높은 순 ③ 동률이면 장중 우선, 다음 등락률
const EVENTS=[
 {i:idxOf('2026-09-08 13:00'),when:'화 장중 · 한국 수 새벽 2시',l1:'3년물 국채 입찰 4.474%.',l2:'직전은 4.291%였다.',tag:'국채입찰',
  en:'3-year Treasury auction yield 4.474%, up from 4.291%',col:C.up,why:'★ · 그날 최고등급 · 장중 · +0.19% 13위'},
 {i:idxOf('2026-09-09 08:15'),when:'수 프리장 · 한국 밤 9시 15분',l1:'ADP 주간 고용 1.2만 명.',l2:'직전은 1.0만이었다.',tag:'고용지표',
  en:'ADP weekly employment change 12K, up from 10K',col:C.hi,why:'★★ · 그날 최고등급 · 장중 없음 · +0.02% 477위'},
 {i:idxOf('2026-09-10 10:00'),when:'목 장중 · 한국 밤 11시',l1:'기존주택 판매 398만 채.',l2:'예상도 398만이었다.',tag:'주택지표',
  en:'Existing home sales 3.98M, matching forecast',col:C.up,why:'★★★ · 장중(PPI는 프리장) · +0.17% 17위'},
 {i:idxOf('2026-09-11 10:00'),when:'금 장중 · 한국 밤 11시',l1:'미시간 소비자심리 47.8.',l2:'예상은 51이었다.',tag:'소비심리',
  en:'Michigan consumer sentiment 47.8, forecast 51',col:C.down,why:'★★★ · 장중(CPI는 프리장) · -0.27% 6위'},
].filter(e=>e.i>0).sort((a,b)=>a.i-b.i);
EVENTS.forEach((e,k)=>console.log(`  사건${k+1} idx ${e.i} ${e.when} — ${e.why}`));
if(EVENTS.length!==4){console.error('사건 수가 4가 아니다:',EVENTS.length);process.exit(1);}

// ── 회차 문구와 퀴즈 보기 (코드에 박지 않는다)
const d0=BARS[0].d.slice(0,10), d1=BARS[BARS.length-1].d.slice(0,10);
const DOW='일월화수목금토';
const EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt0=n=>Math.round(n).toLocaleString('en-US');
const DAYN={1:'하루',2:'이틀',3:'사흘',4:'나흘',5:'닷새'};
const dw=s=>DOW[new Date(s+'T00:00:00Z').getUTCDay()];
// ── 이번 회차 질문: "시가 위에서 끝난 봉이 있었나"
// 고르는 근거는 scripts/weekly-shorts/pick-question.mjs 의 특이도 순위다.
// 과거 100주 중앙값은 69%인데 이번 주는 0%다 — 904개 봉 중 하나도 시가 위에서 끝나지 못했다.
// 1·2회차처럼 "최대 낙폭"을 되풀이하지 않는다. 낙폭은 정의상 늘 음수라 매주 같은 그림이 된다.
const openPx=BARS[0].o;
const aboveN=BARS.filter(b=>b.c>=openPx).length;
const hiBar=BARS.reduce((a,b)=>b.h>a.h?b:a,BARS[0]);
const COPY={
  kicker:`지난주 나스닥 · ${dw(d0)} 개장 ~ ${dw(d1)} 마감`,
  span:`${dw(d0)}요일 개장 → ${dw(d1)}요일 마감`,
  q1:`고점은 ${dw(hiBar.d.slice(0,10))}요일 개장 첫 5분이었습니다.`,
  q2:'시가 위에서 끝난 5분봉은?',
  enHook:`Nasdaq 100, ${EN[new Date(d0+'T00:00:00Z').getUTCDay()]} to ${EN[new Date(d1+'T00:00:00Z').getUTCDay()]}. How many bars closed above the open?`,
  ansBig:`${aboveN}개`,
  ansSub1:`5분봉 ${BARS.length.toLocaleString('en-US')}개 중 하나도 없었다`,
  // 마감은 한국시간으로 쓰면 '9/12 토' 가 되어 헷갈린다. 거래일(미국 날짜)로 적는다.
  ansSub2:`${hiBar.kst.slice(0,-6)} 고점 ${fmt0(hiBar.h)} → ${dw(d1)}요일 마감 ${fmt0(BARS.at(-1).c)}`,
  enAnswer:`Not one of ${BARS.length.toLocaleString('en-US')} bars closed above the open`,
  summ1:`${DAYN[BARS.length&&DAYS.length]||DAYS.length+'일'} 내내`, summ2:'종가가 시가를 넘지 못했다.',
  enSumm:'Four trading days, and it never closed back above where it opened',
  loopLabel:'시가 위에서 끝난 봉', loopBig:`${aboveN}개`, loopTail:`${BARS.length.toLocaleString('en-US')}개를 다 돌려봐도 하나도 없었다`,
};
const QUIZ={ans:0,opts:['0개','87개','240개']};
console.log(`질문: 시가 ${fmt0(openPx)} 위에서 끝난 봉 = ${aboveN}개 / ${BARS.length}개`);

const b64=p=>fs.readFileSync(p).toString('base64');
const photo='data:image/jpeg;base64,'+b64(`${R}/data/card-photos/2026-08-28-pm/card3.jpg`);
const scene=String(SCENE).split(',').map(f=>fs.readFileSync(f.includes('/')?f:`${SP}/vid/${f}`,'utf8')).join('\n');
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

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
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
