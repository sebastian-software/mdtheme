#!/bin/sh
set -eu
cargo package --locked --allow-dirty
package_id=$(cargo pkgid)
version=${package_id##*#}
version=${version##*@}
package_dir="target/package/mdtheme-$version"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
cargo install --path "$package_dir" --root "$scratch/install" --target-dir target/package-build --locked --offline
mkdir "$scratch/consumer"
printf '# Installed native consumer\n' > "$scratch/consumer/README.md.src"
(
  cd "$scratch/consumer"
  "$scratch/install/bin/mdtheme" --write
  "$scratch/install/bin/mdtheme" --check
)
printf 'Native package installation and consumer check passed.\n'
