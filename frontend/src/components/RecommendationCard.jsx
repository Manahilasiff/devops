import { ShieldAlert, ChevronRight } from "lucide-react";
import { mitigationUrl, num, pct, records, techniqueUrl } from "../format";

function ActionList({ actions }) {
  return (
    <ul className="space-y-2">
      {actions.map((a, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-300">
          <ChevronRight size={16} className="mt-0.5 shrink-0 text-fuchsia-400" />
          <span>
            {a.action}{" "}
            {a.mitigation_id && (
              <a href={mitigationUrl(a.mitigation_id)} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:underline">
                {a.mitigation_id} {a.mitigation_name}
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// One card per detected attack category: playbook, ATT&CK techniques, actions, flood sub-types, evidence.
export default function RecommendationCard({ card }) {
  const evidence = card.example?.advisory?.evidence || [];
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-rose-500/10 p-2 text-rose-300">
            <ShieldAlert size={20} />
          </span>
          <div>
            <div className="text-xs tracking-wide text-slate-500">
              {card.category} · {card.playbook_id}
            </div>
            <h3 className="text-base font-semibold text-white">{card.title}</h3>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="tabular font-semibold text-white">{records(card.count)}</div>
          <div className="tabular text-xs text-slate-400">mean confidence {pct(card.mean_confidence)}</div>
          {card.predicted_total !== card.count && (
            <div className="tabular text-xs text-slate-500">
              {num(card.predicted_total - card.count)} more sent to analyst review
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.attck_techniques.map(([id, name]) => (
          <a
            key={id}
            href={techniqueUrl(id)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-200 hover:bg-violet-500/20"
          >
            {id} {name}
          </a>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recommended actions</div>
        <ActionList actions={card.actions} />
      </div>

      {card.protocol_contexts.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Protocol sub-playbooks</div>
          <div className="space-y-3">
            {card.protocol_contexts.map((p) => (
              <div key={p.context} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-200">{p.context}</span>
                  <span className="tabular text-slate-400">{records(p.count)}</span>
                </div>
                {p.actions.length ? (
                  <ActionList actions={p.actions} />
                ) : (
                  <p className="text-sm text-slate-500">No protocol-specific action. Follow the category actions above.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Evidence (most confident row #{card.example.row}, vs benign training profile)
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {evidence.map((e) => (
              <div key={e.feature} className="rounded-lg bg-white/[0.03] p-2 text-xs">
                <div className="font-medium text-slate-200">{e.feature}</div>
                <div className="tabular text-slate-400">
                  {e.value} vs {e.benign_median}
                </div>
                <div className="tabular text-slate-500">
                  {e.deviation_benign_sd > 0 ? "+" : ""}
                  {e.deviation_benign_sd} SD, {e.direction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
