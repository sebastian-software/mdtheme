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
changes advance the minor version. The first installable Rust/YAML release is
0.3.1. Release 0.3.0 was held back after a version-output mismatch was found in its installer; its tag stays intact.

## Rationale and consequences

Repositories using Rust or other languages can consume mdtheme without adding
Node configuration or compiling the CLI. Release archives are platform-specific;
unsupported platforms can build from source. Checksums share the release's trust
boundary and do not provide independent signing.

Standards does not bundle mdtheme or choose one CLI version for every consumer.
Each project owns an exact tool version, independent of its standards version.
Installations for different versions coexist outside the repository. Local
checks, pre-push, and CI must resolve the project's version explicitly; an
arbitrary global binary on PATH does not satisfy that contract.

Tool installation is an explicit setup operation. Checks must fail on a missing
or mismatched version without installing a replacement or falling back to a
system binary. A tool manager owns downloading, version storage, and resolution;
standards owns repository conventions and validation. YAML ownership and setup
seeding still need an upstream standards change.

## Accepted implementation: scoped mise pilot

Use mise's GitHub backend in this repository's pilot for project-owned version
selection before
building a custom launcher or making mise an organization-wide requirement.
The inspected repositories use exact CI pins but do not establish an existing
shared local tool manager. mise introduces a setup dependency, but could avoid
maintaining our own platform selection, cache, and version resolver.

The scoped pilot is accepted; organization-wide adoption remains undecided.
The pilot must prove platform selection, checksum verification, concurrent project
versions, and failure without downloads or global fallback. The mdtheme source
repository must retain Cargo checks for the current code even if a released CLI
is used to generate its README. See the
[standards integration proposal](../standards-integration.md#project-version-proposal)
for evidence, boundaries, and acceptance criteria.

The executable pilot is documented in [project tools](../project-tools.md).
Its source-build gate remains independent of the released CLI pin. Successful
two-release coexistence is still pending a second usable native release.
