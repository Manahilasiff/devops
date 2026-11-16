// Where the FastAPI backend is.
//   - local development: "" -> calls go to /api/*, which Vite forwards to port 8000 (see vite.config.js)
//   - GitHub Pages build: VITE_API_BASE_URL (set in .github/workflows/deploy.yml) = http://localhost:8000
//     GitHub Pages only hosts the static frontend, so the backend must be running on your own computer.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, options) {
  let res;
  try {
    res = await fetch(API_BASE + path, options);
  } catch {
    throw new Error(
      API_BASE
        ? `Cannot reach the backend at ${API_BASE}. This website is static (GitHub Pages); start the Python backend on your computer to analyse files (see README).`
        : "Cannot reach the backend. Is it running on port 8000?"
    );
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const detail = body && body.detail ? body.detail : `${res.status} ${res.statusText}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

export const getHealth = () => request("/api/health");
export const getHistory = () => request("/api/history");
export const getAnalysis = (id) => request(`/api/analysis/${id}`);

export function analyzeFile(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/api/analyze", { method: "POST", body: form });
}
