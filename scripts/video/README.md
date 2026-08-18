# 차트 노트 → 손글씨 영상 (실험 3종)

이미 만들어 둔 **카드 8장 / 원고 JSON** 을 영상으로 바꾸는 세 가지 경로를 실제로 만들어 비교한 기록이다.
소재는 EP.03(`2026-08-09-ep03`, 골든크로스 & 데드크로스) 한국어판.

**스토리보드를 새로 짜지 않는다.** 세 방법 모두 입력이 이미 있는 산출물이다 —
테스트2·3 은 `cards/chart-notes/<STAMP>/<LANG>/card*.png`, 테스트1 은 `content/chart-notes/<STAMP>.json`.

---

## 세 방법 요약

| | 테스트1 · handanim | 테스트2 · srt-whiteboard | 테스트3 · 조합 |
|---|---|---|---|
| 입력 | 원고 JSON | 카드 PNG 8장 | 카드 PNG + 씬 주석 |
| 그리는 주체 | 코드가 획을 생성 | 카드에서 잉크를 훑어 공개 | 테스트2 결과 + 카메라 |
| 글씨 | **진짜 손글씨** (나눔손글씨 펜) | 카드의 원래 서체 그대로 | 카드 서체 + 상하단만 손글씨 |
| 브랜드 일치 | ✗ 다른 룩 | **✓ 픽셀 단위 동일** | **✓ 동일** |
| 화면비 | 4:5 (1080×1350) | 4:5 (1080×1350) | **9:16 (1080×1920)** |
| 카메라 | 없음 | 없음 | **펀치인/아웃** |
| 손 그림 | 없음 | ✓ | ✓ |
| 라이선스 | MIT | MIT | + Apache 2.0 (HyperFrames) |

---

## 테스트1 — handanim (`handanim/`)

```bash
python scripts/video/handanim/make-handanim-video.py 2026-08-09-ep03
```

`content/chart-notes/<STAMP>.json` 의 카드 8장을 읽어 **코드로 다시 그린다.** 카드 PNG 를 쓰지 않는다.
카드 타입(`cover`/`intro`/`checklist`/`lines`/`bars`/`numbered`/`recap`)마다 배치 함수가 있고,
`lines`·`bars` 는 원고에 든 좌표·수치를 그대로 좌표계에 옮긴다.

**준비물**
- `pip install handanim brotli imageio-ffmpeg`
- `assets/fonts/NanumPenScript-Korean.woff2` → TTF 변환본. handanim 은 TTF 만 읽는다:
  ```python
  from fontTools.ttLib import TTFont
  f = TTFont("assets/fonts/NanumPenScript-Korean.woff2"); f.flavor = None; f.save("NanumPen.ttf")
  ```
  handanim 내장 폰트 10종은 **전부 라틴 전용**이라 한글이 한 글자도 안 나온다. 이 교체가 필수다.

**주의** — 획 두께는 월드 좌표 기준이다. 1080px 폭을 월드 108 로 잡으면 1유닛 = 10px 이므로
`width=1.6` 은 16px 이 되어 한글이 검은 덩어리로 뭉갠다. 본문 0.18~0.24, 차트선 0.4~0.5 가 적정.

## 테스트2 — srt-whiteboard-animation (`whiteboard/`)

유튜브 「코덱스로 AI 화이트보드 애니메이션 영상 자동화 만들기」에서 소개된 방법.
원본은 SRT 자막 + 사람이 그린 선화 + **손으로 찍은 픽셀 좌표 주석**을 요구하지만,
우리 카드는 이미 «크림 모눈지 + 검정 잉크 + 포인트 컬러» 구조라 **주석을 자동 생성할 수 있다.**

