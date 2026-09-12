// ===== B안 「카드」 =====
// 차트 위 세로 라벨을 없애고(선을 가리던 원인), 사건 정보를 화면 아래 카드 하나로 모았다.
// 그림자 대신 얇은 테두리를 쓴다. 숫자 헤더는 한 줄로 눌러 차트에 자리를 내준다.
CX=65;CW=875;CY=536;CH=400;
const SAFE_R=940, CARD=[65,1040,875,216];

function hair(ctx,x,y,w,h,r,col='rgba(255,255,255,.16)',fill='rgba(10,14,22,.62)'){
  ctx.save();ctx.fillStyle=fill;rr(ctx,x,y,w,h,r);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=2;rr(ctx,x,y,w,h,r);ctx.stroke();ctx.restore();
}
function brand(ctx,a=1){
  ctx.save();ctx.globalAlpha=a;ctx.font='700 30px PD';ctx.textAlign='left';
  ctx.fillStyle=C.hi;ctx.fillText('luckyon',65,1372);
  const w=ctx.measureText('luckyon').width;
  ctx.fillStyle='#d8d8d8';ctx.fillText(' 넘버뷰 · 이번 주 나스닥',65+w,1372);
  txt(ctx,'나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다',65,1418,'500 26px PD',C.dim);
  ctx.restore();
}
function chartPanel(ctx){hair(ctx,CX-20,CY-34,CW+40,CH+106,18,'rgba(255,255,255,.10)','rgba(8,11,18,.55)');}
function dayShade(ctx){
  ctx.save();
  for(const d of DAYS){
    const a=BARS.findIndex(x=>x.d===d+' 09:30');let b=BARS.findIndex(x=>x.d===d+' 16:00');
    if(b<0)b=BARS.length-1;if(a<0)continue;
    ctx.fillStyle='rgba(255,255,255,.045)';rr(ctx,X(a),CY,X(b)-X(a),CH,6);ctx.fill();
  }
  ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=2;
  for(let k=1;k<DAYS.length;k++){
    let i=BARS.findIndex(x=>x.d.startsWith(DAYS[k]));
    if(i>0){ctx.beginPath();ctx.moveTo(X(i),CY);ctx.lineTo(X(i),CY+CH);ctx.stroke();}
  }
  ctx.restore();
}
// 세로 글씨 라벨을 없애고 선 위 번호 핀만 남긴다 — 직접 라벨링
function eventLines(ctx,upto,mode){
  ctx.save();
  for(let k=0;k<EVENTS.length;k++){
    const ev=EVENTS[k]; if(ev.i>upto)continue;
    const x=X(ev.i);
    if(mode==='lines'){
      ctx.globalAlpha=.40;ctx.strokeStyle=ev.col;ctx.lineWidth=2;ctx.setLineDash([6,8]);
      ctx.beginPath();ctx.moveTo(x,CY+8);ctx.lineTo(x,CY+CH);ctx.stroke();ctx.setLineDash([]);
      continue;
    }
    const y=Y(BARS[ev.i].c);
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(8,11,18,.9)';ctx.beginPath();ctx.arc(x,y,21,0,7);ctx.fill();
    ctx.strokeStyle=ev.col;ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(x,y,21,0,7);ctx.stroke();
    ctx.save();ctx.font='900 26px PD';ctx.fillStyle=ev.col;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(k+1),x,y+1);ctx.restore();
  }
  ctx.restore();
}
function dayAxis(ctx){
  ctx.save();
  const wSeg=CW/DAYS.length;
  DAYS.forEach((d,i)=>numT(ctx,d.slice(5).replace('-','/')+' '+dowOf(d),CX+wSeg*(i+.5),CY+CH+50,'700 30px PD',C.muted,'center'));
  txt(ctx,'밝은 구간 = 미국 정규장',CX,CY+CH+96,'500 24px PD',C.dim);
  ctx.restore();
}
function polyline(ctx,upto){
  ctx.save();ctx.strokeStyle=C.line;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
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
function enBand(ctx,line,a=1,y=1240,rule=false){
  if(!line)return;
  ctx.save();ctx.globalAlpha=a*.92;
  const [out,px]=fitText(ctx,line,CARD[2]-56,30,22,'500');
  txt(ctx,out,CARD[0]+28,y,`500 ${px}px PD`,'#9aa6b8');
  ctx.restore();
}
// 사건 카드: 시간칩 + 한국어 2줄 + 영어 1줄을 한 상자에 묶는다
function eventCard(ctx,show,idx,alpha=1,cur=false){
  const [x,y,w,h]=CARD;
  ctx.save();ctx.globalAlpha=alpha;
  hair(ctx,x,y,w,h,16,cur?show.col:'rgba(255,255,255,.14)','rgba(8,11,18,.72)');
  ctx.save();ctx.font='900 30px PD';
  const lab=`${idx+1}  ${show.when}`;
  const pw=ctx.measureText(lab).width+40;
  ctx.fillStyle=show.col;rr(ctx,x+28,y+20,pw,46,8);ctx.fill();
  ctx.fillStyle=show.col===C.hi?'#111':'#fff';ctx.textBaseline='alphabetic';ctx.fillText(lab,x+48,y+53);
  ctx.restore();
  const [t1,p1]=fitText(ctx,show.l1,w-56,44,32,'900');
  txt(ctx,t1,x+28,y+112,`900 ${p1}px PD`,show.col);
  if(show.l2){const [t2,p2]=fitText(ctx,show.l2,w-56,40,28,'700');
    txt(ctx,t2,x+28,y+160,`700 ${p2}px PD`,C.muted);}
  ctx.restore();
}

function drawHook(ctx,t){
  ctx.drawImage(BGC,0,0);
  txt(ctx,COPY.kicker,65,322,'700 42px PD','#d8d8d8','left','.04em');
  const p=easeOut(seg(t,hs(.10),hs(1.00)));
  txt(ctx,'결과는',65,432,'700 68px PD',C.muted);
  numT(ctx,pct(STATS.weekPct*p),54,586,'900 196px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
  const q=seg(t,hs(1.05),hs(1.50));
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.translate(0,(1-easeOut(q))*30);
    txt(ctx,'한 주 등락률은 이게 전부입니다.',65,684,'700 48px PD',C.text);
    txt(ctx,'그 사이 최대 낙폭은?',65,766,'900 60px PD',C.hi);
    ctx.restore();}
  const NUM='①②③';
  QUIZ.opts.forEach((v,k)=>{
    const a=seg(t,hs(1.60+k*.35),hs(2.00+k*.35));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;ctx.translate(0,(1-easeOut(a))*26);
    const y=826+k*110;
    hair(ctx,65,y,640,90,14);
    txt(ctx,NUM[k],101,y+62,'900 50px PD',C.hi);
    numT(ctx,v,182,y+62,'900 50px PD',C.text);
    ctx.restore();});
  const h=seg(t,hs(2.75),hs(3.05));
  if(h>0){ctx.save();ctx.globalAlpha=h;
    txt(ctx,`5분봉 ${STATS.n.toLocaleString('en-US')}개, 지금부터 다시 돌려봅니다`,65,1186,'900 46px PD',C.text);
    txt(ctx,COPY.span,65,1234,'700 34px PD',C.muted);
    ctx.restore();}
  ctx.save();ctx.globalAlpha=h;
  const [o,px]=fitText(ctx,COPY.enHook,875,30,22,'500');
  txt(ctx,o,65,1286,`500 ${px}px PD`,'#9aa6b8');ctx.restore();
  brand(ctx);
}

function drawReplay(ctx,t){
  ctx.drawImage(BGC,0,0);
  const rt=t-REPLAY[0];
  const {i,seg:sg}=progressAt(rt);
  const bar=BARS[i];
  let peak=-1e9;for(let k=0;k<=i;k++)peak=Math.max(peak,BARS[k].h);
  const dd=(bar.c/peak-1)*100;
  txt(ctx,'나스닥100 선물 · 5분봉 다시 돌려보기',65,322,'700 40px PD',C.muted);
  numT(ctx,fmt(bar.c),62,442,'900 122px PD',C.text,'left','-.04em');
  numT(ctx,bar.kst,65,498,'700 36px PD','#9aa6b8');
  txt(ctx,'고점 대비',SAFE_R,400,'700 30px PD',C.muted,'right');
  numT(ctx,dd.toFixed(2)+'%',SAFE_R,466,'900 64px PD',dd<-0.05?C.down:C.muted,'right');
  ctx.save();ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(65,522);ctx.lineTo(SAFE_R,522);ctx.stroke();ctx.restore();
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,i,'lines');polyline(ctx,i);eventLines(ctx,i,'labels');
  const px2=X(i),py=Y(bar.c);
  ctx.save();ctx.fillStyle=C.line;ctx.beginPath();ctx.arc(px2,py,10,0,7);ctx.fill();
  ctx.strokeStyle=C.line;ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.beginPath();ctx.arc(px2,py,22,0,7);ctx.stroke();ctx.restore();
  dayAxis(ctx);
  const cur=EVENTS.find(e=>sg.hold&&e.i===sg.i1);
  const past=EVENTS.filter(e=>e.i<=i);
  const show=cur||past[past.length-1];
  if(show){
    const a=cur?easeOut(seg(rt,sg.t0,sg.t0+.3)):1;
    eventCard(ctx,show,EVENTS.indexOf(show),cur?a:.55,!!cur);
    enBand(ctx,show.en,cur?a:.55);
  }else enBand(ctx,`Replaying ${STATS.n.toLocaleString('en-US')} five-minute bars`,.6);
  brand(ctx);
}

