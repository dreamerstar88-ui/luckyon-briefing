import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const F='/home/user/luckyon-briefing/assets/fonts';
const m5=JSON.parse(fs.readFileSync('m5_kospi.json','utf8'));
const chart=JSON.parse(fs.readFileSync('chart.json','utf8'));
const days=['2026-08-31','2026-09-01','2026-09-02','2026-09-03','2026-09-04'];
const byDay=Object.fromEntries(days.map(d=>[d,m5.filter(x=>x.d.startsWith(d))]));
const prevClose={'2026-08-31':6788.88};
for(let i=1;i<days.length;i++) prevClose[days[i]]=byDay[days[i-1]].at(-1).c;
const daily=Object.fromEntries(fs.readFileSync('hist_kospi.csv','utf8').trim().split('\n').slice(1).map(l=>{const [d,c]=l.split(',');return [d,+c]}));
const dprev={'2026-08-31':daily['2026-08-28'],'2026-09-01':daily['2026-08-31'],'2026-09-02':daily['2026-09-01'],'2026-09-03':daily['2026-09-02'],'2026-09-04':daily['2026-09-03']};
const dayChg=Object.fromEntries(days.map(d=>[d,(daily[d]/dprev[d]-1)*100]));
console.log(dayChg);
const UP='#ff4d4d', DN='#4a8cff', YEL='#ffd23f';
const css=`
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Black.woff2);font-weight:900}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:PEN;src:url(file://${F}/NanumPenScript-Korean.woff2)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0b0e13;color:#e8eaee;font-family:PD,sans-serif}
.grain{position:absolute;inset:0;pointer-events:none;opacity:.10;mix-blend-mode:screen}
.hdr{position:absolute;left:56px;top:88px}
.hdr .n{font-size:34px;font-weight:700;color:#9aa3b2}
.hdr .p{font-size:88px;font-weight:900;letter-spacing:-.02em;line-height:1.05}
.hdr .d{font-size:40px;font-weight:700}
.tag{position:absolute;right:56px;top:96px;font-size:30px;color:#9aa3b2;font-weight:500;text-align:right;line-height:1.4}
.pen{font-family:PEN;color:${YEL};text-shadow:0 0 18px rgba(0,0,0,.9),0 3px 0 rgba(0,0,0,.8)}
.stk{position:absolute;padding:14px 34px;border-radius:14px;font-weight:900;font-size:48px;color:#fff;background:#e0342b;box-shadow:0 10px 24px rgba(0,0,0,.5);transform:rotate(-4deg)}
.stk.w{background:#f4f1ea;color:#111}
.foot{position:absolute;left:56px;right:56px;bottom:96px;font-size:26px;color:#5f6673}
.brand{position:absolute;left:56px;bottom:150px;font-size:30px;font-weight:700;color:#9aa3b2}
.brand b{color:${YEL}}
`;
const grain=`<svg class="grain" width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0"/></filter><rect width="1080" height="1920" filter="url(#g)"/></svg>`;
function candles(bars,x0,y0,W,H,opts={}){
  const lo=Math.min(...bars.map(b=>b.l)),hi=Math.max(...bars.map(b=>b.h));
  const pad=(hi-lo)*0.08; const L=lo-pad,Hh=hi+pad;
  const Y=v=>y0+H-(v-L)/(Hh-L)*H; const w=W/bars.length;
  let s='';
  bars.forEach((b,i)=>{const x=x0+i*w+w/2; const up=b.c>=b.o; const col=up?UP:DN;
    s+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(b.h).toFixed(1)}" y2="${Y(b.l).toFixed(1)}" stroke="${col}" stroke-width="${Math.max(1,w*0.18).toFixed(1)}"/>`;
    const top=Y(Math.max(b.o,b.c)),bot=Y(Math.min(b.o,b.c));
    s+=`<rect x="${(x-w*0.32).toFixed(1)}" y="${top.toFixed(1)}" width="${(w*0.64).toFixed(1)}" height="${Math.max(2,bot-top).toFixed(1)}" fill="${col}"/>`;});
  // grid
  for(let k=0;k<=4;k++){const v=L+(Hh-L)*k/4; s+=`<line x1="${x0}" x2="${x0+W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#1f2630" stroke-width="1"/><text x="${x0+W+10}" y="${(Y(v)+10).toFixed(1)}" font-size="26" fill="#5f6673">${Math.round(v).toLocaleString()}</text>`;}
  return {svg:s,Y,w};
}
const pages={};
// G1: 첫 프레임 — 증권앱 캡처 + 손글씨
pages['G1_first_frame_app_pen']=()=>{
  const bars=byDay['2026-09-02']; const {svg,Y}=candles(bars,56,700,900,620);
  const lastX=56+900-900/72/2, lastY=Y(bars.at(-1).c);
  return `${grain}
<div class="hdr"><div class="n">코스피 KOSPI · 09.02 (수) 마감</div><div class="p">6,562.72</div><div class="d" style="color:${DN}">▼ 273.08 &nbsp;-3.99%</div></div>
<div class="tag">5분봉<br>09:00 – 15:30</div>
<div style="position:absolute;left:56px;top:360px;font-size:250px;font-weight:900;color:${DN};letter-spacing:-.05em;line-height:1">-3.99%</div>
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${svg}
<path d="M ${lastX-110} ${lastY-40} c 20,-90 220,-70 200,20 c -15,80 -220,80 -200,-20" fill="none" stroke="${YEL}" stroke-width="7" stroke-linecap="round" opacity=".95"/>
<path d="M 700 1330 q 120 -120 240 -80" fill="none" stroke="${YEL}" stroke-width="7" stroke-linecap="round"/><path d="M 930 1245 l 12 -32 l -40 -8" fill="none" stroke="${YEL}" stroke-width="7" stroke-linecap="round"/>
</svg>
<div class="pen" style="position:absolute;left:70px;top:1340px;font-size:128px;line-height:1;transform:rotate(-3deg);white-space:nowrap">올해만 26번째??</div>
<div class="stk" style="left:700px;top:300px;transform:rotate(6deg)">하루 만에</div>
<div class="brand"><b>luckyon</b> 넘버뷰 · 이번 주 숫자</div>
<div class="foot">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;};
// G2: 첫 프레임 대안 — 숫자 폭탄
pages['G2_first_frame_bomb']=()=>`${grain}
<div style="position:absolute;left:-10px;top:420px;width:1100px;text-align:center;font-size:330px;font-weight:900;color:transparent;-webkit-text-stroke:4px ${DN};letter-spacing:-.06em;line-height:1;transform:rotate(-4deg) translate(18px,14px)">-3.99%</div>
<div style="position:absolute;left:-10px;top:420px;width:1100px;text-align:center;font-size:330px;font-weight:900;color:${YEL};letter-spacing:-.06em;line-height:1;transform:rotate(-4deg)">-3.99%</div>
<div class="stk w" style="left:120px;top:300px;transform:rotate(-7deg);font-size:54px">코스피 · 9/2 (수)</div>
<div class="stk" style="left:520px;top:860px;transform:rotate(5deg);font-size:64px">올해만 26번째</div>
<div class="pen" style="position:absolute;left:80px;top:1060px;font-size:104px;line-height:1.1;white-space:nowrap">2000년 이후 104번<br>그 중 <span style="color:#fff">4분의 1</span>이 올해</div>
<div class="pen" style="position:absolute;left:80px;top:1420px;font-size:96px;color:#fff;line-height:1.1">1년 뒤엔 어떻게 됐을까?</div>
<div class="brand"><b>luckyon</b> 넘버뷰 · 이번 주 숫자</div>
<div class="foot">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
// G3: 주간 되감기 — 월~금 5분봉 + 사건 라벨 (원안 합치기)
pages['G3_week_rewind_labels']=()=>{
  const all=days.flatMap(d=>byDay[d]); const {svg,Y,w}=candles(all,40,520,960,760);
  let sep='',lab='';
  const names={'2026-08-31':'월','2026-09-01':'화','2026-09-02':'수','2026-09-03':'목','2026-09-04':'금'};
  days.forEach((d,i)=>{const x=40+i*72*w; if(i) sep+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="520" y2="1280" stroke="#2a3340" stroke-dasharray="8 10"/>`;
    const c=dayChg[d]; lab+=`<text x="${(x+36*w).toFixed(1)}" y="1330" font-size="34" font-weight="700" text-anchor="middle" fill="#9aa3b2">${d.slice(5).replace('-','/')} ${names[d]}</text><text x="${(x+36*w).toFixed(1)}" y="1378" font-size="38" font-weight="900" text-anchor="middle" fill="${c>=0?UP:DN}">${c>=0?'+':''}${c.toFixed(2)}%</text>`;});
  const x92=40+2*72*w+36*w;
  return `${grain}
<div class="hdr"><div class="n">코스피 KOSPI · 이번 주 되감기</div><div class="p">6,687.21</div><div class="d" style="color:${DN}">주간 ▼ 1.50% &nbsp;<span style="color:#9aa3b2;font-size:30px;font-weight:500">8/28 6,788.88 → 9/4</span></div></div>
<div class="tag">5분봉 × 360<br>08.31 – 09.04</div>
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${svg}${sep}${lab}
<line x1="${x92.toFixed(1)}" x2="${x92.toFixed(1)}" y1="470" y2="1290" stroke="${YEL}" stroke-width="4"/>
<path d="M 300 430 q 120 -60 250 10" fill="none" stroke="${YEL}" stroke-width="6" stroke-linecap="round"/>
</svg>
<div class="pen" style="position:absolute;left:60px;top:330px;font-size:78px;line-height:1">수요일 여기서 -3.99%</div>
<div class="pen" style="position:absolute;left:640px;top:1000px;font-size:54px;line-height:1.05;color:#fff">씨티, 삼전·하닉<br>목표가 ↓</div>
<div class="pen" style="position:absolute;left:120px;top:620px;font-size:54px;line-height:1.05;color:#fff">미 10년물 4.8%<br>34개월 최고</div>
<div class="pen" style="position:absolute;left:800px;top:640px;font-size:54px;line-height:1.05;color:#fff">자사주<br>200만주</div>
<div class="pen" style="position:absolute;left:60px;top:1420px;font-size:84px;line-height:1.1;white-space:nowrap">이런 날, 2000년 이후 104번.</div><div class="pen" style="position:absolute;left:60px;top:1520px;font-size:110px;line-height:1;color:#fff">1년 뒤엔?</div>
<div class="brand"><b>luckyon</b> 넘버뷰 · 이번 주 숫자</div>
<div class="foot">코스피 5분봉 · 과거 데이터 기반 · 투자 권유가 아닙니다</div>`;};
// G4: 역사 프레임 — 다크 + 손글씨 스코어보드
pages['G4_history_scoreboard']=()=>{
  const pts=chart.pts, ev=chart.ev; const W=940,H=560,x0=56,y0=520;
  const t0=new Date(pts[0][0]).getTime(),t1=new Date('2026-12-31').getTime(); const lo=Math.log(450),hi=Math.log(7500);
  const X=d=>x0+(new Date(d).getTime()-t0)/(t1-t0)*W, Y=v=>y0+H-(Math.log(v)-lo)/(hi-lo)*H;
  const path=pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
  const val=d=>{let b=pts[0];for(const p of pts){if(p[0]<=d)b=p;}return b[1];};
  const dots=ev.map(e=>{const c=e[3];const col=c==null?'#8a93a3':(c>0?UP:DN);return `<circle cx="${X(e[0]).toFixed(1)}" cy="${Y(val(e[0])).toFixed(1)}" r="10" fill="${col}"/>`;}).join('');
  const yrs=[2000,2008,2020,2026].map(y=>`<text x="${X(y+'-01-01').toFixed(0)}" y="${y0+H+44}" font-size="28" fill="#5f6673" text-anchor="middle">${y}</text>`).join('');
  return `${grain}
<div class="hdr"><div class="n">코스피 2000 → 2026</div><div class="p" style="font-size:64px">하루 -3.9% 이하였던 날</div><div class="d"><span style="color:${YEL}">104</span> <span style="font-size:30px;color:#9aa3b2;font-weight:500">번 · 점 하나가 하루</span></div></div>
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${yrs}<path d="${path}" fill="none" stroke="#c9d1dc" stroke-width="3"/>${dots}
<path d="M ${(X('2026-01-01')-70).toFixed(0)} ${Y(5200).toFixed(0)} c 10,-180 150,-200 170,-60 c 15,110 -130,170 -170,60" fill="none" stroke="${YEL}" stroke-width="7" stroke-linecap="round"/></svg>
<div class="pen" style="position:absolute;left:400px;top:990px;font-size:56px;line-height:1;white-space:nowrap">↑ 여기 26개가 올해</div><div style="position:absolute;left:56px;top:300px;font-size:30px;color:#9aa3b2"><span style="color:${UP}">●</span> 1년 뒤 올랐다 &nbsp; <span style="color:${DN}">●</span> 1년 뒤 내렸다 &nbsp; <span style="color:#8a93a3">●</span> 아직 1년 안 됨</div>
<div class="pen" style="position:absolute;left:56px;top:1190px;font-size:72px;line-height:1.05;color:#fff;white-space:nowrap">1년 뒤 <span style="color:${UP}">올랐다 48</span> : <span style="color:${DN}">내렸다 30</span></div>
<div class="pen" style="position:absolute;left:56px;top:1300px;font-size:48px;line-height:1.15;white-space:nowrap">중앙값 +16.5% · 최악 -38.8% · 최선 +167%</div>
<div class="stk" style="left:56px;top:1400px;transform:rotate(-4deg);font-size:60px">정답 ② 48번</div>
<div class="pen" style="position:absolute;left:56px;top:1530px;font-size:66px;color:#fff;white-space:nowrap">9/2에 사셨나요? 파셨나요? → 댓글</div>
<div class="brand"><b>luckyon</b> 넘버뷰 · 이번 주 숫자</div>
<div class="foot">코스피 종가 · 과거 데이터 기반 · 투자 권유가 아닙니다</div>`;};
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
for(const [n,fn] of Object.entries(pages)){await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${fn()}</body></html>`);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`frames2/${n}.png`});console.log('ok',n);}
await browser.close();
