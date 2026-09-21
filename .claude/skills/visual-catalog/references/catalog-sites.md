# 외부 서식 카탈로그

**갱신 2026-08-30.** 전 세션 기록(`~/.claude/projects/.../*.jsonl`)을 도메인 단위로 훑어 모았다.
**"확인" 칸이 핵심이다.** 직접 열어 본 것과 아닌 것을 섞지 않는다.

---

## A. 바로 쓸 수 있는 곳 (직접 확인함)

### Amicro / Mono Charts — 차트 29종 + 마이크로 인터랙션 163종

| 항목 | 값 |
|---|---|
| 사이트 | `https://amicro.vercel.app` (메뉴에 Components · **Mono Charts** · Dither Charts · Skills · 3D Page) |
| 저장소 | `github.com/Subhan-code/Monocharts` (별 135) · 본체 `Subhan-code/Amicro--Micro-transitions-` (사이트 표시 별 2,232) |
| 라이선스 | **MIT** (Syed Subhan Uddin, 2026) |
| 필요한 것 | React 19 · **recharts 3.10.1** · motion 12 · Tailwind |
| 설치 | `npx @subhanhq/amicro@latest add <이름>` — 다만 npm 버전이 초기라 **사이트에서 코드 복사가 더 확실하다** |
| 로컬 사본 | `C:\Users\PSJ_1\SJ PARK Project\참고자료모음\monocharts\` (클론·`npm install` 완료) |
| 띄우는 법 | vite. 포트 3000 이 이미 쓰이고 있어 **5180 등 다른 포트**로 띄운다 |
| 동봉 스킬 | `.agents/skills/amicro-design-system/SKILL.md` — **차트 규격이 아니라 Amicro 웹사이트 카탈로그 UI 규격이다.** 차트 규격은 각 `.tsx` 안에 있다 |

**차트 29종** (`src/components/mono-charts/`)

```
Area  Bar  Bubble  Bullet  Candlestick  Composed  Donut  Funnel  GaugeArc
Heatmap  KpiCard  Line  Meter  Polar  Pyramid  Radar  RadialBarGroup
RadialGauge  Range  Sankey  Scatter  Sparkline  StackedBar  Step  Stream
Treemap  Waterfall  ActivityHeatmap  (+ GitHubActivity)
```

**투자 콘텐츠에 바로 걸리는 것**

| 컴포넌트 | 어디에 |
|---|---|
| **Candlestick** | 주가 화면. `{time, open, high, low, close}` 구조를 그대로 받는다 |
| **Waterfall** | 실적 증감 분해 (매출 → 비용 → 이익) |
| **KpiCard** | 표지 핵심 지표 |
| **Sparkline** | 좁은 칸의 추세선 |

**모노크롬 캔들 규격** (`MonoRoundedCandlestickChart.tsx` 실측)
```
상승  흰색 꽉 채움 #FFFFFF
하락  15% 투명 채움 rgba(255,255,255,0.15) + 흰 테두리 1px
심지  2px, 양 끝 둥글게, 불투명도 40%
몸통  폭 20~24px, 모서리 6px
```
→ **색이 아니라 채움 여부로 방향을 구분한다.** 흑백·색맹에서도 읽힌다.

---

### ThreeUI — Three.js 장면 164종

| 항목 | 값 |
|---|---|
| 사이트 | `https://threeui.com` |
| 분류 | Landing Pages · Hero · **Three.js** · **Backgrounds** · Buttons · **Text Animation** · UI Elements · CSS · **Motion Design** |
| 쓰는 법 | 장면을 고르고 **프롬프트 복사** → 클로드 코드에 붙인다. 페이지마다 에이전트용 스킬 문서가 딸려 있다 |
| 비용 | 배포자 설명은 "로그인·결제 없이 무료·오픈소스" |
| 확인 | 브라우저로 분류까지 확인. **라이선스 문구는 자바스크립트로 그려져 못 읽었다 — 쓰기 전 재확인** |

**영상 제작에 쓸 수 있다.** Backgrounds·Text Animation·Motion Design 은 웹사이트가 아니라
**화면 그 자체**다. HTML/CSS 를 렌더해 영상으로 뽑는 파이프라인이면 재료로 바로 들어간다.

