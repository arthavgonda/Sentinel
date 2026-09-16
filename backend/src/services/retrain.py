import json
import sys

def main():
    try:
        payload = json.load(sys.stdin)
        rows = payload["rows"]
        object_type = payload["object_type"]
        jw_high_thresh = payload.get("jw_high_thresh", 0.92)
        jw_med_thresh = payload.get("jw_med_thresh", 0.78)
    except Exception as e:
        json.dump({"error": f"Invalid input: {e}"}, sys.stdout)
        sys.exit(1)

    try:
        import numpy as np
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import StratifiedShuffleSplit
        from sklearn.metrics import precision_score, recall_score, f1_score
    except ImportError as e:
        json.dump({"error": f"Missing dependency: {e}. Run: pip install scikit-learn numpy"}, sys.stdout)
        sys.exit(1)

    if object_type == "Person":
        feature_keys = ["jaro_winkler", "soundex_match", "exact_phone", "partial_phone", "same_city", "alias_match"]
        def extract(row):
            return [
                float(row.get("jaro_winkler", 0)),
                float(row.get("soundex_match", 0)),
                float(row.get("exact_phone", 0)),
                float(row.get("partial_phone", 0)),
                float(row.get("same_city", 0)),
                float(row.get("alias_match", 0)),
            ]
    elif object_type == "Organization":
        feature_keys = ["org_jw_high", "org_jw_med", "org_same_address", "org_reg_id"]
        def extract(row):
            jw = float(row.get("jaro_winkler", 0))
            return [
                1.0 if jw >= jw_high_thresh else 0.0,
                1.0 if jw_med_thresh <= jw < jw_high_thresh else 0.0,
                float(row.get("org_same_address", 0)),
                float(row.get("org_reg_id", 0)),
            ]
    else:
        json.dump({"error": f"Unsupported object_type: {object_type}"}, sys.stdout)
        sys.exit(1)

    try:
        X = np.array([extract(r) for r in rows])
        y = np.array([int(r["label"]) for r in rows])
    except Exception as e:
        json.dump({"error": f"Feature extraction failed: {e}"}, sys.stdout)
        sys.exit(1)

    n_pos = int(y.sum())
    n_neg = int(len(y) - n_pos)
    if n_pos < 5 or n_neg < 5:
        json.dump({"error": f"Need at least 5 examples of each class. Got {n_pos} merged, {n_neg} rejected."}, sys.stdout)
        sys.exit(1)

    sss = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(sss.split(X, y))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    clf = LogisticRegression(C=1.0, class_weight="balanced", max_iter=500, solver="liblinear")
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))

    coefs = {feature_keys[i]: float(clf.coef_[0][i]) for i in range(len(feature_keys))}

    result = {
        "use_logistic": True,
        "intercept": float(clf.intercept_[0]),
        "coefs": coefs,
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    json.dump(result, sys.stdout)

if __name__ == "__main__":
    main()
