# `visual-catalog` 스킬 도입 — 인수인계 문서

**작성 2026-08-31 · 다른 세션에서 작업한 결과를 넘긴다.**

> **읽는 사람에게** — 이 문서를 읽는 세션은 앞선 대화 맥락이 없다.
> 그래서 **무엇을 왜 했는지**부터 적어 둔다. **파일은 이미 다 만들어져 있고,
> 남은 일은 «확인 → 커밋 → 푸시» 세 가지다.**

---

## 지금 어디까지 되어 있나

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 스킬을 `.claude/skills/visual-catalog/` 로 복사 | **완료 (커밋 안 됨)** |
| 2 | `ROUTINE_PROMPT_CHARTNOTES.md` 에 호출 지점 2곳 추가 | **완료 (커밋 안 됨)** |
| **3** | **확인 → 커밋 → 푸시** | **여기부터 한다** |
| 4 | 다음 회차 실행에서 실제로 떴는지 확인 | 일요일 10:30 이후 |

작업 브랜치는 **`claude/live`**, 원격은 `dreamerstar88-ui/luckyon-briefing` 이다.

---

## 무엇을 하려는 것인가

차트 노트 회차가 쌓이면서 **같은 그림을 다시 만드는 일**이 생긴다.
`visual-catalog` 스킬은 그림을 만들기 전에 이 순서로 훑는다.

```
1  이 저장소가 이미 가진 카드 타입 12종에서 찾는다     ← 핵심
2  napkin · show_widget · mermaid 같은 기존 도구로 되나 본다
3  안 되면 외부 서식 카탈로그(Monocharts·ThreeUI 등)를 본다
4  후보 3개를 사람에게 내밀어 고르게 한다
```

**1번이 핵심이다.** `ROUTINE_PROMPT_CHARTNOTES.md` 가
*"12종이 로드맵 24회차의 그림을 사실상 전부 덮는다"* 고 못 박아 두었는데,
세션은 매번 그 표를 다시 읽어야 안다. 스킬이 그 표를 들고 있으면
**«새 타입을 만들자»는 말이 안 나온다.**

### 왜 «프로젝트 스킬» 이어야 하나

| 등급 | 경로 | 적용 범위 |
|---|---|---|
| Personal | `~/.claude/skills/<이름>/` | **그 컴퓨터에서만** |
| **Project** | **`<저장소>/.claude/skills/<이름>/`** | **저장소를 클론하는 모든 곳** |

원본은 작업자 노트북의 Personal 에 있었다. 루틴은 클라우드에서 저장소를 클론해 돌므로
**Personal 은 안 보인다.** 그래서 Project 로 복사해 커밋해야 한다.

> 근거: `code.claude.com/docs/en/skills` — 프로젝트 스킬은 저장소에 커밋되고
> *"any other agent in the repo"* 가 따른다.

### 왜 절차서까지 고쳤나

루틴 Instructions 칸은 한 줄이다.

```
저장소의 ROUTINE_PROMPT_CHARTNOTES.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
```

스킬은 `description:` 의 발동 문구와 요청이 맞을 때 뜬다.
저 한 줄에는 "차트 만들어줘" 같은 말이 **없다.**
**넣기만 하고 절차서를 안 고치면 스킬이 뜨지 않는다.** 그래서 본문에 호출 지점을 박았다.

---

## ⓐ 확인 — 커밋 전에 네 가지를 본다

### 1) 스킬 파일 5개가 다 있나

```bash
cd "/c/Users/PSJ_1/SJ PARK Project/luckyon-briefing"
find .claude -type f | sort
```

**기대 출력** (이 다섯 줄, 순서대로)

```
.claude/skills/visual-catalog/SKILL.md
.claude/skills/visual-catalog/references/catalog-sites.md
.claude/skills/visual-catalog/references/catalog-tools.md
.claude/skills/visual-catalog/references/chartnotes-types.md
.claude/skills/visual-catalog/references/transfer-notes.md
```

**`chartnotes-types.md` 가 없으면 의미가 없다.** 이 저장소의 12종 표를 들고 있는 파일이다.

### 2) 절차서가 딱 두 곳만 바뀌었나

```bash
git --no-pager diff --stat ROUTINE_PROMPT_CHARTNOTES.md
```

**기대 출력**

```
 ROUTINE_PROMPT_CHARTNOTES.md | 12 ++++++++++--
 1 file changed, 10 insertions(+), 2 deletions(-)
```

숫자가 다르면 다른 것까지 건드려진 것이다. 아래로 내용을 본다.

```bash
git --no-pager diff ROUTINE_PROMPT_CHARTNOTES.md
```

**들어가야 할 두 곳**

**① 카드 타입 12종 표 바로 앞** (204행 근처)
> **타입을 고르기 전에 `visual-catalog` 스킬의 `references/chartnotes-types.md` 를 읽는다.**
> 주제→타입 대응표가 있어 «이 주제는 이 타입» 이 바로 나온다. 거래량을 `bars` 로 그렸다가 통째로 다시 만든 EP.04 같은 일을 막는다.

