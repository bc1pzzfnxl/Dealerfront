import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { Map, MapControls, MapGeoJSON } from "@/components/ui/map";

const IRIS_URL =
	"https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-france-iris/exports/geojson?where=dep_code%3D%2275%22&limit=-1";

/** Palette pastel des factions (identique au jeu). */
const FACTIONS = ["#8FC7E8", "#E8C57A", "#8FD8A5", "#B79DE0"] as const;

function hash(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967296;
}

interface IrisProps {
	iris_code: string;
	iris_name: string;
	faction: number;
	control: number;
}

/**
 * Prototype : le concept du jeu posé sur une **vraie carte** (IRIS Paris).
 * Aucune construction : on **colore des zones existantes** (possession + Contrôle
 * simulés) — fond muet, la couleur est l'information.
 */
export function GameMapPrototype() {
	const [collection, setCollection] = useState<FeatureCollection<Geometry, IrisProps> | null>(null);
	const [hovered, setHovered] = useState<{ name: string; faction: number } | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(IRIS_URL)
			.then((res) => res.json() as Promise<FeatureCollection<Geometry, IrisProps>>)
			.then((data) => {
				if (cancelled) return;
				// Possession simulée : une faction + un contrôle par quartier IRIS.
				for (const feature of data.features) {
					const code = String((feature.properties as IrisProps | null)?.iris_code ?? Math.random());
					const props = feature.properties as IrisProps;
					props.faction = Math.floor(hash(code) * FACTIONS.length);
					props.control = 0.45 + hash(`${code}c`) * 0.55;
				}
				setCollection(data);
			})
			.catch(() => setCollection(null));
		return () => {
			cancelled = true;
		};
	}, []);

	const fillPaint = useMemo(
		() => ({
			"fill-color": [
				"match",
				["get", "faction"],
				0,
				FACTIONS[0],
				1,
				FACTIONS[1],
				2,
				FACTIONS[2],
				3,
				FACTIONS[3],
				"#1A2230",
			] as never,
			"fill-opacity": ["*", 0.42, ["get", "control"]] as never,
		}),
		[],
	);

	return (
		<div className="flex flex-col gap-3">
			<div className="h-[520px] overflow-hidden rounded-lg border">
				<Map blank center={[2.3522, 48.8566]} zoom={11.5}>
					{collection ? (
						<MapGeoJSON<IrisProps>
							data={collection}
							promoteId="iris_code"
							fillPaint={fillPaint}
							linePaint={{ "line-color": "#0b0e12", "line-width": 0.6 }}
							interactive
							onHover={(event) => {
								if (!event) {
									setHovered(null);
									return;
								}
								const props = event.feature.properties;
								setHovered({ name: props.iris_name, faction: props.faction });
							}}
							onClick={(event) => {
								const props = event.feature.properties;
								setHovered({ name: props.iris_name, faction: props.faction });
							}}
						/>
					) : null}
					<MapControls />
				</Map>
			</div>

			<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
				{FACTIONS.map((color, index) => (
					<span key={color} className="inline-flex items-center gap-1.5">
						<span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
						Faction {index + 1}
					</span>
				))}
				<span className="ml-auto">
					{hovered
						? `${hovered.name} · Faction ${hovered.faction + 1}`
						: collection
							? `${collection.features.length} quartiers IRIS — survolez`
							: "Chargement des quartiers IRIS…"}
				</span>
			</div>
		</div>
	);
}
