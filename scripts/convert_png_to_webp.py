from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image


def convert_one(png_path: Path) -> Path:
    webp_path = png_path.with_suffix(".webp")

    with Image.open(png_path) as im:
        im.load()
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")

        w, h = im.size
        lossless = max(w, h) <= 512
        save_kwargs = {
            "format": "WEBP",
            "method": 6,
            "lossless": lossless,
        }
        if not lossless:
            save_kwargs["quality"] = 82

        im.save(webp_path, **save_kwargs)

    png_path.unlink()
    return webp_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert all PNGs in public/ to WebP.")
    parser.add_argument(
        "--repo",
        default=str(Path(__file__).resolve().parents[1]),
        help="Path to repo root (default: parent of scripts/)",
    )
    parser.add_argument("--dry-run", action="store_true", help="List files that would be converted without changing anything")
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()
    public_dir = repo_root / "public"

    if not public_dir.exists():
        raise SystemExit(f"public/ folder not found at: {public_dir}")

    png_files: list[Path] = []
    for p in public_dir.rglob("*.png"):
        png_files.append(p)

    if not png_files:
        print("No PNG files found to convert.")
        return 0

    print(f"Found {len(png_files)} PNG(s) to convert:")
    for p in sorted(png_files):
        print(f"- {p.relative_to(repo_root).as_posix()}")

    if args.dry_run:
        print("Dry run: no files converted.")
        return 0

    converted = 0
    for png_path in sorted(png_files):
        webp_path = convert_one(png_path)
        print(
            f"Converted: {png_path.relative_to(repo_root).as_posix()} -> {webp_path.relative_to(repo_root).as_posix()}"
        )
        converted += 1

    print(f"Done. Converted {converted} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
