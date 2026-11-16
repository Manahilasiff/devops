import { FileText, History as HistoryIcon, LayoutDashboard, Shield, Upload } from "lucide-react";
import { useRoute } from "./router";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import History from "./pages/History";
import AnalysisPage from "./pages/AnalysisPage";
import Report from "./pages/Report";

const NAV = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "analyze", label: "Analyze", icon: Upload },
  { page: "history", label: "History", icon: HistoryIcon },
  { page: "report", label: "Report", icon: FileText },
];

export default function App() {
  const { page, id } = useRoute();
  const active = page === "analysis" ? "history" : page;

  let content;
  if (page === "analyze") content = <Analyze />;
  else if (page === "history") content = <History />;
  else if (page === "analysis") content = <AnalysisPage id={id} />;
  else if (page === "report") content = <Report id={id} />;
  else content = <Dashboard />;

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print border-b border-white/5 bg-[#0a1022] md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="accent-gradient rounded-xl p-2 text-white">
            <Shield size={20} />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">IoT Intrusion Detection</div>
            <div className="text-xs text-slate-500">CIC-IoT-2023</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map(({ page: p, label, icon: Icon }) => (
            <a
              key={p}
              href={`#/${p}`}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                active === p ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon size={18} /> {label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="print-area mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{content}</main>
    </div>
  );
}
