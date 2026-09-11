"""Generate a release formula next to the native archives."""
import hashlib
import pathlib
import re
import sys

tag = sys.argv[1]
if not re.fullmatch(r"mdtheme-v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?", tag):
    raise ValueError("Expected a native mdtheme release tag")
print('class Mdtheme < Formula')
print('  desc "Compose Markdown with reusable local and Git themes"')
print('  homepage "https://github.com/sebastian-software/mdtheme"')
print(f'  version "{tag.removeprefix("mdtheme-v")}"')
print('  license "MIT"')
print('  depends_on "git"')
for system, suffix in [("macos", "apple-darwin"), ("linux", "unknown-linux-gnu")]:
    print(f'  on_{system} do')
    for cpu, arch in [("arm", "aarch64"), ("intel", "x86_64")]:
        name = f"mdtheme-{arch}-{suffix}.tar.gz"
        checksum = hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()
        print(f'    on_{cpu} do')
        print(f'      url "https://github.com/sebastian-software/mdtheme/releases/download/{tag}/{name}"')
        print(f'      sha256 "{checksum}"')
        print('    end')
    print('  end')
print('  def install\n    bin.install "mdtheme"\n  end')
print('  test do\n    assert_match version.to_s, shell_output("#{bin}/mdtheme --version")\n  end')
print('end')
