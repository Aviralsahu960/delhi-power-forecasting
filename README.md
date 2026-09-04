# ⚡ Delhi Electricity Demand Forecasting

**Team Nexora** — Origin Data Science Club Hackathon (PS-1)

| Name | Registration No. |
|---|---|
| Aviral Sahu | 25BAI10409 |
| Mabel Jacquelin Fernandes | 25BAI10423 |
| Sanskriti Tyagi | 25BHI10124 |
| Harshjyot Rakhra | 25BHI10114 |
| Pratistha Aggarwal | 25BAI10076 |

---

## 🔗 Live Demo

| What | Link |
|---|---|
| **Frontend (Netlify)** | https://fluffy-profiterole-8cf802.netlify.app |
| **Backend API (Cloudflare Tunnel)** | https://satisfaction-motels-season-air.trycloudflare.com |
| **API Docs (Swagger)** | `<backend URL>/docs` |

> ⚠️ The backend runs on a local machine, exposed via a Cloudflare Tunnel.
> If the tunnel URL has changed since this README was written, check
> `frontend/script.js` (`BACKEND_URL`) for the current one.

---

## 🧩 Problem Statement — PS1

Electricity discoms in Delhi need to forecast next-day power demand
accurately to balance grid load, avoid outages, and plan generation ahead
of time — especially during temperature-driven demand spikes. Manual or
static forecasting methods don't react well to real weather changes.

## 💡 Solution

An AI-based system that predicts Delhi's hourly electricity demand for the
upcoming days using historical load patterns and live weather forecasts,
and automatically flags when predicted demand approaches critical grid
capacity — giving discoms an early warning window instead of finding out
after the fact.

**In one sentence:** an AI system that predicts next-day electricity
demand using weather + historical load data, with built-in grid capacity
alerting.

---

## 🏗️ Architecture

```
Frontend (Netlify, static HTML/CSS/JS)
        │  fetch()
        ▼
FastAPI Backend (Cloudflare Tunnel)
        │
        ├── RandomForestRegressor (model.pkl) ── trained on historical
        │                                         Delhi load + weather
        └── Open-Meteo API ── live & forecast weather (temperature)
```

---

## 🛠️ Tech Stack

- **Backend:** Python, FastAPI, uvicorn
- **ML:** scikit-learn (RandomForestRegressor), pandas, numpy
- **Weather Data:** Open-Meteo API (forecast + historical)
- **Frontend:** HTML, CSS, JavaScript, Chart.js (SCADA-style dark theme)
- **Hosting:** Netlify (frontend), Cloudflare Tunnel (backend)
- **Dataset:** 24-hours Delhi Power Consumption dataset

---

## 📊 Model

- **Algorithm:** RandomForestRegressor
- **Features:** `temperature, hour, dayofweek, is_weekend, month, load_lag24`
- **Load range in data:** 12,023 – 31,138 MW (real Delhi scale)
- **Performance:** MAE ≈ 736 MW, RMSE ≈ 1039 MW
- **Validation:** time-based train/test split (`shuffle=False`) — the model
  is trained on the earlier portion of the timeline and tested on the
  later portion, avoiding lookahead leakage that a random split would
  introduce in time-series data.

## 🚨 Alert Logic

Grid capacity reference: **35,000 MW**

| Predicted Load | Status |
|---|---|
| ≥ 95% of capacity | 🔴 `CRITICAL` |
| ≥ 85% of capacity | 🟡 `WARNING` |
| below 85% | 🟢 `Normal` |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — `{"status": "ok"}` |
| `GET` | `/historical?hours=168` | Last N hours of actual historical load |
| `GET` | `/predict?days=7` | Hourly forecasted load + alert status for the next N days |
| `GET` | `/current-weather` | Live Delhi temperature & humidity (Open-Meteo) |

---

## 📁 Project Structure

```
Origin-DATA-Science/
├── backend/
│   ├── main.py             # FastAPI app, all endpoints
│   ├── data_ingest.py      # Loads dataset CSV + fetches Open-Meteo weather
│   ├── features.py         # Feature engineering (lag-24, time features)
│   ├── train_model.py      # Trains RandomForest, saves model.pkl
│   ├── alerts.py           # CRITICAL / WARNING / Normal alert logic
│   └── requirements.txt
├── dataset/
│   └── archive/
│       └── 24-hours Delhi Power Consumption dataset.csv
├── frontend/
│   ├── index.html          # SCADA-style dashboard
│   ├── style.css
│   └── script.js           # Wired to the backend API
└── README.md
```

> **Note:** `model.pkl` (~61MB) and the dataset CSVs are excluded from this
> repository due to GitHub's file size limits. See **Running Locally**
> below to regenerate them.

---

## 🚀 Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/Aviralsahu960/delhi-power-forecasting
cd delhi-power-forecasting

# 2. Set up the backend
cd backend
pip install -r requirements.txt

# 3. Place the dataset
# Download/copy "24-hours Delhi Power Consumption dataset.csv" into
# ../dataset/archive/ (not included in repo due to size)

# 4. Train the model (regenerates model.pkl, not included in repo)
python train_model.py

# 5. Run the API
uvicorn main:app --reload
# API available at http://localhost:8000, docs at http://localhost:8000/docs

# 6. Expose it publicly (for the frontend to reach it)
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8000

# 7. Open the frontend
# Update BACKEND_URL in frontend/script.js to your cloudflared URL,
# then open frontend/index.html directly, or deploy the frontend/ folder
# to Netlify.
```

---

## 🎯 Impact

- Early warning for discoms before grid load approaches critical capacity
- Reduces reactive load-shedding by enabling proactive planning
- Weather-aware forecasting adapts to real conditions instead of static
  historical averages
