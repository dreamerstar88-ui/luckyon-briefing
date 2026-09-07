import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const R='/home/user/luckyon-briefing', F=`${R}/assets/fonts`;
const PH={monitor:`${R}/data/card-photos/2026-08-28-pm/card3.jpg`,floor:`${R}/data/card-photos/2026-09-01-pm/card1.jpg`};
const B64={};for(const k in PH)B64[k]='data:image/jpeg;base64,'+fs.readFileSync(PH[k]).toString('base64');
const m5=JSON.parse(fs.readFileSync('m5_kospi.json','utf8')).filter(x=>x.d.startsWith('2026-09-07'));
const fonts=`
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Black.woff2);font-weight:900}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:PEN;src:url(file://${F}/NanumPenScript-Korean.woff2)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:PD,sans-serif;position:relative;background:#000;color:#fff}
.bg{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
.lay{position:absolute;inset:0}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay}
.brand{position:absolute;left:56px;bottom:150px;font-size:30px;font-weight:700;color:#d8d8d8}
.foot{position:absolute;left:56px;right:56px;bottom:96px;font-size:26px;color:#7a7a7a}
.mk{display:inline-block;background:#ffe14d;color:#111;padding:4px 22px;transform:rotate(-1.5deg);margin-top:14px;text-shadow:none}
.sh{text-shadow:0 10px 40px rgba(0,0,0,.9)}`;
const grain=(op=.12)=>`<svg class="grain" style="opacity:${op}" width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2"/></filter><rect width="1080" height="1920" filter="url(#g)"/></svg>`;
const base=(k,pos)=>`<img class="bg" src="${B64[k]}" style="filter:contrast(1.1) saturate(1.15);opacity:.7;object-position:${pos}">
<div class="lay" style="background:radial-gradient(ellipse 80% 60% at 50% 45%,transparent 30%,rgba(0,0,0,.75) 100%)"></div>
<div class="lay" style="background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 60%,rgba(0,0,0,.92) 85%)"></div>${grain(.12)}
<div class="brand"><b style="color:#ffe14d">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
function line(bars,x0,y0,W,H,col){const lo=Math.min(...bars.map(b=>b.l)),hi=Math.max(...bars.map(b=>b.h));const Y=v=>y0+H-(v-lo)/(hi-lo)*H,w=W/(bars.length-1);return `<polyline fill="none" stroke="${col}" stroke-width="6" stroke-linejoin="round" points="${bars.map((b,i)=>`${x0+i*w},${Y(b.c)}`).join(' ')}"/>`;}
const pages={};
// A: 7,000까지 4.61 (숫자 우연의 일치)
pages['A_4p61']=()=>`${base('monitor','40% 50%')}
<div class="sh" style="position:absolute;left:60px;top:170px;font-size:52px;font-weight:700;color:#d8d8d8;letter-spacing:.04em">코스피 · 9/7 월요일 마감</div>
<div class="sh" style="position:absolute;left:44px;top:240px;font-size:330px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#ff4d4d">+4.61<span style="font-size:190px">%</span></div>
<div class="sh" style="position:absolute;left:60px;top:610px;font-size:110px;font-weight:900;letter-spacing:-.03em;line-height:1.15">하루 만에.<br><span class="mk">7,000까지 딱 4.61</span></div>
<div class="sh" style="position:absolute;left:60px;top:1330px;font-size:52px;font-weight:700;line-height:1.3;white-space:nowrap">올해 21번째 급등 · 2000년 이후 60번.<br><span style="font-family:PEN;font-size:92px;color:#ffe14d;white-space:nowrap">그날 산 사람, 1년 뒤엔?</span></div>`;
// B: 급락 뒤 3거래일 V자 + 9/7 5분봉 라인
pages['B_vshape']=()=>`${base('floor','50% 30%')}
<svg width="1080" height="1920" style="position:absolute;left:0;top:0;opacity:.85">${line(m5,60,880,960,360,'#ff4d4d')}</svg>
<div class="sh" style="position:absolute;left:60px;top:170px;font-size:52px;font-weight:700;color:#d8d8d8;letter-spacing:.04em">코스피 · 9/7 월요일</div>
<div class="sh" style="position:absolute;left:44px;top:240px;font-size:330px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#ff4d4d">+4.61<span style="font-size:190px">%</span></div>
<div class="sh" style="position:absolute;left:60px;top:610px;font-size:110px;font-weight:900;letter-spacing:-.03em;line-height:1.15">-3.99% 사흘 뒤.<br><span class="mk">올해 46번째 널뛰기</span></div>
<div class="sh" style="position:absolute;left:60px;top:1260px;font-size:44px;font-weight:700;color:#d8d8d8">9/7 5분봉 · 6,911 → 6,995 · 7,000까지 4.61p</div>
<div class="sh" style="position:absolute;left:60px;top:1340px;font-size:52px;font-weight:700;line-height:1.3;white-space:nowrap">급락 뒤 사흘 안에 급등, 2000년 이후 34번.<br><span style="font-family:PEN;font-size:92px;color:#ffe14d;white-space:nowrap">1년 뒤엔 어떻게 됐을까?</span></div>`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
for(const [n,fn] of Object.entries(pages)){await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body>${fn()}</body></html>`,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))));await page.screenshot({path:`frames5/${n}.png`});console.log(n);}
await browser.close();
