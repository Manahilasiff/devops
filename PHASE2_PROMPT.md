# Phase 2 Prompt: AI-Based Network Intrusion Detection and Security Recommendation Web App (Lean Version)

Act as a senior full-stack developer and ML engineer. Build a **local, functional** web application on top of my completed Phase 1 ML project (CIC-IoT-2023). Keep it simple, clean and beginner-friendly: working features over decoration.

## 1. What the app does
A user uploads a network-traffic CSV. The app:
1. checks that the file has the 40 required feature columns;
2. runs the **real saved Phase 1 models**: binary (Benign vs Attack) and 8-class (attack category);
3. applies the **confidence-gated recommendation engine** from Phase 1: confidence, evidence, MITRE ATT&CK references, and "Analyst review" when uncertain;
4. saves the analysis so it can be reopened from History.

This is CSV-based analysis, **not** live network monitoring.

## 2. Phase 1 artefacts to use (do not retrain, do not invent results)
All files are in `phase1_outputs/` next to this file:

| File | Contents | Used for |
|---|---|---|
| `models/binary_random_forest.joblib` | RandomForestClassifier, predicts 0 = Benign, 1 = Attack | binary prediction (best binary model, macro-F1 0.960) |
| `models/multiclass_histgradientboosting.joblib` | HistGradientBoostingClassifier, predicts **integer** class ids | 8-class prediction + engine confidence (best 8-class model, macro-F1 0.723) |
| `models/preprocessing.joblib` | dict: `features` (40 names, in order), `train_medians`, `class_names`, `label_encoder` | input validation, cleaning, id → label mapping |
| `novelty/engine_config.joblib` | dict: `engine_model_name`, `tau` (= 0.75), `target_risk`, `evidence_features`, `benign_median`, `benign_std`, `class_names` | confidence gate + evidence |
| `novelty/recommendation_mapping.json` | `playbooks` (7 attack categories), `special` (NO_ACTION, UNCERTAIN, UNSUPPORTED), `flood_protocol_subplaybooks`, `disclaimer` | recommendations + ATT&CK references |
| `results/model_comparison_binary.csv`, `results/model_comparison_multiclass.csv` | Phase 1 test metrics for all 7 models | static "Model information" card |

Only these 2 models are loaded by the app. The other 12 model files stay as Phase 1 evidence.

**Compatibility:** the models were saved with **scikit-learn 1.6.0** on Python 3.12. Pin `scikit-learn==1.6.*` in `backend/requirements.txt` so they load correctly.

If any of these files is missing or fails to load, stop and tell me exactly which one and why. Never fall back to dummy or random predictions.

## 3. Preprocessing (must match Phase 1 exactly)
1. Read the CSV with pandas. Extra columns (e.g., `attack_class`, `label`) are allowed and ignored.
2. If any of the 40 `features` is missing → reject with a clear message listing the missing columns.
3. Select the 40 features **in the saved order**, convert to numeric, replace ±inf with NaN, fill NaN with `train_medians`.
4. Reject an empty file or non-CSV upload with a clear error.

## 4. Recommendation engine (port from the notebook, do not simplify)
The logic is in notebook Section 12.3 (`230920_Devops_Phase1.ipynb`). Move these functions into `backend/engine.py`, reading all data from the saved files above:
- `protocol_context(x)`: picks the flood sub-playbook from the row's own `Protocol Type`, `ICMP`, `UDP`, `HTTP`, `HTTPS`, `TCP`, `syn_flag_number` values.
- `evidence(x, k=3)`: z = (x − benign_median) / (benign_std + 1e-9) over `evidence_features`; returns the top-3 by |z| with value, benign median, deviation and direction.
- `build_advisory(pred_label, confidence, top2, x, tau)`: returns `{model_prediction: {...}, advisory: {...}}` with these rules:
  - confidence < τ → `UNCERTAIN_REVIEW` (UNCERTAIN playbook, top-2 candidates shown);
  - predicted Benign → `NO_ACTION`;
  - predicted category in `playbooks` → `CATEGORY_PLAYBOOK`, plus the protocol sub-playbook actions when the playbook family is `Flood`;
  - otherwise → `UNSUPPORTED_CATEGORY`.
