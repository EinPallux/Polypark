import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";

/**
 * Module boundaries (TECHNICAL_ARCHITECTURE §3) are enforced twice on purpose:
 * here for instant editor/CI feedback, and in .dependency-cruiser.cjs as the
 * graph-level backstop. Keep the two in sync when boundaries change.
 */
const simPurity = {
  files: ["src/sim/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "react",
              "react-*",
              "next",
              "next/*",
              "three",
              "three/*",
              "@react-three/*",
              "zustand",
              "zustand/*",
              "@/render/*",
              "@/ui/*",
              "@/app/*",
              "@/save/*",
              "@/audio/*",
            ],
            message:
              "sim/ is pure simulation: only @/shared and @/content imports are allowed (TECH §3).",
          },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      { name: "Date", message: "No wall clock in sim/ — time comes from ticks (CLAUDE.md)." },
    ],
    "no-restricted-properties": [
      "error",
      {
        object: "Math",
        property: "random",
        message: "Use the seeded RNG streams (sim/core/rng.ts), never Math.random (CLAUDE.md).",
      },
    ],
  },
};

const contentPurity = {
  files: ["src/content/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/*", "!@/shared", "!@/shared/*", "react", "react-*", "three", "three/*"],
            message: "content/ is data + types: only @/shared imports are allowed (TECH §3).",
          },
        ],
      },
    ],
  },
};

const sharedPurity = {
  files: ["src/shared/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/*", "react", "react-*", "next", "next/*", "three", "three/*"],
            message: "shared/ sits below everything: no internal or framework imports (TECH §3).",
          },
        ],
      },
    ],
  },
};

const facadeOnly = {
  files: ["src/render/**/*.{ts,tsx}", "src/ui/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/sim/*", "!@/sim/api"],
            message: "UI/render talk to the simulation only via the SimFacade in @/sim/api (TECH §3).",
          },
        ],
      },
    ],
  },
};

const noSourceAssets = {
  files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
  ignores: ["scripts/build-content.ts", "scripts/lib/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/assets/**"],
            message:
              "/assets is the immutable source library; runtime never imports from it (CLAUDE.md rule 3). Shipped content comes from public/models via the pipeline.",
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "assets/**",
      "uiinspo/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}", "src/ui/**", "src/render/**", "src/app/**"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  simPurity,
  contentPurity,
  sharedPurity,
  facadeOnly,
  noSourceAssets,
  {
    files: ["**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