function drawAnswer(ctx,t){
  ctx.drawImage(BGC,0,0);
  const at=t-ANSWER[0];
  txt(ctx,'정답',65,322,'700 40px PD',C.muted);
  const p=easeOut(seg(at,.05,.5));
  ctx.save();ctx.globalAlpha=p;ctx.translate(0,(1-p)*26);
  txt(ctx,'①②③'[QUIZ.ans],62,452,'900 54px PD',C.hi);
  numT(ctx,pct(STATS.mdd),142,452,'900 156px PD',C.down,'left','-.05em');
  ctx.restore();
  const q=seg(at,.6,.95);
  if(q>0){ctx.save();ctx.globalAlpha=q;
    numT(ctx,`고점 ${fmt(BARS[STATS.peakIdx].h)} → 저점 ${fmt(BARS[STATS.troughIdx].l)}`,65,506,'700 42px PD',C.text);
    ctx.restore();}
  chartPanel(ctx);dayShade(ctx);
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
  if(q>0){
    const mins=(STATS.troughIdx-STATS.peakIdx)*5;
    const span=mins<60?`${mins}분`:(mins<1440?`${(mins/60).toFixed(1)}시간`:`${(mins/1440).toFixed(1)}일`);
    ctx.save();ctx.globalAlpha=q;
    hair(ctx,CARD[0],CARD[1],CARD[2],CARD[3],16,'rgba(255,77,77,.45)','rgba(8,11,18,.72)');
    txt(ctx,`${BARS[STATS.peakIdx].kst.slice(0,-6)} → ${BARS[STATS.troughIdx].kst.slice(0,-6)}`,CARD[0]+28,CARD[1]+62,'900 42px PD',C.text);
    txt(ctx,`${span} 만에 벌어진 일`,CARD[0]+28,CARD[1]+120,'700 38px PD',C.muted);
    ctx.restore();
    enBand(ctx,`Peak ${fmt(BARS[STATS.peakIdx].h)} to trough ${fmt(BARS[STATS.troughIdx].l)} — a ${Math.abs(STATS.mdd).toFixed(2)}% drawdown`,q);}
  brand(ctx);
}

