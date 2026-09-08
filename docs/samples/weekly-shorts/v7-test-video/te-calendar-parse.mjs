import fs from 'fs';
const html = fs.readFileSync('b.html','utf8');
const rows = html.split(/<tr\b/).slice(1);
const ev=[];
for(const r of rows){
  const em = r.match(/data-event="([^"]*)"/); if(!em) continue;
  const dm = r.match(/<td[^>]*class='\s*(\d{4}-\d{2}-\d{2})'/);
  const sm = r.match(/<span class="event-\d+ calendar-date-(\d)">\s*([\s\S]*?)<\/span>/);
  if(!dm||!sm) continue;
  const tm = sm[2].trim().match(/(\d{2}):(\d{2})\s*(AM|PM)/);
  if(!tm) continue;
  let hh=+tm[1]%12; if(tm[3]==='PM') hh+=12;
  ev.push({name:em[1].trim(), imp:+sm[1], date:dm[1], utc:`${dm[1]} ${String(hh).padStart(2,'0')}:${tm[2]}`});
}
// 5-min bars
const bars = JSON.parse(fs.readFileSync('us5m_nqf.json','utf8'));
const arr = bars.filter(b=>b.d>='2026-08-31 09:30' && b.d<='2026-09-04 16:00');
const chg = [];
for(let i=1;i<arr.length;i++) chg.push({d:arr[i].d, pct:(arr[i].c/arr[i-1].c-1)*100});
const sorted=[...chg].sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
const rank=new Map(); sorted.forEach((x,i)=>rank.set(x.d,i+1));
const byD=new Map(chg.map(x=>[x.d,x.pct]));
const pad=n=>String(n).padStart(2,'0');
const shift=(s,h)=>{const d=new Date(s.replace(' ','T')+'Z'); d.setUTCHours(d.getUTCHours()+h); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;};
const DOW=['일','월','화','수','목','금','토'];
for(const e of ev){ e.et=shift(e.utc,-4); e.kst=shift(e.utc,9);
  e.pct=byD.get(e.et); e.rank=rank.get(e.et);
  e.dow=DOW[new Date(e.et.replace(' ','T')+'Z').getUTCDay()];
}
// collapse by ET timestamp
const g=new Map();
for(const e of ev){ if(!g.has(e.et)) g.set(e.et,[]); g.get(e.et).push(e); }
const groups=[...g.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([et,list])=>{
  const maxImp=Math.max(...list.map(x=>x.imp));
  const heads=list.filter(x=>x.imp===maxImp).map(x=>x.name);
  return {et,dow:list[0].dow,kst:list[0].kst,imp:maxImp,heads,n:list.length,pct:list[0].pct,rank:list[0].rank};
});
fs.writeFileSync('events_collapsed.json',JSON.stringify(groups,null,1));
console.log('rows',ev.length,'groups',groups.length,'bars',arr.length,'chg',chg.length);
for(const x of groups){
  console.log(`${x.dow} ${x.kst.slice(11)} KST | ${'★'.repeat(x.imp)}${'　'.repeat(3-x.imp)} | ${x.pct===undefined?'  —   ':(x.pct>=0?'+':'')+x.pct.toFixed(2)+'%'} | ${x.rank?String(x.rank).padStart(4):'   -'}위 | (${x.n}) ${x.heads.join(' / ')}`);
}
