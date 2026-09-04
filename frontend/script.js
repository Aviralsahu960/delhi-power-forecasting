// ============================================================
// DELHI GRID ANALYTICS
// FRONTEND DATA LAYER
// ============================================================

// ------------------------------------------------------------
// BACKEND CONNECTION
// ------------------------------------------------------------

// Backend is ready and connected.
const BACKEND_ENABLED = true;

const BACKEND_URL = "https://satisfaction-motels-season-air.trycloudflare.com";


// ------------------------------------------------------------
// DEMO DATA
// ------------------------------------------------------------
// This keeps the frontend working BEFORE backend integration.
// Later your backend will replace this data.
// ------------------------------------------------------------

const demoData = {

    currentDemand: 7842,

    nextDayPeak: 8214,

    peakWindow: "15:00 – 16:00 IST",

    confidence: 94,

    solarOffset: 1280,

    capacity: 8800,

    forecast: [
        {
            date: "04 Sep",
            demand: 7842,
            temperature: 34
        },
        {
            date: "05 Sep",
            demand: 8214,
            temperature: 38
        },
        {
            date: "06 Sep",
            demand: 8290,
            temperature: 39
        },
        {
            date: "07 Sep",
            demand: 8145,
            temperature: 37
        },
        {
            date: "08 Sep",
            demand: 7980,
            temperature: 35
        },
        {
            date: "09 Sep",
            demand: 8065,
            temperature: 36
        },
        {
            date: "10 Sep",
            demand: 8175,
            temperature: 37
        }
    ],

    feeders: [
        {
            name: "BRPL",
            region: "South / West Delhi",
            gross: 2350,
            solar: 410
        },
        {
            name: "TPDDL",
            region: "North / North-West",
            gross: 1980,
            solar: 310
        },
        {
            name: "BYPL",
            region: "East / Central-East",
            gross: 1640,
            solar: 245
        },
        {
            name: "NDMC",
            region: "Central Delhi",
            gross: 910,
            solar: 115
        }
    ]

};


// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

let alertThreshold = 8000;

let alertAcknowledged = false;

let forecastChart = null;
let scatterChart = null;
let feederChart = null;


// ------------------------------------------------------------
// HELPER
// ------------------------------------------------------------

function formatMW(value) {

    return Number(value).toLocaleString("en-IN");

}


// ------------------------------------------------------------
// CLOCK
// ------------------------------------------------------------

function updateClock() {

    const now = new Date();

    const options = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    };

    const parts = new Intl.DateTimeFormat(
        "en-CA",
        options
    ).formatToParts(now);

    const values = {};

    parts.forEach(part => {
        values[part.type] = part.value;
    });

    const timestamp =
        `${values.year}-${values.month}-${values.day} ` +
        `${values.hour}:${values.minute}:${values.second} IST`;

    const element =
        document.getElementById("liveTimestamp");

    if (element) {
        element.textContent = timestamp;
    }

}

setInterval(updateClock, 1000);

updateClock();


// ------------------------------------------------------------
// WEATHER
// OPEN-METEO
// ------------------------------------------------------------

async function loadWeather() {

    const latitude = 28.6139;
    const longitude = 77.2090;

    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
        `&timezone=Asia/Kolkata`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Weather request failed");
        }

        const data = await response.json();

        const current = data.current;

        console.log("Open-Meteo:", current);

        // If your HTML contains these IDs,
        // they will update automatically.

        updateElement(
            "temperature",
            Number(current.temperature_2m).toFixed(1)
        );

        updateElement(
            "humidity",
            `${current.relative_humidity_2m}%`
        );

        updateElement(
            "windSpeed",
            `${current.wind_speed_10m} km/h`
        );

        updateElement(
            "feelsLike",
            `${Number(current.apparent_temperature).toFixed(1)} °C`
        );

        updateElement(
            "weatherStatus",
            "LIVE"
        );

        return data;

    } catch (error) {

        console.error(
            "Open-Meteo error:",
            error
        );

        updateElement(
            "weatherStatus",
            "UNAVAILABLE"
        );

    }

}


// ------------------------------------------------------------
// SAFE ELEMENT UPDATE
// ------------------------------------------------------------

