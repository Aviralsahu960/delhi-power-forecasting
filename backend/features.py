import pandas as pd


def build_features(load_df: pd.DataFrame, weather_df: pd.DataFrame = None) -> pd.DataFrame:
    """
    Build model features from load DataFrame.
    Optionally merges external weather_df.
    Returns DataFrame with: timestamp, load_MW, temperature, hour,
    dayofweek, is_weekend, month, load_lag24.
    """
    df = load_df.copy()

    # Ensure timestamp is datetime
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    # Ensure load_MW exists
    if "load_MW" not in df.columns:
        for col in ["load", "electricity_demand", "demand"]:
            if col in df.columns:
                df["load_MW"] = pd.to_numeric(df[col], errors="coerce")
                break

    # Merge weather if provided
    if weather_df is not None:
        w = weather_df.copy()
        time_col = "time" if "time" in w.columns else "timestamp"
        w[time_col] = pd.to_datetime(w[time_col])
        df = pd.merge(df, w, left_on="timestamp", right_on=time_col, how="left")
        if "temp_C" in df.columns and "temperature" not in df.columns:
            df["temperature"] = df["temp_C"]

    # Ensure temperature column exists
    if "temperature" not in df.columns:
        if "temp_C" in df.columns:
            df["temperature"] = df["temp_C"]
        else:
            df["temperature"] = 25.0  # fallback default

    # Time features
    df["hour"] = df["timestamp"].dt.hour
    df["dayofweek"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)
    df["month"] = df["timestamp"].dt.month

    # Lag feature: same hour previous day
    df["load_lag24"] = df["load_MW"].shift(24)

    print(f"[features] Shape before dropna: {df.shape}")
    df = df.dropna(subset=["load_MW", "load_lag24"]).reset_index(drop=True)
    print(f"[features] Shape after dropna:  {df.shape}")

    return df


if __name__ == "__main__":
    from data_ingest import load_real_data
    raw = load_real_data()
    feat = build_features(raw)
    print(feat[["timestamp", "load_MW", "temperature", "load_lag24"]].head())
