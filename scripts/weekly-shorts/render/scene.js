// ===== 넘버뷰 주간 되감기 v3 — 35초 =====
// 30초 판에서 훅이 너무 빨리 지나가 읽히지 않는다는 지적을 받아 늘렸다.
// 늘린 5초 중 2.4초를 훅에, 2.0초를 되감기에, 나머지를 정답·요약에 나눠 줬다.
const W=1080,H=1920,FPS=30;
const HOOK=[0,5.0], REPLAY=[5.0,27.9], ANSWER=[27.9,32.0], SUMM=[32.0,35.0];
const DUR=35.0;
// 훅 연출: 문구를 다 띄운 뒤 HOLD 만큼 세워 두고 다음으로 넘어간다.
// 등장 동작은 [0, 등장창] 안에서 끝나고, 나머지는 전부 정지 시간이다.
const HOOK_HOLD=1.95;
const HOOK_RV=(HOOK[1]-HOOK[0])-HOOK_HOLD;   // 등장창 = 3.05초
const hs=t=>t/3.05*HOOK_RV;                  // 3.05초 기준 대본을 등장창에 맞춘다
const C={bg:'#000000',text:'#ffffff',muted:'#8f9aad',dim:'#6a7383',line:'#4ea8ff',
         down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d',panel:'rgba(0,0,0,.55)'};
const CX=60,CW=960,CY=790,CH=500;
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
  // 사건 수는 주마다 다르다(휴장일). 멈춰 서는 총 시간을 7.2초로 두고 건수로 나눈다.
  const total=REPLAY[1]-REPLAY[0], N1=BARS.length-1, MINHOLD=0.6;
  // 사건 하나가 화면에 머무는 시간 = 그 사건의 정지 시간 + 다음 사건까지 그리는 시간.
  // 정지 시간을 똑같이 주면 이 값이 크게 벌어진다. 같은 날 08:30·10:00 처럼 붙은 쌍은
  // 앞 사건이 1.7초, 멀리 떨어진 사건은 5.3초가 된다. 하필 붙은 쌍의 앞이 2회차 정답이었다.
  //
  // 정지 시간 예산 9.0초와 그리는 시간 12.2초는 그대로 둔다(그림 속도가 달라지면 안 된다).
  // 고친 건 예산을 나누는 방법이다. 옛날에는 일단 나눠 준 뒤 예산을 넘으면 여유 있는
  // 쪽에서 비례해 깎았는데, 그러면 붙어 있는 사건이 계속 얇아졌다. 이제는 "물채우기" 로
  // 낮은 곳부터 채운다 — 머무는 시간이 가장 짧은 사건을 끌어올리는 방향이다.
  // 2회차 6개에서 최소 노출 2.83->2.89초, 3회차 7개에서 2.47->2.62초. 최대 노출은 그대로.
  const budget=9.0, drawT=total-budget;
  const gap=EVENTS.map((e,k)=>((k<EVENTS.length-1?EVENTS[k+1].i:N1)-e.i)/N1*drawT);
  // holds[k]=max(MINHOLD, L-gap[k]) 의 합이 예산과 같아지는 수위 L 을 이분 탐색으로 찾는다
  let lo=MINHOLD, hi=budget+Math.max(...gap)+1;
  for(let p=0;p<60;p++){
    const L=(lo+hi)/2;
    if(gap.reduce((a,g)=>a+Math.max(MINHOLD,L-g),0)>budget) hi=L; else lo=L;
  }
  const L=(lo+hi)/2, holds=gap.map(g=>Math.max(MINHOLD,L-g));
  const segs=[];let prev=0,t=0;
  EVENTS.forEach((ev,k)=>{
    const d=(ev.i-prev)/(BARS.length-1)*drawT;
    segs.push({t0:t,t1:t+d,i0:prev,i1:ev.i,hold:false});t+=d;
    segs.push({t0:t,t1:t+holds[k],i0:ev.i,i1:ev.i,hold:true});t+=holds[k];
    prev=ev.i;
  });
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

function brand(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;ctx.font='700 30px PD';ctx.textAlign='left';
  ctx.fillStyle=C.hi;ctx.fillText('luckyon',56,1668);
  const w=ctx.measureText('luckyon').width;
  ctx.fillStyle='#d8d8d8';ctx.fillText(' 넘버뷰 · 이번 주 나스닥',56+w,1668);
  txt(ctx,'나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다',56,1716,'500 26px PD',C.dim);
  ctx.restore();
}
function chartPanel(ctx){ctx.save();ctx.fillStyle=C.panel;rr(ctx,40,CY-46,1000,CH+92,24);ctx.fill();ctx.restore();}
function dayShade(ctx){
  ctx.save();
  for(const d of DAYS){
    const a=BARS.findIndex(x=>x.d===d+' 09:30');let b=BARS.findIndex(x=>x.d===d+' 16:00');
    if(b<0)b=BARS.length-1;if(a<0)continue;
    ctx.fillStyle='rgba(255,255,255,.05)';rr(ctx,X(a),CY,X(b)-X(a),CH,6);ctx.fill();
  }
  ctx.strokeStyle='#3a3a3a';ctx.lineWidth=2;ctx.setLineDash([6,8]);
  for(let k=1;k<DAYS.length;k++){
    let i=BARS.findIndex(x=>x.d.startsWith(DAYS[k]));
    if(i>0){ctx.beginPath();ctx.moveTo(X(i),CY);ctx.lineTo(X(i),CY+CH);ctx.stroke();}
  }
  ctx.setLineDash([]);ctx.restore();
}
// ── 지나간 사건은 그래프에 세로선으로 남긴다
// 가까이 붙은 사건은 위아래로 엇갈리게 놓는다.
// 같은 날 08:30 과 10:00 은 5분봉으로 18칸, 화면에서는 19px 밖에 안 떨어져 있어
// 배지도 라벨 상자도 그대로 겹친다. 사건이 6개가 되면서 두 쌍이 그렇게 됐다.
const MINX=90, LH_=31, PADX_=14, PADY_=12, BW_=PADX_*2+26;
// 사건이 멈출 때 커서에 두르는 원. 바깥 반지름은 선 두께(4)의 절반을 더한 34px 이다.
// 상자는 사건 세로선에서 16px 떨어져 서는데 원은 34px 까지 퍼진다. 4회차 표본에서
// 1번 사건이 멈춘 0.6초 동안 원이 «시카고지수» 상자 왼쪽 테두리를 덮었다.
const RING_R=32, RING_OUT=RING_R+2;
// 라벨 상자 하나의 x 범위와 높이. side 가 -1 이면 세로선 왼쪽, +1 이면 오른쪽.
// off 는 사건 세로선에서 상자까지의 거리. 보통 16px, 원을 피해야 하면 원 바깥으로 물린다.
function boxOf(ev,side,off=16){
  const x=X(ev.i), h=vtextH(ev.tag,LH_), box=h+PADY_*2;
  const right=x+off, left=x-off-BW_;
  let bx = side<0 ? left : right;
  // 그림 영역 안에만 있으면 된다. 예전 한계(CX+CW-40)가 너무 빡빡해서, 오른쪽 끝 사건의
  // 상자가 왼쪽으로 튕기며 짝꿍 상자와 같은 자리에 겹쳤다.
  if(bx+BW_>CX+CW-4)bx=left;
  if(bx<CX+4)bx=right;
  return {bx,box};
}
// 그 상자를 위/아래에 뒀을 때 주가 선과 얼마나 떨어지는가 (음수면 선이 상자를 지난다)
function clearOfAt(ev,top,bx){
  const box=vtextH(ev.tag,LH_)+PADY_*2;
  let hi=1e9,lo=-1e9;
  for(let j=0;j<BARS.length;j++){const xj=X(j);if(xj<bx-4||xj>bx+BW_+4)continue;
    const yj=Y(BARS[j].c);if(yj<hi)hi=yj;if(yj>lo)lo=yj;}
  if(hi>lo)hi=lo=Y(BARS[ev.i].c);
  // 사건이 멈출 때의 원도 장애물로 본다. 이 상자가 떠 있는 동안 멈추는 사건(자기 자신과
  // 뒤의 사건)의 원 가운데, 상자의 가로 구간에 닿는 것의 위아래 끝을 넣는다.
  for(const e of EVENTS){if(e.i<ev.i)continue;
    const ex=X(e.i);if(ex+RING_OUT<bx-4||ex-RING_OUT>bx+BW_+4)continue;
    const ey=Y(BARS[e.i].c);if(ey-RING_OUT<hi)hi=ey-RING_OUT;if(ey+RING_OUT>lo)lo=ey+RING_OUT;}
  return top ? hi-(CY+14+box) : (CY+CH-box-14)-lo;
}
// 붙어 있는 사건을 «무리» 로 묶는다. 예전에는 두 개짜리 쌍만 다뤄서, 셋이
// 연달아 붙으면 뒤의 둘이 같은 쪽으로 배정돼 그대로 포개졌다. 3회차가 그랬다 —
// 소매판매(08:30)·금리결정(14:00)·기자회견(14:30) 이 각각 53.8px, 4.9px 간격이라
// 금리 결정 라벨이 기자회견 라벨 밑에 통째로 깔려 화면에서 사라졌다.
function clusters(){
  const out=[]; let cur=[0];
  for(let k=1;k<EVENTS.length;k++){
    if(X(EVENTS[k].i)-X(EVENTS[k-1].i)<MINX) cur.push(k);
    else { out.push(cur); cur=[k]; }
  }
  out.push(cur); return out;
}
function eventSlots(){
  const pair=[],place=[],side=[],bxs=[],bys=[],bcx=[];
  for(let k=0;k<EVENTS.length;k++){pair.push(false);side.push(1);place.push(true);bxs.push(null);bys.push(0);bcx.push(X(EVENTS[k].i));}
  const H=k=>vtextH(EVENTS[k].tag,LH_)+PADY_*2;
  const yOf=(k,top)=>top?CY+14:CY+CH-H(k)-14;
  // 이미 놓은 상자와의 가로 틈(높이가 겹치는 것만 본다). 겹치면 음수.
  const placed=[];
  const boxGap=(k,bx,top)=>{let g=1e9;const y0=yOf(k,top),y1=y0+H(k);
    for(const q of placed){const q0=yOf(q.k,q.top),q1=q0+H(q.k);if(y1<=q0||q1<=y0)continue;
      g=Math.min(g,bx+BW_<=q.bx?q.bx-(bx+BW_):(q.bx+BW_<=bx?bx-(q.bx+BW_):-Math.min(bx+BW_-q.bx,q.bx+BW_-bx)));}
    return g;};
  // 남의 사건 세로선과의 가로 틈(자기 선은 뺀다)
  const lineGap1=(bx,self)=>{let g=1e9;for(const e of EVENTS){if(e===self)continue;const x=X(e.i);
    g=Math.min(g,x<bx?bx-x:(x>bx+BW_?x-bx-BW_:-Math.min(x-bx,bx+BW_-x)));}return g;};
  const CL=clusters();
  // 1) 몰린 사건부터 놓는다(자리가 더 좁다).
  //    상자는 가로로 나란히 편다(서로 BW_+10 간격). 상자 줄을 어디에 둘지는 사건 세로선을 피해서
  //    고른다 — ① 무리 오른쪽 끝 선 바깥 ② 왼쪽 끝 선 바깥 ③ 가운데 순으로 보고, 모든 사건
  //    세로선과 10px 이상 떨어지는 첫 자리를 쓴다. 4회차 금요일 두 사건(18봉 · 12.7px 간격)을
  //    가운데 두었더니 ⑤ 점선이 두 상자 사이 2~3px 틈에 끼었고 ⑥ 상자는 제 세로선 위에 얹혔다
  //    (2026-09-26 독립 검증에서 발견).
  for(const cl of CL.filter(c=>c.length>1)){
    const STEP=BW_+10, BLK=cl.length*STEP-10;
    const xs=cl.map(k=>X(EVENTS[k].i));
    const lo=Math.min(...xs), hi=Math.max(...xs), mid=(lo+hi)/2;
    const lineGap=(l)=>{let g=1e9;for(const e of EVENTS){const x=X(e.i);for(let n=0;n<cl.length;n++){
      const b0=l+n*STEP,b1=b0+BW_;g=Math.min(g,x<b0?b0-x:(x>b1?x-b1:-Math.min(x-b0,b1-x)));}}return g;};
    const inside=(l)=>l>=CX+4&&l+BLK<=CX+CW-4;
    const cands=[hi+16, lo-16-BLK, Math.min(Math.max(mid-BLK/2,CX+4),CX+CW-4-BLK)];
    let left=cands.find(l=>inside(l)&&lineGap(l)>=10);
    if(left===undefined)left=cands.filter(inside).sort((a,b)=>lineGap(b)-lineGap(a))[0]??cands[2];
    // 번호 원은 위아래로 쌓지 않고 옆으로 벌린다(원 지름 34 + 8). 예전에는 둘째 원을 46px 올리고
    // 제 세로선까지 줄을 내렸는데, 두 선이 원 반지름(17)보다 가까우면 그 줄이 첫째 원을 가로질렀다.
    const BD=42, span=(cl.length-1)*BD;
    const c0=Math.max(CX+18,Math.min(mid-span/2,CX+CW-18-span));
    cl.forEach((k,n)=>{pair[k]=true;bxs[k]=left+n*STEP;side[k]=bxs[k]<X(EVENTS[k].i)?-1:1;bcx[k]=c0+n*BD;});
    // 무리는 위아래를 한 덩어리로 정한다. 따로 정하면 상자들이 엇갈려 읽기 나빠진다.
    const up=cl.reduce((a,k)=>a+clearOfAt(EVENTS[k],true,bxs[k]),0);
    const dn=cl.reduce((a,k)=>a+clearOfAt(EVENTS[k],false,bxs[k]),0);
    cl.forEach(k=>{place[k]=up>=dn;placed.push({k,bx:bxs[k],top:place[k]});});
  }
  // 2) 홀로 선 사건. 세로선 오른쪽에 붙여(16px) 위·아래 중 여유가 큰 쪽에 세우는 게 기본이다.
  //    그 자리가 «주가 선·멈출 때의 원과 8px · 다른 상자와 8px · 남의 세로선과 10px» 를 못 지키면
  //    왼쪽에 붙여 보고, 그래도 안 되면 원 바깥(RING_OUT+12)으로 물린다. 다 안 되면 가장 덜 나쁜 자리.
  //    4회차 1번 사건은 오른쪽에서 아래는 원에(-18px), 위는 주가 선에(-59px) 걸렸고, 몰린 사건의
  //    상자 줄을 왼쪽으로 옮기자 4번 상자와 겹쳤다(상자끼리는 안 재고 있었다).
  for(const cl of CL.filter(c=>c.length===1)){
    const k=cl[0],ev=EVENTS[k];
    let best=null,bestScore=-1e9;
    for(const [off,sd] of [[16,1],[16,-1],[RING_OUT+12,1],[RING_OUT+12,-1]]){
      const bx=boxOf(ev,sd,off).bx; let pick=null;
      for(const top of [true,false]){
        const c=clearOfAt(ev,top,bx), bg=boxGap(k,bx,top), lg=lineGap1(bx,ev);
        const score=Math.min(c-8,bg-8,lg-10);
        if(score>=0&&(!pick||c>pick.c))pick={c,top,bx};
        if(score>bestScore){bestScore=score;best={c,top,bx};}
      }
      if(pick){best=pick;break;}
    }
    place[k]=best.top;bxs[k]=best.bx;side[k]=best.bx<X(ev.i)?-1:1;placed.push({k,bx:best.bx,top:best.top});
  }
  return {pair,place,side,bxs,bys,bcx};
}
function eventLines(ctx,upto,mode){
  ctx.save();
  // 바깥에서 준 투명도를 덮어쓰면 요약이 사라져도 배지·라벨만 남아 루프 카드 위에 얹힌다.
  const A=ctx.globalAlpha;
  const {place:PLACE,side:SIDE,bxs:BXS,bcx:BCX}=eventSlots();
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k];
    if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=A*.55;ctx.strokeStyle=ev.col;ctx.lineWidth=2.5;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.moveTo(x,CY);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;
    }
    // 번호 배지. 몰린 사건은 옆으로 벌려 두고(eventSlots 의 bcx), 제 세로선 윗끝까지 짧은 줄로 잇는다.
    const by0=CY-20, bxc=BCX[k];
    ctx.globalAlpha=A;
    if(Math.abs(bxc-x)>2){ctx.strokeStyle=ev.col;ctx.lineWidth=2;ctx.globalAlpha=A*.6;
      ctx.beginPath();ctx.moveTo(bxc,by0+17);ctx.lineTo(x,CY);ctx.stroke();ctx.globalAlpha=A;}
    ctx.fillStyle=ev.col;ctx.beginPath();ctx.arc(bxc,by0,17,0,7);ctx.fill();
    ctx.save();ctx.font='900 22px PD';ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),bxc,by0+1);ctx.restore();
    // 세로 글씨 (주가 선 아래에 깐다 — polyline 보다 먼저 그린다)
    const LH=31, PADX=14, PADY=12, BW=PADX*2+26;
    const h=vtextH(ev.tag,LH);
    const bx=BXS[k]!=null?BXS[k]:boxOf(ev,SIDE[k]).bx;
    // 선이 라벨을 덮어 글자가 안 보이던 자리를 피한다. 상자가 덮는 x 구간에서 선의
    // 가장 높은 점과 가장 낮은 점을 보고, 위아래 중 여유가 큰 쪽에 세운다.
    // 사건 봉의 종가 한 점만 보면 바로 뒤 스파이크가 상자를 뚫고 지나간다.
    // 자리는 전체 봉 기준으로 한 번 정한다 — 그래야 선이 다가와도 상자가 안 움직인다.
    const box=h+PADY*2;
    const by = PLACE[k] ? CY+14 : CY+CH-box-14;
    // 바탕은 불투명하게 칠한다. .86 이었을 때 «주간 시가» 점선이 상자 5개 안으로 비쳐 보였다(4회차 검증).
    ctx.globalAlpha=A;ctx.fillStyle='#000';
    rr(ctx,bx,by,BW,h+PADY*2,10);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.globalAlpha=A*.45;ctx.lineWidth=2;rr(ctx,bx,by,BW,h+PADY*2,10);ctx.stroke();
    ctx.globalAlpha=A;
    vtext(ctx,ev.tag,bx+PADX+13,by+PADY+LH/2,'700 26px PD',ev.col,LH);
  }
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  // 요일 이름은 그 요일 칸(구분선과 구분선 사이)의 실제 가운데에 찍는다. 예전에는 폭을
  // 요일 수로 똑같이 나눴는데, 칸마다 봉 수가 달라 이름이 구분선을 걸치기도 했다.
  // (4회차 첫 판에서 창을 일요일 저녁부터로 잘못 잡았을 때 월요일 칸만 넓어져 더 틀어졌다. 지금 창은 월 04:00 부터다.)
  DAYS.forEach((d,i)=>{
    const a=i===0?0:BARS.findIndex(x=>x.d.startsWith(d));
    const b=i<DAYS.length-1?BARS.findIndex(x=>x.d.startsWith(DAYS[i+1])):BARS.length-1;
    const cx=(X(Math.max(0,a))+X(Math.max(0,b)))/2;
    numT(ctx,d.slice(5).replace('-','/')+' '+dowOf(d),cx,CY+CH+62,'700 32px PD',C.muted,'center');
  });
  // «미국 날짜» 가 아니라 «미국 거래일» 이다. 창이 월 04:00 부터라 일요일 봉은 없다.
  txt(ctx,'가로축은 미국 거래일 · 밝은 구간은 미국 정규장(한국 밤 10:30~새벽 5:00)',56,CY+CH+124,'500 27px PD',C.dim);
  ctx.restore();
}
// ── 주간 시가 기준선. 질문이 «시가 위에 있던 시간» 인 회차에서만 그린다(COPY.openLine).
// 2회차 그리기 코드에 있던 것을 가져왔다(그 회차는 질문이 바뀌어 부르지 않았다).
// 이름표 자리는 사건 커서·세로 라벨 상자·주가 선을 전부 피해서 고른다(지침 5-6).
// 2회차 판은 세로 라벨 상자의 x 만 보고 막았는데, 3회차부터 라벨이 무리 지어 가로로
// 펴지고 위·아래 어느 쪽에도 선다. 그래서 eventSlots() 로 실제 상자 자리(x·y)를 받아 온다.
// 이름표는 짧게 «주간 시가» 로 쓴다. 4회차에서 «시가 29,947»(186px)을 넣었더니 세로 라벨
// 상자 6개가 전부 선 높이에 서 있어 들어갈 빈 칸이 한 군데도 없었고, 계산이 맨 왼쪽으로
// 떨어져 주가 선 시작과 «시카고지수» 상자에 겹쳤다. «주간» 을 붙인 건 그냥 «시가» 면
// 그날 시가로 읽힐 수 있어서다. 폭은 글자를 재서 정한다.
const OPEN_LABEL='주간 시가', OPEN_FONT='700 24px PD';
function openLine(ctx,a=1){
  const y=Y(BARS[0].o);
  ctx.save();ctx.globalAlpha*=a;
  ctx.strokeStyle='#9aa6b8';ctx.lineWidth=2.5;ctx.setLineDash([10,8]);
  ctx.beginPath();ctx.moveTo(CX,y);ctx.lineTo(CX+CW,y);ctx.stroke();ctx.setLineDash([]);
  const pick=openLabelBox(ctx);
  ctx.fillStyle='rgba(10,14,22,.85)';rr(ctx,pick.x,pick.y0,pick.w,pick.h,6);ctx.fill();
  txt(ctx,OPEN_LABEL,pick.x+10,pick.y0+23,OPEN_FONT,'#c8d0dc');
  ctx.restore();
}
// 이름표 자리 계산만 따로 뺐다 — 렌더 전 겹침 검사(layoutHits)가 같은 자리를 재야 해서다.
function openLabelBox(ctx){
  const y=Y(BARS[0].o);
  ctx.save();ctx.font=OPEN_FONT;const LW=Math.ceil(ctx.measureText(OPEN_LABEL).width)+20;ctx.restore();
  const {place,side,bxs}=eventSlots();
  // 선 위(선에 붙은 한 줄)와 선 아래 두 줄을 다 보고, 가장 여유가 큰 자리를 고른다.
  const bands=[[y-36,y-4],[y+4,y+36]].filter(([t,b])=>t>=CY+2&&b<=CY+CH-2);
  let pick=null;
  for(const [LY0,LY1] of bands){
    const blocked=[];
    EVENTS.forEach((ev,k)=>{
      const x=X(ev.i);
      blocked.push([x-12,x+12]);                                   // 사건 세로선
      const bx=bxs[k]!=null?bxs[k]:boxOf(ev,side[k]).bx;
      const box=vtextH(ev.tag,LH_)+PADY_*2;
      const by=place[k]?CY+14:CY+CH-box-14;
      if(by<LY1&&by+box>LY0)blocked.push([bx-8,bx+BW_+8]);          // 이름표와 높이가 겹치는 라벨 상자
      const ey=Y(BARS[ev.i].c);                                     // 사건이 멈출 때의 원
      if(ey-RING_OUT<LY1+4&&ey+RING_OUT>LY0-4)blocked.push([x-RING_OUT-4,x+RING_OUT+4]);
    });
    for(let i=0;i<BARS.length;i++){                                  // 이름표 높이를 지나가는 주가 선
      const yi=Y(BARS[i].c);
      if(yi>=LY0-4&&yi<=LY1+4){const xi=X(i);blocked.push([xi-6,xi+6]);}
    }
    for(let c0=CX+6;c0<=CX+CW-LW-6;c0+=4){
      // 겹치면 음수(겹친 폭만큼), 안 겹치면 가장 가까운 것까지의 거리
      let d=1e9;
      for(const [a0,b0] of blocked){
        const gap=(c0>b0)?c0-b0:(c0+LW<a0)?a0-(c0+LW):-Math.min(b0,c0+LW)+Math.max(a0,c0);
        d=Math.min(d,gap);
      }
      if(!pick||d>pick.d)pick={d,x:c0,y0:LY0,w:LW,h:32};
    }
  }
  return pick;
}
// ── 렌더 전 겹침 검사(render.mjs 가 부른다). 사건이 멈춘 동안 그리는 원과, 그때 화면에 떠 있는
// 라벨 상자(지나간 사건 전부)·시가 이름표 사이의 틈을 px 로 낸다. 음수면 겹친 것이다.
// 눈으로 훑어서는 0.6초짜리 겹침을 놓친다 — 4회차 1번 사건이 그랬다.
function layoutHits(ctx){
  const {bxs,side,place}=eventSlots();
  const lab=COPY.openLine?openLabelBox(ctx):null;
  const gapTo=(cx,cy,x0,y0,x1,y1)=>{const nx=Math.max(x0,Math.min(cx,x1)),ny=Math.max(y0,Math.min(cy,y1));
    return Math.hypot(cx-nx,cy-ny)-RING_OUT;};
  const out=[];
  EVENTS.forEach((ek,k)=>{
    const cx=X(ek.i),cy=Y(BARS[ek.i].c);
    EVENTS.forEach((ej,j)=>{if(ej.i>ek.i)return;
      const h=vtextH(ej.tag,LH_)+PADY_*2,bx=bxs[j]!=null?bxs[j]:boxOf(ej,side[j]).bx,by=place[j]?CY+14:CY+CH-h-14;
      out.push({ring:k+1,what:`${j+1}번 상자`,gap:+gapTo(cx,cy,bx,by,bx+BW_,by+h).toFixed(1)});});
    if(lab)out.push({ring:k+1,what:'시가 이름표',gap:+gapTo(cx,cy,lab.x,lab.y0,lab.x+lab.w,lab.y0+lab.h).toFixed(1)});
  });
  return out;
}
// 라벨 상자와 주가 선 사이의 틈(px). 선은 상자 위에 그려지므로 닿으면 글자를 긋는다.
// 이웃한 두 봉을 잇는 선분이 상자의 세로 구간을 지나가는지 본다(봉 사이가 1px 도 안 돼
// 점만 보면 가파른 선이 빠져나간다). 선 두께 5 의 절반을 뺀다. 음수면 선이 상자를 지난다.
// 라벨 상자와 사건 세로선(모든 사건) 사이의 가로 틈, 번호 원끼리의 틈(px). 음수면 겹친 것이다.
function lineBoxGaps(){
  const {bxs,side,bcx}=eventSlots(), out=[];
  EVENTS.forEach((ej,j)=>{const bx=bxs[j]!=null?bxs[j]:boxOf(ej,side[j]).bx;
    EVENTS.forEach((e,k)=>{const x=X(e.i);const g=x<bx?bx-x:(x>bx+BW_?x-bx-BW_:-Math.min(x-bx,bx+BW_-x));
      out.push({what:`${j+1}번 상자↔${k+1}번 세로선`,gap:+g.toFixed(1)});});});
  for(let a=0;a<EVENTS.length;a++)for(let b=a+1;b<EVENTS.length;b++)
    out.push({what:`${a+1}번 원↔${b+1}번 원`,gap:+(Math.abs(bcx[a]-bcx[b])-34).toFixed(1)});
  // 상자끼리: 높이가 겹치는 짝만 가로 틈을 잰다
  const {place:pl}=eventSlots(), Hh=k=>vtextH(EVENTS[k].tag,LH_)+PADY_*2, Yo=(k)=>pl[k]?CY+14:CY+CH-Hh(k)-14;
  for(let a=0;a<EVENTS.length;a++)for(let b=a+1;b<EVENTS.length;b++){
    const ya=Yo(a),yb=Yo(b); if(ya+Hh(a)<=yb||yb+Hh(b)<=ya)continue;
    const A=bxs[a]!=null?bxs[a]:boxOf(EVENTS[a],side[a]).bx, B=bxs[b]!=null?bxs[b]:boxOf(EVENTS[b],side[b]).bx;
    const g=A+BW_<=B?B-(A+BW_):(B+BW_<=A?A-(B+BW_):-Math.min(A+BW_-B,B+BW_-A));
    out.push({what:`${a+1}번 상자↔${b+1}번 상자`,gap:+g.toFixed(1)});}
  return out;
}
function boxCurveGaps(){
  const {bxs,side,place}=eventSlots();
  return EVENTS.map((ev,j)=>{
    const h=vtextH(ev.tag,LH_)+PADY_*2,bx=bxs[j]!=null?bxs[j]:boxOf(ev,side[j]).bx,by=place[j]?CY+14:CY+CH-h-14;
    let gap=1e9;
    for(let i=1;i<BARS.length;i++){const x0=X(i-1),x1=X(i);if(x1<bx||x0>bx+BW_)continue;
      const a=Y(BARS[i-1].c),b=Y(BARS[i].c),lo=Math.min(a,b),hi=Math.max(a,b);
      const g=(hi<by)?by-hi:(lo>by+h)?lo-(by+h):-Math.min(hi-by,by+h-lo,h);
      gap=Math.min(gap,g-2.5);}
    return {box:j+1,tag:ev.tag,top:place[j],gap:+gap.toFixed(1)};
  });
}
function polyline(ctx,upto){
  ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=upto;i++){const x=X(i),y=Y(BARS[i].c);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();ctx.restore();
}


