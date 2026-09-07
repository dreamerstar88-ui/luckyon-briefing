import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const F='/home/user/luckyon-briefing/assets/fonts';
const m5=JSON.parse(fs.readFileSync('m5_kospi.json','utf8')).filter(x=>x.d.startsWith('2026-09-02'));
const fonts=`
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Black.woff2);font-weight:900}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:PEN;src:url(file://${F}/NanumPenScript-Korean.woff2)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:PD,sans-serif}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay}
.brand{position:absolute;left:56px;bottom:150px;font-size:30px;font-weight:700}
.foot{position:absolute;left:56px;right:56px;bottom:96px;font-size:26px}`;
const grain=(op=.12)=>`<svg class="grain" style="opacity:${op}" width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2"/></filter><rect width="1080" height="1920" filter="url(#g)"/></svg>`;
function candlesSvg(bars,x0,y0,W,H,up,dn,wick){const lo=Math.min(...bars.map(b=>b.l)),hi=Math.max(...bars.map(b=>b.h));const pad=(hi-lo)*.08,L=lo-pad,Hh=hi+pad;const Y=v=>y0+H-(v-L)/(Hh-L)*H,w=W/bars.length;let s='';bars.forEach((b,i)=>{const x=x0+i*w+w/2,c=b.c>=b.o?up:dn;s+=`<line x1="${x}" x2="${x}" y1="${Y(b.h)}" y2="${Y(b.l)}" stroke="${c}" stroke-width="${Math.max(1,w*.18)}"/>`;const t=Y(Math.max(b.o,b.c)),bt=Y(Math.min(b.o,b.c));s+=`<rect x="${x-w*.32}" y="${t}" width="${w*.64}" height="${Math.max(2,bt-t)}" fill="${c}"/>`;});return s;}
const pages={};
// P1 딥 네이비 + 형광 옐로, 키네틱 타이포(단어를 층층이 크기·기울기 다르게)
pages['P1_navy_kinetic']=()=>`<style>body{background:#0a1a3a;color:#f5f7ff}</style>${grain(.15)}
<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;background:radial-gradient(900px 700px at 20% 30%,#123067 0%,transparent 60%)"></div>
<div style="position:absolute;left:60px;top:300px;font-size:60px;font-weight:900;color:#9fb3ff;letter-spacing:.06em">코스피 · 9/2 수요일</div>
<div style="position:absolute;left:40px;top:380px;font-size:330px;font-weight:900;color:#ffe600;letter-spacing:-.06em;line-height:.95;transform:rotate(-6deg);text-shadow:12px 12px 0 #0a1a3a,16px 16px 0 #4f6dff">-3.99<span style="font-size:200px">%</span></div>
<div style="position:absolute;left:60px;top:800px;font-size:150px;font-weight:900;color:#fff;letter-spacing:-.04em;line-height:.95;transform:rotate(2deg)">하루 만에</div>
<div style="position:absolute;left:60px;top:1000px;display:inline-block;background:#ffe600;color:#0a1a3a;font-size:88px;font-weight:900;padding:10px 34px;transform:rotate(-2deg)">올해만 26일째</div>
<div style="position:absolute;left:60px;top:1180px;font-size:76px;font-weight:700;color:#9fb3ff;line-height:1.2">2000년 이후 104일.<br>1년 뒤엔?</div>
<div class="brand" style="color:#9fb3ff"><b style="color:#ffe600">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#4f5f8a">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
// P2 크림 종이 + 빨강 스탬프 (호외 신문)
pages['P2_paper_stamp']=()=>`<style>body{background:#efe6d2;color:#1b1a17}</style>${grain(.35)}
<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;background:repeating-linear-gradient(0deg,rgba(0,0,0,.025) 0 2px,transparent 2px 6px)"></div>
<div style="position:absolute;left:56px;right:56px;top:120px;border-top:6px solid #1b1a17;border-bottom:2px solid #1b1a17;padding:14px 0;display:flex;justify-content:space-between;font-size:30px;font-weight:700"><span>넘버뷰 호외</span><span>2026. 9. 2 (수)</span><span>제1호</span></div>
<div style="position:absolute;left:56px;top:290px;font-size:64px;font-weight:900;line-height:1.1;letter-spacing:-.02em">코스피, 하루 만에</div>
<div style="position:absolute;left:40px;top:380px;font-size:340px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#1b1a17">-3.99%</div>
<div style="position:absolute;left:640px;top:200px;width:360px;height:360px;border:12px solid #c8261b;border-radius:50%;transform:rotate(-14deg);opacity:.85;display:flex;align-items:center;justify-content:center;text-align:center;color:#c8261b;font-size:62px;font-weight:900;line-height:1.05;mix-blend-mode:multiply">올해<br>26일째</div>
<div style="position:absolute;left:56px;right:56px;top:780px;border-top:2px solid #1b1a17;padding-top:26px;column-count:2;column-gap:40px;font-size:34px;line-height:1.5;color:#3a3833">2000년 이후 하루 3.9% 넘게 빠진 날은 모두 104일. 그중 26일이 올해다. 7월 28일에는 10.84% 폭락으로 서킷브레이커가 걸렸고, 이틀 뒤에도 5.98% 밀렸다. 그렇다면 그런 날 산 사람은 1년 뒤 어떻게 됐을까. 판정이 끝난 78일 중 몇 번이 올라 있었을까.</div>
<div style="position:absolute;left:56px;top:1200px;font-family:PEN;font-size:96px;color:#c8261b;transform:rotate(-2deg);white-space:nowrap;text-decoration:underline wavy #c8261b 5px">1년 뒤엔 어떻게 됐을까?</div>
<div class="brand" style="color:#3a3833"><b style="color:#c8261b">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#7a766e">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
// P3 하이퍼팝 그라데이션 + 리퀴드 글라스 카드
pages['P3_gradient_glass']=()=>`<style>body{background:linear-gradient(160deg,#3a0ca3 0%,#7209b7 35%,#f72585 75%,#ff8fab 100%);color:#fff}
.glass{position:absolute;left:60px;right:60px;top:420px;height:900px;border-radius:48px;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.45);backdrop-filter:blur(30px);box-shadow:0 30px 80px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.6)}</style>${grain(.12)}
<div style="position:absolute;left:-200px;top:200px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,#ffd166 0%,transparent 65%);opacity:.8"></div>
<div style="position:absolute;left:600px;top:1300px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,#4cc9f0 0%,transparent 65%);opacity:.7"></div>
<div class="glass"></div>
<div style="position:absolute;left:100px;top:470px;font-size:40px;font-weight:700;opacity:.9">코스피 · 9/2 (수) 마감</div>
<div style="position:absolute;left:96px;top:530px;font-size:290px;font-weight:900;letter-spacing:-.06em;line-height:1;text-shadow:0 20px 60px rgba(0,0,0,.35)">-3.99<span style="font-size:170px">%</span></div>
<div style="position:absolute;left:100px;top:870px;font-size:84px;font-weight:900;line-height:1.1">하루 만에.<br><span style="opacity:.85;font-weight:700">올해만 26일째</span></div>
<div style="position:absolute;left:100px;top:1120px;display:flex;gap:20px"><span style="padding:16px 30px;border-radius:999px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.5);font-size:38px;font-weight:700">2000년 이후 104일</span><span style="padding:16px 30px;border-radius:999px;background:#ffd166;color:#3a0ca3;font-size:38px;font-weight:900">1년 뒤엔?</span></div>
<div class="brand" style="color:rgba(255,255,255,.85)"><b style="color:#ffd166">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:rgba(255,255,255,.6)">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
// P4 터미널 그린 + 스캔라인 + 글리치
pages['P4_terminal_glitch']=()=>`<style>body{background:#050806;color:#8dff9a;font-family:'DejaVu Sans Mono',PD,monospace}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 3px,transparent 3px 6px);pointer-events:none}</style>${grain(.18)}
<svg width="1080" height="1920" style="position:absolute;left:0;top:0">${candlesSvg(m5,40,820,1000,700,'#8dff9a','#2a7a38')}</svg>
<div class="scan"></div>
<div style="position:absolute;left:56px;top:120px;font-size:34px;color:#4fd66a">KOSPI &nbsp;2026-09-02 &nbsp;15:30:00 &nbsp;CLOSE</div>
<div style="position:absolute;left:56px;top:170px;font-size:34px;color:#4fd66a">6,562.72 &nbsp;&nbsp;-273.08 &nbsp;&nbsp;VOL ██████░░</div>
<div style="position:absolute;left:52px;top:300px;font-size:300px;font-weight:900;letter-spacing:-.05em;line-height:1;color:#ff3b5c;opacity:.7;transform:translate(-8px,0);clip-path:inset(0 0 55% 0)">-3.99%</div>
<div style="position:absolute;left:52px;top:300px;font-size:300px;font-weight:900;letter-spacing:-.05em;line-height:1;color:#42d7ff;opacity:.7;transform:translate(8px,0);clip-path:inset(55% 0 0 0)">-3.99%</div>
<div style="position:absolute;left:52px;top:300px;font-size:300px;font-weight:900;letter-spacing:-.05em;line-height:1;color:#8dff9a">-3.99%</div>
<div style="position:absolute;left:56px;top:640px;font-size:60px;color:#c9ffd0;font-weight:700">&gt; 하루 만에. 올해만 26일째_</div>
<div style="position:absolute;left:56px;top:1560px;font-size:52px;color:#8dff9a;font-weight:700;white-space:nowrap">&gt; 2000년 이후 104일. 1년 뒤엔? ▮</div>
<div class="brand" style="color:#4fd66a"><b style="color:#8dff9a">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#2a7a38">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;
// P5 풀블리드 컬러 (하락일 = 파랑 전체, 상승일 = 빨강 전체)
pages['P5_fullbleed_color']=()=>`<style>body{background:#1e5cff;color:#fff}</style>${grain(.1)}
<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.25) 100%)"></div>
<div style="position:absolute;left:60px;top:220px;font-size:56px;font-weight:700;opacity:.9">코스피 · 9/2 (수)</div>
<div style="position:absolute;left:0;top:520px;width:1080px;text-align:center;font-size:400px;font-weight:900;letter-spacing:-.08em;line-height:.9">-3.99</div>
<div style="position:absolute;left:0;top:900px;width:1080px;text-align:center;font-size:140px;font-weight:900;letter-spacing:-.02em">%  하루 만에</div>
<div style="position:absolute;left:0;top:1160px;width:1080px;text-align:center;font-family:PEN;font-size:130px;color:#ffe600;transform:rotate(-2deg)">올해만 26일째??</div>
<div style="position:absolute;left:0;top:1400px;width:1080px;text-align:center;font-size:64px;font-weight:700;opacity:.9">2000년 이후 104일 · 1년 뒤엔?</div>
<div class="brand" style="color:rgba(255,255,255,.85);left:0;width:1080px;text-align:center"><b style="color:#ffe600">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:rgba(255,255,255,.6);text-align:center">과거 데이터 기반 · 투자 권유가 아닙니다 · 파란 화면 = 하락일, 빨간 화면 = 상승일</div>`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
for(const [n,fn] of Object.entries(pages)){await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body>${fn()}</body></html>`);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`frames3/${n}.png`});}
await browser.close(); console.log('done');
