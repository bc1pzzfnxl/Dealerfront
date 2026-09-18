import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MODULES_W, MODULE_SIZE } from "../sim/constants";
import { moduleAtTile } from "../sim/territory";
import type { CityGrid, ZoneType } from "../sim/types";
import { ZONE_STYLE } from "./palette";

const GROUND_THICKNESS = 0.1;
const LOT_TOP = 0.1;
const GROUND_ROAD = 0.14;
const GROUND_LOT = 0.28;
const GROUND_PARK = 0.36;
const GROUND_PLAZA = 0.44;

function hasBuilding(zone: ZoneType): boolean {
	return zone !== "park" && zone !== "vacant";
}

function hash2(x: number, y: number, seed: number): number {
	let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function moduleIndexAt(x: number, y: number): number {
	return Math.floor(x / MODULE_SIZE) + Math.floor(y / MODULE_SIZE) * MODULES_W;
}

function isStreetTile(x: number, y: number): boolean {
	const localX = x % MODULE_SIZE;
	const localY = y % MODULE_SIZE;
	return (
		localX === 0 ||
		localX === MODULE_SIZE - 1 ||
		localY === 0 ||
		localY === MODULE_SIZE - 1
	);
}

function buildingHeight(city: CityGrid, module: number): number {
	const moduleX = module % MODULES_W;
	const moduleY = Math.floor(module / MODULES_W);
	return (
		ZONE_STYLE[city.modules[module]!].height *
		(0.85 + hash2(moduleX, moduleY, city.seed + 7) * 0.5)
	);
}

function buildingFootprint(city: CityGrid, module: number): number {
	const moduleX = module % MODULES_W;
	const moduleY = Math.floor(module / MODULES_W);
	return Math.min(
		4.6,
		ZONE_STYLE[city.modules[module]!].footprint *
			(0.85 + hash2(moduleX, moduleY, city.seed) * 0.3),
	);
}

function buildingCenter(city: CityGrid, module: number): { x: number; z: number } {
	const moduleX = module % MODULES_W;
	const moduleY = Math.floor(module / MODULES_W);
	return {
		x: moduleX * MODULE_SIZE + MODULE_SIZE / 2 + (hash2(moduleX, moduleY, city.seed + 13) - 0.5) * 1.2,
		z: moduleY * MODULE_SIZE + MODULE_SIZE / 2 + (hash2(moduleX, moduleY, city.seed + 17) - 0.5) * 1.2,
	};
}

/** Ville N&B statique (god view) : sols, bâtiments chanfreinés, props. */
export function CityMeshes({
	city,
	onModuleClick,
}: {
	city: CityGrid;
	onModuleClick: (module: number) => void;
}) {
	const handleClick = (event: ThreeEvent<MouseEvent>) => {
		event.stopPropagation();
		if (event.delta > 6) return;
		const tileX = event.point.x + city.width / 2;
		const tileY = event.point.z + city.height / 2;
		onModuleClick(moduleAtTile(tileX, tileY, MODULE_SIZE));
	};

	const width = city.width;
	const height = city.height;
	return (
		<>
			{/* Plan de sol invisible : capte les clics (sélection de quartier). */}
			<mesh
				rotation={[-Math.PI / 2, 0, 0]}
				position={[width / 2, 0.02, height / 2]}
				onClick={handleClick}
			>
				<planeGeometry args={[width, height]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
			</mesh>
			<GroundTiles city={city} />
			<Buildings city={city} />
			<Landmarks city={city} />
			<Lampposts city={city} />
			<Cars city={city} />
			<Trees city={city} />
		</>
	);
}

function GroundTiles({ city }: { city: CityGrid }) {
	const ref = useRef<THREE.InstancedMesh>(null);
	const count = city.width * city.height;

	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		const dummy = new THREE.Object3D();
		const color = new THREE.Color();
		for (let y = 0; y < city.height; y += 1) {
			for (let x = 0; x < city.width; x += 1) {
				const index = y * city.width + x;
				dummy.position.set(x + 0.5, GROUND_THICKNESS / 2, y + 0.5);
				dummy.scale.set(1, GROUND_THICKNESS, 1);
				dummy.updateMatrix();
				mesh.setMatrixAt(index, dummy.matrix);

				const moduleIndex = moduleIndexAt(x, y);
				const zone = city.modules[moduleIndex]!;
				let base: number;
				if (zone === "vacant") base = GROUND_PLAZA;
				else if (zone === "park") base = GROUND_PARK;
				else if (isStreetTile(x, y)) base = GROUND_ROAD;
				else base = GROUND_LOT;
				const noise = (hash2(x, y, city.seed) - 0.5) * 0.02;
				mesh.setColorAt(index, color.setScalar(Math.min(1, Math.max(0, base + noise))));
			}
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	}, [city, count]);

	return (
		<instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow frustumCulled={false}>
			<boxGeometry args={[1, 1, 1]} />
			<meshLambertMaterial />
		</instancedMesh>
	);
}

function Buildings({ city }: { city: CityGrid }) {
	const mainRef = useRef<THREE.InstancedMesh>(null);
	const annexRef = useRef<THREE.InstancedMesh>(null);
	const corniceRef = useRef<THREE.InstancedMesh>(null);
	const mainGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.09), []);
	const annexGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.09), []);
	const corniceGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.05), []);

	useEffect(
		() => () => {
			mainGeometry.dispose();
			annexGeometry.dispose();
			corniceGeometry.dispose();
		},
		[mainGeometry, annexGeometry, corniceGeometry],
	);

	const mainModules = useMemo(() => {
		const list: number[] = [];
		for (let i = 0; i < city.modules.length; i += 1) {
			if (hasBuilding(city.modules[i]!)) list.push(i);
		}
		return list;
	}, [city]);

	const annexModules = useMemo(
		() => mainModules.filter((module, index) => hash2(module, index, city.seed + 99) > 0.62),
		[mainModules, city.seed],
	);

	useLayoutEffect(() => {
		const dummy = new THREE.Object3D();
		const color = new THREE.Color();
		const main = mainRef.current;
		const annex = annexRef.current;
		const cornice = corniceRef.current;
		if (!main || !annex || !cornice) return;

		mainModules.forEach((module, index) => {
			const style = ZONE_STYLE[city.modules[module]!];
			const h = buildingHeight(city, module);
			const f = buildingFootprint(city, module);
			const center = buildingCenter(city, module);
			dummy.position.set(center.x, LOT_TOP + h / 2, center.z);
			dummy.scale.set(f, h, f);
			dummy.updateMatrix();
			main.setMatrixAt(index, dummy.matrix);
			main.setColorAt(index, color.setScalar(style.shade));

			dummy.position.set(center.x, LOT_TOP + h - 0.06, center.z);
			dummy.scale.set(f + 0.34, 0.16, f + 0.34);
			dummy.updateMatrix();
			cornice.setMatrixAt(index, dummy.matrix);
			cornice.setColorAt(index, color.setScalar(style.shade * 0.78));
		});

		annexModules.forEach((module, index) => {
			const moduleX = module % MODULES_W;
			const moduleY = Math.floor(module / MODULES_W);
			const style = ZONE_STYLE[city.modules[module]!];
			const center = buildingCenter(city, module);
			const mainFootprint = buildingFootprint(city, module);
			const alongX = hash2(moduleX, moduleY, city.seed + 23) > 0.5;
			const h = style.height * 0.5;
			const f = Math.min(3.0, mainFootprint * 0.55);
			const shift = mainFootprint * 0.5 + f * 0.45;
			dummy.position.set(center.x + (alongX ? shift : 0), LOT_TOP + h / 2, center.z + (alongX ? 0 : shift));
			dummy.scale.set(f, h, f);
			dummy.updateMatrix();
			annex.setMatrixAt(index, dummy.matrix);
			annex.setColorAt(index, color.setScalar(style.shade * 0.92));
		});

		main.instanceMatrix.needsUpdate = true;
		annex.instanceMatrix.needsUpdate = true;
		cornice.instanceMatrix.needsUpdate = true;
		if (main.instanceColor) main.instanceColor.needsUpdate = true;
		if (annex.instanceColor) annex.instanceColor.needsUpdate = true;
		if (cornice.instanceColor) cornice.instanceColor.needsUpdate = true;
	}, [city, mainModules, annexModules]);

	return (
		<>
			<instancedMesh ref={mainRef} args={[mainGeometry, undefined, mainModules.length]} castShadow receiveShadow frustumCulled={false}>
				<meshLambertMaterial flatShading />
			</instancedMesh>
			<instancedMesh ref={annexRef} args={[annexGeometry, undefined, annexModules.length]} castShadow receiveShadow frustumCulled={false}>
				<meshLambertMaterial flatShading />
			</instancedMesh>
			<instancedMesh ref={corniceRef} args={[corniceGeometry, undefined, mainModules.length]} castShadow receiveShadow frustumCulled={false}>
				<meshLambertMaterial flatShading />
			</instancedMesh>
		</>
	);
}

