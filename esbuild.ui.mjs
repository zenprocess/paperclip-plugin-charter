/**
 * esbuild config for the plugin UI bundle.
 *
 * The Paperclip host provides react, react-dom, and react/jsx-runtime at
 * runtime (confirmed via @paperclipai/plugin-sdk bundlers.js uiExternal list),
 * so those are marked external — the plugin must NOT re-bundle them.
 *
 * Entry:  src/ui/index.tsx
 * Output: dist/ui/index.js  (ESM, browser, es2022)
 */

import { build } from "esbuild";

await build({
  entryPoints: ["src/ui/index.tsx"],
  outdir: "dist/ui",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  jsx: "automatic",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@paperclipai/plugin-sdk/ui",
    "@paperclipai/plugin-sdk/ui/hooks",
  ],
});

console.log("dist/ui/index.js built");
