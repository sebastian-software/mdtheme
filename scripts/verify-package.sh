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
mkdir "$scratch/consumer/theme"
printf 'Brand badge\n' > "$scratch/consumer/theme/badges-prepend.md"
printf 'themes:\n  - directory: theme\n' > "$scratch/consumer/mdtheme.yaml"
printf '# Installed native consumer\n\n<!-- mdtheme:badges:start -->\nOwn badge\n<!-- mdtheme:badges:end -->\n' > "$scratch/consumer/README.md.src"
(
  cd "$scratch/consumer"
  "$scratch/install/bin/mdtheme" --write
  "$scratch/install/bin/mdtheme" --check
  grep -q "Brand badge Own badge" README.md
)
printf 'Native package installation and consumer check passed.\n'
