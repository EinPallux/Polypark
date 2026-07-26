/**
 * Graph-level module boundary enforcement (TECHNICAL_ARCHITECTURE §3).
 * Mirrors the per-file rules in eslint.config.mjs — keep both in sync.
 * CI runs `pnpm depcruise`; a red graph fails the build.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Runtime import cycles only. Cycles closed exclusively by `import type` edges are " +
        "erased at compile time (verbatimModuleSyntax) — the sim system modules legitimately " +
        "type-reference SimState while state.ts aggregates their value types (TECH §4.1).",
      severity: "error",
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },
    {
      name: "sim-is-pure",
      comment: "sim/ imports only shared/ and content/ (and itself).",
      severity: "error",
      from: { path: "^src/sim" },
      to: {
        path: "^src/(render|ui|app|save|audio)",
      },
    },
    {
      name: "sim-no-frameworks",
      comment: "sim/ must stay portable: no react/three/next/zustand.",
      severity: "error",
      from: { path: "^src/sim" },
      to: {
        path: "^node_modules/(react|react-dom|next|three|@react-three|zustand)",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "content-is-data",
      comment: "content/ imports only shared/ (and itself).",
      severity: "error",
      from: { path: "^src/content" },
      to: { path: "^src/(sim|render|ui|app|save|audio)" },
    },
    {
      name: "shared-is-bottom",
      comment: "shared/ imports nothing from the app.",
      severity: "error",
      from: { path: "^src/shared" },
      to: { path: "^src/(sim|content|render|ui|app|save|audio)" },
    },
    {
      name: "facade-only",
      comment: "UI/render/app reach the sim only through src/sim/api.ts.",
      severity: "error",
      from: { path: "^src/(render|ui|app)" },
      to: { path: "^src/sim", pathNot: "^src/sim/api\\.ts$" },
    },
    {
      name: "no-source-assets",
      comment: "/assets is the immutable source library — never imported at runtime.",
      severity: "error",
      from: { path: "^(src|scripts)", pathNot: "^scripts/(build-content\\.ts|lib)" },
      to: { path: "^assets" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
