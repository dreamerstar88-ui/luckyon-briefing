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
  const HOLD=Math.min(1.8,9.0/Math.max(1,EVENTS.length)), total=REPLAY[1]-REPLAY[0];
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
function eventSlots(){
  const MINX=90, slot=[];
  for(let k=0;k<EVENTS.length;k++){
    const near = k>0 && (X(EVENTS[k].i)-X(EVENTS[k-1].i))<MINX;
    slot.push(near ? 1-slot[k-1] : 0);
  }
  return slot;
}
function eventLines(ctx,upto,mode){
  ctx.save();
  // 바깥에서 준 투명도를 덮어쓰면 요약이 사라져도 배지·라벨만 남아 루프 카드 위에 얹힌다.
  const A=ctx.globalAlpha;
  const SLOT=eventSlots();
  const crowded=SLOT.some(v=>v===1);
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k];
    if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=A*.55;ctx.strokeStyle=ev.col;ctx.lineWidth=2.5;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.moveTo(x,CY);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;
    }
    // 번호 배지
    const by0=CY-20-SLOT[k]*46;
    ctx.globalAlpha=A;ctx.fillStyle=ev.col;
    ctx.beginPath();ctx.arc(x,by0,17,0,7);ctx.fill();
    if(SLOT[k]){ctx.strokeStyle=ev.col;ctx.lineWidth=2;ctx.globalAlpha=A*.5;
      ctx.beginPath();ctx.moveTo(x,by0+17);ctx.lineTo(x,CY);ctx.stroke();ctx.globalAlpha=A;}
    ctx.save();ctx.font='900 22px PD';ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),x,by0+1);ctx.restore();
    // 세로 글씨 (주가 선 아래에 깐다 — polyline 보다 먼저 그린다)
    const LH=31, PADX=14, PADY=12, BW=PADX*2+26;
    const h=vtextH(ev.tag,LH);
    const right=x+16, left=x-16-BW;
    const bx=(right+BW<CX+CW-40)?right:left;
    // 선이 라벨을 덮어 글자가 안 보이던 자리를 피한다. 상자가 덮는 x 구간에서 선의
    // 가장 높은 점과 가장 낮은 점을 보고, 위아래 중 여유가 큰 쪽에 세운다.
    // 사건 봉의 종가 한 점만 보면 바로 뒤 스파이크가 상자를 뚫고 지나간다.
    // 자리는 전체 봉 기준으로 한 번 정한다 — 그래야 선이 다가와도 상자가 안 움직인다.
    const box=h+PADY*2;
    let by;
    if(crowded){
      // 붙어 있는 쌍은 선을 피하는 것보다 서로 안 겹치는 게 먼저다. 위아래로 나눈다.
      by = SLOT[k] ? CY+CH-box-14 : CY+14;
    }else{
      let top=1e9,bot=-1e9;
      for(let j=0;j<BARS.length;j++){const xj=X(j);if(xj<bx-4||xj>bx+BW+4)continue;
        const yj=Y(BARS[j].c);if(yj<top)top=yj;if(yj>bot)bot=yj;}
      if(top>bot){top=bot=Y(BARS[ev.i].c);}
      by=((top-CY) >= (CY+CH-bot)) ? CY+14 : CY+CH-box-14;
    }
    ctx.globalAlpha=A;ctx.fillStyle='rgba(0,0,0,.86)';
    rr(ctx,bx,by,BW,h+PADY*2,10);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.globalAlpha=A*.45;ctx.lineWidth=2;rr(ctx,bx,by,BW,h+PADY*2,10);ctx.stroke();
    ctx.globalAlpha=A;
    vtext(ctx,ev.tag,bx+PADX+13,by+PADY+LH/2,'700 26px PD',ev.col,LH);
  }
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>numT(ctx,d.slice(5).replace('-','/')+' '+dowOf(d),CX+wSeg*(i+.5),CY+CH+62,'700 32px PD',C.muted,'center'));
  txt(ctx,'가로축은 미국 날짜 · 밝은 구간은 미국 정규장(한국 밤 10:30~새벽 5:00)',56,CY+CH+124,'500 27px PD',C.dim);
  ctx.restore();
}
// ── 주간 시가 기준선. 이번 회차의 질문이 "시가를 되찾았나" 라서 선으로 보여 준다.
function openLine(ctx,a=1){
  const y=Y(BARS[0].o);
  ctx.save();ctx.globalAlpha*=a;
  ctx.strokeStyle='#9aa6b8';ctx.lineWidth=2.5;ctx.setLineDash([10,8]);
  ctx.beginPath();ctx.moveTo(CX,y);ctx.lineTo(CX+CW,y);ctx.stroke();ctx.setLineDash([]);
  // 라벨 자리는 사건 커서와 세로 라벨 상자를 둘 다 피해서 고른다.
  // 왼쪽 끝에 두었더니 첫 사건 커서가 1.8초 내내 '시가' 두 글자를 덮었고,
  // 사건 x 만 피했더니 이번엔 마지막 사건의 세로 라벨 상자와 겹쳤다.
  // 그래서 상자의 실제 x 구간을 그대로 구해 놓고, 그 어느 것과도 안 겹치는 자리를 찾는다.
  const CW_=186;
  const blocked=[];
  for(const ev of EVENTS){
    const x=X(ev.i);
    const BW2=14*2+26, right=x+16, left=x-16-BW2;
    const bx3=(right+BW2<CX+CW-40)?right:left;
    blocked.push([bx3-8,bx3+BW2+8]);      // 세로 라벨 상자
    blocked.push([x-34,x+34]);            // 사건 커서 링
  }
  // 주가 곡선이 칩의 세로 대역을 지나가는 구간도 막는다. 이번 회차는 모든 종가가
  // 시가 아래라 걸리지 않지만, 곡선이 시가선 위로 올라가는 주에는 칩과 겹친다.
  for(let i=0;i<BARS.length;i++){
    const yi=Y(BARS[i].c);
    if(yi>=y-40&&yi<=y){const xi=X(i);blocked.push([xi-6,xi+6]);}
  }
  let bx2=CX+6, best=-1e9;
  for(let c0=CX+6;c0<=CX+CW-CW_-6;c0+=10){
    let d=1e9;
    for(const [a0,b0] of blocked) d=Math.min(d, (c0>b0)?c0-b0 : (c0+CW_<a0)?a0-(c0+CW_) : -1);
    if(d>best){best=d;bx2=c0;}
  }
  ctx.fillStyle='rgba(10,14,22,.85)';rr(ctx,bx2,y-36,CW_,32,6);ctx.fill();
  txt(ctx,'시가 '+fmt(BARS[0].o),bx2+10,y-13,'700 24px PD','#c8d0dc');
  ctx.restore();
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
  const p=easeOut(seg(t,hs(.10),hs(1.00)));
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
  const NUM='①②③';
  const opts=QUIZ.opts.map((v,k)=>[NUM[k],v]);
  opts.forEach((o,k)=>{
    const a=seg(t,hs(1.60+k*.35),hs(2.00+k*.35));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=852+k*122;
    ctx.fillStyle='rgba(255,255,255,.09)';rr(ctx,56,y,700,104,16);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,56,y,700,104,16);ctx.stroke();
    txt(ctx,o[0],96,y+70,'900 60px PD',C.hi);
    numT(ctx,o[1],186,y+70,'900 60px PD',C.text);
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
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,i,'lines');eventLines(ctx,i,'labels');polyline(ctx,i);
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
      ctx.beginPath();ctx.arc(px,py,32,0,7);ctx.stroke();
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
  txt(ctx,'①②③'[QUIZ.ans],56,312,'900 58px PD',C.hi);
  txt(ctx,COPY.ansName,140,312,'900 74px PD',C.text);
  numT(ctx,COPY.ansBig,52,476,'900 180px PD',C.down,'left','-.05em');
  shadow(ctx,false);ctx.restore();
  const q=seg(at,.6,.95);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    numT(ctx,COPY.ansSub1,60,566,'700 50px PD',C.text);
    // 걸린 시간은 봉 간격에서 계산한다. "하루 반" 같은 어림말을 손으로 적으면
    // 회차가 바뀌어도 그대로 남고, 1회차에서 실제 29시간을 36시간으로 부풀린 적이 있다.
    txt(ctx,COPY.ansSub2,60,632,'700 42px PD',C.muted);
    ctx.restore();}
  chartPanel(ctx);dayShade(ctx);
  // 1위 사건이 일어난 자리를 세로 띠로 짚어 준다
  const s=seg(at,.9,1.6);
  if(s>0&&EVENTS[QUIZ.ans]){
    const wi=EVENTS.findIndex(e=>e.rankTop);
    if(wi>=0){const xw=X(EVENTS[wi].i);
      ctx.save();ctx.globalAlpha=s*.40;ctx.fillStyle=C.down;
      ctx.fillRect(xw-30,CY,60,CH);ctx.restore();}
  }
  eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  enBand(ctx,COPY.enAnswer,q,690,true);
  brand(ctx);
}

