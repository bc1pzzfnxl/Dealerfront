import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { renderToStaticMarkup } from "react-dom/server";
import {
	Map,
	MapArc,
	MapControls,
	MapGeoJSON,
	useMap,
	type MapGeoJSONEvent,
} from "@/components/ui/map";
import { BUILDING_TYPES, type BuildingType } from "../sim/buildings";
import { FACTION_COLORS } from "../sim/factions";
import { PARIS_CENTROIDS } from "../sim/maps/paris";
import parisGeoUrl from "../sim/maps/paris-iris.geojson?url";
import type { Territory } from "../sim/territory";
import type { Attack, ConvoyRoute } from "../sim/world";
import { BUILDING_ICONS, buildingIconImage } from "./icons";
import { factionDisplayColor } from "./palette";
import { useReducedMotion } from "./useReducedMotion";

const SOURCE = "iris";
/** mapcn prefixes the source/layer id with `geojson-source-` / `geojson-fill-`. */
const SOURCE_ID = `geojson-source-${SOURCE}`;
const BUILDING_SOURCE = "buildings";
const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };
const NEUTRAL_COLOR = "#2A3140";
const PARIS_CENTER: [number, number] = [2.3522, 48.8566];
const CONVOY_SOURCE = "convoys";
/** Capture flash duration (ticks, 10 Hz). */
const CAPTURE_FLASH_TICKS = 16;
/** Build pulse duration (ticks, 10 Hz). */
const BUILD_FLASH_TICKS = 14;
/** Outgoing / incoming front label colors (OpenFront convention). */
const OUTGOING_COLOR = "#3fa9f5";
const INCOMING_COLOR = "#f87171";

/** One "X vs Y" troop label pinned to a contested quarter. */
interface FrontLabel {
	key: string;
	x: number;
	y: number;
	attacker: number;
	defender: number;
	mine: boolean;
}

interface IrisProps {
	i: number;
	code: string;
	name: string;
}

interface ArcDatum {
	id: string;
	from: [number, number];
	to: [number, number];
	color: string;
}

interface WorldMapProps {
	territory: Territory;
	attacks: readonly Attack[];
	convoys: readonly ConvoyRoute[];
	heat: Float32Array;
	tick: number;
	selected: number | null;
	colorblind: boolean;
	version: number;
	playerId: number;
	/** Troop-equivalent defending a quarter (front labels). */
	defenseAt: (module: number) => number;
	onModuleClick: (module: number) => void;
	onModuleHover: (module: number | null) => void;
	onEmptyClick: () => void;
	onProjector: (project: (module: number) => { x: number; y: number } | null) => void;
}

/** Building icon: MapLibre image id per type (0 = no building). */
const BUILDING_ICON_ID = (type: BuildingType) => `bld-${type}`;

/** Fill color driven by `feature-state` (faction + control). */
function factionMatch(colorblind: boolean): unknown[] {
	const match: unknown[] = ["match", ["coalesce", ["feature-state", "faction"], -1]];
	FACTION_COLORS.forEach((color, index) => {
		match.push(index, factionDisplayColor(index, color, colorblind));
	});
	match.push(NEUTRAL_COLOR);
	return match;
}

/**
 * "Real city" map (Paris IRIS) — rendered via mapcn (Map / MapGeoJSON / MapArc).
 * Each IRIS quarter is a playable quarter: ownership + Control, no grid.
 */
