import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { typescriptConfigs } from "@repo/eslint-preset";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const eslintConfig = defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  js.configs.recommended,
  typescriptConfigs,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
]);

export default eslintConfig;
