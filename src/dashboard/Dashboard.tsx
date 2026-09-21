import {
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
		label: "Win rate",
		value: `${winRate.toFixed(0)}%`,
		hint: `${wins} / ${runs.length} games`,
	},
	{
		label: "Average duration",
		value: `${(mean((r) => r.durationS) / 60).toFixed(1)} min`,
		hint: `cap ${(meta.maxTicks / 600).toFixed(0)} min`,
	},
	{
		label: "Final control",
		value: `${(mean((r) => r.control) * 100).toFixed(1)}%`,
		hint: "target ≥ 60%",
	},
	{
		label: "Clean cash",
		value: `${(mean((r) => r.clean) / 1_000_000).toFixed(2)} M`,
		hint: "target 0.5M",
	},
	{
		label: "Police pressure",
		value: mean((r) => r.pressure).toFixed(0),
		hint: `${mean((r) => r.raids).toFixed(1)} raids / game`,
	},
	{
		label: "Quarters taken",
		value: mean((r) => r.captures).toFixed(0),
		hint: `${mean((r) => r.buildings).toFixed(0)} buildings`,
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

const curveRows = runs.map((run) => ({
	seed: run.seed,
	control: Math.round(run.control * 1000) / 10,
	clean: Math.round((run.clean / 1_000_000) * 100) / 100,
}));

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

export function Dashboard() {
	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl tracking-tight">DealerFront — Balancing</h1>
					<p className="text-muted-foreground text-sm">
						{meta.seeds} simulated games · bot every {meta.cadence} ticks ·{" "}
						{meta.maxTicks} ticks max
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant={winRate >= 60 ? "default" : "secondary"}>
						{winRate.toFixed(0)}% wins
					</Badge>
					<Badge variant="outline">{meta.computeSeconds}s compute</Badge>
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
					<CardTitle>Results by city archetype</CardTitle>
					<CardDescription>Wins and losses by city profile</CardDescription>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={320}>
						<BarChart data={archetypeRows}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
							<XAxis dataKey="archetype" tick={AXIS} />
							<YAxis tick={AXIS} allowDecimals={false} />
							<Tooltip />
							<Legend />
							<Bar dataKey="victory" stackId="a" fill="var(--chart-2)" />
							<Bar dataKey="defeat" stackId="a" fill="var(--chart-5)" />
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Control and laundering per game</CardTitle>
					<CardDescription>
						Bars = Clean cash (M) · line = final control (%) · one entry per seed
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={340}>
						<ComposedChart data={curveRows}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
							<XAxis dataKey="seed" tick={AXIS} />
							<YAxis yAxisId="left" tick={AXIS} />
							<YAxis yAxisId="right" orientation="right" tick={AXIS} />
							<Tooltip />
							<Legend />
							<Bar yAxisId="left" dataKey="clean" fill="var(--chart-3)" />
							<Line yAxisId="right" dataKey="control" stroke="var(--chart-1)" dot={false} />
						</ComposedChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			<Separator />
			<p className="text-muted-foreground text-xs">
				Data: <code>data/sim.sqlite</code> → export <code>src/dashboard/sim-data.json</code>.
				Generated on {new Date(meta.generatedAt).toLocaleString("en-US")}. Rerun with{" "}
				<code>bun run sim:bench</code>. The playable map (Paris IRIS) is in the game:{" "}
				<code>?map=paris</code>.
			</p>
		</main>
	);
}
