/**
 * Spectateur d'arène — carte live (WorldMap sur un World miroir) + classement
 * des agents + stats de fin. Lecture seule.
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
				<h1>Arène {id}</h1>
				<p className="select-pitch">{connected ? "Connexion…" : "En attente du serveur…"}</p>
				<button type="button" onClick={onExit}>
					Retour
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
						<h1>Arène {id}</h1>
						<span className="brand-sub">
							{view.phase === "finished" ? "Terminée" : "En cours"} · tour {view.turn} · tick{" "}
							{view.tick}
						</span>
					</div>
					<div className="top-stats">
						{view.agents.map((agent) => (
							<div className="stat" key={agent.factionId} title={`${agent.name} — actions ce tour`}>
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
							<strong>{view.phase === "finished" ? "Terminée" : "En cours"}</strong>
							<span className="objective-sub">{connected ? "live" : "déconnecté"}</span>
						</span>
						<button type="button" className="toggle" onClick={onExit}>
							Quitter
						</button>
					</div>
				</header>

				<aside className="panel-right">
					<section className="card">
						<h2>Classement</h2>
						{ranking.map((factionId, index) => {
							const faction = world.factions[factionId]!;
							return (
								<div className="line" key={factionId}>
									<span style={{ color: FACTION_COLORS[factionId] }}>
										{index + 1}. {faction.name}
									</span>
									<code>
										{world.modulesOwned(factionId)} q · {Math.round(faction.cashPropre)} propre
									</code>
								</div>
							);
						})}
					</section>

					{selected !== null ? (
						<section className="card">
							<h2>
								Quartier <em>#{selected}</em>
							</h2>
							<div className="line">
								<span>Propriétaire</span>
								<code>
									{world.ownerAt(selected) === -1
										? "Neutre"
										: world.factions[world.ownerAt(selected)]?.name}
								</code>
							</div>
							<div className="line">
								<span>Zone</span>
								<code>{ZONE_LABELS[world.city.modules[selected]!]}</code>
							</div>
							<div className="line">
								<span>Contrôle</span>
								<code>{Math.round(world.controlAt(selected))}</code>
							</div>
						</section>
					) : null}

					{view.result ? (
						<section className="card">
							<h2>Résultat</h2>
							<p className="hint-inline">{view.result.outcome}</p>
							{view.result.ranking.map((row) => (
								<div className="line" key={row.factionId}>
									<span>
										{row.rank}. {row.name}
									</span>
									<code>
										{row.quarters} q · {row.captures} prises · {row.eliminations} élim.
									</code>
								</div>
							))}
							<p className="hint-inline">Durée : {view.result.turns} tours.</p>
						</section>
					) : null}
				</aside>

				<footer className="panel-bottom">
					<p className="hud-keys">
						{hovered !== null && hoveredOwner !== null && hoveredOwner >= 0
							? `${world.factions[hoveredOwner]?.name} · contrôle ${Math.round(world.controlAt(hovered))}`
							: "Survolez un quartier pour l'inspecter."}
					</p>
				</footer>
			</div>
		</div>
	);
}