export function WorldMap({
	territory,
	attacks,
	convoys,
	heat,
	tick,
	selected,
	colorblind,
	version,
	playerId,
	defenseAt,
	onModuleClick,
	onModuleHover,
	onEmptyClick,
	onProjector,
}: WorldMapProps) {
	const [collection, setCollection] = useState<FeatureCollection<Geometry, IrisProps> | null>(
		null,
	);
	const reduced = useReducedMotion();

	useEffect(() => {
		let cancelled = false;
		fetch(parisGeoUrl)
			.then((res) => res.json() as Promise<FeatureCollection<Geometry, IrisProps>>)
			.then((data) => {
				if (!cancelled) setCollection(data);
			})
			.catch(() => {
				if (!cancelled) setCollection(null);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const fillPaint = useMemo(
		() => ({
			"fill-color": factionMatch(colorblind) as never,
			"fill-opacity": [
				"case",
				["==", ["coalesce", ["feature-state", "faction"], -1], -1],
				0.28,
				["+", 0.28, ["*", 0.5, ["/", ["coalesce", ["feature-state", "control"], 0], 100]]],
			] as never,
		}),
		[colorblind],
	);

	const linePaint = useMemo(
		() => ({
			"line-color": [
				"case",
				["boolean", ["feature-state", "selected"], false],
				"#ffffff",
				"#0b0e12",
			] as never,
			"line-width": [
				"case",
				["boolean", ["feature-state", "selected"], false],
				2.2,
				0.5,
			] as never,
		}),
		[],
	);

	const arcs = useMemo<ArcDatum[]>(
		() =>
			attacks.map((attack, index) => ({
				id: `${attack.source}-${attack.target}-${index}`,
				from: [...(PARIS_CENTROIDS[attack.source] ?? PARIS_CENTER)] as [number, number],
				to: [...(PARIS_CENTROIDS[attack.target] ?? PARIS_CENTER)] as [number, number],
				color: factionDisplayColor(
					attack.factionId,
					FACTION_COLORS[attack.factionId] ?? "#ffffff",
					colorblind,
				),
			})),
		// `attacks` is mutated in place: we track the tick too.
		[attacks, tick, colorblind],
	);

	return (
		<Map blank className="world-map" center={PARIS_CENTER} zoom={11.4}>
			{collection ? (
				<>
					<MapGeoJSON<IrisProps>
						id={SOURCE}
						data={collection}
						promoteId="i"
						fillPaint={fillPaint}
						linePaint={linePaint}
						interactive
						onHover={(event: MapGeoJSONEvent<IrisProps> | null) => {
							onModuleHover(event ? Number(event.feature.properties.i) : null);
						}}
						onClick={(event: MapGeoJSONEvent<IrisProps>) => {
							const index = Number(event.feature.properties.i);
							if (Number.isFinite(index)) onModuleClick(index);
						}}
					/>
					<EffectStates
						territory={territory}
						attacks={attacks}
						heat={heat}
						tick={tick}
						version={version}
						selected={selected}
						reduced={reduced}
					/>
					<ProjectorBridge onProjector={onProjector} />
					<DeselectOnEmpty onEmptyClick={onEmptyClick} />
					<CenterOnPlayer territory={territory} />
				</>
			) : null}
			<MapArc<ArcDatum>
				data={arcs}
				paint={{
					"line-color": ["get", "color"],
					"line-width": 1.6,
					"line-dasharray": [2, 1.5],
					"line-opacity": 0.9,
				}}
				interactive={false}
			/>
			<Convoys convoys={convoys} tick={tick} colorblind={colorblind} reduced={reduced} />
			<AttackLabels
				attacks={attacks}
				playerId={playerId}
				defenseAt={defenseAt}
				tick={tick}
				territory={territory}
			/>
			<MapControls className="map-controls" />
		</Map>
	);
}

/**
 * Ownership, Control, heat, capture flash and siege pulse — all via
 * `feature-state`, without reloading the 992 geometries (one action = one visual feedback).
 */
function EffectStates({
	territory,
	attacks,
	heat,
	tick,
	version,
	selected,
	reduced,
}: {
	territory: Territory;
	attacks: readonly Attack[];
	heat: Float32Array;
	tick: number;
	version: number;
	selected: number | null;
	reduced: boolean;
}) {
	const { map, isLoaded } = useMap();
	const prevOwner = useRef<Int16Array | null>(null);
	const prevBuildings = useRef<string>("");
	const prevAttacked = useRef<Set<number>>(new Set());
	const hqRef = useRef<number>(-1);
	const prevControl = useRef<Uint8Array | null>(null);
	const prevHeat = useRef<Uint8Array | null>(null);
	const prevFlash = useRef<Uint8Array | null>(null);
	const prevBuilt = useRef<Uint8Array | null>(null);
	const prevBuilding = useRef<Int8Array | null>(null);
	const prevSiege = useRef<string>("");
	/** Changed quarters waiting to be painted (tick drip). */
	const drip = useRef<{ i: number; state: Record<string, unknown> }[]>([]);
	const raf = useRef<number | null>(null);

	/**
	 * Tick drip: a capture paints over ~9 render frames (~150 ms) instead of
	 * popping all at once (OpenFront idea). Keeps the 10 Hz sim readable at 60 fps.
	 */
	const drain = useCallback(() => {
		raf.current = null;
		if (!map || !isLoaded) return;
		const pending = drip.current;
		if (pending.length === 0) return;
		const take = Math.max(1, Math.ceil(pending.length / 9));
		for (const item of pending.splice(0, take)) {
			map.setFeatureState({ source: SOURCE_ID, id: item.i }, item.state);
		}
		if (pending.length > 0) raf.current = requestAnimationFrame(drain);
	}, [map, isLoaded]);

	useEffect(
		() => () => {
			if (raf.current !== null) cancelAnimationFrame(raf.current);
		},
		[],
	);

	// The source is recreated when the map/style changes: reset the cache.
	useEffect(() => {
		prevOwner.current = null;
		prevControl.current = null;
		prevHeat.current = null;
		prevFlash.current = null;
		prevBuilt.current = null;
		prevBuilding.current = null;
		prevBuildings.current = "";
		prevAttacked.current = new Set();
		prevSiege.current = "";
		drip.current.length = 0;
	}, [map, isLoaded]);

	// Effect layers (once): heat, capture flash, siege.
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID)) return;
		if (!map.getLayer("iris-heat")) {
			map.addLayer({
				id: "iris-heat",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": "#ff6a4d",
					"line-width": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "heat"], 0],
						0,
						0,
						20,
						1.5,
						100,
						4,
					] as never,
					"line-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "heat"], 0],
						0,
						0,
						20,
						0.5,
						100,
						0.9,
					] as never,
				},
			});
		}
		if (!map.getLayer("iris-capture")) {
			map.addLayer({
				id: "iris-capture",
				type: "fill",
				source: SOURCE_ID,
				paint: {
					"fill-color": "#ffffff",
					"fill-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "flash"], 0],
						0,
						0,
						1,
						0.75,
					] as never,
				},
			});
		}
		if (!map.getLayer("iris-capture-line")) {
			map.addLayer({
				id: "iris-capture-line",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": "#ffffff",
					"line-width": 3,
					"line-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "flash"], 0],
						0,
						0,
						1,
						0.95,
					] as never,
					"line-blur": 1.5,
				},
			});
		}
		if (!map.getLayer("iris-siege")) {
			map.addLayer({
				id: "iris-siege",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": [
						"match",
						["coalesce", ["feature-state", "siege"], -1],
						-1,
						"#00000000",
						...FACTION_COLORS.flatMap((color, index) => [index, color]),
						"#ffffff",
					] as never,
					"line-width": 2.4,
					"line-opacity": 0.95,
					"line-dasharray": [1.6, 1.2],
				},
			});
		}
		// Conquest gauge: the quarter fills with white as its
		// Control drops. A `fill` stays **contained within the polygon** (a thick
		// stroke would spill over the corners).
		if (!map.getLayer("iris-conquest")) {
			map.addLayer({
				id: "iris-conquest",
				type: "fill",
				source: SOURCE_ID,
				paint: {
					"fill-color": "#ffffff",
					"fill-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "conquest"], 0],
						0,
						0,
						0.02,
						0.08,
						1,
						0.62,
					] as never,
				},
			});
		}
		// Build animation: green pulse when the build site is delivered.
		if (!map.getLayer("iris-built")) {
			map.addLayer({
				id: "iris-built",
				type: "fill",
				source: SOURCE_ID,
				paint: {
					"fill-color": "#8fd8a5",
					"fill-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "built"], 0],
						0,
						0,
						1,
						0.55,
					] as never,
				},
			});
		}
		if (!map.getLayer("iris-built-line")) {
			map.addLayer({
				id: "iris-built-line",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": "#b7f0c8",
					"line-width": 2.6,
					"line-opacity": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "built"], 0],
						0,
						0,
						1,
						0.95,
					] as never,
				},
			});
		}
		// Player HQ: pulsing white ring ("you are here" marker).
		if (!map.getLayer("iris-hq")) {
			map.addLayer({
				id: "iris-hq",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": "#ffffff",
					"line-width": [
						"interpolate",
						["linear"],
						["coalesce", ["feature-state", "hqPulse"], 0],
						0,
						1.5,
						1,
						4.5,
					] as never,
					"line-opacity": [
						"case",
						["boolean", ["feature-state", "hq"], false],
						0.9,
						0,
					] as never,
				},
			});
		}
		// Building icons: MapLibre only allows `feature-state` in *paint*,
		// not in layout (icon-image) or filter. So we use a GeoJSON
		// point source carrying the building type as a property.
		const color = "#e8eaee";
		if (!map.getSource(BUILDING_SOURCE)) {
			map.addSource(BUILDING_SOURCE, { type: "geojson", data: EMPTY_FC });
		}
		Promise.all(
			BUILDING_TYPES.map((type) =>
				buildingIconImage(
					renderToStaticMarkup(createElement(BUILDING_ICONS[type], { strokeWidth: 2.4 })),
					color,
				).then((image) => {
					if (image && !map.hasImage(BUILDING_ICON_ID(type))) {
						map.addImage(BUILDING_ICON_ID(type), image, { sdf: false });
					}
				}),
			),
		).then(() => {
			if (map.getLayer("iris-buildings")) return;
			map.addLayer({
				id: "iris-buildings",
				type: "symbol",
				source: BUILDING_SOURCE,
				minzoom: 12.5,
				layout: {
					"icon-image": ["concat", "bld-", ["get", "type"]],
					"icon-size": [
						"interpolate",
						["linear"],
						["zoom"],
						10,
						0.55,
						14,
						0.9,
						17,
						1.15,
					] as never,
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				},
			});
		});
	}, [map, isLoaded]);

	// Building points: recomputed only when a building changes.
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(BUILDING_SOURCE)) return;
		const features: Feature<Point, { type: string }>[] = [];
		for (let i = 0; i < territory.count; i += 1) {
			const building = territory.building[i]!;
			const center = PARIS_CENTROIDS[i];
			if (building < 0 || !center) continue;
			features.push({
				type: "Feature",
				id: i,
				geometry: { type: "Point", coordinates: [center[0], center[1]] },
				properties: { type: BUILDING_TYPES[building]! },
			});
		}
		const signature = features.map((feature) => `${feature.id}:${feature.properties.type}`).join(",");
		if (prevBuildings.current === signature) return;
		prevBuildings.current = signature;
		(map.getSource(BUILDING_SOURCE) as GeoJSONSource).setData({
			type: "FeatureCollection",
			features,
		});
	}, [map, isLoaded, territory, version]);

	// Siege (color) when the front changes; conquest (edge→center fill)
	// recomputed every tick for besieged quarters.
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID)) return;
		const next = attacks
			.map((attack) => `${attack.target}:${attack.factionId}`)
			.sort()
			.join(",");
		if (prevSiege.current !== next) {
			prevSiege.current = next;
			for (let i = 0; i < territory.count; i += 1) {
				const attack = attacks.find((candidate) => candidate.target === i);
				map.setFeatureState(
					{ source: SOURCE_ID, id: i },
					{ siege: attack ? attack.factionId : -1 },
				);
			}
		}
		const besieged = new Set<number>();
		for (const attack of attacks) {
			besieged.add(attack.target);
			const control = territory.control[attack.target] ?? 0;
			const progress =
				attack.startControl > 0
					? Math.max(0, Math.min(1, 1 - control / attack.startControl))
					: 0;
			map.setFeatureState(
				{ source: SOURCE_ID, id: attack.target },
				{ conquest: progress },
			);
		}
		for (const id of prevAttacked.current) {
			if (!besieged.has(id)) {
				map.setFeatureState({ source: SOURCE_ID, id }, { conquest: 0 });
			}
		}
		prevAttacked.current = besieged;
	}, [map, isLoaded, attacks, territory, version, tick]);

	// Ownership + control + heat + flash + building (incremental).
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID)) return;
		const count = territory.count;
		const owner = prevOwner.current ?? (prevOwner.current = new Int16Array(count).fill(-2));
		const control = prevControl.current ?? (prevControl.current = new Uint8Array(count));
		const heatCache = prevHeat.current ?? (prevHeat.current = new Uint8Array(count));
		const flash = prevFlash.current ?? (prevFlash.current = new Uint8Array(count));
		const built = prevBuilt.current ?? (prevBuilt.current = new Uint8Array(count));
		const building = prevBuilding.current ?? (prevBuilding.current = new Int8Array(count).fill(-2));
		for (let i = 0; i < count; i += 1) {
			const nextOwner = territory.owner[i]!;
			const nextControl = Math.round(territory.control[i]!);
			const nextHeat = Math.round(heat[i] ?? 0);
			const age = tick - territory.capturedAt[i]!;
			const nextFlash = age >= 0 && age < CAPTURE_FLASH_TICKS ? 1 : 0;
			const builtAge = tick - territory.builtAt[i]!;
			const nextBuilt = builtAge >= 0 && builtAge < BUILD_FLASH_TICKS ? 1 : 0;
			const nextBuilding = territory.building[i]!;
			if (
				owner[i] !== nextOwner ||
				control[i] !== nextControl ||
				heatCache[i] !== nextHeat ||
				flash[i] !== nextFlash ||
				built[i] !== nextBuilt ||
				building[i] !== nextBuilding
			) {
				owner[i] = nextOwner;
				control[i] = nextControl;
				heatCache[i] = nextHeat;
				flash[i] = nextFlash;
				built[i] = nextBuilt;
				building[i] = nextBuilding;
				const state = {
					faction: nextOwner,
					control: nextControl,
					heat: nextHeat,
					flash: nextFlash,
					built: nextBuilt,
					building: BUILDING_TYPES[nextBuilding] ?? "",
				};
				if (reduced) map.setFeatureState({ source: SOURCE_ID, id: i }, state);
				else {
					drip.current.push({ i, state });
					if (raf.current === null) raf.current = requestAnimationFrame(drain);
				}
			}
		}
	}, [map, isLoaded, version, territory, heat, tick, reduced, drain]);

	// HQ: first quarter owned by the player (visual marker).
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID)) return;
		let anchor = -1;
		for (let i = 0; i < territory.count; i += 1) {
			if (territory.owner[i] === 0) {
				anchor = i;
				break;
			}
		}
		if (anchor === hqRef.current) return;
		if (hqRef.current >= 0) {
			map.setFeatureState({ source: SOURCE_ID, id: hqRef.current }, { hq: false });
		}
		hqRef.current = anchor;
		if (anchor >= 0) map.setFeatureState({ source: SOURCE_ID, id: anchor }, { hq: true });
	}, [map, isLoaded, territory, version]);

	// HQ pulse (recomputed every tick).
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID) || hqRef.current < 0) return;
		map.setFeatureState(
			{ source: SOURCE_ID, id: hqRef.current },
			{ hqPulse: (Math.sin(tick / 9) + 1) / 2 },
		);
	}, [map, isLoaded, tick, version]);

	useEffect(() => {
		if (!map || !isLoaded || selected === null || !map.getSource(SOURCE_ID)) return;
		map.setFeatureState({ source: SOURCE_ID, id: selected }, { selected: true });
		return () => {
			if (map.getSource(SOURCE_ID)) {
				map.removeFeatureState({ source: SOURCE_ID, id: selected }, "selected");
			}
		};
	}, [map, isLoaded, selected, version]);

	return null;
}

