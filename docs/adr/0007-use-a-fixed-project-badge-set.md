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
select its user-facing packages through the YAML `badges.packages` option.

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
unpublished projects, library targets, escaping, and packaged CLI use.
Revisit the set when readers need another concrete project fact or an external
badge service changes its contract. See the [badge guide](../badges.md).

The native YAML interface enables this feature through `badges.enabled`. Badges
appear immediately before the source, inside all theme frames. Discovery is
relative to the config directory. The implementation language does not change
the standard set or the meaning of publication and workspace options.

Theme badge fragments are part of the data-only composition contract. Optional
`badges-prepend.md` and `badges-append.md` files can constitute a theme on their
own. Compose prepends outer-first and appends inner-first around generated
metadata badges and then authored badges. An explicit, single ordered
`mdtheme:badges:start` / `mdtheme:badges:end` HTML-comment pair selects placement
in the source; without it, use the existing position before the source.
Reject malformed or duplicate markers. Trim fragment boundaries and join with
spaces, preserving interior text and all source outside the slot. Never change
the source file. Existing header/footer-only themes retain their behavior.

Explicit placement avoids guessing which Markdown images or HTML containers
are badges. Authors own inline syntax and HTML compatibility; the tool does not
parse, convert, or deduplicate badge markup. The consequence is a small opt-in
source edit for projects with authored badge rows. Tests cover nested ordering,
legacy output parity, Git badge-only themes, metadata integration, source
preservation, and failure without output replacement.
