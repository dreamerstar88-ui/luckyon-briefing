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
const DATA  = args.data  || path.join(R, 'data', 'weekly-shorts', '2026-09-21.5m.json');
const MANI  = args.manifest || path.join(R, 'content', 'weekly-shorts', '2026-09-21.json');
const W=1080,H=1920,FPS=30,DUR=35.0;
const die=(...m)=>{console.error(...m);process.exit(1);};

// ── 회차 자료는 매니페스트에서 읽는다(4회차부터).
// 3회차까지는 사건 배열·창(9/14~9/18)·퀴즈·문구가 이 파일에 따로 적혀 있어, 매니페스트를
// 고쳐도 화면은 옛 값으로 나갈 수 있었다. 지침 2-3(화면·자막·설명란은 한 덩어리)·5-7.
const M=JSON.parse(fs.readFileSync(MANI,'utf8'));
const all=JSON.parse(fs.readFileSync(DATA,'utf8'));
const raw=all.filter(x=>M.window.from_et<=x.d&&x.d<=M.window.to_et);
const kstOf=et=>{const d=new Date(et.replace(' ','T')+'Z');d.setUTCHours(d.getUTCHours()+13);
  const w='일월화수목금토'[d.getUTCDay()];
  return `${d.getUTCMonth()+1}/${d.getUTCDate()} ${w} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;};
const BARS=raw.map(x=>({d:x.d,o:x.o,h:x.h,l:x.l,c:x.c,kst:kstOf(x.d)}));
if(BARS.length!==M.numbers.bars)die('봉 개수가 매니페스트와 다르다',BARS.length,M.numbers.bars);
// 요일 칸은 거래일(월~금)로 묶는다. 4회차부터 창이 월요일 04:00(프리장)부터라 일요일 봉은 없다.
// 토·일을 빼는 거름은 남겨 둔다 — 창을 바꾸다 일요일 봉이 들어와도 월요일 칸에 합쳐진다.
const DAYS=[...new Set(BARS.map(x=>x.d.slice(0,10)))].filter(d=>{const w=new Date(d+'T00:00:00Z').getUTCDay();return w>=1&&w<=5;});
const idxOf=d=>BARS.findIndex(x=>x.d===d);
const lo=Math.min(...BARS.map(b=>b.l)),hi=Math.max(...BARS.map(b=>b.h)),pad=(hi-lo)*.14;
let pk=-1e9,pi=0,mdd=0,mp=0,mt=0;
BARS.forEach((b,i)=>{if(b.h>pk){pk=b.h;pi=i;}const dd=b.l/pk-1;if(dd<mdd){mdd=dd;mp=pi;mt=i;}});
const STATS={weekPct:(BARS[BARS.length-1].c/BARS[0].o-1)*100,peakIdx:mp,troughIdx:mt,mdd:mdd*100,n:BARS.length};
console.log(`봉 ${BARS.length} · 주간 ${STATS.weekPct.toFixed(2)}% · 최대낙폭 ${STATS.mdd.toFixed(2)}% (${BARS[mp].kst} → ${BARS[mt].kst})`);
const C={down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d'};
const d0=DAYS[0], d1=DAYS.at(-1);
const DOW='일월화수목금토';
const dw=x=>DOW[new Date(x+'T00:00:00Z').getUTCDay()];
const chgAll=[];for(let k=1;k<BARS.length;k++)chgAll.push({d:BARS[k].d,p:(BARS[k].c/BARS[k-1].c-1)*100});
const rankOf=new Map([...chgAll].sort((a,b)=>Math.abs(b.p)-Math.abs(a.p)).map((x,k)=>[x.d,k+1]));
const pctOfET=new Map(chgAll.map(x=>[x.d,x.p]));
const colKey=p=>Math.abs(p)<0.05?'hi':(p>0?'up':'down');

const EVENTS=M.events.map(e=>{const p=pctOfET.get(e.et);
  if(p===undefined)die('사건 봉이 창 안에 없다',e.et);
  return {et:e.et,stars:e.stars,when:e.kst_label,l1:e.l1,l2:e.l2,tag:e.tag,en:e.en,
          i:idxOf(e.et),pct:+p.toFixed(3),rank:rankOf.get(e.et),col:C[colKey(p)],colKey:colKey(p),mpct:e.pct,mcol:e.color};})
  .filter(e=>e.i>0).sort((a,b)=>a.i-b.i);
if(EVENTS.length!==M.events.length)die('사건 인덱스 실패');
// 봉에서 다시 잰 값이 매니페스트와 어긋나면 멈춘다 — 대표에게 드린 표와 화면이 달라진다(지침 2-7).
for(const e of EVENTS){
  if(Math.abs(e.pct-e.mpct)>0.0005)die('사건 등락률이 매니페스트와 다르다',e.et,e.pct,e.mpct);
  if(e.colKey!==e.mcol)die('사건 색이 매니페스트와 다르다',e.et,e.colKey,e.mcol);
}
EVENTS.forEach((e,k)=>console.log(`  사건${k+1} ${e.et} ${'★'.repeat(e.stars)} ${e.pct>=0?'+':''}${e.pct}% ${e.rank}위 ${e.colKey} — ${e.l1}`));

const NAMES=M.copy.names;
const QUIZ={ans:M.quiz.answer_index-1,opts:M.quiz.options};
const rank3=[...EVENTS].sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,3);
const sgn=v=>(v>=0?'+':'')+v.toFixed(2)+'%';

// ── 문구 속 숫자는 봉과 매니페스트에서 채운다. 문자열로 박으면 다음 회차에 옛 숫자가 남는다.
const open=BARS[0].o;
const below=BARS.filter(b=>b.c<open).length;
const aboveV=BARS.filter(b=>b.c>=open).length/BARS.length*100;
if(Math.abs(aboveV-M.question.answer_value)>0.01)die('질문 답이 매니페스트와 다르다',aboveV,M.question.answer_value);
const fmtPct=v=>(Math.abs(v-Math.round(v))<0.005?String(Math.round(v)):v.toFixed(2))+'%';
const FILL={WEEK:sgn(STATS.weekPct),N:BARS.length.toLocaleString('en-US'),BELOW:String(below),ABOVE:fmtPct(aboveV),
  DN:String(M.question.dist.n),DMED:M.question.dist.median+'%',EVN:String(EVENTS.length),
  TOPPCT:(rank3[0].pct>=0?'+':'')+rank3[0].pct.toFixed(3)+'%',
  // 주간 시가 = 첫 5분봉의 시가. 화면의 가격은 전부 정수로 반올림해 쓴다(29,946.50 → 29,947).
  OPEN:Math.round(open).toLocaleString('en-US')};
const fill=s=>typeof s!=='string'?s:s.replace(/\{([A-Z]+)\}/g,(m,k)=>{if(!(k in FILL))die('모르는 자리표시',m);return FILL[k];});
const S=Object.fromEntries(Object.entries(M.copy.screen).map(([k,v])=>[k,fill(v)]));
const COPY={
  kicker:`지난주 나스닥 · ${dw(d0)} 개장 ~ ${dw(d1)} 마감`,
  span:`${dw(d0)}요일 개장 → ${dw(d1)}요일 마감`,
  ...S,
  // 1위와 2위가 두 자리에서 같게 찍힐 수 있어 이 표에서만 세 자리로 쓴다(3회차 교훈).
  rows:rank3.map((e,k)=>[`${k+1}위 · ${NAMES[e.tag]}`,(e.pct>=0?'+':'')+e.pct.toFixed(3)+'%',colKey(e.pct)]),
};
for(const k of ['enHook','enAnswer','enSumm'])if((COPY[k]||'').length>72)die(`영어 줄이 72자를 넘는다(지침 5-5): ${k} ${COPY[k].length}자`);
console.log(`질문: ${COPY.q1} ${COPY.q2} · 정답 ${COPY.ansBig} · 시가 밑 종가 ${below}개`);

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
// 글꼴은 처음 쓰일 때 읽히기 시작한다. 그래서 fonts.ready 만 기다리면 맨 처음 그리는 장면이
// 기본 글꼴로 찍힌다 — 4회차 표본에서 첫 장면(훅)의 글자가 전부 프리텐다드가 아니었다.
// 전체 렌더라면 0초 첫 프레임, 쇼츠 피드가 쓰는 그 프레임이 그렇게 나간다. 굵기마다 미리 읽고 확인한다.
const FACES=['500 40px PD','700 40px PD','900 40px PD','400 40px PEN'];
// 확인은 «읽혔다는 표시» 만 믿지 않고, 같은 글자를 기본 글꼴과 폭을 비교해 실제로 다른지 본다.
const fontOK=await page.evaluate(async F=>{for(const f of F)await document.fonts.load(f,'가A1');
  const x=document.createElement('canvas').getContext('2d');
  const w=f=>{x.font=f;return x.measureText('가나다 ABC 123').width;};
  return {faces:[...document.fonts].map(f=>`${f.family}/${f.weight}/${f.status}`),
          same:F.filter(f=>Math.abs(w(f)-w(f.replace(/PD|PEN/,'serif')))<0.5)};},FACES);
if(fontOK.faces.some(s=>!s.endsWith('/loaded'))||fontOK.same.length)
  die('글꼴을 못 읽었다',JSON.stringify(fontOK));
console.log('글꼴:',fontOK.faces.join(' · '));
await page.evaluate(()=>document.fonts.ready);
await page.evaluate(()=>new Promise(r=>{const i=document.getElementById('p');i.complete?r():i.onload=r;}));
const nseg=await page.evaluate(d=>window.__init(d),{bars:BARS,events:EVENTS,days:DAYS,stats:STATS,lo:lo-pad,hi:hi+pad,copy:COPY,quiz:QUIZ});
// 정지 시간은 브라우저(scene.js)가 계산한다. 자막은 매니페스트의 값을 쓰므로 둘이 같아야 한다.
const sh=await page.evaluate(()=>SCHED.filter(s=>s.hold).map(s=>+(s.t1-s.t0).toFixed(3)));
if(sh.length!==M.video.holds.length||sh.some((h,k)=>Math.abs(h-M.video.holds[k])>0.002))
  die('정지 시간이 매니페스트와 다르다',sh.join('/'),M.video.holds.join('/'));
console.log('구간',nseg,'· 정지 시간',sh.join('/'));
// 사건이 멈추는 시각(영상 기준 초). 표본 프레임은 이 구간 안에서 고른다.
const ht=await page.evaluate(R0=>SCHED.filter(s=>s.hold).map(s=>[+(R0+s.t0).toFixed(2),+(R0+s.t1).toFixed(2)]),5.0);
console.log('사건 멈춤(초):',ht.map((h,k)=>`${k+1}번 ${h[0]}~${h[1]}`).join(' · '));
// 사건이 멈춘 동안의 원이 라벨 상자·시가 이름표에 닿으면 멈춘다(지침 5-6). 틈이 6px 보다 좁으면 닿아 보인다.
const hits=await page.evaluate(()=>layoutHits(document.getElementById('c').getContext('2d')));
const worst=[...hits].sort((a,b)=>a.gap-b.gap).slice(0,4);
console.log('원과 가장 가까운 것:',worst.map(h=>`${h.ring}번 원↔${h.what} ${h.gap}px`).join(' · '));
const bad=hits.filter(h=>h.gap<6);
if(bad.length&&!args['allow-overlap'])die('사건 원이 다른 것에 닿는다:',bad.map(h=>`${h.ring}번 원↔${h.what} ${h.gap}px`).join(', '));
// 시가 이름표와 이웃한 라벨 상자 사이의 틈(px). 이름표 자리는 가장 넓은 빈 칸을 고르지만,
// 칸 자체가 좁으면 붙어 보인다. 6px 보다 좁으면 멈춘다.
if(COPY.openLine){
  const lg=await page.evaluate(()=>{const p=openLabelBox(document.getElementById('c').getContext('2d'));
    const {bxs,side,place}=eventSlots();
    return EVENTS.map((ev,j)=>{const h=vtextH(ev.tag,LH_)+PADY_*2,bx=bxs[j]!=null?bxs[j]:boxOf(ev,side[j]).bx,by=place[j]?CY+14:CY+CH-h-14;
      if(by>p.y0+p.h||by+h<p.y0)return null;                     // 높이가 안 겹치는 상자는 빼고
      return {box:j+1,gap:Math.round(Math.max(bx-(p.x+p.w),p.x-(bx+BW_)))};}).filter(Boolean)
      .concat([{box:'x',gap:Math.round(p.x)},{box:'w',gap:p.w}]);});
  const near=lg.filter(g=>typeof g.box==='number').sort((a,b)=>a.gap-b.gap);
  console.log(`시가 이름표: 왼쪽 끝 ${lg.find(g=>g.box==='x').gap}px, 폭 ${lg.find(g=>g.box==='w').gap}px · 가까운 상자 `+near.slice(0,2).map(g=>`${g.box}번 ${g.gap}px`).join(', '));
  if(near.length&&near[0].gap<6&&!args['allow-overlap'])die('시가 이름표가 라벨 상자에 붙는다:',near[0].box+'번',near[0].gap+'px');
}
// 라벨 상자를 주가 선이 지나가면 글자가 그어진다. 틈이 4px 보다 좁으면 멈춘다.
const cg=await page.evaluate(()=>boxCurveGaps());
console.log('상자↔주가 선:',cg.map(g=>`${g.box}번(${g.top?'위':'아래'}) ${g.gap}px`).join(' · '));
const cbad=cg.filter(g=>g.gap<4);
if(cbad.length&&!args['allow-overlap'])die('주가 선이 라벨 상자를 지난다:',cbad.map(g=>`${g.box}번 ${g.tag} ${g.gap}px`).join(', '));
// 훅 질문 두 줄의 폭을 잰다. 왼쪽 여백이 60px 이니 오른쪽 끝도 1080-60 을 넘으면 안 된다.
const qw=await page.evaluate(c=>{const x=document.getElementById('c').getContext('2d');
  return [['q1','700 54px PD'],['q2','900 64px PD']].map(([k,f])=>{x.font=f;return [k,Math.round(x.measureText(c[k]).width)];});},COPY);
console.log('훅 질문 폭:',qw.map(([k,w])=>`${k} ${w}px(오른쪽 끝 ${60+w})`).join(' · '));
for(const [k,w] of qw)if(60+w>W-60)die(`훅 ${k} 가 화면 폭을 넘는다: 오른쪽 끝 ${60+w}px`);
// 윗줄·범위 줄과 사건 문구(멈췄을 때 56px 로 커진다)도 잰다. 4회차에 «연율» 을 넣으며 추가했다.
const tw=await page.evaluate(({c,ev})=>{const x=document.getElementById('c').getContext('2d');
  const m=(f,s)=>{x.font=f;return Math.round(x.measureText(s).width);};
  return [['윗줄',m('700 48px PD',c.kicker)],['범위 줄',m('700 40px PD',c.span)],
    ...ev.flatMap((e,k)=>[[`사건${k+1} 첫 줄`,m('900 56px PD',e.l1)],[`사건${k+1} 둘째 줄`,m('900 56px PD',e.l2||'')]])];},
  {c:COPY,ev:EVENTS.map(e=>({l1:e.l1,l2:e.l2}))});
const wide=tw.filter(([,w])=>60+w>W-60);
console.log('가장 긴 줄:',[...tw].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,w])=>`${k} 오른쪽 끝 ${60+w}px`).join(' · '));
if(wide.length)die('화면 폭을 넘는 줄:',wide.map(([k,w])=>`${k} ${60+w}px`).join(', '));
// 라벨 상자와 사건 세로선은 8px, 번호 원끼리는 4px 보다 가까우면 멈춘다(4회차 검증에서 ⑤⑥이 겹쳤다).
const lb=await page.evaluate(()=>lineBoxGaps());
const lbBad=lb.filter(g=>g.gap<(g.what.includes('원↔')?4:8));   // 상자끼리도 8px
console.log('상자↔세로선·원끼리 가장 가까운 것:',[...lb].sort((a,b)=>a.gap-b.gap).slice(0,3).map(g=>`${g.what} ${g.gap}px`).join(' · '));
if(lbBad.length&&!args['allow-overlap'])die('상자·세로선·번호 원이 붙는다:',lbBad.map(g=>`${g.what} ${g.gap}px`).join(', '));
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