/** Exposes the quarter → screen projection (floating text). */
function ProjectorBridge({
	onProjector,
}: {
	onProjector: (project: (module: number) => { x: number; y: number } | null) => void;
}) {
	const { map, isLoaded } = useMap();
	const latest = useRef(onProjector);
	latest.current = onProjector;

	useEffect(() => {
		if (!map || !isLoaded) return;
		latest.current((module: number) => {
			const center = PARIS_CENTROIDS[module];
			if (!center) return null;
			const point = map.project([center[0], center[1]]);
			return { x: point.x, y: point.y };
		});
	}, [map, isLoaded]);

	return null;
}

/** Deselects when clicking the map outside any quarter. */
function DeselectOnEmpty({ onEmptyClick }: { onEmptyClick: () => void }) {
	const { map, isLoaded } = useMap();
	const latest = useRef(onEmptyClick);
	latest.current = onEmptyClick;

	useEffect(() => {
		if (!map || !isLoaded) return;
		const handler = (event: MapMouseEvent) => {
			if (map.queryRenderedFeatures(event.point).length === 0) latest.current();
		};
		map.on("click", handler);
		return () => {
			map.off("click", handler);
		};
	}, [map, isLoaded]);

	return null;
}

/** Centers the view on the player's first quarter. */
function CenterOnPlayer({ territory }: { territory: Territory }) {
	const { map, isLoaded } = useMap();

	useEffect(() => {
		if (!map || !isLoaded) return;
		for (let i = 0; i < territory.count; i += 1) {
			if (territory.owner[i] !== 0) continue;
			const center = PARIS_CENTROIDS[i];
			if (center) map.jumpTo({ center: [center[0], center[1]], zoom: 13.5 });
			break;
		}
	}, [map, isLoaded, territory]);

	return null;
}

