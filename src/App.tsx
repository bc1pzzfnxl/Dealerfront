import { play, setEnabled, setVolume, type SoundName } from "cuelume";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACTION_ICONS, BUILDING_ICONS, RESOURCE_ICONS } from "./render/icons";
import { FACTION_SYMBOLS } from "./render/palette";
import { WorldMap } from "./render/WorldMap";
import {
	BUILDINGS,
	BUILDING_EFFECT_LABELS,
	BUILDING_TYPES,
	chooseBuildType,
	type BuildingType,
	NO_BUILDING,
} from "./sim/buildings";
import { SimClock } from "./sim/clock";
import { SIM_HZ } from "./sim/constants";
import { STRIKE, TECH, TECH_BRANCHES, TECH_LABELS, techCost } from "./sim/tech";
import { POLICE_TIER_LABELS } from "./sim/police";
import { NEUTRAL } from "./sim/territory";
import { ZONE_LABELS } from "./sim/types";
import { World, type GameEvent } from "./sim/world";
import { ArenaSetup } from "./arena/ArenaSetup";
import { Spectator } from "./arena/Spectator";

/** Sound feedback per game event (cuelume). */
const EVENT_SOUND: Record<GameEvent, SoundName> = {
	attack: "pulse",
	capture: "success",
	lost: "error",
	raid: "error",
	strike: "scan",
	tech: "ready",
	pact: "toggle",
	betray: "error",
	embargo: "scan",
	corrupt: "droplet",
	build: "press",
	bust: "scan",
	intercept: "sparkle",
	event: "bloom",
	alert: "error",
	victory: "arrival",
	defeat: "error",
};

function formatCost(type: BuildingType, factor = 1): string {
	const spec = BUILDINGS[type];
	if (spec.costMembers) return `${Math.round(spec.costMembers * factor)} Members`;
	if (spec.costSale) return `${Math.round(spec.costSale * factor)} dirty`;
	if (spec.costClean) return `${Math.round(spec.costClean * factor)} clean`;
	return "—";
}

/** Collapsible card — lightens the UI by hiding secondary panels. */
function Section({
	title,
	aside,
	defaultOpen = true,
	children,
}: {
	title: string;
	aside?: string;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="card">
			<h2 className="collapsible" onClick={() => setOpen((value) => !value)}>
				{title} {aside ? <em>{aside}</em> : null}
				<span className="chevron">{open ? "▾" : "▸"}</span>
			</h2>
			{open ? children : null}
		</section>
	);
}