function updateElement(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


// ------------------------------------------------------------
// UPDATE KPI
// ------------------------------------------------------------

function updateDashboard(data) {

    updateElement(
        "nextDayPeakMW",
        formatMW(data.nextDayPeak)
    );

    updateElement(
        "peakWindowText",
        data.peakWindow
    );

    updateElement(
        "ciRangePill",
        `95% CI: ${formatMW(
            data.nextDayPeak * 0.97
        )} – ${formatMW(
            data.nextDayPeak * 1.03
        )} MW`
    );

    updateElement(
        "solarOffsetVal",
        `- ${formatMW(data.solarOffset)} MW`
    );

    updateElement(
        "capacityPct",
        `${(
            data.nextDayPeak /
            data.capacity *
            100
        ).toFixed(1)}% LOAD`
    );

    const meter =
        document.getElementById("meterFill");

    if (meter) {

        meter.style.width =
            `${Math.min(
                data.nextDayPeak /
                data.capacity *
                100,
                100
            )}%`;

    }

    updateAlert(data);

}


// ------------------------------------------------------------
// ALERT ENGINE
// ------------------------------------------------------------

function updateAlert(data) {

    const exceeded =
        data.nextDayPeak >= alertThreshold;

    const banner =
        document.getElementById(
            "primaryAlertBanner"
        );

    const message =
        document.getElementById(
            "alertMessageText"
        );

    const badge =
        document.getElementById(
            "alertCountBadge"
        );

    if (!banner || !message || !badge) {
        return;
    }

    if (exceeded) {

        badge.textContent =
            "1 CRITICAL";

        message.innerHTML =
            `Predicted Next-Day Peak ` +
            `<strong>${formatMW(
                data.nextDayPeak
            )} MW</strong> ` +
            `exceeds the current alert threshold ` +
            `<strong>${formatMW(
                alertThreshold
            )} MW</strong>.`;

        banner.classList.remove("safe");

    } else {

        badge.textContent =
            "0 ACTIVE";

        message.innerHTML =
            `Predicted demand remains below ` +
            `the configured alert threshold of ` +
            `<strong>${formatMW(
                alertThreshold
            )} MW</strong>.`;

        banner.classList.add("safe");

    }

    if (alertAcknowledged) {

        banner.classList.add(
            "acknowledged"
        );

    }

}


// ------------------------------------------------------------
// THRESHOLD SLIDER
// ------------------------------------------------------------

const thresholdSlider =
    document.getElementById(
        "thresholdSlider"
    );

if (thresholdSlider) {

    thresholdSlider.addEventListener(
        "input",
        function () {

            alertThreshold =
                Number(this.value);

            updateElement(
                "thresholdDisplay",
                `${formatMW(
                    alertThreshold
                )} MW`
            );

            updateElement(
                "sideThreshold",
                `${formatMW(
                    alertThreshold
                )} MW`
            );

            updateAlert(
                demoData
            );

        }
    );

}


// ------------------------------------------------------------
// ACKNOWLEDGE ALERT
// ------------------------------------------------------------

function toggleAlertAck() {

    alertAcknowledged =
        !alertAcknowledged;

    const banner =
        document.getElementById(
            "primaryAlertBanner"
        );

    if (!banner) {
        return;
    }

    banner.classList.toggle(
        "acknowledged",
        alertAcknowledged
    );

}


// ------------------------------------------------------------
// FORECAST CHART
// ------------------------------------------------------------

function createForecastChart(
    scenario = "heatwave"
) {

    const canvas =
        document.getElementById(
            "forecastChart"
        );

    if (!canvas) {
        return;
    }

    const data =
        buildScenario(
            scenario
        );

    if (forecastChart) {
        forecastChart.destroy();
    }

    forecastChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {

                    labels:
                        data.map(
                            item => item.date
                        ),

                    datasets: [

                        {
                            label:
                                "Demand (MW)",

                            data:
                                data.map(
                                    item =>
                                        item.demand
                                ),

                            borderColor:
                                "#38bdf8",

                            backgroundColor:
                                "rgba(56,189,248,.08)",

                            borderWidth: 2,

                            tension: .35,

                            fill: true,

                            yAxisID:
                                "demand"
                        },

                        {
                            label:
                                "Temperature (°C)",

                            data:
                                data.map(
                                    item =>
                                        item.temperature
                                ),

                            borderColor:
                                "#f59e0b",

                            borderWidth: 2,

                            tension: .35,

                            pointRadius: 3,

                            yAxisID:
                                "temperature"
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {

                        legend: {
                            labels: {
                                color: "#94a3b8",
                                font: {
                                    size: 10
                                }
                            }
                        }

                    },

                    scales: {

                        x: {
                            ticks: {
                                color: "#64748b"
                            },

                            grid: {
                                color:
                                    "rgba(255,255,255,.04)"
                            }
                        },

                        demand: {

                            position: "left",

                            ticks: {
                                color:
                                    "#38bdf8"
                            },

                            grid: {
                                color:
                                    "rgba(255,255,255,.04)"
                            }

                        },

                        temperature: {

                            position: "right",

                            ticks: {
                                color:
                                    "#f59e0b"
                            },

                            grid: {
                                drawOnChartArea:
                                    false
                            }

                        }

                    }

                }

            }
        );

}


// ------------------------------------------------------------
// SCENARIO DATA
// ------------------------------------------------------------

function buildScenario(
    scenario
) {

    const multipliers = {

        heatwave:
            [1, 1.00, 1.025, 1.015, .99, 1.005, 1.015],

        monsoon:
            [1, .965, .97, .975, .96, .97, .98],

        normal:
            [1, .985, .995, .99, .98, .99, 1]

    };

    const temperatureChange = {

        heatwave: 0,

        monsoon: -3,

        normal: -1.5

    };

    return demoData.forecast.map(
        (item, index) => {

            return {

                date:
                    item.date,

                demand:
                    Math.round(
                        item.demand *
                        multipliers[
                            scenario
                        ][index]
                    ),

                temperature:
                    Number(
                        item.temperature +
                        temperatureChange[
                            scenario
                        ]
                    )

            };

        }
    );

}


// ------------------------------------------------------------
// TEMPERATURE / DEMAND SCATTER
// ------------------------------------------------------------

function createScatterChart() {

    const canvas =
        document.getElementById(
            "scatterChart"
        );

    if (!canvas) {
        return;
    }

    if (scatterChart) {
        scatterChart.destroy();
    }

    const points =
        demoData.forecast.map(
            item => ({
                x: item.temperature,
                y: item.demand
            })
        );

    scatterChart =
        new Chart(
            canvas,
            {
                type: "scatter",

                data: {

                    datasets: [

                        {
                            label:
                                "Demand vs Temperature",

                            data:
                                points,

                            backgroundColor:
                                "#38bdf8",

                            borderColor:
                                "#38bdf8",

                            pointRadius: 5

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }

                    },

                    scales: {

                        x: {

                            title: {
                                display: true,
                                text: "Temperature °C",
                                color: "#8b9bb0"
                            },

                            ticks: {
                                color: "#64748b"
                            },

                            grid: {
                                color:
                                    "rgba(255,255,255,.04)"
                            }

                        },

                        y: {

                            title: {
                                display: true,
                                text: "Demand MW",
                                color: "#8b9bb0"
                            },

                            ticks: {
                                color: "#64748b"
                            },

                            grid: {
                                color:
                                    "rgba(255,255,255,.04)"
                            }

                        }

                    }

                }

            }
        );

}


// ------------------------------------------------------------
// FEEDER CHART
// ------------------------------------------------------------

function createFeederChart() {

    const canvas =
        document.getElementById(
            "feederChart"
        );

    if (!canvas) {
        return;
    }

    if (feederChart) {
        feederChart.destroy();
    }

    const feeders =
        demoData.feeders;

    feederChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels:
                        feeders.map(
                            item => item.name
                        ),

                    datasets: [

                        {
                            label:
                                "Gross Demand",

                            data:
                                feeders.map(
                                    item =>
                                        item.gross
                                ),

                            backgroundColor:
                                "#38bdf8"

                        },

                        {
                            label:
                                "Solar Offset",

                            data:
                                feeders.map(
                                    item =>
                                        item.solar
                                ),

                            backgroundColor:
                                "#f59e0b"

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            labels: {
                                color: "#94a3b8",
                                font: {
                                    size: 9
                                }
                            }
                        }

                    },

                    scales: {

                        x: {
                            ticks: {
                                color:
                                    "#94a3b8"
                            },

                            grid: {
                                display: false
                            }

                        },

                        y: {

                            ticks: {
                                color:
                                    "#64748b"
                            },

                            grid: {
                                color:
                                    "rgba(255,255,255,.04)"
                            }

                        }

                    }

                }

            }
        );

}


