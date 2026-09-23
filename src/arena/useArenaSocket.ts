/**
 * Spectator connection to an arena: receives snapshots over WebSocket and
 * hydrates a **mirror** `World` (never `step()`), to reuse all rendering.
 */

import { useEffect, useRef, useState } from "react";
import type { ArenaView, SpectatorMessage } from "../server/protocol";
import { World } from "../sim/world";

export interface ArenaSocket {
	world: World | null;
	view: ArenaView | null;
	connected: boolean;
	/** The table is gone (deleted) or too old to run — show it plainly. */
	unavailable: boolean;
	version: number;
}

export function useArenaSocket(id: string | null): ArenaSocket {
	const worldRef = useRef<World | null>(null);
	const [world, setWorld] = useState<World | null>(null);
	const [view, setView] = useState<ArenaView | null>(null);
	const [connected, setConnected] = useState(false);
	const [unavailable, setUnavailable] = useState(false);
	const [version, setVersion] = useState(0);

	useEffect(() => {
		if (!id) return;
		let stopped = false;
		let socket: WebSocket | null = null;
		let reconnectTimer: number | null = null;
		let attempt = 0;

		const connect = () => {
			if (stopped) return;
			const protocol = location.protocol === "https:" ? "wss" : "ws";
			socket = new WebSocket(`${protocol}://${location.host}/api/arena/${id}/spectate`);
			socket.onopen = () => {
				attempt = 0;
				setConnected(true);
			};
			socket.onclose = () => {
				setConnected(false);
				if (stopped) return;
				// If we never got a view and never got a world, table likely dead — don't loop forever
				if (!worldRef.current && !view) {
					// give it 2 attempts before marking unavailable
					if (attempt >= 2) setUnavailable(true);
				}
				const delay = Math.min(5000, 800 * Math.pow(1.6, attempt));
				attempt += 1;
				reconnectTimer = window.setTimeout(connect, delay) as unknown as number;
			};
			socket.onerror = () => {
				try {
					socket?.close();
				} catch {
					// ignore
				}
			};
			socket.onmessage = (event) => {
				const message = JSON.parse(event.data as string) as SpectatorMessage;
				if ((message as { error?: string }).error) {
					setUnavailable(true);
					return;
				}
				setView(message.view);
				const snapshot = message.snapshot;
				if (snapshot) {
					let mirror = worldRef.current;
					if (!mirror || mirror.factions.length !== snapshot.factions.length) {
						mirror = new World(0, { factionCount: snapshot.factions.length });
						worldRef.current = mirror;
						setWorld(mirror);
					}
					mirror.applySnapshot(snapshot);
				}
				setVersion((value) => value + 1);
			};
		};

		connect();

		// Heartbeat: if WS stalls (tab background, DO hibernate), poll view via HTTP to re-arm alarm and keep UI warm
		const heartbeat = window.setInterval(
			() => {
				if (document.visibilityState !== "visible") return;
				void fetch(`/api/arena/${id}/view`)
					.then((r) => r.json())
					.then((v) => {
						if (v && typeof v.id === "string") setView(v as ArenaView);
					})
					.catch(() => {});
			},
			45_000,
		);

		return () => {
			stopped = true;
			if (reconnectTimer !== null) clearTimeout(reconnectTimer);
			clearInterval(heartbeat);
			try {
				socket?.close();
			} catch {
				// ignore
			}
		};
	}, [id]);

	return { world, view, connected, unavailable, version };
}