/** Convoy color by faction. */
function convoyColor(colorblind: boolean): unknown[] {
	const match: unknown[] = ["match", ["get", "f"]];
	FACTION_COLORS.forEach((color, index) => {
		match.push(index, factionDisplayColor(index, color, colorblind));
	});
	match.push("#ffffff");
	return match;
}

/**
 * Front labels: "attacker ⚔ defender" pinned to every contested quarter that
 * involves the player. Blue = your push, red = a push against you. Rendered as
 * an HTML overlay (the blank basemap has no glyphs) so it can ease between
 * ticks instead of snapping.
 */
function AttackLabels({
	attacks,
	playerId,
	defenseAt,
	tick,
	territory,
}: {
	attacks: readonly Attack[];
	playerId: number;
	defenseAt: (module: number) => number;
	tick: number;
	territory: Territory;
}) {
	const { map, isLoaded } = useMap();
	const [labels, setLabels] = useState<FrontLabel[]>([]);

	useEffect(() => {
		if (!map || !isLoaded) return;
		const project = (): void => {
			const next: FrontLabel[] = [];
			attacks.forEach((attack, index) => {
				const mine = attack.factionId === playerId;
				if (!mine && territory.owner[attack.target] !== playerId) return;
				const center = PARIS_CENTROIDS[attack.target] ?? PARIS_CENTER;
				const point = map.project([center[0], center[1]]);
				next.push({
					key: `${attack.factionId}-${attack.target}-${index}`,
					x: point.x,
					y: point.y,
					attacker: Math.round(attack.troops),
					defender: Math.round(defenseAt(attack.target)),
					mine,
				});
			});
			setLabels(next);
		};
		project();
		map.on("move", project);
		map.on("zoom", project);
		return () => {
			map.off("move", project);
			map.off("zoom", project);
		};
	}, [map, isLoaded, attacks, tick, playerId, defenseAt, territory]);

	if (labels.length === 0) return null;
	return (
		<div className="front-labels">
			{labels.map((label) => (
				<div
					key={label.key}
					className={`front-label${label.mine ? " out" : " in"}`}
					style={{
						color: label.mine ? OUTGOING_COLOR : INCOMING_COLOR,
						transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
					}}
				>
					{label.attacker.toLocaleString("en-US")}
					<span className="front-vs">⚔</span>
					{label.defender.toLocaleString("en-US")}
				</div>
			))}
		</div>
	);
}

