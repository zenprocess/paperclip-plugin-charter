/**
 * esbuild config for the plugin manifest and worker bundles.
 *
 * The Paperclip host provides the SDK and all Node built-ins at runtime, so
 * @paperclipai/* and every Node built-in module are marked external.
 *
 * Entry:  src/manifest.ts  → dist/manifest.js
 *         src/worker.ts    → dist/worker.js
 * Format: ESM, platform node, es2022
 *
 * The UI is built separately by build:ui (esbuild.ui.mjs).
 */

import { build } from "esbuild";
import { builtinModules } from "module";

const nodeExternals = builtinModules.flatMap((m) => [m, `node:${m}`]);

await build({
  entryPoints: ["src/manifest.ts", "src/worker.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  external: ["@paperclipai/*", ...nodeExternals],
});

console.log("dist/manifest.js and dist/worker.js built");