// ── 영어 병기 밴드
// 기본 자리는 화면 아래(구분선 y1468 · 글 y1524). 이 띠는 훅·되감기·정답에서 같은 자리에 온다.
// 요약 화면만 손글씨 CTA(y1512)와 겹치므로 제목 바로 밑(y344)으로 올린다.
const BAND_MAXW=968;   // 56 ~ 1024. 구분선과 같은 폭 안에 반드시 들어와야 한다.
function enBand(ctx,line,a=1,y=1524,rule=true){
  if(!line)return;
  // 바깥 투명도를 덮어쓰면 요약이 사라진 뒤에도 이 띠만 남는다. 곱해서 같이 사라지게 한다.
  ctx.save();ctx.globalAlpha*=a;
  if(rule){ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(56,y-56);ctx.lineTo(1024,y-56);ctx.stroke();}
  // 영어 문장은 회차마다 길이가 다르다. 넘치면 글자를 줄여 안으로 넣는다.
  // 26px 까지 줄여도 안 들어가면 그 문장이 너무 긴 것이니, 화면을 망가뜨리는 대신 잘라 표시한다.
  let px=34;
  ctx.font=`500 ${px}px PD`;
  while(px>26&&ctx.measureText(line).width>BAND_MAXW){px--;ctx.font=`500 ${px}px PD`;}
  let out=line;
  if(ctx.measureText(out).width>BAND_MAXW){
    while(out.length>4&&ctx.measureText(out+'…').width>BAND_MAXW)out=out.slice(0,-1);
    out+='…';
  }
  txt(ctx,out,56,y,`500 ${px}px PD`,'#b9c2d0');
  ctx.restore();
}

