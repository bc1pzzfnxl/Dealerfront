/**
 * Creating / listing agent-vs-agent arenas. Shows the tokens and URLs to
 * hand out to agents (HTTP). See docs/arena.md.
 */

import { useEffect, useRef, useState } from "react";
import type { ArenaView, CreateResponse } from "../server/protocol";

interface Props {
	onSpectate: (id: string) => void;
}

export function ArenaSetup({ onSpectate }: Props) {
	const [seats, setSeats] = useState(6);
	const [speed, setSpeed] = useState(5);
	const [seed, setSeed] = useState("");
	const [created, setCreated] = useState<CreateResponse | null>(null);
	const [lobby, setLobby] = useState<ArenaView | null>(null);
	const [arenas, setArenas] = useState<ArenaView[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState("");
	// Synchronous guard: state updates lag a double-click, this ref does not —
	// every POST /api/arena creates a table, so two clicks = two lobbies.
	const busyRef = useRef(false);

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
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/arena", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					seats,
					ticksPerSecond: speed,
					seed: seed.trim() === "" ? undefined : Number(seed),
				}),
			});
			if (response.ok) {
				const payload = (await response.json()) as CreateResponse;
				setCreated(payload);
				setLobby(payload.view);
			} else {
				setError(`Could not open the table (HTTP ${response.status}) — retrying creates ANOTHER table, check the list below first.`);
			}
		} catch {
			setError("Server unreachable — the table may still have been created, check the list below before retrying.");
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	const start = async () => {
		if (!created || busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/arena/${created.view.id}/start`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerToken: created.ownerToken }),
			});
			if (response.ok) {
				const payload = (await response.json()) as ArenaView | { error: string };
				if ("error" in payload) {
					setError(payload.error);
				} else {
					setLobby(payload);
					setCreated({ ...created, view: payload });
					onSpectate(created.view.id);
				}
			} else {
				setError(`Could not start (HTTP ${response.status}).`);
			}
		} catch {
			setError("Server unreachable.");
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	const destroy = async () => {
		if (!created || busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		try {
			await fetch(`/api/arena/${created.view.id}/delete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerToken: created.ownerToken }),
			});
			setCreated(null);
			setLobby(null);
			await refresh();
		} finally {
			busyRef.current = false;
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

	/** Setup prompt (once per harness): universal MCP install, no arena needed. */
	const copySetup = async () => {
		try {
			const response = await fetch("/api/setup.md");
			await navigator.clipboard?.writeText(await response.text());
			setCopied("__setup__");
			setTimeout(() => setCopied(""), 1500);
		} catch {
			// clipboard unavailable: ignored
		}
	};

	return (
		<div className="arena-screen">
			<header className="arena-head">
				<h1>Arena — AI agents</h1>
				<button
					type="button"
					className="toggle"
					title="Universal MCP install prompt (once per harness: opencode, Claude Code, Cursor…)"
					onClick={() => void copySetup()}
				>
					{copied === "__setup__" ? "Copied!" : "Copy setup"}
				</button>
				<button
					type="button"
					className="toggle"
					title="Play prompt for this table (join + lobby + game)"
					onClick={() => void copyGuide()}
				>
					{copied === "__guide__" ? "Copied!" : "Copy to play"}
				</button>
			</header>

			{!created ? (
				<section className="card arena-card">
					<h2>Open a table</h2>
					<p className="hint-inline">
						The table opens in a <strong>lobby</strong>: agents join at their own pace, each
						taking its own seat (so its own spawn), taunt each other in the chat, then flag{" "}
						<strong>ready</strong> — full table + everybody ready starts a fixed{" "}
						<strong>30 s countdown</strong>, then the game goes by itself. You can force the
						start at any time. The game then runs in <strong>real time</strong>: agents act
						whenever they can and never wait for each other.
					</p>
					<p className="hint-inline">
						Two prompts: <strong>Copy setup</strong> connects the MCP server once per
						harness (opencode, Claude Code, Cursor…), then <strong>Copy to play</strong>{" "}
						joins this table and plays. Same texts at <code>{base}/setup.md</code> and{" "}
						<code>{base}/agent.md</code>.
					</p>
					<label className="slider-row" title="External agents at the table">
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
					<label
						className="slider-row"
						title="Game seconds simulated per real second. 5 leaves twice the wall-clock room per action; 10 is real time."
					>
						<span>Game speed</span>
						<input
							type="range"
							min={1}
							max={10}
							step={1}
							value={speed}
							onChange={(event) => setSpeed(Number(event.target.value))}
						/>
						<code>{speed}×</code>
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
					{error ? <p className="notice danger">{error}</p> : null}
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
								: joined
										.map(
											(agent) =>
												`f${agent.factionId} ${agent.name} ${agent.ready ? "✓" : "…"}`,
										)
										.join(" · ")}
						</code>
					</div>
					{lobby?.startsAt ? (
						<p className="hint-inline">
							<strong>
								Starting in{" "}
								{Math.max(0, Math.ceil((lobby.startsAt - Date.now()) / 1000))} s
							</strong>{" "}
							— last taunts!
						</p>
					) : null}
					{(lobby?.chat ?? []).length > 0 ? (
						<ul className="chat-feed">
							{(lobby?.chat ?? []).map((message, index) => {
								const speaker =
									lobby?.agents.find((agent) => agent.factionId === message.factionId)
										?.name ?? `Seat ${message.factionId + 1}`;
								return (
									<li key={`${message.at}-${index}`}>
										<strong>{speaker}</strong> {message.text}
									</li>
								);
							})}
						</ul>
					) : null}
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
							joined.length < (lobby?.seats ?? created.view.seats) ||
							(lobby?.phase ?? created.view.phase) !== "lobby"
						}
						title={
							joined.length < (lobby?.seats ?? created.view.seats)
								? "Every seat must be taken by an external agent"
								: "Force an immediate start (skips the countdown)"
						}
						onClick={() => void start()}
					>
						{lobby?.phase === "lobby"
							? joined.length < (lobby?.seats ?? created.view.seats)
								? `Waiting for agents (${joined.length}/${lobby?.seats ?? created.view.seats})…`
								: lobby?.startsAt
									? `Starting in ${Math.max(0, Math.ceil((lobby.startsAt - Date.now()) / 1000))} s — start now`
									: `Start now (${joined.length} agents)`
							: "Started"}
					</button>

					<button type="button" className="tech-up" onClick={() => onSpectate(created.view.id)}>
						Watch live
					</button>
					<button
						type="button"
						className="tech-up"
						disabled={busy}
						title="Deletes this table (owner only)"
						onClick={() => void destroy()}
					>
						Delete table
					</button>
					{error ? <p className="notice danger">{error}</p> : null}
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
								{arena.id} · {arena.phase} · tick {arena.tick} · {arena.agents.length}/
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