function App() {
	// `?arena=<id>` deep-links straight into a live spectator (shareable).
	const [arenaId, setArenaId] = useState<string | null>(() =>
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("arena")
			: null,
	);
	const [screen, setScreen] = useState<"select" | "play" | "arena" | "spectate">(() => {
		if (typeof window === "undefined") return "select";
		const params = new URLSearchParams(window.location.search);
		if (params.has("arena")) return "spectate";
		return params.has("play") ? "play" : "select";
	});
	const [seed, setSeed] = useState(1337);
	const [running, setRunning] = useState(true);
	const [version, setVersion] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);
	const [api, setApi] = useState("…");
	const [colorblind, setColorblind] = useState(() => {
		try {
			return localStorage.getItem("df-colorblind") === "1";
		} catch {
			return false;
		}
	});
	/** Help shown on the first game (reminder of the "goal"). */
	const [sound, setSound] = useState(() => {
		try {
			return localStorage.getItem("df-sound") !== "0";
		} catch {
			return true;
		}
	});
	const [showHelp, setShowHelp] = useState(() => {
		try {
			return localStorage.getItem("df-help") !== "1";
		} catch {
			return true;
		}
	});

	const world = useMemo(() => new World(seed), [seed]);
	const [hovered, setHovered] = useState<number | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [shake, setShake] = useState(false);
	const projectorRef = useRef<((module: number) => { x: number; y: number } | null) | null>(null);
	const hoverRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number | null>(null);
	const lastRef = useRef(0);

	useEffect(() => {
		try {
			localStorage.setItem("df-colorblind", colorblind ? "1" : "0");
		} catch {
			// storage unavailable: mode not persisted
		}
	}, [colorblind]);

	// Transient message (rejected action feedback).
	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), 3200);
		return () => clearTimeout(timer);
	}, [notice]);

	// Tooltip: follows the cursor without re-render (imperative transform).
	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			const element = hoverRef.current;
			if (element) {
				element.style.transform = `translate(${event.clientX + 16}px, ${event.clientY + 16}px)`;
			}
		};
		window.addEventListener("mousemove", onMove);
		return () => window.removeEventListener("mousemove", onMove);
	}, []);

	// Volume + sound toggle (local preference).
	useEffect(() => {
		setVolume(0.5);
		setEnabled(sound);
		try {
			localStorage.setItem("df-sound", sound ? "1" : "0");
		} catch {
			// storage unavailable: preference not persisted
		}
	}, [sound]);

	// Game event sounds + screen shake when hit.
	useEffect(() => {
		const events = world.drainEvents();
		if (events.length === 0) return;
		const hit = events.includes("lost") || events.includes("raid");
		if (sound) {
			for (const event of events) play(EVENT_SOUND[event]);
		}
		if (hit) {
			setShake(true);
			const timer = setTimeout(() => setShake(false), 380);
			return () => clearTimeout(timer);
		}
	}, [version, world, sound]);

	// Click on any button → "press" feedback.
	useEffect(() => {
		if (!sound) return;
		const onClick = (event: MouseEvent) => {
			if ((event.target as HTMLElement).closest("button")) play("press", { volume: 0.35 });
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, [sound]);

	// Help is marked "seen" on first display (reopenable via the Help button).
	useEffect(() => {
		try {
			localStorage.setItem("df-help", "1");
		} catch {
			// storage unavailable: help shown again
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/health")
			.then((res) => res.json() as Promise<{ service: string; status: string }>)
			.then((data) => {
				if (!cancelled) setApi(`${data.service} · ${data.status}`);
			})
			.catch(() => {
				if (!cancelled) setApi("unavailable");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Selects the player's starting quarter (opens the build menu).
	useEffect(() => {
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) {
				setSelected(i);
				return;
			}
		}
	}, [world]);

	useEffect(() => {
		if (!running || screen !== "play" || showHelp) return;
		const clock = new SimClock(() => {
			world.step();
			if (world.outcome !== null) setRunning(false);
			setVersion((value) => value + 1);
		}, SIM_HZ);
		lastRef.current = performance.now();
		const loop = (now: number) => {
			const delta = now - lastRef.current;
			lastRef.current = now;
			clock.advance(delta);
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		};
	}, [running, world, screen, showHelp]);

	const player = world.player;
	const selectedOwner = selected !== null ? world.ownerAt(selected) : NEUTRAL;
	const isOwned = selected !== null && selectedOwner === player.id;
	const selectedBuilding = selected !== null ? world.buildingAt(selected) : null;
	const canAttack = selected !== null && world.playerCanAttack(selected);
	const selectedOwnerName =
		selectedOwner === NEUTRAL ? "Neutral" : (world.factions[selectedOwner]?.name ?? "—");

	const build = useCallback(
		(type: BuildingType) => {
			if (selected === null) return;
			if (world.playerBuild(selected, type)) setVersion((value) => value + 1);
		},
		[selected, world],
	);

	/** Contextual action (Q/A): build the advised type, otherwise attack. */
	const act = useCallback(() => {
		if (selected === null) return;
		if (world.ownerAt(selected) === world.player.id) {
			if (world.territory.building[selected] === NO_BUILDING) {
				const type = chooseBuildType(
					world.buildingCounts(world.player.id),
					world.modulesOwned(world.player.id),
					(candidate) => world.playerCanBuild(selected, candidate),
					{ workshop: TECH.maxLevel },
				);
				if (type !== null && world.playerBuild(selected, type)) {
					setVersion((value) => value + 1);
				}
			}
			return;
		}
		if (world.playerAttack(selected)) setVersion((value) => value + 1);
	}, [selected, world]);

	const strikeReason = useCallback((): string | null => {
		if (selected === null) return "no target";
		const owner = world.ownerAt(selected);
		if (owner === player.id) return "already yours";
		if (owner === NEUTRAL) return "neutral target";
		if (player.tech.armament < STRIKE.requiredArmament) {
			return `Armament ≥ ${STRIKE.requiredArmament} required`;
		}
		if (player.strikeCooldown > 0) return `cooldown ${Math.ceil(player.strikeCooldown / SIM_HZ)} s`;
		if (world.pendingStrikes().some((strike) => strike.factionId === player.id)) {
			return "strike already in flight";
		}
		if (player.cleanCash < STRIKE.costClean) return `${STRIKE.costClean} Clean cash required`;
		if (player.members < STRIKE.costMembers) return `${STRIKE.costMembers} Members required`;
		return null;
	}, [selected, world, player]);

	const bustReason = useCallback((): string | null => {
		if (selected === null) return "no target";
		if (world.ownerAt(selected) === player.id) return "already yours";
		if (world.ownerAt(selected) === NEUTRAL) return "neutral target";
		if (!world.canAttack(player.id, selected)) return "not adjacent";
		if (!world.buildingAt(selected)) return "no building";
		if (player.tech.armament < 1) return "Armament ≥ 1 required";
		if (player.bustCooldown > 0) return `cooldown ${Math.ceil(player.bustCooldown / SIM_HZ)} s`;
		const cost = world.bustCost();
		if (player.dirtyCash < cost.sale) return `${cost.sale} dirty required`;
		if (player.members < cost.members) return `${cost.members} Members required`;
		return null;
	}, [selected, world, player]);

	const interceptReason = useCallback((): string | null => {
		if (selected === null) return "no target";
		if (world.ownerAt(selected) === player.id) return "already yours";
		if (world.ownerAt(selected) === NEUTRAL) return "neutral target";
		if (!world.canAttack(player.id, selected)) return "not adjacent";
		if (!world.convoyRoutes().some((route) => route.to === selected)) return "no convoy";
		if (player.tech.armament < 1) return "Armament ≥ 1 required";
		if (player.interceptCooldown > 0) return `cooldown ${Math.ceil(player.interceptCooldown / SIM_HZ)} s`;
		if (player.members < world.interceptCost()) return `${world.interceptCost()} Members required`;
		return null;
	}, [selected, world, player]);

	const batch = world.playerBatchPreview();

	const raidReason = useCallback((): string | null => {
		if (selected === null) return "no target";
		if (world.ownerAt(selected) === NEUTRAL) return "neutral target";
		if (world.ownerAt(selected) === player.id) return "already yours";
		if (!world.canAttack(player.id, selected)) return "not adjacent";
		const cost = world.raidCost();
		if (player.dirtyCash < cost.sale) return `${cost.sale} dirty required`;
		if (player.members < cost.members) return `${cost.members} Members required`;
		if (player.raidCooldown > 0) return `cooldown ${Math.ceil(player.raidCooldown / SIM_HZ)} s`;
		return null;
	}, [selected, world, player]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Escape") {
				setSelected(null);
				return;
			}
			if (event.code === "KeyQ" || event.code === "KeyA") {
				event.preventDefault();
				act();
				return;
			}
			if (event.code === "KeyE") {
				event.preventDefault();
				if (world.playerAttackBest()) setVersion((value) => value + 1);
				else setNotice("Expand: no attackable adjacent target.");
				return;
			}
			if (event.code === "KeyT") {
				event.preventDefault();
				if (selected === null) {
					setNotice("Strike: select an enemy quarter first.");
					return;
				}
				if (world.playerStrike(selected)) setVersion((value) => value + 1);
				else setNotice(`Strike: ${strikeReason() ?? "impossible"}.`);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [act, selected, world, strikeReason]);

	/** Starts a game on the real map (Paris IRIS). */
	const startParis = () => {
		setSelected(null);
		setVersion(0);
		setRunning(true);
		setScreen("play");
	};

	const regenerate = () => {
		setRunning(true);
		setVersion(0);
		setSelected(null);
		setSeed((value) => (value * 1103515245 + 12345) >>> 0);
	};

	const backToSelect = () => {
		setScreen("select");
	};

	const totalModules = world.city.modules.length;
	const cityLabel = "Paris · 992 IRIS quarters";
	const playerPct = Math.round(world.controlRatio(player.id) * 100);
	const perSecond = Math.round(world.productionPerTick(player.id) * SIM_HZ * 10) / 10;
	const afford = (type: BuildingType) => selected !== null && world.playerCanBuild(selected, type);
	const costFactor = (type: BuildingType) =>
		selected !== null ? world.buildCostFactor(player.id, selected, type) : 1;
	const constructionLeft = selected !== null ? world.constructionLeft(selected) : 0;
	const pendingType = selected !== null ? world.pendingBuilding(selected) : null;
	const isConversion = selected !== null && world.isConversion(selected);
	const policeTargeted = world.police.target === player.id;
	const policeTargetName =
		world.police.target >= 0 ? (world.factions[world.police.target]?.name ?? "—") : "—";
	const policeTierLabel = POLICE_TIER_LABELS[world.policeLevel()];
	const summary = world.summary();
	const alive = world.aliveCount();
	const hour = world.hourOfDay();
	const hh = Math.floor(hour);
	const mm = Math.floor((hour - hh) * 60);
	const gameTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
	const isNight = hour < 6 || hour >= 21;
	/** Night depth (0 at midday, 1 around 2 am) — visual veil. */
	const nightOpacity = ((1 + Math.cos((2 * Math.PI * (hour - 2)) / 24)) / 2) * 0.45;

	/** Bootstrapping strategic priority: Lab → Storefront → Front. */
	const advisedType: BuildingType | null =
		world.buildingCount(player.id, "lab") === 0
			? "lab"
			: world.buildingCount(player.id, "storefront") === 0
				? "storefront"
				: world.buildingCount(player.id, "front") === 0 && player.dirtyCash > 1500
					? "front"
					: null;

	const ownedQuarters = world.modulesOwned(player.id);
	const idleQuarters = Math.max(0, ownedQuarters - player.buildings);
	const advisor = (() => {
		if (ownedQuarters < 2) {
			return "Capture an adjacent quarter (select it then Q): 1 building per quarter.";
		}
		// Economic chain: report what's missing first, in order.
		const counts = world.buildingCounts(player.id);
		if (counts.storefront > 0 && counts.lab === 0) {
			return "Your Storefronts buy Product from outside (reduced margin). Build a Lab to produce your own.";
		}
		if (counts.lab > 0 && counts.storefront === 0) {
			return "Your Product sits idle in the lab. Build a Storefront to turn it into Dirty cash.";
		}
		if (counts.storefront > 0 && counts.front === 0) {
			return "Without a Front, Dirty cash piles up without becoming clean (tech, corruption). Build a Front.";
		}
		if (advisedType !== null) {
			const spec = BUILDINGS[advisedType];
			if (spec.costSale && player.dirtyCash < spec.costSale) {
				return `${BUILDINGS[advisedType].label}: ${spec.costSale} Dirty cash required — sell Product or expand.`;
			}
			if (spec.costMembers && player.members < spec.costMembers) {
				return `${BUILDINGS[advisedType].label}: ${spec.costMembers} Members required.`;
			}
			return `${BUILDINGS[advisedType].label} — ${BUILDING_EFFECT_LABELS[advisedType]} (build as a priority).`;
		}
		if (idleQuarters > 0) {
			return `${idleQuarters} empty quarter(s): develop them (Q on an owned quarter).`;
		}
		return "Expand your territory: eliminate rival cartels to remain the last.";
	})();

	/** Economic chain: building → resource, to make the loop readable. */
	const chain: {
		type: BuildingType;
		label: string;
		count: number;
		value: string;
		/** Cargo still on the road (delivered when the convoy arrives). */
		transit: number;
	}[] = [
		{
			type: "housing",
			label: "Recruitment",
			count: world.buildingCount(player.id, "housing"),
			value: `${Math.round(player.members).toLocaleString("en-US")} Members`,
			transit: 0,
		},
		{
			type: "lab",
			label: "Lab",
			count: world.buildingCount(player.id, "lab"),
			value: `${Math.round(player.product)} Product`,
			transit: player.productInTransit,
		},
		{
			type: "storefront",
			label: "Storefront",
			count: world.buildingCount(player.id, "storefront"),
			value: `${Math.round(player.dirtyCash).toLocaleString("en-US")} dirty`,
			transit: player.dirtyInTransit,
		},
		{
			type: "front",
			label: "Front",
			count: world.buildingCount(player.id, "front"),
			value: `${Math.round(player.cleanCash).toLocaleString("en-US")} clean`,
			transit: 0,
		},
	];
	const hoverOwner = hovered !== null ? world.ownerAt(hovered) : NEUTRAL;
	const hoverOwnerName =
		hoverOwner === NEUTRAL ? "Neutral" : (world.factions[hoverOwner]?.name ?? "—");
	const hoverZone = hovered !== null ? world.city.modules[hovered]! : null;
	const hoverBuilding = hovered !== null ? world.buildingAt(hovered) : null;
	const hoverControl = hovered !== null ? Math.round(world.controlAt(hovered)) : 0;
	const hoverPending = hovered !== null ? world.pendingBuilding(hovered) : null;
	const hoverConstruction = hovered !== null ? world.constructionLeft(hovered) : 0;

	const chainNext =
		chain.find((step) => step.type !== "housing" && step.count === 0)?.type ?? null;

	const adjacentTarget = selected !== null && world.canAttack(player.id, selected);
	const engaged = Math.floor(player.members * world.commitRatio());
	const targetDefense = selected !== null ? world.defenseAt(selected) : 1;
	const targetControl = selected !== null ? Math.round(world.controlAt(selected)) : 0;
	const selectedZoneLabel =
		selected !== null ? (ZONE_LABELS[world.city.modules[selected]!] ?? "—") : "—";
	const allowedHere = selected !== null ? world.allowedBuildings(selected) : [];
	/** Reason a building is unavailable on the selected quarter. */
	const blockReason = (type: BuildingType): string | null => {
		if (selected === null) return null;
		if (world.buildingAt(selected) !== null) return "quarter occupied";
		if (world.constructionLeft(selected) > 0) return "build site in progress";
		if (!world.canBuildInZone(selected, type)) return "incompatible zone";
		if (world.activeConstructions(player.id) >= world.buildCrews()) {
			return `crews busy (${world.activeConstructions(player.id)}/${world.buildCrews()})`;
		}
		return null;
	};
	const attackReason = !adjacentTarget
		? "Not adjacent — pick a quarter neighboring your territory."
		: `Insufficient Members (minimum ${world.minCommit()} committed).`;
	const pressure = world.police.pressure;
	const raidFlash = world.police.lastRaidTick >= 0 && world.tick - world.police.lastRaidTick <= 10;
	const alert = policeTargeted && (raidFlash || pressure >= 70);

	if (screen === "arena") {
		return (
			<ArenaSetup
				onSpectate={(id) => {
					setArenaId(id);
					setScreen("spectate");
				}}
				onBack={() => setScreen("select")}
			/>
		);
	}

	if (screen === "spectate" && arenaId) {
		return <Spectator id={arenaId} onExit={() => setScreen("arena")} />;
	}

	if (screen === "select") {
		return (
			<div className="select-screen">
				<h1>DealerFront</h1>
				<p className="select-pitch">
					The cartel on the real map of Paris. Control the territory, produce, sell,
					launder — ahead of the police and rivals.
				</p>
				<div className="select-loop" aria-hidden="true">
					<span>Produce</span>
					<span>Sell</span>
					<span>Launder</span>
				</div>
				<div className="city-choices">
					<button type="button" className="city-card" onClick={startParis}>
						<strong>Play in Paris</strong>
						<em>992 IRIS quarters · 6 cartels · battle royale</em>
						<span>Goal: remain the last cartel standing. Your economy funds the war.</span>
					</button>
					<button type="button" className="city-card" onClick={() => setScreen("arena")}>
						<strong>Arena — AI agents</strong>
						<em>2 to 6 seats · join by HTTP/MCP · live spectator</em>
						<span>Open a table, let your agents take a seat, then start when you want.</span>
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="game">
			<div className={`viewport${shake ? " shake" : ""}`}>
				<WorldMap
					territory={world.territory}
					attacks={world.attacks}
					convoys={world.convoyRoutes()}
					strikes={world.pendingStrikes()}
					heat={world.heat}
					tick={world.tick}
					selected={selected}
					colorblind={colorblind}
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
				<div
					className="night-overlay"
					style={{ opacity: nightOpacity } as React.CSSProperties}
				/>
				<div
					className={`vignette${alert ? " alert" : ""}`}
					style={{ "--pressure": pressure / 100 } as React.CSSProperties}
				/>
				<div className="floaters">
					{world.activeFloaters().map((floater, index) => {
						const point = projectorRef.current?.(floater.module);
						if (!point) return null;
						return (
							<span
								key={`${floater.module}-${floater.until}-${index}`}
								className={`floater ${floater.kind}`}
								style={{ left: point.x, top: point.y }}
							>
								{floater.text}
							</span>
						);
					})}
				</div>
			</div>

			<div ref={hoverRef} className={`hover-card${hovered !== null ? " show" : ""}`}>
				{hovered !== null ? (
					<>
						<div className="hover-head">
							<span className="hover-owner">{hoverOwnerName}</span>
							<span className="hover-zone">{hoverZone ? ZONE_LABELS[hoverZone] : "—"}</span>
						</div>
						<div className="hover-grid">
							<span>
								Control <strong>{hoverControl}</strong>
							</span>
							<span>
								Demand <strong>×{world.demandAt(hovered).toFixed(1)}</strong>
							</span>
							<span>
								Wealth <strong>×{world.wealthAt(hovered).toFixed(1)}</strong>
							</span>
							<span>
								Heat <strong>{Math.round(world.heatAt(hovered))}</strong>
							</span>
						</div>
						<div className="hover-building">
							{hoverConstruction > 0
								? `Build site: ${hoverPending ? BUILDINGS[hoverPending].label : "—"} (${Math.ceil(hoverConstruction / SIM_HZ)} s)`
								: hoverBuilding
									? `${BUILDINGS[hoverBuilding].label} — ${BUILDING_EFFECT_LABELS[hoverBuilding]}${
											hoverOwner !== player.id && hoverOwner !== NEUTRAL
												? ` · loot ${Math.round(
														((BUILDINGS[hoverBuilding].costSale ??
															BUILDINGS[hoverBuilding].costClean ??
															BUILDINGS[hoverBuilding].costMembers ??
															0) *
															0.4),
													).toLocaleString("en-US")}`
												: ""
										}`
									: "No building"}
						</div>
					</>
				) : null}
			</div>

			<div className="hud">
				<header className="topbar card">
					<div className="brand">
						<h1>DealerFront</h1>
						<span className="brand-sub">{cityLabel}</span>
					</div>
					<div className="top-stats">
						<div className="stat" title="Members (troops)">
							<RESOURCE_ICONS.members className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.members).toLocaleString("en-US")}</strong>
						</div>
						<div className="stat" title="Product (lab stock)">
							<RESOURCE_ICONS.product className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.product)}</strong>
						</div>
						<div className="stat" title="Dirty cash (to launder)">
							<RESOURCE_ICONS.sale className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.dirtyCash).toLocaleString("en-US")}</strong>
						</div>
						<div className="stat" title="Clean cash (laundered)">
							<RESOURCE_ICONS.clean className="stat-icon clean" aria-hidden="true" />
							<strong className="clean">
								{Math.round(player.cleanCash).toLocaleString("en-US")}
							</strong>
						</div>
						<div className="stat" title="Share of the map controlled">
							<span className="stat-label">Control</span>
							<strong>{playerPct}%</strong>
						</div>
						<div className="stat" title="Quarters owned">
							<span className="stat-label">Quarters</span>
							<strong>
								{world.modulesOwned(player.id)}
								<em>/{totalModules}</em>
							</strong>
						</div>
						<div className="stat" title="Members produced per second">
							<span className="stat-label">Prod.</span>
							<strong>+{perSecond}/s</strong>
						</div>
					</div>
					<div className="top-right">
						<span className="objective" title="Your rank (1 = leader)">
							<strong>
								Rank {world.playerRank()} · {alive} cartel{alive > 1 ? "s" : ""} in play
							</strong>
							<span className="objective-sub">Last survivor</span>
						</span>
						<span className="timer" title="Survival time">
							{gameTime}
						</span>
					</div>
				</header>

				{world.pendingEvent() ? (
					<div className={`event-card ${world.pendingEvent()!.kind}`}>
						<h3>{world.pendingEvent()!.title}</h3>
						<p>{world.pendingEvent()!.body}</p>
						<div className="event-choices">
							{world.pendingEvent()!.choices.map((choice, index) => (
								<button
									key={choice.label}
									type="button"
									title={choice.detail}
									onClick={() => {
										world.playerChoose(index as 0 | 1);
										setVersion((value) => value + 1);
									}}
								>
									<strong>{choice.label}</strong>
									<em>{choice.detail}</em>
								</button>
							))}
						</div>
					</div>
				) : null}

				<section className="card panel-left">
					<p className="advisor">{advisor}</p>
					{notice ? <p className="notice">{notice}</p> : null}
					{!player.upkeepPaid && world.upkeepPerTick(player.id) > 0 ? (
						<p className="notice danger">
							<strong>Upkeep unpaid</strong> — production ÷2 and watchers blind. Sell
							Product ({world.upkeepPerTick(player.id).toFixed(0)} dirty/s required).
						</p>
					) : null}
					{world.buildingCount(player.id, "counter") > 0 && !world.playerGuardsPaid() ? (
						<p className="notice danger">
							<strong>Watchers unpaid</strong> — intel blinded (no more bust
							alerts). Sell Product to pay them.
						</p>
					) : null}
					{world.bankruptcyTicksLeft() > 0 ? (
						<p className="notice danger">
							<strong>Bankruptcy in {Math.ceil(world.bankruptcyTicksLeft() / SIM_HZ)} s</strong> —
							restart the Product → Dirty cash chain (lab + storefront).
						</p>
					) : null}
					<div className="quarter-head">
						<h2>
							Quarter <em>{selected !== null ? `#${selected}` : "—"}</em>
						</h2>
						<code
							className="quarter-owner"
							style={{
								color:
									selectedOwner === NEUTRAL ? undefined : world.factions[selectedOwner]?.color,
							}}
						>
							{selectedOwnerName}
						</code>
					</div>
					<div className="quarter-stats">
						<span title="Quarter control (0–100)">
							<strong>{selected !== null ? Math.round(world.controlAt(selected)) : "—"}</strong>
							Control
						</span>
						<span title="Local clientele (sales, recruitment)">
							<strong>
								×{selected !== null ? world.demandAt(selected).toFixed(1) : "—"}
							</strong>
							Demand
						</span>
						<span title="Local price and laundering">
							<strong>
								×{selected !== null ? world.wealthAt(selected).toFixed(1) : "—"}
							</strong>
							Wealth
						</span>
						<span title="Local police pressure">
							<strong>{selected !== null ? Math.round(world.heatAt(selected)) : "—"}</strong>
							Heat
						</span>
						<span title="Share of sales connected to a lab">
							<strong>{Math.round(world.retailSupplyRatio(player.id) * 100)}%</strong>
							Logistics
						</span>
						{selectedBuilding ? (
							<span title={BUILDING_EFFECT_LABELS[selectedBuilding]}>
								<strong>{BUILDINGS[selectedBuilding].label}</strong>
								Building
							</span>
						) : (
							<span title="Quarter zoning profile (not a building)">
								<strong>{selectedZoneLabel}</strong>
								Zone
							</span>
						)}
					</div>
					<div className="quarter-foot">
						<span>
							Build sites {world.activeConstructions(player.id)}/{world.buildCrews()}
						</span>
						{selected !== null && selectedBuilding
							? (() => {
									const factor = world.rushFactorAt(selected, selectedBuilding);
									if (Math.abs(factor - 1) < 0.02) return null;
									const peak = factor > 1;
									return (
										<span className={`rush-tag ${peak ? "peak" : "off"}`}>
											{peak ? "Peak" : "Off-peak"} ×{factor.toFixed(2)}
										</span>
									);
								})()
							: null}
					</div>

					<div className="action-grid">
					<button
						type="button"
						className="action-btn"
						title="Automatically attacks the weakest neighboring quarter (neutral or enemy outside a pact)."
						onClick={() => {
							if (world.playerAttackBest()) setVersion((value) => value + 1);
							else setNotice("Expand: no attackable adjacent target.");
						}}
					>
						Expand <em><kbd>E</kbd></em>
					</button>

					<button
						type="button"
						className="action-btn"
						disabled={!world.playerCanBuyArmament()}
						title={`War chest: +25% attack for 40 s (stacks ×3). Rising Clean cash cost.`}
						onClick={() => {
							if (world.playerBuyArmament()) setVersion((value) => value + 1);
						}}
					>
						Armament <em>{world.armamentCost().toLocaleString("en-US")}</em>
					</button>

					<button
						type="button"
						className="action-btn"
						disabled={!world.playerCanHireMercenaries()}
						title={`Mercenaries: +${world.mercMembers()} immediate Members. Rising Dirty cash cost.`}
						onClick={() => {
							if (world.playerHireMercenaries()) setVersion((value) => value + 1);
						}}
					>
						Mercenaries <em>{world.mercCost().toLocaleString("en-US")}</em>
					</button>
					</div>

					<label
						className="slider-row"
						title="Share of your Members committed to each assault. The rest defends your quarters: over-committing weakens you."
					>
						<span>Commitment</span>
						<input
							type="range"
							min={10}
							max={80}
							step={5}
							value={Math.round(world.playerAttackRatio() * 100)}
							onChange={(event) => {
								world.playerSetAttackRatio(Number(event.target.value) / 100);
								setVersion((value) => value + 1);
							}}
						/>
						<code title={`Assault ${engaged.toLocaleString("en-US")} · Defense ${Math.max(0, Math.round(player.members - engaged)).toLocaleString("en-US")}`}>
							{Math.round(world.playerAttackRatio() * 100)}% ·{" "}
							{engaged.toLocaleString("en-US")}
							<em className="def-part">
								/{Math.max(0, Math.round(player.members - engaged)).toLocaleString("en-US")}
							</em>
						</code>
					</label>

					{isOwned ? (
						constructionLeft > 0 ? (
							<p className="hint-inline">
								<strong>Build site:</strong> {pendingType ? BUILDINGS[pendingType].label : "—"} —
								{Math.ceil(constructionLeft / SIM_HZ)} s left
							</p>
						) : selectedBuilding ? (
							<p className="hint-inline">
								<strong>Occupied:</strong> {BUILDINGS[selectedBuilding].label} —{" "}
								{BUILDING_EFFECT_LABELS[selectedBuilding]}.
							</p>
						) : (
							<>
								<div className="build-menu">
									{BUILDING_TYPES.map((type) => {
										const reason = blockReason(type);
										const zoneBlocked = reason === "zone incompatible";
										const Icon = BUILDING_ICONS[type];
										const bonus =
											selected !== null
												? world.zoneBonusAt(selected, type)
												: 1;
										const owned = world.buildingCount(player.id, type);
										return (
											<button
												key={type}
												type="button"
												className={bonus > 1 ? "bonus" : undefined}
												disabled={!afford(type)}
												title={`${BUILDINGS[type].label}: ${BUILDING_EFFECT_LABELS[type]}${bonus > 1 ? ` · zone ×${bonus.toFixed(2)}` : ""}${owned > 0 ? ` · ${owned} already built (cost +35%/unit)` : ""}${reason ? ` — ${reason}` : ""}`}
												onClick={() => build(type)}
											>
												<Icon className="build-icon" aria-hidden="true" />
												{bonus > 1 ? (
													<span className="bonus-tag">×{bonus.toFixed(2)}</span>
												) : null}
												<em className={zoneBlocked ? "zone" : reason ? "lack" : undefined}>
													{zoneBlocked ? "zone" : formatCost(type, costFactor(type))}
												</em>
											</button>
										);
									})}
								</div>
								<p
									className="hint-inline"
									title={allowedHere.map((type) => BUILDINGS[type].label).join(", ")}
								>
									Zone <strong>{selectedZoneLabel}</strong> —{" "}
									{isConversion ? "conversion −50%" : "build site"}.
								</p>
							</>
						)
					) : (
						<div className="command-bar">
							{(() => {
								const AttackIcon = ACTION_ICONS.attack;
								const actions: {
									key: string;
									icon: typeof AttackIcon;
									label: string;
									hotkey?: string;
									title: string;
									disabled: boolean;
									run: () => void;
								}[] = [
									{
										key: "attack",
										icon: AttackIcon,
										label: canAttack ? `${engaged} committed` : "Assault",
										hotkey: "Q",
										title: canAttack
											? `Assault: ${engaged} committed · control ${targetControl} · defense ×${targetDefense.toFixed(1)}${world.buildingAt(selected!) === "safehouse" ? " (safehouse)" : ""}`
											: attackReason,
										disabled: !canAttack,
										run: act,
									},
								];
								if (selectedOwner === NEUTRAL && world.canAttack(player.id, selected!)) {
									const BuyIcon = ACTION_ICONS.buy;
									const cost = world.buyCost(selected!);
									actions.push({
										key: "buy",
										icon: BuyIcon,
										label: cost.toLocaleString("en-US"),
										title: `Buy this quarter at a premium (Clean cash) — rising cost with your empire.`,
										disabled: !world.playerCanBuy(selected!),
										run: () => {
											if (selected !== null && world.playerBuy(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice("Buyout: insufficient Clean cash or on cooldown.");
											}
										},
									});
								}
								if (selectedOwner !== player.id && selectedOwner !== NEUTRAL) {
									const RaidIcon = ACTION_ICONS.raid;
									actions.push({
										key: "raid",
										icon: RaidIcon,
										label: `${world.raidCost().sale}`,
										title: raidReason() ?? "Raid: destroys control and buildings, without capturing",
										disabled: raidReason() !== null,
										run: () => {
											if (selected !== null && world.playerRaid(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Raid: ${raidReason() ?? "impossible"}.`);
											}
										},
									});
								}
								if (selectedOwner !== player.id && selectedBuilding) {
									const BustIcon = ACTION_ICONS.bust;
									actions.push({
										key: "bust",
										icon: BustIcon,
										label: "loot",
										title:
											bustReason() ??
											`Bust: steals loot without destroying the building${selected !== null && world.guardsAt(selected) >= 1 ? ` · ${world.guardsAt(selected)} watcher(s) — ${world.guardsAt(selected) >= 2 ? "loot ZERO" : "loot halved"}` : ""}`,
										disabled: bustReason() !== null,
										run: () => {
											if (selected !== null && world.playerBust(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Bust: ${bustReason() ?? "impossible"}.`);
											}
										},
									});
									const InterceptIcon = ACTION_ICONS.intercept;
									actions.push({
										key: "intercept",
										icon: InterceptIcon,
										label: `${world.interceptCost()}`,
										title:
											interceptReason() ??
											"Interception: diverts a convoy and cuts the line",
										disabled: interceptReason() !== null,
										run: () => {
											if (selected !== null && world.playerIntercept(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Interception: ${interceptReason() ?? "impossible"}.`);
											}
										},
									});
								}
								if (selectedOwner !== player.id) {
									const StrikeIcon = ACTION_ICONS.strike;
									actions.push({
										key: "strike",
										icon: StrikeIcon,
										label: "T",
										hotkey: "T",
										title:
											strikeReason() ??
											`Heavy strike: telegraphed area strike, lands in ${STRIKE.delayTicks / SIM_HZ}s (Armament ≥ ${STRIKE.requiredArmament})`,
										disabled: strikeReason() !== null,
										run: () => {
											if (selected !== null && world.playerStrike(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Strike: ${strikeReason() ?? "impossible"}.`);
											}
										},
									});
								}
								return actions.map((action) => {
									const Icon = action.icon;
									return (
										<button
											key={action.key}
											type="button"
											className="command"
											disabled={action.disabled}
											title={action.title}
											onClick={action.run}
										>
											<Icon className="command-icon" aria-hidden="true" />
											<span className="command-label">{action.label}</span>
											{action.hotkey ? <kbd>{action.hotkey}</kbd> : null}
										</button>
									);
								});
							})()}
						</div>
					)}
					{batch.count > 0 ? (
						<section className="card batch-card">
							<h2>
								Batch <em>{batch.count} quarter(s)</em>
							</h2>
							<div className="batch-row">
								<code>
									{batch.sale > 0 ? `${batch.sale.toLocaleString("en-US")} dirty ` : ""}
									{batch.members > 0 ? `${batch.members.toLocaleString("en-US")} Members ` : ""}
									{batch.clean > 0 ? `${batch.clean.toLocaleString("en-US")} clean` : ""}
								</code>
								<button
									type="button"
									onClick={() => {
										world.playerBatchBuild();
										setVersion((value) => value + 1);
									}}
								>
									Develop
								</button>
							</div>
						</section>
					) : null}
				</section>

				<aside className="panel-right">
					<section className={`card police${policeTargeted ? " targeted" : ""}`}>
						<h2>
							Police <em>{policeTierLabel}</em>
						</h2>
						<div className="line">
							<span>Pressure</span>
							<div className="gauge" aria-hidden="true">
								<div className="gauge-fill" style={{ width: `${pressure}%` }} />
							</div>
							<code>{Math.round(pressure)}</code>
						</div>
						<div className="line">
							<span>Targeting</span>
							<code
								style={{
									color:
										world.police.target >= 0
											? world.factions[world.police.target]?.color
											: undefined,
								}}
							>
								{policeTargetName}
								{policeTargeted ? " (you)" : ""}
							</code>
						</div>
						<div className="line">
							<span>Raids</span>
							<code>{world.police.raids}</code>
						</div>
						<div className="line">
							<span>Contact</span>
							<code>{world.contactName}</code>
						</div>
						<button
							type="button"
							disabled={!world.playerCanCorrupt()}
							onClick={() => {
								if (world.playerCorrupt()) setVersion((value) => value + 1);
							}}
						>
							Bribe ({world.playerCorruptionCost().toLocaleString("en-US")})
						</button>
					</section>

					<Section
						title="Tech"
						aside={`${world.buildingCount(player.id, "workshop")} workshop(s)`}
					>
						{TECH_BRANCHES.map((branch) => {
							const level = player.tech[branch];
							const max = world.maxTechLevel(player.id);
							const canUp = world.canUpgradeTech(player.id, branch);
							return (
								<div className="line" key={branch}>
									<span>
										{TECH_LABELS[branch]}{" "}
										<em className="tech-level">
											{level}/{TECH.maxLevel}
										</em>
									</span>
									<button
										type="button"
										className="tech-up"
										disabled={!canUp}
										onClick={() => {
											if (world.playerUpgradeTech(branch)) setVersion((value) => value + 1);
										}}
									>
										{level >= max ? "—" : `${techCost(level + 1)}`}
									</button>
								</div>
							);
						})}
					</Section>

					<Section
						title="Diplomacy"
						aside={`${world.pacts.length} pact(s)`}
						defaultOpen={false}
					>
						{world.playerOffers().map((offer) => (
							<div className="dip-row" key={`offer-${offer.from}`}>
								<span>{world.factions[offer.from]?.name} proposes a pact</span>
								<span className="offer-actions">
									<button
										type="button"
										className="tech-up"
										onClick={() => {
											world.playerRespondToOffer(offer.from, true);
											setVersion((value) => value + 1);
										}}
									>
										Accept
									</button>
									<button
										type="button"
										className="tech-up"
										onClick={() => {
											world.playerRespondToOffer(offer.from, false);
											setVersion((value) => value + 1);
										}}
									>
										Decline
									</button>
								</span>
							</div>
						))}
						{world.factions.map((faction) => {
							const isSelf = faction.isPlayer;
							const relation = Math.round(world.relationBetween(player.id, faction.id));
							const pacted = !isSelf && world.playerHasPact(faction.id);
							return (
								<div className={`dip-row${isSelf ? " is-player" : ""}`} key={faction.id}>
									<span className="faction-name">
										<span className="swatch" style={{ backgroundColor: faction.color }}>
											{FACTION_SYMBOLS[faction.id % FACTION_SYMBOLS.length]}
										</span>
										{faction.name}
										{world.police.target === faction.id ? <span className="tag">leader</span> : null}
										{!isSelf && world.isTraitor(faction.id) ? (
											<span className="tag">traitor</span>
										) : null}
										{!isSelf && world.playerHasEmbargo(faction.id) ? (
											<span className="tag">embargo</span>
										) : null}
									</span>
									<code>
										{Math.round(world.controlRatio(faction.id) * 100)}%
										{isSelf ? "" : ` · ${relation}`}
									</code>
									{isSelf ? (
										<span />
									) : pacted ? (
										<button
											type="button"
											className="tech-up"
											onClick={() => {
												if (world.playerBreakPact(faction.id)) setVersion((value) => value + 1);
											}}
										>
											Betray
										</button>
									) : (
										<span className="offer-actions">
											<button
												type="button"
												className="tech-up"
												disabled={!world.playerCanProposePact(faction.id)}
												onClick={() => {
													if (world.playerProposePact(faction.id)) setVersion((value) => value + 1);
												}}
											>
												Pact
											</button>
											<button
												type="button"
												className="tech-up"
												disabled={!world.playerCanEmbargo(faction.id)}
												onClick={() => {
													if (world.playerEmbargo(faction.id)) setVersion((value) => value + 1);
												}}
											>
												Embargo
											</button>
											<button
												type="button"
												className="tech-up"
												disabled={
													!world.playerCanFundContract(faction.id) ||
													world.police.target < 0 ||
													world.police.target === faction.id
												}
												title={`Pay ${faction.name} to strike the leader. Cost ${world.contractCost().toLocaleString("en-US")} Clean cash (rising).`}
												onClick={() => {
													const leader = world.police.target;
													if (leader >= 0 && world.playerFundContract(faction.id, leader)) {
														setVersion((value) => value + 1);
													}
												}}
											>
												Contract
											</button>
										</span>
									)}
								</div>
							);
						})}
					</Section>
				</aside>

				<footer className="panel-bottom">
					<section className="card loop-card">
						<h2>Loop</h2>
						{chain.map((step) => (
							<div
								className={`loop-row${step.type === chainNext ? " next" : ""}`}
								key={step.type}
							>
								<span>
									{step.label} <em>×{step.count}</em>
									{step.transit >= 1 ? (
										<b
											className="transit"
											title="On the road — only lands when the convoy arrives (and can be intercepted)"
										>
											+{Math.round(step.transit).toLocaleString("en-US")} in transit
										</b>
									) : null}
								</span>
								<code className={step.type === "front" ? "clean" : undefined}>
									{step.value}
								</code>
							</div>
						))}
						<div className="loop-row" title="Upkeep cost of all your buildings (Dirty cash/s)">
							<span>
								Upkeep <em>{world.buildingCount(player.id, "lab") + world.buildingCount(player.id, "storefront") + world.buildingCount(player.id, "front")} bldgs.</em>
							</span>
							<code className={player.upkeepPaid ? undefined : "lack"}>
								−{(world.upkeepPerTick(player.id) * SIM_HZ).toFixed(0)}/s
							</code>
						</div>
						<label className="slider-row" title="Share of Front capacity laundered">
							<span>Laundering</span>
							<input
								type="range"
								min={0}
								max={100}
								step={5}
								value={Math.round(world.playerLaunderRatio() * 100)}
								onChange={(event) => {
									world.playerSetLaunderRatio(Number(event.target.value) / 100);
									setVersion((value) => value + 1);
								}}
							/>
							<code>{Math.round(world.playerLaunderRatio() * 100)}%</code>
						</label>
						<p className="hint-inline">
							Share of Front capacity allocated to laundering. Lower it to keep Dirty cash (purchases).
						</p>
					</section>
				<section className="card journal-card">
						<h2>Log</h2>
						<ul className="journal">
							{world.log.length === 0 ? (
								<li className="empty">—</li>
							) : (
								world.log.slice(-6).map((line, index) => {
									const lower = line.toLowerCase();
									const kind = /lost|raid|seiz|burn|liquid|dismantl|betray/.test(lower)
										? "loss"
										: /captur|takes|tech|pact|corrupt|lowers|build|upgraded|bust|sabot|intercept/.test(
												lower,
											)
											? "gain"
											: "info";
									return (
										<li key={index} className={`log-${kind}`}>
											{line}
										</li>
									);
								})
							)}
						</ul>
					</section>
					<div className="bottom-controls">
						<p className="hud-keys">
							<kbd>click</kbd> select · <kbd>Q</kbd> attack / build · <kbd>T</kbd> strike ·
							drag = camera
						</p>
						<div className="hud-actions">
							<button type="button" title="Pause / resume" onClick={() => setRunning((value) => !value)}>
								{running ? "Pause" : "Start"}
							</button>
							<button type="button" title="Restart on a new layout" onClick={regenerate}>
								New seed
							</button>
							<button
								type="button"
								className={`toggle${colorblind ? " active" : ""}`}
								title="Colorblind mode (gray + symbols)"
								onClick={() => setColorblind((value) => !value)}
							>
								Colorblind
							</button>
							<button
								type="button"
								className={`toggle${sound ? " active" : ""}`}
								title="Turn sound on / off"
								onClick={() => setSound((value) => !value)}
							>
								{sound ? "Sound" : "Muted"}
							</button>
							<button type="button" className="toggle" title="Help" onClick={() => setShowHelp(true)}>
								Help
							</button>
						</div>
						<p className="hud-foot" title={`API ${api}`}>
							<span className={`clock${isNight ? " night" : ""}`}>
								{isNight ? "Night" : "Day"} {gameTime}
							</span>{" "}
							· tick {world.tick}
						</p>
					</div>
				</footer>
			</div>

			{showHelp ? (
				<div className="help-overlay">
					<div className="help-card card">
						<h2>How to play</h2>
						<p>
							<strong>Goal:</strong> remain <strong>the last cartel in play</strong>. Eliminate
							rivals (0 quarters) — the police can also liquidate you.
						</p>
						<h3>The economic loop</h3>
						<ol>
							<li>
								<strong>Housing</strong> → +Members (your troops, for attacking).
							</li>
							<li>
								<strong>Lab</strong> → Product.
							</li>
							<li>
								<strong>Storefront</strong> → Product becomes Dirty cash.
							</li>
							<li>
								<strong>Front</strong> → Dirty cash becomes <strong>Clean cash</strong>.
							</li>
						</ol>
						<p>
							<strong>Workshop</strong> unlocks tech · <strong>Safehouse</strong> defends a quarter ·
							one building per quarter.
						</p>
						<p>
							<strong>Rising cost:</strong> each building of the same type makes the next one
							more expensive (+35%). Diversifying is more profitable than spamming a single type.
						</p>
						<p>
							<strong>Zones:</strong> each quarter accepts only certain buildings (park →
							safehouse, police → counter-intel…). Details are shown under the build
							menu.
						</p>
						<p>
							<strong>Zone bonus:</strong> a building produces more in a zone made for
							it — <strong>residential</strong> boosts recruitment, <strong>commercial</strong> sales,
							<strong>laundromat</strong> laundering, <strong>industrial wasteland</strong> labs/workshops,
							<strong>police</strong> counter-intel, <strong>park</strong> the safehouse. Favored
							buttons are marked <strong>×1.5</strong>.
						</p>
						<p>
							<strong>Rush hour:</strong> output follows the clock (bottom right). The{" "}
							<strong>commercial</strong> zone sells by day (peak 1 pm), <strong>nightlife</strong> at
							night (peak 11 pm), <strong>residential</strong> recruits in the evening, <strong>labs</strong>{" "}
							run at night. The "Peak / Off-peak" tag shows the selected quarter's multiplier.
						</p>
						<h3>Quarter war</h3>
						<p>
							Buildings are <strong>value targets</strong>: capturing a built quarter
							yields <strong>loot</strong> (40% of the building's value, taken from the
							defender). An adjacent <strong>Counter-intel</strong> <strong>warns</strong> you{" "}
							of an enemy bust (alert + sound).
						</p>
						<h3>Buildings (hover on the map)</h3>
						<ul className="help-buildings">
							{BUILDING_TYPES.map((type) => (
								<li key={type}>
									<strong>{BUILDINGS[type].label}</strong> — {BUILDING_EFFECT_LABELS[type]}
								</li>
							))}
						</ul>
						<h3>Conquest</h3>
						<p>
							Select an <strong>adjacent</strong> quarter then <kbd>Q</kbd> to attack it.
							<strong>Commitment</strong> (slider) = share of your Members sent to the assault:
							the higher it is, the faster the siege, but the fewer defenders remain at
							home.
						</p>
						<p>
							The siege lowers the target's <strong>Control</strong> (it regenerates on its own);
							at zero, the quarter is taken. The quarter <strong>fills with white</strong> as
							Control drops.
						</p>
						<h3>Market &amp; logistics</h3>
						<p>
							Each quarter has a <strong>profile</strong> (demand, wealth): a storefront
							yields more in a wealthy quarter. A sale must be <strong>connected to a lab</strong>{" "}
							by a path of owned quarters (otherwise −65% capacity): <strong>convoys</strong>{" "}
							are visible and <strong>interceptable</strong>.
						</p>
						<h3>Money is king of war</h3>
						<p>
							<strong>Upkeep:</strong> each building costs Dirty cash/s. If it isn't
							paid, <strong>production ÷2</strong> and <strong>watchers go blind</strong>.
							A large empire is expensive to run.
						</p>
						<ul className="help-buildings">
							<li>
								<strong>Armament</strong> — Clean cash → <strong>+20% attack</strong> for
								40 s (repeatable, rising cost).
							</li>
							<li>
								<strong>Mercenaries</strong> — Dirty cash → <strong>+400 Members</strong> immediately
								(rising cost).
							</li>
							<li>
								<strong>Buyout</strong> — Clean cash → an <strong>adjacent neutral quarter</strong>{" "}
								without fighting (rising cost with your empire).
							</li>
							<li>
								<strong>Contract</strong> — Clean cash → pay a gang to{" "}
								<strong>attack the leader</strong>.
							</li>
						</ul>
						<h3>Local police</h3>
						<p>
							Crime <strong>heats up</strong> quarters: raids target the hottest, and
							police stations cool their zone. <strong>Bribing</strong> lowers
							Pressure and cools your quarters.
						</p>
						<p className="help-keys">
							<kbd>click</kbd> select · <kbd>Q</kbd> attack / build · <kbd>T</kbd> strike ·
							drag = camera
						</p>
						<button type="button" onClick={() => setShowHelp(false)}>
							Got it, play
						</button>
					</div>
				</div>
			) : null}

			{world.outcome !== null ? (
				<div className={`end-banner ${world.outcome === "victory" ? "win" : "loss"}`}>
					<h2>{world.outcome === "victory" ? "Victory" : "Defeat"}</h2>
					<p className="end-cause">{world.endReason}</p>
					<div className="end-score">
						<strong>{Math.round(summary.cleanCash).toLocaleString("en-US")}</strong>
						<span>clean cash</span>
					</div>
					<ul className="end-lines">
						<li>
							<span>Control</span>
							<code>
								{playerPct}% · {summary.quarters}/{totalModules} quarters
							</code>
						</li>
						<li>
							<span>Score</span>
							<code>
								{Math.round(summary.score).toLocaleString("en-US")} · rank {summary.rank}
							</code>
						</li>
						<li>
							<span>Quarters taken</span>
							<code>{summary.captures}</code>
						</li>
						<li>
							<span>Gangs eliminated</span>
							<code>{summary.eliminations}</code>
						</li>
						<li>
							<span>Raids suffered</span>
							<code>
								{summary.raidsSuffered} · {summary.seizures} seizure(s)
							</code>
						</li>
						<li>
							<span>Time</span>
							<code>{Math.floor(world.tick / SIM_HZ / 60)} min</code>
						</li>
					</ul>
					<button type="button" onClick={backToSelect}>
						New game
					</button>
				</div>
			) : null}
		</div>
	);
}

export default App;
