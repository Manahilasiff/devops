import { Activity, FileText, ShieldAlert, ShieldCheck, UserSearch, Gauge } from "lucide-react";
import { BinaryDonut, CategoryBars } from "./Charts";
import RecommendationCard from "./RecommendationCard";
import { DecisionBadge, KpiCard, SecondaryButton } from "./ui";
import { dateTime, num, pct, share } from "../format";
import { go } from "../router";

function Section({ title, subtitle, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Table({ head, children }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">{children}</tbody>
      </table>
    </div>
  );
}

// Full result of one analysis. Used by the Analyze page (right after upload) and by #/analysis/<id>.
export default function ResultView({ analysis, compact = false }) {
  const s = analysis.summary;
  const total = s.total_records;
  const triage = analysis.engine.special_playbooks.UNCERTAIN;
  const reviewCount = s.decision_counts.UNCERTAIN_REVIEW;

  return (
    <div>
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <div className="font-medium text-white">{analysis.filename}</div>
          <div className="text-slate-400">
            Analysed {dateTime(analysis.created_at)} · Random Forest (benign/attack) + HistGradientBoosting (8 categories) · τ ={" "}
            {analysis.engine.tau}
          </div>
        </div>
        <div className="no-print flex gap-2">
          {compact && <SecondaryButton onClick={() => go(`/analysis/${analysis.id}`)}>Open full page</SecondaryButton>}
          <SecondaryButton onClick={() => go(`/report/${analysis.id}`)}>
            <FileText size={16} /> Report
          </SecondaryButton>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Activity} label="Records analysed" value={num(total)}
          hint={s.values_filled_with_training_median ? `${num(s.values_filled_with_training_median)} missing values filled with training medians` : "No missing values"} />
        <KpiCard icon={ShieldAlert} tone="bad" label="Malicious (Random Forest)" value={num(s.binary.attack)} hint={share(s.binary.attack, total)} />
        <KpiCard icon={ShieldCheck} tone="good" label="Benign (Random Forest)" value={num(s.binary.benign)} hint={share(s.binary.benign, total)} />
        <KpiCard icon={UserSearch} tone="warn" label="Sent to analyst review" value={num(reviewCount)} hint={share(reviewCount, total)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-300">Benign vs Malicious</h3>
          <BinaryDonut benign={s.binary.benign} malicious={s.binary.attack} />
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-300">Predicted category</h3>
          <CategoryBars counts={s.category_counts} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Engine decisions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(s.decision_counts).map(([d, c]) => (
              <div key={d} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <DecisionBadge decision={d} />
                <span className="tabular text-sm text-white">
                  {num(c)} <span className="text-slate-500">({share(c, total)})</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Review reasons: {num(s.review_reasons["low confidence"])} low confidence (below τ = {analysis.engine.tau}),{" "}
            {num(s.review_reasons["binary and category models disagree"])} where the two models disagree.
          </p>
        </div>
        <KpiCard icon={Gauge} label="Mean category confidence" value={pct(s.mean_confidence)}
          hint={`${pct(s.confident_share)} of records at or above τ · most frequent attack: ${s.most_frequent_attack ?? "none"}`} />
      </div>

      <Section title="Recommendations" subtitle="One playbook per detected attack category (records with confidence ≥ τ and both models agreeing).">
        {analysis.recommendation_cards.length === 0 ? (
          <div className="panel p-5 text-sm text-slate-400">No confident attack predictions, so no playbook applies.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {analysis.recommendation_cards.map((c) => (
              <RecommendationCard key={c.category} card={c} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">{analysis.engine.disclaimer}</p>
      </Section>

      {reviewCount > 0 && (
        <Section
          title="Analyst review queue"
          subtitle={`${num(reviewCount)} records were not given a playbook. ${triage.title}.${analysis.review_rows_truncated ? ` Showing the first ${analysis.review_rows.length}.` : ""}`}
        >
          {!compact && (
            <div className="panel mb-3 p-4 text-sm text-slate-300">
              <ul className="list-disc space-y-1 pl-5">
                {triage.actions.map((a, i) => (
                  <li key={i}>{a.action}</li>
                ))}
              </ul>
            </div>
          )}
          <Table head={["Row", "Reason", "Binary model", "Top-2 categories", "Strongest evidence"]}>
            {analysis.review_rows.slice(0, compact ? 10 : undefined).map((r) => (
              <tr key={r.row}>
                <td className="tabular px-4 py-2">{r.row}</td>
                <td className="px-4 py-2">{r.reason}</td>
                <td className="px-4 py-2">{r.binary_model}</td>
                <td className="tabular px-4 py-2">
                  {r.top2_candidates.map(([c, p]) => `${c} ${pct(p)}`).join(" / ")}
                </td>
                <td className="tabular px-4 py-2 text-xs text-slate-400">
                  {r.evidence[0] && `${r.evidence[0].feature} ${r.evidence[0].deviation_benign_sd > 0 ? "+" : ""}${r.evidence[0].deviation_benign_sd} SD`}
                </td>
              </tr>
            ))}
          </Table>
          {compact && analysis.review_rows.length > 10 && (
            <p className="mt-2 text-xs text-slate-500">Showing 10 rows. Open the full page to see up to 200.</p>
          )}
        </Section>
      )}

      <Section title="Sample predictions" subtitle={`First ${compact ? Math.min(20, analysis.sample_predictions.length) : analysis.sample_predictions.length} rows of the file.`}>
        <Table head={["Row", "Binary model", "Category", "Confidence", "Decision"]}>
          {analysis.sample_predictions.slice(0, compact ? 20 : undefined).map((r) => (
            <tr key={r.row}>
              <td className="tabular px-4 py-2">{r.row}</td>
              <td className="px-4 py-2">{r.binary_model}</td>
              <td className="px-4 py-2">{r.category}</td>
              <td className="tabular px-4 py-2">{pct(r.confidence)}</td>
              <td className="px-4 py-2">
                <DecisionBadge decision={r.decision} />
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
