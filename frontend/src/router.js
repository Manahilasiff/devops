import { useEffect, useState } from "react";

// Tiny hash router: #/analyze, #/history, #/analysis/<id>, #/report/<id>
export function useRoute() {
  const read = () => {
    const parts = (window.location.hash.replace(/^#\/?/, "") || "dashboard").split("/");
    return { page: parts[0] || "dashboard", id: parts[1] || null };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (path) => {
  window.location.hash = path;
};
