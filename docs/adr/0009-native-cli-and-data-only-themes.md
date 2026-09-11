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
but at least one must exist). Configuration selects local directories or Git
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