// ── 훅
function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  txt(ctx,COPY.kicker,60,200,'700 48px PD','#d8d8d8','left','.04em');
  // 결과 숫자는 0초부터 최종값을 보인다. 예전에는 0부터 올라가는 연출이라 첫 프레임이 «결과는 +0.00%» 였다.
  // 쇼츠 피드는 첫 프레임을 쓰므로 틀린 결과가 먼저 보였다(2·3회차도 같았다. 4회차 검증에서 발견).
  const p=1;
  shadow(ctx,true);
  txt(ctx,'결과는',56,330,'700 84px PD',C.muted);
  // 색과 부호는 최종값의 방향을 따른다. 예전에는 색이 C.up 으로 박혀 있어 하락 주에도
  // 훅만 초록이었고, 카운트업 첫 프레임(-0)이 '+0.00%' 로 찍혀 표지에 걸렸다.
  const wsign=STATS.weekPct>=0?'+':'-';
  numT(ctx,wsign+Math.abs(STATS.weekPct*p).toFixed(2)+'%',44,560,'900 250px PD',
       STATS.weekPct>=0?C.up:C.down,'left','-.06em');
  shadow(ctx,false);
  const q=seg(t,hs(1.05),hs(1.50));
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.translate(0,(1-easeOut(q))*30);
    shadow(ctx,true);
    txt(ctx,COPY.q1,60,700,'700 54px PD',C.text);
    txt(ctx,COPY.q2,60,782,'900 64px PD',C.hi);
    shadow(ctx,false);ctx.restore();}
  const NUM='①②③④';
  const opts=QUIZ.opts.map((v,k)=>[NUM[k],v]);
  // 보기 개수는 회차마다 다르다(2회차 3개, 3회차 2개). 크기를 고정하면 개수가
  // 줄었을 때 구멍이 생긴다 — 위로 붙이면 아래에 212px, 아래로 붙이면 질문
  // 밑에 192px 가 빈다. 블록이 늘 852~1200 을 채우도록 박스 높이를 나눈다.
  // 3개일 때 높이는 104px 로 예전과 똑같다(3*104 + 2*18 = 348).
  const OY=852, OH=348, GAP=18;
  const bh=(OH-GAP*(opts.length-1))/opts.length;
  opts.forEach((o,k)=>{
    const a=seg(t,hs(1.60+k*.35),hs(2.00+k*.35));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=OY+k*(bh+GAP), base=y+(bh-104)/2+70;   // 104px 일 때 예전 값과 같다
    ctx.fillStyle='rgba(255,255,255,.09)';rr(ctx,56,y,700,bh,16);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,56,y,700,bh,16);ctx.stroke();
    txt(ctx,o[0],96,base,'900 60px PD',C.hi);
    numT(ctx,o[1],186,base,'900 60px PD',C.text);
    ctx.restore();
  });
  const h=seg(t,hs(2.75),hs(3.05));
  if(h>0){ctx.save();ctx.globalAlpha=h;
    txt(ctx,`5분봉 ${STATS.n.toLocaleString('en-US')}개, 지금부터 다시 돌려봅니다`,60,1290,'900 52px PD',C.text);
    txt(ctx,COPY.span,60,1356,'700 40px PD',C.muted);
    ctx.restore();}
  enBand(ctx,COPY.enHook,h);
  brand(ctx);
}

