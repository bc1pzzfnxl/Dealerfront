import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Élément #root introuvable");

// Pas de StrictMode : le double-montage recrée la source mapcn au milieu de son
// cycle de vie (MapLibre jette « already exists »).
createRoot(rootElement).render(<App />);
