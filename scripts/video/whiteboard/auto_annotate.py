#!/usr/bin/env python3
"""
차트 노트 카드 PNG -> srt-whiteboard-animation 용 annotation.json 자동 생성.

카드는 이미 "크림 모눈지 + 검정 잉크 + 포인트 컬러" 구조라, 모눈선만 색으로 걸러내면
나머지 잉크 덩어리가 곧 '그려야 할 요소'가 된다. 사람이 픽셀 좌표를 찍을 필요가 없다.

사용법:
  python auto_annotate.py <card.png> <out.annotation.json> [--duration-ms 9000]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

# 카드 렌더러가 쓰는 색 (scripts/chart-notes/render-chartnotes.mjs 의 디자인 토큰)
PAPER = np.array([253, 252, 243])       # 크림 종이
GRID_DIST_MAX = 90                      # 모눈선(거리 ~60)은 버리고 회색 푸터(~167)는 살리는 경계

# 카드 밖 갈색 배경을 잘라내기 위한 밝기 기준
PAPER_LUM_MIN = 700


def paper_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    """카드 종이(크림 영역)의 bbox 를 찾는다. 바깥 갈색 여백을 제외하기 위함."""
    lum = rgb.astype(int).sum(2)
    mask = lum > PAPER_LUM_MIN
    rows = np.where(mask.any(1))[0]
    cols = np.where(mask.any(0))[0]
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


def ink_mask(rgb: np.ndarray) -> np.ndarray:
    """종이색에서 충분히 떨어진 픽셀 = 잉크. 모눈선은 거리 기준으로 탈락한다."""
    dist = np.abs(rgb.astype(int) - PAPER).sum(2)
    return (dist > GRID_DIST_MAX).astype(np.uint8)


def bands(mask: np.ndarray, min_gap: int, min_rows: int) -> list[tuple[int, int]]:
    """행 투영으로 잉크가 있는 구간을 찾아, min_gap 이상 비면 다른 덩어리로 끊는다."""
    rows = mask.any(1)
    out: list[tuple[int, int]] = []
    start = None
    gap = 0
    for i, has in enumerate(rows):
        if has:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    end = i - gap
                    if end - start + 1 >= min_rows:
                        out.append((start, end))
                    start = None
                    gap = 0
    if start is not None:
        end = len(rows) - 1
        if end - start + 1 >= min_rows:
            out.append((start, end))
    return out


def split_columns(sub: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """한 밴드 안에서 좌우로 크게 떨어진 덩어리(예: 헤더 좌측 제목 / 우측 p.01)를 분리."""
    cols = sub.any(0)
    out: list[tuple[int, int]] = []
    start = None
    gap = 0
    for i, has in enumerate(cols):
        if has:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    out.append((start, i - gap))
                    start = None
                    gap = 0
    if start is not None:
        out.append((start, len(cols) - 1))
    return out


def build(card: Path, duration_ms: int, min_gap: int, col_gap: int,
          lead_ms: int, tail_ms: int) -> dict:
    rgb = np.array(cv2.imread(str(card))[:, :, ::-1])  # BGR -> RGB
    h, w = rgb.shape[:2]

    x0, y0, x1, y1 = paper_bbox(rgb)
    mask = ink_mask(rgb)
    # 종이 밖은 잉크로 치지 않는다 (갈색 배경·스프링 제본)
    outside = np.ones_like(mask)
    outside[y0:y1 + 1, x0:x1 + 1] = 0
    mask[outside == 1] = 0

    # 글자 획을 덩어리로 뭉쳐 문단 단위로 잡는다
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 41), np.uint8))

    elements = []
    seq = 0
    regions: list[tuple[int, int, int, int]] = []
    for (ry0, ry1) in bands(closed, min_gap=min_gap, min_rows=8):
        sub = closed[ry0:ry1 + 1]
        for (cx0, cx1) in split_columns(sub, min_gap=col_gap):
            block = mask[ry0:ry1 + 1, cx0:cx1 + 1]
            if block.sum() < 200:            # 점 하나 수준은 버린다
                continue
            # 실제 잉크에 맞춰 bbox 를 조인다
            r = np.where(block.any(1))[0]
            c = np.where(block.any(0))[0]
            ay0, ay1 = ry0 + int(r.min()), ry0 + int(r.max())
            ax0, ax1 = cx0 + int(c.min()), cx0 + int(c.max())
            regions.append((ax0, ay0, ax1, ay1))

    if not regions:
        raise SystemExit(f"잉크 영역을 찾지 못했습니다: {card}")

    # 위에서 아래로 그린다 = 사람이 노트를 채우는 순서
    regions.sort(key=lambda r: (r[1], r[0]))

    body_ms = max(1000, duration_ms - lead_ms - tail_ms)
    weights = [max(1.0, ((r[2] - r[0]) * (r[3] - r[1])) ** 0.5) for r in regions]
    total_w = sum(weights)
    cursor = lead_ms
    for i, (r, wt) in enumerate(zip(regions, weights)):
        ax0, ay0, ax1, ay1 = r
        dur = int(body_ms * wt / total_w)
        seq += 1
        elements.append({
            "id": f"block-{seq:02d}",
            "label": f"블록 {seq}",
            "sequence": seq,
            "narrativeRole": "카드 구성 요소",
            "subtitle": "",
            "type": "structure",
            "region": {"x": ax0, "y": ay0, "width": ax1 - ax0 + 1, "height": ay1 - ay0 + 1},
            "reveal": {
                "direction": "top_to_bottom",
                "startMs": int(cursor),
                "durationMs": max(320, dur),
                "maskPaddingPx": 10,
                "protectedRegions": [],
            },
            "handPath": {
                "start": [int((ax0 + ax1) / 2), int(ay0)],
                "end": [int((ax0 + ax1) / 2), int(ay1)],
                "easing": "easeInOut",
            },
        })
        cursor += max(320, dur)

    return {
        "sceneId": card.stem,
        "canvas": {"width": int(w), "height": int(h)},
        "storyBasis": f"{card.stem} 카드를 위에서 아래로 손으로 옮겨 적는다.",
        "sceneDurationMs": int(cursor + tail_ms),
        "elements": elements,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("card")
    ap.add_argument("out")
    ap.add_argument("--duration-ms", type=int, default=9000)
    ap.add_argument("--min-gap", type=int, default=18)
    ap.add_argument("--col-gap", type=int, default=110)
    ap.add_argument("--lead-ms", type=int, default=250)
    ap.add_argument("--tail-ms", type=int, default=700)
    a = ap.parse_args()

    data = build(Path(a.card), a.duration_ms, a.min_gap, a.col_gap, a.lead_ms, a.tail_ms)
    Path(a.out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] {a.out}  요소 {len(data['elements'])}개  총 {data['sceneDurationMs']}ms")
    for e in data["elements"]:
        r = e["region"]
        print(f"   {e['sequence']:2d}. x{r['x']:4d} y{r['y']:4d} {r['width']:4d}x{r['height']:4d}"
              f"  start {e['reveal']['startMs']:5d}ms  dur {e['reveal']['durationMs']:5d}ms")


if __name__ == "__main__":
    main()