// ── 되감기
function drawReplay(ctx,t){
  ctx.drawImage(BGC,0,0);
  const rt=t-REPLAY[0];
  const {i,seg:sg}=progressAt(rt);
  const bar=BARS[i];
  let peak=-1e9;for(let k=0;k<=i;k++)peak=Math.max(peak,BARS[k].h);
  const dd=(bar.c/peak-1)*100;
  txt(ctx,'나스닥100 선물 · 5분봉 다시 돌려보기',60,186,'700 46px PD',C.muted);
  shadow(ctx,true);
  numT(ctx,fmt(bar.c),56,330,'900 145px PD',C.text,'left','-.04em');
  shadow(ctx,false);
  numT(ctx,bar.kst,60,400,'700 44px PD','#d8d8d8');
  txt(ctx,'고점 대비',1024,300,'700 36px PD',C.muted,'right');
  numT(ctx,dd.toFixed(2)+'%',1024,372,'900 76px PD',dd<-0.05?C.down:C.muted,'right');
  chartPanel(ctx);dayShade(ctx);if(COPY.openLine)openLine(ctx);
  eventLines(ctx,i,'lines');eventLines(ctx,i,'labels');polyline(ctx,i);
  const px=X(i),py=Y(bar.c);
  ctx.save();ctx.fillStyle=C.line;ctx.beginPath();ctx.arc(px,py,11,0,7);ctx.fill();
  ctx.strokeStyle=C.line;ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,24,0,7);ctx.stroke();ctx.restore();
  dayAxis(ctx);
  const cur=EVENTS.find(e=>sg.hold&&e.i===sg.i1);
  const past=EVENTS.filter(e=>e.i<=i);
  const show=cur||past[past.length-1];
  if(show){
    const a=cur?easeOut(seg(rt,sg.t0,sg.t0+.3)):1;
    const dim=cur?1:.42;
    ctx.save();ctx.globalAlpha=a*dim;
    if(cur){
      ctx.strokeStyle=cur.col;ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(px,py,RING_R,0,7);ctx.stroke();
      ctx.fillStyle=cur.col;ctx.beginPath();ctx.arc(px,py,15,0,7);ctx.fill();
    }
    const fs=cur?42:32, ts=cur?56:42;
    ctx.save();ctx.translate(56,cur?470:486);ctx.rotate(-1.5*Math.PI/180);
    ctx.font=`900 ${fs}px PD`;
    const num=String(EVENTS.indexOf(show)+1)+'  ';
    const pw=ctx.measureText(num+show.when).width+52;
    ctx.fillStyle=show.col;rr(ctx,0,0,pw,fs+24,6);ctx.fill();
    ctx.fillStyle=show.col===C.hi?'#111':'#fff';ctx.fillText(num+show.when,26,fs+6);ctx.restore();
    shadow(ctx,!!cur);
    // 첫 줄 = 발표된 실제값(주인공) → 사건 색. 둘째 줄 = 예상값(비교 기준) → 회색.
    // 초안에서는 반대였다. 둘째 줄이 "지수는 하락" 같은 반응 해석이던 시절의 배색인데,
    // 그 문구를 뺀 뒤에도 색만 남아 예상값이 실제값보다 눈에 먼저 들어왔다.
    txt(ctx,show.l1,60,cur?600:594,`900 ${ts}px PD`,show.col);
    if(show.l2)txt(ctx,show.l2,60,cur?680:656,`900 ${ts}px PD`,C.muted);
    shadow(ctx,false);
    ctx.restore();
  }
  enBand(ctx,show?show.en:`Replaying ${STATS.n.toLocaleString('en-US')} five-minute bars`);
  brand(ctx);
}

