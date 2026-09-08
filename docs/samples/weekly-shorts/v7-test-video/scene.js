// ===== 넘버뷰 주간 되감기 v3 — 35초 =====
// 30초 판에서 훅이 너무 빨리 지나가 읽히지 않는다는 지적을 받아 늘렸다.
// 늘린 5초 중 2.4초를 훅에, 2.0초를 되감기에, 나머지를 정답·요약에 나눠 줬다.
const W=1080,H=1920,FPS=30;
const HOOK=[0,5.0], REPLAY=[5.0,26.2], ANSWER=[26.2,30.3], SUMM=[30.3,35.0];
const DUR=35.0;
// 훅 안쪽 연출 시각은 2.6초 기준으로 짜여 있다. 훅 길이가 바뀌면 같은 비율로 늘린다.
const HS=(HOOK[1]-HOOK[0])/2.6;
const C={bg:'#000000',text:'#ffffff',muted:'#8f9aad',dim:'#6a7383',line:'#4ea8ff',
         down:'#ff4d4d',up:'#3ddc84',hi:'#ffe14d',panel:'rgba(0,0,0,.55)'};
const CX=60,CW=960,CY=790,CH=500;
let BARS=[],EVENTS=[],DAYS=[],BGC=null,LO=0,HI=1,SCHED=[],STATS={};
const WD=['월','화','수','목','금'];

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
function eventLines(ctx,upto,mode){
  ctx.save();
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k];
    if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=.55;ctx.strokeStyle=ev.col;ctx.lineWidth=2.5;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.moveTo(x,CY);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;
    }
    // 번호 배지
    ctx.globalAlpha=1;ctx.fillStyle=ev.col;
    ctx.beginPath();ctx.arc(x,CY-20,17,0,7);ctx.fill();
    ctx.save();ctx.font='900 22px PD';ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),x,CY-19);ctx.restore();
    // 세로 글씨 (선 위에 올린다)
    const LH=31, PADX=14, PADY=12, BW=PADX*2+26;
    const h=vtextH(ev.tag,LH);
    const right=x+16, left=x-16-BW;
    const bx=(right+BW<CX+CW-40)?right:left;
    const by=CY+14;
    ctx.globalAlpha=1;ctx.fillStyle='rgba(0,0,0,.86)';
    rr(ctx,bx,by,BW,h+PADY*2,10);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.globalAlpha=.45;ctx.lineWidth=2;rr(ctx,bx,by,BW,h+PADY*2,10);ctx.stroke();
    ctx.globalAlpha=1;
    vtext(ctx,ev.tag,bx+PADX+13,by+PADY+LH/2,'700 26px PD',ev.col,LH);
  }
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>numT(ctx,d.slice(5).replace('-','/')+' '+WD[i],CX+wSeg*(i+.5),CY+CH+62,'700 32px PD',C.muted,'center'));
  txt(ctx,'밝은 구간 = 미국 정규장(한국시간 밤 10:30~새벽 5:00)',56,CY+CH+124,'500 30px PD',C.dim);
  ctx.restore();
}
function polyline(ctx,upto){
  ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=upto;i++){const x=X(i),y=Y(BARS[i].c);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();ctx.restore();
}

