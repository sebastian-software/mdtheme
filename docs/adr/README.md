# Architecture decisions

ADRs are living documents. Each numbered file describes the current decision
and stays at its original path when that decision evolves. Update the decision,
rationale, consequences, and `Updated` date together. Git history preserves
earlier versions; readers do not need to follow a chain of replacement records.
This keeps current decisions easy to find, at the cost of relying on Git for
the full decision history.

Use `proposed` for an unresolved choice, `accepted` for an agreed direction,
and `deprecated` when a decision no longer applies. Keep one durable decision
per record. Exact dependency versions and executable settings belong in their
configuration files; ADRs explain the constraints and tradeoffs behind them.

- [Markdown and web composition](0001-keep-markdown-and-web-composition-independent.md)
- [Generated README ownership](0002-generate-a-committed-readme-from-separate-source.md)
- [Project language](0003-use-us-english.md)
- [Runtime and CI support](0004-support-node-24-and-test-node-26.md)
- [Native artifacts and Git consumers](0005-commit-built-output-for-git-consumers.md)
- [Rust development toolchain](0006-use-typescript-7-with-tooling-compatibility.md)
- [Standard project badges](0007-use-a-fixed-project-badge-set.md)
- [Local pre-push generation](0008-guard-pushes-with-local-readme-generation.md)
- [Native CLI, YAML configuration, and Git themes](0009-native-cli-and-data-only-themes.md)
- [Native distribution and installation](0010-distribute-native-release-binaries.md)
