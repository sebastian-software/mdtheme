import { getOxlintConfig } from "eslint-config-setup";
import { defineConfig, type OxlintConfig } from "oxlint";

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- getOxlintConfig() is not yet typed against oxlint's own OxlintConfig
const config = getOxlintConfig({ node: true }) as OxlintConfig;

config.ignorePatterns = ["**/dist/**", "coverage/**", "node_modules/**"];

// Scenario tests keep setup, action and assertions together for readability.
config.overrides = [
  ...(config.overrides ?? []),
  { files: ["test/**/*.mjs"], rules: { "max-statements": "off", "max-lines-per-function": "off" } },
];

export default defineConfig(config);
