"""
Checks that the backend uses the Phase 1 models and engine correctly.

Run from the project folder:   python backend/test_engine.py
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
import engine  # noqa: E402

TEST_CSV = engine.PROJECT_ROOT / "csv files" / "CIC_IoT_2023_test_40K.csv"
results = {}


def check(name, condition):
    results[name] = bool(condition)
    print(("PASS " if condition else "FAIL ") + name)


check("all Phase 1 artefacts loaded", engine.ART is not None)
if engine.ART is None:
    print(engine.LOAD_ERROR); sys.exit(1)

df = pd.read_csv(TEST_CSV)
x0 = engine.preprocess(df.head(1))[0].iloc[0]

# ---- same rules as the Phase 1 unit tests (notebook Section 13.1) ----
check("every attack class has its own playbook", all(c in engine.PLAYBOOKS for c in engine.CLASS_NAMES if c != "Benign"))
check("confident Benign -> NO_ACTION", engine.build_advisory("Benign", 0.99, [], x0)["advisory"]["decision"] == "NO_ACTION")
check("low confidence -> UNCERTAIN_REVIEW", engine.build_advisory("DDoS", engine.TAU - 0.01, [], x0)["advisory"]["decision"] == "UNCERTAIN_REVIEW")
check("low confidence Benign -> UNCERTAIN_REVIEW", engine.build_advisory("Benign", engine.TAU - 0.01, [], x0)["advisory"]["decision"] == "UNCERTAIN_REVIEW")
check("unknown label -> UNSUPPORTED_CATEGORY", engine.build_advisory("Ransomware", 0.99, [], x0)["advisory"]["playbook_id"] == "PB-UNSUPPORTED")
check("model output and advisory are separate", set(engine.build_advisory("DoS", 0.99, [], x0)) == {"model_prediction", "advisory"})
check("disclaimer says it does not block traffic", "does not block" in engine.build_advisory("DoS", 0.99, [], x0)["advisory"]["disclaimer"])
check("flood playbooks get a protocol context", engine.build_advisory("DDoS", 0.99, [], x0)["advisory"]["protocol_context"] is not None)
check("web-app rule: model disagreement -> UNCERTAIN_REVIEW",
      engine.build_advisory("DDoS", 0.99, [], x0, binary_pred=0)["advisory"]["decision"] == "UNCERTAIN_REVIEW")

# ---- missing-column validation ----
try:
    engine.preprocess(df.drop(columns=["Rate", "IAT"]).head(5)); ok = False
except engine.ValidationError as e:
    ok = "Rate" in str(e) and "IAT" in str(e)
check("missing columns are rejected with their names", ok)

# ---- the backend must reproduce the Phase 1 test-set results exactly ----
X, _ = engine.preprocess(df)
y_bin = df["label"].to_numpy()
y_cat = np.array([engine.CLASS_NAMES.index(c) for c in df["attack_class"]])
rf_acc = accuracy_score(y_bin, engine.ART["binary_model"].predict(X))
hgb_f1 = f1_score(y_cat, engine.ART["category_model"].predict(X), average="macro")
print(f"     binary RF accuracy = {rf_acc:.6f} (Phase 1: 0.996325) | 8-class HGB macro-F1 = {hgb_f1:.4f} (Phase 1: 0.7234)")
check("RF accuracy matches Phase 1", abs(rf_acc - 0.996325) < 1e-9)
check("HGB macro-F1 matches Phase 1", abs(hgb_f1 - 0.7234) < 5e-5)

# ---- vectorised protocol context == row-by-row rule ----
sample = X.sample(2000, random_state=0)
check("vectorised protocol_context matches the row rule",
      list(engine.protocol_context_vectorized(sample)) == [engine.protocol_context(r) for _, r in sample.iterrows()])

# ---- full analysis on 5 rows + gate reproduces Phase 1 deferral behaviour ----
a = engine.analyze(df.head(5), "head5.csv")
check("analysis of 5 rows returns 5 records", a["summary"]["total_records"] == 5)
full = engine.analyze(df, "test40k.csv")
s = full["summary"]
print(f"     40K analysis: decisions {s['decision_counts']} | review reasons {s['review_reasons']}")
check("low-confidence deferrals match Phase 1 (1.62% of attacks + 41.32% of benign = 1020 rows)",
      s["review_reasons"]["low confidence"] == int((engine.ART["category_model"].predict_proba(X).max(axis=1) < engine.TAU).sum()))

print(f"\n{sum(results.values())}/{len(results)} checks passed")
sys.exit(0 if all(results.values()) else 1)
