// ===== 넘버뷰 주간 되감기 렌더 로직 (브라우저 캔버스에서 실행) =====
const W=1080,H=1920,FPS=30;
const HOOK=[0,3.2], REPLAY=[3.2,46.0], ANSWER=[46.0,52.0], SUMM=[52.0,58.4];
const DUR=58.4;
const C={bg:'#000000',text:'#ffffff',muted:'#8f9aad',dim:'#6a7383',line:'#4ea8ff',
         down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d',panel:'rgba(0,0,0,.55)'};
const CX=60,CW=960,CY=790,CH=500;
let BARS=[],EVENTS=[],DAYS=[],BGC=null,LO=0,HI=1,SCHED=[],STATS={};
const WD=['월','화','수','목','금'];

const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const easeOut=t=>1-Math.pow(1-t,3);
const clamp01=t=>Math.max(0,Math.min(1,t));
const seg=(t,a,b)=>clamp01((t-a)/(b-a));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pct=(v,d=2)=>(v>=0?'+':'')+v.toFixed(d)+'%';

function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function shadow(ctx,on){if(on){ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=40;ctx.shadowOffsetY=10;}else{ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;}}
function txt(ctx,s,x,y,font,col,align='left',ls=''){ctx.save();ctx.font=font;ctx.fillStyle=col;ctx.textAlign=align;ctx.textBaseline='alphabetic';if(ls)ctx.letterSpacing=ls;ctx.fillText(s,x,y);ctx.restore();}

// ── 좌표
const Y=v=>CY+CH-(v-LO)/(HI-LO)*CH;
const X=i=>CX+i/(BARS.length-1)*CW;

// ── 되감기 진행: 시간 → 봉 인덱스 (사건에서 멈춤)
function buildSchedule(){
  const HOLD=1.8, total=REPLAY[1]-REPLAY[0];
  const drawT=total-HOLD*EVENTS.length;
  const idxs=EVENTS.map(e=>e.i);
  const segs=[];let prev=0,t=0;
  for(const ix of idxs){
    const n=ix-prev, d=n/(BARS.length-1)*drawT;
    segs.push({t0:t,t1:t+d,i0:prev,i1:ix,hold:false});t+=d;
    segs.push({t0:t,t1:t+HOLD,i0:ix,i1:ix,hold:true});t+=HOLD;
    prev=ix;
  }
  const n=(BARS.length-1)-prev;
  segs.push({t0:t,t1:t+n/(BARS.length-1)*drawT,i0:prev,i1:BARS.length-1,hold:false});
  SCHED=segs;
}
function progressAt(rt){ // rt = REPLAY 내 경과초
  for(const s of SCHED){ if(rt<=s.t1) return {i:Math.round(s.i0+(s.i1-s.i0)*clamp01((rt-s.t0)/Math.max(.001,s.t1-s.t0))),seg:s}; }
  const l=SCHED[SCHED.length-1];return {i:l.i1,seg:l};
}

// ── 배경 (한 번만 만들어 재사용)
function buildBg(img){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  g.fillStyle=C.bg;g.fillRect(0,0,W,H);
  g.save();g.filter='blur(12px) contrast(1.1) saturate(1.15)';g.globalAlpha=.28;
  const ar=img.width/img.height, tar=W/H; let dw,dh;
  if(ar>tar){dh=H;dw=H*ar;}else{dw=W;dh=W/ar;}
  g.drawImage(img,(W-dw)/2-W*.05,(H-dh)/2,dw,dh);g.restore();
  let rg=g.createRadialGradient(W/2,H*.45,W*.25,W/2,H*.45,W*.95);
  rg.addColorStop(0,'rgba(0,0,0,0)');rg.addColorStop(1,'rgba(0,0,0,.78)');
  g.fillStyle=rg;g.fillRect(0,0,W,H);
  let lg=g.createLinearGradient(0,0,0,H);
  lg.addColorStop(0,'rgba(0,0,0,.60)');lg.addColorStop(.28,'rgba(0,0,0,0)');
  lg.addColorStop(.55,'rgba(0,0,0,0)');lg.addColorStop(.82,'rgba(0,0,0,.94)');lg.addColorStop(1,'rgba(0,0,0,.98)');
  g.fillStyle=lg;g.fillRect(0,0,W,H);
  // 그레인
  const nc=document.createElement('canvas');nc.width=270;nc.height=480;const ng=nc.getContext('2d');
  const id=ng.createImageData(270,480);
  for(let k=0;k<id.data.length;k+=4){const v=Math.random()*255;id.data[k]=id.data[k+1]=id.data[k+2]=v;id.data[k+3]=26;}
  ng.putImageData(id,0,0);
  g.save();g.globalAlpha=.5;g.imageSmoothingEnabled=false;g.drawImage(nc,0,0,W,H);g.restore();
  BGC=c;
}

// ── 공통 요소
function brand(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;
  ctx.font='700 30px PD';ctx.textAlign='left';
  ctx.fillStyle=C.hi;ctx.fillText('luckyon',56,1668);
  const w=ctx.measureText('luckyon').width;
  ctx.fillStyle='#d8d8d8';ctx.fillText(' 넘버뷰 · 이번 주 나스닥',56+w,1668);
  txt(ctx,'나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다',56,1716,'500 26px PD',C.dim);
  ctx.restore();
}
function chartPanel(ctx,a=1){ctx.save();ctx.globalAlpha=a;ctx.fillStyle=C.panel;rr(ctx,40,CY-46,1000,CH+92,24);ctx.fill();ctx.restore();}
function dayShade(ctx){
  ctx.save();
  for(const d of DAYS){
    const a=BARS.findIndex(x=>x.d===d+' 09:30');let b=BARS.findIndex(x=>x.d===d+' 16:00');
    if(b<0)b=BARS.length-1; if(a<0)continue;
    ctx.fillStyle='rgba(255,255,255,.05)';rr(ctx,X(a),CY,X(b)-X(a),CH,6);ctx.fill();
  }
  ctx.strokeStyle='#3a3a3a';ctx.lineWidth=2;ctx.setLineDash([6,8]);
  for(let k=1;k<DAYS.length;k++){
    let i=BARS.findIndex(x=>x.d===DAYS[k]+' 00:00');if(i<0)i=BARS.findIndex(x=>x.d.startsWith(DAYS[k]));
    if(i>0){ctx.beginPath();ctx.moveTo(X(i),CY);ctx.lineTo(X(i),CY+CH);ctx.stroke();}
  }
  ctx.setLineDash([]);ctx.restore();
}
function dayAxis(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>txt(ctx,d.slice(5).replace('-','/')+' '+WD[i],CX+wSeg*(i+.5),CY+CH+62,'700 32px PD',C.muted,'center'));
  txt(ctx,'밝은 구간 = 미국 정규장(한국시간 밤 10:30~새벽 5:00)',56,CY+CH+128,'500 32px PD',C.dim);
  ctx.restore();
}
function polyline(ctx,upto,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=C.line;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=upto;i++){const x=X(i),y=Y(BARS[i].c);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();ctx.restore();
}

