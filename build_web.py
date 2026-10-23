#!/usr/bin/env python3
"""Build the Firebase-hosted site (web/) from bucketlist.html.

The app is the same file published on claude.ai. This wraps it in a full
HTML page and loads firebase/firebase-shim.js first, which connects it to
Cloud Firestore. Run this after changing bucketlist.html, then `firebase deploy`.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
WEB = ROOT / "web"

REPLACE = {
    "<title>Our Bucket List</title>": "<title>Winter Bucket List</title>",
    "The shared list isn't available in this view. Open it on claude.ai while signed in.":
        "This list opens from its private link. Open the link you were sent, or check your connection and reload.",
}

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<style>body { margin: 0; }</style>
<script src="firebase-shim.js"></script>
</head>
<body>
"""


def main():
    src = (ROOT / "bucketlist.html").read_text(encoding="utf-8")
    for old, new in REPLACE.items():
        if src.count(old) != 1:
            raise SystemExit(f"Expected exactly one {old!r} in bucketlist.html")
        src = src.replace(old, new)
    WEB.mkdir(exist_ok=True)
    (WEB / "index.html").write_text(HEAD + src + "\n</body>\n</html>\n", encoding="utf-8")
    shutil.copy(ROOT / "firebase" / "firebase-shim.js", WEB / "firebase-shim.js")
    print("wrote web/index.html and web/firebase-shim.js")


if __name__ == "__main__":
    main()
