import { Inbox, LoaderCircle, TriangleAlert } from "lucide-react";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({ icon: Icon, label, value, hint, tone = "default" }) {
  const tones = {
    default: "text-violet-300 bg-violet-500/10",
    good: "text-emerald-300 bg-emerald-500/10",
    bad: "text-rose-300 bg-rose-500/10",
    warn: "text-amber-300 bg-amber-500/10",
  };
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        {Icon && (
          <span className={`rounded-lg p-2 ${tones[tone]}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="tabular mt-3 text-3xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const DECISION_STYLE = {
  CATEGORY_PLAYBOOK: ["Playbook", "bg-rose-500/15 text-rose-300 ring-rose-500/30"],
  NO_ACTION: ["No action", "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"],
  UNCERTAIN_REVIEW: ["Analyst review", "bg-amber-500/15 text-amber-300 ring-amber-500/30"],
  UNSUPPORTED_CATEGORY: ["Unsupported", "bg-slate-500/15 text-slate-300 ring-slate-500/30"],
};

export function DecisionBadge({ decision }) {
  const [text, cls] = DECISION_STYLE[decision] || [decision, "bg-slate-500/15 text-slate-300 ring-slate-500/30"];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{text}</span>;
}

export function Spinner({ text = "Loading..." }) {
  return (
    <div className="flex items-center gap-3 text-slate-300">
      <LoaderCircle className="animate-spin" size={20} /> {text}
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
      <TriangleAlert size={18} className="mt-0.5 shrink-0" />
      <span className="whitespace-pre-wrap">{message}</span>
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="panel flex flex-col items-center gap-3 p-10 text-center">
      <Inbox size={36} className="text-slate-500" />
      <div className="text-lg font-medium text-white">{title}</div>
      <p className="max-w-md text-sm text-slate-400">{text}</p>
      {action}
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`accent-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