// ── 장면 1: 훅
function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  const fin=1;
  ctx.save();ctx.globalAlpha=fin;
  txt(ctx,'지난주 나스닥 · 월 개장 ~ 금 마감',60,206,'700 48px PD','#d8d8d8','left','.04em');
  // 큰 숫자 카운트업
  const p=easeOut(seg(t,.05,.75));
  const v=STATS.weekPct*p;
  shadow(ctx,true);
  txt(ctx,'결과는',56,362,'700 84px PD',C.muted);
  ctx.save();ctx.font='900 250px PD';ctx.letterSpacing='-.06em';ctx.fillStyle=C.up;ctx.textAlign='left';
  ctx.fillText(pct(v),44,552);ctx.restore();
  shadow(ctx,false);
  // 질문
  const q=seg(t,1.0,1.35);
  if(q>0){ctx.save();ctx.globalAlpha=fin*q;ctx.translate(0,(1-easeOut(q))*36);
    shadow(ctx,true);
    txt(ctx,'한 주 등락률은 이게 전부입니다.',60,700,'700 60px PD',C.text);
    txt(ctx,'그 사이 최대 낙폭은 얼마였을까요?',60,790,'900 66px PD',C.hi);
    shadow(ctx,false);ctx.restore();}
  // 보기 3개
  const opts=[['①','-0.5%'],['②','-1.2%'],['③','-2.2%']];
  opts.forEach((o,k)=>{
    const a=seg(t,1.55+k*.28,1.85+k*.28);if(a<=0)return;
    ctx.save();ctx.globalAlpha=fin*a;ctx.translate(0,(1-easeOut(a))*30);
    const y=930+k*140;
    ctx.fillStyle='rgba(255,255,255,.09)';rr(ctx,56,y,760,110,16);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,56,y,760,110,16);ctx.stroke();
    txt(ctx,o[0],96,y+76,'900 62px PD',C.hi);
    txt(ctx,o[1],186,y+76,'900 62px PD',C.text);
    ctx.restore();
  });
  const h=seg(t,2.5,2.9);
  if(h>0){ctx.save();ctx.globalAlpha=fin*h;
    txt(ctx,'5분봉 1,179개, 지금부터 되감습니다',60,1420,'900 54px PD',C.text);
    txt(ctx,'월요일 개장 → 금요일 마감',60,1490,'700 42px PD',C.muted);
    ctx.restore();}
  ctx.restore();
  brand(ctx,fin);
}