// ── 훅
function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  txt(ctx,'지난주 나스닥 · 월 개장 ~ 금 마감',60,206,'700 48px PD','#d8d8d8','left','.04em');
  const p=easeOut(seg(t,.05*HS,.62*HS));
  shadow(ctx,true);
  txt(ctx,'결과는',56,362,'700 84px PD',C.muted);
  numT(ctx,pct(STATS.weekPct*p),44,552,'900 250px PD',C.up,'left','-.06em');
  shadow(ctx,false);
  const q=seg(t,.72*HS,1.02*HS);
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.translate(0,(1-easeOut(q))*30);
    shadow(ctx,true);
    txt(ctx,'한 주 등락률은 이게 전부입니다.',60,688,'700 58px PD',C.text);
    txt(ctx,'그 사이 최대 낙폭은?',60,790,'900 70px PD',C.hi);
    shadow(ctx,false);ctx.restore();}
  const opts=[['①','-0.5%'],['②','-1.2%'],['③','-2.2%']];
  opts.forEach((o,k)=>{
    const a=seg(t,(1.12+k*.22)*HS,(1.40+k*.22)*HS);if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=880+k*132;
    ctx.fillStyle='rgba(255,255,255,.09)';rr(ctx,56,y,700,108,16);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,56,y,700,108,16);ctx.stroke();
    txt(ctx,o[0],96,y+75,'900 60px PD',C.hi);
    numT(ctx,o[1],186,y+75,'900 60px PD',C.text);
    ctx.restore();
  });
  const h=seg(t,1.94*HS,2.24*HS);
  if(h>0){ctx.save();ctx.globalAlpha=h;
    txt(ctx,'5분봉 1,179개, 지금부터 되감습니다',60,1360,'900 52px PD',C.text);
    txt(ctx,'월요일 개장 → 금요일 마감',60,1434,'700 40px PD',C.muted);
    ctx.restore();}
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
  txt(ctx,'나스닥100 선물 · 5분봉 되감기',60,186,'700 46px PD',C.muted);
  shadow(ctx,true);
  numT(ctx,fmt(bar.c),56,330,'900 145px PD',C.text,'left','-.04em');
  shadow(ctx,false);
  numT(ctx,bar.kst,60,400,'700 44px PD','#d8d8d8');
  txt(ctx,'고점 대비',1024,300,'700 36px PD',C.muted,'right');
  numT(ctx,dd.toFixed(2)+'%',1024,372,'900 76px PD',dd<-0.05?C.down:C.muted,'right');
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,i,'lines');polyline(ctx,i);eventLines(ctx,i,'labels');
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
    txt(ctx,show.l1,60,cur?600:594,`900 ${ts}px PD`,C.text);
    if(show.l2)txt(ctx,show.l2,60,cur?680:656,`900 ${ts}px PD`,show.col);
    shadow(ctx,false);
    ctx.restore();
  }
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
  txt(ctx,'③',56,330,'900 62px PD',C.hi);
  numT(ctx,'-2.18%',150,330,'900 190px PD',C.down,'left','-.05em');
  shadow(ctx,false);ctx.restore();
  const q=seg(at,.6,.95);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    numT(ctx,'고점 29,571 → 저점 28,927',60,436,'700 54px PD',C.text);
    txt(ctx,'화요일 오후 → 수요일 저녁, 하루 반 만에',60,512,'700 44px PD',C.muted);
    ctx.restore();}
  chartPanel(ctx);dayShade(ctx);
  const s=seg(at,.9,1.6);
  if(s>0){
    const a=STATS.peakIdx,b=STATS.troughIdx;
    ctx.save();ctx.globalAlpha=s*.34;ctx.fillStyle=C.down;
    ctx.fillRect(X(a),CY,(X(b)-X(a))*easeOut(s),CH);ctx.restore();
    ctx.save();ctx.globalAlpha=s;ctx.strokeStyle=C.down;ctx.lineWidth=4;ctx.setLineDash([12,8]);
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[a].h));ctx.lineTo(X(b),Y(BARS[a].h));ctx.stroke();
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[b].l));ctx.lineTo(X(b),Y(BARS[b].l));ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
  }
  eventLines(ctx,BARS.length-1,'lines');polyline(ctx,BARS.length-1);eventLines(ctx,BARS.length-1,'labels');dayAxis(ctx);
  brand(ctx);
}

// ── 요약 + 루프
function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  const out=seg(t,SUMM[1]-1.2,SUMM[1]-0.15);
  ctx.save();ctx.globalAlpha=1-out;
  txt(ctx,'이번 주 바닥도, 꼭대기도',60,206,'900 52px PD',C.text);
  txt(ctx,'한국 저녁에 나왔다.',60,278,'900 52px PD',C.hi);
  const rows=[['주간 최저 · 수 저녁 8시','28,927',C.down],
              ['주간 최고 · 금 저녁 7시 45분','29,704',C.up],
              ['결국 한 주 결과','+0.36%',C.up]];
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.15+k*.22,.5+k*.22));if(a<=0)return;
    ctx.save();ctx.globalAlpha=(1-out)*a;ctx.translate(0,(1-a)*20);
    const y=390+k*118;
    txt(ctx,r[0],56,y+52,'700 46px PD',C.text);
    numT(ctx,r[1],1024,y+56,'900 56px PD',r[2],'right');
    ctx.strokeStyle='#262626';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(56,y+82);ctx.lineTo(1024,y+82);ctx.stroke();
    ctx.restore();
  });
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,BARS.length-1,'lines');polyline(ctx,BARS.length-1);eventLines(ctx,BARS.length-1,'labels');dayAxis(ctx);
  const c=easeOut(seg(st,1.1,1.6));
  if(c>0){ctx.save();ctx.globalAlpha=(1-out)*c;
    txt(ctx,'몇 번 고르셨나요?',60,1512,'400 88px PEN',C.hi);
    txt(ctx,'다음 주도 되감아 드립니다',60,1594,'700 44px PD','#d8d8d8');
    ctx.restore();}
  ctx.restore();
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.drawImage(BGC,0,0);
      txt(g,'지난주 나스닥 · 월 개장 ~ 금 마감',60,206,'700 48px PD','#d8d8d8','left','.04em');
      shadow(g,true);
      txt(g,'결과는',56,362,'700 84px PD',C.muted);
      numT(g,'+0.36%',44,552,'900 250px PD',C.up,'left','-.06em');
      txt(g,'과정은',56,700,'700 84px PD',C.muted);
      numT(g,'-2.18%',44,890,'900 250px PD',C.down,'left','-.06em');
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
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,W,6);
  ctx.fillStyle=C.hi;ctx.fillRect(0,0,W*clamp01(t/DUR),6);ctx.restore();
}
