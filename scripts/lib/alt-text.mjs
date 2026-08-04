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