// ── 장면 2: 되감기
function drawReplay(ctx,t){
  ctx.drawImage(BGC,0,0);
  const rt=t-REPLAY[0];
  const {i,seg:sg}=progressAt(rt);
  const bar=BARS[i];
  // 현재 낙폭
  let peak=-1e9;for(let k=0;k<=i;k++)peak=Math.max(peak,BARS[k].h);
  const dd=(BARS[i].c/peak-1)*100;
  // 헤더
  txt(ctx,'나스닥100 선물 · 5분봉 되감기',60,186,'700 46px PD',C.muted);
  shadow(ctx,true);
  txt(ctx,fmt(bar.c),56,330,'900 145px PD',C.text,'left','-.04em');
  shadow(ctx,false);
  txt(ctx,bar.kst,60,400,'700 44px PD','#d8d8d8');
  // 고점 대비
  ctx.save();ctx.textAlign='right';
  txt(ctx,'고점 대비',1024,300,'700 36px PD',C.muted,'right');
  txt(ctx,dd.toFixed(2)+'%',1024,372,'900 76px PD',dd<-0.05?C.down:C.muted,'right');
  ctx.restore();
  // 차트
  chartPanel(ctx);dayShade(ctx);polyline(ctx,i);
  // 현재 점
  const px=X(i),py=Y(bar.c);
  ctx.save();ctx.fillStyle=C.line;ctx.beginPath();ctx.arc(px,py,11,0,7);ctx.fill();
  ctx.strokeStyle=C.line;ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,24,0,7);ctx.stroke();ctx.restore();
  dayAxis(ctx);
  // 지나간 사건은 흐리게 남긴다
  const past=EVENTS.filter(e=>e.i<=i&&!(sg.hold&&e.i===sg.i1));
  if(past.length&&!sg.hold){
    const ev=past[past.length-1];
    ctx.save();ctx.globalAlpha=.40;
    ctx.save();ctx.translate(56,486);ctx.rotate(-1.5*Math.PI/180);
    ctx.font='900 32px PD';const pw2=ctx.measureText(ev.when).width+40;
    ctx.fillStyle=ev.col;rr(ctx,0,0,pw2,50,5);ctx.fill();
    ctx.fillStyle=ev.col===C.hi?'#111':'#fff';ctx.fillText(ev.when,20,36);ctx.restore();
    txt(ctx,ev.l1,60,590,'700 44px PD',C.text);
    if(ev.l2)txt(ctx,ev.l2,60,646,'700 44px PD',ev.col);
    ctx.restore();
  }
  // 사건 라벨 (정지 구간)
  if(sg.hold){
    const ev=EVENTS.find(e=>e.i===sg.i1);
    if(ev){
      const a=easeOut(seg(rt,sg.t0,sg.t0+.35))*(1-seg(rt,sg.t1-.25,sg.t1)*.0);
      ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-a)*24);
      // 지시선
      ctx.strokeStyle=ev.col;ctx.lineWidth=3;ctx.setLineDash([8,6]);
      ctx.beginPath();ctx.moveTo(px,py-26);ctx.lineTo(px,CY-36);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=ev.col;ctx.beginPath();ctx.arc(px,py,15,0,7);ctx.fill();
      ctx.strokeStyle=ev.col;ctx.globalAlpha=a*.6;ctx.lineWidth=4;ctx.beginPath();ctx.arc(px,py,30,0,7);ctx.stroke();
      ctx.globalAlpha=a;
      // 알약
      ctx.save();ctx.translate(56,470);ctx.rotate(-1.5*Math.PI/180);
      ctx.font='900 42px PD';const pw=ctx.measureText(ev.when).width+52;
      ctx.fillStyle=ev.col;rr(ctx,0,0,pw,66,6);ctx.fill();
      ctx.fillStyle=ev.col===C.hi?'#111':'#fff';ctx.fillText(ev.when,26,47);ctx.restore();
      // 문구
      shadow(ctx,true);
      txt(ctx,ev.l1,60,600,'900 58px PD',C.text);
      if(ev.l2)txt(ctx,ev.l2,60,672,'900 58px PD',ev.col);
      shadow(ctx,false);
      ctx.restore();
    }
  }
  brand(ctx);
}

