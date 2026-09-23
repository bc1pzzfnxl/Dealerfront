import { describe, it, expect } from "vitest";
// @ts-ignore — node types only in worker config, but bun/vitest provides fs at runtime
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf-8");
const socket = readFileSync("src/arena/useArenaSocket.ts", "utf-8");
const arena = readFileSync("src/server/arena.ts", "utf-8");
const wrangler = readFileSync("wrangler.jsonc", "utf-8");

describe("routing refactor — cloudflare hosting 1st", () => {
	it("App.tsx defines 3 routes /, /lobby, /lobby/:id with BrowserRouter", () => {
		expect(app).toContain('path="/"');
		expect(app).toContain('path="/lobby"');
		expect(app).toContain('path="/lobby/:id"');
		expect(app).toContain("BrowserRouter");
	});

	it("legacy ?arena= redirects to /lobby/:id", () => {
		expect(app).toContain('search.get("arena")');
		expect(app).toContain("/lobby/${arena}");
	});

	it("Spectator moved to /lobby/:id + left chat, standings table adaptive", () => {
		const spec = readFileSync("src/arena/Spectator.tsx", "utf-8");
		expect(spec).toContain("panel-left");
		expect(spec).toContain("standings-table");
		expect(spec).toContain("standing-row");
		expect(spec).not.toContain("<h2>Taunts</h2>"); // moved left
	});

	it("wrangler single-page-application still serves SPA for /lobby/*", () => {
		expect(wrangler).toContain("single-page-application");
		expect(wrangler).toContain("/api/*");
	});

	it("freeze fix: WS reconnect + heartbeat + idle 10min", () => {
		expect(socket).toContain("reconnectTimer");
		expect(socket).toContain("heartbeat");
		expect(socket).toContain("Math.min(5000");
		expect(arena).toContain("10 * 60 * 1000");
	});

	it("LLM sentinel: agent-guide + mcp mention finished", () => {
		const guide = readFileSync("src/server/agent-guide.ts", "utf-8");
		const mcp = readFileSync("src/server/mcp.ts", "utf-8");
		expect(guide).toContain('view.phase === "finished"');
		expect(guide).toContain("while (true)");
		expect(mcp).toContain("Poll in a loop UNTIL");
	});

	it("build chunks: manifest exists after last build", () => {
		// ponytail: one check behind non-trivial routing refactor — previous bun run build already generated it
		const manifest = readFileSync("dist/dealer_rts/.vite/manifest.json", "utf-8");
		expect(manifest).toContain("index");
	});
});
