"""Very small storage layer: every analysis is one JSON file in backend/analyses/."""
import json
import re
from pathlib import Path

ANALYSES_DIR = Path(__file__).resolve().parent / "analyses"
ANALYSES_DIR.mkdir(exist_ok=True)
_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")   # only ids we generate (prevents path tricks like ../)


def save(analysis):
    path = ANALYSES_DIR / f"{analysis['id']}.json"
    path.write_text(json.dumps(analysis, indent=1), encoding="utf-8")


def load(analysis_id):
    """Return the saved analysis or None if the id is unknown/invalid."""
    if not _ID_PATTERN.match(analysis_id or ""):
        return None
    path = ANALYSES_DIR / f"{analysis_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def history():
    """Short summaries of all saved analyses, newest first."""
    items = []
    for path in ANALYSES_DIR.glob("*.json"):
        try:
            a = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        s = a["summary"]
        items.append({
            "id": a["id"], "filename": a["filename"], "created_at": a["created_at"], "status": a["status"],
            "total_records": s["total_records"], "benign": s["binary"]["benign"], "malicious": s["binary"]["attack"],
            "review": s["decision_counts"]["UNCERTAIN_REVIEW"], "category_counts": s["category_counts"],
            "most_frequent_attack": s["most_frequent_attack"],
        })
    return sorted(items, key=lambda d: d["created_at"], reverse=True)
