# 외부 서식 카탈로그

**갱신 2026-08-31.** **이 파일이 계속 늘어나는 곳이다.** 새 사이트를 알게 되면 여기에 한 줄 더한다.

**"확인" 칸이 핵심이다.** 직접 열어 본 것과 아닌 것을 섞지 않는다.

---

## A. 바로 쓸 수 있는 곳 (직접 확인함)

### Amicro / Mono Charts — 차트 29종

| 항목 | 값 |
|---|---|
| 사이트 | `https://amicro.vercel.app` (Components · **Mono Charts** · Dither Charts · Skills · 3D) |
| 저장소 | `github.com/Subhan-code/Monocharts` |
| 라이선스 | **MIT** (Syed Subhan Uddin, 2026) |
| 필요한 것 | React 19 · **recharts 3.10.1** · motion 12 · Tailwind |
| 가져오는 법 | 사이트에서 코드 복사가 확실하다 (`npx @subhanhq/amicro add <이름>` 도 있으나 npm 버전이 초기) |
| 로컬 사본 | 작업자 노트북 `참고자료모음/monocharts/` |

**차트 29종**

```
Area  Bar  Bubble  Bullet  Candlestick  Composed  Donut  Funnel  GaugeArc
Heatmap  KpiCard  Line  Meter  Polar  Pyramid  Radar  RadialBarGroup
RadialGauge  Range  Sankey  Scatter  Sparkline  StackedBar  Step  Stream
Treemap  Waterfall  ActivityHeatmap
```

**차트 노트에 걸리는 것** — `Treemap`·`Donut`(ETF 구성비) · `Sankey`(자금 흐름) ·
`Waterfall`(실적 증감 분해) · `RadialGauge`·`Meter`(공포탐욕지수) · `Heatmap`(섹터 등락) ·
`Radar`(다면 비교) · `Scatter`·`Bubble`(위험 대비 수익)

> ⚠️ **모노크롬 기법은 쓰지 않는다.** Monocharts 는 «색 대신 채움/테두리»로 방향을 구분한다
> (상승 = 흰색 채움, 하락 = 투명 + 테두리). 차트 노트는 **색이 곧 의미**이고
> EP.01 이 «한국은 빨강이 상승»을 가르쳤으므로 정면으로 충돌한다. **가져오는 것은 레이아웃과 구조뿐이다.**

### ThreeUI — Three.js 장면 164종

| 항목 | 값 |
|---|---|
| 사이트 | `https://threeui.com` |
| 분류 | Landing · Hero · Three.js · **Backgrounds** · Buttons · **Text Animation** · **Motion Design** |
| 쓰는 법 | 장면을 고르고 **프롬프트 복사** → 붙여넣는다 |
| 비용 | 배포자 설명은 "무료·오픈소스" |
| 확인 | 브라우저로 분류까지 확인. **라이선스 문구는 JS 로 그려져 못 읽었다 — 쓰기 전 재확인** |

릴스·영상 축에서 배경으로 쓸 수 있다. 차트 노트(정지 카드)와는 거리가 있다.

### ReUI — shadcn 계열 차트 25종

| 항목 | 값 |
|---|---|
| 사이트 | `https://reui.io/components/chart` |
| 내용 | shadcn 차트 25종 (Recharts + Motion) + Pro 블록 30종 |
| 비용 | **무료 + 유료 Pro 혼합.** 라이선스 문구 `/legal/license` — **확인 못 함** |
| 필요한 것 | React · Recharts · Motion · **shadcn** · Tailwind |

> Amicro 와 겹친다. **차이**: ReUI 는 shadcn 생태계에 붙고, Amicro 는 단독이며 모노크롬 통일이 강점.

### FusionCharts — 상용 100종+

| 항목 | 값 |
|---|---|
| 사이트 | `https://www.fusioncharts.com` |
| 내용 | 차트 100종 이상. Sankey·Gantt·시계열 등 특수 차트 |
| 비용 | **상용.** 무료 체험만 무료 |

> **돈이 든다.** 무료인 Amicro·ReUI 로 안 될 때만 본다.

### Godly — 영감 갤러리

| 항목 | 값 |
|---|---|
| 사이트 | `https://godly.design` |
| 내용 | 웹·앱 디자인 **스크린샷 모음** |
| 비용 | 무료 |
| **주의** | **코드가 없다.** 영감용으로만 |

---

## B. 목록에서 뺀 것 (성격이 달랐다)

| 사이트 | 실제 정체 | 왜 뺐나 |
|---|---|---|
| `dashpanda.io` | 쿠팡 셀러 정산 SaaS | 차트 서식이 아니다 |
| `duck.design` | 디자인 에이전시 구독 | 컴포넌트를 파는 곳이 아니다 |
| `flaticon.com` · `iconscout.com` | 아이콘 소재 | 차트가 아니다 |

## C. 확인 실패

| 사이트 | 상태 |
|---|---|
| `designmd.cc` | **HTTP 403** · 브라우저 접근도 거부. 무엇인지 모른다 |

---

## 넣을 때 규칙

1. **직접 열어 본다.** 검색 요약만 보고 올리지 않는다
2. 라이선스를 확인한다. 못 하면 **"확인 못 함"** 이라고 적는다
3. **무료인지 유료인지, 유료면 얼마인지** 적는다
4. 필요한 프레임워크를 적는다 — 이게 «코드를 쓸 수 있나»를 가른다
5. 성격이 다르면 **B 칸으로 내린다.** 지우지 말고 왜 뺐는지 남긴다
6. **이 저장소 렌더러는 HTML/SVG 다.** React 컴포넌트는 코드가 아니라 **규격만** 옮긴다
