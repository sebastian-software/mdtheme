# Support Node.js 24 and test Node.js 26

- Status: accepted
- Updated: 2026-09-10

The CLI, library, and development toolchain require Node.js 24 or newer.
CI runs the full checks, including the installed package consumer, on Node.js
24 and 26. Release builds run on Node.js 24.

Node.js 22 support was considered during maintenance. Keeping Node.js 24 as
the minimum avoids a separate runtime compatibility path and matches the
standards toolchain's requirement. The cost is excluding consumers still on
Node.js 22. Testing Node.js 26 catches compatibility problems before it becomes
the project's development baseline.

Keep the engine requirement in `package.json` and the test matrix in
the [CI workflow](../../.github/workflows/ci.yml). Revisit this decision when
the supported runtime lines or development dependencies change.
