// make-preview.mjs
// 발행 전 사람이 폰으로 한 번에 검토할 수 있는 페이지를 만든다.
// 카카오톡은 텍스트 200자만 보낼 수 있으므로(이미지 첨부 불가), 링크 하나로 전부 보여주는 방식을 쓴다.
//
// 사용법: node scripts/chart-notes/make-preview.mjs <stamp>
//   예)   node scripts/chart-notes/make-preview.mjs 2026-08-09-ep02
//
// 산출물: cards/chart-notes/<stamp>/preview.html
//   → https://<PAGES_BASE_URL>/cards/chart-notes/<stamp>/preview.html 로 공개된다.
//
// 카드 이미지는 같은 디렉터리의 상대경로로 참조하므로 Pages 에 올라가면 바로 보인다.

import fs from 'node:fs';
import path from 'node:path';

const stamp = process.argv[2];
if (!stamp) { console.error('Usage: node scripts/chart-notes/make-preview.mjs <stamp>'); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const dataPath = path.join(root, 'content', 'chart-notes', `${stamp}.json`);
if (!fs.existsSync(dataPath)) { console.error(`❌ content/chart-notes/${stamp}.json 이 없습니다.`); process.exit(1); }
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const cardDir = path.join(root, 'cards', 'chart-notes', stamp);
const count = (lang) => {
  const p = path.join(cardDir, lang);
  return fs.existsSync(p) ? fs.readdirSync(p).filter(f => /^card\d+\.png$/.test(f)).length : 0;
};
const nKo = count('ko'), nEn = count('en');
if (!nKo && !nEn) { console.error(`❌ cards/chart-notes/${stamp}/ 에 카드가 없습니다. 먼저 렌더하세요.`); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

function section(lang, n) {
  if (!n) return `<p class="warn">⚠️ ${lang.toUpperCase()} 카드가 렌더되지 않았습니다.</p>`;
  const alts = (lang === 'ko' ? d.alt_ko : d.alt_en) || [];
  const cards = Array.from({ length: n }, (_, i) => `
    <figure>
      <img src="${lang}/card${i + 1}.png" alt="${esc(alts[i] || '')}" loading="lazy">
      <figcaption><b>p.${String(i + 1).padStart(2, '0')}</b> ${esc(alts[i] || '(대체 텍스트 없음)')}</figcaption>
    </figure>`).join('');
  const cap = lang === 'ko' ? d.caption_ko : d.caption_en;
  return `
    <h2>${lang === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English'} — ${n}장</h2>
    <div class="cards">${cards}</div>
    <h3>캡션 (${cap ? cap.length : 0}자)</h3>
    <div class="cap">${nl2br(cap)}</div>`;
}

const fc = d.fact_check || {};
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>검토 · ${esc(d.episode || '')} ${esc(d.term_ko || '')}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;padding:16px 14px 60px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
       background:#14140f;color:#f0efe6;line-height:1.6;max-width:760px;margin-inline:auto}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:19px;margin:34px 0 12px;padding-top:18px;border-top:1px solid #35342c}
  h3{font-size:16px;margin:20px 0 8px;color:#b9b6a8}
  .meta{font-size:14px;color:#9b9889;margin-bottom:18px}
  .chk{background:#1e1e18;border-left:4px solid #ddc158;border-radius:10px;padding:14px 16px;margin:18px 0;font-size:14px}
  .chk b{color:#ddc158}
  .chk li{margin:5px 0}
  .fact{background:#16211a;border-left:4px solid #3f8f6d;border-radius:10px;padding:14px 16px;margin:18px 0;font-size:14px}
  .fact b{color:#6fc79c}
  .cards{display:grid;grid-template-columns:1fr;gap:20px}
  @media(min-width:620px){.cards{grid-template-columns:1fr 1fr}}
  figure{margin:0}
  img{width:100%;height:auto;border-radius:8px;display:block;background:#000}
  figcaption{font-size:13px;color:#9b9889;margin-top:7px}
  figcaption b{color:#e0dfd4}
  .cap{white-space:normal;background:#1e1e18;border-radius:10px;padding:14px 16px;font-size:14px;color:#d9d7cb}
  .warn{background:#2a1a16;border-left:4px solid #c0523c;border-radius:10px;padding:14px 16px}
  footer{margin-top:40px;padding-top:16px;border-top:1px solid #35342c;font-size:13px;color:#7d7a6d}
  code{background:#26261e;padding:2px 7px;border-radius:5px;font-size:13px}
</style></head><body>

<h1>${esc(d.episode || '')} · ${esc(d.term_ko || '')}</h1>
<div class="meta">${esc(d.series || '주식 차트 3분 노트')} · 발행 예정 ${esc(d.date || '')} · stamp <code>${esc(stamp)}</code></div>

<div class="chk"><b>검토 체크리스트</b>
<ul>
  <li>개념 설명이 <b>사실로 맞는가</b> (정의·인과·용어)</li>
  <li>p.06 실제 시세의 <b>숫자와 날짜</b>가 맞는가</li>
  <li>카드 밖으로 <b>넘치거나 겹친 글자</b>가 없는가 (특히 영어)</li>
  <li><b>투자 권유</b>로 읽힐 문장이 없는가</li>
  <li>한국어 <b>맞춤법·띄어쓰기</b>, 영어판에 한글 잔존 없는가</li>
  <li>마지막 장의 <b>다음 편 예고</b>가 로드맵과 맞는가</li>
</ul></div>

${(fc.ko || fc.en) ? `<div class="fact"><b>시세 검증 기록</b>
${fc.ko ? `<div>KO — ${esc(fc.ko)}</div>` : ''}${fc.en ? `<div>EN — ${esc(fc.en)}</div>` : ''}</div>` : ''}

${section('ko', nKo)}
${section('en', nEn)}

<footer>
문제가 없으면 Claude 에게 <code>차트노트 ${esc(stamp)} 발행해</code> 라고 하세요.<br>
고칠 곳이 있으면 어느 카드의 무엇을 고칠지 알려주시면 다시 렌더해 이 페이지를 갱신합니다.<br>
※ 이 페이지는 검토용이며 인스타그램에는 올라가지 않습니다.
</footer>
</body></html>`;

const out = path.join(cardDir, 'preview.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out));
const base = (process.env.PAGES_BASE_URL || '').replace(/\/$/, '');
if (base) console.log(`\n🔗 ${base}/cards/chart-notes/${stamp}/preview.html`);
console.log(`\n카드: KO ${nKo}장 / EN ${nEn}장`);
