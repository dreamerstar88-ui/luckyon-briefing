# 1회차 테스트 영상 — 나스닥 한 주 5분봉 되감기

만든 날: 2026-09-07 · 대상 주: 2026-08-31(월) 개장 ~ 09-04(금) 마감

| 파일 | 내용 |
|---|---|
| `reel_nasdaq-week_shorts.mp4` | 완성본. 58.40초 · 1080×1920 · 30fps · H.264 CRF18 yuv420p · AAC 192k/48kHz 스테레오 |
| `cover_nasdaq-week.png` | 썸네일(커버). 영상 3.0초 훅 프레임 |
| `발행문구.md` | 제목·설명·태그·고정 댓글·마무리 문구·발행 전 점검표 |
| `scene.js` | 화면 그리기 로직 (브라우저 캔버스에서 실행) |
| `render.mjs` | 프레임 생성기 (Playwright) |
| `music.mjs` | 배경음악 합성기 |
| `bgm-waveform.png` | 음악 파형. 46초 지점의 정답 임팩트가 보인다 |

## 다시 만드는 법

```bash
cd <스크래치 폴더>
node vid/render.mjs                 # 프레임 1,752장 (약 105초)
node vid/music.mjs                  # bgm-raw.wav 58.4초
FF=node_modules/ffmpeg-static/ffmpeg
$FF -y -framerate 30 -i frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 \
   -preset medium -movflags +faststart silent.mp4
$FF -y -i bgm-raw.wav -af "afade=t=in:st=0:d=1.5,afade=t=out:st=56.4:d=2,\
   loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 -t 58.4 bgm.wav
$FF -y -i silent.mp4 -i bgm.wav -map 0:v:0 -map 1:a:0 -c:v copy \
   -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart reel.mp4
```

5분봉 원본은 `../v6-nasdaq-week/data-nq-5m.json` 을 쓴다.

## 구성 (58.4초)

| 구간 | 시각 | 내용 |
|---|---|---|
| 훅 | 0 ~ 3.2초 | 0초부터 숫자가 보인다(검은 화면 없음). +0.36% 카운트업 → 질문 → 보기 3개 |
| 되감기 | 3.2 ~ 46초 | 5분봉 1,179개를 순차 노출. 사건 5곳에서 1.8초씩 멈추고 라벨. 우상단에 "고점 대비" 실시간 표시 |
| 정답 | 46 ~ 52초 | -2.18% 공개 + 낙폭 구간 음영 |
| 요약·루프 | 52 ~ 58.4초 | 요약 3줄 → 손글씨 CTA → 마지막 1.6초 첫 프레임 구도로 복귀 |

## 기존 파이프라인과 맞춘 것

`sj-park-investment-backtest/backtest-reels` 의 규격을 그대로 따랐다.

- 1080×1920 · 30fps · H.264 CRF18 · yuv420p · +faststart
- 길이 58.4초 (세 렌더러 공통 `DURATION`)
- 소리 AAC 192k · 48kHz 스테레오, `loudnorm=I=-14:TP=-1.5:LRA=11`, 앞 1.5초 페이드인 · 뒤 2초 페이드아웃

## 기존 파이프라인과 다르게 한 것

| 항목 | 기존 | 이번 | 이유 |
|---|---|---|---|
| 인트로 | 7.6초 정지 카드 | **3.2초**, 0초부터 숫자 움직임 | 보고서 §12-1: 인트로 7.6초가 4.7~8.9초 이탈 절벽의 원인 |
| 첫 프레임 | 글줄 8개(시리즈 라벨·영문·기간·면책) | 큰 숫자 1개 + 질문 1줄 + 보기 3개 | §12-2 규칙 2 |
| 하단 문구 | y 1772 / 1824 | **y 1668 / 1716** | 유튜브 쇼츠 UI가 하단을 가린다 |
| 렌더러 | `@napi-rs/canvas` (node) | Playwright 캔버스 | 이 환경에 napi-rs 미설치. 그리기 코드는 같은 Canvas 2D API |
| 배경음악 | `배경음악/기준-배경음악3.wav` (Suno) | **직접 합성** (`music.mjs`) | 기준 음원이 git 에 없다(용량 제외). 아래 참고 |

## 배경음악에 대해

저장소 `sj-park-investment-backtest` 는 영상·음원을 `.gitignore` 로 제외한다
("영상·음원 산출물 — 용량이 커서 git 제외. 스크립트로 재생성한다").
그래서 확정 음원 `기준-배경음악3.wav` 는 대표 컴퓨터에만 있고 이 세션에서 쓸 수 없었다.

대신 `music.mjs` 로 영상 구조에 맞춘 곡을 합성했다. Am–F–C–G 진행, 약 104 BPM,
패드·아르페지오·베이스·킥·하이햇에 사건 지점 임팩트 5개와 46초 정답 임팩트를 넣었다.
저작권 문제가 없고 스크립트로 언제든 다시 만들 수 있다.

**발행 때는 기준 음원을 쓰는 편이 낫다.** 대표 컴퓨터에서 아래로 바꿔 다시 합성하면 된다.

```bash
$FF -y -i "배경음악/기준-배경음악3.wav" -af "afade=t=in:st=0:d=1.5,\
   afade=t=out:st=56.4:d=2,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 -t 58.4 bgm.wav
```
