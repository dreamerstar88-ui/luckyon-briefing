import fs from 'node:fs';
// 타임라인 상수는 scene.js 와 같아야 한다. 사건 인덱스는 봉 데이터에서 직접 찾는다.
const HOOK=[0,5.0], REPLAY=[5.0,27.9], ANSWER=[27.9,32.0], SUMM=[32.0,35.0];
const SP='/tmp/claude-0/-home-user-luckyon-briefing/4df77974-546d-5987-a418-39f318dc6bbd/scratchpad';
const all=JSON.parse(fs.readFileSync(`${SP}/week3_5m.json`,'utf8'));
const B=all.filter(x=>'2026-09-14 09:30'<=x.d&&x.d<='2026-09-18 16:00');
const M=JSON.parse(fs.readFileSync('/home/user/luckyon-briefing/content/weekly-shorts/2026-09-14.json','utf8'));
const ET=M.events.map(e=>e.et);
const IDX=ET.map(d=>B.findIndex(x=>x.d===d));
if(IDX.some(i=>i<0)){console.error('사건 인덱스를 못 찾았다',IDX);process.exit(1);}
const N=B.length-1;
// 정지 시간 배분은 매니페스트가 갖고 있다. 공식을 두 곳에 두면 갈라진다.
const HS=M.video.holds;
if(HS.length!==IDX.length){console.error('정지 시간 개수가 사건 수와 다르다');process.exit(1);}
const budget=HS.reduce((a,b)=>a+b,0);
const drawT=(REPLAY[1]-REPLAY[0])-budget;
const holds=[]; let prev=0,t=0;
IDX.forEach((i,k)=>{ t+=(i-prev)/N*drawT; holds.push(REPLAY[0]+t); t+=HS[k]; prev=i; });
const cuts=[HOOK[0],HOOK[1],...holds.slice(1),ANSWER[0],SUMM[0],SUMM[1]];
const KO=[
 ['지난주 나스닥, 월요일 개장 ~ 금요일 마감','결과는 +2.58%. 수요일에 3년 만의 첫 금리 인상이 있었다'],
 ['① 월 장중(한국 화 새벽 12시 30분) · 6개월물 국채 입찰 4.060%','직전은 3.890%였다'],
 ['② 화 프리장 · 뉴욕 제조업 지수 7.6','예상은 14.75였다'],
 ['③ 수 프리장 · 소매판매 +1.2%','예상은 +0.8%였다'],
 ['④ 수 장중 · 기준금리 4.00%','예상도 4.00%였다'],
 ['⑤ 수 장중 · 연준 기자회견 시작','금리 결정 30분 뒤였다'],
 ['⑥ 목 프리장 · 주택 착공 127.5만 채','예상은 131만이었다'],
 ['⑦ 금 장중 · 연준 슈미트 위원 연설','이번 주 마지막 연준 발언이었다'],
 ['지수를 움직인 건 기자회견이었다','금리 결정은 +0.11%, 기자회견은 -0.28%'],
 ['금리는 예상대로였고, 움직인 건 그 30분 뒤였다','몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다'],
];
const EN=[
 ['Nasdaq 100 futures, Monday open to Friday close','The week ended +2.58%, with the first rate hike in three years'],
 ['1) Mon session - 6-month Treasury bill auction 4.060%','Up from 3.890%'],
 ['2) Tue pre-market - NY Empire State manufacturing 7.6','The forecast was 14.75'],
 ['3) Wed pre-market - Retail sales +1.2% MoM','The forecast was +0.8%'],
 ['4) Wed session - Fed sets rates at 4.00%','Matching the forecast'],
 ['5) Wed session - Fed press conference begins','Thirty minutes after the decision'],
 ['6) Thu pre-market - Housing starts 1.275M','The forecast was 1.31M'],
 ['7) Fri session - Fed Schmid speaks','The last Fed remarks of the week'],
 ['The press conference moved it, not the decision','The decision +0.11%, the press conference -0.28%'],
 ['Rates came in as expected. The move came 30 minutes later','Which one did you pick? We will replay next week too'],
];
if(KO.length!==cuts.length-1){console.error('자막 수와 구간 수가 안 맞는다',KO.length,cuts.length-1);process.exit(1);}
const ts=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${x.toFixed(3).padStart(6,'0').replace('.',',')}`;};
const build=L=>L.map((l,k)=>`${k+1}\n${ts(cuts[k])} --> ${ts(cuts[k+1])}\n${l.join('\n')}\n`).join('\n');
fs.writeFileSync(`${SP}/luckyon-nasdaq-week3.ko.srt`,build(KO));
fs.writeFileSync(`${SP}/luckyon-nasdaq-week3.en.srt`,build(EN));
console.log(`사건 ${IDX.length}개 · 정지 ${HS.map(h=>h.toFixed(2)).join('/')} · 그리기 ${drawT.toFixed(2)}초`);
console.log('구간 길이(초):',cuts.slice(1).map((c,i)=>(c-cuts[i]).toFixed(2)).join(' / '));
console.log('구간 경계(초):',cuts.map(x=>x.toFixed(2)).join(' → '));
