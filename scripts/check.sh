#!/bin/sh
set -eu
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features --locked -- -D warnings
cargo test --workspace --all-features --locked
cargo run --locked -- --check
cargo run --locked -- --check --config examples/neutral/mdtheme.yaml
sh scripts/verify-package.sh