// ------------------------------------------------------------
// FEEDER TABLE
// ------------------------------------------------------------

function createFeederTable() {

    const body =
        document.getElementById(
            "feederTableBody"
        );

    if (!body) {
        return;
    }

    body.innerHTML = "";

    demoData.feeders.forEach(
        feeder => {

            const net =
                feeder.gross -
                feeder.solar;

            const relief =
                (
                    feeder.solar /
                    feeder.gross *
                    100
                ).toFixed(1);

            let status =
                "OPTIMAL";

            let statusClass =
                "optimal";

            if (relief < 10) {

                status =
                    "HIGH";

                statusClass =
                    "high";

            }

            if (relief < 6) {

                status =
                    "STRESSED";

                statusClass =
                    "stressed";

            }

            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `

                <td>
                    <strong>
                        ${feeder.name}
                    </strong>
                </td>

                <td>
                    ${feeder.region}
                </td>

                <td>
                    ${formatMW(
                        feeder.gross
                    )} MW
                </td>

                <td class="val-solar">
                    -${formatMW(
                        feeder.solar
                    )} MW
                </td>

                <td class="val-net">
                    ${formatMW(
                        net
                    )} MW
                </td>

                <td>
                    ${relief}%
                </td>

                <td>
                    <span class="
                        status-badge
                        ${statusClass}
                    ">
                        ${status}
                    </span>
                </td>

            `;

            body.appendChild(row);

        }
    );

}


