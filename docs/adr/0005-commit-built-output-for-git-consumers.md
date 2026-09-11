# Build native artifacts from source

- Status: accepted
- Updated: 2026-09-11

Commit Rust source and `Cargo.lock`; do not commit compiled binaries or `target/`.
Source consumers build with Cargo. Verify package contents and installation in
addition to workspace tests so missing files and packaging errors are caught.

The TypeScript implementation committed `dist/` so immutable Git dependencies
worked without an installation lifecycle. That contract remains true for those
historical revisions. The native port removes `dist/` and replaces npm imports
with a Rust library and executable. New Git consumers need a Rust toolchain to
build source; future downloadable binaries can remove that installation step.

This living record keeps its original filename for existing links. Revisit the
artifact strategy when native release channels are implemented, and verify each
advertised installation path before publishing its documentation.
