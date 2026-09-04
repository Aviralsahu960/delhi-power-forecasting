import os
import pandas as pd
import requests

# ── Resolve dataset path relative to this file, works on any OS ──
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_DATASET_DIR = os.path.abspath(os.path.join(_BACKEND_DIR, "..", "dataset", "archive"))
_PRIMARY_CSV = os.path.join(_DATASET_DIR, "24-hours Delhi Power Consumption dataset.csv")
_FALLBACK_CSV = os.path.join(_DATASET_DIR, "hourly data(2000-2023).csv")


def load_real_data(csv_path: str = None) -> pd.DataFrame:
    """
    Load Delhi hourly power consumption data.
    Uses 24-hours Delhi Power Consumption dataset by default.
    Falls back to hourly data(2000-2023).csv if primary not found.
    Returns cleaned DataFrame with columns: timestamp, load_MW, temperature,
    hour, dayofweek, is_weekend, month.
    """
    # Resolve path
    if csv_path is None:
        path = _PRIMARY_CSV if os.path.exists(_PRIMARY_CSV) else _FALLBACK_CSV
    else:
        path = csv_path if os.path.exists(csv_path) else _PRIMARY_CSV

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Dataset not found at: {path}\n"
            f"Expected location: {_DATASET_DIR}\n"
            "Place '24-hours Delhi Power Consumption dataset.csv' in dataset/archive/"
        )

    df = pd.read_csv(path)

    # ── Normalize timestamp column ──
    for col in ["timestamp", "datetime", "date", "time"]:
        if col in df.columns:
            df["timestamp"] = pd.to_datetime(df[col])
            break

    # ── Normalize load column to load_MW ──
    for col in ["load", "electricity_demand", "load_MW", "demand", "Load"]:
        if col in df.columns:
            df["load_MW"] = pd.to_numeric(df[col], errors="coerce")
            break

    # ── Normalize temperature column ──
    for col in ["temperature", "temp_C", "temp"]:
        if col in df.columns:
            df["temperature"] = pd.to_numeric(df[col], errors="coerce")
            break

    # Drop rows with missing load
    df = df.dropna(subset=["load_MW", "timestamp"]).reset_index(drop=True)
    df = df.sort_values("timestamp").reset_index(drop=True)

    # ── Time features ──
    df["hour"] = df["timestamp"].dt.hour
    df["dayofweek"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)
    df["month"] = df["timestamp"].dt.month

    print(f"[data_ingest] Loaded {len(df)} rows from: {os.path.basename(path)}")
    print(f"[data_ingest] load_MW range: {df['load_MW'].min():.0f} – {df['load_MW'].max():.0f} MW")
    print(f"[data_ingest] Date range: {df['timestamp'].min()} → {df['timestamp'].max()}")
    return df


def get_forecast_weather(lat: float = 28.6139, lon: float = 77.2090, days: int = 7) -> pd.DataFrame:
    """
    Fetch next `days` days of hourly weather from Open-Meteo (free, no key).
    Returns DataFrame with columns: time, temp_C, humidity.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m",
        "forecast_days": days,
        "timezone": "Asia/Kolkata",
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    df = pd.DataFrame(data["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    df = df.rename(columns={"temperature_2m": "temp_C", "relative_humidity_2m": "humidity"})
    return df[["time", "temp_C", "humidity"]]


def get_historical_weather(lat: float = 28.6139, lon: float = 77.2090,
                           start_date: str = "2023-01-01", end_date: str = "2023-12-31") -> pd.DataFrame:
    """
    Fetch historical hourly weather from Open-Meteo archive (free, no key).
    Returns DataFrame with columns: time, temp_C, humidity.
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,relative_humidity_2m",
        "timezone": "Asia/Kolkata",
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    df = pd.DataFrame(data["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    df = df.rename(columns={"temperature_2m": "temp_C", "relative_humidity_2m": "humidity"})
    return df[["time", "temp_C", "humidity"]]


# Backward compatibility
load_kaggle_data = load_real_data
load_dataset = load_real_data


if __name__ == "__main__":
    print("=== Testing load_real_data ===")
    df = load_real_data()
    print(df[["timestamp", "load_MW", "temperature"]].head())

    print("\n=== Testing get_forecast_weather ===")
    wf = get_forecast_weather(days=2)
    print(wf.head())
