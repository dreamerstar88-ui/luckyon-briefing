// ===== A안 「안전지대」 =====
// 지금 구조를 그대로 두되 모든 요소를 플랫폼 UI가 가리지 않는 x65~940 · y280~1250 안으로 옮겼다.
// 바꾼 것: 오른쪽 여백 확보(차트 끝 1040→940), 영어 줄을 바닥에서 한국어 바로 밑으로,
//          브랜드 줄을 1668→1330, 차트는 그만큼 낮아진 천장에 맞춰 축소.
CX=65;CW=875;CY=850;CH=330;
const SAFE_R=940;

function brand(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;ctx.font='700 30px PD';ctx.textAlign='left';
  ctx.fillStyle=C.hi;ctx.fillText('luckyon',65,1352);
  const w=ctx.measureText('luckyon').width;
  ctx.fillStyle='#d8d8d8';ctx.fillText(' 넘버뷰 · 이번 주 나스닥',65+w,1352);
  txt(ctx,'나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다',65,1398,'500 26px PD',C.dim);
  ctx.restore();
}
function chartPanel(ctx){ctx.save();ctx.fillStyle=C.panel;rr(ctx,CX-22,CY-40,CW+44,CH+80,20);ctx.fill();ctx.restore();}
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
function eventLines(ctx,upto,mode){
  ctx.save();
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k]; if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=.55;ctx.strokeStyle=ev.col;ctx.lineWidth=2.5;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.moveTo(x,CY);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;
    }
    ctx.globalAlpha=1;ctx.fillStyle=ev.col;
    ctx.beginPath();ctx.arc(x,CY-18,16,0,7);ctx.fill();
    ctx.save();ctx.font='900 21px PD';ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),x,CY-17);ctx.restore();
    const LH=27,PADX=11,PADY=9,BW=PADX*2+22;
    const h=vtextH(ev.tag,LH);
    const right=x+14,left=x-14-BW;
    const bx=(right+BW<CX+CW-20)?right:left;
    const by=CY+10;
    ctx.globalAlpha=1;ctx.fillStyle='rgba(0,0,0,.86)';
    rr(ctx,bx,by,BW,h+PADY*2,8);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.globalAlpha=.45;ctx.lineWidth=2;rr(ctx,bx,by,BW,h+PADY*2,8);ctx.stroke();
    ctx.globalAlpha=1;
    vtext(ctx,ev.tag,bx+PADX+11,by+PADY+LH/2,'700 22px PD',ev.col,LH);
  }
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>numT(ctx,d.slice(5).replace('-','/')+' '+dowOf(d),CX+wSeg*(i+.5),CY+CH+52,'700 30px PD',C.muted,'center'));
  txt(ctx,'밝은 구간 = 미국 정규장(한국시간 밤 10:30~새벽 5:00)',65,CY+CH+104,'500 26px PD',C.dim);
  ctx.restore();
}
function polyline(ctx,upto){
  ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=upto;i++){const x=X(i),y=Y(BARS[i].c);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();ctx.restore();
}
// 영어 줄은 바닥 밴드를 버리고 한국어 문구 바로 밑으로 올렸다.
const BAND_MAXW=875;
function enBand(ctx,line,a=1,y=804,rule=true){
  if(!line)return;
  ctx.save();ctx.globalAlpha=a;
  if(rule){ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(65,y-42);ctx.lineTo(SAFE_R,y-42);ctx.stroke();}
  let px=32;ctx.font=`500 ${px}px PD`;
  while(px>24&&ctx.measureText(line).width>BAND_MAXW){px--;ctx.font=`500 ${px}px PD`;}
  let out=line;
  if(ctx.measureText(out).width>BAND_MAXW){
    while(out.length>4&&ctx.measureText(out+'…').width>BAND_MAXW)out=out.slice(0,-1);
    out+='…';}
  txt(ctx,out,65,y,`500 ${px}px PD`,'#b9c2d0');
  ctx.restore();
}

