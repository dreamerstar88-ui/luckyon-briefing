import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const R='/home/user/luckyon-briefing', F=`${R}/assets/fonts`;
const PH={monitor:`${R}/data/card-photos/2026-08-28-pm/card3.jpg`};
const B64={};for(const k in PH)B64[k]='data:image/jpeg;base64,'+fs.readFileSync(PH[k]).toString('base64');
const all=JSON.parse(fs.readFileSync('us5m_nqf.json','utf8'));
// 월요일 개장(09:30 ET) ~ 금요일 마감(16:00 ET), 밤 포함 연속
const bars=all.filter(x=>'2026-08-31 09:30'<=x.d&&x.d<='2026-09-04 16:00');
const days=[...new Set(bars.map(x=>x.d.slice(0,10)))];
const WD=['월','화','수','목','금'];
const fonts=`
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Black.woff2);font-weight:900}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:PEN;src:url(file://${F}/NanumPenScript-Korean.woff2)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:PD,sans-serif;position:relative;background:#000;color:#fff}
.bg{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
.lay{position:absolute;inset:0}.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay}
.brand{position:absolute;left:56px;bottom:150px;font-size:30px;font-weight:700;color:#d8d8d8}
.foot{position:absolute;left:56px;right:56px;bottom:96px;font-size:26px;color:#7a7a7a}
.mk{display:inline-block;background:#ffe14d;color:#111;padding:4px 22px;transform:rotate(-1.5deg);text-shadow:none}
.sh{text-shadow:0 10px 40px rgba(0,0,0,.9)}
.pill{position:absolute;font-size:42px;font-weight:900;padding:10px 26px;display:inline-block;transform:rotate(-1.5deg)}`;
const grain=(op=.12)=>`<svg class="grain" style="opacity:${op}" width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2"/></filter><rect width="1080" height="1920" filter="url(#g)"/></svg>`;
const photo=(op,blur=0)=>`<img class="bg" src="${B64.monitor}" style="filter:contrast(1.1) saturate(1.15) blur(${blur}px);opacity:${op};object-position:40% 50%">
<div class="lay" style="background:radial-gradient(ellipse 80% 60% at 50% 45%,transparent 30%,rgba(0,0,0,.78) 100%)"></div>
<div class="lay" style="background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,0) 55%,rgba(0,0,0,.94) 82%)"></div>${grain(.12)}`;
const foot=`<div class="brand"><b style="color:#ffe14d">luckyon</b> 넘버뷰 · 이번 주 나스닥</div><div class="foot">나스닥100 선물 5분봉 · 시각은 한국시간 · 투자 권유가 아닙니다</div>`;
const CX=60,CW=960,CY=790,CH=500;
const lo=Math.min(...bars.map(b=>b.l)),hi=Math.max(...bars.map(b=>b.h));
const pad=(hi-lo)*.14,LO=lo-pad,HI=hi+pad;
const Y=v=>CY+CH-(v-LO)/(HI-LO)*CH, X=i=>CX+i/(bars.length-1)*CW;
const at=d=>bars.findIndex(x=>x.d===d);
function chartSvg(){
  let s='';
  days.forEach(d=>{ // 미국 정규장 음영
    const a=at(d+' 09:30'); let b=at(d+' 16:00'); if(b<0)b=bars.length-1;
    if(a>=0) s+=`<rect x="${X(a)}" y="${CY}" width="${X(b)-X(a)}" height="${CH}" fill="#ffffff" opacity=".05" rx="6"/>`;
  });
  days.slice(1).forEach(d=>{const i=at(d+' 00:00')>=0?at(d+' 00:00'):at(d+' 00:05'); if(i>0) s+=`<line x1="${X(i)}" x2="${X(i)}" y1="${CY}" y2="${CY+CH}" stroke="#3a3a3a" stroke-width="2" stroke-dasharray="6 8"/>`;});
  s+=`<polyline fill="none" stroke="#4ea8ff" stroke-width="5" stroke-linejoin="round" points="${bars.map((b,i)=>`${X(i).toFixed(1)},${Y(b.c).toFixed(1)}`).join(' ')}"/>`;
  return s;
}
const axis=`<div style="position:absolute;left:${CX}px;top:${CY+CH+26}px;width:${CW}px;display:flex;font-size:32px;font-weight:700;color:#8f9aad">${days.map((d,i)=>`<span style="flex:1;text-align:center">${d.slice(5).replace('-','/')} ${WD[i]}</span>`).join('')}</div>
<div style="position:absolute;left:56px;top:${CY+CH+92}px;font-size:32px;color:#6a7383">밝은 구간 = 미국 정규장(한국시간 밤 10:30~새벽 5:00)</div>`;
function mark(d,col,price){const i=at(d);const px=X(i),py=Y(bars[i].c);
return `<div style="position:absolute;left:40px;top:${CY-40}px;width:1000px;height:${CH+80}px;background:rgba(0,0,0,.55);border-radius:24px"></div>
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${chartSvg()}
<line x1="${px}" x2="${px}" y1="${py-24}" y2="${CY-30}" stroke="${col}" stroke-width="3" stroke-dasharray="8 6"/>
<circle cx="${px}" cy="${py}" r="30" fill="none" stroke="${col}" stroke-width="4" opacity=".6"/><circle cx="${px}" cy="${py}" r="15" fill="${col}"/></svg>${axis}`;}
const head=(big,sub,subcol)=>`<div class="sh" style="position:absolute;left:60px;top:140px;font-size:46px;font-weight:700;color:#8f9aad">나스닥100 선물 · 5분봉 되감기</div>
<div class="sh" style="position:absolute;left:56px;top:205px;font-size:145px;font-weight:900;letter-spacing:-.04em;line-height:1">${big}</div>
<div class="sh" style="position:absolute;left:60px;top:370px;font-size:54px;font-weight:900;color:${subcol}">${sub}</div>`;
const pages={};
pages['V1_hook']=()=>`${photo(.6)}
<div class="sh" style="position:absolute;left:60px;top:150px;font-size:48px;font-weight:700;color:#d8d8d8;letter-spacing:.04em">나스닥 · 월요일 개장 ~ 금요일 마감</div>
<div class="sh" style="position:absolute;left:56px;top:230px;font-size:84px;font-weight:700;color:#8f9aad">결과는</div>
<div class="sh" style="position:absolute;left:44px;top:300px;font-size:250px;font-weight:900;letter-spacing:-.06em;line-height:.95;color:#3ddc84">+0.4<span style="font-size:145px">%</span></div>
<div class="sh" style="position:absolute;left:56px;top:590px;font-size:84px;font-weight:700;color:#8f9aad">과정은</div>
<div class="sh" style="position:absolute;left:44px;top:660px;font-size:250px;font-weight:900;letter-spacing:-.06em;line-height:.95;color:#ff4d4d">-2.2<span style="font-size:145px">%</span></div>
<div class="sh" style="position:absolute;left:60px;top:1310px;font-size:62px;font-weight:900;line-height:1.25">일주일치 5분봉 1,179개,<br><span class="mk">60초에 되감습니다</span></div>
<div class="sh" style="position:absolute;left:60px;top:1530px;font-family:PEN;font-size:82px;color:#ffe14d;white-space:nowrap">그 사이 무슨 일이 있었나?</div>
${foot}`;
pages['V2_iran']=()=>`${photo(.2,14)}${head('29,337','▼ 5분 만에 -0.3% · 하락 시작','#ff4d4d')}
<div class="pill" style="left:56px;top:470px;background:#ff4d4d;color:#fff">화요일 저녁 5시 · 한국시간 9/1</div>
<div class="sh" style="position:absolute;left:60px;top:565px;font-size:58px;font-weight:900;line-height:1.25">호르무즈 유조선 피격.<br>미 국채 금리 급등.</div>
${mark('2026-09-01 04:05','#ff4d4d')}${foot}`;
pages['V3_low']=()=>`${photo(.2,14)}${head('28,927','▼ 고점 대비 -2.2% · 주간 최저','#ff4d4d')}
<div class="pill" style="left:56px;top:470px;background:#ff4d4d;color:#fff">수요일 저녁 8시 · 한국시간 9/2</div>
<div class="sh" style="position:absolute;left:60px;top:565px;font-size:58px;font-weight:900;line-height:1.25">한국이 퇴근할 무렵,<br><span style="color:#ff4d4d">바닥을 찍었다.</span></div>
${mark('2026-09-02 07:00','#ff4d4d')}${foot}`;
pages['V4_jobs']=()=>`${photo(.2,14)}${head('29,552','▼ 5분 만에 -0.4% · 주간 최대 변동','#ffe14d')}
<div class="pill" style="left:56px;top:470px;background:#ffe14d;color:#111">금요일 저녁 9시 30분 · 한국시간 9/4</div>
<div class="sh" style="position:absolute;left:60px;top:565px;font-size:58px;font-weight:900;line-height:1.25">8월 고용 16.2만 명.<br><span style="color:#ffe14d">예상은 5.5만 명이었다.</span></div>
${mark('2026-09-04 08:30','#ffe14d')}${foot}`;
pages['V5_answer']=()=>`${photo(.2,14)}
<div class="sh" style="position:absolute;left:60px;top:150px;font-size:52px;font-weight:900;line-height:1.25">이번 주 바닥도, 꼭대기도<br><span style="color:#ffe14d">한국 저녁에 나왔다.</span></div>
<div style="position:absolute;left:56px;right:56px;top:330px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #262626;padding:20px 0;font-size:46px;font-weight:700"><span>주간 최저 · 수 저녁 8시</span><b style="color:#ff4d4d;font-size:56px">28,927</b></div>
<div style="position:absolute;left:56px;right:56px;top:445px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #262626;padding:20px 0;font-size:46px;font-weight:700"><span>주간 최고 · 금 저녁 7시 45분</span><b style="color:#3ddc84;font-size:56px">29,704</b></div>
<div style="position:absolute;left:56px;right:56px;top:560px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #262626;padding:20px 0;font-size:46px;font-weight:700"><span>결국 한 주 결과</span><b style="color:#3ddc84;font-size:56px">+0.36%</b></div>
<div style="position:absolute;left:40px;top:${CY-40}px;width:1000px;height:${CH+80}px;background:rgba(0,0,0,.55);border-radius:24px"></div>
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${chartSvg()}</svg>${axis}
<div style="position:absolute;left:60px;top:1450px;font-family:PEN;font-size:76px;color:#ffe14d;white-space:nowrap">다음 주도 되감아 드립니다</div>
${foot}`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
for(const [n,fn] of Object.entries(pages)){await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body>${fn()}</body></html>`,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))));await page.screenshot({path:`frames8/${n}.png`});console.log(n);}
await browser.close();
