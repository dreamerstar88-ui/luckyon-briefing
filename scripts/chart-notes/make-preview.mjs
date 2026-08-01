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

// ---------- 승인/수정 버튼 ----------
// 정적 페이지라 입력을 직접 받을 수 없다. 대신 GitHub Issue 를 우편함으로 쓴다:
// 버튼을 누르면 제목·본문이 미리 채워진 이슈 작성 화면이 열리고, 사용자는 제출만 하면 된다.
// 그 이슈를 "차트노트 승인 확인" 루틴(ROUTINE_PROMPT_CHARTNOTES_APPROVE.md)이 읽고 처리한다.
const base = (process.env.PAGES_BASE_URL || '').replace(/\/$/, '');
const m = base.match(/^https:\/\/([^.]+)\.github\.io\/([^/]+)/);
const slug = process.env.REPO_SLUG || (m ? `${m[1]}/${m[2]}` : '');
const issueUrl = (title, body) =>
  `https://github.com/${slug}/issues/new?labels=chartnotes&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

const actions = slug ? `
<div class="act">
  <a class="btn ok" href="${issueUrl(`[발행] ${stamp}`,
    `이 회차를 인스타그램에 발행해 주세요.\n\n(추가로 남길 말이 있으면 여기에 적어주세요. 없으면 그대로 제출하시면 됩니다.)\n\n---\nstamp: ${stamp}\n${d.episode || ''} ${d.term_ko || ''}`)}" target="_blank" rel="noopener">✅ 발행 승인</a>
  <a class="btn fix" href="${issueUrl(`[수정] ${stamp}`,
    `아래에 고칠 곳을 적어주세요. 어느 카드(p.01~p.08)의 무엇인지 알려주시면 됩니다.\n\n예)\n- p.06 한국어 종가 숫자가 틀렸어요\n- p.03 영어 카드 마지막 줄이 넘쳐요\n- p.05 설명이 어려워요, 더 쉽게\n\n고칠 곳:\n- \n\n---\nstamp: ${stamp}\n${d.episode || ''} ${d.term_ko || ''}`)}" target="_blank" rel="noopener">✏️ 수정 요청</a>
</div>
<p class="hint">버튼을 누르면 GitHub 이슈 작성 화면이 열립니다. 내용은 미리 채워져 있으니 <b>제출(Submit)</b>만 누르시면 됩니다.<br>
제출하면 다음 확인 루틴이 읽고 처리한 뒤, 결과를 카카오톡으로 알려드립니다.</p>` : '';
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
  .act{display:flex;gap:12px;margin:22px 0 10px}
  .btn{flex:1;display:block;text-align:center;padding:18px 10px;border-radius:12px;
       font-size:17px;font-weight:800;text-decoration:none}
  .btn.ok{background:#2f7d5b;color:#fff}
  .btn.fix{background:#8a4436;color:#fff}
  .hint{font-size:13px;color:#9b9889;margin:0 0 6px}
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

${actions}

${(fc.ko || fc.en) ? `<div class="fact"><b>시세 검증 기록</b>
${fc.ko ? `<div>KO — ${esc(fc.ko)}</div>` : ''}${fc.en ? `<div>EN — ${esc(fc.en)}</div>` : ''}</div>` : ''}

${section('ko', nKo)}
${section('en', nEn)}

${actions}

<footer>
버튼 대신 Claude 에게 직접 <code>차트노트 ${esc(stamp)} 발행해</code> 라고 해도 됩니다.<br>
※ 이 페이지는 검토용이며 인스타그램에는 올라가지 않습니다.
</footer>
</body></html>`;

const out = path.join(cardDir, 'preview.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out));
if (base) console.log(`\n🔗 ${base}/cards/chart-notes/${stamp}/preview.html`);
console.log(`\n카드: KO ${nKo}장 / EN ${nEn}장`);
if (!slug) console.warn('\n⚠️  PAGES_BASE_URL 로 저장소를 못 알아내 승인/수정 버튼이 빠졌습니다. REPO_SLUG 를 지정하세요.');
