"""
ML + recommendation engine for the web app.

Everything here comes from the saved Phase 1 artefacts in ../phase1_outputs:
  * models/binary_random_forest.joblib            -> Benign (0) / Attack (1)
  * models/multiclass_histgradientboosting.joblib -> 8 attack categories (integer ids)
  * models/preprocessing.joblib                   -> feature order, training medians, class names
  * novelty/engine_config.joblib                  -> confidence threshold tau, evidence features, benign profile
  * novelty/recommendation_mapping.json           -> playbooks, special cases, flood sub-playbooks, disclaimer

The recommendation logic (protocol_context, evidence, build_advisory) is ported from notebook
Section 12.3 of 230920_Devops_Phase1.ipynb. Nothing is retrained and no result is invented.
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 2))  # silences a joblib warning on Windows

import joblib
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PHASE1 = PROJECT_ROOT / "phase1_outputs"
ARTIFACT_FILES = {
    "binary_model": PHASE1 / "models" / "binary_random_forest.joblib",
    "category_model": PHASE1 / "models" / "multiclass_histgradientboosting.joblib",
    "preprocessing": PHASE1 / "models" / "preprocessing.joblib",
    "engine_config": PHASE1 / "novelty" / "engine_config.joblib",
    "recommendation_mapping": PHASE1 / "novelty" / "recommendation_mapping.json",
    "metrics_binary": PHASE1 / "results" / "model_comparison_binary.csv",
    "metrics_multiclass": PHASE1 / "results" / "model_comparison_multiclass.csv",
}
MAX_REVIEW_ROWS = 200      # uncertain rows returned in one analysis
MAX_SAMPLE_ROWS = 100      # sample predictions returned in one analysis


class ArtifactError(RuntimeError):
    """A Phase 1 file is missing or cannot be loaded."""


class ValidationError(ValueError):
    """The uploaded CSV cannot be analysed (missing columns, empty file, ...)."""


# --------------------------------------------------------------------------------------
# 1. Load the Phase 1 artefacts once
# --------------------------------------------------------------------------------------
def _load_artifacts():
    missing = [f"{name}: {path}" for name, path in ARTIFACT_FILES.items() if not path.exists()]
    if missing:
        raise ArtifactError("Missing Phase 1 file(s): " + "; ".join(missing))
    try:
        art = {
            "binary_model": joblib.load(ARTIFACT_FILES["binary_model"]),
            "category_model": joblib.load(ARTIFACT_FILES["category_model"]),
            "preprocessing": joblib.load(ARTIFACT_FILES["preprocessing"]),
            "engine_config": joblib.load(ARTIFACT_FILES["engine_config"]),
            "mapping": json.loads(ARTIFACT_FILES["recommendation_mapping"].read_text(encoding="utf-8")),
            "metrics_binary": pd.read_csv(ARTIFACT_FILES["metrics_binary"], index_col=0),
            "metrics_multiclass": pd.read_csv(ARTIFACT_FILES["metrics_multiclass"], index_col=0),
        }
    except Exception as exc:  # e.g. incompatible scikit-learn version
        raise ArtifactError(f"Could not load a Phase 1 file ({type(exc).__name__}: {exc}). "
                            "The models were saved with scikit-learn 1.6.0; install scikit-learn==1.6.*") from exc
    feats = art["preprocessing"]["features"]
    if list(art["binary_model"].feature_names_in_) != feats or list(art["category_model"].feature_names_in_) != feats:
        raise ArtifactError("Feature order of the saved models does not match preprocessing.joblib")
    if art["engine_config"]["class_names"] != art["preprocessing"]["class_names"]:
        raise ArtifactError("Class names in engine_config.joblib and preprocessing.joblib differ")
    return art


try:
    ART = _load_artifacts()
    LOAD_ERROR = None
except ArtifactError as _exc:
    ART, LOAD_ERROR = None, str(_exc)

if ART is not None:
    FEATURES = ART["preprocessing"]["features"]
    TRAIN_MEDIANS = ART["preprocessing"]["train_medians"]
    CLASS_NAMES = ART["preprocessing"]["class_names"]
    CFG = ART["engine_config"]
    TAU = float(CFG["tau"])
    EVIDENCE_FEATURES = CFG["evidence_features"]
    BENIGN_MEDIAN, BENIGN_STD = CFG["benign_median"], CFG["benign_std"]
    MAPPING = ART["mapping"]
    PLAYBOOKS = MAPPING["playbooks"]
    NO_ACTION, TRIAGE, UNSUPPORTED = (MAPPING["special"][k] for k in ("NO_ACTION", "UNCERTAIN", "UNSUPPORTED"))
    SUBTYPE_ACTIONS = MAPPING["flood_protocol_subplaybooks"]
    DISCLAIMER = MAPPING["disclaimer"]


def require_artifacts():
    if ART is None:
        raise ArtifactError(LOAD_ERROR)


# --------------------------------------------------------------------------------------
# 2. Recommendation engine (ported from the notebook, Section 12.3)
# --------------------------------------------------------------------------------------
def protocol_context(x):
    """Read the window's own protocol indicators (window averages in [0,1]) to choose a flood sub-playbook."""
    if x["Protocol Type"] >= 40: return "GRE-encapsulated flood"
    if x["ICMP"] >= 0.5: return "ICMP flood"
    if x["UDP"] >= 0.5: return "UDP flood"
    if x["HTTP"] >= 0.5 or x["HTTPS"] >= 0.5: return "HTTP/application-layer flood"
    if x["TCP"] >= 0.5 and x["syn_flag_number"] >= 0.5: return "TCP SYN flood"
    if x["TCP"] >= 0.5: return "TCP flag/connection flood"
    return "Unclassified volumetric traffic"


