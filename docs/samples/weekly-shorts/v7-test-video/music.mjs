// 넘버뷰 주간 되감기 배경음악 v2 — 30초, 영상 구간에 맞춘 스코어
// 오실레이터 합성. 외부 음원·샘플을 쓰지 않으므로 저작권 문제가 없다.
import fs from 'node:fs';
const SR=48000, DUR=30.0, N=Math.round(SR*DUR);
const L=new Float64Array(N), R=new Float64Array(N);
const BAR=2.4, BEAT=BAR/4;                       // 100 BPM
const T_HOOK=0, T_MAIN=2.6, T_PAY=21.8, T_OUT=25.6;
const EV=[4.95,9.93,14.86,19.29];                // 사건 정지 시각
const nt=s=>440*Math.pow(2,(s-9)/12);
const PROG=[[9,12,16],[5,9,12],[0,4,7],[7,11,14]];   // Am F C G
const chordAt=t=>PROG[Math.floor(t/BAR)%4];
const clip=v=>Math.max(-1,Math.min(1,v));
const mkLP=()=>{let y=0;return (x,a)=>{y+=a*(x-y);return y;}};
function add(i,l,r){if(i>=0&&i<N){L[i]+=l;R[i]+=r;}}
let sd=987654321;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff*2-1;};

