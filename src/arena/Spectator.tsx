/**
 * Arena spectator — live map (WorldMap over a mirror World) + agent
 * standings + end stats. Read-only.
 */

import { useMemo, useRef, useState } from "react";
import { WorldMap } from "../render/WorldMap";
import { FACTION_COLORS } from "../sim/factions";
import { FACTION_SYMBOLS, ZONE_COLORS } from "../render/palette";
import { ZONE_LABELS, type ZoneType } from "../sim/types";
import { useArenaSocket } from "./useArenaSocket";

const fmt = (value: number): string => Math.round(value).toLocaleString("en-US");

export function Spectator({ id, onExit }: { id: string; onExit: () => void }) {
	const { world, view, connected, unavailable, version } = useArenaSocket(id);
	const [selected, setSelected] = useState<number | null>(null);
	const [hovered, setHovered] = useState<number | null>(null);
	const [showZones, setShowZones] = useState(true);
	const projectorRef = useRef<((module: number) => { x: number; y: number } | null) | null>(null);

	const convoys = useMemo(
		() => (world ? world.convoyRoutes() : []),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[world, version],
	);

	if (!world || !view) {
		const waiting = view?.phase === "lobby";
		if (unavailable && !waiting) {
			return (
				<div className="select-screen">
					<h1>Arena {id}</h1>
					<p className="select-pitch">
						This table is unavailable — deleted, or too old to run (open a new one).
					</p>
					<button
						type="button"
						onClick={() => {
							void fetch("/api/lobby/remove", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ id }),
							}).then(() => onExit());
						}}
					>
						Forget this table
					</button>
					<button type="button" onClick={onExit}>
						Back
					</button>
				</div>
			);
		}
		const remain =
			waiting && view.startsAt
				? Math.max(0, Math.ceil((view.startsAt - Date.now()) / 1000))
				: null;
		return (
			<div className="select-screen">
				<h1>Arena {id}</h1>
				<p className="select-pitch">
					{waiting
						? `Lobby open — ${view.agents.length} / ${view.seats} seats taken. Full table + everybody ready starts a 30 s countdown.`
						: connected
							? "Connecting…"
							: "Waiting for the server…"}
				</p>
				{waiting && view.agents.length > 0 ? (
					<p className="hint-inline">
						{view.agents.map((agent) => `${agent.name} ${agent.ready ? "✓" : "…"}`).join(" · ")}
					</p>
				) : null}
				{waiting && remain !== null ? (
					<p className="hint-inline">
						<strong>Starting in {remain} s</strong> — last taunts!
					</p>
				) : null}
				{waiting && view.chat.length > 0 ? (
					<ul className="chat-feed">
						{view.chat.map((message, index) => {
							const speaker =
								view.agents.find((agent) => agent.factionId === message.factionId)
									?.name ?? `Seat ${message.factionId + 1}`;
							return (
								<li key={`${message.at}-${index}`}>
									<strong>{speaker}</strong> {message.text}
								</li>
							);
						})}
					</ul>
				) : null}
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
					strikes={world.pendingStrikes()}
					heat={world.heat}
					tick={world.tick}
					selected={selected}
					colorblind={false}
					version={version}
					playerId={world.player.id}
					zones={world.city.modules}
					showZones={showZones}
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
							{view.phase === "finished" ? "Finished" : "Live"} · {view.ticksPerSecond}× ·{" "}
							{Math.floor(view.tick / 600)} min
						</span>
					</div>
					<div className="top-stats">
						{view.agents.slice(0, 4).map((agent) => (
							<div className="stat" key={agent.factionId} title={agent.name}>
								<span
									className="stat-label"
									style={{ color: FACTION_COLORS[agent.factionId] }}
								>
									{agent.name}
								</span>
								<strong>
									{world.modulesOwned(agent.factionId)}
									<em> · {Math.round(world.controlRatio(agent.factionId) * 100)}%</em>
								</strong>
							</div>
						))}
						{view.agents.length > 4 ? (
							<div className="stat more" title={view.agents.slice(4).map((a) => a.name).join(", ")}>
								<span className="stat-label">+{view.agents.length - 4}</span>
								<strong>more</strong>
							</div>
						) : null}
					</div>
					<div className="top-right">
						<span className="objective">
							<strong>{view.phase === "finished" ? "Finished" : "In progress"}</strong>
							<span className="objective-sub">{connected ? "live" : "disconnected"}</span>
						</span>
						<button
							type="button"
							className={`toggle${showZones ? " active" : ""}`}
							title="Zone borders: which buildings each quarter accepts"
							onClick={() => setShowZones((value) => !value)}
						>
							Zones
						</button>
						<button type="button" className="toggle" onClick={onExit}>
							Exit
						</button>
					</div>
				</header>

				<aside className="panel-left">
					<section className="card chat-card">
						<h2>
							LLM Chat <em>{view.chat.length}</em>
						</h2>
						{view.chat.length > 0 ? (
							<ul className="chat-feed">
								{view.chat.map((message, index) => {
									const speaker =
										world.factions[message.factionId]?.name ??
										view.agents.find((a) => a.factionId === message.factionId)?.name ??
										`Seat ${message.factionId + 1}`;
									return (
										<li key={`${message.at}-${index}`}>
											<strong
												style={{
													color: FACTION_COLORS[message.factionId % FACTION_COLORS.length],
												}}
											>
												{speaker}
											</strong>{" "}
											{message.text}
										</li>
									);
								})}
							</ul>
						) : (
							<p className="hint-inline">No messages yet — LLMs publish plans & taunts here. Left panel = live log.</p>
						)}
						{view.agents.some((a) => a.plan) ? (
							<div className="plans-mini">
								{view.agents
									.filter((a) => a.plan)
									.map((a) => (
										<p className="hint-inline" key={`plan-mini-${a.factionId}`}>
											<span
												className="swatch"
												style={{
													backgroundColor: FACTION_COLORS[a.factionId],
													width: "0.6rem",
													height: "0.6rem",
													display: "inline-block",
													borderRadius: "2px",
													marginRight: "0.3rem",
													verticalAlign: "middle",
												}}
											/>
											<strong>{a.name}</strong> — {a.plan}
										</p>
									))}
							</div>
						) : null}
					</section>
					{view.phase === "lobby" ? (
						<section className="card">
							<h2>Lobby</h2>
							<p className="hint-inline">
								{view.agents.map((a) => `${a.name} ${a.ready ? "✓" : "…"}`).join(" · ")}
							</p>
						</section>
					) : null}
				</aside>

				<aside className="panel-right">
					<section className="card standings-card">
						<h2>
							Standings <em>{world.aliveCount()} in play</em>
						</h2>
						<div className="standings-table">
							<div className="standings-head">
								<span>Faction</span>
								<span className="num">Q · %</span>
								<span className="num">Economy</span>
								<span className="num">War</span>
							</div>
							{ranking.map((factionId, index) => {
								const faction = world.factions[factionId]!;
								const policeTarget = world.police.target === factionId;
								const plan = view.agents.find((a) => a.factionId === factionId)?.plan;
								return (
									<div
										className="standing-row"
										key={factionId}
										style={faction.eliminated ? { opacity: 0.52 } : undefined}
									>
										<div className="standing-main">
											<span className="faction-name" title={faction.name}>
												<span
													className="swatch"
													style={{ backgroundColor: FACTION_COLORS[factionId] }}
												>
													{FACTION_SYMBOLS[factionId % FACTION_SYMBOLS.length]}
												</span>
												<span className="faction-name-text" title={faction.name}>
													{index === 0 && !faction.eliminated ? "👑 " : ""}
													{faction.name}
												</span>
												{faction.eliminated ? <span className="tag">out</span> : null}
												{policeTarget && !faction.eliminated ? (
													<span className="tag hunted">hunted</span>
												) : null}
											</span>
											<code className="num">
												{world.modulesOwned(factionId)}q · {Math.round(world.controlRatio(factionId) * 100)}%
											</code>
											<code className="num eco" title="Members · Product (+transit) · Dirty (+transit) · Clean · Bldg">
												<span className="eco-item" title="Members">
													<span className="eco-icon">◈</span>
													{fmt(faction.members)}
												</span>
												<span className="eco-item" title="Product">
													<span className="eco-icon">⬢</span>
													{fmt(faction.product)}
													{faction.productInTransit >= 1 ? (
														<em className="transit">+{fmt(faction.productInTransit)}</em>
													) : null}
												</span>
												<span className="eco-item" title="Dirty cash">
													<span className="eco-icon">$</span>
													{fmt(faction.dirtyCash)}
													{faction.dirtyInTransit >= 1 ? (
														<em className="transit">+{fmt(faction.dirtyInTransit)}</em>
													) : null}
												</span>
												<span className="eco-item clean" title="Clean cash">
													<span className="eco-icon">$</span>
													{fmt(faction.cleanCash)}
												</span>
											</code>
											<code className="num war" title={`A${faction.tech.armament} P${faction.tech.protection} L${faction.tech.logistics}`}>
												A{faction.tech.armament}·P{faction.tech.protection}·L{faction.tech.logistics} · {faction.captures}↑ · {faction.eliminations}✖
											</code>
										</div>
										{plan ? <p className="standing-plan">📋 {plan}</p> : null}
									</div>
								);
							})}
						</div>
					</section>

					<section className="card">
						<h2>Police</h2>
						<div className="line">
							<span>Pressure</span>
							<div className="gauge" aria-hidden="true">
								<div
									className="gauge-fill"
									style={{ width: `${Math.round(world.police.pressure)}%` }}
								/>
							</div>
							<code>{Math.round(world.police.pressure)}</code>
						</div>
						<div className="line">
							<span>Hunting</span>
							<code>
								{world.police.target >= 0
									? (world.factions[world.police.target]?.name ?? "—")
									: "—"}
							</code>
						</div>
						<div className="line">
							<span>Raids · Liquidations</span>
							<code>
								{world.police.raids} · {world.police.liquidations}
							</code>
						</div>
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
							<p className="hint-inline">
								Duration: {Math.round(view.result.seconds / 60)} min of game time.
							</p>
						</section>
					) : null}
				</aside>

				<footer className="panel-bottom">
					<p className="hud-keys">
						{hovered !== null && hoveredOwner !== null && hoveredOwner >= 0
							? `${world.factions[hoveredOwner]?.name} · control ${Math.round(world.controlAt(hovered))}`
							: "Hover a quarter to inspect it."}
					</p>
					{showZones ? (
						<p className="zone-legend" title="Zone borders: which buildings each quarter accepts">
							{(Object.keys(ZONE_COLORS) as ZoneType[]).map((zone) => (
								<span className="zone-chip" key={zone}>
									<i style={{ backgroundColor: ZONE_COLORS[zone] }} />
									{ZONE_LABELS[zone]}
								</span>
							))}
						</p>
					) : null}
				</footer>
			</div>
		</div>
	);
}
