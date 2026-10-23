#!/usr/bin/env python3
"""Build the named copies of the bucket list app.

Every copy is the same app as bucketlist.html with its own page title and
heading, so it can be published as a separate page with its own list.
After changing bucketlist.html, run this script and republish each copy.
"""
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / "bucketlist.html"
OUT = ROOT / "copies"

# file name -> (page title, italic word in the heading, rest of the heading)
COPIES = {
    "2027-bucket-list.html": ("2027 Bucket List", "2027", " Bucket List"),
}

TITLE = "<title>Our Bucket List</title>"
HEADING = "<h1><em>Winter</em> Bucket List</h1>"


def main():
    src = SOURCE.read_text(encoding="utf-8")
    for marker in (TITLE, HEADING):
        if src.count(marker) != 1:
            raise SystemExit(f"Expected exactly one {marker!r} in {SOURCE.name}")
    OUT.mkdir(exist_ok=True)
    for name, (title, em, rest) in COPIES.items():
        html = src.replace(TITLE, f"<title>{title}</title>").replace(HEADING, f"<h1><em>{em}</em>{rest}</h1>")
        (OUT / name).write_text(html, encoding="utf-8")
        print(f"wrote copies/{name}")


if __name__ == "__main__":
    main()
