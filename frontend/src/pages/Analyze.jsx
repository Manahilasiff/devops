import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { analyzeFile } from "../api";
import ResultView from "../components/ResultView";
import { ErrorBox, PageHeader, PrimaryButton, Spinner } from "../components/ui";
import { records } from "../format";

// Count data rows in the browser (lines minus the header) so the user sees the size before uploading.
async function countRows(file) {
  const text = await file.text();
  let lines = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  if (text.length && text[text.length - 1] !== "\n") lines++;
  return Math.max(0, lines - 1);
}

export default function Analyze() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const input = useRef(null);

  const pick = async (f) => {
    setError("");
    setResult(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please choose a .csv file.");
      return;
    }
    setFile(f);
    setRows(null);
    setRows(await countRows(f));
  };

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await analyzeFile(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Analyze" subtitle="Upload a CIC-IoT-2023 CSV with the 40 feature columns. Extra columns such as labels are ignored." />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        className={`panel flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-fuchsia-400/70 bg-fuchsia-500/5" : "border-white/10 hover:border-white/20"
        }`}
      >
        <span className="accent-gradient rounded-2xl p-3 text-white">
          <Upload size={24} />
        </span>
        <div className="text-white">Drag and drop a CSV here, or click to choose</div>
        <div className="text-xs text-slate-500">Maximum 100 MB</div>
        <input
          ref={input}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>

      {file && (
        <div className="panel mt-4 flex flex-wrap items-center gap-4 p-4">
          <FileSpreadsheet size={22} className="text-violet-300" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-white">{file.name}</div>
            <div className="tabular text-xs text-slate-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {rows === null ? "counting rows..." : records(rows)}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
              setError("");
            }}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
            title="Remove file"
            disabled={loading}
          >
            <X size={18} />
          </button>
          <PrimaryButton onClick={run} disabled={loading}>
            {loading ? "Analysing..." : "Analyse"}
          </PrimaryButton>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {loading && (
          <div className="panel p-5">
            <Spinner text="Running both models and the recommendation engine..." />
          </div>
        )}
        <ErrorBox message={error} />
      </div>

      {result && (
        <div className="mt-6">
          <ResultView analysis={result} compact />
        </div>
      )}
    </div>
  );
}
