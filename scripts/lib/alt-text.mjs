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
  const ko = lang === 'ko';
  const brief = ko ? 'luckyon 브리핑' : 'luckyon Briefing';
  const dateLabel = ko ? content.dateLabel_ko : content.dateLabel_en;

  // 토요일(sat)은 카드 편성이 완전히 달라 별도 경로로 만든다.
  // 아래 평일·sun 경로를 그대로 태우면 `content.ai` 가 배열이 아니라 객체라서
  // `.slice` 에서 TypeError 로 죽는다 — 발행 자체가 멈춘다.
  if (content.cover && Array.isArray(content.indexes)) return satAltTexts(content, ko, brief, dateLabel);

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

// 토요일 카드 10장의 대체텍스트. 순서는 render-cards-sat.mjs 의 편성과 반드시 같아야 한다 —
// 어긋나면 대체텍스트가 엉뚱한 슬라이드에 붙는다(평일에서 실제로 겪은 사고다).
// ① 표지 ② 지수 ③ 차트 ④ 지표 ⑤ 발표결과 ⑥ 뉴스 ⑦ 섹터 ⑧ 대형주 ⑨ AI ⑩ 아웃트로
function satAltTexts(c, ko, brief, dateLabel) {
  const t = (a, b) => (ko ? a : b);
  const pct = v => `${v > 0 ? '+' : ''}${v}%`;
  // 태그와 함께 엔티티도 푼다. &amp; 를 남기면 대체텍스트에 "S&amp;P 500" 이 그대로 읽힌다.
  const stripTags = s => String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  // est/act 는 한글 단위가 붙는 값만 _ko/_en 쌍을 갖는다(FORMAT_BRIEFING §4).
  // 언어에 맞는 쪽을 먼저 골라야 한다 — 그냥 _ko 를 우선하면 영어 alt 에 '18.1억' 이 새어 나간다.
  const pair = (r, k) => t(r[`${k}_ko`] ?? r[k], r[`${k}_en`] ?? r[k]);
  const heads = o => (o?.items || []).map(i => t(i.headline_ko, i.headline_en)).join(' / ');

  const cover = c.cover || {};
  const val = c.valuation && c.valuation.rows && c.valuation.rows.length
    ? ' · PER ' + c.valuation.rows.map(r => `${t(r.name_ko, r.name_en)} ${r.per}`).join(', ')
    : '';

  const list = [
    // ① 표지 — 헤드라인이 최상위가 아니라 cover 안에 있다
    `${brief} ${dateLabel}: ${stripTags(t(cover.headline_ko, cover.headline_en))}`
      + (cover.hero ? ` — ${t(cover.hero.label_ko, cover.hero.label_en)} ${cover.hero.value}` : ''),

    // ② 지수 주간 등락
    t('지수 주간 등락: ', 'Index moves for the week: ')
      + c.indexes.map(x => `${t(x.name_ko, x.name_en)} ${x.close} ${pct(x.wk)}`).join(', ') + val,

    // ③ 주간 차트 — 그림이라 수치로 대체한다. 이동평균 이격은 렌더러가 계산하므로 여기선 고점만.
    t('주간 일봉 차트: ', 'Daily candlestick charts: ')
      + c.indexes.map(x => `${t(x.name_ko, x.name_en)} ${t(x.hiLabel_ko, x.hiLabel_en)} ${x.hi}`).join(', '),

    // ④ 지수 외 지표
    t('지수 외 지표: ', 'Beyond the indexes: ')
      + (c.metrics || []).map(m => `${t(m.name_ko, m.name_en)} ${m.value} ${m.delta}`).join(', '),

    // ⑤ 발표 결과 (예상 → 실제)
    t('이번 주 발표 결과, 예상에서 실제로: ', 'Forecast to actual this week: ')
      + (c.calendar || []).map(d => `${t(d.day_ko, d.day_en)} `
        + d.rows.map(r => `${t(r.name_ko, r.name_en)} ${pair(r, 'est')}→${pair(r, 'act')}`).join(', ')
      ).join(' / '),

    // ⑥ 한 주를 움직인 것
    `${t(c.news?.title_ko, c.news?.title_en) || t('한 주를 움직인 것', 'What moved the week')}: ${heads(c.news)}`,

    // ⑦ 섹터 등락
    t('주간 섹터 등락: ', 'Sector moves for the week: ')
      + (c.sectors || []).map(s => `${t(s.label_ko, s.label_en)} ${pct(s.value)}`).join(', '),

    // ⑧ 대형주
    t('이번 주 많이 움직인 대형주: ', 'Biggest movers this week: ')
      + ['kr', 'us'].filter(k => c.movers?.[k]).map(k =>
        `${t(c.movers[k].head_ko, c.movers[k].head_en)} `
        + c.movers[k].items.map(s => `${t(s.name_ko, s.name_en)} ${t(s.px_ko, s.px_en)} ${pct(s.pct)}`).join(', ')
      ).join(' / '),

    // ⑨ AI · 반도체
    `${t(c.ai?.title_ko, c.ai?.title_en) || 'AI'}: ${heads(c.ai)}`,

    // ⑩ 아웃트로
    `${t(c.outro?.next_ko, c.outro?.next_en) || ''} · ${brief}`.trim(),
  ];

  return list.map(s => s.length > MAX ? s.slice(0, MAX - 3) + '...' : s);
}
