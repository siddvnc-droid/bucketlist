#!/usr/bin/env python3
"""Build the Firebase-hosted site (web/) from bucketlist.html.

The app is the same file published on claude.ai. This wraps it in a full
HTML page and loads firebase/firebase-shim.js first, which connects it to
Cloud Firestore. Run this after changing bucketlist.html, then `firebase deploy`.
"""
import hashlib
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
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#EFF0ED" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0C0F" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Bucket List">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>body { margin: 0; }</style>
<script src="firebase-shim.js?v=VERSION"></script>
</head>
<body>
"""


def main():
    src = (ROOT / "bucketlist.html").read_text(encoding="utf-8")
    for old, new in REPLACE.items():
        if src.count(old) != 1:
            raise SystemExit(f"Expected exactly one {old!r} in bucketlist.html")
        src = src.replace(old, new)
    shim = (ROOT / "firebase" / "firebase-shim.js").read_bytes()
    # A new file name for every version, so a page never runs with an older saved copy of the shim.
    version = hashlib.sha256(shim).hexdigest()[:10]
    WEB.mkdir(exist_ok=True)
    (WEB / "index.html").write_text(HEAD.replace("VERSION", version) + src + "\n</body>\n</html>\n", encoding="utf-8")
    (WEB / "firebase-shim.js").write_bytes(shim)
    # Home screen app: manifest, offline helper and icons.
    for name in ("manifest.webmanifest", "sw.js"):
        shutil.copy(ROOT / "firebase" / name, WEB / name)
    (WEB / "icons").mkdir(exist_ok=True)
    for icon in (ROOT / "firebase" / "icons").glob("*.png"):
        shutil.copy(icon, WEB / "icons" / icon.name)
    print("wrote web/ (index.html, firebase-shim.js, manifest, sw.js, icons)")


if __name__ == "__main__":
    main()
