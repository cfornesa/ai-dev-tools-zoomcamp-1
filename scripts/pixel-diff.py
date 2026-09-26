"""Measure changed pixels between two same-sized screenshots.

This is intentionally a file-based helper so Playwright can save screenshots
with ``page.screenshot({path})`` and the result can be independently inspected
or attached to a QA issue.  It does not compare compressed image bytes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops


def parse_crop(value: str) -> tuple[int, int, int, int]:
    parts = value.split(",")
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("crop must be x,y,width,height")
    try:
        crop = tuple(int(part) for part in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("crop values must be integers") from exc
    if any(part < 0 for part in crop) or crop[2] == 0 or crop[3] == 0:
        raise argparse.ArgumentTypeError("crop dimensions must be positive")
    return crop


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument(
        "--crop", type=parse_crop, help="crop as x,y,width,height before comparison"
    )
    args = parser.parse_args()

    with Image.open(args.before) as before_image, Image.open(args.after) as after_image:
        before = before_image.convert("RGBA")
        after = after_image.convert("RGBA")
        if before.size != after.size:
            parser.error(f"image sizes differ: {before.size} != {after.size}")
        if args.crop:
            x, y, width, height = args.crop
            box = (x, y, x + width, y + height)
            if box[2] > before.width or box[3] > before.height:
                parser.error("crop extends beyond the image bounds")
            before = before.crop(box)
            after = after.crop(box)

        diff_bytes = ImageChops.difference(before, after).tobytes()
        changed = sum(
            1
            for offset in range(0, len(diff_bytes), 4)
            if diff_bytes[offset : offset + 4] != b"\x00\x00\x00\x00"
        )
        total = before.width * before.height
        print(
            json.dumps(
                {
                    "before": str(args.before),
                    "after": str(args.after),
                    "width": before.width,
                    "height": before.height,
                    "changed_pixels": changed,
                    "total_pixels": total,
                    "changed_percent": changed / total * 100,
                    "crop": args.crop,
                },
                sort_keys=True,
            )
        )


if __name__ == "__main__":
    main()
