import fs from 'node:fs';
// 영상 타임라인과 같은 값을 쓴다 (scene.js / render.mjs 와 일치)
const HOOK=[0,5.0], REPLAY=[5.0,26.2], ANSWER=[26.2,30.3], SUMM=[30.3,35.0];
const HOLD=1.5, IDX=[12,281,556,831,1088], N=1178;
const total=REPLAY[1]-REPLAY[0], drawT=total-HOLD*IDX.length;
// 각 사건의 정지 시작 시각(절대 초)
const holds=[]; let prev=0,t=0;
for(const i of IDX){ t+=(i-prev)/N*drawT; holds.push(REPLAY[0]+t); t+=HOLD; prev=i; }
// 자막 구간: 사건 라벨이 화면에 떠 있는 동안
const cuts=[HOOK[0],HOOK[1],...holds.slice(1),ANSWER[0],SUMM[0],SUMM[1]];
const KO=[
 ['지난주 나스닥, 월요일 개장 ~ 금요일 마감','결과는 +0.36%. 그 사이 최대 낙폭은?'],
 ['① 월 밤 11시 30분 · 댈러스 연은 제조업 11.6','직전 1.3에서 급등했지만 지수는 무반응'],
 ['② 화 밤 11시 · ISM 제조업 54.6','예상 55.2를 밑돌았지만 역시 무반응'],
 ['③ 수 밤 11시 · 7월 공장주문 +0.9%','예상 +0.6%을 넘겼다'],
 ['④ 목 밤 11시 · ISM 서비스업 55.4','예상 54.3을 넘겼는데 지수는 하락'],
 ['⑤ 금 저녁 9시 30분 · 8월 고용 16.2만 명','예상은 5.6만이었다. 5분 만에 -0.41%'],
 ['정답은 -2.18%','고점 29,571에서 저점 28,927까지'],
 ['이번 주 바닥도 꼭대기도 한국 저녁에 나왔다','몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다'],
];
const EN=[
 ['Nasdaq 100 futures, Monday open to Friday close','The week ended +0.36%. How deep was the drawdown?'],
 ['1) Mon 11:30 PM KST - Dallas Fed Manufacturing 11.6','Up from 1.3, and the index did not react'],
 ['2) Tue 11:00 PM KST - ISM Manufacturing 54.6','Below the 55.2 forecast, still no reaction'],
 ['3) Wed 11:00 PM KST - July factory orders +0.9%','Above the +0.6% forecast'],
 ['4) Thu 11:00 PM KST - ISM Services 55.4','Beat the 54.3 forecast, but the index fell'],
 ['5) Fri 9:30 PM KST - August payrolls 162K','Forecast was 56K. Down 0.41% in five minutes'],
 ['The answer: -2.18%','From a 29,571 peak to a 28,927 trough'],
 ["The week's low and high both landed in Korean evening hours",'Which one did you pick? See you next week'],
];
const ts=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${x.toFixed(3).padStart(6,'0').replace('.',',')}`;};
const build=L=>L.map((l,k)=>`${k+1}\n${ts(cuts[k])} --> ${ts(cuts[k+1])}\n${l.join('\n')}\n`).join('\n');
fs.writeFileSync('luckyon-nasdaq-week.ko.srt',build(KO));
fs.writeFileSync('luckyon-nasdaq-week.en.srt',build(EN));
console.log('구간 경계(초):',cuts.map(x=>x.toFixed(2)).join(' → '));
console.log('\n--- 영어 자막 ---\n'+build(EN));
