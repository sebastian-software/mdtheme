#!/bin/sh
# Install a verified native release without Rust, Node, or elevated privileges.
set -eu

fail() { printf 'mdtheme: %s\n' "$*" >&2; exit 1; }
version=latest
bin_dir=${HOME:?HOME must be set}/.local/bin
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version|--bin-dir)
      [ "$#" -ge 2 ] || fail "$1 requires a value"
      case "$1" in --version) version=$2 ;; --bin-dir) bin_dir=$2 ;; esac
      shift 2 ;;
    --help)
      printf 'Usage: sh install.sh [--version X.Y.Z] [--bin-dir PATH]\n'
      exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done
[ -n "$bin_dir" ] || fail 'Installation directory must not be empty'
if [ "$version" != latest ]; then
  printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$' || fail 'Expected a release version such as 0.3.0'
fi
case "$(uname -s)" in
  Darwin) system=apple-darwin ;;
  Linux) system=unknown-linux-gnu ;;
  *) fail 'This installer supports macOS and Linux. Download the Windows archive from GitHub Releases.' ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=aarch64 ;;
  x86_64|amd64) arch=x86_64 ;;
  *) fail 'Unsupported CPU architecture' ;;
esac
for command in curl tar mktemp; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command not found: $command"
done
if command -v sha256sum >/dev/null 2>&1; then
  checksum=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  checksum=shasum
else
  fail 'SHA-256 verification requires sha256sum or shasum'
fi
base=https://github.com/sebastian-software/mdtheme/releases
if [ "$version" = latest ]; then
  base=$base/latest/download
else
  base=$base/download/mdtheme-v$version
fi
archive=mdtheme-$arch-$system.tar.gz
scratch=$(mktemp -d)
staged=
cleanup() {
  rm -rf "$scratch"
  if [ -n "$staged" ]; then rm -f "$staged"; fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
curl --proto '=https' --tlsv1.2 -fsSL "$base/$archive" -o "$scratch/$archive"
curl --proto '=https' --tlsv1.2 -fsSL "$base/SHA256SUMS" -o "$scratch/SHA256SUMS"
expected=$(awk -v name="$archive" '$2 == name { print $1 }' "$scratch/SHA256SUMS")
printf '%s\n' "$expected" | grep -Eq '^[a-fA-F0-9]{64}$' || fail 'Missing or invalid archive checksum'
if [ "$checksum" = sha256sum ]; then
  actual=$(sha256sum "$scratch/$archive" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$scratch/$archive" | cut -d ' ' -f 1)
fi
[ "$actual" = "$expected" ] || fail 'Archive checksum mismatch'
tar -xzf "$scratch/$archive" -C "$scratch" mdtheme
[ -f "$scratch/mdtheme" ] && [ ! -L "$scratch/mdtheme" ] || fail 'Archive does not contain a regular binary'
chmod 755 "$scratch/mdtheme"
installed_version=$("$scratch/mdtheme" --version) || fail 'This binary cannot run on your system. Try building from source.'
if [ "$version" != latest ]; then
  [ "$installed_version" = "$version" ] || fail 'Binary version does not match the requested release'
fi
mkdir -p "$bin_dir"
staged=$(mktemp "$bin_dir/.mdtheme.XXXXXX")
cp "$scratch/mdtheme" "$staged"
chmod 755 "$staged"
mv -f "$staged" "$bin_dir/mdtheme"
staged=
printf 'Installed %s to %s/mdtheme\n' "$installed_version" "$bin_dir"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) printf 'Add %s to your PATH to run mdtheme.\n' "$bin_dir" ;;
esac
