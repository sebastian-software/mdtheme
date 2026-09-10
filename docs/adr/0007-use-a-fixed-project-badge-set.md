# Use a fixed project badge set derived from local metadata

- Status: accepted
- Updated: 2026-09-11

The standard project badges cover npm and crates.io versions and downloads,
docs.rs for Rust libraries, CI status, runtime requirements, and declared
package licenses. Brand attribution stays in the brand theme. Codecov,
coverage thresholds, and GitHub release badges are excluded. Other
project-specific claims remain outside the standard set.

These badges help readers find packages and documentation, understand runtime
and licensing constraints, and see usage and build status. A fixed set avoids
maintaining a general badge configuration system. The tradeoff is that a
workspace with several public packages produces a longer row; callers can
select its user-facing packages through the existing `packages` option.

Read local manifests and library targets without running project code or
contacting external services. Generate dynamic image URLs for the viewer to
load. Downloads use npm's monthly count and crates.io's recent count, with
distinct labels. They are not presented as equivalent reporting periods.

Keep each package's declared license and link to its manifest. Do not infer
licenses from file contents or apply an npm workspace root license to members.
Cargo's explicit workspace inheritance is supported. Missing declarations
produce no license badge, and multiple packages remain individually labeled.

`published: false` hides registry versions, downloads, and docs.rs links.
Locally derived licenses, runtime requirements, and CI remain available.
Library discovery establishes whether docs.rs is relevant, not whether a
remote documentation build succeeded.

Tests cover both ecosystems, workspace inheritance, package selection,
unpublished projects, library targets, escaping, and installed-package use.
Revisit the set when readers need another concrete project fact or an external
badge service changes its contract. See the [badge guide](../badges.md).
