import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, BUILDING_TYPES, NO_BUILDING, type BuildingType } from "../sim/buildings";
import { MODULES_W, MODULE_SIZE } from "../sim/constants";
import type { Faction } from "../sim/factions";
import { NEUTRAL, type Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import type { Attack } from "../sim/world";
import { factionDisplayColor } from "./palette";

interface TerritoryOverlayProps {
	city: CityGrid;
	territory: Territory;
	factions: readonly Faction[];
	attacks: readonly Attack[];
	known: Uint8Array;
	playerId: number;
	selected: number | null;
	colorblind: boolean;
	version: number;
}

/** Géométrie d'icône par type de bâtiment (art-direction.md : icônes). */
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

/** Valeur de gris par type (lisibilité des icônes sans couleur). */
const BUILDING_SHADE = [0.95, 0.78, 0.9, 0.98, 0.62, 0.85, 0.7, 0.55];
/** Pas de quantification du Contrôle pour la couleur (évite un upload par tick). */
const CONTROL_STEP = 5;

interface OverlayState {
	seed: number;
	owner: Int16Array;
	control: Int16Array;
	building: Int16Array;
	pending: Int16Array;
	attacker: Int16Array;
	known: Int16Array;
	matricesDone: boolean;
}

/** Recouvrement de possession + icônes de bâtiments + contours d'attaque. */
export function TerritoryOverlay({
	city,
	territory,
	factions,
	attacks,
	known,
	playerId,
	selected,
	colorblind,
	version,
}: TerritoryOverlayProps) {
	const ref = useRef<THREE.InstancedMesh>(null);
	const borderRef = useRef<THREE.InstancedMesh>(null);
	const buildingRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
	const count = city.modules.length;

	const geometries = useMemo(() => BUILDING_TYPES.map((type) => BUILDING_SHAPE[type]()), []);

	const borderGeometry = useMemo(() => {
		const outer = MODULE_SIZE / 2 - 0.05;
		const inner = outer - 0.35;
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
	}, []);

	const colors = useMemo(
		() =>
			factions.map(
				(faction, index) =>
					new THREE.Color(factionDisplayColor(index, faction.color, colorblind)),
			),
		[factions, colorblind],
	);

	const stateRef = useRef<OverlayState | null>(null);
	const colorsRef = useRef<THREE.Color[] | null>(null);
	if (stateRef.current === null || stateRef.current.owner.length !== count) {
		stateRef.current = {
			seed: -1,
			owner: new Int16Array(count).fill(-2),
			control: new Int16Array(count).fill(-1),
			building: new Int16Array(count).fill(-2),
			pending: new Int16Array(count).fill(-2),
			attacker: new Int16Array(count).fill(-2),
			known: new Int16Array(count).fill(-1),
			matricesDone: false,
		};
	}

	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		const state = stateRef.current!;
		const dummy = new THREE.Object3D();
		const color = new THREE.Color();
		const neutral = new THREE.Color("#0E1013");
		const unknown = new THREE.Color("#0B0E12");

		// Nouvelle ville ou changement de palette → repartir de zéro.
		if (state.seed !== city.seed) {
			state.seed = city.seed;
			state.owner.fill(-2);
			state.control.fill(-1);
			state.building.fill(-2);
			state.pending.fill(-2);
			state.attacker.fill(-2);
			state.known.fill(-1);
			state.matricesDone = false;
		}
		if (colorsRef.current !== colors) {
			colorsRef.current = colors;
			state.owner.fill(-2);
		}

		// 1) Aplats : matrice posée une fois, couleur recalculée seulement si changée.
		const buildMatrices = !state.matricesDone;
		let colorDirty = false;
		for (let module = 0; module < count; module += 1) {
			const owner = territory.owner[module]!;
			const control = territory.control[module]!;
			const isKnown = known[module] === 1 ? 1 : 0;
			const controlQ = !isKnown || owner === NEUTRAL ? -1 : Math.round(control / CONTROL_STEP);

			if (buildMatrices) {
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.19, centerZ);
				dummy.scale.set(MODULE_SIZE - 0.15, 0.05, MODULE_SIZE - 0.15);
				dummy.updateMatrix();
				mesh.setMatrixAt(module, dummy.matrix);
			}

			if (
				owner !== state.owner[module] ||
				controlQ !== state.control[module] ||
				isKnown !== state.known[module]
			) {
				state.owner[module] = owner;
				state.control[module] = controlQ;
				state.known[module] = isKnown;
				const ratio = Math.max(0, Math.min(1, control / 100));
				if (!isKnown) {
					// Zone non renseignée : masquée (gris sombre, aucune info de faction).
					mesh.setColorAt(module, color.copy(unknown));
				} else if (owner === NEUTRAL) {
					mesh.setColorAt(module, color.copy(neutral));
				} else if (owner === playerId) {
					// Notre base : couleur pleine et lumineuse (code couleur allié).
					const shade = 0.7 + 0.3 * ratio;
					mesh.setColorAt(module, color.copy(colors[owner] ?? neutral).multiplyScalar(shade));
				} else {
					// Connu mais adverse : discret.
					const shade = 0.28 + 0.32 * ratio;
					mesh.setColorAt(module, color.copy(colors[owner] ?? neutral).multiplyScalar(shade));
				}
				colorDirty = true;
			}
		}
		if (buildMatrices) {
			mesh.instanceMatrix.needsUpdate = true;
			state.matricesDone = true;
		}
		if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		// 2) Bâtiments : reconstruits uniquement si l'un d'eux a changé.
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
				if (known[module] !== 1) continue;
				// Un chantier occupe l'emprise : bloc réduit, teinte ambre (information).
				const underConstruction = buildIndex === NO_BUILDING && pendingIndex !== NO_BUILDING;
				const effective = buildIndex !== NO_BUILDING ? buildIndex : pendingIndex;
				if (effective === NO_BUILDING) continue;
				const type = BUILDING_TYPES[effective];
				const spec = type ? BUILDINGS[type] : null;
				const buildingMesh = buildingRefs.current[effective];
				if (!type || !spec || !buildingMesh) continue;
				const height = underConstruction ? spec.height * 0.4 : spec.height;
				const index = counters[effective]!;
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.25 + height / 2, centerZ);
				dummy.scale.set(spec.width, height, spec.width);
				dummy.updateMatrix();
				buildingMesh.setMatrixAt(index, dummy.matrix);
				if (underConstruction) color.setRGB(0.88, 0.63, 0.25);
				else color.setScalar(BUILDING_SHADE[effective] ?? 0.9);
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

		// 3) Contours d'attaque : reconstruits uniquement si les attaques changent.
		const attacker = new Map<number, number>();
		const attackerTroops = new Map<number, number>();
		for (const attack of attacks) {
			const current = attackerTroops.get(attack.target) ?? -1;
			if (attack.troops > current) {
				attackerTroops.set(attack.target, attack.troops);
				attacker.set(attack.target, attack.factionId);
			}
		}
		let bordersDirty = buildMatrices;
		for (let module = 0; module < count && !bordersDirty; module += 1) {
			const value = attacker.get(module) ?? -1;
			if (value !== state.attacker[module]) bordersDirty = true;
		}
		if (bordersDirty && borderRef.current) {
			const borderMesh = borderRef.current;
			let borderIndex = 0;
			for (let module = 0; module < count; module += 1) {
				const attackerId = attacker.get(module) ?? -1;
				state.attacker[module] = attackerId;
				if (attackerId < 0 || known[module] !== 1) continue;
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.235, centerZ);
				dummy.rotation.set(-Math.PI / 2, 0, 0);
				dummy.scale.set(1, 1, 1);
				dummy.updateMatrix();
				borderMesh.setMatrixAt(borderIndex, dummy.matrix);
				borderMesh.setColorAt(
					borderIndex,
					color.copy(colors[attackerId] ?? neutral).multiplyScalar(1.15),
				);
				borderIndex += 1;
			}
			dummy.rotation.set(0, 0, 0);
			borderMesh.count = borderIndex;
			borderMesh.instanceMatrix.needsUpdate = true;
			if (borderMesh.instanceColor) borderMesh.instanceColor.needsUpdate = true;
		}
	}, [territory, colors, count, version, attacks, city.seed, known, playerId]);

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
				<meshBasicMaterial transparent opacity={0.5} depthWrite={false} />
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
				<meshBasicMaterial transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
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
