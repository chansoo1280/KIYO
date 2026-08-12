import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: [
            "./src/test/unit.setup.ts",
          ],
          include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
          ],
          exclude: [
            "src/**/*.integration.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "jsdom",
          setupFiles: [
            "./src/test/integration.setup.ts",
          ],
          include: [
            "src/**/*.integration.test.ts",
          ],
        },
      },
    ],
  },
});
