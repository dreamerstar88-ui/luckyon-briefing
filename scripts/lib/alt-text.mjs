// alt-text.mjs
// 카드별 Instagram alt_text(대체 텍스트)를 콘텐츠 JSON에서 만든다.
//
// 커스텀 alt_text 를 넘기지 않으면 인스타그램이 이미지 속 텍스트를 OCR로 읽어
// 자동 대체텍스트를 만드는데, 구글이 이걸 그대로 색인해 캡션 대신 원시 숫자
// (예: "6,690.62" kospi july 24 2026")로 검색 스니펫에 노출시키는 문제가 있었다.
// 카드별로 헤드라인 중심의 alt_text 를 직접 채워 이를 대체한다.
//
// 발행(publish-instagram.mjs)과 검증(verify-alt-text.mjs)이 같은 로직을 쓰도록
// 여기 한 곳에만 둔다 — 양쪽에 복사해두면 나중에 조용히 어긋난다.

// Graph API 의 alt_text 상한(1,000자) 대비 여유를 둔다.
const MAX = 900;

export function buildAltTexts(content, lang) {
  // 주말(sat·sun)은 sections 배열이 없는 고정 10장 편성이라 완전히 다른 필드를 읽는다.
  // sat 은 indexes[] 가, sun 은 week{} 가 있는 것으로 구분한다(둘 다 cover{} 는 공유).
  if (content.cover && Array.isArray(content.indexes)) return satAltTexts(content, lang);
  if (content.cover && content.week) return sunAltTexts(content, lang);
  return weekdayAltTexts(content, lang);
}

function weekdayAltTexts(content, lang) {
  const ko = lang === 'ko';
  const brief = ko ? 'luckyon 브리핑' : 'luckyon Briefing';
  const dateLabel = ko ? content.dateLabel_ko : content.dateLabel_en;
  const headline = ko ? content.headline_ko : content.headline_en;
  const headlineSub = ko ? content.headline_sub_ko : content.headline_sub_en;
  const nextBrief = ko ? content.next_brief_ko : content.next_brief_en;

  const marketsLabel = ko ? '주요 시장 지표: ' : 'Key market indicators: ';
  const econLabel = ko ? '경제·금융 뉴스: ' : 'Economy & finance news: ';
  const aiLabel = ko ? 'AI·테크 뉴스: ' : 'AI & tech news: ';
  const scheduleLabel = ko ? '주요 일정: ' : 'Upcoming schedule: ';

  const headlines = (arr, start) => (arr || []).slice(start, start + 3)
    .map(item => ko ? item.headline_ko : item.headline_en)
    .join(' / ');

  // 본문 카드는 render-cards.mjs 와 같은 규칙으로 센다 — sections 가 있으면 섹션당 한 장,
  // 없으면 기존 econ/ai 6+6 구성. 여기가 어긋나면 alt_text 가 엉뚱한 카드에 붙는다.
  //
  // 섹션 type 별로 읽는 필드가 다르다. 글 카드만 items 를 쓰고 stats/bars/rank 는
  // 각자 다른 배열에 내용이 들어 있으므로, items 만 보면 데이터 카드의 대체텍스트가
  // 제목만 남고 텅 빈다 (2026-08-04 확인 — 카드 ③④⑤가 실제로 비어 있었다).
  const t = (a, b) => (ko ? a : b);
  const sectionBody = s => {
    if (s.type === 'stats') {
      const tiles = (s.stats || []).map(x =>
        `${t(x.label_ko, x.label_en)} ${x.value}${x.delta ? ' ' + x.delta : ''}`);
      const breadth = (s.breadth || []).map(b =>
        `${t(b.label_ko, b.label_en)} ${t('상승', 'up')} ${b.up} / ${t('하락', 'down')} ${b.down}`);
      const flows = s.flows ? (s.flows.rows || []).map(r =>
        `${t(r.label_ko, r.label_en)} ${r.value > 0 ? '+' : ''}${r.value}${t(s.flows.unit_ko, s.flows.unit_en) || ''}`) : [];
      return [...tiles, ...breadth, ...flows].join(', ');
    }
    if (s.type === 'bars') {
      return (s.bars || []).map(b =>
        `${t(b.label_ko, b.label_en)} ${b.value > 0 ? '+' : ''}${b.value}%`).join(', ');
    }
    if (s.type === 'rank') {
      return (s.rows || []).map((r, i) =>
        `${i + 1}. ${t(r.name_ko, r.name_en)} ${r.value}${r.pct != null ? ` (${r.pct > 0 ? '+' : ''}${r.pct}%)` : ''}`).join(', ');
    }
    // type 이 없으면 글 카드 — 항목 수가 고정이 아니므로 slice 하지 않고 전부 넣는다.
    return (s.items || []).map(i => t(i.headline_ko, i.headline_en)).join(' / ');
  };
  const bodyAlts = Array.isArray(content.sections) && content.sections.length
    ? content.sections.map(s => {
      const label = (ko ? s.title_ko : s.title_en) || '';
      const body = sectionBody(s);
      const note = t(s.note_ko, s.note_en);
      // 수치만 나열하면 읽는 사람에게 맥락이 없다. note 가 있으면 한 줄 덧붙인다.
      return (label ? label + ': ' : '') + body + (note ? ' — ' + note : '');
    })
    : [
      econLabel + headlines(content.econ, 0),
      econLabel + headlines(content.econ, 3),
      aiLabel + headlines(content.ai, 0),
      aiLabel + headlines(content.ai, 3),
    ];

  const list = [
    `${brief} ${dateLabel}: ${headline}${headlineSub ? ' - ' + headlineSub : ''}`,
    marketsLabel + (content.markets || []).map(m =>
      `${m.label} ${m.value}${m.value_sub ? ' ' + m.value_sub : ''} ${m.delta}`).join(', '),
    ...bodyAlts,
  ];
  if (content.schedule && content.market_hours) {
    list.push(scheduleLabel + content.schedule
      .map(s => `${s.time} ${ko ? s.title_ko : s.title_en}`).join(' / '));
  }
  list.push(`${nextBrief || ''} · ${brief}`.trim());

  return list.map(s => s.length > MAX ? s.slice(0, MAX - 3) + '...' : s);
}