function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  txt(ctx,COPY.kicker,65,320,'700 44px PD','#d8d8d8','left','.04em');
  const p=easeOut(seg(t,hs(.10),hs(1.00)));
  shadow(ctx,true);
  txt(ctx,'결과는',65,438,'700 74px PD',C.muted);
  numT(ctx,pct(STATS.weekPct*p),54,600,'900 210px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
  shadow(ctx,false);
  const q=seg(t,hs(1.05),hs(1.50));
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.translate(0,(1-easeOut(q))*30);
    shadow(ctx,true);
    txt(ctx,'한 주 등락률은 이게 전부입니다.',65,700,'700 50px PD',C.text);
    txt(ctx,'그 사이 최대 낙폭은?',65,784,'900 62px PD',C.hi);
    shadow(ctx,false);ctx.restore();}
  const NUM='①②③';
  QUIZ.opts.forEach((v,k)=>{
    const a=seg(t,hs(1.60+k*.35),hs(2.00+k*.35));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=830+k*106;
    ctx.fillStyle='rgba(255,255,255,.09)';rr(ctx,65,y,620,92,14);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,65,y,620,92,14);ctx.stroke();
    txt(ctx,NUM[k],101,y+64,'900 52px PD',C.hi);
    numT(ctx,v,182,y+64,'900 52px PD',C.text);
    ctx.restore();});
  const h=seg(t,hs(2.75),hs(3.05));
  if(h>0){ctx.save();ctx.globalAlpha=h;
    txt(ctx,`5분봉 ${STATS.n.toLocaleString('en-US')}개, 지금부터 다시 돌려봅니다`,65,1230,'900 46px PD',C.text);
    txt(ctx,COPY.span,65,1288,'700 36px PD',C.muted);
    ctx.restore();}
  enBand(ctx,COPY.enHook,h,1176,true);
  brand(ctx);
}

function drawReplay(ctx,t){
  ctx.drawImage(BGC,0,0);
  const rt=t-REPLAY[0];
  const {i,seg:sg}=progressAt(rt);
  const bar=BARS[i];
  let peak=-1e9;for(let k=0;k<=i;k++)peak=Math.max(peak,BARS[k].h);
  const dd=(bar.c/peak-1)*100;
  txt(ctx,'나스닥100 선물 · 5분봉 다시 돌려보기',65,320,'700 42px PD',C.muted);
  shadow(ctx,true);
  numT(ctx,fmt(bar.c),62,446,'900 132px PD',C.text,'left','-.04em');
  shadow(ctx,false);
  numT(ctx,bar.kst,65,506,'700 40px PD','#d8d8d8');
  txt(ctx,'고점 대비',SAFE_R,416,'700 32px PD',C.muted,'right');
  numT(ctx,dd.toFixed(2)+'%',SAFE_R,486,'900 68px PD',dd<-0.05?C.down:C.muted,'right');
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,i,'lines');eventLines(ctx,i,'labels');polyline(ctx,i);
  const px=X(i),py=Y(bar.c);
  ctx.save();ctx.fillStyle=C.line;ctx.beginPath();ctx.arc(px,py,10,0,7);ctx.fill();
  ctx.strokeStyle=C.line;ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,22,0,7);ctx.stroke();ctx.restore();
  dayAxis(ctx);
  const cur=EVENTS.find(e=>sg.hold&&e.i===sg.i1);
  const past=EVENTS.filter(e=>e.i<=i);
  const show=cur||past[past.length-1];
  if(show){
    const a=cur?easeOut(seg(rt,sg.t0,sg.t0+.3)):1;
    const dim=cur?1:.42;
    ctx.save();ctx.globalAlpha=a*dim;
    if(cur){ctx.strokeStyle=cur.col;ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(px,py,30,0,7);ctx.stroke();
      ctx.fillStyle=cur.col;ctx.beginPath();ctx.arc(px,py,14,0,7);ctx.fill();}
    const fs=cur?38:30, ts=cur?50:38;
    ctx.save();ctx.translate(65,cur?566:578);ctx.rotate(-1.5*Math.PI/180);
    ctx.font=`900 ${fs}px PD`;
    const num=String(EVENTS.indexOf(show)+1)+'  ';
    const pw=ctx.measureText(num+show.when).width+46;
    ctx.fillStyle=show.col;rr(ctx,0,0,pw,fs+22,6);ctx.fill();
    ctx.fillStyle=show.col===C.hi?'#111':'#fff';ctx.fillText(num+show.when,24,fs+5);ctx.restore();
    shadow(ctx,!!cur);
    txt(ctx,show.l1,65,cur?682:676,`900 ${ts}px PD`,show.col);
    if(show.l2)txt(ctx,show.l2,65,cur?750:734,`900 ${ts}px PD`,C.muted);
    shadow(ctx,false);
    ctx.restore();}
  enBand(ctx,show?show.en:`Replaying ${STATS.n.toLocaleString('en-US')} five-minute bars`);
  brand(ctx);
}

