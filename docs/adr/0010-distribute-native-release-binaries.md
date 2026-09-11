# Distribute native release binaries

Status: accepted  
Updated: 2026-09-11

## Decision

Publish native archives and SHA-256 checksums on GitHub Releases. Offer the
existing Sebastian Software Homebrew tap and a shell installer for macOS and
Linux. Keep source installation through Cargo available; enable crates.io only
when registry publishing is authorized.

The installer defaults to the latest release and `~/.local/bin`, accepts a fixed
version and destination, verifies the checksum, and checks that the binary runs
before replacing an installation. It does not use sudo or edit shell profiles.
CI examples pin a version. The tap verifies its formula through an actual install.

Keep the project below 1.0 while its contracts are still developing. Breaking
changes advance the minor version. The Rust/YAML migration is release 0.3.0.

## Rationale and consequences

Repositories using Rust or other languages can consume mdtheme without adding
Node configuration or compiling the CLI. Release archives are platform-specific;
unsupported platforms can build from source. Checksums share the release's trust
boundary and do not provide independent signing.

Standards integration uses explicit tool installation and the native CLI on PATH.
Checking repository standards must not silently install software. YAML ownership
and setup seeding need an upstream standards change; this release does not claim
that integration is already available. ADRs remain living records as these
contracts evolve.
