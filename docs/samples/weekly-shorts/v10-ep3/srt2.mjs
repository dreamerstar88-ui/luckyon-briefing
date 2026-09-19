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
// 사건 자막은 매니페스트에서 만든다. 문구를 여기에 또 적으면 render2.mjs·매니페스트와
// 셋으로 갈라져, 한 곳만 고치는 사고가 구조적으로 계속 난다. 3회차에서 슈미트 직함을
// 화면·매니페스트·발행문구에서 지웠는데 이 배열만 남아 «연준 슈미트 위원 연설» 이
// 자막으로 나갈 뻔했다 — 지침서 9장 3번(화면만 고치고 자막을 두는 것)의 재발이었다.
const NUM='①②③④⑤⑥⑦⑧';
const KWD='일월화수목금토';
const drop=x=>String(x).replace(/\.$/,'');
const evCue=(e,k)=>{
  const [sess,kst]=e.kst_label.split(' · ');          // «금 장중» · «한국 토 새벽 12시 45분»
  const etDay=KWD[(new Date(e.et.replace(' ','T')+'Z').getUTCDay())];
  const kstDay=(kst||'').match(/한국 ([일월화수목금토])/);
  // 한국 요일이 미국 요일과 다르면 밤을 넘긴 것이라 헷갈린다 — 그때만 괄호로 밝힌다
  const note=(kstDay&&kstDay[1]!==sess.slice(0,1))?`(${kst})`:'';
  return [`${NUM[k]} ${sess}${note} · ${drop(e.l1)}`, drop(e.l2)];
};
const EVKO=M.events.map(evCue);
const EVEN=M.events.map((e,k)=>{
  const sess=e.kst_label.split(' · ')[0];
  const en=/장중/.test(sess)?'session':'pre-market';
  const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(e.et.replace(' ','T')+'Z').getUTCDay()];
  const [a,...b]=drop(e.en).split(', ');
  const tail=b.join(', ');
  return [`${k+1}) ${day} ${en} - ${a}`, tail?tail[0].toUpperCase()+tail.slice(1):'—'];
});
const KO=[
 ['지난주 나스닥, 월요일 개장 ~ 금요일 마감','결과는 +2.58%. 수요일에 3년 만의 첫 금리 인상이 있었다'],
 ...EVKO,
 ['지수를 움직인 건 기자회견이었다','금리 결정은 +0.11%, 기자회견은 -0.28%'],
 ['금리는 예상대로였고, 움직인 건 그 30분 뒤였다','몇 번 고르셨나요? 다음 주도 다시 돌려 드립니다'],
];
const EN=[
 ['Nasdaq 100 futures, Monday open to Friday close','The week ended +2.58%, with the first rate hike in three years'],
 ...EVEN,
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
