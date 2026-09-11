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
print('  license "MIT"')
print('\n  depends_on "git"')
for system, suffix in [("macos", "apple-darwin"), ("linux", "unknown-linux-gnu")]:
    print(f'\n  on_{system} do')
    for cpu, arch in [("arm", "aarch64"), ("intel", "x86_64")]:
        name = f"mdtheme-{arch}-{suffix}.tar.gz"
        checksum = hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()
        print('    if Hardware::CPU.arm?' if cpu == 'arm' else '    else')
        print(f'      url "https://github.com/sebastian-software/mdtheme/releases/download/{tag}/{name}"')
        print(f'      sha256 "{checksum}"')
    print('    end')
    print('  end')
print('\n  def install\n    bin.install "mdtheme"\n  end')
print('\n  test do\n    assert_match version.to_s, shell_output("#{bin}/mdtheme --version")\n  end')
print('end')
