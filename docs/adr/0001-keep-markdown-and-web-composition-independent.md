# Keep Markdown and web composition independent

The tool composes Markdown frames and checks generated Markdown. Website shells
are independently authored React layouts in brand packages and consume no API
from this tool. The overlap between the two output paths is too small to justify
a shared rendering contract, configuration, or order synchronization.
