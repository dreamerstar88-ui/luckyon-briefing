import fs from 'fs';
const html=fs.readFileSync('cal_prev.html','utf8');
const rows=html.split(/<tr\s+data-url=/).slice(1);
const val=(r,id)=>{const m=r.match(new RegExp(`id='${id}'[^>]*>([\\s\\S]*?)<`));return m?m[1].replace(/&nbsp;/g,'').trim():'';};
const ev=[];
for(const r of rows){
  const em=r.match(/data-event="([^"]*)"/); if(!em)continue;
  const dm=r.match(/<td[^>]*class='\s*(\d{4}-\d{2}-\d{2})'/);
  const sm=r.match(/<span class="event-\d+ calendar-date-(\d)">\s*([\s\S]*?)<\/span>/);
  if(!dm||!sm)continue;
  const tm=sm[2].trim().match(/(\d{2}):(\d{2})\s*(AM|PM)/); if(!tm)continue;
  let hh=+tm[1]%12; if(tm[3]==='PM')hh+=12;
  ev.push({name:em[1].trim(),imp:+sm[1],date:dm[1],utc:`${dm[1]} ${String(hh).padStart(2,'0')}:${tm[2]}`,
           actual:val(r,'actual'),consensus:val(r,'consensus'),previous:val(r,'previous')});
}
const bars=JSON.parse(fs.readFileSync('us5m_nqf.json','utf8'));
const arr=bars.filter(b=>b.d>='2026-09-08 09:30'&&b.d<='2026-09-11 16:00');
const chg=[]; for(let i=1;i<arr.length;i++)chg.push({d:arr[i].d,pct:(arr[i].c/arr[i-1].c-1)*100});
const sorted=[...chg].sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
const rank=new Map(); sorted.forEach((x,i)=>rank.set(x.d,i+1));
const byD=new Map(chg.map(x=>[x.d,x.pct]));
const pad=n=>String(n).padStart(2,'0');
const shift=(s,h)=>{const d=new Date(s.replace(' ','T')+'Z');d.setUTCHours(d.getUTCHours()+h);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;};
const DOW=['일','월','화','수','목','금','토'];
for(const e of ev){e.et=shift(e.utc,-4);e.kst=shift(e.utc,9);e.pct=byD.get(e.et);e.rank=rank.get(e.et);
  e.dow=DOW[new Date(e.et.replace(' ','T')+'Z').getUTCDay()];
  const hm=e.et.slice(11); e.session=(hm>='09:30'&&hm<'16:00')?'장중':(hm<'09:30'?'프리':'애프터');}
const inWin=ev.filter(e=>e.et>='2026-09-08 09:30'&&e.et<='2026-09-11 16:00');
const g=new Map(); for(const e of inWin){(g.get(e.et)||g.set(e.et,[]).get(e.et)).push(e);}
const groups=[...g.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([et,list])=>{
  const maxImp=Math.max(...list.map(x=>x.imp));
  return {et,dow:list[0].dow,kst:list[0].kst,session:list[0].session,imp:maxImp,
    heads:list.filter(x=>x.imp===maxImp).map(x=>({n:x.name,a:x.actual,c:x.consensus,p:x.previous})),
    n:list.length,pct:list[0].pct,rank:list[0].rank};
});
fs.writeFileSync('events2_collapsed.json',JSON.stringify(groups,null,1));
console.log(`전체행 ${ev.length} · 구간내 ${inWin.length} · 타임스탬프 ${groups.length} · 봉 ${arr.length}`);
console.log('─'.repeat(110));
for(const x of groups){
  const s=`${x.dow} ${x.kst.slice(5,10)} ${x.kst.slice(11)}KST ${x.session} | ${'★'.repeat(x.imp)}${'·'.repeat(3-x.imp)} | ${x.pct===undefined?'   —  ':(x.pct>=0?'+':'')+x.pct.toFixed(2)+'%'} ${x.rank?String(x.rank).padStart(4):'   -'}위 | (${x.n})`;
  console.log(s+' '+x.heads.map(h=>`${h.n} [실 ${h.a||'-'} / 예 ${h.c||'-'} / 전 ${h.p||'-'}]`).join(' // '));
}
