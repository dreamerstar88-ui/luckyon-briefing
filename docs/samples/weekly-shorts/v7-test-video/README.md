# 1회차 테스트 영상 — 나스닥 한 주 5분봉 되감기 (30초)

만든 날: 2026-09-08 · 대상 주: 2026-08-31(월) 개장 ~ 09-04(금) 마감

| 파일 | 내용 |
|---|---|
| `reel_nasdaq-week_30s_synthwave.mp4` | **완성본 (권장).** 30.00초 · 1080×1920 · 30fps · H.264 CRF18 · AAC 192k/48kHz. Lyria synthwave |
| `reel_nasdaq-week_30s_build.mp4` | 같은 영상, Lyria build 곡 |
| `reel_nasdaq-week_30s_무음.mp4` | 소리 없는 판. 다른 음악을 넣을 때 이걸 쓴다 |
| `cover_nasdaq-week.png` | 썸네일. 2.5초 훅 프레임 |
| `발행문구.md` | 제목·설명·태그·고정 댓글·마무리 문구·점검표 |
| `사건선정기준.md` | 어떤 지점에 라벨을 붙였고 왜 그것만 골랐는지 |
| `배경음악-선택지.md` | Suno·TopView·ElevenLabs·기존 음원 — 실제로 확인한 결과와 명령 |
| `scene.js` · `render.mjs` | 재생성 스크립트 |
| `bgm-synthwave-waveform.png` · `bgm-build-waveform.png` | 배경음악 파형 |

## 구성 (30초)

| 구간 | 시각 | 내용 |
|---|---|---|
| 훅 | 0 ~ 2.6초 | 0초부터 숫자가 보인다. +0.36% 카운트업 → "최대 낙폭은?" → 보기 3개 |
| 되감기 | 2.6 ~ 21.8초 | 5분봉 1,179개. 사건 4곳에서 1.5초씩 정지하고 라벨. 지나간 사건은 세로 점선으로 남는다 |
| 정답 | 21.8 ~ 25.6초 | -2.18% 공개 + 낙폭 구간 음영 |
| 요약·루프 | 25.6 ~ 30.0초 | 요약 3줄 → 손글씨 CTA → 마지막 1.05초 첫 프레임 구도로 복귀 |

58.4초 판(9/7 제작)에서 30초로 줄였다. 되감기 구간이 42.8초에서 19.2초로 줄어
봉이 넘어가는 속도가 약 2.2배 빨라졌다. 사건 정지는 5곳 1.8초에서 4곳 1.5초로 줄였다.

## 사건 표기

사건이 지나가면 그래프에 **세로 점선 + 번호 배지 + 사건 내용 세로 글씨**가 남는다.
글씨는 한 글자씩 똑바로 세워 위에서 아래로 쌓는다(`vtext()`). 선 위에 그려서 주가 선에
가리지 않고, 오른쪽 여백이 좁으면 선 왼쪽으로 자동으로 넘어간다.
마지막 요약 화면까지 ①유조선 피격 ②주간 최저 ③반등 시작 ④고용지표 네 개가 남는다.

## 줄간격

두 줄 이상인 글 묶음은 글자 크기의 1.35~1.40배를 줄간격으로 쓴다.

| 자리 | 글자 | 줄간격 |
|---|---|---|
| 훅 질문 2줄 | 58 / 70px | 102px |
| 사건 라벨 2줄 | 56px | 80px |
| 정답 설명 2줄 | 54 / 44px | 76px |
| 요약 제목 2줄 | 52px | 72px |
| 요약 표 행 | 46px | 118px |
| 세로 글씨 | 26px | 31px |

## 숫자 표기

모든 숫자는 **자릿수 폭을 고정**해서 그린다 (`numT()`).
0~9 중 가장 넓은 글자 폭을 재서 모든 숫자를 같은 칸에 가운데 맞춤으로 넣는다.
카운트업·시계·가격이 매 프레임 바뀌어도 글자가 좌우로 흔들리지 않는다.
Pretendard 에는 고정폭 숫자 기능(`tabular-nums`)이 캔버스에서 안 먹으므로 직접 구현했다.

## 다시 만드는 법

```bash
node vid/render.mjs      # 프레임 900장, 약 55초
node vid/music.mjs       # bgm-raw.wav 30초
FF=node_modules/ffmpeg-static/ffmpeg
$FF -y -framerate 30 -i frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 \
   -preset medium -movflags +faststart silent30.mp4
$FF -y -i bgm-raw.wav -af "afade=t=in:st=0:d=1.0,afade=t=out:st=28.2:d=1.8,\
   loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 -t 30 bgm30.wav
$FF -y -i silent30.mp4 -i bgm30.wav -map 0:v:0 -map 1:a:0 -c:v copy \
   -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart reel.mp4
```

5분봉 원본은 `../v6-nasdaq-week/data-nq-5m.json`.

## 배경음악

대표가 올린 **Lyria 원곡**을 쓴다. 자세한 것은 `배경음악-선택지.md`.
권장은 synthwave — 곡의 전환(21초)이 영상의 정답 공개(21.8초)와 맞는다.
두 곡 모두 페이드인 2.5초 · 페이드아웃 3.0초, 음량 -14 LUFS 기준.
