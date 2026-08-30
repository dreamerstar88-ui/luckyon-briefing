# 이 환경에 실제로 있는 도구

**갱신 2026-08-31.** 클라우드 루틴 세션에서 실측한 목록이다.

> ⚠️ **노트북과 클라우드는 도구가 다르다.** 이 파일은 **클라우드 루틴 기준**이다.
> 이 스킬의 첫 초안이 노트북 기준으로 쓰여 있어 «먼저 검토할 셋» 으로
> napkin · `show_widget` · mermaid MCP 를 지목했는데, **클라우드에는 셋 다 없다.**
> 없는 도구를 찾느라 시간을 쓰지 않도록 여기서 갈라 둔다.

---

## 0. 차트 노트 카드는 이것으로만 만든다

```
node scripts/chart-notes/render-chartnotes.mjs <STAMP> ko
node scripts/chart-notes/render-chartnotes.mjs <STAMP> en
```

Playwright(Chromium) 로 HTML/CSS/SVG 를 1080×1350 PNG 로 찍는다.
시리즈 아이덴티티(크림 모눈 노트 · 스프링 제본 · 감청색 헤더 · 붉은 포인트 · 노란 형광펜)가
**렌더러 코드 안에** 있다.

**아래 도구로 카드를 만들지 않는다.** 후보를 탐색하고 규격을 참고하는 데만 쓴다.
Canva·Gamma 로 만든 카드는 시리즈에서 튄다.

---

## 1. 클라우드 루틴에 있는 것

| 도구 | 되는 것 | 차트 노트에서 |
|---|---|---|
| **Artifact** (내장) | HTML 페이지 발행. **mermaid 를 라이브러리 없이 렌더**한다 (```` ```mermaid ```` 또는 `<pre class="mermaid">`) | 도식 후보를 빨리 그려 사용자에게 보여줄 때 |
| **dataviz** (스킬) | 차트 형태 선택·색·축·범례 규칙 | 새 타입을 설계할 때 |
| **artifact-diagramming** (스킬) | 인라인 SVG 로 «구조를 보여주는» 그림 그리는 법 | `anatomy`·`flip` 같은 도식 카드 설계 |
| **Figma** (MCP) | `get_screenshot` · `get_design_context` · `generate_diagram` | 기존 디자인을 참고할 때 |
| **Canva** (MCP) | `generate-design` · `export-design` | **참고용만** |
| **Gamma** (MCP) | `generate` · `export_gamma` | **참고용만.** 무료 크레딧 한정 |
| **Higgsfield** (MCP) | `generate_image` · `generate_video` · `upscale_*` | 배경·소재 |
| **PlayMCP** | `UsStockInfo-get_historical_stock_prices` (시세) · `KakaotalkChat-MemoChat` (알림) | **4단계 시세 검증에 필수** |
| Alpha-Vantage · FMP · Supermetrics (MCP) | 시세·재무·지표 | 시세 교차검증 |
| github (MCP) | 이슈·PR·Actions | 0-1 디스패처, Pages 배포 확인 |

## 2. 클라우드에 **없는** 것 — 찾지 말 것

`napkin` · `mcp__visualize__show_widget` · `mermaid` MCP · PowerPoint · Adobe ·
Cloudinary · Topview · 플러그인

> 노트북(Personal)에는 있을 수 있다. **세션이 어디서 도는지 먼저 본다.**
> mermaid 는 MCP 없이 **Artifact 가 직접 렌더**하므로 대체된다.

---

## 훑는 순서

```
1  차트 노트 카드인가?          → chartnotes-types.md 대응표에서 고른다. 대부분 여기서 끝
2  없는 그림인가?               → catalog-sites.md 에서 서식 후보를 찾는다
3  후보를 보여줘야 하나?         → Artifact 로 mermaid·SVG 시안을 띄운다
4  새 타입을 만들기로 했나?      → dataviz · artifact-diagramming 으로 설계하고
                                 render-chartnotes.mjs 에 구현한다
```

## 갱신 규칙

새 MCP 가 붙거나 빠지면 여기에 한 줄 고친다.
**«있다»고 적기 전에 실제로 호출해 본다.** 목록에만 있고 안 되는 것을 적으면 다음 세션이 헤맨다.
