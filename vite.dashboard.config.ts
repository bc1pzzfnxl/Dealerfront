import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * App Vite dédiée au dashboard d'équilibrage (outil LOCAL, séparé du jeu).
 * Racine = src/dashboard : `/` sert le dashboard, jamais le jeu.
 * Usage : bun run dashboard:dev / dashboard:build
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