---

### ReUI — shadcn 계열 차트 25종

| 항목 | 값 |
|---|---|
| 사이트 | `https://reui.io/components/chart` |
| 내용 | **shadcn 차트 컴포넌트 25종** (Recharts + Motion 기반) + Pro 블록 30종 |
| 별 | 3.4K |
| 비용 | **무료 + 유료 ReUI Pro 혼합.** 라이선스 문구는 `/legal/license` 에 있으나 확인 못 함 |
| 필요한 것 | React · Recharts · Motion · **shadcn** · Tailwind (Tailwind 테마 변수를 쓴다) |
| 설치 | 컴포넌트마다 "Copy registry URL" |

> Amicro 와 성격이 겹친다. **차이:** ReUI 는 shadcn 생태계에 붙는 것이고,
> Amicro 는 단독이며 모노크롬 통일이 강점이다.

---

### FusionCharts — 상용 차트 100종+

| 항목 | 값 |
|---|---|
| 사이트 | `https://www.fusioncharts.com` |
| 내용 | **차트 100종 이상.** Sankey·Gantt·시계열 등 특수 차트 포함 |
| 비용 | **상용.** 무료 체험만 무료. SaaS·기업·OEM 별 유료 라이선스 |
| 프레임워크 | JS·React·Angular·Vue·Ember·Svelte (프레임워크 무관) |

> **돈이 든다.** 무료로 되는 Amicro·ReUI 로 안 될 때만 본다.

---

### ThemeSelection — 관리자 대시보드 템플릿

| 항목 | 값 |
|---|---|
| 사이트 | `https://themeselection.com` (블로그 `blog.codedthemes.com`) |
| 내용 | 완성된 관리자 대시보드·SaaS 보일러플레이트·UI 키트 |
| 비용 | **무료(Freebies) + 유료 혼합.** 유료는 $49~$149, 번들 $149 |
| 프레임워크 | React·Next·Vue·Nuxt·Laravel·Django·Bootstrap·Tailwind·ASP.NET |
| 차트 | 명시 없음. 대시보드라 들어 있을 가능성이 높으나 **확인 안 됨** |

---

### Godly — 디자인 영감 갤러리

| 항목 | 값 |
|---|---|
| 사이트 | `https://godly.design` |
| 내용 | 웹·앱·UI 디자인 **스크린샷 모음**. 아이콘·로고·히어로·CTA·푸터 분류 |
| 비용 | 무료 |
| **주의** | **코드가 없다.** 스크린샷과 원본 X 게시물 링크뿐이다. 영감용으로만 쓴다 |

---

## B. 목록에서 뺀 것 (확인해 보니 성격이 달랐다)

| 사이트 | 세션 등장 | 실제 정체 | 왜 뺐나 |
|---|---|---|---|
| `dashpanda.io` | 10회 | **쿠팡 셀러 정산 관리 SaaS** (Pro 월 33,000원) | 차트 서식이 아니다. 이커머스 조사 때 나온 것 |
| `duck.design` | 3회 | **디자인 에이전시 구독 서비스** | 컴포넌트를 파는 곳이 아니다 |
| `flaticon.com` · `iconscout.com` | 4·3회 | 아이콘 소재 | 차트가 아니다. 아이콘이 필요할 때만 별도로 |

## C. 확인 실패

| 사이트 | 세션 등장 | 상태 |
|---|---|---|
| `designmd.cc` | 3회 | **HTTP 403** · 브라우저 접근도 거부됨. 무엇인지 모른다 |

---

## 넣을 때 규칙

1. **직접 열어 본다.** 검색 요약만 보고 올리지 않는다
2. 라이선스를 확인한다. 못 하면 "확인 못 함"이라고 적는다
3. **무료인지 유료인지, 유료면 얼마인지** 적는다
4. 필요한 프레임워크를 적는다 — 이게 "코드를 쓸 수 있나"를 가른다
5. 성격이 다르면 **B 칸으로 내린다.** 지우지 말고 왜 뺐는지 남긴다
