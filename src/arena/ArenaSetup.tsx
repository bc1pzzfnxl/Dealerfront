/**
 * Creating / listing agent-vs-agent arenas. Shows the tokens and URLs to
 * hand out to agents (HTTP). See docs/arena.md.
 */

import { useEffect, useState } from "react";
import type { ArenaView, CreateResponse } from "../server/protocol";

interface Props {
	onSpectate: (id: string) => void;
	onBack: () => void;
}

export function ArenaSetup({ onSpectate, onBack }: Props) {
	const [seats, setSeats] = useState(6);
	const [turnTicks, setTurnTicks] = useState(50);
	const [seed, setSeed] = useState("");
	const [created, setCreated] = useState<CreateResponse | null>(null);
	const [lobby, setLobby] = useState<ArenaView | null>(null);
	const [arenas, setArenas] = useState<ArenaView[]>([]);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState("");

	const refresh = async () => {
		try {
			const response = await fetch("/api/arena");
			if (response.ok) setArenas((await response.json()) as ArenaView[]);
		} catch {
			// offline: ignored
		}
	};

	// Poll the lobby while a table is open, so you can watch the agents arrive.
	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), 5000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!created || created.view.phase !== "lobby") return;
		const timer = setInterval(() => {
			void (async () => {
				try {
					const response = await fetch(`/api/arena/${created.view.id}/view`);
					if (response.ok) setLobby((await response.json()) as ArenaView);
				} catch {
					// offline: ignored
				}
			})();
		}, 1500);
		return () => clearInterval(timer);
	}, [created]);

	const create = async () => {
		setBusy(true);
		try {
			const response = await fetch("/api/arena", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					seats,
					turnTicks,
					seed: seed.trim() === "" ? undefined : Number(seed),
				}),
			});
			if (response.ok) {
				const payload = (await response.json()) as CreateResponse;
				setCreated(payload);
				setLobby(payload.view);
			}
		} finally {
			setBusy(false);
		}
	};

	const start = async () => {
		if (!created) return;
		setBusy(true);
		try {
			const response = await fetch(`/api/arena/${created.view.id}/start`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerToken: created.ownerToken }),
			});
			if (response.ok) {
				const view = (await response.json()) as ArenaView;
				setLobby(view);
				setCreated({ ...created, view });
				onSpectate(created.view.id);
			}
		} finally {
			setBusy(false);
		}
	};

	const copy = (value: string) => {
		void navigator.clipboard?.writeText(value);
		setCopied(value);
		setTimeout(() => setCopied(""), 1200);
	};

	const base = location.origin;
	const joinUrl = created ? `${base}/api/arena/${created.view.id}/join` : "";
	const joined = lobby?.agents ?? [];

	/**
	 * The whole point: one click gives an LLM everything it needs (MCP config +
	 * how to join + how to play), so you can paste it and watch it connect.
	 */
	const copyGuide = async () => {
		try {
			const response = await fetch("/api/agent.md");
			let guide = await response.text();
			if (created) guide = guide.replaceAll("<ARENA>", created.view.id);
			await navigator.clipboard?.writeText(guide);
			setCopied("__guide__");
			setTimeout(() => setCopied(""), 1500);
		} catch {
			// clipboard unavailable: ignored
		}
	};

	return (
		<div className="arena-screen">
			<header className="arena-head">
				<h1>Arena — AI agents</h1>
				<button type="button" className="toggle" onClick={() => void copyGuide()}>
					{copied === "__guide__" ? "Copied!" : "Copy to play"}
				</button>
				<button type="button" className="toggle" onClick={onBack}>
					Back
				</button>
			</header>

			{!created ? (
				<section className="card arena-card">
					<h2>Open a table</h2>
					<p className="hint-inline">
						The table opens in a <strong>lobby</strong>: agents join at their own pace, each
						taking its own seat (so its own spawn). You start when you are ready — empty seats
						become AI bots.
					</p>
					<p className="hint-inline">
						<strong>Copy to play</strong> copies a ready-made prompt: paste it into any LLM with
						MCP support (opencode, Cursor, Claude…) and it connects and plays. The same text is
						at <code>{base}/agent.md</code> (or <code>/api/agent.md</code>).
					</p>
					<label className="slider-row" title="Agents + AI bots at the table">
						<span>Seats</span>
						<input
							type="range"
							min={2}
							max={6}
							step={1}
							value={seats}
							onChange={(event) => setSeats(Number(event.target.value))}
						/>
						<code>{seats}</code>
					</label>
					<label className="slider-row">
						<span>Ticks / turn</span>
						<input
							type="range"
							min={10}
							max={200}
							step={10}
							value={turnTicks}
							onChange={(event) => setTurnTicks(Number(event.target.value))}
						/>
						<code>{turnTicks}</code>
					</label>
					<label className="slider-row">
						<span>Seed</span>
						<input
							type="text"
							placeholder="random"
							value={seed}
							onChange={(event) => setSeed(event.target.value)}
						/>
						<code>—</code>
					</label>
					<button type="button" className="expand-btn" disabled={busy} onClick={() => void create()}>
						{busy ? "Opening…" : "Open the table"}
					</button>
				</section>
			) : (
				<section className="card arena-card">
					<h2>
						Arena <em>{created.view.id}</em> — {lobby?.phase ?? created.view.phase}
					</h2>
					<p className="hint-inline">
						Give this URL to your agents: each <strong>POST</strong> takes a free seat and
						returns its own token.
					</p>
					<div className="line">
						<span>Join (POST)</span>
						<code>{joinUrl}</code>
						<button type="button" className="tech-up" onClick={() => copy(joinUrl)}>
							{copied === joinUrl ? "Copied" : "Copy"}
						</button>
					</div>
					<div className="line">
						<span>
							Seats taken <strong>{joined.length}</strong> / {lobby?.seats ?? created.view.seats}
						</span>
						<code>
							{joined.length === 0
								? "waiting for agents…"
								: joined.map((agent) => `f${agent.factionId} ${agent.name}`).join(" · ")}
						</code>
					</div>
					<div className="arena-endpoints">
						<div className="line">
							<span>State (GET)</span>
							<code>
								{base}/api/arena/{created.view.id}/state?token=…
							</code>
						</div>
						<div className="line">
							<span>Action (POST)</span>
							<code>
								{base}/api/arena/{created.view.id}/act
							</code>
						</div>
						<div className="line">
							<span>End turn (POST)</span>
							<code>
								{base}/api/arena/{created.view.id}/endTurn
							</code>
						</div>
						<div className="line">
							<span>MCP</span>
							<code>{base}/mcp</code>
						</div>
					</div>
					<button
						type="button"
						className="expand-btn"
						disabled={
							busy ||
							joined.length === 0 ||
							(lobby?.phase ?? created.view.phase) !== "lobby"
						}
						title={joined.length === 0 ? "At least one agent must join" : "Empty seats become AI bots"}
						onClick={() => void start()}
					>
						{lobby?.phase === "lobby"
							? joined.length === 0
								? "Waiting for an agent to join…"
								: `Start now (${joined.length} agent${joined.length === 1 ? "" : "s"}, ${(lobby?.seats ?? created.view.seats) - joined.length} bot${(lobby?.seats ?? created.view.seats) - joined.length === 1 ? "" : "s"})`
							: "Started"}
					</button>
					{(lobby?.phase ?? created.view.phase) === "playing" ? (
						<button
							type="button"
							className="tech-up"
							title="Advance one turn without waiting for the agents (a stalled LLM must not freeze the table)"
							onClick={() => {
								void fetch(`/api/arena/${created.view.id}/skip`, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ ownerToken: created.ownerToken }),
								});
							}}
						>
							Force turn
						</button>
					) : null}
					<button type="button" className="tech-up" onClick={() => onSpectate(created.view.id)}>
						Watch live
					</button>
				</section>
			)}

			<section className="card arena-card">
				<h2>Arenas</h2>
				{arenas.length === 0 ? (
					<p className="hint-inline">No arenas yet.</p>
				) : (
					arenas.map((arena) => (
						<div className="line" key={arena.id}>
							<span>
								{arena.id} · {arena.phase} · turn {arena.turn} · {arena.agents.length}/
								{arena.seats} agents
							</span>
							<button type="button" className="tech-up" onClick={() => onSpectate(arena.id)}>
								View
							</button>
						</div>
					))
				)}
				<button
					type="button"
					className="tech-up"
					title="Wipes the list and the finished-game history"
					onClick={() => {
						void fetch("/api/lobby/clear", { method: "POST" }).then(() => refresh());
					}}
				>
					Clear list
				</button>
			</section>
		</div>
	);
}
