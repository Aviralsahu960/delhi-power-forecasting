import os
import joblib
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from data_ingest import load_real_data, get_forecast_weather
from alerts import check_alert

app = FastAPI(
    title="Delhi Electricity Demand Forecasting API",
    description="Predicts next-day/next-week electricity demand using weather + historical load data.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model loading ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")

model = None
feature_cols = ["temperature", "hour", "dayofweek", "is_weekend", "month", "load_lag24"]

if os.path.exists(MODEL_PATH):
    payload = joblib.load(MODEL_PATH)
    if isinstance(payload, dict):
        model = payload.get("model")
        feature_cols = payload.get("feature_cols", feature_cols)
        mae = payload.get("mae", "N/A")
        rmse = payload.get("rmse", "N/A")
        print(f"[main] Model loaded. MAE={mae:.2f} MW, RMSE={rmse:.2f} MW")
    else:
        model = payload
        print("[main] Model loaded (raw format).")
else:
    print(f"[main] WARNING: model.pkl not found at {MODEL_PATH}. Run train_model.py first.")

# ── Cache historical data in memory ──
_df_cache = None

def get_cached_data() -> pd.DataFrame:
    global _df_cache
    if _df_cache is None:
        _df_cache = load_real_data()
    return _df_cache


# ── Routes ──

@app.get("/")
def root():
    return {
        "status": "live",
        "message": "Delhi Electricity Demand Forecasting API",
        "docs": "/docs",
        "model_loaded": model is not None,
    }


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/historical")
def historical(hours: int = 168):
    """
    Returns last `hours` of actual historical load data (default 168 = 7 days).
    Format: [{"timestamp": str, "actual_load_MW": float}]
    """
    df = get_cached_data()
    recent = df.tail(hours)
    return [
        {"timestamp": str(row["timestamp"]), "actual_load_MW": round(float(row["load_MW"]), 2)}
        for _, row in recent.iterrows()
    ]


@app.get("/predict")
def predict(days: int = 7):
    """
    Returns hourly predicted load for next `days` days (max 7).
    Format: [{"timestamp": str, "predicted_load_MW": float, "alert_status": str}]
    """
    if model is None:
        raise HTTPException(
            status_code=500,
            detail="Model not loaded. Run train_model.py inside the backend folder first."
        )

    days = min(days, 7)
    forecast_df = get_forecast_weather(days=days)
    hist_df = get_cached_data()

    # Build rolling lag buffer from last 24 hours of historical data
    lag_buffer = hist_df["load_MW"].tail(24).tolist()

    # Add time features to forecast
    forecast_df["hour"] = forecast_df["time"].dt.hour
    forecast_df["dayofweek"] = forecast_df["time"].dt.dayofweek
    forecast_df["is_weekend"] = (forecast_df["dayofweek"] >= 5).astype(int)
    forecast_df["month"] = forecast_df["time"].dt.month

    results = []
    for i in range(len(forecast_df)):
        row = forecast_df.iloc[i]
        lag24 = lag_buffer[-24] if len(lag_buffer) >= 24 else lag_buffer[0]

        features = {
            "temperature": float(row["temp_C"]),
            "hour": int(row["hour"]),
            "dayofweek": int(row["dayofweek"]),
            "is_weekend": int(row["is_weekend"]),
            "month": int(row["month"]),
            "load_lag24": float(lag24),
        }

        X = pd.DataFrame([features])[feature_cols]
        pred = float(model.predict(X)[0])
        lag_buffer.append(pred)

        results.append({
            "timestamp": str(row["time"]),
            "predicted_load_MW": round(pred, 2),
            "alert_status": check_alert(pred),
        })

    return results


@app.get("/current-weather")
def current_weather():
    """
    Returns live Delhi temperature and humidity from Open-Meteo (no API key needed).
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "current_weather": "true",
        "hourly": "relative_humidity_2m",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        current = data.get("current_weather", {})
        temp = float(current.get("temperature", 0.0))
        humidity_list = data.get("hourly", {}).get("relative_humidity_2m", [50.0])
        humidity = float(humidity_list[0]) if humidity_list else 50.0
        return {"temperature": temp, "humidity": humidity, "source": "open-meteo.com"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Weather API error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
