import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
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
/** mapcn préfixe l'id source/layer par `geojson-source-` / `geojson-fill-`. */
const SOURCE_ID = `geojson-source-${SOURCE}`;
const BUILDING_SOURCE = "buildings";
const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };
const NEUTRAL_COLOR = "#2A3140";
const PARIS_CENTER: [number, number] = [2.3522, 48.8566];
const CONVOY_SOURCE = "convoys";
const CONVOY_SPEED = 0.045;
/** Durée du flash de capture (ticks, 10 Hz). */
const CAPTURE_FLASH_TICKS = 16;

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
	onModuleClick: (module: number) => void;
	onModuleHover: (module: number | null) => void;
	onProjector: (project: (module: number) => { x: number; y: number } | null) => void;
}

/** Icône de bâtiment : id d'image MapLibre par type (0 = aucun bâtiment). */
const BUILDING_ICON_ID = (type: BuildingType) => `bld-${type}`;

/** Couleur de remplissage pilotée par `feature-state` (faction + contrôle). */
function factionMatch(colorblind: boolean): unknown[] {
	const match: unknown[] = ["match", ["coalesce", ["feature-state", "faction"], -1]];
	FACTION_COLORS.forEach((color, index) => {
		match.push(index, factionDisplayColor(index, color, colorblind));
	});
	match.push(NEUTRAL_COLOR);
	return match;
}

/**
 * Carte « vraie ville » (Paris IRIS) — rendue via mapcn (Map / MapGeoJSON / MapArc).
 * Chaque quartier IRIS est un quartier jouable : possession + Contrôle, sans grille.
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
	onModuleClick,
	onModuleHover,
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
		// `attacks` est muté en place : on suit aussi le tick.
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
					/>
					<ProjectorBridge onProjector={onProjector} />
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
			<MapControls className="map-controls" />
		</Map>
	);
}

/**
 * Possession, Contrôle, heat, flash de capture et pulse de siège — tout par
 * `feature-state`, sans recharger les 992 géométries (une action = un retour visuel).
 */
