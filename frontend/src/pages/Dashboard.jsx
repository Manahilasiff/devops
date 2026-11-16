import { useEffect, useState } from "react";
import { Activity, Cpu, FileSpreadsheet, ShieldAlert, ShieldCheck, Upload, UserSearch } from "lucide-react";
import { getHealth, getHistory } from "../api";
import { BinaryDonut, CategoryBars } from "../components/Charts";
import { EmptyState, ErrorBox, KpiCard, PageHeader, PrimaryButton, Spinner } from "../components/ui";
import { dateTime, num, pct, share } from "../format";
import { go } from "../router";

function ModelCard({ health }) {
  if (!health) return null;
  if (!health.artifacts_loaded) return <ErrorBox message={health.detail ||"Models could not be loaded."} />;
  const m = health.models;
  const rows = [m.binary, m.category];
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
        <Cpu size={16} /> Models (Phase 1 test-set results)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="py-2 pr-4 font-medium">Task</th>
              <th className="py-2 pr-4 font-medium">Accuracy</th>
              <th className="py-2 pr-4 font-medium">Macro-F1</th>
              <th className="py-2 font-medium">MCC</th>
            </tr>
          </thead>
          <tbody className="tabular text-slate-300">
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-white/5">
                <td className="py-2 pr-4 text-white">{r.name}</td>
                <td className="py-2 pr-4">{r.task}</td>
                <td className="py-2 pr-4">{pct(r.accuracy, 2)}</td>
                <td className="py-2 pr-4">{pct(r.macro_f1, 2)}</td>
                <td className="py-2">{r.mcc.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {m.test_set}. {m.n_features} input features. Confidence threshold τ = {m.tau}.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHistory().then(setHistory).catch((e) => setError(e.message));
    getHealth().then(setHealth).catch(() => {});
  }, []);

  if (error) return (<><PageHeader title="Dashboard" /><ErrorBox message={error} /></>);
  if (!history) return <Spinner />;

  // Totals across every saved analysis (computed from real stored results only)
  const t = history.reduce(
    (a, h) => ({ records: a.records + h.total_records, benign: a.benign + h.benign, malicious: a.malicious + h.malicious, review: a.review + h.review }),
    { records: 0, benign: 0, malicious: 0, review: 0 }
  );
  const categories = {};
  history.forEach((h) => Object.entries(h.category_counts).forEach(([c, n]) => (categories[c] = (categories[c] || 0) + n)));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Totals across all saved analyses.">
        <PrimaryButton onClick={() => go("/analyze")}>
          <Upload size={16} /> Analyse a CSV
        </PrimaryButton>
      </PageHeader>

      {history.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No analyses yet"
            text="Upload a CIC-IoT-2023 CSV with the 40 feature columns. The numbers on this page come only from files you have analysed."
            action={<PrimaryButton onClick={() => go("/analyze")}>Go to Analyze</PrimaryButton>}
          />
          <ModelCard health={health} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Activity} label="Records analysed" value={num(t.records)} hint={`${history.length} file${history.length > 1 ? "s" : ""}`} />
            <KpiCard icon={ShieldAlert} tone="bad" label="Malicious" value={num(t.malicious)} hint={share(t.malicious, t.records)} />
            <KpiCard icon={ShieldCheck} tone="good" label="Benign" value={num(t.benign)} hint={share(t.benign, t.records)} />
            <KpiCard icon={UserSearch} tone="warn" label="Analyst review" value={num(t.review)} hint={share(t.review, t.records)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="mb-4 text-sm font-medium text-slate-300">Benign vs Malicious</h3>
              <BinaryDonut benign={t.benign} malicious={t.malicious} />
            </div>
            <div className="panel p-5">
              <h3 className="mb-4 text-sm font-medium text-slate-300">Predicted category, all files</h3>
              <CategoryBars counts={categories} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="mb-3 text-sm font-medium text-slate-300">Recent analyses</h3>
              <ul className="divide-y divide-white/5">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    <a href={`#/analysis/${h.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5">
                      <FileSpreadsheet size={18} className="shrink-0 text-violet-300" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-white">{h.filename}</div>
                        <div className="text-xs text-slate-500">{dateTime(h.created_at)}</div>
                      </div>
                      <div className="tabular text-right text-xs text-slate-400">
                        {num(h.total_records)} rows
                        <br />
                        {share(h.malicious, h.total_records)} malicious
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <ModelCard health={health} />
          </div>
        </>
      )}
    </div>
  );
}
