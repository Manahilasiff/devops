export const num = (v) => (v ?? 0).toLocaleString("en-US");
export const records = (n) => `${num(n)} record${n === 1 ? "" : "s"}`;
export const pct =(v, digits = 1) => `${((v ?? 0) * 100).toFixed(digits)}%`;
export const share = (part, total, digits = 1) => (total ? `${((part / total) * 100).toFixed(digits)}%` : "0%");
export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";

// MITRE ATT&CK links: T1498.001 -> /techniques/T1498/001/ ; M1037 -> /mitigations/M1037/
export const techniqueUrl = (id) => `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
export const mitigationUrl = (id) => `https://attack.mitre.org/mitigations/${id}/`;

// Chart colours (validated categorical palette, dark-mode steps)
export const CHART = {
  benign: "#3987e5",
  malicious: "#d95926",
  bar: "#3987e5",
  grid: "#2c2c2a",
  axis: "#898781",
};
