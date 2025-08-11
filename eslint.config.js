/**
 * ESLint v9+ flat config
 * Migrated from .eslintrc.js
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import prettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // Matches rules that were disabled in the original config
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "prettier/prettier": "warn"
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tseslint.parser,
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  prettier
];
