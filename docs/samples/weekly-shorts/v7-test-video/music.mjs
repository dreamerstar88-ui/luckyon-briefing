// 넘버뷰 주간 되감기 배경음악 합성 — 영상 구조(훅/되감기/정답/요약)에 맞춘 스코어
import fs from 'node:fs';
const SR=48000, DUR=58.4, N=Math.round(SR*DUR);
const L=new Float64Array(N), R=new Float64Array(N);
const BAR=2.3, BEAT=BAR/4, EIGHTH=BEAT/2;              // 약 104.3 BPM
const S_HOOK=0, S_MAIN=4.6, S_PAY=46.0, S_OUT=52.9;    // 구간 경계(초)

const nt=(semi)=>440*Math.pow(2,(semi-9)/12);          // A4=440, semi: C4=0
// Am(A C E) F(F A C) C(C E G) G(G B D) — 2마디씩 반복
const PROG=[[9,12,16],[5,9,12],[0,4,7],[7,11,14]];
const chordAt=t=>PROG[Math.floor(t/(BAR*2))%4];

const clip=v=>Math.max(-1,Math.min(1,v));
const env=(t,a,d,s,r,dur)=>{ // ADSR
  if(t<0||t>dur)return 0;
  if(t<a)return t/a;
  if(t<a+d)return 1-(1-s)*(t-a)/d;
  if(t<dur-r)return s;
  return s*Math.max(0,(dur-t)/r);
};
function add(i,l,r){if(i>=0&&i<N){L[i]+=l;R[i]+=r;}}

// ── 저역통과 상태
function mkLP(){let y=0;return (x,a)=>{y+=a*(x-y);return y;}}

// ── 패드 (디튠 톱니 3개)
const padLP=[mkLP(),mkLP()];
for(let i=0;i<N;i++){
  const t=i/SR;
  const ch=chordAt(t);
  let g=0;
  if(t<S_MAIN) g=0.55*Math.min(1,t/2.5);
  else if(t<S_PAY) g=0.40;
  else if(t<S_OUT) g=0.62;
  else g=0.62*Math.max(0,(DUR-t)/(DUR-S_OUT));
  if(g<=0)continue;
  let s=0;
  for(const semi of ch){
    for(const det of [-0.09,0,0.09]){
      const f=nt(semi-12)*Math.pow(2,det/12);
      const ph=(t*f)%1;
      s+=(2*ph-1)*0.16;              // 톱니
    }
  }
  const cut=t<S_MAIN?0.05:(t<S_PAY?0.06+0.05*((t-S_MAIN)/(S_PAY-S_MAIN)):0.16);
  const a=padLP[0](s,cut), b=padLP[1](s,cut*0.92);
  add(i,a*g*0.34,b*g*0.34);
}

// ── 아르페지오 (되감기 구간, 8분음표)
const arpLP=mkLP();
for(let k=0;k*EIGHTH<DUR;k++){
  const t0=k*EIGHTH;
  if(t0<S_MAIN-0.3||t0>DUR-1.2)continue;
  const ch=chordAt(t0);
  const step=[0,1,2,1][k%4];
  const semi=ch[step]+12;
  const f=nt(semi);
  const build=t0<S_PAY?0.28+0.34*((t0-S_MAIN)/(S_PAY-S_MAIN)):0.72;
  const len=EIGHTH*0.9;
  const pan=(k%2)?0.62:0.38;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=env(t,0.004,0.09,0.28,0.06,len);
    let s=0;
    s+=Math.sin(2*Math.PI*f*t);
    s+=0.28*Math.sin(2*Math.PI*f*2*t);
    s+=0.14*(2*((t*f*1.005)%1)-1);
    s=arpLP(s,0.28);
    const v=s*e*0.085*build;
    add(i,v*(1-pan)*1.4,v*pan*1.4);
  }
}

// ── 베이스 (마디 첫박 + 3박)
for(let k=0;k*BEAT<DUR;k++){
  const t0=k*BEAT;
  if(t0<S_MAIN-0.3||t0>DUR-1.0)continue;
  if(k%4!==0&&k%4!==2)continue;
  const ch=chordAt(t0);
  const f=nt(ch[0]-24);
  const len=k%4===0?BEAT*1.7:BEAT*0.8;
  const g=t0<S_PAY?0.9:1.0;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=env(t,0.006,0.14,0.55,0.12,len);
    const s=Math.sin(2*Math.PI*f*t)+0.22*Math.sin(2*Math.PI*f*2*t);
    const v=s*e*0.30*g;
    add(i,v,v);
  }
}