function drawAnswer(ctx,t){
  ctx.drawImage(BGC,0,0);
  const at=t-ANSWER[0];
  txt(ctx,'정답',65,320,'700 42px PD',C.muted);
  const p=easeOut(seg(at,.05,.5));
  ctx.save();ctx.globalAlpha=p;ctx.translate(0,(1-p)*26);
  shadow(ctx,true);
  txt(ctx,'①②③'[QUIZ.ans],62,452,'900 56px PD',C.hi);
  numT(ctx,pct(STATS.mdd),146,452,'900 168px PD',C.down,'left','-.05em');
  shadow(ctx,false);ctx.restore();
  const q=seg(at,.6,.95);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    numT(ctx,`고점 ${fmt(BARS[STATS.peakIdx].h)} → 저점 ${fmt(BARS[STATS.troughIdx].l)}`,65,548,'700 48px PD',C.text);
    const mins=(STATS.troughIdx-STATS.peakIdx)*5;
    const span=mins<60?`${mins}분`:(mins<1440?`${(mins/60).toFixed(1)}시간`:`${(mins/1440).toFixed(1)}일`);
    txt(ctx,`${BARS[STATS.peakIdx].kst.slice(0,-6)} → ${BARS[STATS.troughIdx].kst.slice(0,-6)}, ${span} 만에`,65,616,'700 38px PD',C.muted);
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
    ctx.setLineDash([]);ctx.restore();}
  eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  enBand(ctx,`Peak ${fmt(BARS[STATS.peakIdx].h)} to trough ${fmt(BARS[STATS.troughIdx].l)} — a ${Math.abs(STATS.mdd).toFixed(2)}% drawdown`,q,690,true);
  brand(ctx);
}

function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  const fadeOut=seg(t,SUMM[1]-1.2,SUMM[1]-0.7);
  const out=seg(t,SUMM[1]-0.7,SUMM[1]-0.1);
  ctx.save();ctx.globalAlpha=1-fadeOut;
  txt(ctx,COPY.summ1,65,320,'900 48px PD',C.text);
  txt(ctx,COPY.summ2,65,386,'900 48px PD',C.hi);
  enBand(ctx,COPY.enSumm,1,442,false);
  let lo=1e9,li=0,hi2=-1e9,hi_i=0;
  BARS.forEach((b,i)=>{if(b.l<lo){lo=b.l;li=i;}if(b.h>hi2){hi2=b.h;hi_i=i;}});
  const rows=[[`주간 최저 · ${BARS[li].kst.slice(0,-6)}`,fmt(lo),C.down],
              [`주간 최고 · ${BARS[hi_i].kst.slice(0,-6)}`,fmt(hi2),C.up],
              ['결국 한 주 결과',pct(STATS.weekPct),STATS.weekPct>=0?C.up:C.down]];
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.15+k*.22,.5+k*.22));if(a<=0)return;
    ctx.save();ctx.globalAlpha=(1-fadeOut)*a;ctx.translate(0,(1-a)*20);
    const y=482+k*104;
    txt(ctx,r[0],65,y+46,'700 42px PD',C.text);
    numT(ctx,r[1],SAFE_R,y+50,'900 50px PD',r[2],'right');
    ctx.strokeStyle='#262626';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(65,y+72);ctx.lineTo(SAFE_R,y+72);ctx.stroke();
    ctx.restore();});
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,BARS.length-1,'lines');eventLines(ctx,BARS.length-1,'labels');polyline(ctx,BARS.length-1);dayAxis(ctx);
  const c=easeOut(seg(st,1.1,1.6));
  if(c>0){ctx.save();ctx.globalAlpha=(1-fadeOut)*c;
    txt(ctx,'몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다',65,1300,'700 38px PD','#d8d8d8');
    ctx.restore();}
  ctx.restore();
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.drawImage(BGC,0,0);
      txt(g,COPY.kicker,65,320,'700 44px PD','#d8d8d8','left','.04em');
      shadow(g,true);
      txt(g,'결과는',65,438,'700 74px PD',C.muted);
      numT(g,pct(STATS.weekPct),54,600,'900 210px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
      txt(g,'과정은',65,734,'700 74px PD',C.muted);
      numT(g,pct(STATS.mdd),54,900,'900 210px PD',C.down,'left','-.06em');
      shadow(g,false);
      txt(g,'한 주 등락률 뒤에 숨은 낙폭',65,1012,'700 50px PD',C.text);
      window.__loopC=lc;}
    ctx.save();ctx.globalAlpha=out;ctx.drawImage(window.__loopC,0,0);ctx.restore();}
  brand(ctx);
}

function draw(t){
  const ctx=document.getElementById('c').getContext('2d');
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(t<REPLAY[0])drawHook(ctx,t);
  else if(t<ANSWER[0])drawReplay(ctx,t);
  else if(t<SUMM[0])drawAnswer(ctx,t);
  else drawSumm(ctx,t);
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#2a2a2a';ctx.fillRect(0,276,W,5);
  ctx.fillStyle=C.hi;ctx.fillRect(0,276,W*clamp01(t/DUR),5);ctx.restore();
}
