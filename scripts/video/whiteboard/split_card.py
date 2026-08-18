#!/usr/bin/env python3
"""
카드 PNG 를 두 장으로 분리한다.

  <name>.ink.png    잉크만 (모눈·갈색 테두리·스프링·푸터 제거 → 전부 크림색)
  <name>.plate.png  배경판 (모눈·갈색 테두리·스프링·푸터는 그대로, 잉크만 제거)

whiteboard 렌더러는 '공개된 영역'만 원본에서 떠 오므로, 모눈이 원본에 남아 있으면
공개 영역이 사각형 모눈 패치로 드러난다. 잉크만 그리게 하고 배경은 나중에 합성한다.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

PAPER = np.array([253, 252, 243], dtype=int)
INK_DIST = 90          # 이보다 멀면 잉크 (모눈선 거리 ~60 은 배경으로 남는다)
PAPER_LUM_MIN = 700    # 종이(크림) 영역 판정


def paper_box(rgb: np.ndarray) -> tuple[int, int, int, int]:
    m = rgb.astype(int).sum(2) > PAPER_LUM_MIN
    r = np.where(m.any(1))[0]
    c = np.where(m.any(0))[0]
    return int(c.min()), int(r.min()), int(c.max()), int(r.max())


def split(card: Path, out_dir: Path) -> tuple[Path, Path]:
    rgb = np.array(Image.open(card).convert("RGB")).astype(int)
    x0, y0, x1, y1 = paper_box(rgb)

    inside = np.zeros(rgb.shape[:2], bool)
    inside[y0:y1 + 1, x0:x1 + 1] = True
    dist = np.abs(rgb - PAPER).sum(2)
    is_ink = (dist > INK_DIST) & inside

    ink = np.where(is_ink[:, :, None], rgb, PAPER)          # 잉크만, 나머지 크림
    plate = np.where(is_ink[:, :, None], PAPER, rgb)        # 잉크 뺀 배경 (모눈·테두리 유지)

    out_dir.mkdir(parents=True, exist_ok=True)
    p_ink = out_dir / f"{card.stem}.ink.png"
    p_plate = out_dir / f"{card.stem}.plate.png"
    Image.fromarray(ink.astype(np.uint8)).save(p_ink)
    Image.fromarray(plate.astype(np.uint8)).save(p_plate)
    return p_ink, p_plate


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cards", nargs="+")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    for c in a.cards:
        i, p = split(Path(c), Path(a.out))
        print(f"[ok] {Path(c).name} -> {i.name} / {p.name}")


if __name__ == "__main__":
    main()
