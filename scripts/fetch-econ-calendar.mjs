// fetch-econ-calendar.mjs
// 경제지표 발표 일정을 받아 data/econ-calendar.json 으로 출력한다.
// ROUTINE_PROMPT.md 리서치 C절(일정 리서치)이 이 파일을 읽는다.
//
// 사용법:
//   node scripts/fetch-econ-calendar.mjs            # 어제~+10일
//   node scripts/fetch-econ-calendar.mjs 3 14       # 3일 전 ~ 14일 뒤
//
// 왜 워크플로로 받아오나:
//   경제 캘린더 사이트(Investing.com·세이브티커·TradingView·FXStreet·ForexFactory)는
//   브리핑 세션의 네트워크 정책에서 전부 차단된다. 반면 GitHub Actions 러너는 그 밖에
//   있어 그대로 접근된다. 그래서 .github/workflows/econ-calendar.yml 이 이 스크립트를
//   돌려 결과를 커밋하고, 세션은 커밋된 JSON 을 읽는다.
//   (data/futures-cache.json 과 같은 패턴이다.)
//
// 소스 우선순위:
//   1) FXStreet 공개 캘린더 API — 키 불필요, 46개국, 예상치·이전치·실제치 포함
//   2) (1)이 막히면 GitHub 에 미러된 공개 스냅샷 — 미국 전용, 이전치 없음
//   두 경로 모두 실패하면 exit 2 로 조용히 빠진다. 브리핑을 막지 않는다.

const FXSTREET = 'https://calendar-api.fxstreet.com/en/api/v1/eventDates';
const MIRROR = 'https://raw.githubusercontent.com/benbaichmankass/Metis-Insights/main/comms/macro/econ_calendar_upcoming.json';

// 카드에 쓸 나라만 남긴다. 그 외(브라질·인도 등)는 우리 독자와 무관해 노이즈다.
const KEEP = new Set(['US', 'KR', 'EMU', 'EU', 'DE', 'CN', 'JP', 'GB']);

const daysBack = Number(process.argv[2] ?? 1);
const daysFwd = Number(process.argv[3] ?? 10);

const iso = d => d.toISOString().slice(0, 19) + 'Z';
const now = new Date();
const from = new Date(now.getTime() - daysBack * 864e5);
const to = new Date(now.getTime() + daysFwd * 864e5);

const IMPACT = v => {
  const s = String(v || '').toUpperCase();
  return s === 'HIGH' ? 'HIGH' : s === 'MEDIUM' ? 'MEDIUM' : 'LOW';   // NONE·빈값은 LOW 로 모은다
};

const norm = e => ({
  at: e.at,                     // ISO UTC
  country: e.country,
  name: e.name,
  impact: IMPACT(e.impact),     // HIGH | MEDIUM | LOW
  consensus: e.consensus ?? null,
  previous: e.previous ?? null,
  actual: e.actual ?? null,
  unit: e.unit ?? null,
});

async function fromFxstreet() {
  const url = `${FXSTREET}/${iso(from)}/${iso(to)}`;
  const res = await fetch(url, {
    headers: {
      // 이 두 헤더가 없으면 403 이 온다.
      'Origin': 'https://www.fxstreet.com',
      'Referer': 'https://www.fxstreet.com/',
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`FXStreet HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('FXStreet 빈 응답');
  const VOL = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'LOW' };
  return rows
    .filter(r => KEEP.has(String(r.countryCode || '').toUpperCase()))
    .map(r => norm({
      at: r.dateUtc,
      country: String(r.countryCode || '').toUpperCase(),
      name: r.name,
      impact: VOL[String(r.volatility || '').toUpperCase()] || 'LOW',
      consensus: r.consensus, previous: r.previous, actual: r.actual, unit: r.unit,
    }));
}

async function fromMirror() {
  const res = await fetch(MIRROR, { headers: { 'User-Agent': 'luckyon-briefing' } });
  if (!res.ok) throw new Error(`mirror HTTP ${res.status}`);
  const d = await res.json();
  const evs = d?.events;
  if (!Array.isArray(evs) || !evs.length) throw new Error('mirror 빈 응답');
  return evs.map(e => norm({
    at: e.scheduled_at,
    country: e.country,
    name: e.event_name,
    impact: e.impact,
    consensus: (e.expected || {}).consensus_raw ?? (e.expected || {}).consensus,
    previous: null,
    actual: (e.realized_outcome || {}).actual_raw ?? null,
  }));
}

async function main() {
  const tried = [];
  for (const [name, fn] of [['fxstreet', fromFxstreet], ['mirror', fromMirror]]) {
    try {
      // 미러는 요청 기간을 무시하고 전체를 주므로 여기서 한 번 더 자른다.
      const lo = iso(from), hi = iso(to);
      const events = (await fn())
        .filter(e => e.at && e.at >= lo && e.at <= hi && KEEP.has(e.country))
        .sort((a, b) => a.at.localeCompare(b.at));
      if (!events.length) throw new Error('기간 내 이벤트 없음');
      console.error(`ℹ️  소스 ${name} · ${events.length}건`);
      console.log(JSON.stringify({
        fetchedAt: iso(now), source: name,
        range: { from: iso(from), to: iso(to) },
        events,
      }, null, 2));
      return;
    } catch (err) {
      tried.push(`${name}: ${err.message}`);
    }
  }
  console.error(`⏭  경제 캘린더 조회 실패 (${tried.join(' / ')}) — 일정 카드는 다른 경로로 채우고 발행은 계속한다.`);
  process.exit(2);
}

main().catch(err => { console.error('❌ 실행 실패:', err.message); process.exit(1); });