function Landmarks({ city }: { city: CityGrid }) {
	const policeRef = useRef<THREE.InstancedMesh>(null);
	const laundryRef = useRef<THREE.InstancedMesh>(null);
	const policeModules = useMemo(
		() => city.modules.map((zone, index) => (zone === "police" ? index : -1)).filter((i) => i >= 0),
		[city],
	);
	const laundryModules = useMemo(
		() => city.modules.map((zone, index) => (zone === "laundry" ? index : -1)).filter((i) => i >= 0),
		[city],
	);

	useLayoutEffect(() => {
		const dummy = new THREE.Object3D();
		const police = policeRef.current;
		if (police) {
			policeModules.forEach((module, index) => {
				const center = buildingCenter(city, module);
				dummy.position.set(center.x, LOT_TOP + buildingHeight(city, module) + 1.0, center.z);
				dummy.scale.set(1, 1, 1);
				dummy.updateMatrix();
				police.setMatrixAt(index, dummy.matrix);
			});
			police.instanceMatrix.needsUpdate = true;
		}
		const laundry = laundryRef.current;
		if (laundry) {
			laundryModules.forEach((module, index) => {
				const center = buildingCenter(city, module);
				const chimney = buildingHeight(city, module) + 1.6;
				dummy.position.set(center.x + 1, LOT_TOP + chimney / 2, center.z - 1);
				dummy.scale.set(1, chimney, 1);
				dummy.updateMatrix();
				laundry.setMatrixAt(index, dummy.matrix);
			});
			laundry.instanceMatrix.needsUpdate = true;
		}
	}, [city, policeModules, laundryModules]);

	return (
		<>
			{policeModules.length > 0 ? (
				<instancedMesh ref={policeRef} args={[undefined, undefined, policeModules.length]} castShadow frustumCulled={false}>
					<cylinderGeometry args={[0.9, 1.0, 2.0, 10]} />
					<meshLambertMaterial color="#A7ADB6" flatShading />
				</instancedMesh>
			) : null}
			{laundryModules.length > 0 ? (
				<instancedMesh ref={laundryRef} args={[undefined, undefined, laundryModules.length]} castShadow frustumCulled={false}>
					<cylinderGeometry args={[0.22, 0.26, 1, 8]} />
					<meshLambertMaterial color="#565D67" flatShading />
				</instancedMesh>
			) : null}
		</>
	);
}

