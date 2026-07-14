# luckyon 브리핑 · Instagram 자동 발행

매일 아침 경제·AI 뉴스를 카드뉴스(캐러셀 7장)로 만들어 Instagram에 **완전 자동 발행**하는 프로젝트입니다.
한국어본·영어본을 각각 별도 게시물로 올립니다.

## 구조

```
content/<날짜>.json      ← 그날의 뉴스 데이터 (루틴이 매일 새로 작성)
scripts/render-cards.mjs ← JSON → 카드 PNG 7장 (ko/en)
scripts/publish-instagram.mjs ← 카드를 인스타 캐러셀로 발행
cards/<날짜>/<언어>/     ← 생성된 이미지 (GitHub Pages로 공개)
ROUTINE_PROMPT.md        ← 루틴에 붙여넣을 프롬프트
```

## 최초 1회 세팅 체크리스트

### 1. 환경변수 (루틴 환경 설정 → Environment variables)
```
IG_ACCESS_TOKEN=<장기(60일) 인스타 토큰>
IG_USER_ID=27358818657120221
IG_TOKEN_EXPIRES_AT=2026-09-12
PAGES_BASE_URL=https://dreamerstar88-ui.github.io/luckyon-briefing
```

### 2. 네트워크 허용 도메인 (Network access → Custom)
- `graph.instagram.com`
- (기본 목록 포함 체크 유지 — npm 설치용)

### 3. GitHub Pages
- 저장소 Settings → Pages → Branch: `main` / 폴더 `/ (root)` → Save
- (이 저장소는 공개(Public)여야 인스타가 이미지를 가져갈 수 있음. 토큰은 커밋되지 않으니 안전.)

### 4. 루틴 생성 (claude.ai/code/routines)
- **한국어본 루틴**: 저장소 `luckyon-briefing` 지정, 위 환경 지정, 스케줄 = 매일 KST 아침 7:30,
  Instructions = `ROUTINE_PROMPT.md` 내용 (LANG=ko)
- **영어본 루틴**: 동일하게 하나 더 만들되 스케줄 = 미국 아침(예: KST 22:00), Instructions의 LANG=en

## 토큰 갱신 (60일마다, 1분)
`IG_TOKEN_EXPIRES_AT` 만료 10일 전 알림이 오면 아래 URL을 브라우저에 붙여 새 토큰을 받아
환경변수 `IG_ACCESS_TOKEN` 값만 교체하고, `IG_TOKEN_EXPIRES_AT` 도 +60일로 갱신하세요.
```
https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<현재_토큰>
```

## 로컬 테스트
```
export DATE=2026-07-14
node scripts/render-cards.mjs $DATE ko      # 카드 생성 확인
node scripts/publish-instagram.mjs $DATE ko # 실제 발행 (주의: 진짜 올라감)
```