// ── 킥 (되감기 구간, 1·3박)
for(let k=0;k*BEAT<DUR;k++){
  const t0=k*BEAT;
  if(t0<S_MAIN||t0>DUR-1.4)continue;
  if(k%4!==0&&k%4!==2)continue;
  const len=0.22;
  const g=t0<S_PAY?0.85:1.0;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const f=45+95*Math.exp(-t*38);
    const e=Math.exp(-t*17);
    const v=Math.sin(2*Math.PI*f*t)*e*0.42*g;
    add(i,v,v);
  }
}

// ── 하이햇 (8분, 되감기 후반부터)
let hatSeed=12345;
const rnd=()=>{hatSeed=(hatSeed*1103515245+12345)&0x7fffffff;return hatSeed/0x7fffffff*2-1;};
const hatHP=mkLP();
for(let k=0;k*EIGHTH<DUR;k++){
  const t0=k*EIGHTH;
  if(t0<S_MAIN+4.6||t0>DUR-1.6)continue;
  const len=0.055;
  const acc=(k%2===0)?0.55:1.0;
  const build=Math.min(1,(t0-(S_MAIN+4.6))/14);
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const n0=rnd();
    const lowp=hatHP(n0,0.62);
    const s=n0-lowp;                  // 간이 하이패스
    const v=s*Math.exp(-t*90)*0.052*acc*build;
    add(i,v*0.9,v*1.1);
  }
}

// ── 훅 벨 (0.15초, 큰 숫자 등장)
for(const [t0,semi,g] of [[0.15,21,0.30],[1.05,16,0.18],[2.55,24,0.14]]){
  const len=2.4, f=nt(semi);
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=Math.exp(-t*2.2);
    const s=Math.sin(2*Math.PI*f*t)+0.32*Math.sin(2*Math.PI*f*2.01*t)+0.12*Math.sin(2*Math.PI*f*3.02*t);
    const v=s*e*g*0.16;
    add(i,v*0.95,v*1.05);
  }
}

// ── 사건 정지 지점 임팩트 (되감기 중 5회) — 렌더러 일정과 맞춘 근사 시각
for(const t0 of [9.62,20.53,32.4,42.0,44.6]){
  const len=1.1;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=Math.exp(-t*6);
    const v=(Math.sin(2*Math.PI*(78*Math.exp(-t*5)+42)*t))*e*0.20;
    add(i,v,v);
  }
}

// ── 정답 임팩트 (46.0초)
{
  const t0=S_PAY, len=3.2;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=Math.exp(-t*2.4);
    const boom=Math.sin(2*Math.PI*(120*Math.exp(-t*7)+38)*t)*e*0.46;
    const nz=rnd()*Math.exp(-t*13)*0.10;
    add(i,boom+nz*0.9,boom+nz*1.1);
  }
}

// ── 마무리: 앞뒤 무음 여백 + 페이드 (기존 파이프라인 규칙과 동일한 취지)
const PAD=1.2;
for(let i=0;i<N;i++){
  const t=i/SR;
  let g=1;
  if(t<PAD) g*=t/PAD;                       // 앞 여백에서 서서히
  if(t>DUR-2.0) g*=Math.max(0,(DUR-t)/2.0); // 뒤 2초 페이드아웃
  L[i]*=g;R[i]*=g;
}
// 소프트 클리핑 + 정규화
let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
const norm=0.82/Math.max(peak,1e-9);
const buf=Buffer.alloc(44+N*4);
buf.write('RIFF',0);buf.writeUInt32LE(36+N*4,4);buf.write('WAVE',8);
buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);
buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);
buf.write('data',36);buf.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){
  const l=clip(Math.tanh(L[i]*norm*1.05)),r=clip(Math.tanh(R[i]*norm*1.05));
  buf.writeInt16LE(Math.round(l*32767),44+i*4);
  buf.writeInt16LE(Math.round(r*32767),46+i*4);
}
fs.writeFileSync('vid/bgm-raw.wav',buf);
console.log(`bgm-raw.wav 생성: ${DUR}초 ${SR}Hz 스테레오, 최대진폭 ${peak.toFixed(3)} → 정규화 0.82`);
