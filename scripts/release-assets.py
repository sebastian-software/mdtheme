"""Upload a complete asset set to a draft, then publish its immutable release."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

REPOSITORY = "sebastian-software/mdtheme"
ARCHIVES = {
    f"mdtheme-{target}.tar.gz"
    for target in (
        "x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu",
        "aarch64-apple-darwin", "x86_64-apple-darwin", "x86_64-pc-windows-msvc",
    )
}
PAYLOAD = ARCHIVES | {"install.sh", "mdtheme.rb"}
ASSETS = PAYLOAD | {"SHA256SUMS"}


def gh(*arguments: str) -> str:
    return subprocess.check_output(
        ["gh", *arguments, "--repo", REPOSITORY], text=True
    )


def require_draft(tag: str) -> None:
    if not re.fullmatch(r"mdtheme-v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", tag):
        raise ValueError("Expected a native mdtheme release tag")
    state = json.loads(gh("release", "view", tag, "--json", "isDraft,tagName"))
    if state != {"isDraft": True, "tagName": tag}:
        raise ValueError("Only the selected draft release can receive assets")


def publish(tag: str, directory: Path) -> None:
    require_draft(tag)
    if {entry.name for entry in directory.iterdir()} != ASSETS:
        raise ValueError("Expected exactly five archives, installer, formula, and checksums")
    checksums = {}
    for line in (directory / "SHA256SUMS").read_text().splitlines():
        digest, filename = line.split()
        if filename in checksums or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("Invalid or duplicate checksum")
        checksums[filename] = digest
    if set(checksums) != PAYLOAD:
        raise ValueError("Checksums must cover every payload asset")
    for filename, digest in checksums.items():
        source = directory / filename
        if source.is_symlink() or not source.is_file() or not source.stat().st_size:
            raise ValueError(f"Expected a nonempty regular asset: {filename}")
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Checksum mismatch: {filename}")
    # Draft retries replace only the known asset set. Published releases are final.
    existing = json.loads(gh("release", "view", tag, "--json", "assets"))["assets"]
    if {asset["name"] for asset in existing} - ASSETS:
        raise ValueError("Draft contains unexpected assets; refusing to publish")
    for asset in existing:
        gh("release", "delete-asset", tag, asset["name"], "--yes")
    gh("release", "upload", tag, *(str(directory / name) for name in sorted(ASSETS)))
    uploaded = json.loads(gh("release", "view", tag, "--json", "assets"))["assets"]
    if {asset["name"] for asset in uploaded} != ASSETS:
        raise ValueError("Uploaded release asset set is incomplete")
    # Check GitHub's digest too, so the bytes on the draft match the attested files.
    for asset in uploaded:
        expected = "sha256:" + hashlib.sha256((directory / asset["name"]).read_bytes()).hexdigest()
        if asset.get("digest") != expected:
            raise ValueError(f"Uploaded asset digest mismatch: {asset['name']}")
    require_draft(tag)
    gh("release", "edit", tag, "--draft=false")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--check-draft":
        require_draft(sys.argv[2])
    else:
        publish(sys.argv[1], Path(sys.argv[2]))