// ── 정답
function drawAnswer(ctx,t){
  ctx.drawImage(BGC,0,0);
  const at=t-ANSWER[0];
  txt(ctx,'정답',60,186,'700 46px PD',C.muted);
  const p=easeOut(seg(at,.05,.5));
  ctx.save();ctx.globalAlpha=p;ctx.translate(0,(1-p)*26);
  shadow(ctx,true);
  txt(ctx,'①②③④'[QUIZ.ans],56,312,'900 58px PD',C.hi);
  txt(ctx,COPY.ansName,140,312,'900 74px PD',C.text);
  // 색을 C.down 으로 박아 두면 정답이 상승인 주에도 빨강으로 나간다.
  // 훅의 주간 등락률에서 이미 같은 버그를 고쳤다 — 여기도 부호를 따른다.
  numT(ctx,COPY.ansBig,52,476,'900 180px PD',
       String(COPY.ansBig).trim().startsWith('-')?C.down:C.up,'left','-.05em');
  shadow(ctx,false);ctx.restore();
  const q=seg(at,.6,.95);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    numT(ctx,COPY.ansSub1,60,566,'700 50px PD',C.text);
    // 걸린 시간은 봉 간격에서 계산한다. "하루 반" 같은 어림말을 손으로 적으면
    // 회차가 바뀌어도 그대로 남고, 1회차에서 실제 29시간을 36시간으로 부풀린 적이 있다.
    txt(ctx,COPY.ansSub2,60,632,'700 42px PD',C.muted);
    ctx.restore();}
  chartPanel(ctx);dayShade(ctx);if(COPY.openLine)openLine(ctx);
  // 1위 사건이 일어난 자리를 세로 띠로 짚어 준다
  // 보기 번호(QUIZ.ans)로 EVENTS 를 찾으면 안 된다. 보기 개수와 사건 개수는
  // 서로 다르다. 1위 사건은 rankTop 으로만 찾는다.
  const s=seg(at,.9,1.6);
  {
    const wi=EVENTS.findIndex(e=>e.rankTop);
    if(s>0&&wi>=0){const xw=X(EVENTS[wi].i);
      ctx.save();ctx.globalAlpha=s*.40;ctx.fillStyle=C.down;
      ctx.fillRect(xw-30,CY,60,CH);ctx.restore();}
  }
  eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  // 구분선(y634)이 바로 위 줄(ansSub2, y632)의 글자 아랫부분을 지나갔다 — 4회차 표본에서 발견.
  // 이 화면에서는 선을 빼고 글자만 둔다(두 줄 사이 약 28px).
  enBand(ctx,COPY.enAnswer,q,690,false);
  brand(ctx);
}

