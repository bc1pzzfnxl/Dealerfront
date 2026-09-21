import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

// No StrictMode: double-mounting recreates the mapcn source mid-lifecycle
// (MapLibre throws "already exists").
createRoot(rootElement).render(<App />);
