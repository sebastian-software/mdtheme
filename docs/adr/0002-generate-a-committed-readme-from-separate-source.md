# Generate a committed README from a separate source

- Status: accepted
- Updated: 2026-09-11

Projects edit `README.md.src` and commit the generated `README.md` so repository
visitors can read it immediately. The write and check commands compute the same
output from the selected theme files and deterministic string composition; CI checks
for drift without repairing the checkout. This makes source ownership explicit
and avoids mixing hand-authored text with independently updated marker sections.

Preserve the source and frame text as authored. The generator adds its notice
and the blank lines needed between nonempty sections, using LF for inserted
line breaks. It does not parse Markdown, normalize existing line endings,
rewrite whitespace, or add a final newline. Authors own formatting and the
Markdown validity of their source and frames.

Formatting the complete output with Prettier was previously part of generation.
It adds a runtime dependency and can rewrite deliberate author choices without
helping the tool compose frames or detect drift. Do not replace it with another
formatter or add a formatter option. Projects can format their source before
generation using their own tools. The tradeoff is that generated text can have
mixed styles or line endings; previews remain the primary reading surface.

Existing output must be regenerated once after this change because formatting
is no longer applied. Tests verify exact text preservation and section
boundaries. Revisit this decision if composition needs Markdown parsing for a
concrete feature, rather than for cosmetic consistency.

Remote themes may follow moving branches. Each operation fetches the selected
revision, so unchanged project source can produce new branding. This is an
accepted choice; users can select a commit hash to keep the theme fixed.
