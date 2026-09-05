import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

from data_ingest import load_real_data
from features import build_features

FEATURE_COLS = ["temperature", "hour", "dayofweek", "is_weekend", "month", "load_lag24"]
TARGET_COL = "load_MW"
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.pkl")


def train():
    print("=== 1. Loading data ===")
    raw_df = load_real_data()

    print("\n=== 2. Building features ===")
    df = build_features(raw_df)

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    print(f"Feature shape: {X.shape} | Target shape: {y.shape}")

    # Chronological split — never shuffle time-series
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )
    print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")

    print("\n=== 3. Training RandomForestRegressor ===")
    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    print(f"\nMAE  : {mae:.2f} MW")
    print(f"RMSE : {rmse:.2f} MW")

    print("\n=== 4. Saving backtest comparison (predicted vs actual) ===")
    # Auto-detect a timestamp-like column so this doesn't break if it
    # isn't literally named "timestamp".
    ts_col = None
    for candidate in ["timestamp", "datetime", "date", "time"]:
        if candidate in df.columns:
            ts_col = candidate
            break

    if ts_col is not None:
        comparison_df = pd.DataFrame({
            "timestamp": df.loc[X_test.index, ts_col].values,
            "actual_load_MW": y_test.values,
            "predicted_load_MW": y_pred
        })
    else:
        comparison_df = pd.DataFrame({
            "row_index": X_test.index,
            "actual_load_MW": y_test.values,
            "predicted_load_MW": y_pred
        })
        print("WARNING: no timestamp-like column found in df — using row_index instead.")

    comparison_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backtest_comparison.csv")
    comparison_df.to_csv(comparison_path, index=False)
    print(f"Saved: {comparison_path}")

    payload = {
        "model": model,
        "feature_cols": FEATURE_COLS,
        "mae": mae,
        "rmse": rmse,
    }
    joblib.dump(payload, MODEL_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")


if __name__ == "__main__":
    train()