// ── 패드
const padLP=[mkLP(),mkLP()];
for(let i=0;i<N;i++){
  const t=i/SR, ch=chordAt(t);
  let g;
  if(t<T_MAIN) g=0.62*Math.min(1,t/1.6);
  else if(t<T_PAY) g=0.42;
  else if(t<T_OUT) g=0.78;
  else g=0.78*Math.max(0,(DUR-t)/(DUR-T_OUT));
  let s=0;
  for(const semi of ch) for(const det of [-0.08,0,0.08]) s+=(2*((t*nt(semi-12)*Math.pow(2,det/12))%1)-1)*0.16;
  const cut=t<T_MAIN?0.045:(t<T_PAY?0.055+0.06*((t-T_MAIN)/(T_PAY-T_MAIN)):0.18);
  add(i,padLP[0](s,cut)*g*0.32,padLP[1](s,cut*0.9)*g*0.32);
}
// ── 아르페지오
const arpLP=mkLP();
for(let k=0;k*BEAT/2<DUR;k++){
  const t0=k*BEAT/2;
  if(t0<T_MAIN-0.2||t0>DUR-1.0)continue;
  const ch=chordAt(t0), semi=ch[[0,1,2,1][k%4]]+12, f=nt(semi);
  const build=t0<T_PAY?0.30+0.40*((t0-T_MAIN)/(T_PAY-T_MAIN)):0.78;
  const len=BEAT/2*0.9, pan=(k%2)?0.62:0.38;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=t<0.004?t/0.004:Math.max(0,Math.exp(-t*9)*(1-t/len)+0.08);
    let s=Math.sin(2*Math.PI*f*t)+0.26*Math.sin(2*Math.PI*f*2*t)+0.12*(2*((t*f*1.005)%1)-1);
    s=arpLP(s,0.30);
    const v=s*e*0.082*build;
    add(i,v*(1-pan)*1.4,v*pan*1.4);
  }
}
// ── 베이스
for(let k=0;k*BEAT<DUR;k++){
  const t0=k*BEAT;
  if(t0<T_MAIN-0.2||t0>DUR-0.8)continue;
  if(k%4!==0&&k%4!==2)continue;
  const f=nt(chordAt(t0)[0]-24), len=k%4===0?BEAT*1.7:BEAT*0.8;
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const e=(t<0.006?t/0.006:1)*Math.max(0,Math.min(1,(len-t)/0.12))*(0.55+0.45*Math.exp(-t*4));
    const v=(Math.sin(2*Math.PI*f*t)+0.22*Math.sin(2*Math.PI*f*2*t))*e*0.30;
    add(i,v,v);
  }
}
// ── 킥
for(let k=0;k*BEAT<DUR;k++){
  const t0=k*BEAT;
  if(t0<T_MAIN||t0>DUR-1.2)continue;
  if(k%4!==0&&k%4!==2)continue;
  for(let j=0;j<0.22*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const v=Math.sin(2*Math.PI*(45+95*Math.exp(-t*38))*t)*Math.exp(-t*17)*0.42*(t0<T_PAY?0.85:1.0);
    add(i,v,v);
  }
}
// ── 하이햇
const hatLP=mkLP();
for(let k=0;k*BEAT/2<DUR;k++){
  const t0=k*BEAT/2;
  if(t0<T_MAIN+3.0||t0>DUR-1.4)continue;
  const build=Math.min(1,(t0-(T_MAIN+3.0))/7);
  const acc=(k%2===0)?0.55:1.0;
  for(let j=0;j<0.055*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const n0=rnd(), s=n0-hatLP(n0,0.62);
    const v=s*Math.exp(-t*90)*0.050*acc*build;
    add(i,v*0.9,v*1.1);
  }
}
// ── 훅 벨
for(const [t0,semi,g] of [[0.10,21,0.32],[0.85,16,0.18]]){
  const f=nt(semi);
  for(let j=0;j<2.2*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const s=Math.sin(2*Math.PI*f*t)+0.32*Math.sin(2*Math.PI*f*2.01*t)+0.12*Math.sin(2*Math.PI*f*3.02*t);
    const v=s*Math.exp(-t*2.4)*g*0.16;
    add(i,v*0.95,v*1.05);
  }
}
// ── 사건 정지 지점 (짧은 저역 임팩트)
for(const t0 of EV){
  for(let j=0;j<0.9*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR;
    const v=Math.sin(2*Math.PI*(72*Math.exp(-t*5)+40)*t)*Math.exp(-t*6.5)*0.20;
    add(i,v,v);
  }
}
// ── 정답 직전 상승음 (20.3 ~ 21.8초)
{
  const t0=20.3, len=T_PAY-t0;
  const rLP=mkLP();
  for(let j=0;j<len*SR;j++){
    const i=Math.round(t0*SR)+j, t=j/SR, p=t/len;
    const n0=rnd();
    const s=n0-rLP(n0,0.55-0.42*p);           // 점점 밝아지는 잡음
    const v=s*Math.pow(p,1.7)*0.16;
    add(i,v*0.9,v*1.1);
  }
}
// ── 정답 임팩트
{
  for(let j=0;j<3.0*SR;j++){
    const i=Math.round(T_PAY*SR)+j, t=j/SR;
    const e=Math.exp(-t*2.2);
    const boom=Math.sin(2*Math.PI*(125*Math.exp(-t*7)+38)*t)*e*0.48;
    const nz=rnd()*Math.exp(-t*12)*0.10;
    add(i,boom+nz*0.9,boom+nz*1.1);
  }
}
// ── 앞 여백 / 뒤 페이드
const PAD=0.9;
for(let i=0;i<N;i++){
  const t=i/SR;let g=1;
  if(t<PAD)g*=t/PAD;
  if(t>DUR-1.8)g*=Math.max(0,(DUR-t)/1.8);
  L[i]*=g;R[i]*=g;
}
let peak=0;for(let i=0;i<N;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
const norm=0.82/Math.max(peak,1e-9);
const buf=Buffer.alloc(44+N*4);
buf.write('RIFF',0);buf.writeUInt32LE(36+N*4,4);buf.write('WAVE',8);
buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);
buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);
buf.write('data',36);buf.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){
  buf.writeInt16LE(Math.round(clip(Math.tanh(L[i]*norm*1.05))*32767),44+i*4);
  buf.writeInt16LE(Math.round(clip(Math.tanh(R[i]*norm*1.05))*32767),46+i*4);
}
fs.writeFileSync('vid/bgm-raw.wav',buf);
console.log(`bgm-raw.wav: ${DUR}초 · 사건 임팩트 ${EV.join(', ')} · 정답 ${T_PAY}초`);
