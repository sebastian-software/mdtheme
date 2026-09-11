# Native CLI and data-only themes

- Status: accepted
- Updated: 2026-09-11

Replace the early TypeScript implementation with a Rust CLI and YAML configuration.
Users need no Node runtime, package.json, or executable configuration. The user
explicitly approved this breaking change while the project is still young.

Keep Markdown composition, authored whitespace, outer-first frame nesting,
atomic output replacement, read-only checks, exit statuses 0/1/2, project badge
selection, and the clean-worktree pre-push contract. Replace JavaScript imports
and the npm API with a Rust library and CLI. Historical npm/Git releases remain
available; new native releases use Cargo and downloadable binaries.

Discover mdtheme.yaml or mdtheme.yml. Defaults remain README.md.src and README.md.
A theme is a directory containing header.md and footer.md (either may be omitted,
but at least one supported fragment must exist). Configuration selects local directories or Git
repositories with an optional ref and subdirectory. Do not execute theme code,
expand templates, recurse into submodules, or invent a theme registry.

Git sources default to main. Branches, tags, and commit IDs are user choices;
there is no mandatory pin or lockfile. Refresh remote sources on every operation,
including check, so moving branches are useful. Fail when fetching fails rather
than silently using stale data. Fetch into a temporary directory outside the
project and remove it after generation. Start with shallow fetching and fall
back to normal history when a requested revision needs it. Git availability and
remote authentication use the user's normal environment.

A moving branch can change a README without a project commit. That is an accepted
tradeoff. A commit ID is available when reproducibility matters. Source/output
files and Git state remain unchanged by check; temporary theme downloads are
allowed and are cleaned up. Reject theme paths that escape their checkout.

Migration verification: preserve the old implementation in Git history, port
its rendering, filesystem, CLI, metadata, and pre-push scenarios, and add real
Git-source tests for main updates, branches, tags, old commits, failures, and
path escapes. Run format, Clippy, tests, package installation, and README checks.
Native CI targets macOS, Linux, and Windows; release publication and registry
credentials remain separate from implementing and verifying the port.

Workspace selection preserves ordinary glob and exclusion patterns. Extended
Node brace/extglob syntax is rejected with a diagnostic and explicit manifest
paths remain available. Do not silently omit packages when a pattern cannot be
interpreted. The rendering parity corpus was captured from TypeScript commit
87efbe3 and is checked byte-for-byte by the native tests.

This repository consumes the company frame from `sebastian-theme` through its
`markdown/` directory on `main`. Shared brand text belongs to that repository;
do not duplicate it locally. The dependency is Markdown data fetched by Git,
independent of the tool version chosen in mise. Branding changes are reviewed
and merged in the theme repository before regenerating this README.

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
