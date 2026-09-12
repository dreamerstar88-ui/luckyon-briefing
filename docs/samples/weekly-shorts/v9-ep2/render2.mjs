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
 {i:idxOf('2026-09-08 13:00'),when:'화 장중 · 한국 새벽 2시',l1:'3년물 국채 입찰 4.474%.',l2:'직전은 4.291%였다.',tag:'국채입찰',
  en:'3-year Treasury auction yield 4.474%, up from 4.291%',col:C.hi,why:'★ · 그날 최고등급 · 장중 · +0.19% 13위'},
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
const dw=s=>DOW[new Date(s+'T00:00:00Z').getUTCDay()];
const COPY={
  kicker:`지난주 나스닥 · ${dw(d0)} 개장 ~ ${dw(d1)} 마감`,
  span:`${dw(d0)}요일 개장 → ${dw(d1)}요일 마감`,
  enHook:`Nasdaq 100 futures, ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d0+'T00:00:00Z').getUTCDay()]} open to ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d1+'T00:00:00Z').getUTCDay()]} close. How deep was the drawdown?`,
  summ1:'이번 주 바닥도, 꼭대기도', summ2:'한국 저녁에 나왔다.',
  enSumm:"The week's low and high both landed in Korean evening hours",
};
// 정답이 늘 ③이면 몇 회차 만에 패턴이 읽힌다. 주차에 따라 자리를 옮긴다.
const wk=Math.floor((Date.UTC(2026,8,8)-Date.UTC(2026,0,1))/864e5/7);
const ansIdx=wk%3;
const M=[[1,1.5,2.1],[0.58,1,1.5],[0.42,0.7,1]][ansIdx];
const r1=v=>(Math.round(v*10)/10).toFixed(1)+'%';
const QUIZ={ans:ansIdx,opts:M.map((m,k)=>k===ansIdx?r1(STATS.mdd):r1(STATS.mdd*m))};
console.log('퀴즈',QUIZ.opts.join(' / '),'정답',['①','②','③'][ansIdx]);

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
