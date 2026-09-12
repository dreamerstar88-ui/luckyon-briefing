// ===== 넘버뷰 주간 되감기 v3 — 35초 =====
// 30초 판에서 훅이 너무 빨리 지나가 읽히지 않는다는 지적을 받아 늘렸다.
// 늘린 5초 중 2.4초를 훅에, 2.0초를 되감기에, 나머지를 정답·요약에 나눠 줬다.
const W=1080,H=1920,FPS=30;
const HOOK=[0,5.0], REPLAY=[5.0,26.2], ANSWER=[26.2,30.3], SUMM=[30.3,35.0];
const DUR=35.0;
// 훅 연출: 문구를 다 띄운 뒤 HOLD 만큼 세워 두고 다음으로 넘어간다.
// 등장 동작은 [0, 등장창] 안에서 끝나고, 나머지는 전부 정지 시간이다.
const HOOK_HOLD=1.95;
const HOOK_RV=(HOOK[1]-HOOK[0])-HOOK_HOLD;   // 등장창 = 3.05초
const hs=t=>t/3.05*HOOK_RV;                  // 3.05초 기준 대본을 등장창에 맞춘다
const C={bg:'#000000',text:'#ffffff',muted:'#8f9aad',dim:'#6a7383',line:'#4ea8ff',
         down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d',panel:'rgba(0,0,0,.55)'};
// 차트 상자. 안마다 다르게 잡는다.
let CX=65,CW=875,CY=790,CH=500;
let BARS=[],EVENTS=[],DAYS=[],BGC=null,LO=0,HI=1,SCHED=[],STATS={};
// 회차마다 달라지는 문구·보기는 전부 render 쪽에서 넣는다.
// 예전에는 '5분봉 1,179개', 'Peak 29,571 …' 처럼 1회차 값이 코드에 박혀 있어
// 회차가 바뀌어도 그대로 남았다.
let COPY={},QUIZ={opts:[],ans:2};
// 요일은 날짜에서 직접 뽑는다. 예전에는 ['월'..'금'] 을 순서로 꺼내 써서
// 휴장일이 낀 주에 요일이 하루씩 밀렸다(2회차 9/7 노동절).
const WD='일월화수목금토';
const dowOf=d=>WD[new Date(d+'T00:00:00Z').getUTCDay()];

const easeOut=t=>1-Math.pow(1-t,3);
const clamp01=t=>Math.max(0,Math.min(1,t));
const seg=(t,a,b)=>clamp01((t-a)/(b-a));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pct=(v,d=2)=>(v>=0?'+':'')+v.toFixed(d)+'%';

function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function shadow(ctx,on){if(on){ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=40;ctx.shadowOffsetY=10;}else{ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;}}
function txt(ctx,s,x,y,font,col,align='left',ls=''){ctx.save();ctx.font=font;ctx.fillStyle=col;ctx.textAlign=align;ctx.textBaseline='alphabetic';if(ls)ctx.letterSpacing=ls;ctx.fillText(s,x,y);ctx.restore();}

// ── 숫자 자릿수 폭 고정: 0~9 를 같은 칸에 그린다 (표 숫자 효과)
function numT(ctx,s,x,y,font,col,align='left',ls=''){
  ctx.save();ctx.font=font;if(ls)ctx.letterSpacing=ls;ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle=col;
  let dw=0;for(const d of '0123456789')dw=Math.max(dw,ctx.measureText(d).width);
  const chars=[...s];const isD=c=>c>='0'&&c<='9';
  let total=0;for(const c of chars)total+=isD(c)?dw:ctx.measureText(c).width;
  let cx=align==='right'?x-total:(align==='center'?x-total/2:x);
  for(const c of chars){
    if(isD(c)){const w=ctx.measureText(c).width;ctx.fillText(c,cx+(dw-w)/2,y);cx+=dw;}
    else{ctx.fillText(c,cx,y);cx+=ctx.measureText(c).width;}
  }
  ctx.restore();return total;
}

// 세로쓰기: 글자를 똑바로 세운 채 위에서 아래로 쌓는다
function vtext(ctx,str,x,y,font,col,lh){
  ctx.save();ctx.font=font;ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';
  let k=0;
  for(const ch of str){ if(ch===' '){k+=0.45;continue;} ctx.fillText(ch,x,y+k*lh); k+=1; }
  ctx.restore();
}
function vtextH(str,lh){let k=0;for(const ch of str){k+=(ch===' ')?0.45:1;}return k*lh;}

const Y=v=>CY+CH-(v-LO)/(HI-LO)*CH;
const X=i=>CX+i/(BARS.length-1)*CW;

function buildSchedule(){
  const HOLD=1.5, total=REPLAY[1]-REPLAY[0];
  const drawT=total-HOLD*EVENTS.length;
  const segs=[];let prev=0,t=0;
  for(const ev of EVENTS){
    const d=(ev.i-prev)/(BARS.length-1)*drawT;
    segs.push({t0:t,t1:t+d,i0:prev,i1:ev.i,hold:false});t+=d;
    segs.push({t0:t,t1:t+HOLD,i0:ev.i,i1:ev.i,hold:true});t+=HOLD;
    prev=ev.i;
  }
  const n=(BARS.length-1)-prev;
  segs.push({t0:t,t1:t+n/(BARS.length-1)*drawT,i0:prev,i1:BARS.length-1,hold:false});
  SCHED=segs;
}
function progressAt(rt){
  for(const s of SCHED){if(rt<=s.t1)return {i:Math.round(s.i0+(s.i1-s.i0)*clamp01((rt-s.t0)/Math.max(.001,s.t1-s.t0))),seg:s};}
  const l=SCHED[SCHED.length-1];return {i:l.i1,seg:l};
}

function buildBg(img){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  g.fillStyle=C.bg;g.fillRect(0,0,W,H);
  g.save();g.filter='blur(12px) contrast(1.1) saturate(1.15)';g.globalAlpha=.28;
  const ar=img.width/img.height,tar=W/H;let dw,dh;
  if(ar>tar){dh=H;dw=H*ar;}else{dw=W;dh=W/ar;}
  g.drawImage(img,(W-dw)/2-W*.05,(H-dh)/2,dw,dh);g.restore();
  let rg=g.createRadialGradient(W/2,H*.45,W*.25,W/2,H*.45,W*.95);
  rg.addColorStop(0,'rgba(0,0,0,0)');rg.addColorStop(1,'rgba(0,0,0,.78)');
  g.fillStyle=rg;g.fillRect(0,0,W,H);
  let lg=g.createLinearGradient(0,0,0,H);
  lg.addColorStop(0,'rgba(0,0,0,.60)');lg.addColorStop(.28,'rgba(0,0,0,0)');
  lg.addColorStop(.55,'rgba(0,0,0,0)');lg.addColorStop(.82,'rgba(0,0,0,.94)');lg.addColorStop(1,'rgba(0,0,0,.98)');
  g.fillStyle=lg;g.fillRect(0,0,W,H);
  const nc=document.createElement('canvas');nc.width=270;nc.height=480;const ng=nc.getContext('2d');
  const id=ng.createImageData(270,480);
  for(let k=0;k<id.data.length;k+=4){const v=Math.random()*255;id.data[k]=id.data[k+1]=id.data[k+2]=v;id.data[k+3]=26;}
  ng.putImageData(id,0,0);
  g.save();g.globalAlpha=.5;g.imageSmoothingEnabled=false;g.drawImage(nc,0,0,W,H);g.restore();
  BGC=c;
}

