import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
	BUILDINGS,
	BUILDING_TYPES,
	BUILD_TICKS,
	NO_BUILDING,
	type BuildingType,
} from "../sim/buildings";
import { MODULES_H, MODULES_W, MODULE_SIZE } from "../sim/constants";
import type { Faction } from "../sim/factions";
import { NEUTRAL, type Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import type { Attack } from "../sim/world";
import { BUILDING_COLORS, factionDisplayColor } from "./palette";

interface TerritoryOverlayProps {
	city: CityGrid;
	territory: Territory;
	factions: readonly Faction[];
	attacks: readonly Attack[];
	tick: number;
	selected: number | null;
	colorblind: boolean;
	version: number;
}

/** Géométrie d'icône par type de bâtiment. */
const BUILDING_SHAPE: Record<BuildingType, () => THREE.BufferGeometry> = {
	logement: () => new THREE.BoxGeometry(1, 1, 1),
	labo: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
	vente: () => new THREE.BoxGeometry(1, 1, 1),
	facade: () => new THREE.BoxGeometry(1, 1, 1),
	planque: () => new THREE.BoxGeometry(1, 1, 1),
	depot: () => new THREE.BoxGeometry(1, 1, 1),
	atelier: () => new THREE.ConeGeometry(0.6, 1, 8),
	contre: () => new THREE.OctahedronGeometry(0.6),
};

const CONTROL_STEP = 5;
/** Durée (ticks) des flashs d'animation. */
const FLASH = 8;

/** Possession (aplats), frontières, icônes de bâtiments et animations. */
export function TerritoryOverlay({
	city,
	territory,
	factions,
	attacks,
	tick,
	selected,
	colorblind,
	version,
}: TerritoryOverlayProps) {
	const ref = useRef<THREE.InstancedMesh>(null);
	const borderRef = useRef<THREE.InstancedMesh>(null);
	const buildingRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
	const count = city.modules.length;

	const geometries = useMemo(() => BUILDING_TYPES_GEOMETRIES(), []);
	const borderGeometry = useMemo(() => makeBorderGeometry(), []);

	const colors = useMemo(
		() =>
			factions.map(
				(faction, index) =>
					new THREE.Color(factionDisplayColor(index, faction.color, colorblind)),
			),
		[factions, colorblind],
	);
	const buildingColors = useMemo(
		() => Object.fromEntries(
			(Object.keys(BUILDING_COLORS) as BuildingType[]).map((type) => [
				type,
				new THREE.Color(BUILDING_COLORS[type]),
			]),
		) as Record<BuildingType, THREE.Color>,
		[],
	);

	const stateRef = useRef<{
		seed: number;
		owner: Int16Array;
		control: Int16Array;
		building: Int16Array;
		pending: Int16Array;
		fx: Int16Array;
	} | null>(null);
	if (stateRef.current === null || stateRef.current.owner.length !== count) {
		stateRef.current = {
			seed: -1,
			owner: new Int16Array(count).fill(-2),
			control: new Int16Array(count).fill(-1),
			building: new Int16Array(count).fill(-2),
			pending: new Int16Array(count).fill(-2),
			fx: new Int16Array(count).fill(-2),
		};
	}

	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		const state = stateRef.current!;
		const dummy = new THREE.Object3D();
		const color = new THREE.Color();
		const neutral = new THREE.Color("#1A2230");
		const unknown = new THREE.Color("#1A2230");
		const grid = new THREE.Color("#242E3C");
		const white = new THREE.Color("#FFFFFF");

		if (state.seed !== city.seed) {
			state.seed = city.seed;
			state.owner.fill(-2);
			state.control.fill(-1);
			state.building.fill(-2);
			state.pending.fill(-2);
			state.fx.fill(-2);
		}
		const buildMatrices = state.owner[0] === -2 && state.control[0] === -1;

		// 1) Aplats + animation de capture.
		let colorDirty = false;
		for (let module = 0; module < count; module += 1) {
			const owner = territory.owner[module]!;
			const control = territory.control[module]!;
			const ratio = Math.max(0, Math.min(1, control / 100));
			const controlQ = owner === NEUTRAL ? -1 : Math.round(control / CONTROL_STEP);
			const captureFlash = tick - territory.capturedAt[module]!;
			const fx = captureFlash >= 0 && captureFlash < FLASH ? captureFlash : 0;

			if (buildMatrices) {
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.19, centerZ);
				dummy.scale.set(MODULE_SIZE - 0.15, 0.05, MODULE_SIZE - 0.15);
				dummy.updateMatrix();
				mesh.setMatrixAt(module, dummy.matrix);
			}

			if (owner !== state.owner[module] || controlQ !== state.control[module] || fx !== state.fx[module]) {
				state.owner[module] = owner;
				state.control[module] = controlQ;
				state.fx[module] = fx;
				if (owner === NEUTRAL) {
					color.copy(unknown);
				} else if (owner === factions[0]?.id) {
					color.copy(colors[owner] ?? neutral).multiplyScalar(0.72 + 0.28 * ratio);
				} else {
					color.copy(colors[owner] ?? neutral).multiplyScalar(0.5 + 0.35 * ratio);
				}
				if (fx > 0) {
					// Flash de capture : éclaircit brièvement le quartier.
					color.lerp(white, 0.55 * (1 - fx / FLASH));
				}
				mesh.setColorAt(module, color);
				colorDirty = true;
			}
		}
		if (buildMatrices) {
			mesh.instanceMatrix.needsUpdate = true;
		}
		if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		// 2) Bâtiments : couleur par type, croissance du chantier, pop de livraison.
		let buildingsDirty = buildMatrices;
		for (let module = 0; module < count && !buildingsDirty; module += 1) {
			if (territory.building[module] !== state.building[module]) buildingsDirty = true;
			else if (territory.pending[module] !== state.pending[module]) buildingsDirty = true;
		}
		if (buildingsDirty) {
			const counters = BUILDING_TYPES.map(() => 0);
			for (let module = 0; module < count; module += 1) {
				const buildIndex = territory.building[module]!;
				const pendingIndex = territory.pending[module]!;
				state.building[module] = buildIndex;
				state.pending[module] = pendingIndex;
				const underConstruction = buildIndex === NO_BUILDING && pendingIndex !== NO_BUILDING;
				const effective = buildIndex !== NO_BUILDING ? buildIndex : pendingIndex;
				if (effective === NO_BUILDING) continue;
				const type = BUILDING_TYPES[effective];
				const spec = type ? BUILDINGS[type] : null;
				const buildingMesh = buildingRefs.current[effective];
				if (!type || !spec || !buildingMesh) continue;

				let height = spec.height;
				let scaleXZ = 1;
				if (underConstruction) {
					const remaining = territory.construction[module]!;
					const progress = Math.max(0.15, Math.min(1, 1 - remaining / BUILD_TICKS[type]));
					height = spec.height * progress;
				} else {
					const since = tick - territory.builtAt[module]!;
					if (since >= 0 && since < FLASH) scaleXZ = 1 + 0.3 * (1 - since / FLASH);
				}
				const index = counters[effective]!;
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.25 + height / 2, centerZ);
				dummy.scale.set(spec.width * scaleXZ, height, spec.width * scaleXZ);
				dummy.updateMatrix();
				buildingMesh.setMatrixAt(index, dummy.matrix);
				if (underConstruction) color.setRGB(0.92, 0.68, 0.3);
				else color.copy(buildingColors[type] ?? white);
				buildingMesh.setColorAt(index, color);
				counters[effective] = index + 1;
			}
			BUILDING_TYPES.forEach((_, index) => {
				const buildingMesh = buildingRefs.current[index];
				if (!buildingMesh) return;
				buildingMesh.count = counters[index]!;
				buildingMesh.instanceMatrix.needsUpdate = true;
				if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
			});
		}

		// 3) Frontières (propriétaires différents) + contours d'attaque (pulsés).
		const borderMesh = borderRef.current;
		const attacker = new Map<number, number>();
		for (const attack of attacks) attacker.set(attack.target, attack.factionId);
		const pulse = 1 + 0.1 * Math.sin(tick * 0.9);
		if (borderMesh) {
			let borderIndex = 0;
			// Grille discrète : rend la structure des quartiers lisible (façon OpenFront).
			for (let module = 0; module < count; module += 1) {
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.225, centerZ);
				dummy.rotation.set(-Math.PI / 2, 0, 0);
				dummy.scale.set(1, 1, 1);
				dummy.updateMatrix();
				borderMesh.setMatrixAt(borderIndex, dummy.matrix);
				borderMesh.setColorAt(borderIndex, color.copy(grid));
				borderIndex += 1;
			}
			for (let module = 0; module < count; module += 1) {
				const attack = attacker.get(module);
				const owner = territory.owner[module]!;
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				if (attack !== undefined) {
					dummy.position.set(centerX, 0.235, centerZ);
					dummy.rotation.set(-Math.PI / 2, 0, 0);
					dummy.scale.set(pulse, pulse, 1);
					dummy.updateMatrix();
					borderMesh.setMatrixAt(borderIndex, dummy.matrix);
					borderMesh.setColorAt(
						borderIndex,
						color.copy(colors[attack] ?? neutral).multiplyScalar(1.25),
					);
					borderIndex += 1;
				} else if (owner !== NEUTRAL) {
					const x = module % MODULES_W;
					const y = Math.floor(module / MODULES_W);
					const border =
						(x > 0 && territory.owner[module - 1] !== owner) ||
						(x < MODULES_W - 1 && territory.owner[module + 1] !== owner) ||
						(y > 0 && territory.owner[module - MODULES_W] !== owner) ||
						(y < MODULES_H - 1 && territory.owner[module + MODULES_W] !== owner);
					if (!border) continue;
					dummy.position.set(centerX, 0.23, centerZ);
					dummy.rotation.set(-Math.PI / 2, 0, 0);
					dummy.scale.set(1, 1, 1);
					dummy.updateMatrix();
					borderMesh.setMatrixAt(borderIndex, dummy.matrix);
					borderMesh.setColorAt(
						borderIndex,
						color.copy(colors[owner] ?? neutral).multiplyScalar(1.35),
					);
					borderIndex += 1;
				}
			}
			dummy.rotation.set(0, 0, 0);
			borderMesh.count = borderIndex;
			borderMesh.instanceMatrix.needsUpdate = true;
			if (borderMesh.instanceColor) borderMesh.instanceColor.needsUpdate = true;
		}
	}, [territory, colors, buildingColors, count, version, attacks, city.seed, tick]);

	const selectedCenter =
		selected !== null
			? {
					x: (selected % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
					z: Math.floor(selected / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
				}
			: null;

	return (
		<>
			<instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={5}>
				<boxGeometry args={[1, 1, 1]} />
				<meshBasicMaterial transparent opacity={0.62} depthWrite={false} />
			</instancedMesh>
			{BUILDING_TYPES.map((type, index) => (
				<instancedMesh
					key={type}
					ref={(element) => {
						buildingRefs.current[index] = element;
					}}
					args={[undefined, undefined, count]}
					frustumCulled={false}
					renderOrder={7}
				>
					<primitive object={geometries[index]} attach="geometry" />
					<meshLambertMaterial flatShading />
				</instancedMesh>
			))}
			<instancedMesh
				ref={borderRef}
				args={[undefined, undefined, count]}
				frustumCulled={false}
				renderOrder={8}
			>
				<primitive object={borderGeometry} attach="geometry" />
				<meshBasicMaterial transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
			</instancedMesh>
			{selectedCenter ? (
				<mesh
					position={[selectedCenter.x, 0.24, selectedCenter.z]}
					rotation={[-Math.PI / 2, 0, 0]}
					renderOrder={6}
				>
					<ringGeometry args={[MODULE_SIZE / 2 - 0.35, MODULE_SIZE / 2 - 0.05, 32]} />
					<meshBasicMaterial color="#FFFFFF" transparent opacity={0.9} depthWrite={false} />
				</mesh>
			) : null}
		</>
	);
}

function BUILDING_TYPES_GEOMETRIES(): THREE.BufferGeometry[] {
	return (
		["logement", "labo", "vente", "facade", "planque", "depot", "atelier", "contre"] as BuildingType[]
	).map((type) => BUILDING_SHAPE[type]());
}

function makeBorderGeometry(): THREE.BufferGeometry {
	const outer = MODULE_SIZE / 2 - 0.05;
	const inner = outer - 0.45;
	const shape = new THREE.Shape();
	shape.moveTo(-outer, -outer);
	shape.lineTo(outer, -outer);
	shape.lineTo(outer, outer);
	shape.lineTo(-outer, outer);
	shape.closePath();
	const hole = new THREE.Path();
	hole.moveTo(-inner, -inner);
	hole.lineTo(inner, -inner);
	hole.lineTo(inner, inner);
	hole.lineTo(-inner, inner);
	hole.closePath();
	shape.holes.push(hole);
	return new THREE.ShapeGeometry(shape);
}
