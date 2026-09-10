# Generate a committed README from a separate source

Projects edit `README.md.src` and commit the generated `README.md` so repository
visitors can read it immediately. The write and check commands compute the same
output from pinned theme code and deterministic Markdown formatting; CI checks
for drift without repairing the checkout. This makes source ownership explicit
and avoids mixing hand-authored text with independently updated marker sections.
