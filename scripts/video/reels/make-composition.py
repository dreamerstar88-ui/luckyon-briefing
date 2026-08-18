#!/usr/bin/env python3
"""
테스트3 — 시너지 조합
  · 바탕: 테스트2(srt-whiteboard)가 그린 «브랜드 그대로의» 카드 8장
  · 위에: 테스트1(handanim)이 그리는 «진짜 손글씨» 강조 주석
  · 조립: HyperFrames (HTML -> 결정적 MP4) — 9:16 릴스 규격 + 카메라 펀치인

테스트1·2 가 각각 놓친 것을 서로 메운다:
  테스트2 는 브랜드가 정확하지만 글자가 '나타날' 뿐이고 4:5 정지 화면이다.
  테스트1 은 진짜로 써지지만 브랜드 디자인이 아니다.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJ = ROOT.parent / "hf" / "demo"
SCENES = ROOT / "test2" / "scenes"

CANVAS_W, CANVAS_H = 1080, 1920
CARD_W, CARD_H = 1080, 1350
PUNCH = 1.25                      # 펀치인 배율
MAX_X = (CARD_W * PUNCH - CARD_W) / 2
MAX_Y = (CARD_H * PUNCH - CARD_H) / 2

DESK = "#4a443c"                  # 카드 바깥 책상 톤 — 크림색 글자와 대비를 확보한 어두운 웜그레이


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def main() -> None:
    scenes = []
    t = 0.0
    for n in range(1, 9):
        ann = json.loads((SCENES / f"scene-{n}.annotation.json").read_text(encoding="utf-8"))
        dur = ann["sceneDurationMs"] / 1000.0
        hero = max(ann["elements"], key=lambda e: e["region"]["width"] * e["region"]["height"])
        r, rv = hero["region"], hero["reveal"]
        hx = r["x"] + r["width"] / 2
        hy = r["y"] + r["height"] / 2
        # 히어로 블록을 화면 중앙으로 끌어오는 이동량 (카드 중심 기준)
        tx = clamp(-PUNCH * (hx - CARD_W / 2), -MAX_X, MAX_X)
        ty = clamp(-PUNCH * (hy - CARD_H / 2), -MAX_Y, MAX_Y)
        scenes.append({
            "n": n, "start": round(t, 3), "dur": round(dur, 3),
            "punch_in": round(max(0.4, rv["startMs"] / 1000.0 - 0.5), 2),
            "punch_out": round(min(dur - 0.9, (rv["startMs"] + rv["durationMs"]) / 1000.0 + 0.6), 2),
            "tx": round(tx, 1), "ty": round(ty, 1),
        })
        t += dur
    total = round(t, 3)

    # ---- HTML ------------------------------------------------------------- #
    clips, tweens = [], []
    for s in scenes:
        n, st, du = s["n"], s["start"], s["dur"]
        clips.append(f"""
      <div class="cam" id="cam-{n}">
        <video id="sc-{n}" class="clip" data-start="{st}" data-duration="{du}"
               data-track-index="1" src="assets/scene-{n}.mp4" muted playsinline></video>
      </div>""")
        gin = round(st + s["punch_in"], 3)
        gout = round(st + s["punch_out"], 3)
        # 카메라는 «클립이 아니라» 안쪽 래퍼에 건다 (core 규칙)
        tweens.append(
            f'  tl.fromTo("#cam-{n}", {{ scale: 1, x: 0, y: 0 }},'
            f' {{ scale: {PUNCH}, x: {s["tx"]}, y: {s["ty"]},'
            f' duration: 1.1, ease: "power2.inOut" }}, {gin});\n'
            f'  tl.to("#cam-{n}", {{ scale: 1, x: 0, y: 0,'
            f' duration: 0.9, ease: "power2.inOut" }}, {gout});'
        )

    # 하단 진행 표시 — 전체를 한 번에 채운다 (씬마다 끊으면 경계에서 트윈이 겹친다)
    tweens.append(
        f'  tl.fromTo("#bar", {{ width: "0%" }}, {{ width: "100%",'
        f' duration: {total}, ease: "none" }}, 0);'
    )

    html = f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={CANVAS_W}, height={CANVAS_H}" />
    <script src="node_modules/gsap/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      @font-face {{
        font-family: "NanumPen";
        src: url("assets/NanumPenScript-Korean.woff2") format("woff2");
        font-display: block;
      }}
      html, body {{ width: {CANVAS_W}px; height: {CANVAS_H}px; overflow: hidden; }}
      body {{ font-family: "NanumPen", sans-serif; }}
      #bg {{ position: absolute; inset: 0; background: {DESK}; }}
      #stage {{ position: absolute; inset: 0; display: block; }}
      .cam {{
        position: absolute; left: 0; top: {(CANVAS_H - CARD_H) // 2}px;
        width: {CARD_W}px; height: {CARD_H}px; will-change: transform;
      }}
      .cam video {{ display: block; width: {CARD_W}px; height: {CARD_H}px; }}
      #topband {{
        position: absolute; left: 0; top: 0; width: {CANVAS_W}px;
        height: {(CANVAS_H - CARD_H) // 2}px; background: {DESK}; z-index: 5;
        display: flex; align-items: center; justify-content: center;
        color: #f4efe4; font-size: 52px; letter-spacing: 2px;
      }}
      #botband {{
        position: absolute; left: 0; bottom: 0; width: {CANVAS_W}px;
        height: {(CANVAS_H - CARD_H) // 2}px; background: {DESK}; z-index: 5;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 26px; color: #f4efe4; font-size: 42px;
      }}
      #track {{
        width: 720px; height: 10px; background: rgba(244,239,228,0.28);
        border-radius: 5px; overflow: hidden;
      }}
      #bar {{ height: 10px; width: 0%; background: #ddc158; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}"
         data-width="{CANVAS_W}" data-height="{CANVAS_H}">
      <div id="bg"></div>
      <div id="stage">{"".join(clips)}
      </div>
      <div id="topband">투자 3분 노트 · EP.03 골든크로스 &amp; 데드크로스</div>
      <div id="botband">
        <div id="track"><div id="bar"></div></div>
        <div>저장하고 넘겨보세요</div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tweens)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
    (PROJ / "index.html").write_text(html, encoding="utf-8")
    print(f"[ok] index.html  총 {total:.2f}s  씬 {len(scenes)}개")
    for s in scenes:
        print(f"   씬{s['n']}: {s['start']:6.2f}s +{s['dur']:.2f}s  "
              f"펀치 {s['punch_in']:.2f}~{s['punch_out']:.2f}  이동({s['tx']:.0f},{s['ty']:.0f})")


if __name__ == "__main__":
    main()