/** Logistics convoys: route + animated dot (one action = one visual feedback). */
function Convoys({
	convoys,
	tick,
	colorblind,
	reduced,
}: {
	convoys: readonly ConvoyRoute[];
	tick: number;
	colorblind: boolean;
	reduced: boolean;
}) {
	const { map, isLoaded } = useMap();

	useEffect(() => {
		if (!map || !isLoaded) return;
		if (!map.getSource(CONVOY_SOURCE)) {
			map.addSource(CONVOY_SOURCE, {
				type: "geojson",
				data: { type: "FeatureCollection", features: [] },
			});
		}
		if (!map.getLayer("convoy-routes")) {
			map.addLayer({
				id: "convoy-routes",
				type: "line",
				source: CONVOY_SOURCE,
				paint: {
					"line-color": convoyColor(colorblind) as never,
					"line-width": 1,
					"line-opacity": 0.35,
				},
			});
		}
		if (!map.getLayer("convoy-dots")) {
			map.addLayer({
				id: "convoy-dots",
				type: "circle",
				source: CONVOY_SOURCE,
				paint: {
					"circle-radius": ["get", "r"] as never,
					"circle-color": convoyColor(colorblind) as never,
					"circle-stroke-color": "#0b0e12",
					"circle-stroke-width": 1,
				},
			});
		} else {
			map.setPaintProperty("convoy-dots", "circle-color", convoyColor(colorblind) as never);
			map.setPaintProperty("convoy-routes", "line-color", convoyColor(colorblind) as never);
		}
	}, [map, isLoaded, colorblind]);

	useEffect(() => {
		if (!map || !isLoaded) return;
		const source = map.getSource(CONVOY_SOURCE) as GeoJSONSource | undefined;
		if (!source) return;
		const features: GeoJSON.Feature[] = [];
		convoys.forEach((route) => {
			const from: [number, number] = [...(PARIS_CENTROIDS[route.from] ?? PARIS_CENTER)];
			const to: [number, number] = [...(PARIS_CENTROIDS[route.to] ?? PARIS_CENTER)];
			// Real position: the dot only reaches the destination when the cargo
			// lands (no fake loop) — the delay is visible.
			const progress = reduced ? route.progress : Math.min(1, route.progress);
			// A fatter dot carries more money: the cargo is readable at a glance.
			const radius = 3.5 + Math.min(7, route.cargo / 400);
			features.push({
				type: "Feature",
				properties: { f: route.factionId, r: radius },
				geometry: { type: "LineString", coordinates: [from, to] },
			});
			features.push({
				type: "Feature",
				properties: { f: route.factionId, r: radius },
				geometry: {
					type: "Point",
					coordinates: [
						from[0] + (to[0] - from[0]) * progress,
						from[1] + (to[1] - from[1]) * progress,
					],
				},
			});
		});
		source.setData({ type: "FeatureCollection", features });
	}, [map, isLoaded, convoys, tick, reduced]);

	return null;
}
