import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { CHART, num, share } from "../format";

const tooltipStyle = {
  contentStyle: { background: "#111831", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#94a3b8" },
};

// Benign vs Malicious donut (binary Random Forest output)
export function BinaryDonut({ benign, malicious }) {
  const total = benign + malicious;
  const data = [
    { name: "Benign", value: benign, color: CHART.benign },
    { name: "Malicious", value: malicious, color: CHART.malicious },
  ];
  return (
    <div className="flex flex-col items-center gap-4 xl:flex-row xl:justify-center">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v) => num(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-semibold text-white">{num(total)}</span>
          <span className="text-xs text-slate-400">records</span>
        </div>
      </div>
      <ul className="space-y-3 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
            <span className="w-20 text-slate-300">{d.name}</span>
            <span className="tabular font-medium text-white">{num(d.value)}</span>
            <span className="tabular text-slate-500">{share(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal bar chart of predicted categories (HistGradientBoosting output)
export function CategoryBars({ counts }) {
  const data = Object.entries(counts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const height = Math.max(180, data.length * 34);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={num} />
          <YAxis type="category" dataKey="name" width={84} tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [num(v), "records"]} />
          <Bar
            dataKey="value"
            fill={CHART.bar}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            isAnimationActive={false}
            label={{ position: "right", fill: "#cbd5e1", fontSize: 12, formatter: num }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
