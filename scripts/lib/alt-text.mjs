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

  const list = [
    `${brief} ${dateLabel}: ${headline}${headlineSub ? ' - ' + headlineSub : ''}`,
    marketsLabel + (content.markets || []).map(m =>
      `${m.label} ${m.value}${m.value_sub ? ' ' + m.value_sub : ''} ${m.delta}`).join(', '),
    econLabel + headlines(content.econ, 0),
    econLabel + headlines(content.econ, 3),
    aiLabel + headlines(content.ai, 0),
    aiLabel + headlines(content.ai, 3),
  ];
  if (content.schedule && content.market_hours) {
    list.push(scheduleLabel + content.schedule
      .map(s => `${s.time} ${ko ? s.title_ko : s.title_en}`).join(' / '));
  }
  list.push(`${nextBrief || ''} · ${brief}`.trim());

  return list.map(s => s.length > MAX ? s.slice(0, MAX - 3) + '...' : s);
}