// ── 요약 + 루프
function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  // 예전에는 요약과 루프 카드가 1초 넘게 동시에 반투명으로 겹쳐 글자 위에 글자가 얹혔다.
  // 요약은 앞 0.5초에 먼저 사라지고, 루프 카드는 그 뒤에 들어온다.
  // 요약 구간이 4.7초에서 3.0초로 줄었다(그만큼 되감기에 줬다). 안쪽 등장 시각도 같이
  // 당기지 않으면 내용이 다 뜨자마자 사라진다 — 3.0초에서 머무는 시간이 0.20초가 된다.
  const fadeOut=seg(t,SUMM[1]-1.0,SUMM[1]-0.62);  // 요약이 빠지는 구간
  const out=seg(t,SUMM[1]-0.62,SUMM[1]-0.08);     // 루프 카드가 들어오는 구간
  ctx.save();ctx.globalAlpha=1-fadeOut;
  txt(ctx,COPY.summ1,60,186,'900 52px PD',C.text);
  txt(ctx,COPY.summ2,60,250,'900 52px PD',C.hi);
  // 표의 범위를 한국어로도 밝힌다. 안 밝히면 «1위·2위·3위» 가 그 주 5분봉 전체의
  // 순위로 읽힌다 — 2.1초 앞 정답 화면이 «1,178개 중 3위» 라고 말하는 것과 어긋난다.
  txt(ctx,COPY.rowsScope||'',60,314,'700 34px PD',C.muted);
  enBand(ctx,COPY.enSumm,1,360,false);
  const rows=COPY.rows.map(r=>[r[0],r[1],C[r[2]]||C.text]);
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.10+k*.14,.38+k*.14));if(a<=0)return;
    ctx.save();ctx.globalAlpha=(1-fadeOut)*a;ctx.translate(0,(1-a)*20);
    const y=390+k*118;
    txt(ctx,r[0],56,y+52,'700 46px PD',C.text);
    numT(ctx,r[1],1024,y+56,'900 56px PD',r[2],'right');
    // 마지막 줄 밑줄(y708)은 위로 올려 쌓은 사건 배지(y707~741)의 윗부분에 닿았다 — 4회차 표본.
    // 표 맨 아래 선은 없어도 읽힌다.
    if(k<rows.length-1){ctx.strokeStyle='#262626';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(56,y+82);ctx.lineTo(1024,y+82);ctx.stroke();}
    ctx.restore();
  });
  chartPanel(ctx);dayShade(ctx);if(COPY.openLine)openLine(ctx);
  eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  const c=easeOut(seg(st,0.95,1.35));
  if(c>0){ctx.save();ctx.globalAlpha=(1-fadeOut)*c;
    txt(ctx,'몇 번 고르셨나요?',60,1512,'400 88px PEN',C.hi);
    txt(ctx,'다음 주도 다시 돌려 드립니다',60,1594,'700 44px PD','#d8d8d8');
    ctx.restore();}
  ctx.restore();
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.drawImage(BGC,0,0);
      txt(g,COPY.kicker,60,206,'700 48px PD','#d8d8d8','left','.04em');
      shadow(g,true);
      // 세로 간격: 4회차 표본에서 «결과는»(y362) 아랫부분과 «+3.17%»(250px, 윗선 약 y372)이,
      // «시가 위에 있던 시간»(y690) 과 «100%»(윗선 약 y710)이 각각 10px 안팎으로 붙어 있었다.
      // 훅 화면(«결과는» y330)과 같은 간격으로 맞추고 아래 셋을 내렸다.
      txt(g,'결과는',56,330,'700 84px PD',C.muted);
      numT(g,pct(STATS.weekPct),44,552,'900 250px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
      // 이 자리는 원래 "-2.17%" 같은 숫자만 들어오던 곳이라 250px 이었다. 한글이 섞이면
      // 글리프가 숫자보다 높아 위 라벨을 뚫는다. 내용을 보고 크기를 정한다.
      const lbig=/[가-힣]/.test(COPY.loopBig)?170:250;
      txt(g,COPY.loopLabel,56,700,'700 76px PD',C.muted);
      // 색을 C.down 으로 박아 두었었다(3회차 정답이 하락이라 맞아 보였다). 정답이 상승이거나
      // 비율인 회차에는 틀린 색이 나간다 — 지침 5-3. 렌더 쪽이 넘긴 색을 쓴다.
      numT(g,COPY.loopBig,44,930,`900 ${lbig}px PD`,C[COPY.loopColor]||C.down,'left','-.06em');
      shadow(g,false);
      txt(g,COPY.loopTail,60,1040,'700 56px PD',C.text);
      window.__loopC=lc;
    }
    ctx.save();ctx.globalAlpha=out;ctx.drawImage(window.__loopC,0,0);ctx.restore();
  }
  brand(ctx);
}

function draw(t){
  const ctx=document.getElementById('c').getContext('2d');
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(t<REPLAY[0])drawHook(ctx,t);
  else if(t<ANSWER[0])drawReplay(ctx,t);
  else if(t<SUMM[0])drawAnswer(ctx,t);
  else drawSumm(ctx,t);
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,W,6);
  ctx.fillStyle=C.hi;ctx.fillRect(0,0,W*clamp01(t/DUR),6);ctx.restore();
}
