import { useEffect, useRef } from "react";
import { MODULES_W } from "../sim/constants";
import type { Faction } from "../sim/factions";
import { NEUTRAL, type Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import type { Attack } from "../sim/world";
import { factionDisplayColor } from "./palette";

const SIZE = 220;

interface RadarProps {
	city: CityGrid;
	territory: Territory;
	factions: readonly Faction[];
	attacks: readonly Attack[];
	selected: number | null;
	colorblind: boolean;
	version: number;
	onSelect: (module: number) => void;
}

/** Minimap : possession par faction (aplat), sélection, clic pour sélectionner. */
export function Radar({
	city,
	territory,
	factions,
	attacks,
	selected,
	colorblind,
	version,
	onSelect,
}: RadarProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const count = city.modules.length;
	const stateRef = useRef<{
		owner: Int16Array;
		attacked: Int16Array;
		selected: number | null;
		colorblind: boolean;
	} | null>(null);
	if (stateRef.current === null || stateRef.current.owner.length !== count) {
		stateRef.current = {
			owner: new Int16Array(count).fill(-2),
			attacked: new Int16Array(count).fill(-1),
			selected: null,
			colorblind,
		};
	}

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const state = stateRef.current!;

		// Signature : propriétaire + attaques + sélection + mode couleur.
		const underAttack = new Int16Array(count);
		for (const attack of attacks) underAttack[attack.target] = 1;
		let dirty =
			state.selected !== selected ||
			state.colorblind !== colorblind ||
			state.owner[0] === -2;
		for (let module = 0; module < count && !dirty; module += 1) {
			if (territory.owner[module] !== state.owner[module]) dirty = true;
			else if (underAttack[module] !== state.attacked[module]) dirty = true;
		}
		if (!dirty) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const cell = SIZE / MODULES_W;
		ctx.clearRect(0, 0, SIZE, SIZE);

		for (let module = 0; module < count; module += 1) {
			const owner = territory.owner[module]!;
			state.owner[module] = owner;
			state.attacked[module] = underAttack[module]!;
			const mx = module % MODULES_W;
			const my = Math.floor(module / MODULES_W);
			let fill = "#1B2026";
			if (owner !== NEUTRAL) {
				const faction = factions[owner];
				fill = faction ? factionDisplayColor(owner, faction.color, colorblind) : "#666";
			}
			ctx.fillStyle = fill;
			ctx.fillRect(mx * cell, my * cell, cell - 0.5, cell - 0.5);
			if (underAttack[module] === 1) {
				ctx.strokeStyle = "#E23B2E";
				ctx.lineWidth = 1.5;
				ctx.strokeRect(mx * cell + 1, my * cell + 1, cell - 2.5, cell - 2.5);
			}
			if (module === selected) {
				ctx.strokeStyle = "#FFFFFF";
				ctx.lineWidth = 2;
				ctx.strokeRect(mx * cell + 1, my * cell + 1, cell - 2.5, cell - 2.5);
			}
		}
		state.selected = selected;
		state.colorblind = colorblind;
	}, [city, territory, factions, attacks, selected, colorblind, version, count]);

	const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const mx = Math.floor(((event.clientX - rect.left) / rect.width) * MODULES_W);
		const my = Math.floor(((event.clientY - rect.top) / rect.height) * MODULES_W);
		const clampedX = Math.min(MODULES_W - 1, Math.max(0, mx));
		const clampedY = Math.min(MODULES_W - 1, Math.max(0, my));
		onSelect(clampedY * MODULES_W + clampedX);
	};

	return (
		<div className="radar">
			<canvas
				ref={canvasRef}
				width={SIZE}
				height={SIZE}
				className="radar-canvas"
				onClick={handleClick}
			/>
			<p className="radar-hint">Clic : sélectionner un quartier</p>
		</div>
	);
}

