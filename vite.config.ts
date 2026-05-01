import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [preact(), tailwindcss()],

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Desactivar Hot Module Replacement completamente
    hmr: false,
    // Ignorar todos los cambios de archivos para evitar recargas no deseadas
    watch: {
      ignored: ["**/*"],
    },
  },
}));
