/**
 * Worker API — hébergé sur Cloudflare Workers.
 * Route /api/health (voir run_worker_first dans wrangler.jsonc).
 * Aucune base de données au MVP : la simulation tourne côté client.
 */

const HEALTH = {
	service: "dealer-rts",
	status: "ok",
	runtime: "cloudflare-workers",
} as const;

export default {
	fetch(request: Request): Response {
		const { pathname } = new URL(request.url);
		if (pathname === "/api/health") return Response.json(HEALTH);
		return new Response("Not Found", { status: 404 });
	},
};