function EffectStates({
	territory,
	attacks,
	heat,
	tick,
	version,
	selected,
}: {
	territory: Territory;
	attacks: readonly Attack[];
	heat: Float32Array;
	tick: number;
	version: number;
	selected: number | null;
}) {
	const { map, isLoaded } = useMap();
	const prevOwner = useRef<Int16Array | null>(null);
	const prevBuildings = useRef<string>("");
	const prevAttacked = useRef<Set<number>>(new Set());
	const prevControl = useRef<Uint8Array | null>(null);
	const prevHeat = useRef<Uint8Array | null>(null);
	const prevFlash = useRef<Uint8Array | null>(null);
	const prevBuilding = useRef<Int8Array | null>(null);
	const prevSiege = useRef<string>("");

	// La source est recréée quand la carte/le style change : on repart du cache.
	useEffect(() => {
		prevOwner.current = null;
		prevControl.current = null;
		prevHeat.current = null;
		prevFlash.current = null;
		prevBuilding.current = null;
		prevBuildings.current = "";
		prevAttacked.current = new Set();
		prevSiege.current = "";
	}, [map, isLoaded]);

	// Couches d'effet (une seule fois) : heat, flash de capture, siège.
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
		// Jauge de conquête : trait épais qui grossit *vers l'intérieur* du quartier
		// (offset négatif) au fur et à mesure que le Contrôle baisse.
		// `zoom` doit rester l'entrée de plus haut niveau de l'expression.
		if (!map.getLayer("iris-conquest")) {
			const progress = ["coalesce", ["feature-state", "conquest"], 0] as never;
			const conquestWidth = [
				"interpolate",
				["linear"],
				["zoom"],
				11,
				["*", progress, 12],
				13,
				["*", progress, 40],
				15,
				["*", progress, 130],
				17,
				["*", progress, 255],
			] as never;
			const conquestOffset = [
				"interpolate",
				["linear"],
				["zoom"],
				11,
				["*", progress, 6],
				13,
				["*", progress, 20],
				15,
				["*", progress, 65],
				17,
				["*", progress, 127.5],
			] as never;
			map.addLayer({
				id: "iris-conquest",
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": "#ffffff",
					"line-width": conquestWidth,
					"line-offset": conquestOffset,
					"line-opacity": 0.6,
					"line-blur": 2.5,
				},
			});
		}
		// Icônes de bâtiment : MapLibre n'autorise `feature-state` qu'en *paint*,
		// pas en layout (icon-image) ni en filter. On passe donc par une source
		// GeoJSON de points portant le type de bâtiment en propriété.
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
				minzoom: 10,
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

	// Points des bâtiments : recalculés seulement quand un bâtiment change.
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

	// Siège (couleur) quand le front change ; conquête (remplissage bord→centre)
	// recalculée à chaque tick pour les quartiers assiégés.
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

	// Possession + contrôle + heat + flash + bâtiment (incrémental).
	useEffect(() => {
		if (!map || !isLoaded || !map.getSource(SOURCE_ID)) return;
		const count = territory.count;
		const owner = prevOwner.current ?? (prevOwner.current = new Int16Array(count).fill(-2));
		const control = prevControl.current ?? (prevControl.current = new Uint8Array(count));
		const heatCache = prevHeat.current ?? (prevHeat.current = new Uint8Array(count));
		const flash = prevFlash.current ?? (prevFlash.current = new Uint8Array(count));
		const building = prevBuilding.current ?? (prevBuilding.current = new Int8Array(count).fill(-2));
		for (let i = 0; i < count; i += 1) {
			const nextOwner = territory.owner[i]!;
			const nextControl = Math.round(territory.control[i]!);
			const nextHeat = Math.round(heat[i] ?? 0);
			const age = tick - territory.capturedAt[i]!;
			const nextFlash = age >= 0 && age < CAPTURE_FLASH_TICKS ? 1 : 0;
			const nextBuilding = territory.building[i]!;
			if (
				owner[i] !== nextOwner ||
				control[i] !== nextControl ||
				heatCache[i] !== nextHeat ||
				flash[i] !== nextFlash ||
				building[i] !== nextBuilding
			) {
				owner[i] = nextOwner;
				control[i] = nextControl;
				heatCache[i] = nextHeat;
				flash[i] = nextFlash;
				building[i] = nextBuilding;
				map.setFeatureState({ source: SOURCE_ID, id: i }, {
					faction: nextOwner,
					control: nextControl,
					heat: nextHeat,
					flash: nextFlash,
					building: BUILDING_TYPES[nextBuilding] ?? "",
				});
			}
		}
	}, [map, isLoaded, version, territory, heat, tick]);

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

/** Expose la projection quartier → écran (textes flottants). */
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

/** Centre la vue sur le premier quartier du joueur. */
function CenterOnPlayer({ territory }: { territory: Territory }) {
	const { map, isLoaded } = useMap();

	useEffect(() => {
		if (!map || !isLoaded) return;
		for (let i = 0; i < territory.count; i += 1) {
			if (territory.owner[i] !== 0) continue;
			const center = PARIS_CENTROIDS[i];
			if (center) map.jumpTo({ center: [center[0], center[1]] });
			break;
		}
	}, [map, isLoaded, territory]);

	return null;
}

/** Couleur d'un convoi selon sa faction. */
function convoyColor(colorblind: boolean): unknown[] {
	const match: unknown[] = ["match", ["get", "f"]];
	FACTION_COLORS.forEach((color, index) => {
		match.push(index, factionDisplayColor(index, color, colorblind));
	});
	match.push("#ffffff");
	return match;
}

/** Convois logistiques : route + point animé (une action = un retour visuel). */
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
					"circle-radius": 4,
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
		const step = reduced ? 0.5 : (tick * CONVOY_SPEED) % 1;
		const features: GeoJSON.Feature[] = [];
		convoys.forEach((route, index) => {
			const from: [number, number] = [...(PARIS_CENTROIDS[route.from] ?? PARIS_CENTER)];
			const to: [number, number] = [...(PARIS_CENTROIDS[route.to] ?? PARIS_CENTER)];
			const progress = (step + index * 0.17) % 1;
			features.push({
				type: "Feature",
				properties: { f: route.factionId },
				geometry: { type: "LineString", coordinates: [from, to] },
			});
			features.push({
				type: "Feature",
				properties: { f: route.factionId },
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
