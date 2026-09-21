# 이미 깔려 있는 도구

**갱신 2026-08-30.** 스킬 폴더(`~/.claude/skills`)와 연결된 MCP 서버를 훑어 모았다.
**밖에서 찾기 전에 여기부터 본다.** 대부분 이미 있다.

---

## A. 코드 없이 바로 결과가 나오는 것 — 먼저 검토할 셋

| 도구 | 무엇을 | 언제 쓰나 |
|---|---|---|
| **napkin** (MCP) | 문장을 넣으면 **도식**이 나온다. `generate_visual` · `list_styles` · `download_visual` · `generate_and_wait` | 개념·흐름·관계를 그림으로. 숫자 차트에는 부적합 |
| **mcp__visualize__show_widget** | 대화 안에 바로 보이는 **SVG·HTML 위젯**. 차트·다이어그램·표·인터랙티브 전부 | 사용자에게 지금 보여주기만 하면 될 때. 파일이 안 남는다 |
| **mermaid** (MCP) | `validate_and_render_mermaid_diagram` | 순서도·시퀀스·관계도 |

> `show_widget` 은 **첫 호출 전에 `mcp__visualize__read_me` 를 먼저 부른다.** 필수다.

---

## B. 완성물을 만드는 도구 (MCP)

| 도구 | 되는 것 | 비용 주의 |
|---|---|---|
| **Gamma** | `generate` · `generate_multi_page_gamma` · `export_gamma`(PDF/PPTX) · `get_themes` · 분석 | **무료 400 크레딧 1회성, 갱신 없음.** AI 생성 40 크레딧/건 → 3~10건이면 소진. 무료판은 10장 제한 + 워터마크 |
| **Canva** | `generate-design` · `edit-design` · `export-design` · `search-brand-templates` · 브랜드 킷 | 계정 등급에 따름 |
| **PowerPoint** (Anthropic) | `create_presentation` · `add_slide` · `insert_image` · `export_pdf` | **로컬. 완전 무료.** 크레딧 개념 없음 |
| **Adobe** | `create_visual_design_express_skill`(디자인 지침) · `export_html_to_express` · `document_render_layout` · `image_*` 40여 종 · `font_*` | 계정 등급에 따름. **아무 Adobe 도구 전에 `adobe_mandatory_init` 필수** |
| **Figma** | `get_design_context` · `get_screenshot` · `get_variable_defs` · `generate_diagram` | 기존 디자인을 읽을 때 |
| **Cloudinary** | `generate-image` · `generate-image-from-images` · `transform-asset` · 자산 관리 | |
| **Higgsfield** | `generate_image` · `generate_video` · **`generate_3d`(GLB)** · `upscale_*` · Marketing Studio | 크레딧 소모. 잔량은 `balance` 로 확인 |
| **Topview** | `topview_generate_image/video/music` · 캔버스 편집 | `topview_get_credit` 로 잔량 확인 |
| **PDF Tools** | `convert_pdf_to_markdown` · `render_pdf_page` · `display_pdf` | |

---

## C. 디자인 방향을 잡아 주는 스킬 (코드는 내가 쓴다)

**20종 넘게 이미 깔려 있다.** 새로 찾기 전에 여기서 고른다.

| 스킬 | 성격 |
|---|---|
| `frontend-design` | 새 UI 를 만들 때의 기본 미감 지침. 템플릿 티를 안 내는 쪽 |
| `high-end-visual-design` | 고급 에이전시 톤. 폰트·여백·그림자·카드 구조·애니메이션을 못 박음 |
| `minimalist-ui` | 편집 디자인풍. 따뜻한 모노크롬, 벤토 그리드, 그라디언트 없음 |
| `industrial-brutalist-ui` | 스위스 인쇄 + 군용 터미널. **강한 그리드와 극단적 크기 대비** |
| `design-taste-frontend` (v2) / `-v1` | 랜딩·포트폴리오용 안티슬롭 |
| `gpt-taste` | UX/UI + GSAP 모션. 레이아웃 무작위화 |
| `stitch-design-taste` | `DESIGN.md` 를 만들어 규격을 문서로 고정 |
| `redesign-existing-projects` | 기존 것을 뜯어고칠 때 |
| `theme-factory` | **색·폰트 테마 10종 프리셋.** 슬라이드·문서·HTML 에 입힘 |
| `brand-guidelines` / `brandkit` | 브랜드 색·타이포 적용 / 브랜드 보드 생성 |
| `algorithmic-art` | p5.js 생성 예술 |
| `image-to-code` · `imagegen-frontend-web` · `-mobile` | 이미지 먼저 만들고 코드로 |
| `ecommerce-product-photo` · `higgsfield-product-photoshoot` | 제품 사진 |

> **주의:** 이 스킬들은 대부분 **웹 UI** 를 전제로 한다.
> 인스타 캐러셀(1080×1350)이나 릴스(1080×1920) 같은 **고정 캔버스**에는
> 그대로 안 맞는다. 색·타이포 규칙만 가져오는 쪽이 낫다.

---

## D. 지금 실제로 쓰는 파이프라인 — 여기에 맞춰야 한다

| 산출물 | 도구 | 위치 |
|---|---|---|
| 인스타 캐러셀 1080×1350 | **파이썬** + Playwright/HTML | `nvda-q2fy27/layout.py` · `개별기업 실적 발표 제작 플로우/templates/layout.py` |
| 릴스·쇼츠 1080×1920 | **`@napi-rs/canvas`** + `ffmpeg-static` | `backtest-reels/scripts/render-*.mjs` |
| 가로 롱폼 1920×1080 | 같음 | `backtest-reels/scripts/render-longform-*.mjs` |

**둘 다 React 가 아니다.** 카탈로그의 React 컴포넌트는 **코드를 그대로 못 쓴다.**
규격만 옮긴다 → `transfer-notes.md`

### 릴스 색 규격 (스위스 그리드, 확정판)

```
bg #f3f1ec   panel #e8e5de   text #15171b   muted #6a6a64   dim #9c998f
grid #dcd8cf  line/up #c8402f(벽돌)  down/savings #1f4fd8(파랑)
서체 Pretendard (Regular/Medium/SemiBold/Bold/ExtraBold)
여백 PAD_X 76 · PAD_TOP 76 · PAD_BOT 150
```

**이 색을 바꾸지 않는다.** 사용자가 정한 것이다.

---

## E. 없는 것

| 없는 것 | 대신 |
|---|---|
| 플러그인 | **0개.** `~/.claude/plugins/` 자체가 없다. `/plugin` 은 대화형 터미널에서만 열린다 |
| 캔버스용 `tabular-nums` | Canvas 2D 규격에 없다. 직접 만들어야 한다 → `transfer-notes.md` |

---

## 훑는 순서

```
1  napkin · show_widget · mermaid 로 되는 일인가?      → 되면 여기서 끝
2  Gamma · Canva · PowerPoint 로 되는 일인가?          → 크레딧 확인 후
3  디자인 스킬(C)로 방향만 잡고 내가 그리는 일인가?
4  외부 카탈로그(catalog-sites.md)에서 서식을 가져오나?
5  전부 아니면 그때 새로 찾는다
```