**② 예외 조항** (260행 근처) — 기존의 *"렌더러에 새 타입을 추가하고"* 앞에
> **먼저 `visual-catalog` 스킬을 호출한다.** … 새로 만들 필요가 정말 있는지 먼저 가려 준다
> (ETF 구성 비율은 `Treemap`·`Donut`, 자금 흐름은 `Sankey` 처럼 밖에 이미 있는 서식이 있다).
> … 그 타입은 다음 회차부터 재사용되므로 **`chartnotes-types.md` 의 12종 표에도 같이 적는다.**

**사실관계·카드 구조·색 규칙은 하나도 안 건드렸다.** diff 에 그런 것이 보이면 되돌린다.

### 3) 스킬이 이 저장소의 12종을 제대로 알고 있나

```bash
sed -n '1,40p' .claude/skills/visual-catalog/references/chartnotes-types.md
```

12종(`cover` `intro` `pricevol` `lines` `bars` `example` `formula` `anatomy` `compare` `checklist` `numbered` `recap`)과
주제→타입 대응표가 보여야 한다. **특히 이 셋이 맞는지 본다.**

| 주제 | 맞는 타입 |
|---|---|
| 거래량·거래대금 | **`pricevol`** (`bars` 아님 — EP.04 에서 실제로 틀렸다) |
| 이동평균선·골든크로스·볼린저밴드·VIX·배당락 | `lines` |
| 시가총액·PER·PBR·EPS·ROE 순위 | `bars` |

### 4) ⚠️ 커밋하면 안 되는 파일이 섞여 있다

```bash
git status --short
```

**기대 출력**

```
 M ROUTINE_PROMPT_CHARTNOTES.md    ← 올린다
?? .claude/                        ← 올린다
?? SETUP_VISUAL_CATALOG.md         ← 올린다 (이 문서)
?? content/2026-08-19-ep01.json    ← 올리지 않는다
?? data/prices/                    ← 올리지 않는다
```

**`content/2026-08-19-ep01.json` 과 `data/prices/` 는 이번 작업과 무관하다.**
누가 왜 만들었는지 확인되지 않았으므로 **건드리지 않는다.**

---

## ⓑ 커밋 · 푸시

**저장소 루트에서 `git add -A` 를 쓰지 않는다.** 위 두 개가 딸려 들어간다. 경로를 지정한다.

```bash
cd "/c/Users/PSJ_1/SJ PARK Project/luckyon-briefing"

git add .claude/skills/visual-catalog ROUTINE_PROMPT_CHARTNOTES.md SETUP_VISUAL_CATALOG.md

# 올라간 것이 이 셋뿐인지 눈으로 확인한다
git status --short
```

`git status --short` 에서 **`A` 또는 `M` 이 붙은 줄이 아래 셋뿐**이어야 한다.

```
A  .claude/skills/visual-catalog/SKILL.md
A  .claude/skills/visual-catalog/references/catalog-sites.md
A  .claude/skills/visual-catalog/references/catalog-tools.md
A  .claude/skills/visual-catalog/references/chartnotes-types.md
A  .claude/skills/visual-catalog/references/transfer-notes.md
A  SETUP_VISUAL_CATALOG.md
M  ROUTINE_PROMPT_CHARTNOTES.md
```

`content/` 나 `data/` 가 보이면 **커밋하지 말고** `git restore --staged <경로>` 로 뺀다.

```bash
git commit -m "차트 노트: visual-catalog 스킬을 프로젝트 스킬로 추가

루틴이 그림을 새로 만들기 전에 기존 카드 타입 12종에서 먼저 찾도록 한다.
references/chartnotes-types.md 에 12종 표·주제→타입 대응표·흔한 잘못을 넣었다.
절차서 5단계 두 곳에 호출 지점을 명시했다 — Instructions 한 줄만으로는 발동하지 않는다."

git push
```

> `claude/live` 브랜치다. 푸시하면 **다음 일요일 10:30 루틴부터 적용된다.**

---

## ⓒ 커밋 후 검증 — 다음 회차에서 본다

**문서만 보고 «됐다»고 하지 않는다.** 실제 실행 결과로 확인한다.

| 확인할 것 | 어디서 |
|---|---|
| 세션이 스킬을 호출했나 | 루틴 실행 로그에 `visual-catalog` 호출이 남았는가 |
| 대응표를 읽었나 | 카드 타입을 고른 근거에 «대응표» 언급이 있는가 |
| 12종에서 골랐나 | `content/chart-notes/<STAMP>.json` 의 `cards[].type` 이 12종 안에 있는가 |

### 안 떴을 때 — Instructions 를 두 줄로 늘린다

루틴 설정의 Instructions 칸을 이렇게 바꾼다.

```
저장소의 ROUTINE_PROMPT_CHARTNOTES.md 파일을 읽고, 그 절차를 순서대로 그대로 수행하세요.
카드 그림을 정할 때는 visual-catalog 스킬을 반드시 먼저 호출하세요.
```

