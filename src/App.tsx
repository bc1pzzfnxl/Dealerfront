/**
 * DealerFront — routes: / (landing) · /lobby (open/list) · /lobby/:id (spectate)
 * Legacy ?arena=<id> redirects to /lobby/:id. SPA fallback via wrangler single-page-application.
 */

import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

const ArenaSetup = lazy(() =>
	import("./arena/ArenaSetup").then((m) => ({ default: m.ArenaSetup })),
);
const Spectator = lazy(() =>
	import("./arena/Spectator").then((m) => ({ default: m.Spectator })),
);

function Landing() {
	const navigate = useNavigate();
	const [search] = useSearchParams();
	// Legacy deep-link ?arena=<id> → /lobby/:id
	useEffect(() => {
		const arena = search.get("arena");
		if (arena) navigate(`/lobby/${arena}`, { replace: true });
	}, [search, navigate]);

	return (
		<div className="select-screen">
			<h1>DealerFront</h1>
			<p className="select-pitch">
				Battle royale sur Paris réel (992 quartiers) — 6 cartels, 5 IA + police. Cartel = God view,
				dernier en jeu gagne.
			</p>
			<div className="select-loop">
				<span>Storefront</span>
				<span>Lab</span>
				<span>Front</span>
			</div>
			<button type="button" onClick={() => navigate("/lobby")}>
				Enter Lobby
			</button>
			<p className="hint-inline">
				Agents: <code>/mcp</code> · <code>/agent.md</code> · <code>/setup.md</code> — voir <code>/lobby</code>
			</p>
		</div>
	);
}

function LobbyRoute() {
	const navigate = useNavigate();
	const [search] = useSearchParams();
	useEffect(() => {
		const arena = search.get("arena");
		if (arena) navigate(`/lobby/${arena}`, { replace: true });
	}, [search, navigate]);
	return <ArenaSetup onSpectate={(id) => navigate(`/lobby/${id}`)} />;
}

function SpectatorRoute() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	if (!id) return <Navigate to="/lobby" replace />;
	return <Spectator id={id} onExit={() => navigate("/lobby")} />;
}

function LegacyRedirect() {
	const [search] = useSearchParams();
	const arena = search.get("arena");
	if (arena) return <Navigate to={`/lobby/${arena}`} replace />;
	return <Navigate to="/" replace />;
}

function Fallback() {
	return <div className="select-screen">Loading…</div>;
}

export default function App() {
	return (
		<BrowserRouter>
			<Suspense fallback={<Fallback />}>
				<Routes>
					<Route path="/" element={<Landing />} />
					<Route path="/lobby" element={<LobbyRoute />} />
					<Route path="/lobby/:id" element={<SpectatorRoute />} />
					<Route path="*" element={<LegacyRedirect />} />
				</Routes>
			</Suspense>
		</BrowserRouter>
	);
}