def protocol_context_vectorized(X):
    """Same rules as protocol_context, applied to a whole DataFrame at once (fast for large files)."""
    conds = [X["Protocol Type"] >= 40, X["ICMP"] >= 0.5, X["UDP"] >= 0.5, (X["HTTP"] >= 0.5) | (X["HTTPS"] >= 0.5),
             (X["TCP"] >= 0.5) & (X["syn_flag_number"] >= 0.5), X["TCP"] >= 0.5]
    names = ["GRE-encapsulated flood", "ICMP flood", "UDP flood", "HTTP/application-layer flood",
             "TCP SYN flood", "TCP flag/connection flood"]
    return np.select(conds, names, default="Unclassified volumetric traffic")


def evidence(x, k=3):
    """Top-k features that deviate most from the benign training baseline (IAT is excluded in Phase 1)."""
    z = (x[EVIDENCE_FEATURES] - BENIGN_MEDIAN) / (BENIGN_STD + 1e-9)
    top = z.abs().sort_values(ascending=False).head(k).index
    return [{"feature": f, "value": round(float(x[f]), 4), "benign_median": round(float(BENIGN_MEDIAN[f]), 4),
             "deviation_benign_sd": round(float(z[f]), 2),
             "direction": "higher than benign" if z[f] > 0 else "lower than benign"} for f in top]


