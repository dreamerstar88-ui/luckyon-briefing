// ===== C안 「차트 전면」 =====
// 차트를 안전영역의 3분의 2까지 키우고, 현재가를 헤더에서 떼어 선 끝에 붙였다(직접 라벨링).
// 글은 한 번에 두 줄만 — 한국어 한 줄, 영어 한 줄. 축 눈금·격자는 최소로 남겼다.
CX=65;CW=875;CY=430;CH=610;
const SAFE_R=940;

function brand(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;ctx.font='700 30px PD';ctx.textAlign='left';
  ctx.fillStyle=C.hi;ctx.fillText('luckyon',65,1358);
  const w=ctx.measureText('luckyon').width;
  ctx.fillStyle='#d8d8d8';ctx.fillText(' 넘버뷰 · 이번 주 나스닥',65+w,1358);
  txt(ctx,'나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다',65,1404,'500 26px PD',C.dim);
  ctx.restore();
}
function chartPanel(ctx){}
function dayShade(ctx){
  ctx.save();
  for(const d of DAYS){
    const a=BARS.findIndex(x=>x.d===d+' 09:30');let b=BARS.findIndex(x=>x.d===d+' 16:00');
    if(b<0)b=BARS.length-1;if(a<0)continue;
    ctx.fillStyle='rgba(255,255,255,.05)';rr(ctx,X(a),CY,X(b)-X(a),CH,8);ctx.fill();
  }
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;
  for(let k=1;k<DAYS.length;k++){
    let i=BARS.findIndex(x=>x.d.startsWith(DAYS[k]));
    if(i>0){ctx.beginPath();ctx.moveTo(X(i),CY);ctx.lineTo(X(i),CY+CH);ctx.stroke();}
  }
  ctx.restore();
}
function eventLines(ctx,upto,mode){
  ctx.save();
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k]; if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=.42;ctx.strokeStyle=ev.col;ctx.lineWidth=2;ctx.setLineDash([6,9]);
      ctx.beginPath();ctx.moveTo(x,CY+6);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;}
    const y=Y(BARS[ev.i].c);
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(8,11,18,.92)';ctx.beginPath();ctx.arc(x,y,23,0,7);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,23,0,7);ctx.stroke();
    ctx.save();ctx.font='900 28px PD';ctx.fillStyle=ev.col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),x,y+1);ctx.restore();}
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>numT(ctx,d.slice(5).replace('-','/')+' '+dowOf(d),CX+wSeg*(i+.5),CY+CH+52,'700 30px PD',C.muted,'center'));
  ctx.restore();
}
function polyline(ctx,upto){
  ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=6;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=upto;i++){const x=X(i),y=Y(BARS[i].c);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.stroke();ctx.restore();
}
function fitText(ctx,line,maxw,start,min,weight){
  let px=start;ctx.font=`${weight} ${px}px PD`;
  while(px>min&&ctx.measureText(line).width>maxw){px--;ctx.font=`${weight} ${px}px PD`;}
  let out=line;
  if(ctx.measureText(out).width>maxw){
    while(out.length>4&&ctx.measureText(out+'…').width>maxw)out=out.slice(0,-1);out+='…';}
  return [out,px];
}
function enBand(ctx,line,a=1,y=1246,rule=false){
  if(!line)return;
  ctx.save();ctx.globalAlpha=a*.9;
  const [out,px]=fitText(ctx,line,835,32,22,'500');
  txt(ctx,out,101,y,`500 ${px}px PD`,'#9aa6b8');
  ctx.restore();
}
// 선 끝을 따라다니는 현재가 — 헤더에서 숫자를 떼어 차트 안으로 넣었다
function liveTag(ctx,i){
  const bar=BARS[i],x=X(i),y=Y(bar.c);
  ctx.save();
  ctx.fillStyle=C.line;ctx.beginPath();ctx.arc(x,y,11,0,7);ctx.fill();
  ctx.globalAlpha=.4;ctx.strokeStyle=C.line;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,24,0,7);ctx.stroke();
  ctx.globalAlpha=1;
  ctx.font='900 62px PD';
  const s=fmt(bar.c), w=ctx.measureText(s).width+36;
  let bx=x+34, by=y-46;
  if(bx+w>SAFE_R)bx=x-34-w;
  if(by<CY+6)by=CY+6; if(by+92>CY+CH)by=CY+CH-92;
  ctx.fillStyle='rgba(8,11,18,.82)';rr(ctx,bx,by,w,92,12);ctx.fill();
  ctx.strokeStyle='rgba(78,168,255,.55)';ctx.lineWidth=2;rr(ctx,bx,by,w,92,12);ctx.stroke();
  numT(ctx,s,bx+18,by+68,'900 62px PD',C.text,'left','-.03em');
  ctx.restore();
}
// 사건 문구: 왼쪽 색 막대 + 한국어 한 줄 + 영어 한 줄
function eventStrip(ctx,show,idx,alpha){
  ctx.save();ctx.globalAlpha=alpha;
  ctx.fillStyle=show.col;rr(ctx,65,1148,7,116,4);ctx.fill();
  ctx.save();ctx.font='700 28px PD';
  const lab=`${idx+1}  ${show.when}`;
  txt(ctx,lab,101,1178,'700 28px PD',show.col);
  ctx.restore();
  const line=show.l2?`${show.l1} ${show.l2}`:show.l1;
  const [t1,p1]=fitText(ctx,line,835,46,30,'900');
  txt(ctx,t1,101,1230,`900 ${p1}px PD`,C.text);
  ctx.restore();
  enBand(ctx,show.en,alpha,1284);
}

