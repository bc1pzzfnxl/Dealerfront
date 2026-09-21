import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite app dedicated to the balancing dashboard (LOCAL tool, separate from the game).
 * Root = src/dashboard: `/` serves the dashboard, never the game.
 * Usage: bun run dashboard:dev / dashboard:build
 */
export default defineConfig({
	root: fileURLToPath(new URL("./src/dashboard", import.meta.url)),
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	build: {
		outDir: fileURLToPath(new URL("./dist-dashboard", import.meta.url)),
		emptyOutDir: true,
	},
});