def build_advisory(pred_label, confidence, top2, x, tau=None, binary_pred=None, model_name="HistGradientBoosting"):
    """Turn ONE model prediction into a structured record: model output and advisory are kept separate.

    Phase 1 rules: confidence < tau -> UNCERTAIN_REVIEW; Benign -> NO_ACTION; known category -> CATEGORY_PLAYBOOK
    (+ protocol sub-playbook for floods); unknown label -> UNSUPPORTED_CATEGORY.
    Web-app rule: if the binary model disagrees with the category model -> UNCERTAIN_REVIEW.
    """
    tau = TAU if tau is None else tau
    disagree = binary_pred is not None and (int(binary_pred) == 1) != (pred_label != "Benign")
    record = {"model_prediction": {"model": model_name, "predicted_class": pred_label, "confidence": round(float(confidence), 4),
                                   "top2_candidates": top2, "threshold_tau": tau,
                                   "binary_model": None if binary_pred is None else ("Attack" if int(binary_pred) == 1 else "Benign")},
              "advisory": {}}
    review_reason = None
    if confidence < tau:
        decision, pb, review_reason = "UNCERTAIN_REVIEW", TRIAGE, "low confidence"
    elif disagree:
        decision, pb, review_reason = "UNCERTAIN_REVIEW", TRIAGE, "binary and category models disagree"
    elif pred_label == "Benign":
        decision, pb = "NO_ACTION", NO_ACTION
    elif pred_label in PLAYBOOKS:
        decision, pb = "CATEGORY_PLAYBOOK", PLAYBOOKS[pred_label]
    else:
        decision, pb = "UNSUPPORTED_CATEGORY", UNSUPPORTED
    adv = {"decision": decision, "review_reason": review_reason, "playbook_id": pb["playbook_id"], "title": pb["title"],
           "attck_techniques": pb["attck_techniques"], "recommendations": list(pb["actions"]),
           "protocol_context": None, "evidence": evidence(x) if decision != "NO_ACTION" else [], "disclaimer": DISCLAIMER}
    if decision == "CATEGORY_PLAYBOOK" and pb.get("family") == "Flood":
        ctx = protocol_context(x)
        adv["protocol_context"] = ctx
        adv["recommendations"] = adv["recommendations"] + SUBTYPE_ACTIONS[ctx]
    record["advisory"] = adv
    return record


# --------------------------------------------------------------------------------------
# 3. Preprocessing (identical to the Phase 1 notebook)
# --------------------------------------------------------------------------------------
def preprocess(df):
    """Validate columns and return (X, n_filled): the 40 features in saved order, cleaned like Phase 1."""
    require_artifacts()
    if df is None or len(df) == 0:
        raise ValidationError("The CSV file contains no data rows.")
    df = df.rename(columns=lambda c: str(c).strip())
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise ValidationError(f"The CSV is missing {len(missing)} of the {len(FEATURES)} required feature columns: "
                              + ", ".join(missing))
    X = df[FEATURES].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    n_filled = int(X.isna().sum().sum())
    X = X.fillna(TRAIN_MEDIANS)
    return X, n_filled


# --------------------------------------------------------------------------------------
# 4. Full analysis of one uploaded file
# --------------------------------------------------------------------------------------
def _f(v, nd=4):
    return round(float(v), nd)