function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  txt(ctx,COPY.kicker,65,322,'700 42px PD','#d8d8d8','left','.04em');
  const p=easeOut(seg(t,hs(.10),hs(1.00)));
  txt(ctx,'결과는',65,428,'700 66px PD',C.muted);
  numT(ctx,pct(STATS.weekPct*p),54,584,'900 200px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
  const q=seg(t,hs(1.05),hs(1.50));
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.translate(0,(1-easeOut(q))*30);
    txt(ctx,'한 주 등락률은 이게 전부입니다.',65,680,'700 48px PD',C.text);
    txt(ctx,'그 사이 최대 낙폭은?',65,762,'900 62px PD',C.hi);
    ctx.restore();}
  const NUM='①②③';
  QUIZ.opts.forEach((v,k)=>{
    const a=seg(t,hs(1.60+k*.35),hs(2.00+k*.35));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=822+k*112;
    ctx.fillStyle='rgba(255,255,255,.08)';rr(ctx,65,y,640,92,14);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;rr(ctx,65,y,640,92,14);ctx.stroke();
    txt(ctx,NUM[k],101,y+64,'900 52px PD',C.hi);
    numT(ctx,v,182,y+64,'900 52px PD',C.text);
    ctx.restore();});
  const h=seg(t,hs(2.75),hs(3.05));
  if(h>0){ctx.save();ctx.globalAlpha=h;
    txt(ctx,`5분봉 ${STATS.n.toLocaleString('en-US')}개, 지금부터 다시 돌려봅니다`,65,1222,'900 46px PD',C.text);
    const [o,px]=fitText(ctx,COPY.enHook,875,30,22,'500');
    txt(ctx,o,65,1280,`500 ${px}px PD`,'#9aa6b8');
    ctx.restore();}
  brand(ctx);
}

function drawReplay(ctx,t){
  ctx.drawImage(BGC,0,0);
  const rt=t-REPLAY[0];
  const {i,seg:sg}=progressAt(rt);
  const bar=BARS[i];
  let peak=-1e9;for(let k=0;k<=i;k++)peak=Math.max(peak,BARS[k].h);
  const dd=(bar.c/peak-1)*100;
  txt(ctx,'나스닥100 선물 · 5분봉 다시 돌려보기',65,318,'700 40px PD',C.muted);
  numT(ctx,bar.kst,65,380,'900 52px PD',C.text);
  txt(ctx,'고점 대비',SAFE_R,318,'700 30px PD',C.muted,'right');
  numT(ctx,dd.toFixed(2)+'%',SAFE_R,384,'900 58px PD',dd<-0.05?C.down:C.muted,'right');
  dayShade(ctx);eventLines(ctx,i,'lines');polyline(ctx,i);eventLines(ctx,i,'labels');
  liveTag(ctx,i);dayAxis(ctx);
  const cur=EVENTS.find(e=>sg.hold&&e.i===sg.i1);
  const past=EVENTS.filter(e=>e.i<=i);
  const show=cur||past[past.length-1];
  if(show){
    const a=cur?easeOut(seg(rt,sg.t0,sg.t0+.3)):1;
    eventStrip(ctx,show,EVENTS.indexOf(show),cur?a:.5);
  }else enBand(ctx,`Replaying ${STATS.n.toLocaleString('en-US')} five-minute bars`,.6,1230);
  brand(ctx);
}

