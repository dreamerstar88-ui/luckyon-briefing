import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const SP='/tmp/claude-0/-home-user-luckyon-briefing/4df77974-546d-5987-a418-39f318dc6bbd/scratchpad';
const R='/home/user/luckyon-briefing', F=`${R}/assets/fonts`;
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true]}));
const OUT=args.out||`${SP}/vid/frames`;
const W=1080,H=1920,FPS=30,DUR=35.0;

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
// 사건 선정 기준 (대표 지시 규칙 그대로)
//  ① 하루 최소 1개
//  ② 거시지표는 ★★★ 우선, 그날 ★★★가 없으면 ★★
//  ③ 같은 조건이면 장중(미 동부 09:30~16:00) 우선, 그 다음 등락률
//     — 프리장·애프터장은 거래량이 얕아 등락률을 그대로 비교하기 어렵다
//  ④ 별표는 트레이딩이코노믹스 캘린더의 실제 중요도 등급 (작업자가 매긴 값 아님)
const EVENTS=[
 {i:idxOf('2026-08-31 10:30'),when:'월 밤 11시 30분',l1:'댈러스 연은 제조업 11.6.',l2:'1.3에서 급등, 지수는 무반응.',tag:'댈러스연은',col:C.hi,
  why:'★★ · 그날 ★★★ 없음 · 장중 · +0.00% 1164위'},
 {i:idxOf('2026-09-01 10:00'),when:'화 밤 11시',l1:'ISM 제조업 54.6.',l2:'예상 하회, 그래도 무반응.',tag:'제조업지표',col:C.hi,
  why:'★★★ · 그날 유일 · 장중 · -0.00% 1123위'},
 {i:idxOf('2026-09-02 10:00'),when:'수 밤 11시',l1:'7월 공장주문 +0.9%.',l2:'예상 +0.6%을 넘겼다.',tag:'공장주문',col:C.up,
  why:'★★ 4건 중 장중 2건, 그중 등락률 큰 쪽 · +0.07% 187위'},
 {i:idxOf('2026-09-03 10:00'),when:'목 밤 11시',l1:'ISM 서비스업 55.4.',l2:'예상을 넘겼는데 지수는 하락.',tag:'서비스지표',col:C.down,
  why:'★★★ · 그날 유일 · 장중 · -0.22% 6위'},
 {i:idxOf('2026-09-04 08:30'),when:'금 저녁 9시 30분',l1:'8월 고용 16.2만 명.',l2:'예상은 5.6만이었다.',tag:'고용지표',col:C.down,
  why:'★★★ · 그날 유일 · 그 주 최대 변동 · -0.41% 1위'},
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
