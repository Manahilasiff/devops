import { useEffect, useState } from "react";
import { getAnalysis } from "../api";
import ResultView from "../components/ResultView";
import { ErrorBox, PageHeader, Spinner } from "../components/ui";

export default function AnalysisPage({ id }) {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnalysis(null);
    setError("");
    getAnalysis(id).then(setAnalysis).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div>
      <PageHeader title="Analysis result" />
      <ErrorBox message={error} />
      {!analysis && !error && <Spinner />}
      {analysis && <ResultView analysis={analysis} />}
    </div>
  );
}