// ------------------------------------------------------------
// SCENARIO BUTTONS
// ------------------------------------------------------------

document
    .querySelectorAll(".sim-btn")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(
                            ".sim-btn"
                        )
                        .forEach(
                            btn =>
                                btn.classList
                                   .remove(
                                       "active"
                                   )
                        );

                    this.classList.add(
                        "active"
                    );

                    createForecastChart(
                        this.dataset
                            .scenario
                            || "heatwave"
                    );

                }
            );

        }
    );


// ------------------------------------------------------------
// CSV EXPORT
// ------------------------------------------------------------

function downloadForecastCSV() {

    const rows = [

        [
            "Date",
            "Predicted Demand MW",
            "Temperature C"
        ],

        ...demoData.forecast.map(
            item => [

                item.date,
                item.demand,
                item.temperature

            ]
        )

    ];

    const csv =
        rows
            .map(
                row =>
                    row.join(",")
            )
            .join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href = url;

    link.download =
        "delhi-demand-forecast.csv";

    link.click();

    URL.revokeObjectURL(
        url
    );

}


// ------------------------------------------------------------
// DOWNLOAD BUTTON
// ------------------------------------------------------------

const csvButton =
    document.getElementById(
        "downloadCsvBtn"
    );

if (csvButton) {

    csvButton.addEventListener(
        "click",
        downloadForecastCSV
    );

}


// ------------------------------------------------------------
// BACKEND LOADER
// ------------------------------------------------------------

async function loadBackendData() {

    if (!BACKEND_ENABLED) {
        console.log("Backend disabled. Using demo data.");
        return demoData;
    }

    try {

        // Fetch predictions and historical in parallel
        const [predRes, histRes] = await Promise.all([
            fetch(`${BACKEND_URL}/predict?days=7`),
            fetch(`${BACKEND_URL}/historical?hours=168`)
        ]);

        if (!predRes.ok || !histRes.ok) {
            throw new Error("Backend request failed");
        }

        const predictions = await predRes.json();
        const historical  = await histRes.json();

        // Find peak predicted load
        const peakObj = predictions.reduce(
            (max, row) =>
                row.predicted_load_MW > max.predicted_load_MW ? row : max,
            predictions[0]
        );

        const peakMW   = Math.round(peakObj.predicted_load_MW);
        const peakTime = new Date(peakObj.timestamp)
            .toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata"
            }) + " IST";

        // Build forecast array for charts (daily summary — one per day)
        const dayMap = {};
        predictions.forEach(row => {
            const date = row.timestamp.slice(0, 10);
            if (!dayMap[date] || row.predicted_load_MW > dayMap[date].demand) {
                dayMap[date] = {
                    date: new Date(date).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short"
                    }),
                    demand: Math.round(row.predicted_load_MW),
                    temperature: 35   // placeholder; real temp loaded by loadWeather()
                };
            }
        });
        const forecastArray = Object.values(dayMap).slice(0, 7);

        // Build scatter points from historical
        const scatterPoints = historical.slice(-72).map(row => ({
            temperature: 30 + Math.random() * 10,  // temp not in /historical; approximate
            demand: Math.round(row.actual_load_MW)
        }));

        // Update demoData in place so charts + table keep working
        demoData.nextDayPeak  = peakMW;
        demoData.currentDemand = Math.round(
            historical[historical.length - 1]?.actual_load_MW || peakMW
        );
        demoData.peakWindow   = peakTime;
        demoData.forecast     = forecastArray;

        // Store historical for chart use
        window._historicalData = historical;
        window._predictionsData = predictions;

        console.log(
            `Backend OK — Peak: ${peakMW} MW at ${peakTime}`
        );

        return demoData;

    } catch (error) {

        console.error("Backend unavailable:", error);
        console.log("Falling back to demo data.");
        return demoData;

    }

}


// ------------------------------------------------------------
// INITIALIZE
// ------------------------------------------------------------

async function initializeDashboard() {

    console.log(
        "Delhi Grid Analytics starting..."
    );

    const data =
        await loadBackendData();

    updateDashboard(data);

    createForecastChart(
        "heatwave"
    );

    createScatterChart();

    createFeederChart();

    createFeederTable();

    await loadWeather();

}


initializeDashboard();