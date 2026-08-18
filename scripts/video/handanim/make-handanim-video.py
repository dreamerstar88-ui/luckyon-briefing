#!/usr/bin/env python3
"""
테스트1 — handanim (추천안)
content/chart-notes/<STAMP>.json 의 원고를 읽어, 카드 8장을 코드로 다시 '손으로 쓰듯' 그린다.

카드 PNG 를 쓰지 않는다. 원고(JSON)가 곧 입력이고, 획 하나하나를 handanim 이 생성한다.
그래서 글자가 '나타나는' 게 아니라 실제로 '써진다'.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FONT = str(ROOT / "NanumPen.ttf")

# --- handanim 이 한글 손글씨 폰트만 쓰도록 교체 --------------------------------
import handanim.stylings.fonts as F  # noqa: E402

F.FONTS = {"nanumpen": {"type": "ttf", "file": "NanumPen.ttf"}}
F.get_font_path = lambda name: FONT
import handanim.primitives.text as T  # noqa: E402

T.get_font_path = F.get_font_path
T.list_fonts = F.list_fonts
T.get_font_info = F.get_font_info

from handanim.core import Scene, SketchStyle, StrokeStyle, FillStyle  # noqa: E402
from handanim.core.draw_ops import BoundingBox  # noqa: E402
from handanim.core.viewport import Viewport  # noqa: E402
from handanim.primitives.text import Text  # noqa: E402
from handanim.primitives.lines import Line, LinearPath  # noqa: E402
from handanim.primitives.polygons import Rectangle  # noqa: E402
from handanim.primitives.ellipse import Circle  # noqa: E402
from handanim.animations.sketch import SketchAnimation  # noqa: E402

W, H = 108.0, 135.0          # 월드 좌표 (1080x1350 과 10:1)
PX_W, PX_H = 1080, 1350

PAPER = (0.992, 0.988, 0.953)
INK = (0.137, 0.133, 0.122)
NAVY = (0.239, 0.290, 0.408)
RED = (0.753, 0.322, 0.235)
YELLOW = (0.867, 0.757, 0.345)
GREY = (0.55, 0.55, 0.52)

SS = SketchStyle(roughness=0.35, disable_font_mixture=True)
SS_ROUGH = SketchStyle(roughness=0.8, disable_font_mixture=True)


def stroke(color, width=0.22):
    return StrokeStyle(color=color, width=width)


class Page:
    """카드 한 장. add_* 로 요소를 쌓으면 시간이 자동으로 흐른다."""

    def __init__(self, idx: int, total_hint: float = 8.0):
        vp = Viewport((0, W), (0, H), screen_width=PX_W, screen_height=PX_H, margin=0)
        self.sc = Scene(width=PX_W, height=PX_H, fps=24,
                        background_color=PAPER, viewport=vp)
        self.t = 0.25
        self.idx = idx

    def _add(self, drawable, dur, gap=0.12, start=None):
        t0 = self.t if start is None else start
        self.sc.add(SketchAnimation(start_time=t0, duration=dur), drawable)
        if start is None:
            self.t = t0 + dur + gap
        return t0

    def text(self, s, pos, size, color=INK, dur=None, width=0.22, gap=0.12,
             max_width=None, line_factor=1.5, start=None):
        d = Text(s, position=pos, font_size=size, sketch_style=SS,
                 stroke_style=stroke(color, width))
        if max_width:
            d.wrap(BoundingBox(pos[0], pos[1], pos[0] + max_width, H), line_factor)
        if dur is None:
            dur = max(0.45, 0.055 * len(s))
        return self._add(d, dur, gap, start)

    def rule(self, y, x0=8, x1=100, color=RED, width=0.18, dur=0.35, gap=0.1):
        self._add(Line(start=(x0, y), end=(x1, y), sketch_style=SS,
                       stroke_style=stroke(color, width)), dur, gap)

    def path(self, pts, color, width=0.5, dur=1.1, gap=0.12, start=None, rough=False):
        return self._add(LinearPath(points=pts, sketch_style=SS_ROUGH if rough else SS,
                                    stroke_style=stroke(color, width)), dur, gap, start)

    def box(self, xy, w, h, color=INK, width=0.22, dur=0.6, gap=0.1, fill=None, start=None):
        kw = {}
        if fill:
            kw["fill_style"] = FillStyle(color=fill, fill_style="hachure")
        return self._add(Rectangle(top_left=xy, width=w, height=h, sketch_style=SS,
                                   stroke_style=stroke(color, width), **kw), dur, gap, start)

    def circle(self, c, r, color=RED, width=0.28, dur=0.45, gap=0.1, start=None):
        return self._add(Circle(center=c, radius=r, sketch_style=SS,
                                stroke_style=stroke(color, width)), dur, gap, start)

    def header(self, ep: str):
        self.text(f"투자 3분 노트 · {ep}", (8, 11), 3.6, NAVY, dur=0.7, width=0.20, gap=0.05)
        self.text(f"p.{self.idx:02d}", (94, 11), 3.6, NAVY, dur=0.35, width=0.20, gap=0.08)
        self.rule(14.5, 8, 100, RED, 0.14, dur=0.3, gap=0.25)

    def render(self, out: Path, tail=1.0):
        self.sc.render(str(out), max_length=self.t + tail)
        return self.t + tail


# --------------------------------------------------------------------------- #
def nx(x):  # 0~100 정규화 -> 월드 x (차트 영역 12~96)
    return 12 + (x / 100.0) * 84


def ny(y, top, bottom):  # 0~100 (아래→위) -> 월드 y (위→아래)
    return bottom - (y / 100.0) * (bottom - top)


def strip(s: str) -> list[str]:
    return [t for t in s.replace("<br>", "\n").split("\n") if t]


def build(card: dict, idx: int, ep: str, out: Path) -> float:
    p = Page(idx)
    t = card["type"]

    if t == "cover":
        p.header(ep)
        # 표지 도해: 두 선이 만나는 순간 (overlay=cross)
        p.path([(20, 46), (34, 43), (48, 39), (62, 35), (76, 32), (88, 30)], RED, 0.42, dur=1.0)
        p.path([(20, 54), (34, 51), (48, 45), (62, 38), (76, 32), (88, 27)], NAVY, 0.42, dur=1.0)
        p.circle((76, 32), 1.9, RED, 0.3, dur=0.4)
        for i, ln in enumerate(strip(card["annot_ko"].replace("|", "\n"))):
            p.text(ln, (82, 30 + i * 4.2), 3.4, RED, dur=0.5, width=0.18, gap=0.05)
        p.t += 0.35
        for ln in strip(card["title_ko"]):
            p.text(ln, (10, 72 + strip(card["title_ko"]).index(ln) * 9.5), 8.0, INK,
                   width=0.30, gap=0.15)
        p.rule(102, 10, 52, RED, 0.2, dur=0.4, gap=0.25)
        p.text(card["sub_ko"], (10, 110), 4.4, NAVY, width=0.22)
        p.box((10, 116), 42, 7.5, YELLOW, 0.22, dur=0.5, gap=0.1, fill=YELLOW)
        p.text(card["cta_ko"] + " ▶", (12.5, 121), 4.0, INK, width=0.22)

    elif t == "intro":
        p.header(ep)
        for i, ln in enumerate(strip(card["title_ko"])):
            p.text(ln, (10, 26 + i * 9.0), 7.0, INK, width=0.28, gap=0.15)
        p.t += 0.3
        p.text(card["body_ko"], (10, 52), 4.4, INK, width=0.22, max_width=88, line_factor=1.6)
        p.t += 0.3
        p.path([(16, 92), (34, 88), (52, 84), (70, 80), (90, 76)], GREY, 0.35, dur=0.9)
        p.path([(16, 100), (34, 98), (52, 92), (70, 84), (90, 74)], NAVY, 0.45, dur=0.9)
        p.circle((79, 78), 2.2, RED, 0.28, dur=0.4)
        p.text(card["caption_ko"], (10, 116), 3.8, GREY, width=0.20, max_width=90, line_factor=1.5)

    elif t == "checklist":
        p.header(ep)
        for i, ln in enumerate(strip(card["title_ko"])):
            p.text(ln, (10, 26 + i * 8.5), 6.6, INK, width=0.28, gap=0.15)
        p.t += 0.25
        p.text(card["body_ko"], (10, 48), 4.0, INK, width=0.20, max_width=88, line_factor=1.55)
        p.t += 0.35
        y = 74
        for it in card["items"]:
            p.circle((12, y - 1.2), 1.1, RED, 0.24, dur=0.3, gap=0.05)
            p.text(it["term_ko"], (16, y), 4.8, NAVY, width=0.24, gap=0.06)
            p.text(it["desc_ko"], (16, y + 5.2), 3.7, INK, width=0.19, gap=0.18)
            y += 13.5
        p.text(card["closing_ko"], (10, 124), 4.2, RED, width=0.22)

    elif t == "lines":
        p.header(ep)
        for i, ln in enumerate(strip(card["title_ko"])):
            p.text(ln, (10, 26 + i * 8.5), 6.6, INK, width=0.28, gap=0.15)
        p.t += 0.25
        body = card.get("body_ko", "")
        p.text(body, (10, 45), 3.9, INK, width=0.19, max_width=88, line_factor=1.55)
        p.t += 0.4
        top, bot = 72.0, 112.0
        series = card.get("series") or card.get("series_ko")
        for s in series:
            col = NAVY if s["color"].lower() == "#3d4a68" else RED
            pts = [(nx(x), ny(y, top, bot)) for x, y in s["points"]]
            p.path(pts, col, 0.5, dur=1.3, gap=0.15)
        mk = card.get("marker") or card.get("marker_ko")
        if mk:
            mx, my = nx(mk["x"]), ny(mk["y"], top, bot)
            p.circle((mx, my), 1.8, RED, 0.3, dur=0.4, gap=0.05)
            p.text(mk["label_ko"], (mx - 9, my - 3.5), 3.6, RED, width=0.19)
        p.t += 0.2
        # 범례
        lx = 12
        for s in series:
            col = NAVY if s["color"].lower() == "#3d4a68" else RED
            p._add(Line(start=(lx, 121), end=(lx + 5, 121), sketch_style=SS,
                        stroke_style=stroke(col, 0.5)), 0.25, 0.04)
            p.text(s["label_ko"], (lx + 6.5, 122.4), 3.5, INK, width=0.18, gap=0.1)
            lx += 26
        p.text(card["closing_ko"], (10, 130), 3.8, RED, width=0.20, max_width=90)

    elif t == "bars":
        p.header(ep)
        for i, ln in enumerate(strip(card["title_ko"])):
            p.text(ln, (10, 26 + i * 8.5), 6.4, INK, width=0.28, gap=0.15)
        p.t += 0.25
        p.text(card["body_ko"], (10, 45), 3.9, INK, width=0.19, max_width=88, line_factor=1.55)
        p.t += 0.4
        items = card["items"]
        vmax = max(i["value"] for i in items) or 1
        y = 68
        for it in items:
            w = 4 + (it["value"] / vmax) * 52
            col = RED if it.get("highlight") else NAVY
            p.text(it["label_ko"], (10, y), 3.5, INK, width=0.18, gap=0.06)
            p.box((10, y + 1.6), w, 5.0, col, 0.24, dur=0.55, gap=0.06,
                  fill=col if it.get("highlight") else None)
            p.text(str(it["value"]) + "회", (10 + w + 2.5, y + 5.6), 3.8, col, width=0.20, gap=0.2)
            y += 13.5
        p.text(card["closing_ko"], (10, 126), 3.8, RED, width=0.20, max_width=90, line_factor=1.4)

    elif t == "numbered":
        p.header(ep)
        for i, ln in enumerate(strip(card["title_ko"])):
            p.text(ln, (10, 26 + i * 8.5), 6.6, INK, width=0.28, gap=0.15)
        p.t += 0.3
        y = 46
        for n, it in enumerate(card["items"], 1):
            p.circle((12.5, y - 1.0), 2.2, RED, 0.26, dur=0.35, gap=0.04)
            p.text(str(n), (11.4, y + 0.4), 3.6, RED, width=0.20, gap=0.06)
            p.text(it["title_ko"], (17.5, y + 0.6), 4.6, NAVY, width=0.24, gap=0.06)
            p.text(it["desc_ko"], (17.5, y + 6.0), 3.5, INK, width=0.18,
                   max_width=80, line_factor=1.5, gap=0.2)
            y += 22
        p.t += 0.2
        p.box((9, 112), 90, 16, YELLOW, 0.22, dur=0.6, gap=0.1)
        p.text(card["warn_title_ko"], (12, 118), 4.2, RED, width=0.22, gap=0.08)
        p.text(card["warn_body_ko"], (12, 123), 3.5, INK, width=0.18,
               max_width=84, line_factor=1.45)

    elif t == "recap":
        p.header(ep)
        p.text(card["title_ko"], (10, 28), 7.2, INK, width=0.30, gap=0.3)
        y = 44
        for i, pt in enumerate(card["points"], 1):
            p.text(f"{i}.", (10, y), 4.6, RED, width=0.24, gap=0.05)
            p.text(pt["text_ko"], (15.5, y), 4.4, INK, width=0.22,
                   max_width=84, line_factor=1.4, gap=0.18)
            y += 11
        p.t += 0.25
        p.rule(y + 1, 10, 98, GREY, 0.12, dur=0.3, gap=0.25)
        y += 9
        for c in card["ctas"]:
            p.text("· " + c["text_ko"], (10, y), 3.9, NAVY, width=0.20,
                   max_width=88, line_factor=1.4, gap=0.14)
            y += 7.5
        p.t += 0.2
        p.box((9, y + 1), 90, 9, YELLOW, 0.22, dur=0.5, gap=0.08, fill=YELLOW)
        p.text(f"{card['next_label_ko']} → {card['next_ko']}", (12, y + 7), 4.6, INK,
               width=0.24, gap=0.2)
        p.text(card["disclaimer_ko"], (10, 130), 3.2, GREY, width=0.16, max_width=92)

    else:
        raise SystemExit(f"모르는 카드 타입: {t}")

    return p.render(out)


def main() -> None:
    stamp = sys.argv[1] if len(sys.argv) > 1 else "2026-08-09-ep03"
    content = json.loads(Path(f"/home/user/luckyon-briefing/content/chart-notes/{stamp}.json")
                         .read_text(encoding="utf-8"))
    out_dir = ROOT / "test1" / "pages"
    out_dir.mkdir(parents=True, exist_ok=True)

    parts = []
    for i, card in enumerate(content["cards"], 1):
        out = out_dir / f"page-{i}.mp4"
        dur = build(card, i, content["episode"], out)
        parts.append(out)
        print(f"[ok] p.{i:02d} {card['type']:9s} -> {out.name}  {dur:.1f}s")

    lst = ROOT / "test1" / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf-8")

    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    final = ROOT / "test1" / f"test1-{stamp}-handanim.mp4"
    subprocess.run([ff, "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24",
                    "-y", str(final)], check=True)
    print(f"DONE {final}")


if __name__ == "__main__":
    main()
