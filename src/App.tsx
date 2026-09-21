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
import { HITMAN, TECH, TECH_BRANCHES, TECH_LABELS, techCost } from "./sim/tech";
import { POLICE_TIER_LABELS } from "./sim/police";
import { NEUTRAL } from "./sim/territory";
import { ZONE_LABELS } from "./sim/types";
import { World, type GameEvent } from "./sim/world";

/** Retour sonore par événement de jeu (cuelume). */
const EVENT_SOUND: Record<GameEvent, SoundName> = {
	attack: "pulse",
	capture: "success",
	lost: "error",
	raid: "error",
	hitman: "scan",
	tech: "ready",
	pact: "toggle",
	betray: "error",
	embargo: "scan",
	corrupt: "droplet",
	build: "press",
	descent: "scan",
	sabotage: "whisper",
	intercept: "sparkle",
	event: "bloom",
	alert: "error",
	victory: "arrival",
	defeat: "error",
};

function formatCost(type: BuildingType, factor = 1): string {
	const spec = BUILDINGS[type];
	if (spec.costMembers) return `${Math.round(spec.costMembers * factor)} membres`;
	if (spec.costSale) return `${Math.round(spec.costSale * factor)} sale`;
	if (spec.costClean) return `${Math.round(spec.costClean * factor)} propre`;
	return "—";
}