// ── 요약 + 루프
function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  // 예전에는 요약과 루프 카드가 1초 넘게 동시에 반투명으로 겹쳐 글자 위에 글자가 얹혔다.
  // 요약은 앞 0.5초에 먼저 사라지고, 루프 카드는 그 뒤에 들어온다.
  const fadeOut=seg(t,SUMM[1]-1.2,SUMM[1]-0.7);   // 요약이 빠지는 구간
  const out=seg(t,SUMM[1]-0.7,SUMM[1]-0.1);       // 루프 카드가 들어오는 구간
  ctx.save();ctx.globalAlpha=1-fadeOut;
  txt(ctx,COPY.summ1,60,206,'900 52px PD',C.text);
  txt(ctx,COPY.summ2,60,278,'900 52px PD',C.hi);
  enBand(ctx,COPY.enSumm,1,344,false);
  const rows=COPY.rows.map(r=>[r[0],r[1],C[r[2]]||C.text]);
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.15+k*.22,.5+k*.22));if(a<=0)return;
    ctx.save();ctx.globalAlpha=(1-fadeOut)*a;ctx.translate(0,(1-a)*20);
    const y=390+k*118;
    txt(ctx,r[0],56,y+52,'700 46px PD',C.text);
    numT(ctx,r[1],1024,y+56,'900 56px PD',r[2],'right');
    ctx.strokeStyle='#262626';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(56,y+82);ctx.lineTo(1024,y+82);ctx.stroke();
    ctx.restore();
  });
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  const c=easeOut(seg(st,1.1,1.6));
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
      txt(g,'결과는',56,362,'700 84px PD',C.muted);
      numT(g,pct(STATS.weekPct),44,552,'900 250px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
      // 이 자리는 원래 "-2.17%" 같은 숫자만 들어오던 곳이라 250px 이었다. 한글이 섞이면
      // 글리프가 숫자보다 높아 위 라벨을 뚫는다. 내용을 보고 크기를 정한다.
      const lbig=/[가-힣]/.test(COPY.loopBig)?170:250;
      txt(g,COPY.loopLabel,56,690,'700 76px PD',C.muted);
      numT(g,COPY.loopBig,44,890,`900 ${lbig}px PD`,C.down,'left','-.06em');
      shadow(g,false);
      txt(g,COPY.loopTail,60,1000,'700 56px PD',C.text);
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
