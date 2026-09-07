import fs from 'node:fs';
import { chromium } from '/home/user/luckyon-briefing/node_modules/playwright/index.mjs';
const R='/home/user/luckyon-briefing';
const F=`${R}/assets/fonts`;
const PH={floor:`${R}/data/card-photos/2026-09-01-pm/card1.jpg`,monitor:`${R}/data/card-photos/2026-08-28-pm/card3.jpg`,room:`${R}/data/card-photos/2026-09-02-am/card1.jpg`,seoul:`${R}/assets/photos/seoul.jpg`,ticker:`${R}/assets/photos/ticker.jpg`,won:`${R}/assets/photos/won.jpg`,nyse:`${R}/assets/photos/nyse.jpg`};
const B64={};for(const k in PH)B64[k]='data:image/jpeg;base64,'+fs.readFileSync(PH[k]).toString('base64');
const fonts=`
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Bold.woff2);font-weight:700}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Black.woff2);font-weight:900}
@font-face{font-family:PD;src:url(file://${F}/Pretendard-Medium.woff2);font-weight:500}
@font-face{font-family:PEN;src:url(file://${F}/NanumPenScript-Korean.woff2)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:PD,sans-serif;position:relative}
.bg{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
.lay{position:absolute;inset:0}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay}
.brand{position:absolute;left:56px;bottom:150px;font-size:30px;font-weight:700}
.foot{position:absolute;left:56px;right:56px;bottom:96px;font-size:26px}`;
const grain=(op=.12)=>`<svg class="grain" style="opacity:${op}" width="1080" height="1920"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2"/></filter><rect width="1080" height="1920" filter="url(#g)"/></svg>`;
const img=(k,style)=>`<img class="bg" src="${B64[k]}" style="${style}">`;
const pages={};

