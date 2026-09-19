import { describe, expect, it } from "vitest";
import { BUILDING_TYPES } from "../sim/buildings";
import { CARTEL_MODELS } from "./models";

describe("modèles 3D des bâtiments", () => {
	it("chaque type a une recette de plusieurs volumes, dans les limites du quartier", () => {
		for (const type of BUILDING_TYPES) {
			const parts = CARTEL_MODELS[type];
			expect(parts.length, type).toBeGreaterThanOrEqual(4);
			for (const part of parts) {
				expect(["box", "cylinder", "cone", "sphere"], `${type}:${part.shape}`).toContain(part.shape);
				expect(part.sx, `${type} sx`).toBeGreaterThan(0);
				expect(part.sy, `${type} sy`).toBeGreaterThan(0);
				expect(part.y, `${type} y`).toBeGreaterThan(0);
				expect(Math.abs(part.x), `${type} x`).toBeLessThan(3);
				expect(Math.abs(part.z), `${type} z`).toBeLessThan(3);
				expect(part.color, `${type} color`).toMatch(/^#[0-9A-F]{6}$/i);
			}
		}
	});
});
