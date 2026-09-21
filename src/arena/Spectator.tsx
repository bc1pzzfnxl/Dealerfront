/**
 * Arena spectator — live map (WorldMap over a mirror World) + agent
 * standings + end stats. Read-only.
 */

import { useMemo, useRef, useState } from "react";
import { WorldMap } from "../render/WorldMap";
import { FACTION_COLORS } from "../sim/factions";
import { ZONE_LABELS } from "../sim/types";
import { useArenaSocket } from "./useArenaSocket";

export function Spectator({ id, onExit }: { id: string; onExit: () => void }) {
	const { world, view, connected, version } = useArenaSocket(id);
	const [selected, setSelected] = useState<number | null>(null);
	const [hovered, setHovered] = useState<number | null>(null);
	const projectorRef = useRef<((module: number) => { x: number; y: number } | null) | null>(null);

	const convoys = useMemo(
		() => (world ? world.convoyRoutes() : []),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[world, version],
	);

	if (!world || !view) {
		return (
			<div className="select-screen">
				<h1>Arena {id}</h1>
				<p className="select-pitch">{connected ? "Connecting…" : "Waiting for the server…"}</p>
				<button type="button" onClick={onExit}>
					Back
				</button>
			</div>
		);
	}

	const ranking = world.rankings();
	const hoveredOwner = hovered !== null ? world.ownerAt(hovered) : null;

	return (
		<div className="game">
			<div className="viewport">
				<WorldMap
					territory={world.territory}
					attacks={world.attacks}
					convoys={convoys}
					heat={world.heat}
					tick={world.tick}
					selected={selected}
					colorblind={false}
					version={version}
					playerId={world.player.id}
					defenseAt={(module) => world.garrisonAt(module)}
					onModuleClick={(module) => setSelected(module)}
					onModuleHover={setHovered}
					onEmptyClick={() => setSelected(null)}
					onProjector={(project) => {
						projectorRef.current = project;
					}}
				/>
			</div>

			<div className="hud">
				<header className="topbar card">
					<div className="brand">
						<h1>Arena {id}</h1>
						<span className="brand-sub">
							{view.phase === "finished" ? "Finished" : "In progress"} · turn {view.turn} · tick{" "}
							{view.tick}
						</span>
					</div>
					<div className="top-stats">
						{view.agents.map((agent) => (
							<div className="stat" key={agent.factionId} title={`${agent.name} — actions this turn`}>
								<span
									className="stat-label"
									style={{ color: FACTION_COLORS[agent.factionId] }}
								>
									{agent.name}
								</span>
								<strong>
									{world.modulesOwned(agent.factionId)}
									<em> · {Math.round(world.controlRatio(agent.factionId) * 100)}%</em>
									{agent.ready ? " ✓" : ""}
								</strong>
							</div>
						))}
					</div>
					<div className="top-right">
						<span className="objective">
							<strong>{view.phase === "finished" ? "Finished" : "In progress"}</strong>
							<span className="objective-sub">{connected ? "live" : "disconnected"}</span>
						</span>
						<button type="button" className="toggle" onClick={onExit}>
							Exit
						</button>
					</div>
				</header>

				<aside className="panel-right">
					<section className="card">
						<h2>Standings</h2>
						{ranking.map((factionId, index) => {
							const faction = world.factions[factionId]!;
							return (
								<div className="line" key={factionId}>
									<span style={{ color: FACTION_COLORS[factionId] }}>
										{index + 1}. {faction.name}
									</span>
									<code>
										{world.modulesOwned(factionId)} q · {Math.round(faction.cleanCash)} clean
									</code>
								</div>
							);
						})}
					</section>

					{selected !== null ? (
						<section className="card">
							<h2>
								Quarter <em>#{selected}</em>
							</h2>
							<div className="line">
								<span>Owner</span>
								<code>
									{world.ownerAt(selected) === -1
										? "Neutral"
										: world.factions[world.ownerAt(selected)]?.name}
								</code>
							</div>
							<div className="line">
								<span>Zone</span>
								<code>{ZONE_LABELS[world.city.modules[selected]!]}</code>
							</div>
							<div className="line">
								<span>Control</span>
								<code>{Math.round(world.controlAt(selected))}</code>
							</div>
						</section>
					) : null}

					{view.result ? (
						<section className="card">
							<h2>Result</h2>
							<p className="hint-inline">{view.result.outcome}</p>
							{view.result.ranking.map((row) => (
								<div className="line" key={row.factionId}>
									<span>
										{row.rank}. {row.name}
									</span>
									<code>
										{row.quarters} q · {row.captures} captures · {row.eliminations} elim.
									</code>
								</div>
							))}
							<p className="hint-inline">Duration: {view.result.turns} turns.</p>
						</section>
					) : null}
				</aside>

				<footer className="panel-bottom">
					<p className="hud-keys">
						{hovered !== null && hoveredOwner !== null && hoveredOwner >= 0
							? `${world.factions[hoveredOwner]?.name} · control ${Math.round(world.controlAt(hovered))}`
							: "Hover a quarter to inspect it."}
					</p>
				</footer>
			</div>
		</div>
	);
}
