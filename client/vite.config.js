import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export default defineConfig({
  // versão visível em Perfil › Mais (ajuda a conferir se o deploy subiu)
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false, // registro feito em src/lib/pwa.js (fora do app nativo)
      includeAssets: ["favicon.svg", "app-icons/apple-touch-icon.png", "app-icons/favicon-32.png"],
      manifest: {
        id: "/",
        name: "Meu Talhão — Investindo no agro",
        short_name: "Meu Talhão",
        description: "Invista direto em talhões de fazendas verificadas e acompanhe a safra até a colheita.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#EADFCD",
        theme_color: "#5F8229",
        categories: ["finance", "business"],
        icons: [
          { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/app-icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // só a "casca" do app vai para o cache; dados da API nunca
        globPatterns: ["**/*.{js,css,html,woff2}", "logo-*.svg", "favicon.svg", "app-icons/{icon,maskable}-*.png", "app-icons/apple-touch-icon.png"],
        globIgnores: ["app-icons/splash-*.png", "app-icons/icon-1024.png"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(svg|png)$/.test(url.pathname) && !url.pathname.startsWith("/app-icons/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "ilustracoes", expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    target: ["es2020", "safari15"],
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
