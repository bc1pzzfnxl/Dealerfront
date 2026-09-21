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

function Copy({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className="tech-up"
			onClick={() => {
				void navigator.clipboard?.writeText(value);
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			}}
		>
			{copied ? "Copied" : "Copy"}
		</button>
	);
}

export function ArenaSetup({ onSpectate, onBack }: Props) {
	const [agents, setAgents] = useState(1);
	const [bots, setBots] = useState(5);
	const [seed, setSeed] = useState("");
	const [turnTicks, setTurnTicks] = useState(50);
	const [created, setCreated] = useState<CreateResponse | null>(null);
	const [arenas, setArenas] = useState<ArenaView[]>([]);
	const [busy, setBusy] = useState(false);

	const refresh = async () => {
		try {
			const response = await fetch("/api/arena");
			if (response.ok) setArenas((await response.json()) as ArenaView[]);
		} catch {
			// offline: ignored
		}
	};

	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), 5000);
		return () => clearInterval(timer);
	}, []);

	const create = async () => {
		setBusy(true);
		try {
			const response = await fetch("/api/arena", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					agents,
					bots,
					turnTicks,
					seed: seed.trim() === "" ? undefined : Number(seed),
				}),
			});
			if (response.ok) setCreated((await response.json()) as CreateResponse);
		} finally {
			setBusy(false);
		}
	};

	const base = location.origin;

	return (
		<div className="arena-screen">
			<header className="arena-head">
				<h1>Arena — AI agents</h1>
				<button type="button" className="toggle" onClick={onBack}>
					Back
				</button>
			</header>

			{!created ? (
				<section className="card arena-card">
					<h2>New arena</h2>
					<label className="slider-row">
						<span>Agents</span>
						<input
							type="range"
							min={1}
							max={4}
							step={1}
							value={agents}
							onChange={(event) => {
								const next = Number(event.target.value);
								setAgents(next);
								// Never more than 6 factions in play.
								if (next + bots > 6) setBots(6 - next);
							}}
						/>
						<code>{agents}</code>
					</label>
					<label className="slider-row" title="AI factions the agents fight (the solo setup uses 5)">
						<span>AI bots</span>
						<input
							type="range"
							min={0}
							max={6 - agents}
							step={1}
							value={bots}
							onChange={(event) => setBots(Number(event.target.value))}
						/>
						<code>{bots}</code>
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
						{busy ? "Creating…" : "Create arena"}
					</button>
				</section>
			) : (
				<section className="card arena-card">
					<h2>
						Arena <em>{created.view.id}</em>
					</h2>
					<p className="hint-inline">
						Hand out one <strong>token</strong> per agent. Each agent polls the state, plays its
						actions (as many as it wants) then ends its turn.
					</p>
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
							<span>Map (GET)</span>
							<code>{base}/api/map</code>
						</div>
					</div>
					{created.agents.map((agent) => (
						<div className="line" key={agent.factionId}>
							<span>
								Agent {agent.factionId + 1} — {agent.name}
							</span>
							<code>{agent.token}</code>
							<Copy value={agent.token} />
						</div>
					))}
					<button
						type="button"
						className="expand-btn"
						onClick={() => onSpectate(created.view.id)}
					>
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
								{arena.id} · {arena.phase} · turn {arena.turn} · {arena.agents.length} agents
							</span>
							<button type="button" className="tech-up" onClick={() => onSpectate(arena.id)}>
								View
							</button>
						</div>
					))
				)}
			</section>
		</div>
	);
}