// ── 장면 3: 정답
function drawAnswer(ctx,t){
  ctx.drawImage(BGC,0,0);
  const at=t-ANSWER[0];
  txt(ctx,'정답',60,186,'700 46px PD',C.muted);
  const p=easeOut(seg(at,.1,.7));
  ctx.save();ctx.globalAlpha=p;ctx.translate(0,(1-p)*30);
  shadow(ctx,true);
  ctx.save();ctx.font='900 62px PD';ctx.fillStyle=C.hi;ctx.fillText('③',56,330);ctx.restore();
  ctx.save();ctx.font='900 190px PD';ctx.letterSpacing='-.05em';ctx.fillStyle=C.down;ctx.fillText('-2.18%',150,330);ctx.restore();
  shadow(ctx,false);ctx.restore();
  const q=seg(at,.9,1.3);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    txt(ctx,'고점 29,571 → 저점 28,927',60,436,'700 54px PD',C.text);
    txt(ctx,'화요일 오후 → 수요일 저녁, 하루 반 만에',60,506,'700 44px PD',C.muted);
    ctx.restore();}
  chartPanel(ctx);dayShade(ctx);
  // 낙폭 구간 음영
  const s=seg(at,1.4,2.2);
  if(s>0){
    const a=STATS.peakIdx,b=STATS.troughIdx;
    ctx.save();ctx.globalAlpha=s*.34;ctx.fillStyle=C.down;
    ctx.fillRect(X(a),CY,(X(b)-X(a))*easeOut(s),CH);ctx.restore();
    ctx.save();ctx.globalAlpha=s;ctx.strokeStyle=C.down;ctx.lineWidth=4;ctx.setLineDash([12,8]);
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[a].h));ctx.lineTo(X(b),Y(BARS[a].h));ctx.stroke();
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[b].l));ctx.lineTo(X(b),Y(BARS[b].l));ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
  }
  polyline(ctx,BARS.length-1);
  dayAxis(ctx);
  brand(ctx);
}

// ── 장면 4: 요약 + 루프
function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  const out=seg(t,SUMM[1]-1.6,SUMM[1]-0.2); // 마지막에 첫 프레임 구도로 복귀
  ctx.save();ctx.globalAlpha=1-out;
  txt(ctx,'이번 주 바닥도, 꼭대기도',60,206,'900 52px PD',C.text);
  txt(ctx,'한국 저녁에 나왔다.',60,272,'900 52px PD',C.hi);
  const rows=[['주간 최저 · 수 저녁 8시','28,927',C.down],
              ['주간 최고 · 금 저녁 7시 45분','29,704',C.up],
              ['결국 한 주 결과','+0.36%',C.up]];
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.2+k*.3,.6+k*.3));if(a<=0)return;
    ctx.save();ctx.globalAlpha=(1-out)*a;ctx.translate(0,(1-a)*22);
    const y=390+k*118;
    txt(ctx,r[0],56,y+52,'700 46px PD',C.text);
    txt(ctx,r[1],1024,y+56,'900 56px PD',r[2],'right');
    ctx.strokeStyle='#262626';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(56,y+82);ctx.lineTo(1024,y+82);ctx.stroke();
    ctx.restore();
  });
  chartPanel(ctx);dayShade(ctx);polyline(ctx,BARS.length-1);dayAxis(ctx);
  const c=easeOut(seg(st,1.6,2.2));
  if(c>0){ctx.save();ctx.globalAlpha=(1-out)*c;
    txt(ctx,'몇 번 고르셨나요?',60,1462,'400 88px PEN',C.hi);
    txt(ctx,'다음 주도 되감아 드립니다',60,1548,'700 44px PD','#d8d8d8');
    ctx.restore();}
  ctx.restore();
  // 루프 프레임 (첫 프레임과 같은 구도) — 별도 캔버스에 불투명하게 그린 뒤 덮는다
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;
      const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);
      g.drawImage(BGC,0,0);
      txt(g,'지난주 나스닥 · 월 개장 ~ 금 마감',60,206,'700 48px PD','#d8d8d8','left','.04em');
      shadow(g,true);
      txt(g,'결과는',56,362,'700 84px PD',C.muted);
      g.save();g.font='900 250px PD';g.letterSpacing='-.06em';g.fillStyle=C.up;g.fillText('+0.36%',44,552);g.restore();
      txt(g,'과정은',56,700,'700 84px PD',C.muted);
      g.save();g.font='900 250px PD';g.letterSpacing='-.06em';g.fillStyle=C.down;g.fillText('-2.18%',44,890);g.restore();
      shadow(g,false);
      txt(g,'한 주 등락률 뒤에 숨은 낙폭',60,1000,'700 56px PD',C.text);
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
  // 장면 전환 짧은 크로스 컷 대신 상단 러닝바
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,W,6);
  ctx.fillStyle=C.hi;ctx.fillRect(0,0,W*clamp01(t/DUR),6);ctx.restore();
}
