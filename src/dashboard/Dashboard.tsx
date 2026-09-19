import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapExample } from "./MapExample";
import data from "./sim-data.json";

interface Run {
	seed: number;
	archetype: string;
	outcome: string;
	ticks: number;
	durationS: number;
	control: number;
	clean: number;
	buildings: number;
	pressure: number;
	raids: number;
	captures: number;
}

const runs = data.runs as Run[];
const meta = data.meta;

const wins = runs.filter((run) => run.outcome === "victory").length;
const winRate = runs.length > 0 ? (wins / runs.length) * 100 : 0;
const mean = (pick: (run: Run) => number): number =>
	runs.length > 0 ? runs.reduce((sum, run) => sum + pick(run), 0) / runs.length : 0;

const kpis: { label: string; value: string; hint: string }[] = [
	{
		label: "Taux de victoire",
		value: `${winRate.toFixed(0)} %`,
		hint: `${wins} / ${runs.length} parties`,
	},
	{
		label: "Durée moyenne",
		value: `${(mean((r) => r.durationS) / 60).toFixed(1)} min`,
		hint: `plafond ${(meta.maxTicks / 600).toFixed(0)} min`,
	},
	{
		label: "Contrôle final",
		value: `${(mean((r) => r.control) * 100).toFixed(1)} %`,
		hint: "objectif ≥ 60 %",
	},
	{
		label: "Cash propre",
		value: `${(mean((r) => r.clean) / 1_000_000).toFixed(2)} M`,
		hint: "objectif 0,5 M",
	},
	{
		label: "Pression police",
		value: mean((r) => r.pressure).toFixed(0),
		hint: `${mean((r) => r.raids).toFixed(1)} raids / partie`,
	},
	{
		label: "Quartiers pris",
		value: mean((r) => r.captures).toFixed(0),
		hint: `${mean((r) => r.buildings).toFixed(0)} bâtiments`,
	},
];

const archetypeRows = (() => {
	const map = new Map<string, { archetype: string; victory: number; defeat: number }>();
	for (const run of runs) {
		const row = map.get(run.archetype) ?? { archetype: run.archetype, victory: 0, defeat: 0 };
		if (run.outcome === "victory") row.victory += 1;
		else row.defeat += 1;
		map.set(run.archetype, row);
	}
	return [...map.values()].sort((a, b) => b.victory + b.defeat - (a.victory + a.defeat));
})();

const outcomeConfig = {
	victory: { label: "Victoires", colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] } },
	defeat: { label: "Défaites", colors: { light: ["var(--chart-5)"], dark: ["var(--chart-5)"] } },
} satisfies ChartConfig;

const curveRows = runs.map((run) => ({
	seed: run.seed,
	control: Math.round(run.control * 1000) / 10,
	clean: Math.round((run.clean / 1_000_000) * 100) / 100,
}));

const curveConfig = {
	control: { label: "Contrôle (%)", colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] } },
	clean: { label: "Cash propre (M)", colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] } },
} satisfies ChartConfig;

export function Dashboard() {
	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl tracking-tight">DealerFront — Équilibrage</h1>
					<p className="text-muted-foreground text-sm">
						{meta.seeds} parties simulées · bot toutes les {meta.cadence} ticks ·{" "}
						{meta.maxTicks} ticks max
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant={winRate >= 60 ? "default" : "secondary"}>
						{winRate.toFixed(0)} % de victoires
					</Badge>
					<Badge variant="outline">{meta.computeSeconds} s de calcul</Badge>
				</div>
			</header>

			<section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
				{kpis.map((kpi) => (
					<Card key={kpi.label}>
						<CardHeader>
							<CardDescription>{kpi.label}</CardDescription>
							<CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-xs">{kpi.hint}</p>
						</CardContent>
					</Card>
				))}
			</section>

			<Card>
				<CardHeader>
					<CardTitle>Résultats par archétype de ville</CardTitle>
					<CardDescription>Victoires et défaites selon le profil de ville</CardDescription>
				</CardHeader>
				<CardContent>
					<EvilBarChart
						config={outcomeConfig}
						data={archetypeRows}
						xDataKey="archetype"
						stackType="stacked"
						className="h-[320px] w-full"
					>
						<EvilBarChart.Grid />
						<EvilBarChart.XAxis dataKey="archetype" />
						<EvilBarChart.YAxis />
						<EvilBarChart.Tooltip />
						<EvilBarChart.Legend />
						<EvilBarChart.Bar dataKey="victory" />
						<EvilBarChart.Bar dataKey="defeat" />
					</EvilBarChart>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Contrôle et blanchiment par partie</CardTitle>
					<CardDescription>
						Barres = Cash propre (M) · ligne = contrôle final (%) · une entrée par seed
					</CardDescription>
				</CardHeader>
				<CardContent>
					<EvilComposedChart
						config={curveConfig}
						data={curveRows}
						xDataKey="seed"
						className="h-[340px] w-full"
					>
						<EvilComposedChart.Grid />
						<EvilComposedChart.XAxis dataKey="seed" />
						<EvilComposedChart.YAxis />
						<EvilComposedChart.Tooltip />
						<EvilComposedChart.Legend />
						<EvilComposedChart.Bar dataKey="clean" />
						<EvilComposedChart.Line dataKey="control" />
					</EvilComposedChart>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Mapcn — exemple de carte</CardTitle>
					<CardDescription>Fond de carte CARTO par défaut (rues, labels)</CardDescription>
				</CardHeader>
				<CardContent>
					<MapExample />
				</CardContent>
			</Card>

			<Separator />
			<p className="text-muted-foreground text-xs">
				Données : <code>data/sim.sqlite</code> → export <code>src/dashboard/sim-data.json</code>.
				Généré le {new Date(meta.generatedAt).toLocaleString("fr-FR")}. Relancer avec{" "}
				<code>bun run sim:bench</code>.
			</p>
		</main>
	);
}
