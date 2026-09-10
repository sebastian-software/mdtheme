# Guard pushes with local README generation

- Status: accepted
- Updated: 2026-09-11

Provide an explicit `mdtheme pre-push` command that users can call from a Git
pre-push hook. Require a clean worktree before loading config or generating
output. After generation, require an unchanged HEAD, a clean worktree, and a
tracked README. The selected config and source must also be tracked and belong
to the current worktree. Block on any generated change and leave it for review
and a user-owned commit.

This catches forgotten regeneration at the point of pushing while preserving
control over commits. Checking the whole worktree is deliberately stricter than
checking only README files: unrelated pending changes also block the push.
Ignored caches remain allowed. No hook dependency, automatic hook installation,
staging, commit, or push is added.

Keep `--check` read-only for CI. Hooks can be bypassed and the local command
checks the current checkout, not each outgoing ref. It therefore complements
CI rather than replacing it. Users who push other branches or tags rely on CI
for those commits. Git must be available and the checkout must have an existing
commit.

Document manual setup, integration with existing hooks, exit statuses, and the
review-and-commit retry workflow. Verify behavior in temporary repositories and
with a real pre-push hook using the packed CLI. Revisit the scope only if users
need validation of arbitrary outgoing refs or several README configs per push.