const trunc = list => list.map(s => s.length > MAX ? s.slice(0, MAX - 3) + '...' : s);

// 태그와 엔티티를 함께 푼다. &amp; 를 안 풀면 대체텍스트에 "S&amp;P 500" 이 그대로 읽히고,
// cover.headline 의 <br> 을 안 지우면 "물가와<br>실적" 처럼 태그가 그대로 노출된다.
const stripTags = s => String(s ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

// 토요일(sat) — 카드 순서: ①표지 ②지수 ③주간차트(②와 같은 데이터) ④지수 외 지표
// ⑤발표 결과 ⑥한 주를 움직인 것 ⑦섹터 등락 ⑧대형주 ⑨AI·반도체 ⑩아웃트로
// (FORMAT_BRIEFING.md §2-A 편성표와 순서를 맞춘다 — 어긋나면 대체텍스트가 엉뚱한 슬라이드에 붙는다)
function satAltTexts(content, lang) {
  const ko = lang === 'ko';
  const t = (a, b) => (ko ? a : b);
  const pct = v => `${v > 0 ? '+' : ''}${v}%`;
  const brief = ko ? 'luckyon 브리핑' : 'luckyon Briefing';
  const dateLabel = t(content.dateLabel_ko, content.dateLabel_en);
  const cov = content.cover || {};
  const hero = cov.hero || {};
  // est/act 는 한글 단위가 붙는 값만 _ko/_en 쌍을 갖는다(FORMAT_BRIEFING §4) — 언어에 맞는 쪽을 우선한다.
  const pair = (r, k) => t(r[`${k}_ko`] ?? r[k], r[`${k}_en`] ?? r[k]);
  const val = content.valuation?.rows?.length
    ? ' · PER ' + content.valuation.rows.map(r => `${t(r.name_ko, r.name_en)} ${r.per}`).join(', ')
    : '';

  const list = [
    `${brief} ${dateLabel}: ${stripTags(t(cov.headline_ko, cov.headline_en))}`
      + (hero.label_ko || hero.label_en ? ` — ${t(hero.label_ko, hero.label_en)} ${hero.value || ''}` : ''),
    t('지수 주간 등락: ', 'Index moves for the week: ') + (content.indexes || [])
      .map(x => `${t(x.name_ko, x.name_en)} ${x.close} ${pct(x.wk)}`).join(', ') + val,
    t('주간 일봉 차트: ', 'Daily candlestick charts: ') + (content.indexes || [])
      .map(x => `${t(x.name_ko, x.name_en)} ${t(x.hiLabel_ko, x.hiLabel_en) || ''} ${x.hi ?? ''}`.trim()).join(', '),
    t('지수 외 지표: ', 'Beyond the indexes: ') + (content.metrics || [])
      .map(m => `${t(m.name_ko, m.name_en)} ${m.value}${m.delta ? ' ' + m.delta : ''}`).join(', '),
    t('이번 주 발표 결과, 예상에서 실제로: ', 'Forecast to actual this week: ') + (content.calendar || [])
      .map(d => `${t(d.day_ko, d.day_en)} ` + (d.rows || [])
        .map(r => `${t(r.name_ko, r.name_en)} ${pair(r, 'est')}→${pair(r, 'act')}`).join(', ')).join(' / '),
    `${t(content.news?.title_ko, content.news?.title_en) || t('한 주를 움직인 것', 'What moved the week')}: `
      + (content.news?.items || []).map(i => t(i.headline_ko, i.headline_en)).join(' / '),
    t('주간 섹터 등락: ', 'Sector moves for the week: ') + (content.sectors || [])
      .map(s => `${t(s.label_ko, s.label_en)} ${pct(s.value)}`).join(', '),
    t('이번 주 많이 움직인 대형주: ', 'Biggest movers this week: ')
      + ['kr', 'us'].filter(k => content.movers?.[k]).map(k =>
        `${t(content.movers[k].head_ko, content.movers[k].head_en)} `
        + (content.movers[k].items || []).map(s => `${t(s.name_ko, s.name_en)} ${t(s.px_ko, s.px_en) || ''} ${pct(s.pct)}`).join(', ')
      ).join(' / '),
    `${t(content.ai?.title_ko, content.ai?.title_en) || 'AI'}: `
      + (content.ai?.items || []).map(i => t(i.headline_ko, i.headline_en)).join(' / '),
    `${t(content.outro?.next_ko, content.outro?.next_en) || ''} · ${brief}`.trim(),
  ];
  return trunc(list);
}

// 일요일(sun) — 카드 순서: ①표지 ②주말 사이 소식 ③다음 주 캘린더 ④미국·글로벌 지표
// ⑤다음 주 실적 ⑥한국 다음 주 ⑦AI·반도체 ⑧놓치면 안 될 것 ⑨다음 주 출발선 ⑩아웃트로
// (FORMAT_BRIEFING.md §2-B 편성표와 순서를 맞춘다)
function sunAltTexts(content, lang) {
  const ko = lang === 'ko';
  const t = (a, b) => (ko ? a : b);
  const brief = ko ? 'luckyon 브리핑' : 'luckyon Briefing';
  const dateLabel = t(content.dateLabel_ko, content.dateLabel_en);
  const cov = content.cover || {};
  const hero = cov.hero || {};
  const newsBlock = (s, fallbackKo, fallbackEn) => (t(s?.title_ko, s?.title_en) || t(fallbackKo, fallbackEn)) + ': '
    + (s?.items || []).map(i => t(i.headline_ko, i.headline_en)).join(' / ');

  const list = [
    `${brief} ${dateLabel}: ${stripTags(t(cov.headline_ko, cov.headline_en))}`
      + (hero.label_ko || hero.label_en ? ` — ${t(hero.label_ko, hero.label_en)} ${hero.value || ''}` : ''),
    newsBlock(content.weekend, '주말 사이 소식', 'Over the weekend'),
    t('다음 주 캘린더: ', 'Next week calendar: ') + (content.week?.days || [])
      .map(d => `${t(d.day_ko, d.day_en)} — ` + (d.rows || []).map(r => t(r.name_ko, r.name_en)).join(', ')).join(' / '),
    t('미국·글로벌 지표 (직전치 → 컨센서스): ', 'US & global data (prior → consensus): ') + (content.econ?.rows || [])
      .map(r => `${t(r.name_ko, r.name_en)} ${r.prev} → ${r.est}`).join(', '),
    t('다음 주 실적 (전년 동기 → 컨센서스): ', 'Earnings ahead (year-ago → consensus): ') + (content.earnings?.items || [])
      .map(i => `${t(i.name_ko, i.name_en)} ${i.epsPrev} → ${i.eps}`).join(', '),
    newsBlock(content.korea, '한국 다음 주', 'Korea next week'),
    newsBlock(content.ai, 'AI · 반도체', 'AI & semiconductors'),
    newsBlock(content.watch, '놓치면 안 될 것', "Don't miss"),
    t('다음 주 출발선 (금요일 마감): ', "Where next week starts (Friday's close): ") + (content.start?.indexes || [])
      .map(x => `${t(x.name_ko, x.name_en)} ${x.close} (${x.wk > 0 ? '+' : ''}${x.wk}%)`).join(', ')
      + ', ' + (content.start?.metrics || []).map(m => `${t(m.name_ko, m.name_en)} ${m.value}`).join(', '),
    `${t(content.outro?.next_ko, content.outro?.next_en) || ''} · ${brief}`.trim(),
  ];
  return trunc(list);
}