```bash
# 1) 카드를 잉크 레이어 / 배경판으로 분리
python scripts/video/whiteboard/split_card.py cards/chart-notes/<STAMP>/ko/card1.png --out build/split
# 2) 잉크 레이어에서 주석 자동 생성
python scripts/video/whiteboard/auto_annotate.py build/split/card1.ink.png build/scene-1.json --duration-ms 8000
# 3) 렌더 (srt-whiteboard-animation 저장소의 렌더러)
<ENV_PY> scripts/render_stream_whiteboard.py build/split/card1.ink.png build/scene-1.json \
         build/scene-1.raw.mp4 scripts/video/whiteboard/drawing-hand.png --cap-long-edge 1350 --fps 24
# 4) 배경판 합성
ffmpeg -loop 1 -i build/split/card1.plate.png -i build/scene-1.raw.mp4 \
  -filter_complex "[1:v]colorkey=0xFDFCF3:0.10:0.0[fg];[0:v][fg]overlay=shortest=1,format=yuv420p[v]" \
  -map "[v]" -r 24 -c:v libx264 -crf 18 -y build/scene-1.mp4
```

**왜 1·4단계가 필요한가.** 렌더러는 «공개된 영역만» 원본에서 떠 오고 나머지는 배경색으로 덮는다.
카드를 그대로 넣으면 ① 모눈이 공개 영역에서만 사각형 패치로 드러나고 ② 갈색 테두리·스프링·푸터가 통째로 사라진다.
잉크만 그리게 하고 배경은 나중에 합성하면 둘 다 해결된다.

**손 그림 자산.** 저장소 기본 `assets/drawing-hand.png` 은 펜에 제작자의 중국어 아이디(江哥是老登啊)가 박혀 있다.
`whiteboard/drawing-hand.png` 은 그 글자를 인페인팅으로 지운 판이다. **기본 자산을 그대로 쓰면 남의 브랜딩이 우리 영상에 나간다.**

## 테스트3 — HyperFrames 조합 (`reels/`)

```bash
python scripts/video/reels/make-composition.py     # index.html 생성
cd <hyperframes-project> && npx hyperframes check && npx hyperframes render
```

테스트2 가 만든 씬 8개를 9:16 화면에 얹고, **테스트2 의 주석 JSON 을 그대로 카메라 데이터로 재사용한다** —
각 씬에서 가장 큰 블록(히어로)의 좌표와 공개 시각을 읽어 그 구간에 펀치인했다가 빠진다.
좌표를 새로 찍을 필요가 없는 게 핵심이다.

상·하단 여백에는 시리즈명(손글씨)과 진행 막대를 넣어 릴스에서 죽는 공간을 쓴다.

**이 환경에서 막혔던 것과 우회**
- `cdn.jsdelivr.net` 이 프록시에 막힘 → `npm i gsap` 후 `node_modules/gsap/dist/gsap.min.js` 로컬 참조
- HyperFrames 가 PATH 의 `ffmpeg`/`ffprobe` 를 요구 → `npm i ffmpeg-static ffprobe-static` 후 심볼릭 링크
  (`ffprobe-static` 은 darwin/linux 바이너리를 함께 담으므로 `bin/linux/x64/ffprobe` 를 링크할 것)
- Playwright 내장 ffmpeg 는 **VP8/webm 전용**이라 H.264 MP4 를 못 만든다. 위 정적 빌드나 `imageio-ffmpeg` 를 쓴다.
- 텔레메트리는 `npx hyperframes telemetry disable` 로 끈다.

---

## 알아둘 것

- **테스트1 은 브랜드 카드와 다른 룩이다.** 같은 시리즈 피드에 섞으면 다른 콘텐츠로 보인다.
  쓰려면 별도 포맷(예: 릴스 전용 손글씨 버전)으로 분리하는 편이 낫다.
- **테스트2·3 은 카드가 이미 있어야 한다.** 카드 렌더가 선행 단계이므로 주 1회 제작 흐름을 바꾸지 않는다.
- **자동 주석은 종이 바깥(갈색 여백)을 잉크로 치지 않는다.** 그래서 푸터 문구는 그려지지 않고 배경판에 정적으로 남는다.
  의도된 동작이다 — 푸터까지 손으로 쓰면 매 씬 끝이 늘어진다.
- 세 방법 모두 **무음**이다. 유튜브 영상의 원 파이프라인은 Gemini TTS 나레이션을 붙이지만,
  여기서는 시각 비교가 목적이라 넣지 않았다.
