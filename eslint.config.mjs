import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: ["src/game/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "navigator",
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "zustand",
                "zustand/*",
                "../app/*",
                "../components/*",
                "../store/*",
              ],
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Inject timestamps into the deterministic game layer.",
        },
        {
          object: "Math",
          property: "random",
          message: "Use the seeded random module.",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