function Lampposts({ city }: { city: CityGrid }) {
	const poleRef = useRef<THREE.InstancedMesh>(null);
	const headRef = useRef<THREE.InstancedMesh>(null);
	const slots = useMemo(() => {
		const list: { x: number; z: number }[] = [];
		for (let i = 0; i < city.modules.length; i += 1) {
			const moduleX = i % MODULES_W;
			const moduleY = Math.floor(i / MODULES_W);
			if (hash2(moduleX, moduleY, city.seed + 31) < 0.88) continue;
			list.push({ x: moduleX * MODULE_SIZE, z: moduleY * MODULE_SIZE });
		}
		return list;
	}, [city]);

	useLayoutEffect(() => {
		const pole = poleRef.current;
		const head = headRef.current;
		if (!pole || !head) return;
		const dummy = new THREE.Object3D();
		slots.forEach((slot, index) => {
			dummy.position.set(slot.x, 1.2, slot.z);
			dummy.updateMatrix();
			pole.setMatrixAt(index, dummy.matrix);
			dummy.position.set(slot.x, 2.45, slot.z);
			dummy.updateMatrix();
			head.setMatrixAt(index, dummy.matrix);
		});
		pole.instanceMatrix.needsUpdate = true;
		head.instanceMatrix.needsUpdate = true;
	}, [slots]);

	if (slots.length === 0) return null;
	return (
		<>
			<instancedMesh ref={poleRef} args={[undefined, undefined, slots.length]} castShadow frustumCulled={false}>
				<cylinderGeometry args={[0.06, 0.08, 2.4, 6]} />
				<meshLambertMaterial color="#3A4048" />
			</instancedMesh>
			<instancedMesh ref={headRef} args={[undefined, undefined, slots.length]} frustumCulled={false}>
				<boxGeometry args={[0.28, 0.15, 0.28]} />
				<meshBasicMaterial color="#D3D7DD" />
			</instancedMesh>
		</>
	);
}

