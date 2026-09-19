import fs from 'node:fs';
// 타임라인 상수는 scene.js 와 같아야 한다. 사건 인덱스는 봉 데이터에서 직접 찾는다.
const HOOK=[0,5.0], REPLAY=[5.0,26.2], ANSWER=[26.2,30.3], SUMM=[30.3,35.0];
const SP='/tmp/claude-0/-home-user-luckyon-briefing/4df77974-546d-5987-a418-39f318dc6bbd/scratchpad';
const all=JSON.parse(fs.readFileSync(`${SP}/us5m_nqf.json`,'utf8'));
const B=all.filter(x=>'2026-09-08 09:30'<=x.d&&x.d<='2026-09-11 16:00');
const ET=['2026-09-08 13:00','2026-09-09 08:15','2026-09-10 08:30',
          '2026-09-10 10:00','2026-09-11 08:30','2026-09-11 10:00'];
const IDX=ET.map(d=>B.findIndex(x=>x.d===d));
if(IDX.some(i=>i<0)){console.error('사건 인덱스를 못 찾았다',IDX);process.exit(1);}
const N=B.length-1;
const HOLD=Math.min(1.8,9.0/IDX.length);
const drawT=(REPLAY[1]-REPLAY[0])-HOLD*IDX.length;
// 배분은 매니페스트가 갖고 있다. 공식을 두 곳에 두면 갈라진다.
const M=JSON.parse(fs.readFileSync('/home/user/luckyon-briefing/content/weekly-shorts/2026-09-08.json','utf8'));
const HS=M.video.holds;
if(HS.length!==IDX.length){console.error('정지 시간 개수가 사건 수와 다르다');process.exit(1);}
const holds=[]; let prev=0,t=0;
IDX.forEach((i,k)=>{ t+=(i-prev)/N*drawT; holds.push(REPLAY[0]+t); t+=HS[k]; prev=i; });
const cuts=[HOOK[0],HOOK[1],...holds.slice(1),ANSWER[0],SUMM[0],SUMM[1]];
const KO=[
 ['지난주 나스닥, 화요일 개장 ~ 금요일 마감','결과는 -0.88%. 지표 발표는 여섯 번 있었다'],
 ['① 화 장중(한국 수 새벽 2시) · 3년물 국채 입찰 4.474%','직전은 4.291%였다'],
 ['② 수 프리장 · ADP 주간 고용 1.2만 명','직전은 1.0만이었다'],
 ['③ 목 프리장 · 생산자물가 +0.4%','직전은 +0.1%였다'],
 ['④ 목 장중 · 기존주택 판매 398만 채','예상도 398만이었다'],
 ['⑤ 금 프리장 · 근원 소비자물가 +0.3%','예상은 +0.2%였다'],
 ['⑥ 금 장중 · 미시간 소비자심리 47.8','예상은 51이었다'],
 ['가장 크게 움직인 건 생산자물가 PPI','발표 5분 만에 -0.43%, 그 주 1위'],
 ['지표 여섯 번 중 가장 세게 때린 건 이것이었다','몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다'],
];
const EN=[
 ['Nasdaq 100 futures, Tuesday open to Friday close','The week ended -0.88%. Six scheduled releases landed'],
 ['1) Tue session - 3-year Treasury auction 4.474%','Up from 4.291%'],
 ['2) Wed pre-market - ADP weekly employment 12K','Up from 10K'],
 ['3) Thu pre-market - Producer prices +0.4% MoM','Up from +0.1%'],
 ['4) Thu session - Existing home sales 3.98M','Matching the forecast'],
 ['5) Fri pre-market - Core CPI +0.3% MoM','The forecast was +0.2%'],
 ['6) Fri session - Michigan consumer sentiment 47.8','The forecast was 51'],
 ['The biggest mover was producer prices','-0.43% in five minutes, the largest of the week'],
 ['Of six releases, this one hit hardest','Which one did you pick? We will replay next week too'],
];
if(KO.length!==cuts.length-1){console.error('자막 수와 구간 수가 안 맞는다',KO.length,cuts.length-1);process.exit(1);}
const ts=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${x.toFixed(3).padStart(6,'0').replace('.',',')}`;};
const build=L=>L.map((l,k)=>`${k+1}\n${ts(cuts[k])} --> ${ts(cuts[k+1])}\n${l.join('\n')}\n`).join('\n');
fs.writeFileSync(`${SP}/luckyon-nasdaq-week2.ko.srt`,build(KO));
fs.writeFileSync(`${SP}/luckyon-nasdaq-week2.en.srt`,build(EN));
console.log(`사건 ${IDX.length}개 · 정지 ${HS.map(h=>h.toFixed(2)).join('/')} · 그리기 ${drawT.toFixed(2)}초`);
console.log('구간 길이(초):',cuts.slice(1).map((c,i)=>(c-cuts[i]).toFixed(2)).join(' / '));
console.log('구간 경계(초):',cuts.map(x=>x.toFixed(2)).join(' → '));
