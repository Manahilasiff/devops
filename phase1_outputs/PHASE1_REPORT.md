# Phase 1 Progress Report — ML-Based Network Attack Detection (CIC-IoT-2023)

## Deliverables
| Item | Location |
|---|---|
| Updated notebook (16 sections, executed, outputs saved) | `230920_Devops_Phase1.ipynb` |
| Original notebook (unchanged backup) | `230920_Devops (1) - Copy.ipynb` |
| Dataset files (unchanged) | `csv files/` |
| Trained models (14) + preprocessing | `phase1_outputs/models/` |
| Metrics, comparison tables, CIs, sensitivity checks | `phase1_outputs/results/` |
| Figures (11) | `phase1_outputs/figures/` |
| Recommendation mapping, engine config, novelty evaluation, examples | `phase1_outputs/novelty/` |

## Completed
- Audit of the notebook, paper, data, ordering bias, duplicates/leakage, and the `IAT` artefact.
- Existing Random Forest re-run and verified: accuracy 0.9963, CM [[861, 78], [69, 38992]] (exact match).
- Paper algorithms reproduced (LR, Perceptron, AdaBoost, RF, DNN), binary + 8-class.
- Two additional algorithms not in the paper (HistGradientBoosting, KNN), tuned on a validation split only.
- The same untouched 40K test set used for every model. No test-based tuning.
- Full evaluation: accuracy, precision, recall, F1, macro/weighted F1, balanced accuracy, MCC, per-class metrics, confusion matrices, training and prediction time, bootstrap CIs, a de-duplicated test check, and an IAT ablation.
- Novelty: a confidence-gated, evidence-grounded, ATT&CK-referenced recommendation engine, with mapping unit tests, test-set evaluation, and a leave-one-class-out open-set test.
- Literature review and IEEE references (verified sources only).

## Headline results (test set)
**Binary macro-F1:** RF 0.960 · HGB 0.954 · AdaBoost 0.942 · DNN 0.924 · KNN 0.921 · LR 0.870 · Perceptron 0.733.

**8-class macro-F1:** HGB 0.723 · RF 0.718 · DNN 0.694 · KNN 0.659 · AdaBoost 0.582 · LR 0.529 · Perceptron 0.469.

**Novelty:**
- Wrong-category advice on known attacks: 0.502% → 0.031% (−94%).
- Wrong-category advice on unseen attack types: 52.9% → 14.6%.
- Cost: 2.6% of all windows (41% of benign windows) are deferred to an analyst.

## Limitations
- `IAT` acts as a capture-session fingerprint. Without it, 8-class accuracy falls from 0.995 to 0.894, so scores are optimistic for new networks.
- Web-based (18 test windows) and BruteForce (12) are too small for reliable per-class estimates. Web-based is also under-sampled in the training file (55 vs ≈85 expected).
- The 34-class experiment is impossible: fine-grained labels are not in the CSVs. Only 40 of the paper's 46 features are available.
- The paper's hyper-parameters and DNN architecture are unreported, so scikit-learn defaults were used.
- 31.9% of unseen-attack windows are still confidently labelled Benign by the engine. A dedicated out-of-distribution detector is future work.
- The instructor's requirements document was not provided, so it could not be checked.

## End-to-end verification
A fresh *Run all* in VS Code (Python 3.12.6, 15 Nov 2026) completed in one session in about 9 minutes. It regenerated every model, result table, figure and novelty file, and the results are identical to the earlier run (same macro-F1 for all 7 models, same novelty and open-set figures).

## Pending
- Instructor-guide check, once the document is shared.
- Out of scope for Phase 1: frontend, backend, VS Code, GitHub, deployment, Docker.
