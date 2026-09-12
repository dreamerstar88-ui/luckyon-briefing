import fs from 'node:fs';
// 타임라인 상수는 scene.js 와 같아야 한다
const HOOK=[0,5.0], REPLAY=[5.0,26.2], ANSWER=[26.2,30.3], SUMM=[30.3,35.0];
const IDX=[42,260,556,831], N=903;                 // 봉 904개 → 마지막 인덱스 903
const HOLD=Math.min(1.8,7.2/IDX.length);           // scene.js buildSchedule 과 같은 식
const drawT=(REPLAY[1]-REPLAY[0])-HOLD*IDX.length;
const holds=[]; let prev=0,t=0;
for(const i of IDX){ t+=(i-prev)/N*drawT; holds.push(REPLAY[0]+t); t+=HOLD; prev=i; }
const cuts=[HOOK[0],HOOK[1],...holds.slice(1),ANSWER[0],SUMM[0],SUMM[1]];
const KO=[
 ['지난주 나스닥, 화요일 개장 ~ 금요일 마감','결과는 -0.88%. 고점은 화요일 개장 첫 5분이었다'],
 ['① 화 장중(한국 수 새벽 2시) · 3년물 국채 입찰 4.474%','직전은 4.291%였다'],
 ['② 수 프리장 · ADP 주간 고용 1.2만 명','직전은 1.0만이었다'],
 ['③ 목 장중 · 기존주택 판매 398만 채','예상도 398만이었다'],
 ['④ 금 장중 · 미시간 소비자심리 47.8','예상은 51이었다'],
 ['시가 위에서 끝난 5분봉은 0개','904개를 다 돌려봐도 하나도 없었다'],
 ['나흘 내내 종가가 시가를 넘지 못했다','몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다'],
];
const EN=[
 ['Nasdaq 100 futures, Tuesday open to Friday close','The week ended -0.88%. The high came in the first five minutes of Tuesday'],
 ['1) Tue session - 3-year Treasury auction yield 4.474%','Up from 4.291%'],
 ['2) Wed pre-market - ADP weekly employment change 12K','Up from 10K'],
 ['3) Thu session - Existing home sales 3.98M','The forecast was also 3.98M'],
 ['4) Fri session - Michigan consumer sentiment 47.8','The forecast was 51'],
 ['Bars that closed above the opening price: zero','Not one of 904 bars managed it'],
 ["Four trading days, and it never closed back above where it opened",'Which one did you pick? We\'ll replay next week too'],
];
if(KO.length!==cuts.length-1){console.error('자막 수와 구간 수가 안 맞는다',KO.length,cuts.length-1);process.exit(1);}
const ts=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${x.toFixed(3).padStart(6,'0').replace('.',',')}`;};
const build=L=>L.map((l,k)=>`${k+1}\n${ts(cuts[k])} --> ${ts(cuts[k+1])}\n${l.join('\n')}\n`).join('\n');
fs.writeFileSync('luckyon-nasdaq-week2.ko.srt',build(KO));
fs.writeFileSync('luckyon-nasdaq-week2.en.srt',build(EN));
console.log('정지시간',HOLD.toFixed(2),'초 · 그리는 시간',drawT.toFixed(2),'초');
console.log('구간 경계(초):',cuts.map(x=>x.toFixed(2)).join(' → '));
