import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Keep the core, React wrapper, and editor on one resolved package version.
    // Otherwise a running dev server can retain the pre-editor React bundle
    // while discovering the new editor entry after a dependency update.
    include: ["@pierre/diffs", "@pierre/diffs/edit", "@pierre/diffs/react"],
  },
  ssr: {
    // Bundle the prerender runtime so workspace dependencies share one React.
    // Build-only: under `vite dev` the SSR module runner would inline React's
    // CommonJS entry (`apps/web/node_modules/react/index.js`) and blow up with
    // "module is not defined", so dev keeps dependencies externalized.
    noExternal: command === "build" ? true : undefined,
  },
  worker: {
    format: "es",
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
        },
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
}));
