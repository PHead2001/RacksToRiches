module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "game-does-not-depend-on-ui-or-state",
      severity: "error",
      from: { path: "^src/game" },
      to: {
        path: "^(src/(app|components|store|main)|react$|react/|zustand$|zustand/)",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"] },
    reporterOptions: { dot: { collapsePattern: "node_modules/[^/]+" } },
  },
};
