import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard";
import "./dashboard.css";

const root = document.getElementById("dashboard-root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<Dashboard />
		</StrictMode>,
	);
}
