import { play, setEnabled, setVolume, type SoundName } from "cuelume";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IsoCanvas } from "./render/IsoCanvas";
import { FACTION_SYMBOLS } from "./render/palette";
import { Radar } from "./render/Radar";
import {
	BUILDINGS,
	BUILDING_EFFECT_LABELS,
	BUILD_TICKS,
	BUILDING_TYPES,
	chooseBuildType,
	type BuildingType,
	NO_BUILDING,
} from "./sim/buildings";
import { archetypeOf } from "./sim/city";
import { SimClock } from "./sim/clock";
import { MODULES_H, MODULES_W, MODULE_SIZE, SIM_HZ } from "./sim/constants";
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
	alert: "error",
	victory: "arrival",
	defeat: "error",
};

const ARCHETYPE_LABEL: Record<string, string> = {
	nightlife: "Vie nocturne",
	residential: "Résidentiel",
	industrial: "Industriel",
	student: "Étudiant",
	port: "Portuaire",
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
	const [hubSeed, setHubSeed] = useState(1337);
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

	// 3 propositions de ville (profil + seed), façon écran de sélection.
	const proposals = useMemo(() => {
		const list: { seed: number; archetype: string }[] = [];
		for (let index = 0; index < 3; index += 1) {
			const candidate = (hubSeed + index * 1013904223) >>> 0;
			list.push({ seed: candidate, archetype: archetypeOf(candidate) });
		}
		return list;
	}, [hubSeed]);

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
		if (events.includes("lost") || events.includes("raid")) {
			setShake(true);
			const timer = setTimeout(() => setShake(false), 420);
			return () => clearTimeout(timer);
		}
		if (!sound) return;
		for (const event of events) play(EVENT_SOUND[event]);
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

	const focus = useMemo(() => {
		for (let i = 0; i < world.territory.count; i += 1) {
			if (world.territory.owner[i] === world.player.id) {
				return {
					x: (i % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
					z: Math.floor(i / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
				};
			}
		}
		return { x: world.city.width / 2, z: world.city.height / 2 };
	}, [world]);

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
		if (player.hitmanCooldown > 0) return `recharge ${Math.ceil(player.hitmanCooldown / SIM_HZ)} s`;
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
		if (player.hitmanCooldown > 0) return `recharge ${Math.ceil(player.hitmanCooldown / SIM_HZ)} s`;
		if (player.cashSale < world.sabotageCost()) return `${world.sabotageCost()} sale requis`;
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
		if (player.hitmanCooldown > 0) return `recharge ${Math.ceil(player.hitmanCooldown / SIM_HZ)} s`;
		return null;
	}, [selected, world, player]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code === "KeyQ" || event.code === "KeyA") {
				event.preventDefault();
				act();
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

	const startCity = (citySeed: number) => {
		setSeed(citySeed);
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
		setHubSeed((value) => (value * 1103515245 + 12345) >>> 0);
		setScreen("select");
	};

	const totalModules = world.city.modules.length;
	const playerPct = Math.round(world.controlRatio(player.id) * 100);
	const perSecond = Math.round(world.productionPerTick(player.id) * SIM_HZ * 10) / 10;
	const afford = (type: BuildingType) => selected !== null && world.playerCanQueue(selected, type);
	const costFactor = selected !== null ? world.buildCostFactor(selected) : 1;
	const constructionLeft = selected !== null ? world.constructionLeft(selected) : 0;
	const pendingType = selected !== null ? world.pendingBuilding(selected) : null;
	const isConversion = selected !== null && world.isConversion(selected);
	const policeTargeted = world.police.target === player.id;
	const policeTargetName =
		world.police.target >= 0 ? (world.factions[world.police.target]?.name ?? "—") : "—";
	const policeTierLabel = POLICE_TIER_LABELS[world.policeLevel()];
	const summary = world.summary();
	const threshold = world.victoryControlThreshold();
	const cleanGoal = world.cleanGoal();
	const secondsLeft = Math.max(0, Math.ceil(world.ticksLeft() / SIM_HZ));
	const timeLeft = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

	/** Priorité stratégique d'amorçage : Labo → Point de vente → Façade. */
	const advisedType: BuildingType | null =
		world.buildingCount(player.id, "labo") === 0
			? "labo"
			: world.buildingCount(player.id, "vente") === 0
				? "vente"
				: world.buildingCount(player.id, "facade") === 0 && player.cashSale > 1500
					? "facade"
					: null;

	/** Bâtiment suggéré sur le quartier sélectionné (priorité d'amorçage, sinon composition). */
	const recommendedType =
		isOwned && selectedBuilding === null && selected !== null
			? advisedType !== null && world.playerCanBuild(selected, advisedType)
				? advisedType
				: chooseBuildType(
						world.buildingCounts(player.id),
						world.modulesOwned(player.id),
						(candidate) => world.playerCanQueue(selected, candidate),
						{ atelier: TECH.maxLevel },
					)
			: null;

	const ownedQuarters = world.modulesOwned(player.id);
	const idleQuarters = Math.max(0, ownedQuarters - player.buildings);
	const advisor = (() => {
		if (player.cashPropre >= cleanGoal && world.controlRatio(player.id) >= threshold) {
			return "Objectif rempli : gardez la tête du classement.";
		}
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
		if (world.controlRatio(player.id) < threshold) {
			return "Étendez le territoire : sélectionnez un quartier adjacent puis Attaquer (Q).";
		}
		return "Blanchissez encore du Cash propre pour valider la victoire.";
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
				<p>
					{MODULES_W * MODULES_H} quartiers · 4 cartels · objectif : ≥ {Math.round(threshold * 100)} % et{" "}
					{cleanGoal.toLocaleString("fr-FR")} de Cash propre
				</p>
				<div className="city-choices">
					{proposals.map((proposal) => (
						<button
							key={proposal.seed}
							type="button"
							className="city-card"
							onClick={() => startCity(proposal.seed)}
						>
							<strong>{ARCHETYPE_LABEL[proposal.archetype] ?? proposal.archetype}</strong>
							<em>seed {proposal.seed}</em>
							<span>Possession colorée · police anti-leader · 25 min</span>
						</button>
					))}
				</div>
				<p>Choisissez une ville pour lancer la partie.</p>
			</div>
		);
	}

	return (
		<div className="game">
			<div className={`viewport${shake ? " shake" : ""}`}>
				<IsoCanvas
					city={world.city}
					territory={world.territory}
					factions={world.factions}
					attacks={world.attacks}
					tick={world.tick}
					focus={focus}
					selected={selected}
					colorblind={colorblind}
					version={version}
					onModuleClick={(module) => setSelected(module)}
					onModuleHover={setHovered}
					onProjector={(project) => {
						projectorRef.current = project;
					}}
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
				<Radar
					city={world.city}
					territory={world.territory}
					factions={world.factions}
					attacks={world.attacks}
					selected={selected}
					colorblind={colorblind}
					version={version}
					onSelect={(module) => setSelected(module)}
				/>
			</div>

			<div ref={hoverRef} className={`hover-card${hovered !== null ? " show" : ""}`}>
				{hovered !== null ? (
					<>
						<span className="hover-owner">
							{hoverOwnerName} · {hoverZone ? ZONE_LABELS[hoverZone] : "—"} · contrôle {hoverControl}
						</span>
						<span className="hover-line">
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
						</span>
					</>
				) : null}
			</div>

			<div className="hud">
				<header className="topbar card">
					<div className="brand">
						<h1>DealerFront</h1>
						<span className="brand-sub">
							seed {world.city.seed} · {world.city.archetype}
						</span>
					</div>
					<div className="top-stats">
						<div className="stat">
							<span>Membres</span>
							<strong>{Math.round(player.members).toLocaleString("fr-FR")}</strong>
						</div>
						<div className="stat">
							<span>Produit</span>
							<strong>{Math.round(player.produit)}</strong>
						</div>
						<div className="stat">
							<span>Cash sale</span>
							<strong>{Math.round(player.cashSale).toLocaleString("fr-FR")}</strong>
						</div>
						<div className="stat">
							<span>Cash propre</span>
							<strong className="clean">
								{Math.round(player.cashPropre).toLocaleString("fr-FR")}
							</strong>
						</div>
						<div className="stat">
							<span>Contrôle</span>
							<strong>{playerPct}%</strong>
						</div>
						<div className="stat">
							<span>Quartiers</span>
							<strong>
								{world.modulesOwned(player.id)}
								<em>/{totalModules}</em>
							</strong>
						</div>
						<div className="stat">
							<span>Production</span>
							<strong>+{perSecond}/s</strong>
						</div>
					</div>
					<div className="top-right">
						<span className="objective">
							Objectif ≥ {Math.round(threshold * 100)} % ·{" "}
							{Math.round(player.cashPropre).toLocaleString("fr-FR")}/
							{cleanGoal.toLocaleString("fr-FR")} propre
						</span>
						<span className="timer">reste {timeLeft}</span>
					</div>
				</header>

				<section className="card panel-left">
					<p className="advisor">{advisor}</p>
					{notice ? <p className="notice">{notice}</p> : null}
					<h2>
						Quartier <em>{selected !== null ? `module ${selected}` : "—"}</em>
					</h2>
					<div className="line">
						<span>Chantiers</span>
						<code>
							{world.activeConstructions(player.id)}/{world.buildCrews()} ·{" "}
							{world.queueLength()}/{world.queueCap()} en file
						</code>
					</div>
					<div className="line">
						<span>Propriétaire</span>
						<code
							style={{
								color:
									selectedOwner === NEUTRAL ? undefined : world.factions[selectedOwner]?.color,
							}}
						>
							{selectedOwnerName}
						</code>
					</div>
					<div className="line">
						<span>Contrôle</span>
						<code>{selected !== null ? Math.round(world.controlAt(selected)) : "—"}</code>
					</div>
					<div className="line">
						<span>Bâtiment</span>
						<code>{selectedBuilding ? BUILDINGS[selectedBuilding].label : "—"}</code>
					</div>
					<div className="line">
						<span>Zone</span>
						<code>{selectedZoneLabel}</code>
					</div>

					<label className="slider-row" title="Part des Membres engagée à chaque assaut">
						<span>Troupes</span>
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
						<code>{Math.round(world.playerAttackRatio() * 100)}%</code>
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
								<br />1 bâtiment par quartier — capturez un autre quartier pour en bâtir un autre.
							</p>
						) : (
							<>
								<div className="build-menu">
									{BUILDING_TYPES.map((type) => {
										const reason = blockReason(type);
										const zoneBlocked = reason === "zone incompatible";
										return (
											<button
												key={type}
												type="button"
												className={type === recommendedType ? "recommended" : undefined}
												disabled={!afford(type)}
												title={`${BUILDINGS[type].label} — ${BUILDING_EFFECT_LABELS[type]} · ${formatCost(type, costFactor)}${reason ? ` · ${reason}` : ""}`}
												onClick={() => build(type)}
											>
												{BUILDINGS[type].label}
												<em className={zoneBlocked ? "zone" : reason ? "lack" : undefined}>
													{zoneBlocked ? "zone incompatible" : formatCost(type, costFactor)}
												</em>
											</button>
										);
									})}
								</div>
								{recommendedType ? (
									<p className="hint-inline">
										<strong>Conseillé :</strong> {BUILDINGS[recommendedType].label} —{" "}
										{BUILDING_EFFECT_LABELS[recommendedType]}
									</p>
								) : null}
								<p
									className="hint-inline"
									title={allowedHere.map((type) => BUILDINGS[type].label).join(", ")}
								>
									Zone <strong>{selectedZoneLabel}</strong> —{" "}
									{isConversion
										? "conversion −50 %"
										: `chantier${recommendedType ? ` ${Math.round(BUILD_TICKS[recommendedType] / SIM_HZ)} s` : ""}`}
									.
								</p>
							</>
						)
					) : (
						<>
							<button type="button" disabled={!canAttack} onClick={act}>
								{canAttack ? `Assaut (Q) · ${engaged} engagés` : "Non attaquable"}
							</button>
							{canAttack ? (
								<p className="hint-inline">
									Siège : contrôle {targetControl} · défense ×{targetDefense.toFixed(1)}
									{world.buildingAt(selected!) === "planque" ? " (planque)" : ""} · max{" "}
									{world.maxAssaults()} assauts simultanés
								</p>
							) : (
								<p className="hint-inline">{attackReason}</p>
							)}
							{selectedOwner !== player.id && selectedOwner !== NEUTRAL ? (
								<button
									type="button"
									disabled={raidReason() !== null}
									title={raidReason() ?? "Détruit le contrôle et les bâtiments, sans capturer"}
									onClick={() => {
										if (selected !== null && world.playerRaid(selected)) {
											setVersion((value) => value + 1);
										} else {
											setNotice(`Raid : ${raidReason() ?? "impossible"}.`);
										}
									}}
								>
									Raid ({world.raidCost().sale} sale{raidReason() ? ` · ${raidReason()}` : ""})
								</button>
							) : null}
							{selectedOwner !== player.id && selectedBuilding ? (
								<button
									type="button"
									disabled={descentReason() !== null}
									title={descentReason() ?? "Coup de main : vole le butin sans détruire le bâtiment"}
									onClick={() => {
										if (selected !== null && world.playerDescent(selected)) {
											setVersion((value) => value + 1);
										} else {
											setNotice(`Descente : ${descentReason() ?? "impossible"}.`);
										}
									}}
								>
									Descente{descentReason() ? ` · ${descentReason()}` : ` (+butin)`}
								</button>
							) : null}
							{selectedOwner !== player.id && selectedBuilding ? (
								<button
									type="button"
									disabled={sabotageReason() !== null}
									title={sabotageReason() ?? "Divise la production du bâtiment pendant 30 s"}
									onClick={() => {
										if (selected !== null && world.playerSabotage(selected)) {
											setVersion((value) => value + 1);
										} else {
											setNotice(`Sabotage : ${sabotageReason() ?? "impossible"}.`);
										}
									}}
								>
									Sabotage{sabotageReason() ? ` · ${sabotageReason()}` : ` (${world.sabotageCost()})`}
								</button>
							) : null}
							{selectedOwner !== player.id ? (
								<button
									type="button"
									className="hitman"
									disabled={hitmanReason() !== null}
									title={hitmanReason() ?? "Affaiblit un quartier (Armement ≥ 2)"}
									onClick={() => {
										if (selected !== null && world.playerHitman(selected)) {
											setVersion((value) => value + 1);
										} else {
											setNotice(`Tueur à gage : ${hitmanReason() ?? "impossible"}.`);
										}
									}}
								>
									Tueur à gage (T){hitmanReason() ? ` · ${hitmanReason()}` : ""}
								</button>
							) : null}
						</>
					)}
					{batch.count > 0 ? (
						<section className="card">
							<h2>
								Aménagement par lot <em>{batch.count} quartier(s)</em>
							</h2>
							<div className="line">
								<span>Coût total</span>
								<code>
									{batch.sale > 0 ? `${batch.sale.toLocaleString("fr-FR")} sale ` : ""}
									{batch.members > 0 ? `${batch.members.toLocaleString("fr-FR")} membres ` : ""}
									{batch.clean > 0 ? `${batch.clean.toLocaleString("fr-FR")} propre` : ""}
								</code>
							</div>
							<button
								type="button"
								onClick={() => {
									world.playerBatchBuild();
									setVersion((value) => value + 1);
								}}
							>
								Aménager le lot
							</button>
							<p className="hint-inline">
								Applique la composition conseillée à tous tes quartiers vides (file limitée à{" "}
								{world.queueCap()}).
							</p>
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
							Baissez pour garder du Cash sale (achats), montez pour l'objectif de victoire.
						</p>
					</section>
					{world.playerBuildOrders().length > 0 ? (
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
								world.log.slice(-3).map((line, index) => <li key={index}>{line}</li>)
							)}
						</ul>
					</section>
					<div className="bottom-controls">
						<p className="hud-keys">
							<kbd>clic</kbd> sélectionner · <kbd>Q</kbd> attaquer / bâtir · <kbd>T</kbd> tueur ·
							glisser = caméra
						</p>
						<div className="hud-actions">
							<button type="button" onClick={() => setRunning((value) => !value)}>
								{running ? "Pause" : "Démarrer"}
							</button>
							<button type="button" onClick={regenerate}>
								Nouvelle seed
							</button>
							<button
								type="button"
								className={`toggle${colorblind ? " active" : ""}`}
								onClick={() => setColorblind((value) => !value)}
							>
								Daltonien
							</button>
							<button
								type="button"
								className={`toggle${sound ? " active" : ""}`}
								onClick={() => setSound((value) => !value)}
							>
								{sound ? "Son" : "Muet"}
							</button>
							<button type="button" className="toggle" onClick={() => setShowHelp(true)}>
								Aide
							</button>
						</div>
						<p className="hud-foot" title={`API ${api}`}>
							tick {world.tick} · reste {timeLeft}
						</p>
					</div>
				</footer>
			</div>

			{showHelp ? (
				<div className="help-overlay">
					<div className="help-card card">
						<h2>Comment jouer</h2>
						<p>
							<strong>But :</strong> détenir <strong>≥ {Math.round(threshold * 100)} %</strong> des
							quartiers <em>et</em> <strong>{cleanGoal.toLocaleString("fr-FR")} de Cash propre</strong>{" "}
							avant la fin du temps.
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
								<strong>Façade</strong> → Cash sale devient <strong>Cash propre</strong> (l'objectif).
							</li>
						</ol>
						<p>
							<strong>Atelier</strong> débloque la tech · <strong>Planque</strong> défend un quartier ·
							un seul bâtiment par quartier.
						</p>
						<p>
							<strong>Zones :</strong> on convertit le bâti existant — chaque quartier n'accepte que
							certains bâtiments (parc → planque, police → contre-espionnage, terrain vague →
							construction neuve…). Le détail est affiché sous le menu de construction.
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
							Sélectionnez un quartier <strong>adjacent</strong> puis <kbd>Q</kbd> pour l'attaquer
							(20 % de vos Membres engagés).
						</p>
						<h3>Police</h3>
						<p>
							Dominer fait monter la Pression : <strong>Corrompre</strong> la réduit, sinon raids puis
							liquidation.
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
				<div className="end-banner">
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
