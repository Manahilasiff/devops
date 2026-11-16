import { useEffect, useState } from "react";
import { getHistory } from "../api";
import { EmptyState, ErrorBox, PageHeader, PrimaryButton, Spinner } from "../components/ui";
import { dateTime, num, share } from "../format";
import { go } from "../router";

export default function History() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHistory().then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader title="History" subtitle="Every analysed file, newest first. Click a row to open it." />
      <ErrorBox message={error} />
      {!items && !error && <Spinner />}
      {items && items.length === 0 && (
        <EmptyState title="Nothing here yet" text="Analysed files appear here." action={<PrimaryButton onClick={() => go("/analyze")}>Analyse a CSV</PrimaryButton>} />
      )}
      {items && items.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["File", "Date", "Records", "Malicious", "Benign", "Analyst review", "Most frequent attack", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-white/5 text-slate-300">
              {items.map((h) => (
                <tr key={h.id} onClick={() => go(`/analysis/${h.id}`)} className="cursor-pointer hover:bg-white/5">
                  <td className="max-w-xs truncate px-4 py-3 text-white">{h.filename}</td>
                  <td className="whitespace-nowrap px-4 py-3">{dateTime(h.created_at)}</td>
                  <td className="px-4 py-3">{num(h.total_records)}</td>
                  <td className="px-4 py-3">
                    {num(h.malicious)} <span className="text-slate-500">({share(h.malicious, h.total_records)})</span>
                  </td>
                  <td className="px-4 py-3">{num(h.benign)}</td>
                  <td className="px-4 py-3">{num(h.review)}</td>
                  <td className="px-4 py-3">{h.most_frequent_attack ?? "none"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">{h.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
