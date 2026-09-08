import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const SP='/tmp/claude-0/-home-user-luckyon-briefing/4df77974-546d-5987-a418-39f318dc6bbd/scratchpad';
const R='/home/user/luckyon-briefing', F=`${R}/assets/fonts`;
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true]}));
const OUT=args.out||`${SP}/vid/frames`;
const W=1080,H=1920,FPS=30,DUR=30.0;

// ── 데이터
const all=JSON.parse(fs.readFileSync(`${SP}/us5m_nqf.json`,'utf8'));
const raw=all.filter(x=>'2026-08-31 09:30'<=x.d&&x.d<='2026-09-04 16:00');
const kstOf=et=>{const d=new Date(et.replace(' ','T')+'Z');d.setUTCHours(d.getUTCHours()+13);
  const w='일월화수목금토'[d.getUTCDay()];
  return `${d.getUTCMonth()+1}/${d.getUTCDate()} ${w} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;};
const BARS=raw.map(x=>({d:x.d,o:x.o,h:x.h,l:x.l,c:x.c,kst:kstOf(x.d)}));
const DAYS=[...new Set(BARS.map(x=>x.d.slice(0,10)))];
const idxOf=d=>BARS.findIndex(x=>x.d===d);
const lo=Math.min(...BARS.map(b=>b.l)),hi=Math.max(...BARS.map(b=>b.h)),pad=(hi-lo)*.14;
// 최대 낙폭
let pk=-1e9,pi=0,mdd=0,mp=0,mt=0;
BARS.forEach((b,i)=>{if(b.h>pk){pk=b.h;pi=i;}const dd=b.l/pk-1;if(dd<mdd){mdd=dd;mp=pi;mt=i;}});
const STATS={weekPct:(BARS[BARS.length-1].c/BARS[0].o-1)*100,peakIdx:mp,troughIdx:mt,mdd:mdd*100};
console.log(`봉 ${BARS.length} · 주간 ${STATS.weekPct.toFixed(2)}% · 최대낙폭 ${STATS.mdd.toFixed(2)}% (${BARS[mp].kst} → ${BARS[mt].kst})`);
const C={down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d'};
// 사건 선정 기준 (아래 세 가지 중 하나를 만족하는 지점만 쓴다)
//  ① 구조점: 그 주의 최저점 (데이터가 정한다)
//  ② 충격점: 5분봉 등락률 절댓값 상위 봉이면서 그 시각에 확인된 뉴스·지표 발표가 있는 것
//  ③ 전환점: 최저점 이후 반등이 시작된 봉
const EVENTS=[
 {i:idxOf('2026-09-01 04:05'),when:'화 저녁 5시',l1:'호르무즈 유조선 피격.',l2:'미 국채 금리 급등.',col:C.down,why:'② 5분봉 변동 2위 -0.32% + 뉴스 확인'},
 {i:idxOf('2026-09-02 07:00'),when:'수 저녁 8시',l1:'주간 최저 28,927.',l2:'고점 대비 -2.2%.',col:C.down,why:'① 주간 최저점'},
 {i:idxOf('2026-09-03 09:35'),when:'목 밤 10시 35분',l1:'미국 개장과 함께',l2:'반등 시작.',col:C.up,why:'③ 반등 시작 + 5분봉 변동 3위 +0.25%'},
 {i:idxOf('2026-09-04 08:30'),when:'금 저녁 9시 30분',l1:'8월 고용 16.2만 명.',l2:'예상은 5.5만이었다.',col:C.hi,why:'② 5분봉 변동 1위 -0.41% + 고용지표 발표'},
].filter(e=>e.i>0).sort((a,b)=>a.i-b.i);
EVENTS.forEach((e,k)=>console.log(`  사건${k+1} idx ${e.i} ${e.when} — ${e.why}`));

const b64=p=>fs.readFileSync(p).toString('base64');
const photo='data:image/jpeg;base64,'+b64(`${R}/data/card-photos/2026-08-28-pm/card3.jpg`);
const scene=fs.readFileSync(`${SP}/vid/scene.js`,'utf8');
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
window.__init=function(data){BARS=data.bars;EVENTS=data.events;DAYS=data.days;STATS=data.stats;
 LO=data.lo;HI=data.hi;buildSchedule();buildBg(document.getElementById('p'));return SCHED.length;};
window.__draw=function(t){draw(t);};
</script></body></html>`;

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
await page.setContent(html,{waitUntil:'load'});
await page.evaluate(()=>document.fonts.ready);
await page.evaluate(()=>new Promise(r=>{const i=document.getElementById('p');i.complete?r():i.onload=r;}));
const nseg=await page.evaluate(d=>window.__init(d),{bars:BARS,events:EVENTS,days:DAYS,stats:STATS,lo:lo-pad,hi:hi+pad});
console.log('구간',nseg);

fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
if(args.sample){
  const times=String(args.sample).split(',').map(Number);
  for(const t of times){await page.evaluate(s=>window.__draw(s),t);
    await page.screenshot({path:`${OUT}/t${String(t).replace('.','_')}.png`});console.log('샘플',t);}
}else{
  const N=Math.round(DUR*FPS);
  const t0=Date.now();
  for(let f=0;f<N;f++){
    await page.evaluate(s=>window.__draw(s),f/FPS);
    await page.screenshot({path:`${OUT}/f${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});
    if(f%150===0)console.log(`  ${f}/${N}  ${((Date.now()-t0)/1000).toFixed(0)}초`);
  }
  console.log(`프레임 ${N}장 완료 ${((Date.now()-t0)/1000).toFixed(0)}초`);
}
await browser.close();
