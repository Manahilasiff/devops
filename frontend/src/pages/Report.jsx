import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getAnalysis, getHistory } from "../api";
import { BinaryDonut, CategoryBars } from "../components/Charts";
import { EmptyState, ErrorBox, PageHeader, PrimaryButton, Spinner } from "../components/ui";
import { dateTime, mitigationUrl, num, pct, share } from "../format";
import { go } from "../router";

// Printable summary of one analysis. "Save as PDF" uses the browser's print dialog.
export default function Report({ id }) {
  const [history, setHistory] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    getHistory().then(setHistory).catch((e) => setError(e.message));
  }, []);

  const selected = id || (history && history[0]?.id);
  useEffect(() => {
    if (!selected) return;
    setAnalysis(null);
    getAnalysis(selected).then(setAnalysis).catch((e) => setError(e.message));
  }, [selected]);

  if (error) return (<><PageHeader title="Report" /><ErrorBox message={error} /></>);
  if (!history) return <Spinner />;
  if (history.length === 0)
    return (
      <>
        <PageHeader title="Report" />
        <EmptyState title="No analyses to report" text="Analyse a CSV first." action={<PrimaryButton onClick={() => go("/analyze")}>Analyse a CSV</PrimaryButton>} />
      </>
    );

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Report" subtitle="Choose an analysis, then print or save it as a PDF.">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selected || ""}
              onChange={(e) => go(`/report/${e.target.value}`)}
              className="rounded-xl border border-white/10 bg-[#111831] px-3 py-2 text-sm text-slate-200"
            >
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.filename} · {dateTime(h.created_at)}
                </option>
              ))}
            </select>
            <PrimaryButton onClick={() => window.print()} disabled={!analysis}>
              <Printer size={16} /> Print / Save as PDF
            </PrimaryButton>
          </div>
        </PageHeader>
      </div>

      {!analysis ? <Spinner /> : <ReportBody a={analysis} />}
    </div>
  );
}

function ReportBody({ a }) {
  const s = a.summary;
  const total = s.total_records;
  const rows = [
    ["Records analysed", num(total)],
    ["Malicious (Random Forest)", `${num(s.binary.attack)} (${share(s.binary.attack, total)})`],
    ["Benign (Random Forest)", `${num(s.binary.benign)} (${share(s.binary.benign, total)})`],
    ["Given a playbook", num(s.decision_counts.CATEGORY_PLAYBOOK)],
    ["No action (benign)", num(s.decision_counts.NO_ACTION)],
    ["Sent to analyst review", `${num(s.decision_counts.UNCERTAIN_REVIEW)} (${num(s.review_reasons["low confidence"])} low confidence, ${num(s.review_reasons["binary and category models disagree"])} model disagreement)`],
    ["Mean category confidence", pct(s.mean_confidence)],
    ["Most frequent attack", s.most_frequent_attack ?? "none"],
    ["Missing values filled", num(s.values_filled_with_training_median)],
  ];

  return (
    <article className="space-y-6">
      <div className="panel p-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">IoT network traffic analysis report</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{a.filename}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Generated {dateTime(a.created_at)} · Analysis ID {a.id}
        </p>
        <p className="mt-3 text-sm text-slate-300">
          Models: {a.engine.binary_model} (benign vs attack) and {a.engine.category_model} (8 categories), trained in Phase 1 on CIC-IoT-2023.
          Recommendations come from a confidence-gated engine: a playbook is issued only when the category confidence is at least τ = {a.engine.tau} and both models agree.
        </p>
      </div>

      <div className="panel p-6">
        <h3 className="mb-3 font-semibold text-white">Summary</h3>
        <table className="w-full text-sm">
          <tbody className="tabular divide-y divide-white/5">
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="py-2 pr-4 text-slate-400">{k}</td>
                <td className="py-2 text-slate-200">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-6">
          <h3 className="mb-4 font-semibold text-white">Benign vs Malicious</h3>
          <BinaryDonut benign={s.binary.benign} malicious={s.binary.attack} />
        </div>
        <div className="panel p-6">
          <h3 className="mb-4 font-semibold text-white">Predicted category</h3>
          <CategoryBars counts={s.category_counts} />
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="mb-3 font-semibold text-white">Recommendations</h3>
        {a.recommendation_cards.length === 0 && <p className="text-sm text-slate-400">No confident attack predictions, so no playbook applies.</p>}
        <div className="space-y-5">
          {a.recommendation_cards.map((c) => (
            <div key={c.category} className="break-inside-avoid">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="font-medium text-white">
                  {c.category}: {c.title} ({c.playbook_id})
                </div>
                <div className="tabular text-sm text-slate-400">
                  {num(c.count)} records · mean confidence {pct(c.mean_confidence)}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                ATT&CK: {c.attck_techniques.map(([tid, name]) => `${tid} ${name}`).join("; ")}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {c.actions.map((x, i) => (
                  <li key={i}>
                    {x.action} {x.mitigation_id && <a href={mitigationUrl(x.mitigation_id)} className="text-xs text-slate-500">[{x.mitigation_id}]</a>}
                  </li>
                ))}
              </ul>
              {c.protocol_contexts.length > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  Protocol sub-types: {c.protocol_contexts.map((p) => `${p.context} (${num(p.count)})`).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6 text-xs text-slate-400">
        <p>{a.engine.disclaimer}</p>
        <p className="mt-2">
          Phase 1 test-set results for these models are on the Dashboard. Recommendations are decision support for an analyst, not automatic enforcement.
        </p>
      </div>
    </article>
  );
}
