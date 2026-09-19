import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MODULES_W, MODULE_SIZE } from "../sim/constants";
import type { Faction } from "../sim/factions";
import type { Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import type { Attack } from "../sim/world";
import { MemoCityMeshes } from "./CityMeshes";
import { TerritoryOverlay } from "./TerritoryOverlay";

/** Vue aérienne : nombre de tuiles visibles (adapté à la taille de la carte). */
const spanFor = (width: number) => width * 1.15;
/** Durée d'un cycle jour/nuit (ticks) — ~15 min à 10 Hz. */
const DAY_CYCLE = 9000;

/** La ville est statique : on ne recalcule la shadow map qu'au changement de seed. */
function StaticShadows({ seed }: { seed: number }) {
	const gl = useThree((state) => state.gl);
	useLayoutEffect(() => {
		gl.shadowMap.autoUpdate = false;
		gl.shadowMap.needsUpdate = true;
		return () => {
			gl.shadowMap.autoUpdate = true;
		};
	}, [gl, seed]);
	return null;
}

interface IsoCanvasProps {
	city: CityGrid;
	territory: Territory;
	factions: readonly Faction[];
	attacks: readonly Attack[];
	tick: number;
	focus: { x: number; z: number };
	selected: number | null;
	colorblind: boolean;
	version: number;
	onModuleClick: (module: number) => void;
	onModuleHover: (module: number | null) => void;
	onProjector: (project: (module: number) => { x: number; y: number } | null) => void;
}

/** Caméra god-view libre : pan + zoom, iso fixe, sans suivi de personnage. */
function CameraRig({
	focus,
	offset,
	span,
}: {
	focus: { x: number; z: number };
	offset: [number, number, number];
	span: number;
}) {
	const camera = useThree((state) => state.camera);
	const domElement = useThree((state) => state.gl.domElement);
	const width = useThree((state) => state.size.width);
	const height = useThree((state) => state.size.height);
	const controlsRef = useRef<OrbitControls | null>(null);
	const initialized = useRef(false);

	const minSize = Math.min(width, height);
	const minZoom = minSize / (span * 1.4);
	const maxZoom = minSize / (span * 0.5);
	const defaultZoom = minSize / span;

	const initialTarget = useRef<[number, number, number]>([
		focus.x + offset[0],
		0,
		focus.z + offset[2],
	]).current;

	useLayoutEffect(() => {
		const controls = new OrbitControls(camera, domElement);
		controls.target.set(initialTarget[0], initialTarget[1], initialTarget[2]);
		controls.enableRotate = true;
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.maxPolarAngle = Math.PI / 2.6;
		controls.minPolarAngle = Math.PI / 4;
		controls.screenSpacePanning = false;
		controls.zoomSpeed = 0.9;
		controlsRef.current = controls;
		return () => {
			controls.dispose();
			controlsRef.current = null;
		};
	}, [camera, domElement, initialTarget]);

	// Damping : mise à jour par frame.
	useFrame(() => controlsRef.current?.update());

	useLayoutEffect(() => {
		const controls = controlsRef.current;
		if (controls) {
			controls.minZoom = minZoom;
			controls.maxZoom = maxZoom;
		}
		if (!(camera instanceof THREE.OrthographicCamera)) return;
		camera.zoom = initialized.current
			? Math.min(maxZoom, Math.max(minZoom, camera.zoom))
			: defaultZoom;
		camera.updateProjectionMatrix();
		initialized.current = true;
	}, [camera, minZoom, maxZoom, defaultZoom]);

	return null;
}

/** Scène iso 2.5D — vue de gestion (god view), sans personnage. */
/** Expose une projection module → écran (pour les textes flottants). */
function Projector({
	offset,
	onReady,
}: {
	offset: [number, number, number];
	onReady: (project: (module: number) => { x: number; y: number } | null) => void;
}) {
	const camera = useThree((state) => state.camera);
	const size = useThree((state) => state.size);
	useLayoutEffect(() => {
		const vector = new THREE.Vector3();
		onReady((module: number) => {
			const cx = (module % MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
			const cz = Math.floor(module / MODULES_W) * MODULE_SIZE + MODULE_SIZE / 2;
			vector.set(cx + offset[0], 2.4, cz + offset[2]).project(camera);
			if (vector.z > 1) return null;
			return {
				x: (vector.x * 0.5 + 0.5) * size.width,
				y: (-vector.y * 0.5 + 0.5) * size.height,
			};
		});
	}, [camera, size, offset, onReady]);
	return null;
}

export function IsoCanvas({
	city,
	territory,
	factions,
	attacks,
	tick,
	focus,
	selected,
	colorblind,
	version,
	onModuleClick,
	onModuleHover,
	onProjector,
}: IsoCanvasProps) {
	const offset = useMemo<[number, number, number]>(
		() => [-city.width / 2, 0, -city.height / 2],
		[city.width, city.height],
	);
	const cameraConfig = useMemo(() => {
		const distance = Math.max(city.width, city.height) * 1.5;
		return {
			position: [distance, distance * 0.95, distance] as [number, number, number],
			zoom: 20,
			near: -4000,
			far: 9000,
		};
	}, [city.width, city.height]);
	const dpr = useMemo<[number, number]>(() => [1, 1.75], []);
	const span = useMemo(() => spanFor(city.width), [city.width]);
	const shadowRadius = useMemo(() => city.width * 0.8, [city.width]);
	const lightPosition = useMemo<[number, number, number]>(
		() => [city.width * 0.4, city.width * 0.8, city.width * 0.2],
		[city.width],
	);

	// Cycle jour/nuit : 0 = plein jour, 1 = pleine nuit.
	const night = 0.5 - 0.5 * Math.cos((tick / DAY_CYCLE) * Math.PI * 2);

	return (
		<Canvas orthographic flat shadows dpr={dpr} camera={cameraConfig}>
			<color
				attach="background"
				args={[night > 0.5 ? "#090b12" : "#0e1013"]}
			/>
			<ambientLight intensity={0.45 - 0.24 * night} color={night > 0.5 ? "#8ea0c4" : "#ffffff"} />
			<directionalLight
				position={lightPosition}
				color={night > 0.5 ? "#9fb4d8" : "#fff4e0"}
				intensity={1.5 - 0.85 * night}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-left={-shadowRadius}
				shadow-camera-right={shadowRadius}
				shadow-camera-top={shadowRadius}
				shadow-camera-bottom={-shadowRadius}
				shadow-camera-near={1}
				shadow-camera-far={400}
			/>
			<group position={offset}>
				<MemoCityMeshes city={city} onModuleClick={onModuleClick} onModuleHover={onModuleHover} />
				<TerritoryOverlay
					city={city}
					territory={territory}
					factions={factions}
					attacks={attacks}
					tick={tick}
					selected={selected}
					colorblind={colorblind}
					version={version}
				/>
			</group>
			<CameraRig focus={focus} offset={offset} span={span} />
			<Projector offset={offset} onReady={onProjector} />
			<StaticShadows seed={city.seed} />
		</Canvas>
	);
}
