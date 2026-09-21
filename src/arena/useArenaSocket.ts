/**
 * Connexion spectateur à une arène : reçoit les snapshots par WebSocket et
 * hydrate un `World` **miroir** (jamais `step()`), pour réutiliser tout le rendu.
 */

import { useEffect, useRef, useState } from "react";
import type { ArenaView, SpectatorMessage } from "../server/protocol";
import { World } from "../sim/world";

export interface ArenaSocket {
	world: World | null;
	view: ArenaView | null;
	connected: boolean;
	version: number;
}

export function useArenaSocket(id: string | null): ArenaSocket {
	const worldRef = useRef<World | null>(null);
	const [world, setWorld] = useState<World | null>(null);
	const [view, setView] = useState<ArenaView | null>(null);
	const [connected, setConnected] = useState(false);
	const [version, setVersion] = useState(0);

	useEffect(() => {
		if (!id) return;
		const protocol = location.protocol === "https:" ? "wss" : "ws";
		const socket = new WebSocket(`${protocol}://${location.host}/api/arena/${id}/spectate`);
		socket.onopen = () => setConnected(true);
		socket.onclose = () => setConnected(false);
		socket.onerror = () => setConnected(false);
		socket.onmessage = (event) => {
			const message = JSON.parse(event.data as string) as SpectatorMessage;
			setView(message.view);
			if (message.kind !== "state") {
				setVersion((value) => value + 1);
				return;
			}
			const snapshot = message.snapshot;
			let mirror = worldRef.current;
			if (!mirror || mirror.factions.length !== snapshot.factions.length) {
				mirror = new World(0, {
					factionCount: snapshot.factions.length,
					controlled: snapshot.factions.map((faction) => faction.id),
				});
				worldRef.current = mirror;
				setWorld(mirror);
			}
			mirror.applySnapshot(snapshot);
			setVersion((value) => value + 1);
		};
		return () => socket.close();
	}, [id]);

	return { world, view, connected, version };
}
