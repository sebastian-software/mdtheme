# Use US English for project text

- Status: accepted
- Updated: 2026-09-11

Project documentation, examples, diagnostics, and contribution guidance use
US English. A shared language keeps the public interface and maintenance
instructions consistent across contributors.

Use direct sentences, familiar verbs, and concrete examples. README copy
explains the reader's task and the tool's verified behavior. Technical guides
preserve exact commands, prerequisites, and limitations. Team updates can be
more conversational, but that voice must not remove details readers need to
use the tool correctly. Avoid promotional claims that the project cannot
support with evidence.

The README primarily serves maintainers adopting mdtheme in their own projects.
Lead with the benefit of shared README content, then give a working path from
tool setup to authored source, theme, generated output, and CI. Project-owned
version selection is part of that onboarding path. Explain the files readers
need to add and the result they should see.

Keep implementation languages, runtime comparisons, migration history, and
mdtheme contributor setup out of the onboarding flow. Link to their owning
guides where needed. This favors completing a project task over presenting the
entire API at the entry point. Revisit this structure if the audience changes.
