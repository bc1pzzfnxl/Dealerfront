import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDING_TYPES, BUILD_TICKS, type BuildingType, NO_BUILDING } from "../sim/buildings";
import { MODULES_H, MODULES_W, MODULE_SIZE } from "../sim/constants";
import type { Faction } from "../sim/factions";
import { NEUTRAL, type Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import { TRAVEL_TICKS, type Attack } from "../sim/world";
import { CARTEL_MODELS, type CartelPart } from "./models";
import { factionDisplayColor } from "./palette";

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

const CONTROL_STEP = 5;

function hash2(x: number, y: number, seed: number): number {
	let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const FLASH = 8;
const CONSTRUCTION_COLOR = new THREE.Color("#EBAD4C");

function makePartGeometry(shape: CartelPart["shape"]): THREE.BufferGeometry {
	if (shape === "cylinder") return new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
	if (shape === "cone") return new THREE.ConeGeometry(0.5, 1, 10);
	if (shape === "sphere") return new THREE.SphereGeometry(0.5, 12, 10);
	return new THREE.BoxGeometry(1, 1, 1);
}

/** Possession, frontières, bâtiments composés (style RTS) et animations. */
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
	const fillRef = useRef<THREE.InstancedMesh>(null);
	const shockRef = useRef<THREE.InstancedMesh>(null);
	const unitRef = useRef<THREE.InstancedMesh>(null);
	const borderRef = useRef<THREE.InstancedMesh>(null);
	const partRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
	const count = city.modules.length;

	// Liste aplatie (type × partie) → un mesh instancié par partie.
	const parts = useMemo(() => {
		const flat: { type: BuildingType; part: CartelPart }[] = [];
		for (const type of BUILDING_TYPES) {
			for (const part of CARTEL_MODELS[type]) flat.push({ type, part });
		}
		return flat;
	}, []);
	const partGeometries = useMemo(
		() => parts.map(({ part }) => makePartGeometry(part.shape)),
		[parts],
	);
	const borderGeometry = useMemo(() => makeBorderGeometry(), []);
	const fieldRef = useRef<THREE.Mesh>(null);
	const outlineRef = useRef<THREE.LineSegments>(null);

	// Tuilage irrégulier : on décale les sommets de la grille (déterministe).
	const jitter = useMemo(() => {
		const n = MODULES_W + 1;
		const arr = new Float32Array(n * (MODULES_H + 1) * 2);
		for (let y = 0; y <= MODULES_H; y += 1) {
			for (let x = 0; x <= MODULES_W; x += 1) {
				const i = (y * n + x) * 2;
				const border = x === 0 || y === 0 || x === MODULES_W || y === MODULES_H;
				arr[i] = x * MODULE_SIZE + (border ? 0 : (hash2(x, y, city.seed + 101) - 0.5) * 0.8);
				arr[i + 1] = y * MODULE_SIZE + (border ? 0 : (hash2(x, y, city.seed + 202) - 0.5) * 0.8);
			}
		}
		return arr;
	}, [city.seed]);

	const fieldGeometry = useMemo(() => {
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 6 * 3);
		const colors = new Float32Array(count * 6 * 3);
		const n = MODULES_W + 1;
		const corner = (x: number, y: number, target: Float32Array, offset: number) => {
			const i = (y * n + x) * 2;
			target[offset] = jitter[i]!;
			target[offset + 1] = 0.19;
			target[offset + 2] = jitter[i + 1]!;
		};
		for (let module = 0; module < count; module += 1) {
			const mx = module % MODULES_W;
			const my = Math.floor(module / MODULES_W);
			const base = module * 6 * 3;
			const tri = [
				[mx, my],
				[mx + 1, my],
				[mx + 1, my + 1],
				[mx, my],
				[mx + 1, my + 1],
				[mx, my + 1],
			] as const;
			tri.forEach(([x, y], k) => corner(x!, y!, positions, base + k * 3));
		}
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		return geometry;
	}, [count, jitter]);

	const colors = useMemo(
		() =>
			factions.map(
				(faction, index) =>
					new THREE.Color(factionDisplayColor(index, faction.color, colorblind)),
			),
		[factions, colorblind],
	);
	const partColors = useMemo(() => parts.map(({ part }) => new THREE.Color(part.color)), [parts]);

	// Index de départ des parties par type (pour retrouver le mesh d'une partie).
	const partOffset = useMemo(() => {
		const offset: Record<string, number> = {};
		let index = 0;
		for (const type of BUILDING_TYPES) {
			offset[type] = index;
			index += CARTEL_MODELS[type].length;
		}
		return offset;
	}, []);

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
		if (!fieldRef.current) return;
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

		// 1) Aplats + flash de capture.
		let colorDirty = false;
		for (let module = 0; module < count; module += 1) {
			const owner = territory.owner[module]!;
			const control = territory.control[module]!;
			const ratio = Math.max(0, Math.min(1, control / 100));
			const controlQ = owner === NEUTRAL ? -1 : Math.round(control / CONTROL_STEP);
			const captureAge = tick - territory.capturedAt[module]!;
			const fx = captureAge >= 0 && captureAge < FLASH ? captureAge : 0;

			void buildMatrices;

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
				if (fx > 0) color.lerp(white, 0.55 * (1 - fx / FLASH));
				const attr = fieldGeometry.getAttribute("color") as THREE.BufferAttribute;
				for (let k = 0; k < 6; k += 1) attr.setXYZ(module * 6 + k, color.r, color.g, color.b);
				colorDirty = true;
			}
		}
		if (colorDirty) {
			(fieldGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
		}

		// 2) Bâtiments composés (recettes de volumes) + chantier + pop de livraison.
		let buildingsDirty = buildMatrices;
		for (let module = 0; module < count && !buildingsDirty; module += 1) {
			if (territory.building[module] !== state.building[module]) buildingsDirty = true;
			else if (territory.pending[module] !== state.pending[module]) buildingsDirty = true;
		}
		if (buildingsDirty) {
			const counters = parts.map(() => 0);
			for (let module = 0; module < count; module += 1) {
				const buildIndex = territory.building[module]!;
				const pendingIndex = territory.pending[module]!;
				state.building[module] = buildIndex;
				state.pending[module] = pendingIndex;
				const underConstruction = buildIndex === NO_BUILDING && pendingIndex !== NO_BUILDING;
				const type = BUILDING_TYPES[buildIndex !== NO_BUILDING ? buildIndex : pendingIndex];
				if (!type) continue;

				const remaining = territory.construction[module]!;
				const total = BUILD_TICKS[type] ?? 60;
				const progress = underConstruction
					? Math.max(0.15, Math.min(1, 1 - remaining / total))
					: 1;
				const buildAge = tick - territory.builtAt[module]!;
				const pop = !underConstruction && buildAge >= 0 && buildAge < FLASH ? 1 + 0.3 * (1 - buildAge / FLASH) : 1;

				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const offset = partOffset[type]!;
				CARTEL_MODELS[type].forEach((part, partIndex) => {
					const partMesh = partRefs.current[offset + partIndex];
					if (!partMesh) return;
					const index = counters[offset + partIndex]!;
					dummy.position.set(
						centerX + part.x * pop,
						0.25 + part.y * progress,
						centerZ + part.z * pop,
					);
					if (part.rot) dummy.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
					else dummy.rotation.set(0, 0, 0);
					dummy.scale.set(part.sx * pop, part.sy * progress, part.sz * pop);
					dummy.updateMatrix();
					partMesh.setMatrixAt(index, dummy.matrix);
					partMesh.setColorAt(
						index,
						underConstruction ? color.copy(CONSTRUCTION_COLOR) : color.copy(partColors[offset + partIndex]!),
					);
					counters[offset + partIndex] = index + 1;
				});
			}
			dummy.rotation.set(0, 0, 0);
			parts.forEach((_, index) => {
				const partMesh = partRefs.current[index];
				if (!partMesh) return;
				partMesh.count = counters[index]!;
				partMesh.instanceMatrix.needsUpdate = true;
				if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
			});
		}

		// 3) Colonnes en mouvement (troupes en route vers la cible).
		const unitMesh = unitRef.current;
		if (unitMesh) {
			let unitIndex = 0;
			for (const attack of attacks) {
				if (attack.arrivesAt <= tick || attack.source < 0) continue;
				const fromX = (attack.source % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const fromZ = Math.floor(attack.source / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const toX = (attack.target % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const toZ = Math.floor(attack.target / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const t = Math.max(0, Math.min(1, 1 - (attack.arrivesAt - tick) / TRAVEL_TICKS));
				for (let k = -1; k <= 1; k += 1) {
					const tk = Math.max(0, Math.min(1, t - k * 0.08));
					dummy.position.set(
						fromX + (toX - fromX) * tk,
						0.55,
						fromZ + (toZ - fromZ) * tk,
					);
					dummy.rotation.set(0, 0, 0);
					dummy.scale.set(0.5, 0.5, 0.5);
					dummy.updateMatrix();
					unitMesh.setMatrixAt(unitIndex, dummy.matrix);
					unitMesh.setColorAt(
						unitIndex,
						color.copy(colors[attack.factionId] ?? neutral).multiplyScalar(1.2),
					);
					unitIndex += 1;
				}
			}
			unitMesh.count = unitIndex;
			unitMesh.instanceMatrix.needsUpdate = true;
			if (unitMesh.instanceColor) unitMesh.instanceColor.needsUpdate = true;
		}

		// 4) Onde de choc (anneau à la capture).
		const shockMesh = shockRef.current;
		if (shockMesh) {
			let shockIndex = 0;
			const bg = new THREE.Color("#0B0E12");
			for (let module = 0; module < count; module += 1) {
				const age = tick - territory.capturedAt[module]!;
				if (age < 0 || age >= 14) continue;
				const t = age / 14;
				const owner = territory.owner[module]!;
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.245, centerZ);
				dummy.rotation.set(-Math.PI / 2, 0, 0);
				const grow = 1 + 2.6 * t;
				dummy.scale.set(grow, grow, 1);
				dummy.updateMatrix();
				shockMesh.setMatrixAt(shockIndex, dummy.matrix);
				color.copy(owner === NEUTRAL ? neutral : (colors[owner] ?? neutral)).lerp(bg, t);
				shockMesh.setColorAt(shockIndex, color);
				shockIndex += 1;
			}
			dummy.rotation.set(0, 0, 0);
			shockMesh.count = shockIndex;
			shockMesh.instanceMatrix.needsUpdate = true;
			if (shockMesh.instanceColor) shockMesh.instanceColor.needsUpdate = true;
		}

		// 5) Remplissage d'assaut : la case se colore ∝ à la perte de contrôle.
		const fillMesh = fillRef.current;
		const attacker = new Map<number, number>();
		for (const attack of attacks) attacker.set(attack.target, attack.factionId);
		if (fillMesh) {
			let fillIndex = 0;
			for (const [module, factionId] of attacker) {
				const owner = territory.owner[module]!;
				if (owner === factionId) continue;
				const control = Math.max(0, Math.min(100, territory.control[module]!));
				const progress = owner === NEUTRAL ? 1 - control / 60 : 1 - control / 100;
				const scale = (MODULE_SIZE - 0.2) * Math.max(0.08, Math.min(1, progress));
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				dummy.position.set(centerX, 0.205, centerZ);
				dummy.rotation.set(0, 0, 0);
				dummy.scale.set(scale, 0.06, scale);
				dummy.updateMatrix();
				fillMesh.setMatrixAt(fillIndex, dummy.matrix);
				fillMesh.setColorAt(fillIndex, color.copy(colors[factionId] ?? neutral).multiplyScalar(1.15));
				fillIndex += 1;
			}
			fillMesh.count = fillIndex;
			fillMesh.instanceMatrix.needsUpdate = true;
			if (fillMesh.instanceColor) fillMesh.instanceColor.needsUpdate = true;
		}

		// 6) Grille sur le neutre + frontières + contours d'attaque (pulsés).
		const borderMesh = borderRef.current;
		const pulse = 1 + 0.1 * Math.sin(tick * 0.9);
		if (borderMesh) {
			let borderIndex = 0;
			for (let module = 0; module < count; module += 1) {
				if (territory.owner[module] !== NEUTRAL) continue;
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
				const centerX = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				const centerZ = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
				if (attack !== undefined) {
					dummy.position.set(centerX, 0.235, centerZ);
					dummy.rotation.set(-Math.PI / 2, 0, 0);
					dummy.scale.set(pulse, pulse, 1);
					dummy.updateMatrix();
					borderMesh.setMatrixAt(borderIndex, dummy.matrix);
					borderMesh.setColorAt(borderIndex, color.copy(colors[attack] ?? neutral).multiplyScalar(1.25));
					borderIndex += 1;
				}
			}
			dummy.rotation.set(0, 0, 0);
			borderMesh.count = borderIndex;
			borderMesh.instanceMatrix.needsUpdate = true;
			if (borderMesh.instanceColor) borderMesh.instanceColor.needsUpdate = true;
		}

		// 5b) Contours de territoire : segments sur les arêtes où deux propriétaires diffèrent.
		const outline = outlineRef.current;
		if (outline) {
			const n = MODULES_W + 1;
			const px = (x: number, y: number) => jitter[(y * n + x) * 2]!;
			const pz = (x: number, y: number) => jitter[(y * n + x) * 2 + 1]!;
			const positions: number[] = [];
			const cols: number[] = [];
			const push = (ax: number, ay: number, bx: number, by: number, c: THREE.Color) => {
				positions.push(px(ax, ay), 0.24, pz(ax, ay), px(bx, by), 0.24, pz(bx, by));
				cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
			};
			for (let module = 0; module < count; module += 1) {
				const owner = territory.owner[module]!;
				if (owner === NEUTRAL) continue;
				const x = module % MODULES_W;
				const y = Math.floor(module / MODULES_W);
				const c = colors[owner] ?? neutral;
				if (y === 0 || territory.owner[module - MODULES_W] !== owner) push(x, y, x + 1, y, c);
				if (y === MODULES_H - 1 || territory.owner[module + MODULES_W] !== owner) {
					push(x, y + 1, x + 1, y + 1, c);
				}
				if (x === 0 || territory.owner[module - 1] !== owner) push(x, y, x, y + 1, c);
				if (x === MODULES_W - 1 || territory.owner[module + 1] !== owner) {
					push(x + 1, y, x + 1, y + 1, c);
				}
			}
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
			outline.geometry.dispose();
			outline.geometry = geometry;
		}

	}, [territory, colors, partColors, partOffset, parts, count, version, attacks, city.seed, tick]);

	const selectedCenter =
		selected !== null
			? {
					x: (selected % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
					z: Math.floor(selected / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2,
				}
			: null;

	return (
		<>
			<mesh ref={fieldRef} geometry={fieldGeometry} renderOrder={5}>
				<meshBasicMaterial vertexColors transparent opacity={0.66} depthWrite={false} />
			</mesh>
			<lineSegments ref={outlineRef} renderOrder={8}>
				<bufferGeometry />
				<lineBasicMaterial vertexColors transparent opacity={0.95} />
			</lineSegments>
			{parts.map(({ type }, index) => (
				<instancedMesh
					key={`${type}-${index}`}
					ref={(element) => {
						partRefs.current[index] = element;
					}}
					args={[undefined, undefined, count]}
					castShadow
					receiveShadow
					frustumCulled={false}
					renderOrder={7}
				>
					<primitive object={partGeometries[index]} attach="geometry" />
					<meshLambertMaterial flatShading />
				</instancedMesh>
			))}
			<instancedMesh ref={unitRef} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={10}>
				<boxGeometry args={[1, 1, 1]} />
				<meshLambertMaterial flatShading />
			</instancedMesh>
			<instancedMesh
				ref={shockRef}
				args={[undefined, undefined, count]}
				frustumCulled={false}
				renderOrder={9}
			>
				<ringGeometry args={[MODULE_SIZE / 2 - 0.5, MODULE_SIZE / 2 - 0.2, 24]} />
				<meshBasicMaterial transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
			</instancedMesh>
			<instancedMesh
				ref={fillRef}
				args={[undefined, undefined, count]}
				frustumCulled={false}
				renderOrder={6}
			>
				<boxGeometry args={[1, 1, 1]} />
				<meshBasicMaterial transparent opacity={0.75} depthWrite={false} />
			</instancedMesh>
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