> **확인 못 한 것** — 클라우드 루틴이 프로젝트 스킬을 실제로 읽는지는
> **직접 돌려 확인하지 못했다.** 공식 문서 근거만 있다. 첫 회차에서 위 표대로 확인할 것.

---

## ⓓ 되돌리기

### 커밋 전이면

```bash
cd "/c/Users/PSJ_1/SJ PARK Project/luckyon-briefing"
rm -rf .claude SETUP_VISUAL_CATALOG.md
git checkout ROUTINE_PROMPT_CHARTNOTES.md
```

### 커밋·푸시 후면

```bash
cd "/c/Users/PSJ_1/SJ PARK Project/luckyon-briefing"
git rm -r --cached .claude/skills/visual-catalog
rm -rf .claude/skills/visual-catalog
git checkout HEAD~1 -- ROUTINE_PROMPT_CHARTNOTES.md
git commit -m "차트 노트: visual-catalog 스킬 제거"
git push
```

어느 쪽이든 작업자 노트북의 원본(`~/.claude/skills/visual-catalog`)은 그대로 남는다.

---

## 알고 넣을 것 — 비용

프로젝트 스킬은 **그 저장소의 모든 세션**에 설명문이 실린다. 이 저장소에는 루틴이 여럿이다.

| 루틴 | 주기 |
|---|---|
| 브리핑 (`ROUTINE_PROMPT.md`) | 평일 하루 2회 |
| 차트 노트 (`ROUTINE_PROMPT_CHARTNOTES.md`) | 주 1회 (일요일 10:30) |
| 공시·스토리·주말 | 각각 별도 |

`visual-catalog` 설명문은 약 250바이트로 작고, **본문은 호출할 때만 로드된다.**
다만 차트 노트가 아닌 축에도 설명문은 같이 얹힌다.

---

## 넣은 뒤의 유지 규칙 — 이게 없으면 쌓이지 않는다

| 언제 | 무엇을 |
|---|---|
| **새 카드 타입을 추가했을 때** | ① 렌더러 `render-chartnotes.mjs` ② `ROUTINE_PROMPT_CHARTNOTES.md` 의 12종 표 ③ **`chartnotes-types.md` 의 12종 표** — **셋 다** 적는다. ③을 빠뜨리면 다음 회차가 또 새로 만든다 |
| **새 서식 사이트를 알게 됐을 때** | `catalog-sites.md` 에 한 줄. **직접 열어 확인하고** 라이선스·비용·필요 프레임워크를 같이 적는다. 못 열면 «확인 실패»라고 적는다 |
| **그림 때문에 실패했을 때** | `chartnotes-types.md` 의 «흔한 잘못» 표에 적는다. EP.04 거래량 사건, EP.03 `overlay` 사건처럼 |

**사이트마다 스킬을 새로 만들지 않는다.** 파일에 줄을 더한다.

---

## 부록 — 스킬 구성

```
.claude/skills/visual-catalog/
  SKILL.md                          110줄   절차 5단계 · 절대 원칙 3가지
  references/chartnotes-types.md    124줄   이 저장소의 12종 · 주제→타입 · 흔한 잘못   ★
  references/catalog-tools.md       103줄   이미 깔린 스킬·MCP 와 훑는 순서
  references/catalog-sites.md       141줄   외부 서식 사이트 (확인 상태·라이선스 포함)
  references/transfer-notes.md      155줄   남의 규격을 옮길 때의 실패 기록
```

### 차트 노트에서 **하면 안 되는 것** (스킬에도 박아 두었다)

| 항목 | 규칙 |
|---|---|
| 캔들 색 | JSON 에 쓰지 않는다. `direction: "up"\|"down"` 만. 렌더러가 언어권 관행 적용 (한국어판 상승=빨강) |
| 급증일 강조 | `hi: true` — **색은 그대로 두고 검은 테두리로만.** 붉게 칠하면 «빨강=상승» 과 어긋난다 |
| 디자인 토큰·레이아웃 | 회차마다 바꾸지 않는다. 고칠 일이 있으면 렌더러를 고쳐 전 회차에 같이 적용 |
| **Monocharts 의 모노크롬 기법** | **쓰지 않는다.** «색 대신 채움/테두리» 방식은 이 시리즈와 충돌한다. 여기서는 색이 곧 의미다 |

### 12종에 없어서 밖을 봐야 하는 것

ETF 구성 비율(`Treemap`·`Donut`) · 자금 흐름(`Sankey`) · 증감 분해(`Waterfall`) ·
목표 대비 달성(`Bullet`) · 공포탐욕지수(`RadialGauge`·`Meter`) · 섹터 히트맵(`Heatmap`) ·
종목 다면 비교(`Radar`) · 위험 대비 수익(`Scatter`·`Bubble`) · 52주 밴드(`Range` — 단 `lines` 의 `band` 로도 된다)

**호가창 표는 어디에도 없다. 새로 만들어야 한다.**
