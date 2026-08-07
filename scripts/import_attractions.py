#!/usr/bin/env python3
"""Import taipei-attractions.json into MySQL (Part 1-1)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pymysql

DEFAULT_JSON = Path(__file__).resolve().parent.parent / "data" / "taipei-attractions.json"
IMAGE_SPLIT_RE = re.compile(r"(?=https?://)|(?=/imgs/)")

# 解析髒資料
def parse_image_urls(imgurls: str, img_host: str) -> list[str]:
    """Split concatenated image paths and build absolute URLs."""
    if not imgurls:
        return []

    parts = [p for p in IMAGE_SPLIT_RE.split(imgurls) if p]
    urls: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if part.startswith("http://") or part.startswith("https://"):
            urls.append(part)
        else:
            urls.append(f"{img_host.rstrip('/')}{part if part.startswith('/') else '/' + part}")
    return urls


def load_attractions(json_path: Path) -> tuple[str, list[dict]]:
    with json_path.open(encoding="utf-8") as f:
        payload = json.load(f)
    return payload["img_host"], payload["list"]


def import_data(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    json_path: Path,
) -> None:
    img_host, attractions = load_attractions(json_path)

    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        autocommit=False,
    )

    try:
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=0")
            cur.execute("TRUNCATE TABLE attraction_image")
            cur.execute("TRUNCATE TABLE attraction")
            cur.execute("SET FOREIGN_KEY_CHECKS=1")

            attraction_sql = """
                INSERT INTO attraction
                  (id, name, category, description, address, transport, mrt, lat, lng)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            image_sql = """
                INSERT INTO attraction_image (attraction_id, url, sort_order)
                VALUES (%s, %s, %s)
            """

            total_images = 0
            for item in attractions:
                attraction_id = int(item["_id"])
                mrt = item.get("MRT")
                if mrt == "":
                    mrt = None

                cur.execute(
                    attraction_sql,
                    (
                        attraction_id,
                        item["name"],
                        item["CAT"],
                        item["description"],
                        item["address"],
                        item.get("direction"),
                        mrt,
                        float(item["latitude"]),
                        float(item["longitude"]),
                    ),
                )

                urls = parse_image_urls(item.get("imgurls", ""), img_host)
                for order, url in enumerate(urls):
                    cur.execute(image_sql, (attraction_id, url, order))
                total_images += len(urls)

        conn.commit()
        print(f"Imported {len(attractions)} attractions, {total_images} images from {json_path}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Taipei attractions into MySQL")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--user", default="tdt")
    parser.add_argument("--password", default="tdt")
    parser.add_argument("--database", default="taipei_day_trip")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    args = parser.parse_args()

    if not args.json.exists():
        print(f"JSON not found: {args.json}", file=sys.stderr)
        return 1

    import_data(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        json_path=args.json,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
