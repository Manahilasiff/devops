# AI-Based Network Intrusion Detection and Security Recommendation System

[![CI](https://github.com/Manahilasiff/devops/actions/workflows/ci.yml/badge.svg)](https://github.com/Manahilasiff/devops/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Manahilasiff/devops/actions/workflows/deploy.yml/badge.svg)](https://github.com/Manahilasiff/devops/actions/workflows/deploy.yml)

**Live frontend:** https://manahilasiff.github.io/devops/

| Phase | What | Where |
|---|---|---|
| 1 | Machine learning on CIC-IoT-2023, paper reproduction, confidence-gated recommendation engine | `230920_Devops_Phase1.ipynb`, `phase1_outputs/` |
| 2 | FastAPI backend + React frontend that use the Phase 1 models | `backend/`, `frontend/` |
| 3 | GitHub Actions CI, automatic deployment of the frontend to GitHub Pages | `.github/workflows/` |

## Phase 2 – web app

A local web app that runs the **Phase 1 models** on a CIC-IoT-2023 CSV and shows the predictions together with the
**confidence-gated recommendation engine** (the Phase 1 novelty).

- **Backend:** FastAPI (Python). It loads the two saved Phase 1 models; nothing is retrained.
- **Frontend:** React + Vite + Tailwind + Recharts. It has 4 pages: Dashboard, Analyze, History and Report.
- **Storage:** every analysis is saved as one JSON file in `backend/analyses/`. There is no database.

## What it uses from Phase 1 (read-only)

| File in `phase1_outputs/` | Used for |
|---|---|
| `models/binary_random_forest.joblib` | Benign vs Attack (test accuracy 99.63%) |
| `models/multiclass_histgradientboosting.joblib` | 8 categories (test macro-F1 0.7234) |
| `models/preprocessing.joblib` | 40 feature names, training medians for missing values, class names |
| `novelty/engine_config.joblib` | τ = 0.75, evidence features, benign profile |
| `novelty/recommendation_mapping.json` | Playbooks, MITRE ATT&CK techniques and mitigations |
| `results/model_comparison_*.csv` | Model metrics shown on the Dashboard |

### Engine rules

These are the same rules as the Phase 1 notebook, plus one web-app rule:

1. Category confidence < τ (0.75) → **Analyst review**
2. The binary model and the category model disagree (one says benign, the other says attack) → **Analyst review** (new rule)
3. Predicted Benign → **No action**
4. Known attack category → **Category playbook**. Flood categories (DDoS, DoS, Mirai) also get a protocol sub-playbook.
5. Otherwise → **Unsupported category**

## Requirements

- Python 3.12 with **scikit-learn 1.6.0**, the version the models were saved with (pinned in `backend/requirements.txt`).
- Node.js 18 or newer.

## Run it (two terminals)

**Terminal 1 – backend** (from the project folder):

```bash
pip install -r backend/requirements.txt
```

```bash
python -m uvicorn main:app --app-dir backend --port 8000
```

Wait until the terminal shows `Application startup complete`, because loading the models takes a few seconds. You can then
check http://localhost:8000/api/health.

**Terminal 2 – frontend:**

```bash
cd frontend
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The frontend forwards every `/api/...` request to port 8000 (see `frontend/vite.config.js`).

On Windows PowerShell, if `npm` is blocked by the script policy, use `npm.cmd install` and `npm.cmd run dev` instead.

## Using it

1. **Analyze:** drag a CSV in (or click to choose one), check the record count, then press **Analyse**. The results appear
   on the same page.
2. **Dashboard:** shows totals across all saved analyses, the Benign vs Malicious split, the category chart, recent files
   and the Phase 1 model metrics. It shows an empty state until you analyse a file.
3. **History:** lists every analysed file. Click a row to open the full result.
4. **Report:** pick an analysis and press **Print / Save as PDF**. The browser's print dialog creates the PDF.

The CSV must contain the 40 feature columns used in Phase 1. Extra columns such as `label` or `attack_class` are ignored.
Missing or non-numeric values are filled with the training medians, and the result says how many were filled.

Test files:

- `csv files/CIC_IoT_2023_test_40K.csv`: the Phase 1 held-out test set.
- `backend/test_data/sample_small.csv`: its first 200 rows.
- `backend/test_data/sample_missing_columns.csv`: has `Rate` and `IAT` removed, to show the error message.

To clear the history, delete the `.json` files in `backend/analyses/`.

## Tests

```bash
python backend/test_engine.py
```

This runs 16 checks:

- the Phase 1 engine rules and the disagreement rule
- rejection of a CSV with missing columns
- RF accuracy and HGB macro-F1 on the 40K test set, which must equal the Phase 1 values
- a full 40K analysis

## Results on the 40K test set (from the app)

| | Count |
|---|---|
| Category playbook | 38,420 (96.0%) |
| No action (benign) | 547 |
| Analyst review | 1,033 (1,020 low confidence, 13 model disagreement) |
| Unsupported | 0 |

The analysis takes about 2.5 seconds on this laptop.

**Note on confidence values:** the HistGradientBoosting model's top probability rarely goes above about 0.945 (92% of
test rows are between 0.94 and 0.965). That is why many rows show 94.5%. It is the model's real output, not a display
default.

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | Whether the models loaded, the model metrics and the required features |
| POST | `/api/analyze` | Upload a CSV (form field `file`, at most 100 MB). Returns the analysis and saves it. |
| GET | `/api/history` | One short summary per saved analysis, newest first |
| GET | `/api/analysis/{id}` | One full saved analysis |

Errors return a JSON `detail` message: 400 for a wrong file type, an empty file or missing columns; 404 for an unknown
ID; 500 if the models cannot be loaded.

## Project layout

```
backend/
  main.py            FastAPI routes
  engine.py          loads Phase 1 files, preprocessing, predictions, recommendation engine
  storage.py         saves and loads analyses as JSON files
  test_engine.py     checks against Phase 1 results
  requirements.txt
  analyses/          saved analyses (created automatically)
  test_data/         small sample CSVs
frontend/
  src/App.jsx        sidebar and page switching
  src/api.js         calls to the backend
  src/pages/         Dashboard, Analyze, History, AnalysisPage, Report
  src/components/    charts, recommendation card, result view, small UI pieces
```

## Phase 3 – CI/CD and GitHub Pages

```
code change → git commit & push → CI (build + tests) → CD (deploy) → updated GitHub Pages site
```

### CI – `.github/workflows/ci.yml`

Runs on every push to `main`, every pull request to `main`, and manually from the Actions tab. Two jobs run in parallel:

| Job | Steps |
|---|---|
| Frontend build | checkout → Node 22 → `npm ci` → `npm run build` (there is no lint/test script, so the production build is the check) |
| Backend validation | checkout → Python 3.12 → `pip install -r backend/requirements.txt` → import the FastAPI app and load the Phase 1 models → `python backend/test_engine.py` (16 checks, including RF accuracy and HGB macro-F1 on the 40K test set equal to Phase 1) |

### CD – `.github/workflows/deploy.yml`

Starts automatically when CI **succeeds** for a push to `main` (a failed CI means nothing is deployed). It builds the
frontend in production mode with the base path `/devops/`, uploads `frontend/dist` with `actions/upload-pages-artifact`
and publishes it with `actions/deploy-pages`. It does not repeat the CI tests.

The app uses hash URLs (`#/history`, `#/report/<id>`), so page links and refreshes work on GitHub Pages without a 404
fallback page.

### One-time GitHub setting

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Without this, the deploy job fails.

### The backend is not on GitHub Pages

GitHub Pages only serves static files; it cannot run Python. The live site is the frontend only. It calls
`http://localhost:8000`, so to analyse files from the live site, start the backend on your own computer (see "Run it"
above). The backend allows requests from `https://manahilasiff.github.io`. Without a running backend the pages show a
"Cannot reach the backend" message. Hosting the backend online (for example on a Python hosting service) would be a
separate deployment task.

### Lab demonstration

1. In VS Code, open `frontend/src/App.jsx` and change the sidebar subtitle, for example `CIC-IoT-2023` →
   `CIC-IoT-2023 · CI/CD demo`.
2. Commit and push:

   ```bash
   git add frontend/src/App.jsx
   ```

   ```bash
   git commit -m "Update sidebar subtitle for CI/CD demo"
   ```

   ```bash
   git push origin main
   ```

3. GitHub → **Actions**: the **CI** run starts; when both jobs are green, **Deploy to GitHub Pages** starts on its own.
4. When the deploy finishes, open https://manahilasiff.github.io/devops/ (refresh with Ctrl+F5) and the new subtitle
   is visible.

## Out of scope

Not part of this project: Docker, backend cloud hosting, live packet capture, user accounts and a database server.
Recommendations are decision support for a security analyst, not automatic enforcement.
