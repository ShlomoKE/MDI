import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
// @ts-expect-error — plugin local en JS, sin tipos propios
import rehypeKatexCompacto from "./plugins/rehype-katex-compacto.mjs";

// El sitio es estático: todo el cálculo ocurre en el navegador y el build sale a dist/,
// que es lo que Cloudflare Pages publica.
export default defineConfig({
  plugins: [
    // mdx va antes que react para que el .mdx llegue ya convertido a JSX.
    { enforce: "pre", ...mdx({
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex, rehypeKatexCompacto, rehypeSlug],
        providerImportSource: "@mdx-js/react",
      }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
  ],
  build: {
    target: "es2022",
    // KaTeX pesa; separarlo deja el bundle de la calculadora pequeño y permite
    // que el navegador cachee por separado lo que casi nunca cambia.
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "katex", test: /node_modules[\\/]katex/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // El pool de procesos tarda demasiado en levantar jsdom en Windows/OneDrive.
    pool: "threads",
    // jsdom tarda en arrancar sobre OneDrive; el arranque por defecto se queda corto.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
