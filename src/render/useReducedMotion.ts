import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Vrai si l'utilisateur demande moins d'animations (accessibilité). */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(
		() => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
	);

	useEffect(() => {
		const media = window.matchMedia(QUERY);
		const onChange = () => setReduced(media.matches);
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	return reduced;
}
