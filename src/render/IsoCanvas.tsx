import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Faction } from "../sim/factions";
import type { Territory } from "../sim/territory";
import type { CityGrid } from "../sim/types";
import type { Attack } from "../sim/world";
import { MemoCityMeshes } from "./CityMeshes";
import { TerritoryOverlay } from "./TerritoryOverlay";

/** Vue aérienne : nombre de tuiles visibles. */
const DEFAULT_SPAN = 120;
const MIN_SPAN = 55;
const MAX_SPAN = 260;
const SHADOW_RADIUS = 60;

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
	focus: { x: number; z: number };
	selected: number | null;
	colorblind: boolean;
	version: number;
	onModuleClick: (module: number) => void;
}

/** Caméra god-view libre : pan + zoom, iso fixe, sans suivi de personnage. */
function CameraRig({
	focus,
	offset,
}: {
	focus: { x: number; z: number };
	offset: [number, number, number];
}) {
	const camera = useThree((state) => state.camera);
	const domElement = useThree((state) => state.gl.domElement);
	const width = useThree((state) => state.size.width);
	const height = useThree((state) => state.size.height);
	const controlsRef = useRef<OrbitControls | null>(null);
	const initialized = useRef(false);

	const minSize = Math.min(width, height);
	const minZoom = minSize / MAX_SPAN;
	const maxZoom = minSize / MIN_SPAN;
	const defaultZoom = minSize / DEFAULT_SPAN;

	const initialTarget = useRef<[number, number, number]>([
		focus.x + offset[0],
		0,
		focus.z + offset[2],
	]).current;

	useLayoutEffect(() => {
		const controls = new OrbitControls(camera, domElement);
		controls.target.set(initialTarget[0], initialTarget[1], initialTarget[2]);
		controls.enableRotate = false;
		controls.screenSpacePanning = false;
		controls.zoomSpeed = 0.9;
		controlsRef.current = controls;
		return () => {
			controls.dispose();
			controlsRef.current = null;
		};
	}, [camera, domElement, initialTarget]);

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
export function IsoCanvas({
	city,
	territory,
	factions,
	attacks,
	focus,
	selected,
	colorblind,
	version,
	onModuleClick,
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
	const dpr = useMemo<[number, number]>(() => [1, 2], []);
	const lightPosition = useMemo<[number, number, number]>(
		() => [city.width * 0.4, city.width * 0.8, city.width * 0.2],
		[city.width],
	);

	return (
		<Canvas orthographic flat shadows dpr={dpr} camera={cameraConfig}>
			<color attach="background" args={["#0e1013"]} />
			<ambientLight intensity={0.45} />
			<directionalLight
				position={lightPosition}
				intensity={1.5}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-left={-SHADOW_RADIUS}
				shadow-camera-right={SHADOW_RADIUS}
				shadow-camera-top={SHADOW_RADIUS}
				shadow-camera-bottom={-SHADOW_RADIUS}
				shadow-camera-near={1}
				shadow-camera-far={400}
			/>
			<group position={offset}>
				<MemoCityMeshes city={city} onModuleClick={onModuleClick} />
				<TerritoryOverlay
					city={city}
					territory={territory}
					factions={factions}
					attacks={attacks}
					selected={selected}
					colorblind={colorblind}
					version={version}
				/>
			</group>
			<CameraRig focus={focus} offset={offset} />
			<StaticShadows seed={city.seed} />
		</Canvas>
	);
}