def analyze(df, filename):
    X, n_filled = preprocess(df)
    n = len(X)
    binary_pred = ART["binary_model"].predict(X).astype(int)                 # 0 = Benign, 1 = Attack
    proba = ART["category_model"].predict_proba(X)
    order = np.argsort(-proba, axis=1)
    top1, top2i = order[:, 0], order[:, 1]
    labels = np.array(CLASS_NAMES)[top1]
    conf = proba[np.arange(n), top1]
    conf2 = proba[np.arange(n), top2i]

    # Decisions for every row (same rules as build_advisory, vectorised)
    low_conf = conf < TAU
    disagree = (binary_pred == 1) != (labels != "Benign")
    review = low_conf | disagree
    decision = np.where(review, "UNCERTAIN_REVIEW",
                        np.where(labels == "Benign", "NO_ACTION",
                                 np.where(np.isin(labels, list(PLAYBOOKS)), "CATEGORY_PLAYBOOK", "UNSUPPORTED_CATEGORY")))
    reason = np.where(low_conf, "low confidence", np.where(disagree, "binary and category models disagree", ""))
    contexts = protocol_context_vectorized(X)

    # ---- summary ----
    cat_counts = {c: int((labels == c).sum()) for c in CLASS_NAMES}
    summary = {
        "total_records": n,
        "values_filled_with_training_median": n_filled,
        "binary": {"benign": int((binary_pred == 0).sum()), "attack": int((binary_pred == 1).sum())},
        "category_counts": cat_counts,
        "decision_counts": {d: int((decision == d).sum()) for d in
                            ("CATEGORY_PLAYBOOK", "NO_ACTION", "UNCERTAIN_REVIEW", "UNSUPPORTED_CATEGORY")},
        "review_reasons": {"low confidence": int(low_conf.sum()),
                           "binary and category models disagree": int((disagree & ~low_conf).sum())},
        "mean_confidence": _f(conf.mean()),
        "confident_share": _f((~low_conf).mean()),
        "most_frequent_attack": max((c for c in CLASS_NAMES if c != "Benign"), key=lambda c: cat_counts[c])
        if any(cat_counts[c] for c in CLASS_NAMES if c != "Benign") else None,
    }

    # ---- one recommendation card per detected attack category ----
    cards = []
    for c in CLASS_NAMES:
        if c == "Benign":
            continue
        mask = (labels == c) & (decision == "CATEGORY_PLAYBOOK")
        if not mask.any():
            continue
        idx = np.where(mask)[0]
        example = int(idx[np.argmax(conf[idx])])          # most confident row of this category
        rec = build_advisory(c, conf[example], [[CLASS_NAMES[top1[example]], _f(conf[example])],
                                                [CLASS_NAMES[top2i[example]], _f(conf2[example])]],
                             X.iloc[example], binary_pred=binary_pred[example])
        pb = PLAYBOOKS[c]
        ctx_counts = {}
        if pb.get("family") == "Flood":
            vals, cnts = np.unique(contexts[idx], return_counts=True)
            ctx_counts = {str(v): int(k) for v, k in sorted(zip(vals, cnts), key=lambda t: -t[1])}
        cards.append({
            "category": c, "count": int(mask.sum()), "predicted_total": cat_counts[c],
            "mean_confidence": _f(conf[idx].mean()), "playbook_id": pb["playbook_id"], "title": pb["title"],
            "family": pb.get("family"), "attck_techniques": pb["attck_techniques"], "actions": pb["actions"],
            "protocol_contexts": [{"context": k, "count": v, "actions": SUBTYPE_ACTIONS[k]} for k, v in ctx_counts.items()],
            "example": {"row": example + 1, **rec},
        })
    cards.sort(key=lambda d: -d["count"])

    # ---- rows deferred to an analyst ----
    review_idx = np.where(review)[0][:MAX_REVIEW_ROWS]
    review_rows = [{"row": int(i) + 1, "reason": str(reason[i]),
                    "binary_model": "Attack" if binary_pred[i] else "Benign",
                    "top2_candidates": [[CLASS_NAMES[top1[i]], _f(conf[i])], [CLASS_NAMES[top2i[i]], _f(conf2[i])]],
                    "evidence": evidence(X.iloc[i])} for i in review_idx]

    sample_rows = [{"row": i + 1, "binary_model": "Attack" if binary_pred[i] else "Benign", "category": str(labels[i]),
                    "confidence": _f(conf[i]), "decision": str(decision[i])} for i in range(min(n, MAX_SAMPLE_ROWS))]

    return {
        "id": uuid.uuid4().hex,
        "filename": filename,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "status": "completed",
        "summary": summary,
        "recommendation_cards": cards,
        "review_rows": review_rows,
        "review_rows_truncated": bool(review.sum() > MAX_REVIEW_ROWS),
        "sample_predictions": sample_rows,
        "engine": {"tau": TAU, "binary_model": "Random Forest", "category_model": "HistGradientBoosting",
                   "special_playbooks": {"UNCERTAIN": TRIAGE, "UNSUPPORTED": UNSUPPORTED}, "disclaimer": DISCLAIMER},
    }


# --------------------------------------------------------------------------------------
# 5. Model information (Phase 1 test-set metrics, read from the saved CSVs)
# --------------------------------------------------------------------------------------
def model_info():
    require_artifacts()
    def pick(df, name):
        r = df.loc[name]
        return {k: _f(r[k]) for k in ("accuracy", "macro_f1", "balanced_accuracy", "mcc")}
    return {
        "binary": {"name": "Random Forest", "task": "Benign vs Attack",
                   "file": ARTIFACT_FILES["binary_model"].name, **pick(ART["metrics_binary"], "Random Forest")},
        "category": {"name": "HistGradientBoosting", "task": "8 categories",
                     "file": ARTIFACT_FILES["category_model"].name, **pick(ART["metrics_multiclass"], "HistGradientBoosting")},
        "tau": TAU, "n_features": len(FEATURES), "class_names": CLASS_NAMES,
        "test_set": "CIC-IoT-2023, 40,000 held-out windows (Phase 1)",
    }
