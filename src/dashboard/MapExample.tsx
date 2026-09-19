import { Map, MapControls } from "@/components/ui/map";

/** Exemple mapcn de base : fond de carte par défaut (rues, labels) dans un conteneur dimensionné. */
export function MapExample() {
	return (
		<div className="h-[320px] overflow-hidden rounded-lg border">
			<Map center={[2.3522, 48.8566]} zoom={12}>
				<MapControls />
			</Map>
		</div>
	);
}
