import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  // .claude/worktrees/** contains full checkouts of other branches (each
  // with its own generated build output) used by Claude Code sessions --
  // not part of this branch's source tree, and already excluded from git
  // via .gitignore. remotion/.output/** is Remotion's generated bundle
  // (rebuilt every build via the "prebuild" script, also gitignored) --
  // both would otherwise flood lint output with non-source/generated code.
  // scripts/** are one-off, manually-run Node ops/test scripts (see
  // CLAUDE.md: "not part of a CI suite") -- plain CommonJS outside the
  // Next.js app, require() is correct there, not a lint violation.
  { ignores: [".claude/**", "remotion/.output/**", "scripts/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