function Cars({ city }: { city: CityGrid }) {
	const bodyRef = useRef<THREE.InstancedMesh>(null);
	const cabinRef = useRef<THREE.InstancedMesh>(null);
	const slots = useMemo(() => {
		const list: { x: number; z: number; along: boolean }[] = [];
		for (let i = 0; i < city.modules.length; i += 1) {
			if (!hasBuilding(city.modules[i]!)) continue;
			const moduleX = i % MODULES_W;
			const moduleY = Math.floor(i / MODULES_W);
			if (hash2(moduleX, moduleY, city.seed + 41) > 0.15) continue;
			list.push({
				x: moduleX * MODULE_SIZE + MODULE_SIZE / 2,
				z: moduleY * MODULE_SIZE,
				along: hash2(moduleX, moduleY, city.seed + 43) > 0.5,
			});
		}
		return list;
	}, [city]);

	useLayoutEffect(() => {
		const body = bodyRef.current;
		const cabin = cabinRef.current;
		if (!body || !cabin) return;
		const dummy = new THREE.Object3D();
		slots.forEach((slot, index) => {
			dummy.position.set(slot.x, 0.35, slot.z);
			dummy.rotation.set(0, slot.along ? 0 : Math.PI / 2, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			body.setMatrixAt(index, dummy.matrix);
			dummy.position.set(slot.x, 0.82, slot.z);
			dummy.updateMatrix();
			cabin.setMatrixAt(index, dummy.matrix);
		});
		body.instanceMatrix.needsUpdate = true;
		cabin.instanceMatrix.needsUpdate = true;
	}, [slots]);

	if (slots.length === 0) return null;
	return (
		<>
			<instancedMesh ref={bodyRef} args={[undefined, undefined, slots.length]} castShadow frustumCulled={false}>
				<boxGeometry args={[2.2, 0.5, 1.0]} />
				<meshLambertMaterial color="#7C838D" />
			</instancedMesh>
			<instancedMesh ref={cabinRef} args={[undefined, undefined, slots.length]} castShadow frustumCulled={false}>
				<boxGeometry args={[1.0, 0.45, 0.9]} />
				<meshLambertMaterial color="#A7ADB6" />
			</instancedMesh>
		</>
	);
}

function Trees({ city }: { city: CityGrid }) {
	const trunkRef = useRef<THREE.InstancedMesh>(null);
	const canopyRef = useRef<THREE.InstancedMesh>(null);
	const slots = useMemo(() => {
		const list: { x: number; z: number; scale: number }[] = [];
		for (let i = 0; i < city.modules.length; i += 1) {
			const zone = city.modules[i]!;
			if (zone !== "park" && zone !== "vacant") continue;
			const moduleX = i % MODULES_W;
			const moduleY = Math.floor(i / MODULES_W);
			const treeCount = zone === "park" ? 2 : 1;
			for (let k = 0; k < treeCount; k += 1) {
				const hx = hash2(moduleX * 7 + k, moduleY * 13 + k, city.seed);
				const hz = hash2(moduleX * 11 + k, moduleY * 17 + k, city.seed + 1);
				list.push({
					x: moduleX * MODULE_SIZE + 0.9 + hx * (MODULE_SIZE - 1.8),
					z: moduleY * MODULE_SIZE + 0.9 + hz * (MODULE_SIZE - 1.8),
					scale: 0.7 + hash2(moduleX + k, moduleY + k, city.seed + 2) * 0.4,
				});
			}
		}
		return list;
	}, [city]);

	useLayoutEffect(() => {
		const trunk = trunkRef.current;
		const canopy = canopyRef.current;
		if (!trunk || !canopy) return;
		const dummy = new THREE.Object3D();
		slots.forEach((slot, index) => {
			dummy.position.set(slot.x, 0.5 * slot.scale, slot.z);
			dummy.scale.set(slot.scale, slot.scale, slot.scale);
			dummy.updateMatrix();
			trunk.setMatrixAt(index, dummy.matrix);
			dummy.position.set(slot.x, 1.85 * slot.scale, slot.z);
			dummy.updateMatrix();
			canopy.setMatrixAt(index, dummy.matrix);
		});
		trunk.instanceMatrix.needsUpdate = true;
		canopy.instanceMatrix.needsUpdate = true;
	}, [slots]);

	if (slots.length === 0) return null;
	return (
		<>
			<instancedMesh ref={trunkRef} args={[undefined, undefined, slots.length]} castShadow frustumCulled={false}>
				<cylinderGeometry args={[0.09, 0.11, 1.0, 6]} />
				<meshLambertMaterial color="#6A7078" />
			</instancedMesh>
			<instancedMesh ref={canopyRef} args={[undefined, undefined, slots.length]} castShadow frustumCulled={false}>
				<coneGeometry args={[0.75, 1.7, 8]} />
				<meshLambertMaterial color="#8A9098" />
			</instancedMesh>
		</>
	);
}

export const MemoCityMeshes = memo(CityMeshes);