// H1 여의도 객장 실사 + 진남색 덮개 (시네마 포스터)
pages['H1_floor_cinema']=()=>`<style>body{background:#07101f;color:#fff}</style>
${img('floor','filter:saturate(.7) contrast(1.05);opacity:.5;object-position:50% 30%')}
<div class="lay" style="background:linear-gradient(180deg,rgba(7,16,31,.25) 0%,rgba(7,16,31,.55) 45%,rgba(7,16,31,.95) 80%)"></div>
${grain(.14)}
<div style="position:absolute;left:60px;top:230px;font-size:52px;font-weight:700;color:#c9d4ea;letter-spacing:.04em">코스피 · 9월 2일 수요일 마감</div>
<div style="position:absolute;left:44px;top:300px;font-size:330px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#fff;text-shadow:0 24px 60px rgba(0,0,0,.6)">-3.99<span style="font-size:190px">%</span></div>
<div style="position:absolute;left:60px;top:660px;width:520px;height:16px;background:#ff3b3b;transform:skewX(-20deg)"></div>
<div style="position:absolute;left:60px;top:720px;font-size:120px;font-weight:900;letter-spacing:-.04em;line-height:1">하루 만에.</div>
<div style="position:absolute;left:56px;top:900px;font-family:PEN;font-size:118px;color:#ffe14d;transform:rotate(-3deg);white-space:nowrap;text-shadow:0 6px 20px rgba(0,0,0,.6)">올해만 26일째</div>
<div style="position:absolute;left:60px;top:1130px;font-size:64px;font-weight:700;color:#c9d4ea;line-height:1.25">2000년 이후 104일.<br><span style="color:#fff">그날 산 사람, 1년 뒤엔?</span></div>
<div class="brand" style="color:#c9d4ea"><b style="color:#ffe14d">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#6b7893">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// H2 흑백 하프톤 신문 + 크림 종이 + 빨강 스탬프
pages['H2_halftone_news']=()=>`<style>body{background:#efe7d6;color:#171512}
.half{position:absolute;left:0;top:0;width:1080px;height:1920px;background:radial-gradient(circle,transparent .9px,#efe7d6 1.3px) 0 0/5px 5px;pointer-events:none}</style>
${img('floor','filter:grayscale(1) contrast(1.7) brightness(1.15);opacity:.75;object-position:50% 20%')}
<div class="half"></div>
<div class="lay" style="background:linear-gradient(180deg,rgba(239,231,214,.05) 0%,rgba(239,231,214,.15) 45%,rgba(239,231,214,.8) 78%)"></div>
${grain(.3)}
<div style="position:absolute;left:56px;right:56px;top:110px;border-top:7px solid #171512;border-bottom:2px solid #171512;padding:14px 0;display:flex;justify-content:space-between;font-size:30px;font-weight:700"><span>넘버뷰 호외</span><span>2026. 9. 2 (수)</span><span>제1호</span></div>
<div style="position:absolute;left:56px;top:250px;font-size:66px;font-weight:900;letter-spacing:-.02em">코스피, 하루 만에</div>
<div style="position:absolute;left:36px;top:330px;font-size:350px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#171512">-3.99%</div>
<div style="position:absolute;left:640px;top:690px;width:340px;height:340px;border:12px solid #c8261b;border-radius:50%;transform:rotate(-14deg);opacity:.9;display:flex;align-items:center;justify-content:center;text-align:center;color:#c8261b;font-size:62px;font-weight:900;line-height:1.05;mix-blend-mode:multiply">올해<br>26일째</div>
<div style="position:absolute;left:56px;top:740px;background:#c8261b;color:#fff;font-size:56px;font-weight:900;padding:8px 26px;transform:rotate(-1.5deg)">2000년 이후 104일</div>
<div style="position:absolute;left:56px;top:1290px;font-family:PEN;font-size:86px;color:#c8261b;transform:rotate(-2deg);white-space:nowrap;text-decoration:underline wavy #c8261b 5px">1년 뒤엔 어떻게 됐을까?</div>
<div class="brand" style="color:#3a3833"><b style="color:#c8261b">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#7a766e">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// H3 강남 야경 청록 듀오톤 + 형광 오렌지
pages['H3_seoul_duotone']=()=>`<style>body{background:#052a2c;color:#e8fffb}</style>
${img('seoul','filter:grayscale(1) contrast(1.2) blur(1.5px);opacity:.55;mix-blend-mode:screen;object-position:50% 50%')}
<div class="lay" style="background:linear-gradient(180deg,rgba(5,42,44,.1) 0%,rgba(5,42,44,.65) 55%,rgba(5,42,44,.97) 85%)"></div>
${grain(.14)}
<div style="position:absolute;left:60px;top:220px;font-size:52px;font-weight:700;color:#7fd6cc;letter-spacing:.04em">코스피 · 9/2 (수)</div>
<div style="position:absolute;left:40px;top:290px;font-size:340px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#ff6a1a;text-shadow:0 0 60px rgba(255,106,26,.45)">-3.99<span style="font-size:190px">%</span></div>
<div style="position:absolute;left:60px;top:700px;font-size:130px;font-weight:900;letter-spacing:-.04em;line-height:1;color:#e8fffb">하루 만에</div>
<div style="position:absolute;left:60px;top:880px;display:inline-block;background:#ff6a1a;color:#052a2c;font-size:84px;font-weight:900;padding:10px 32px;transform:rotate(-2deg)">올해만 26일째</div>
<div style="position:absolute;left:60px;top:1100px;font-size:64px;font-weight:700;color:#7fd6cc;line-height:1.25">2000년 이후 104일.<br><span style="color:#e8fffb">1년 뒤엔?</span></div>
<div class="brand" style="color:#7fd6cc"><b style="color:#ff6a1a">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#3d7a76">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// H4 모니터 클로즈업 + 비네트 + 형광펜 마커 (다큐 썸네일)
pages['H4_monitor_glow']=()=>`<style>body{background:#000;color:#fff}
.mk{display:inline-block;background:#ffe14d;color:#111;padding:4px 22px;transform:rotate(-1.5deg);margin-top:14px;text-shadow:none}</style>
${img('monitor','filter:contrast(1.1) saturate(1.15);opacity:.7;object-position:40% 50%')}
<div class="lay" style="background:radial-gradient(ellipse 80% 60% at 50% 45%,transparent 30%,rgba(0,0,0,.75) 100%)"></div>
<div class="lay" style="background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 60%,rgba(0,0,0,.92) 85%)"></div>
${grain(.12)}
<div style="position:absolute;left:60px;top:170px;font-size:52px;font-weight:700;color:#d8d8d8;letter-spacing:.04em">코스피 · 9/2 수요일</div>
<div style="position:absolute;left:44px;top:240px;font-size:330px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#fff;text-shadow:0 10px 40px rgba(0,0,0,.9)">-3.99<span style="font-size:190px">%</span></div>
<div style="position:absolute;left:60px;top:610px;font-size:110px;font-weight:900;letter-spacing:-.03em;line-height:1.15;text-shadow:0 6px 30px rgba(0,0,0,.9)">하루 만에.<br><span class="mk">올해만 26일째</span></div>
<div style="position:absolute;left:60px;top:1360px;font-size:66px;font-weight:700;color:#fff;line-height:1.25;text-shadow:0 4px 20px #000">2000년 이후 104일.<br><span style="font-family:PEN;font-size:88px;color:#ffe14d;white-space:nowrap">1년 뒤엔 어떻게 됐을까?</span></div>
<div class="brand" style="color:#d8d8d8"><b style="color:#ffe14d">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#7a7a7a">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// H5 지폐 실사 흐림 + 딥그린 + 골드 (돈 감성)
pages['H5_won_money']=()=>`<style>body{background:#0c2a1c;color:#f3e9c9}</style>
${img('won','filter:blur(4px) saturate(.6) contrast(1.1);opacity:.32;transform:scale(1.15) rotate(-6deg);object-position:50% 50%')}
<div class="lay" style="background:linear-gradient(180deg,rgba(12,42,28,.2) 0%,rgba(12,42,28,.7) 50%,rgba(12,42,28,.98) 82%)"></div>
${grain(.16)}
<div style="position:absolute;left:60px;top:220px;font-size:52px;font-weight:700;color:#b9a86a;letter-spacing:.12em">KOSPI · 2026. 9. 2</div>
<div style="position:absolute;left:40px;top:290px;font-size:340px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#f0c75e;text-shadow:0 20px 50px rgba(0,0,0,.6)">-3.99<span style="font-size:190px">%</span></div>
<div style="position:absolute;left:60px;top:700px;font-size:130px;font-weight:900;letter-spacing:-.04em;line-height:1;color:#f3e9c9">하루 만에</div>
<div style="position:absolute;left:60px;top:880px;border:6px solid #f0c75e;color:#f0c75e;font-size:80px;font-weight:900;padding:8px 30px;transform:rotate(-2deg);display:inline-block;letter-spacing:-.02em">올해만 26일째</div>
<div style="position:absolute;left:60px;top:1100px;font-size:64px;font-weight:700;color:#b9a86a;line-height:1.25">2000년 이후 104일.<br><span style="color:#f3e9c9">그날 산 돈, 1년 뒤엔?</span></div>
<div class="brand" style="color:#b9a86a"><b style="color:#f0c75e">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#5a7a60">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// H6 스크랩북: 검정 그레인 배경 + 실사를 폴라로이드/테이프로 붙임
pages['H6_scrapbook_tape']=()=>`<style>body{background:#161616;color:#fff}
.polo{position:absolute;left:90px;top:640px;width:900px;padding:22px 22px 90px;background:#f4f1ea;transform:rotate(-3deg);box-shadow:0 30px 60px rgba(0,0,0,.6)}
.polo img{display:block;width:856px;height:560px;object-fit:cover;object-position:50% 35%;filter:saturate(.85) contrast(1.05)}
.tape{position:absolute;width:260px;height:70px;background:rgba(255,240,150,.75);transform:rotate(-8deg);box-shadow:0 2px 6px rgba(0,0,0,.3)}</style>
${grain(.2)}
<div style="position:absolute;left:60px;top:200px;font-size:52px;font-weight:700;color:#bdbdbd;letter-spacing:.04em">코스피 · 9/2 (수)</div>
<div style="position:absolute;left:44px;top:270px;font-size:320px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#fff">-3.99<span style="font-size:180px">%</span></div>
<div class="polo"><img src="${B64.floor}"><div style="position:absolute;left:40px;bottom:16px;font-family:PEN;font-size:58px;color:#333;transform:rotate(.5deg)">2026.09.02 여의도, 하루 만에.</div></div>
<div class="tape" style="left:70px;top:610px"></div><div class="tape" style="left:760px;top:1280px;transform:rotate(10deg)"></div>
<div style="position:absolute;left:70px;top:1350px;font-family:PEN;font-size:120px;color:#ffe14d;transform:rotate(-4deg);white-space:nowrap;text-shadow:0 6px 16px rgba(0,0,0,.7);z-index:5">올해만 26일째!</div>
<div style="position:absolute;left:60px;top:1530px;font-size:64px;font-weight:700;color:#bdbdbd;line-height:1.25">2000년 이후 104일.<br><span style="color:#fff">1년 뒤엔?</span></div>
<div class="brand" style="color:#bdbdbd"><b style="color:#ffe14d">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#6a6a6a">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// Q1 블랙 + 형광 라임 스코어보드 (스포츠 중계)
pages['Q1_lime_scoreboard']=()=>`<style>body{background:#0b0b0b;color:#fff}
.row{position:absolute;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #262626;padding:18px 0;font-size:54px;font-weight:700}
.row b{color:#c6ff00;font-size:64px}</style>${grain(.1)}
<div style="position:absolute;left:60px;top:170px;display:flex;gap:16px;align-items:center"><span style="background:#c6ff00;color:#0b0b0b;font-size:34px;font-weight:900;padding:6px 18px">FINAL</span><span style="font-size:40px;color:#9a9a9a;font-weight:700">코스피 · 9/2 (수)</span></div>
<div style="position:absolute;left:40px;top:250px;font-size:360px;font-weight:900;letter-spacing:-.08em;line-height:.95;color:#c6ff00">-3.99</div>
<div style="position:absolute;left:60px;top:620px;font-size:120px;font-weight:900;letter-spacing:-.03em">% 하루 만에</div>
<div class="row" style="top:820px"><span>올해 -4% 이상 급락</span><b>26일째</b></div>
<div class="row" style="top:940px"><span>2000년 이후</span><b>104일</b></div>
<div class="row" style="top:1060px"><span>1년 뒤 올라 있던 날</span><b style="color:#fff">? / 78</b></div>
<div style="position:absolute;left:60px;top:1260px;font-family:PEN;font-size:110px;color:#c6ff00;transform:rotate(-2deg);white-space:nowrap">몇 번이었을까?</div>
<div class="brand" style="color:#9a9a9a"><b style="color:#c6ff00">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#555">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// Q2 버건디 + 골드 (올드머니)
pages['Q2_burgundy_gold']=()=>`<style>body{background:#3a0f1a;color:#f2e6d0}</style>${grain(.14)}
<div class="lay" style="background:radial-gradient(800px 900px at 30% 25%,#5a1a2b 0%,transparent 70%)"></div>
<div style="position:absolute;left:60px;right:60px;top:150px;border-top:3px solid #d4af5a;border-bottom:1px solid #d4af5a;padding:16px 0;text-align:center;font-size:36px;letter-spacing:.3em;color:#d4af5a;font-weight:700">이 번 주 숫 자 · 코 스 피</div>
<div style="position:absolute;left:0;width:1080px;top:330px;text-align:center;font-size:340px;font-weight:900;letter-spacing:-.07em;line-height:.95;color:#f2e6d0">-3.99<span style="font-size:190px">%</span></div>
<div style="position:absolute;left:0;width:1080px;top:740px;text-align:center;font-size:120px;font-weight:900;letter-spacing:-.03em;color:#d4af5a">하루 만에</div>
<div style="position:absolute;left:0;width:1080px;top:920px;text-align:center;font-size:62px;font-weight:700;color:#f2e6d0;white-space:nowrap">올해만 <span style="color:#d4af5a;font-weight:900">26</span>일째 · 2000년 이후 <span style="color:#d4af5a;font-weight:900">104</span>일</div>
<div style="position:absolute;left:0;width:1080px;top:1080px;text-align:center;font-family:PEN;font-size:94px;color:#d4af5a;transform:rotate(-1.5deg);white-space:nowrap">1년 뒤엔 어떻게 됐을까</div>
<div class="brand" style="color:#c9b08a;left:0;width:1080px;text-align:center"><b style="color:#d4af5a">luckyon</b> 넘버뷰 · 2026. 9. 2 (수)</div><div class="foot" style="color:#8a6a72;text-align:center">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

// Q3 코랄 오렌지 + 크림 뉴트로 (따뜻한 팝)
pages['Q3_coral_retro']=()=>`<style>body{background:#ff6b4a;color:#1d1a17}
.stripe{position:absolute;left:0;top:0;width:1080px;height:1920px;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.06) 0 20px,transparent 20px 60px)}</style>${grain(.16)}<div class="stripe"></div>
<div style="position:absolute;left:60px;top:180px;background:#1d1a17;color:#fff5e6;font-size:40px;font-weight:900;padding:10px 24px;letter-spacing:.06em;display:inline-block;transform:rotate(-2deg)">코스피 · 9/2 (수)</div>
<div style="position:absolute;left:40px;top:280px;font-size:350px;font-weight:900;letter-spacing:-.08em;line-height:.95;color:#fff5e6;text-shadow:14px 14px 0 #1d1a17">-3.99</div>
<div style="position:absolute;left:60px;top:650px;font-size:130px;font-weight:900;letter-spacing:-.03em;color:#1d1a17">% 하루 만에</div>
<div style="position:absolute;left:60px;top:860px;background:#fff5e6;color:#1d1a17;font-size:88px;font-weight:900;padding:12px 36px;transform:rotate(2deg);display:inline-block;box-shadow:10px 10px 0 #1d1a17">올해만 26일째</div>
<div style="position:absolute;left:60px;top:1100px;font-size:66px;font-weight:700;color:#1d1a17;line-height:1.25">2000년 이후 104일.<br><span style="font-family:PEN;font-size:120px;color:#fff5e6;text-shadow:4px 4px 0 #1d1a17">1년 뒤엔?</span></div>
<div class="brand" style="color:#1d1a17"><b style="color:#fff5e6">luckyon</b> 넘버뷰 · 이번 주 숫자</div><div class="foot" style="color:#7a2e1c">과거 데이터 기반 · 투자 권유가 아닙니다</div>`;

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
for(const [n,fn] of Object.entries(pages)){await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body>${fn()}</body></html>`,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))));await page.screenshot({path:`frames4/${n}.png`});console.log(n);}
await browser.close(); console.log('done');