function drawAnswer(ctx,t){
  ctx.drawImage(BGC,0,0);
  const at=t-ANSWER[0];
  txt(ctx,'정답',65,318,'700 40px PD',C.muted);
  const p=easeOut(seg(at,.05,.5));
  ctx.save();ctx.globalAlpha=p;
  txt(ctx,'①②③'[QUIZ.ans],62,396,'900 50px PD',C.hi);
  numT(ctx,pct(STATS.mdd),138,396,'900 140px PD',C.down,'left','-.05em');
  ctx.restore();
  dayShade(ctx);
  const s=seg(at,.9,1.6);
  if(s>0){
    const a=STATS.peakIdx,b=STATS.troughIdx;
    ctx.save();ctx.globalAlpha=s*.30;ctx.fillStyle=C.down;
    ctx.fillRect(X(a),CY,(X(b)-X(a))*easeOut(s),CH);ctx.restore();
    ctx.save();ctx.globalAlpha=s;ctx.strokeStyle=C.down;ctx.lineWidth=4;ctx.setLineDash([12,8]);
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[a].h));ctx.lineTo(X(b),Y(BARS[a].h));ctx.stroke();
    ctx.beginPath();ctx.moveTo(X(a),Y(BARS[b].l));ctx.lineTo(X(b),Y(BARS[b].l));ctx.stroke();
    ctx.setLineDash([]);ctx.restore();}
  eventLines(ctx,BARS.length-1,'lines');polyline(ctx,BARS.length-1);eventLines(ctx,BARS.length-1,'labels');dayAxis(ctx);
  const q=seg(at,.6,.95);
  if(q>0){
    const mins=(STATS.troughIdx-STATS.peakIdx)*5;
    const span=mins<60?`${mins}분`:(mins<1440?`${(mins/60).toFixed(1)}시간`:`${(mins/1440).toFixed(1)}일`);
    ctx.save();ctx.globalAlpha=q;
    ctx.fillStyle=C.down;rr(ctx,65,1148,7,116,4);ctx.fill();
    txt(ctx,`${BARS[STATS.peakIdx].kst.slice(0,-6)} → ${BARS[STATS.troughIdx].kst.slice(0,-6)} · ${span}`,101,1180,'700 30px PD',C.down);
    const [t1,p1]=fitText(ctx,`고점 ${fmt(BARS[STATS.peakIdx].h)} → 저점 ${fmt(BARS[STATS.troughIdx].l)}`,835,46,30,'900');
    txt(ctx,t1,101,1232,`900 ${p1}px PD`,C.text);
    ctx.restore();
    enBand(ctx,`Peak ${fmt(BARS[STATS.peakIdx].h)} to trough ${fmt(BARS[STATS.troughIdx].l)} — a ${Math.abs(STATS.mdd).toFixed(2)}% drawdown`,q,1286);}
  brand(ctx);
}

function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  const fadeOut=seg(t,SUMM[1]-1.2,SUMM[1]-0.7);
  const out=seg(t,SUMM[1]-0.7,SUMM[1]-0.1);
  ctx.save();ctx.globalAlpha=1-fadeOut;
  txt(ctx,COPY.summ1,65,318,'900 44px PD',C.text);
  txt(ctx,COPY.summ2,65,378,'900 44px PD',C.hi);
  dayShade(ctx);eventLines(ctx,BARS.length-1,'lines');polyline(ctx,BARS.length-1);eventLines(ctx,BARS.length-1,'labels');dayAxis(ctx);
  let lo=1e9,li=0,hi2=-1e9,hi_i=0;
  BARS.forEach((b,i)=>{if(b.l<lo){lo=b.l;li=i;}if(b.h>hi2){hi2=b.h;hi_i=i;}});
  const rows=[[`주간 최저 · ${BARS[li].kst.slice(0,-6)}`,fmt(lo),C.down],
              [`주간 최고 · ${BARS[hi_i].kst.slice(0,-6)}`,fmt(hi2),C.up],
              ['결국 한 주 결과',pct(STATS.weekPct),STATS.weekPct>=0?C.up:C.down]];
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.15+k*.22,.5+k*.22));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;
    const y=1100+k*52;
    txt(ctx,r[0],65,y+30,'700 34px PD',C.text);
    numT(ctx,r[1],SAFE_R,y+32,'900 40px PD',r[2],'right');
    ctx.restore();});
  ctx.restore();
  const c=easeOut(seg(st,1.1,1.6));
  if(c>0){ctx.save();ctx.globalAlpha=(1-fadeOut)*c;
    txt(ctx,'몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다',65,1294,'700 34px PD','#d8d8d8');
    ctx.restore();}
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.drawImage(BGC,0,0);
      txt(g,COPY.kicker,65,322,'700 42px PD','#d8d8d8','left','.04em');
      txt(g,'결과는',65,428,'700 66px PD',C.muted);
      numT(g,pct(STATS.weekPct),54,584,'900 200px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
      txt(g,'과정은',65,718,'700 66px PD',C.muted);
      numT(g,pct(STATS.mdd),54,874,'900 200px PD',C.down,'left','-.06em');
      txt(g,'한 주 등락률 뒤에 숨은 낙폭',65,986,'700 48px PD',C.text);
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
