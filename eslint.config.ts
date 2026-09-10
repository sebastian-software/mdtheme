import { getEslintConfig } from "eslint-config-setup";

const config = await getEslintConfig({ node: true, oxlint: true });

config.unshift({
  ignores: [
    "**/dist/**",
    "coverage/**",
    "node_modules/**",
    "pnpm-lock.yaml",
    "**/*.json",
    "**/*.md",
  ],
});

// CLI paths come from validated local configuration; literal filenames cannot
// express this interface. The filesystem contract is covered by integration tests.
config.push({
  files: ["src/config.ts", "src/files.ts", "src/cli.ts", "test/**/*.mjs", "scripts/**/*.mjs"],
  rules: { "security/detect-non-literal-fs-filename": "off" },
});

// The executable is compiled from this source path to the package's bin entry.
config.push({ files: ["src/cli.ts"], rules: { "node/hashbang": "off" } });

// Scenario tests keep setup, action and assertions together for readability.
config.push({
  files: ["test/**/*.mjs"],
  rules: {
    "max-statements": "off",
    "max-lines-per-function": "off",
    "sonarjs/cognitive-complexity": "off",
  },
});

export default config;