function drawSumm(ctx,t){
  ctx.drawImage(BGC,0,0);
  const st=t-SUMM[0];
  const fadeOut=seg(t,SUMM[1]-1.2,SUMM[1]-0.7);
  const out=seg(t,SUMM[1]-0.7,SUMM[1]-0.1);
  ctx.save();ctx.globalAlpha=1-fadeOut;
  txt(ctx,COPY.summ1,65,322,'900 46px PD',C.text);
  txt(ctx,COPY.summ2,65,386,'900 46px PD',C.hi);
  let lo=1e9,li=0,hi2=-1e9,hi_i=0;
  BARS.forEach((b,i)=>{if(b.l<lo){lo=b.l;li=i;}if(b.h>hi2){hi2=b.h;hi_i=i;}});
  const rows=[[`주간 최저 · ${BARS[li].kst.slice(0,-6)}`,fmt(lo),C.down],
              [`주간 최고 · ${BARS[hi_i].kst.slice(0,-6)}`,fmt(hi2),C.up],
              ['결국 한 주 결과',pct(STATS.weekPct),STATS.weekPct>=0?C.up:C.down]];
  chartPanel(ctx);dayShade(ctx);eventLines(ctx,BARS.length-1,'lines');polyline(ctx,BARS.length-1);eventLines(ctx,BARS.length-1,'labels');dayAxis(ctx);
  ctx.save();ctx.globalAlpha=1-fadeOut;
  hair(ctx,CARD[0],CARD[1],CARD[2],CARD[3],16);
  rows.forEach((r,k)=>{
    const a=easeOut(seg(st,.15+k*.22,.5+k*.22));if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;
    const y=CARD[1]+30+k*62;
    txt(ctx,r[0],CARD[0]+28,y+22,'700 34px PD',C.text);
    numT(ctx,r[1],CARD[0]+CARD[2]-28,y+24,'900 40px PD',r[2],'right');
    ctx.restore();});
  ctx.restore();
  const c=easeOut(seg(st,1.1,1.6));
  if(c>0){ctx.save();ctx.globalAlpha=(1-fadeOut)*c;
    txt(ctx,'몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다',65,1316,'700 36px PD','#d8d8d8');
    ctx.restore();}
  ctx.restore();
  if(out>0){
    if(!window.__loopC){
      const lc=document.createElement('canvas');lc.width=W;lc.height=H;const g=lc.getContext('2d');
      g.fillStyle='#000';g.fillRect(0,0,W,H);g.drawImage(BGC,0,0);
      txt(g,COPY.kicker,65,322,'700 42px PD','#d8d8d8','left','.04em');
      txt(g,'결과는',65,432,'700 68px PD',C.muted);
      numT(g,pct(STATS.weekPct),54,586,'900 196px PD',STATS.weekPct>=0?C.up:C.down,'left','-.06em');
      txt(g,'과정은',65,722,'700 68px PD',C.muted);
      numT(g,pct(STATS.mdd),54,876,'900 196px PD',C.down,'left','-.06em');
      txt(g,'한 주 등락률 뒤에 숨은 낙폭',65,988,'700 48px PD',C.text);
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