/** Carte repliable — allège l'IHM en masquant les panneaux secondaires. */
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
	const [screen, setScreen] = useState<"select" | "play">(() =>
		typeof window !== "undefined" && new URLSearchParams(window.location.search).has("play")
			? "play"
			: "select",
	);
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
	/** Aide affichée à la première partie (rappel « but du jeu »). */
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
			// stockage indisponible : mode non persisté
		}
	}, [colorblind]);

	// Message transitoire (retour d'action refusée).
	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), 3200);
		return () => clearTimeout(timer);
	}, [notice]);

	// Infobulle : suit le curseur sans re-render (transform impératif).
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

	// Volume + activation des sons (préférence locale).
	useEffect(() => {
		setVolume(0.5);
		setEnabled(sound);
		try {
			localStorage.setItem("df-sound", sound ? "1" : "0");
		} catch {
			// stockage indisponible : préférence non persistée
		}
	}, [sound]);

	// Sons des événements de jeu + secousse d'écran quand on est frappé.
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

	// Clic sur n'importe quel bouton → feedback « press ».
	useEffect(() => {
		if (!sound) return;
		const onClick = (event: MouseEvent) => {
			if ((event.target as HTMLElement).closest("button")) play("press", { volume: 0.35 });
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, [sound]);

	// L'aide est marquée « vue » dès le premier affichage (rouvrable via le bouton Aide).
	useEffect(() => {
		try {
			localStorage.setItem("df-help", "1");
		} catch {
			// stockage indisponible : aide re-affichée
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
				if (!cancelled) setApi("indisponible");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Sélectionne le quartier de départ du joueur (ouvre le menu de construction).
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
		selectedOwner === NEUTRAL ? "Neutre" : (world.factions[selectedOwner]?.name ?? "—");

	const build = useCallback(
		(type: BuildingType) => {
			if (selected === null) return;
			if (world.playerQueueBuild(selected, type)) setVersion((value) => value + 1);
		},
		[selected, world],
	);

	/** Action contextuelle (Q/A) : bâtir le type conseillé, sinon attaquer. */
	const act = useCallback(() => {
		if (selected === null) return;
		if (world.ownerAt(selected) === world.player.id) {
			if (world.territory.building[selected] === NO_BUILDING) {
				const type = chooseBuildType(
					world.buildingCounts(world.player.id),
					world.modulesOwned(world.player.id),
					(candidate) => world.playerCanQueue(selected, candidate),
					{ atelier: TECH.maxLevel },
				);
				if (type !== null && world.playerQueueBuild(selected, type)) {
					setVersion((value) => value + 1);
				}
			}
			return;
		}
		if (world.playerAttack(selected)) setVersion((value) => value + 1);
	}, [selected, world]);

	const hitmanReason = useCallback((): string | null => {
		if (selected === null) return "aucune cible";
		const owner = world.ownerAt(selected);
		if (owner === player.id) return "déjà à vous";
		if (owner === NEUTRAL) return "cible neutre";
		if (player.tech.armement < HITMAN.requiredArmement) {
			return `Armement ≥ ${HITMAN.requiredArmement} requis`;
		}
		if (player.hitmanCooldown > 0) return `recharge ${Math.ceil(player.hitmanCooldown / SIM_HZ)} s`;
		if (player.cashPropre < HITMAN.costClean) return `${HITMAN.costClean} Cash propre requis`;
		if (player.members < HITMAN.costMembers) return `${HITMAN.costMembers} membres requis`;
		return null;
	}, [selected, world, player]);

	const descentReason = useCallback((): string | null => {
		if (selected === null) return "aucune cible";
		if (world.ownerAt(selected) === player.id) return "déjà à vous";
		if (world.ownerAt(selected) === NEUTRAL) return "cible neutre";
		if (!world.canAttack(player.id, selected)) return "non adjacent";
		if (!world.buildingAt(selected)) return "pas de bâtiment";
		if (player.tech.armement < 1) return "Armement ≥ 1 requis";
		if (player.descentCooldown > 0) return `recharge ${Math.ceil(player.descentCooldown / SIM_HZ)} s`;
		const cost = world.descentCost();
		if (player.cashSale < cost.sale) return `${cost.sale} sale requis`;
		if (player.members < cost.members) return `${cost.members} membres requis`;
		return null;
	}, [selected, world, player]);

	const sabotageReason = useCallback((): string | null => {
		if (selected === null) return "aucune cible";
		if (world.ownerAt(selected) === player.id) return "déjà à vous";
		if (world.ownerAt(selected) === NEUTRAL) return "cible neutre";
		if (!world.canAttack(player.id, selected)) return "non adjacent";
		if (!world.buildingAt(selected)) return "pas de bâtiment";
		if (player.tech.armement < 2) return "Armement ≥ 2 requis";
		if (player.sabotageCooldown > 0) return `recharge ${Math.ceil(player.sabotageCooldown / SIM_HZ)} s`;
		if (player.cashSale < world.sabotageCost()) return `${world.sabotageCost()} sale requis`;
		return null;
	}, [selected, world, player]);

	const interceptReason = useCallback((): string | null => {
		if (selected === null) return "aucune cible";
		if (world.ownerAt(selected) === player.id) return "déjà à vous";
		if (world.ownerAt(selected) === NEUTRAL) return "cible neutre";
		if (!world.canAttack(player.id, selected)) return "non adjacent";
		if (!world.convoyRoutes().some((route) => route.to === selected)) return "aucun convoi";
		if (player.tech.armement < 1) return "Armement ≥ 1 requis";
		if (player.interceptCooldown > 0) return `recharge ${Math.ceil(player.interceptCooldown / SIM_HZ)} s`;
		if (player.members < world.interceptCost()) return `${world.interceptCost()} membres requis`;
		return null;
	}, [selected, world, player]);

	const batch = world.playerBatchPreview();

	const raidReason = useCallback((): string | null => {
		if (selected === null) return "aucune cible";
		if (world.ownerAt(selected) === NEUTRAL) return "cible neutre";
		if (world.ownerAt(selected) === player.id) return "déjà à vous";
		if (!world.canAttack(player.id, selected)) return "non adjacent";
		const cost = world.raidCost();
		if (player.cashSale < cost.sale) return `${cost.sale} sale requis`;
		if (player.members < cost.members) return `${cost.members} membres requis`;
		if (player.raidCooldown > 0) return `recharge ${Math.ceil(player.raidCooldown / SIM_HZ)} s`;
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
				else setNotice("Expansion : aucune cible adjacente attaquable.");
				return;
			}
			if (event.code === "KeyT") {
				event.preventDefault();
				if (selected === null) {
					setNotice("Tueur à gage : sélectionnez d'abord un quartier ennemi.");
					return;
				}
				if (world.playerHitman(selected)) setVersion((value) => value + 1);
				else setNotice(`Tueur à gage : ${hitmanReason() ?? "impossible"}.`);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [act, selected, world, hitmanReason]);

	/** Lance une partie sur la carte réelle (Paris IRIS). */
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
	const cityLabel = "Paris · 992 quartiers IRIS";
	const playerPct = Math.round(world.controlRatio(player.id) * 100);
	const perSecond = Math.round(world.productionPerTick(player.id) * SIM_HZ * 10) / 10;
	const afford = (type: BuildingType) => selected !== null && world.playerCanQueue(selected, type);
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
	/** Profondeur de la nuit (0 en plein jour, 1 vers 2 h) — voile visuel. */
	const nightOpacity = ((1 + Math.cos((2 * Math.PI * (hour - 2)) / 24)) / 2) * 0.45;

	/** Priorité stratégique d'amorçage : Labo → Point de vente → Façade. */
	const advisedType: BuildingType | null =
		world.buildingCount(player.id, "labo") === 0
			? "labo"
			: world.buildingCount(player.id, "vente") === 0
				? "vente"
				: world.buildingCount(player.id, "facade") === 0 && player.cashSale > 1500
					? "facade"
					: null;

	const ownedQuarters = world.modulesOwned(player.id);
	const idleQuarters = Math.max(0, ownedQuarters - player.buildings);
	const advisor = (() => {
		if (ownedQuarters < 2) {
			return "Capturez un quartier adjacent (sélectionnez-le puis Q) : 1 bâtiment par quartier.";
		}
		if (advisedType !== null) {
			const spec = BUILDINGS[advisedType];
			if (spec.costSale && player.cashSale < spec.costSale) {
				return `${BUILDINGS[advisedType].label} : ${spec.costSale} Cash sale requis — vendez du Produit ou agrandissez.`;
			}
			if (spec.costMembers && player.members < spec.costMembers) {
				return `${BUILDINGS[advisedType].label} : ${spec.costMembers} Membres requis.`;
			}
			return `${BUILDINGS[advisedType].label} — ${BUILDING_EFFECT_LABELS[advisedType]} (à construire en priorité).`;
		}
		if (idleQuarters > 0) {
			return `${idleQuarters} quartier(s) vide(s) : aménagez-les (Q sur un quartier possédé).`;
		}
		return "Étendez le territoire : éliminez les cartels rivaux pour rester le dernier.";
	})();

	/** Chaîne économique : bâtiment → ressource, pour rendre la boucle lisible. */
	const chain: { type: BuildingType; label: string; count: number; value: string }[] = [
		{
			type: "logement",
			label: "Recrutement",
			count: world.buildingCount(player.id, "logement"),
			value: `${Math.round(player.members).toLocaleString("fr-FR")} membres`,
		},
		{
			type: "labo",
			label: "Labo",
			count: world.buildingCount(player.id, "labo"),
			value: `${Math.round(player.produit)} produit`,
		},
		{
			type: "vente",
			label: "Point de vente",
			count: world.buildingCount(player.id, "vente"),
			value: `${Math.round(player.cashSale).toLocaleString("fr-FR")} sale`,
		},
		{
			type: "facade",
			label: "Façade",
			count: world.buildingCount(player.id, "facade"),
			value: `${Math.round(player.cashPropre).toLocaleString("fr-FR")} propre`,
		},
	];
	const hoverOwner = hovered !== null ? world.ownerAt(hovered) : NEUTRAL;
	const hoverOwnerName =
		hoverOwner === NEUTRAL ? "Neutre" : (world.factions[hoverOwner]?.name ?? "—");
	const hoverZone = hovered !== null ? world.city.modules[hovered]! : null;
	const hoverBuilding = hovered !== null ? world.buildingAt(hovered) : null;
	const hoverControl = hovered !== null ? Math.round(world.controlAt(hovered)) : 0;
	const hoverPending = hovered !== null ? world.pendingBuilding(hovered) : null;
	const hoverConstruction = hovered !== null ? world.constructionLeft(hovered) : 0;

	const chainNext =
		chain.find((step) => step.type !== "logement" && step.count === 0)?.type ?? null;

	const adjacentTarget = selected !== null && world.canAttack(player.id, selected);
	const engaged = Math.floor(player.members * world.commitRatio());
	const targetDefense = selected !== null ? world.defenseAt(selected) : 1;
	const targetControl = selected !== null ? Math.round(world.controlAt(selected)) : 0;
	const selectedZoneLabel =
		selected !== null ? (ZONE_LABELS[world.city.modules[selected]!] ?? "—") : "—";
	const allowedHere = selected !== null ? world.allowedBuildings(selected) : [];
	/** Raison d'indisponibilité d'un bâtiment sur le quartier sélectionné. */
	const blockReason = (type: BuildingType): string | null => {
		if (selected === null) return null;
		if (world.buildingAt(selected) !== null) return "quartier occupé";
		if (world.constructionLeft(selected) > 0) return "chantier en cours";
		if (!world.canBuildInZone(selected, type)) return "zone incompatible";
		if (world.playerBuildOrders().some((order) => order.module === selected)) return "déjà en file";
		if (world.queueLength() >= world.queueCap()) return "file pleine";
		return null;
	};
	const attackReason = !adjacentTarget
		? "Non adjacent — choisissez un quartier voisin de votre territoire."
		: `Membres insuffisants (minimum ${world.minCommit()} engagés).`;
	const pressure = world.police.pressure;
	const raidFlash = world.police.lastRaidTick >= 0 && world.tick - world.police.lastRaidTick <= 10;
	const alert = policeTargeted && (raidFlash || pressure >= 70);

	if (screen === "select") {
		return (
			<div className="select-screen">
				<h1>DealerFront</h1>
				<p className="select-pitch">
					Le cartel sur la vraie carte de Paris. Contrôlez le terrain, produisez, vendez,
					blanchissez — avant la police et les rivaux.
				</p>
				<div className="select-loop" aria-hidden="true">
					<span>Produire</span>
					<span>Vendre</span>
					<span>Blanchir</span>
				</div>
				<div className="city-choices">
					<button type="button" className="city-card" onClick={startParis}>
						<strong>Jouer à Paris</strong>
						<em>992 quartiers IRIS · 6 cartels · battle royale</em>
						<span>Objectif : rester le dernier cartel en jeu. Votre économie finance la guerre.</span>
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
					heat={world.heat}
					tick={world.tick}
					selected={selected}
					colorblind={colorblind}
					version={version}
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
								Contrôle <strong>{hoverControl}</strong>
							</span>
							<span>
								Demande <strong>×{world.demandAt(hovered).toFixed(1)}</strong>
							</span>
							<span>
								Richesse <strong>×{world.wealthAt(hovered).toFixed(1)}</strong>
							</span>
							<span>
								Heat <strong>{Math.round(world.heatAt(hovered))}</strong>
							</span>
						</div>
						<div className="hover-building">
							{hoverConstruction > 0
								? `Chantier : ${hoverPending ? BUILDINGS[hoverPending].label : "—"} (${Math.ceil(hoverConstruction / SIM_HZ)} s)`
								: hoverBuilding
									? `${BUILDINGS[hoverBuilding].label} — ${BUILDING_EFFECT_LABELS[hoverBuilding]}${
											hoverOwner !== player.id && hoverOwner !== NEUTRAL
												? ` · butin ${Math.round(
														((BUILDINGS[hoverBuilding].costSale ??
															BUILDINGS[hoverBuilding].costClean ??
															BUILDINGS[hoverBuilding].costMembers ??
															0) *
															0.4),
													).toLocaleString("fr-FR")}`
												: ""
										}`
									: "Aucun bâtiment"}
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
						<div className="stat" title="Membres (troupes)">
							<RESOURCE_ICONS.members className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.members).toLocaleString("fr-FR")}</strong>
						</div>
						<div className="stat" title="Produit (stock des labos)">
							<RESOURCE_ICONS.produit className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.produit)}</strong>
						</div>
						<div className="stat" title="Cash sale (à blanchir)">
							<RESOURCE_ICONS.sale className="stat-icon" aria-hidden="true" />
							<strong>{Math.round(player.cashSale).toLocaleString("fr-FR")}</strong>
						</div>
						<div className="stat" title="Cash propre (blanchi)">
							<RESOURCE_ICONS.clean className="stat-icon clean" aria-hidden="true" />
							<strong className="clean">
								{Math.round(player.cashPropre).toLocaleString("fr-FR")}
							</strong>
						</div>
						<div className="stat" title="Part de la carte contrôlée">
							<span className="stat-label">Contrôle</span>
							<strong>{playerPct}%</strong>
						</div>
						<div className="stat" title="Quartiers possédés">
							<span className="stat-label">Quartiers</span>
							<strong>
								{world.modulesOwned(player.id)}
								<em>/{totalModules}</em>
							</strong>
						</div>
						<div className="stat" title="Membres produits par seconde">
							<span className="stat-label">Prod.</span>
							<strong>+{perSecond}/s</strong>
						</div>
					</div>
					<div className="top-right">
						<span className="objective" title="Votre rang (1 = leader)">
							<strong>
								Rang {world.playerRank()} · {alive} cartel{alive > 1 ? "s" : ""} en jeu
							</strong>
							<span className="objective-sub">Dernier survivant</span>
						</span>
						<span className="timer" title="Temps de survie">
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
					{world.bankruptcyTicksLeft() > 0 ? (
						<p className="notice danger">
							<strong>Faillite dans {Math.ceil(world.bankruptcyTicksLeft() / SIM_HZ)} s</strong> —
							relancez la chaîne Produit → Cash sale (labo + point de vente).
						</p>
					) : null}
					<div className="quarter-head">
						<h2>
							Quartier <em>{selected !== null ? `#${selected}` : "—"}</em>
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
						<span title="Contrôle du quartier (0–100)">
							<strong>{selected !== null ? Math.round(world.controlAt(selected)) : "—"}</strong>
							Contrôle
						</span>
						<span title="Clientele locale (vente, recrutement)">
							<strong>
								×{selected !== null ? world.demandAt(selected).toFixed(1) : "—"}
							</strong>
							Demande
						</span>
						<span title="Prix et blanchiment locaux">
							<strong>
								×{selected !== null ? world.wealthAt(selected).toFixed(1) : "—"}
							</strong>
							Richesse
						</span>
						<span title="Pression policière locale">
							<strong>{selected !== null ? Math.round(world.heatAt(selected)) : "—"}</strong>
							Heat
						</span>
						<span title="Part de la vente reliée à un labo">
							<strong>{Math.round(world.retailSupplyRatio(player.id) * 100)}%</strong>
							Logistique
						</span>
						{selectedBuilding ? (
							<span title={BUILDING_EFFECT_LABELS[selectedBuilding]}>
								<strong>{BUILDINGS[selectedBuilding].label}</strong>
								Bâtiment
							</span>
						) : (
							<span title="Profil de zonage du quartier (pas un bâtiment)">
								<strong>{selectedZoneLabel}</strong>
								Zone
							</span>
						)}
					</div>
					<div className="quarter-foot">
						<span>
							Chantiers {world.activeConstructions(player.id)}/{world.buildCrews()} · file{" "}
							{world.queueLength()}/{world.queueCap()}
						</span>
						{selected !== null && selectedBuilding
							? (() => {
									const factor = world.rushFactorAt(selected, selectedBuilding);
									if (Math.abs(factor - 1) < 0.02) return null;
									const peak = factor > 1;
									return (
										<span className={`rush-tag ${peak ? "peak" : "off"}`}>
											{peak ? "Pointe" : "Creux"} ×{factor.toFixed(2)}
										</span>
									);
								})()
							: null}
					</div>

					<button
						type="button"
						className="expand-btn"
						title="Attaque automatiquement le quartier voisin le plus faible (neutre ou ennemi hors pacte)."
						onClick={() => {
							if (world.playerAttackBest()) setVersion((value) => value + 1);
							else setNotice("Expansion : aucune cible adjacente attaquable.");
						}}
					>
						Étendre <kbd>E</kbd>
					</button>

					<label
						className="slider-row"
						title="Part de vos Membres engagée à chaque assaut. Le reste défend vos quartiers : engager trop vous affaiblit."
					>
						<span>Engagement</span>
						<input
							type="range"
							min={5}
							max={60}
							step={5}
							value={Math.round(world.playerAttackRatio() * 100)}
							onChange={(event) => {
								world.playerSetAttackRatio(Number(event.target.value) / 100);
								setVersion((value) => value + 1);
							}}
						/>
						<code title={`Assaut ${engaged.toLocaleString("fr-FR")} · Défense ${Math.max(0, Math.round(player.members - engaged)).toLocaleString("fr-FR")}`}>
							{Math.round(world.playerAttackRatio() * 100)}% ·{" "}
							{engaged.toLocaleString("fr-FR")}
							<em className="def-part">
								/{Math.max(0, Math.round(player.members - engaged)).toLocaleString("fr-FR")}
							</em>
						</code>
					</label>

					{isOwned ? (
						constructionLeft > 0 ? (
							<p className="hint-inline">
								<strong>Chantier :</strong> {pendingType ? BUILDINGS[pendingType].label : "—"} —
								encore {Math.ceil(constructionLeft / SIM_HZ)} s
							</p>
						) : selectedBuilding ? (
							<p className="hint-inline">
								<strong>Occupé :</strong> {BUILDINGS[selectedBuilding].label} —{" "}
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
												title={`${BUILDINGS[type].label} : ${BUILDING_EFFECT_LABELS[type]}${bonus > 1 ? ` · zone ×${bonus.toFixed(2).replace(".", ",")}` : ""}${owned > 0 ? ` · ${owned} déjà bâtis (coût +35 %/unité)` : ""}${reason ? ` — ${reason}` : ""}`}
												onClick={() => build(type)}
											>
												<Icon className="build-icon" aria-hidden="true" />
												{bonus > 1 ? (
													<span className="bonus-tag">×{bonus.toFixed(2).replace(".", ",")}</span>
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
									{isConversion ? "conversion −50 %" : "chantier"}.
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
										label: canAttack ? `${engaged} engagés` : "Assaut",
										hotkey: "Q",
										title: canAttack
											? `Assaut : ${engaged} engagés · contrôle ${targetControl} · défense ×${targetDefense.toFixed(1)}${world.buildingAt(selected!) === "planque" ? " (planque)" : ""}`
											: attackReason,
										disabled: !canAttack,
										run: act,
									},
								];
								if (selectedOwner !== player.id && selectedOwner !== NEUTRAL) {
									const RaidIcon = ACTION_ICONS.raid;
									actions.push({
										key: "raid",
										icon: RaidIcon,
										label: `${world.raidCost().sale}`,
										title: raidReason() ?? "Raid : détruit contrôle et bâtiments, sans capturer",
										disabled: raidReason() !== null,
										run: () => {
											if (selected !== null && world.playerRaid(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Raid : ${raidReason() ?? "impossible"}.`);
											}
										},
									});
								}
								if (selectedOwner !== player.id && selectedBuilding) {
									const DescentIcon = ACTION_ICONS.descent;
									actions.push({
										key: "descent",
										icon: DescentIcon,
										label: "butin",
										title: descentReason() ?? "Descente : vole le butin sans détruire le bâtiment",
										disabled: descentReason() !== null,
										run: () => {
											if (selected !== null && world.playerDescent(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Descente : ${descentReason() ?? "impossible"}.`);
											}
										},
									});
									const SabotageIcon = ACTION_ICONS.sabotage;
									actions.push({
										key: "sabotage",
										icon: SabotageIcon,
										label: `${world.sabotageCost()}`,
										title: sabotageReason() ?? "Sabotage : production ÷2 pendant 30 s",
										disabled: sabotageReason() !== null,
										run: () => {
											if (selected !== null && world.playerSabotage(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Sabotage : ${sabotageReason() ?? "impossible"}.`);
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
											"Interception : détourne un convoi et coupe la ligne",
										disabled: interceptReason() !== null,
										run: () => {
											if (selected !== null && world.playerIntercept(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Interception : ${interceptReason() ?? "impossible"}.`);
											}
										},
									});
								}
								if (selectedOwner !== player.id) {
									const HitmanIcon = ACTION_ICONS.hitman;
									actions.push({
										key: "hitman",
										icon: HitmanIcon,
										label: "T",
										hotkey: "T",
										title: hitmanReason() ?? "Tueur à gage : affaiblit un quartier (Armement ≥ 2)",
										disabled: hitmanReason() !== null,
										run: () => {
											if (selected !== null && world.playerHitman(selected)) {
												setVersion((value) => value + 1);
											} else {
												setNotice(`Tueur à gage : ${hitmanReason() ?? "impossible"}.`);
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
								Lot <em>{batch.count} quartier(s)</em>
							</h2>
							<div className="batch-row">
								<code>
									{batch.sale > 0 ? `${batch.sale.toLocaleString("fr-FR")} sale ` : ""}
									{batch.members > 0 ? `${batch.members.toLocaleString("fr-FR")} membres ` : ""}
									{batch.clean > 0 ? `${batch.clean.toLocaleString("fr-FR")} propre` : ""}
								</code>
								<button
									type="button"
									onClick={() => {
										world.playerBatchBuild();
										setVersion((value) => value + 1);
									}}
								>
									Aménager
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
							<span>Pression</span>
							<div className="gauge" aria-hidden="true">
								<div className="gauge-fill" style={{ width: `${pressure}%` }} />
							</div>
							<code>{Math.round(pressure)}</code>
						</div>
						<div className="line">
							<span>Vise</span>
							<code
								style={{
									color:
										world.police.target >= 0
											? world.factions[world.police.target]?.color
											: undefined,
								}}
							>
								{policeTargetName}
								{policeTargeted ? " (vous)" : ""}
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
							Corrompre ({world.playerCorruptionCost().toLocaleString("fr-FR")})
						</button>
					</section>

					<Section
						title="Tech"
						aside={`${world.buildingCount(player.id, "atelier")} atelier(s)`}
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
						title="Diplomatie"
						aside={`${world.pacts.length} pacte(s)`}
						defaultOpen={false}
					>
						{world.playerOffers().map((offer) => (
							<div className="dip-row" key={`offer-${offer.from}`}>
								<span>{world.factions[offer.from]?.name} propose un pacte</span>
								<span className="offer-actions">
									<button
										type="button"
										className="tech-up"
										onClick={() => {
											world.playerRespondToOffer(offer.from, true);
											setVersion((value) => value + 1);
										}}
									>
										Accepter
									</button>
									<button
										type="button"
										className="tech-up"
										onClick={() => {
											world.playerRespondToOffer(offer.from, false);
											setVersion((value) => value + 1);
										}}
									>
										Refuser
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
											<span className="tag">traître</span>
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
											Trahir
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
												Pacte
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
										</span>
									)}
								</div>
							);
						})}
					</Section>
				</aside>

				<footer className="panel-bottom">
					<section className="card loop-card">
						<h2>Boucle</h2>
						{chain.map((step) => (
							<div
								className={`loop-row${step.type === chainNext ? " next" : ""}`}
								key={step.type}
							>
								<span>
									{step.label} <em>×{step.count}</em>
								</span>
								<code className={step.type === "facade" ? "clean" : undefined}>
									{step.value}
								</code>
							</div>
						))}
						<label className="slider-row" title="Part de la capacité des façades blanchie">
							<span>Blanchiment</span>
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
							Part de la capacité des façades affectée au blanchiment. Baissez pour garder du Cash sale (achats).
						</p>
					</section>					{world.playerBuildOrders().length > 0 ? (
					<section className="card loop-card queue-card">
						<h2>File d'ordres <em>{world.queueLength()}</em></h2>
						{world.playerBuildOrders().map((order) => (
							<div className="loop-row" key={order.module}>
								<span>
									{BUILDINGS[order.type].label} <em>mod. {order.module}</em>
								</span>
								<button
									type="button"
									className="tech-up"
									onClick={() => {
										world.playerCancelOrder(order.module);
										setVersion((value) => value + 1);
									}}
								>
									Annuler
								</button>
							</div>
						))}
					</section>
				) : null}
				<section className="card journal-card">
						<h2>Journal</h2>
						<ul className="journal">
							{world.log.length === 0 ? (
								<li className="empty">—</li>
							) : (
								world.log.slice(-6).map((line, index) => {
									const lower = line.toLowerCase();
									const kind = /perd|raid|saisi|grill|liquid|élimin|trait/.test(lower)
										? "loss"
										: /prend|tech|pacte|corrupt|baisse|aménage|descente|sabot|intercept/.test(
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
							<kbd>clic</kbd> sélectionner · <kbd>Q</kbd> attaquer / bâtir · <kbd>T</kbd> tueur ·
							glisser = caméra
						</p>
						<div className="hud-actions">
							<button type="button" title="Pause / reprendre" onClick={() => setRunning((value) => !value)}>
								{running ? "Pause" : "Démarrer"}
							</button>
							<button type="button" title="Relancer sur une nouvelle disposition" onClick={regenerate}>
								Nouvelle seed
							</button>
							<button
								type="button"
								className={`toggle${colorblind ? " active" : ""}`}
								title="Mode daltonien (gris + symboles)"
								onClick={() => setColorblind((value) => !value)}
							>
								Daltonien
							</button>
							<button
								type="button"
								className={`toggle${sound ? " active" : ""}`}
								title="Activer / couper le son"
								onClick={() => setSound((value) => !value)}
							>
								{sound ? "Son" : "Muet"}
							</button>
							<button type="button" className="toggle" title="Aide" onClick={() => setShowHelp(true)}>
								Aide
							</button>
						</div>
						<p className="hud-foot" title={`API ${api}`}>
							<span className={`clock${isNight ? " night" : ""}`}>
								{isNight ? "Nuit" : "Jour"} {gameTime}
							</span>{" "}
							· tick {world.tick}
						</p>
					</div>
				</footer>
			</div>

			{showHelp ? (
				<div className="help-overlay">
					<div className="help-card card">
						<h2>Comment jouer</h2>
						<p>
							<strong>But :</strong> rester <strong>le dernier cartel en jeu</strong>. Éliminez les
							rivaux (0 quartier) — la police peut aussi vous liquider.
						</p>
						<h3>La boucle économique</h3>
						<ol>
							<li>
								<strong>Logement</strong> → +Membres (vos troupes, pour attaquer).
							</li>
							<li>
								<strong>Labo</strong> → Produit.
							</li>
							<li>
								<strong>Point de vente</strong> → Produit devient Cash sale.
							</li>
							<li>
								<strong>Façade</strong> → Cash sale devient <strong>Cash propre</strong>.
							</li>
						</ol>
						<p>
							<strong>Atelier</strong> débloque la tech · <strong>Planque</strong> défend un quartier ·
							un seul bâtiment par quartier.
						</p>
						<p>
							<strong>Coût croissant :</strong> chaque bâtiment du même type renchérit le suivant
							(+35 %). Diversifier est plus rentable que spammer un seul type.
						</p>
						<p>
							<strong>Zones :</strong> chaque quartier n'accepte que certains bâtiments (parc →
							planque, police → contre-espionnage…). Le détail est affiché sous le menu de
							construction.
						</p>
						<p>
							<strong>Bonus de zone :</strong> un bâtiment produit plus dans une zone faite pour
							lui — <strong>résidentiel</strong> bonifie le recrutement, <strong>commercial</strong> la
							vente, <strong>laverie</strong> le blanchiment, <strong>friche industrielle</strong> les
							labos/ateliers, <strong>police</strong> le contre-espionnage, <strong>parc</strong> la
							planque. Les boutons favorisés sont marqués <strong>×1,5</strong>.
						</p>
						<p>
							<strong>Heures de pointe :</strong> le rendement suit l'heure (horloge en bas à
							droite). Le <strong>commercial</strong> vend le jour (pic 13 h), la{" "}
							<strong>nightlife</strong> la nuit (pic 23 h), le <strong>résidentiel</strong> recrute
							le soir, les <strong>labos</strong> tournent la nuit. La pastille « Pointe / Creux »
							affiche le multiplicateur du quartier sélectionné.
						</p>
						<h3>Guerre de quartiers</h3>
						<p>
							Les bâtiments sont des <strong>objectifs à valeur</strong> : capturer un quartier bâti
							rapporte du <strong>butin</strong> (40 % de la valeur du bâtiment, prélevé sur le
							défenseur). Un <strong>Contre-espionnage</strong> adjacent te <strong>prévient</strong>{" "}
							d'une descente ennemie (alerte + son).
						</p>
						<h3>Bâtiments (survol sur la carte)</h3>
						<ul className="help-buildings">
							{BUILDING_TYPES.map((type) => (
								<li key={type}>
									<strong>{BUILDINGS[type].label}</strong> — {BUILDING_EFFECT_LABELS[type]}
								</li>
							))}
						</ul>
						<h3>Conquête</h3>
						<p>
							Sélectionnez un quartier <strong>adjacent</strong> puis <kbd>Q</kbd> pour l'attaquer.
							L'<strong>Engagement</strong> (curseur) = part de vos Membres envoyée à l'assaut :
							plus il est haut, plus le siège est rapide, mais moins il reste de défenseurs chez
							vous.
						</p>
						<p>
							Le siège fait baisser le <strong>Contrôle</strong> de la cible (il régénère seul) ;
							à zéro, le quartier est pris. Le quartier se <strong>remplit de blanc</strong> à mesure
							que le Contrôle baisse.
						</p>
						<h3>Marché &amp; logistique</h3>
						<p>
							Chaque quartier a un <strong>profil</strong> (demande, richesse) : un point de vente
							rapporte plus dans un quartier riche. Une vente doit être <strong>reliée à un labo</strong>{" "}
							par un chemin de quartiers possédés (sinon −65 % de capacité) : les{" "}
							<strong>convois</strong> sont visibles et <strong>interceptables</strong>.
						</p>
						<h3>Police locale</h3>
						<p>
							Le crime <strong>chauffe</strong> les quartiers : les raids visent les plus chauds, et
							les postes de police refroidissent leur zone. <strong>Corrompre</strong> réduit la
							Pression et refroidit vos quartiers.
						</p>
						<p className="help-keys">
							<kbd>clic</kbd> sélectionner · <kbd>Q</kbd> attaquer / bâtir · <kbd>T</kbd> tueur ·
							glisser = caméra
						</p>
						<button type="button" onClick={() => setShowHelp(false)}>
							Compris, jouer
						</button>
					</div>
				</div>
			) : null}

			{world.outcome !== null ? (
				<div className={`end-banner ${world.outcome === "victory" ? "win" : "loss"}`}>
					<h2>{world.outcome === "victory" ? "Victoire" : "Défaite"}</h2>
					<p className="end-cause">{world.endReason}</p>
					<div className="end-score">
						<strong>{Math.round(summary.cashPropre).toLocaleString("fr-FR")}</strong>
						<span>cash propre</span>
					</div>
					<ul className="end-lines">
						<li>
							<span>Contrôle</span>
							<code>
								{playerPct}% · {summary.quarters}/{totalModules} quartiers
							</code>
						</li>
						<li>
							<span>Score</span>
							<code>
								{Math.round(summary.score).toLocaleString("fr-FR")} · rang {summary.rank}
							</code>
						</li>
						<li>
							<span>Quartiers pris</span>
							<code>{summary.captures}</code>
						</li>
						<li>
							<span>Gangs éliminés</span>
							<code>{summary.eliminations}</code>
						</li>
						<li>
							<span>Raids subis</span>
							<code>
								{summary.raidsSuffered} · {summary.seizures} saisie(s)
							</code>
						</li>
						<li>
							<span>Temps</span>
							<code>{Math.floor(world.tick / SIM_HZ / 60)} min</code>
						</li>
					</ul>
					<button type="button" onClick={backToSelect}>
						Nouvelle partie
					</button>
				</div>
			) : null}
		</div>
	);
}

export default App;