- **Extra rule for the web app:** if the binary RF and the 8-class HGB disagree (RF says Attack but HGB says Benign, or the reverse), set the decision to `UNCERTAIN_REVIEW`.
- Always show the disclaimer: the system is advisory and does **not** block traffic.

Write a small test script (`backend/test_engine.py`) that loads the real models and checks the same rules as the Phase 1 unit tests (notebook Section 13.1), plus one prediction on a few rows of `csv files/CIC_IoT_2023_test_40K.csv`.

## 5. Backend: FastAPI (about 3 files)
```
backend/
  main.py          # API routes, CORS for the Vite dev server
  engine.py        # load artefacts once at startup, preprocessing, predictions, recommendations
  storage.py       # save/load analyses as JSON files in backend/analyses/
  test_engine.py
  requirements.txt # fastapi, uvicorn, python-multipart, pandas, numpy, scikit-learn==1.6.*, joblib
```
Endpoints:
- `GET /api/health`: status plus whether all artefacts loaded.
- `POST /api/analyze` (multipart CSV upload): validates, predicts, builds recommendations, saves, returns the analysis JSON.
- `GET /api/history`: list of saved analyses (id, filename, date/time, record count, benign/malicious counts, status).
- `GET /api/analysis/{id}`: one saved analysis.

Analysis JSON (keep it small even for 40K-row files):
- summary: total records, benign/attack counts (binary), counts per 8-class category, number of rows deferred to analyst review, mean confidence;
- **one recommendation card per detected attack category**: count, playbook title, ATT&CK techniques, actions with mitigation IDs, protocol contexts seen (for floods), and evidence from one example row;
- uncertain rows: the first 200 rows sent to analyst review (row number, top-2 candidates, confidence, evidence);
- sample predictions: the first 100 rows (row number, binary result, category, confidence, decision).

Use proper HTTP errors (400 for invalid files or missing columns, 404 for an unknown analysis id, 500 with a readable message if a model fails).

## 6. Frontend: React + Vite + Tailwind + Recharts + Lucide (4 pages)
Dark navy/black theme with subtle pink-purple accents, rounded cards, clean typography. Desktop/laptop layout. No light-mode toggle, notifications or settings page.

1. **Dashboard**: number cards (total analysed records, benign, malicious, rows sent to analyst review, most frequent attack category) plus 2 charts: Benign vs Malicious, and attack-category distribution. All values are computed from saved analyses (`/api/history`). Show an empty state when there is no history. Include a static "Model information" card with the Phase 1 metrics of the two models used.
2. **Analyze**: CSV upload (drag and drop or file picker), filename and record count, "Analyse" button, loading state, clear validation errors. After analysis, on the same page: summary cards, category chart, recommendation cards (category, confidence, evidence, ATT&CK references, actions, disclaimer), an "Analyst review" table for uncertain rows, and the sample-predictions table.
3. **History**: table of past analyses; clicking a row opens that analysis in the same results view.
4. **Report**: a clean, printable view of one analysis (summary, category distribution, confidence information, recommendations, ATT&CK references) with a **"Print / Save as PDF"** button that uses the browser's print dialog (`window.print()` + print CSS). No server-side PDF.

Folder layout: `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/api.js`.

## 7. Rules
1. Inspect the Phase 1 artefacts first and confirm their contents before writing app code.
2. Do not retrain models or change any Phase 1 file or result.
3. No dummy predictions and no made-up dashboard numbers.
4. Keep frontend and backend separate; communicate via REST/JSON.
5. Test locally end to end with `csv files/CIC_IoT_2023_test_40K.csv` (and a small sample of it), plus a CSV with a missing column to check the error message.
6. Write a short `README.md` explaining how to start the backend (`uvicorn`) and frontend (`npm run dev`) separately.

## 8. Out of scope
Docker, CI/CD, GitHub Actions/Pages, cloud deployment, live packet capture, user accounts, settings page, notifications, theme toggle, server-side PDF generation, a database server.

## 9. Start here
First inspect the Phase 1 artefacts and propose the integration plan (how preprocessing, the 2 models and the engine connect, and the analysis JSON shape). Only then build the backend, test it, and build the frontend.
