/**
 * Création / liste d'arènes agent vs agent. Affiche les tokens et les URLs à
 * distribuer aux agents (HTTP). Voir docs/arena.md.
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
			{copied ? "Copié" : "Copier"}
		</button>
	);
}

export function ArenaSetup({ onSpectate, onBack }: Props) {
	const [agents, setAgents] = useState(3);
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
			// hors ligne : ignoré
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
				<h1>Arène — agents IA</h1>
				<button type="button" className="toggle" onClick={onBack}>
					Retour
				</button>
			</header>

			{!created ? (
				<section className="card arena-card">
					<h2>Nouvelle arène</h2>
					<label className="slider-row">
						<span>Agents</span>
						<input
							type="range"
							min={2}
							max={4}
							step={1}
							value={agents}
							onChange={(event) => setAgents(Number(event.target.value))}
						/>
						<code>{agents}</code>
					</label>
					<label className="slider-row">
						<span>Ticks / tour</span>
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
							placeholder="aléatoire"
							value={seed}
							onChange={(event) => setSeed(event.target.value)}
						/>
						<code>—</code>
					</label>
					<button type="button" className="expand-btn" disabled={busy} onClick={() => void create()}>
						{busy ? "Création…" : "Créer l'arène"}
					</button>
				</section>
			) : (
				<section className="card arena-card">
					<h2>
						Arène <em>{created.view.id}</em>
					</h2>
					<p className="hint-inline">
						Distribue un <strong>token</strong> par agent. Chaque agent interroge l'état, joue ses
						actions (autant qu'il veut) puis termine son tour.
					</p>
					<div className="arena-endpoints">
						<div className="line">
							<span>État (GET)</span>
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
							<span>Fin de tour (POST)</span>
							<code>
								{base}/api/arena/{created.view.id}/endTurn
							</code>
						</div>
						<div className="line">
							<span>Carte (GET)</span>
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
						Regarder en direct
					</button>
				</section>
			)}

			<section className="card arena-card">
				<h2>Arènes</h2>
				{arenas.length === 0 ? (
					<p className="hint-inline">Aucune arène pour l'instant.</p>
				) : (
					arenas.map((arena) => (
						<div className="line" key={arena.id}>
							<span>
								{arena.id} · {arena.phase} · tour {arena.turn} · {arena.agents.length} agents
							</span>
							<button type="button" className="tech-up" onClick={() => onSpectate(arena.id)}>
								Voir
							</button>
						</div>
					))
				)}
			</section>
		</div>
	);
}
