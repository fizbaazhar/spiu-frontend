import React, { useMemo, useRef, useState } from "react";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Dropdown from "react-bootstrap/Dropdown";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import ToggleButton from "react-bootstrap/ToggleButton";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { format, parseISO } from "date-fns";
import DownloadReport from "./DownloadReport.jsx";
import { stationCoordinatesByCity } from "../data/stationCoordinates.js";
import { labelWithUnitUI, displayNameForKey, getUnit } from "../data/units.js";
import { toPlottable, isErrorValue } from "../utils/errors.ts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const POLLUTANTS = [
  "AQI",
  "O3",
  "CO",
  "SO2",
  "NO",
  "NO2",
  "NOX",
  "PM10",
  "PM25",
  "WS",
  "WD",
  "Temp",
  "RH",
  "BP",
  "Rain",
  "SR",
];

const COLORS = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#808080",
  "#ffd8b1",
];

function getColor(index) {
  return COLORS[index % COLORS.length];
}

function getChartOptions(darkMode, yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: { color: darkMode ? "#f0f0f0" : "#666" },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: darkMode ? "#2d3032" : "rgba(0,0,0,.75)",
        titleColor: darkMode ? "#f0f0f0" : "#fff",
        bodyColor: darkMode ? "#f0f0f0" : "#fff",
        borderColor: darkMode ? "#3a3f42" : "rgba(0,0,0,.1)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        type: "time",
        time: { tooltipFormat: "Pp" },
        ticks: { color: darkMode ? "#f0f0f0" : "#666" },
        grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: yLabel,
          color: darkMode ? "#f0f0f0" : "#666",
        },
        ticks: { color: darkMode ? "#f0f0f0" : "#666" },
        grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
      },
    },
    parsing: false,
  };
}

function getTimeScaleOptions(baseOptions, timePeriod, interval) {
  const options = { ...baseOptions };
  const unit =
    timePeriod === "daily"
      ? "hour"
      : timePeriod === "monthly"
      ? "day"
      : interval === "60"
      ? "hour"
      : "day";
  options.scales = options.scales || {};
  options.scales.x = options.scales.x || {};
  options.scales.x.time = {
    ...(options.scales.x.time || {}),
    unit,
    displayFormats: unit === "hour" ? { hour: "HH:mm" } : { day: "MMM d" },
  };
  options.scales.x.ticks = {
    ...(options.scales.x.ticks || {}),
    autoSkip: true,
    maxRotation: 0,
    minRotation: 0,
  };
  return options;
}

export default function Graphs({
  darkMode,
  stations,
  stationLabels = {},
  apiBaseUrl,
  apiKey,
}) {
  const [selectedStations, setSelectedStations] = useState([]);
  const [selectedPollutants, setSelectedPollutants] = useState(["AQI"]);
  const [timePeriod, setTimePeriod] = useState("daily"); // daily | monthly | periodic
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [interval, setInterval] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [series, setSeries] = useState([]); // [{label, data:[{x,y}], color}]
  const [rawRowsByStation, setRawRowsByStation] = useState({});
  const [viewMode, setViewMode] = useState("graphical"); // 'graphical' | 'tabular'
  const chartRef = useRef(null);

  const stationOptions = useMemo(() => stations || [], [stations]);
  const allStationsSelected =
    stationOptions.length > 0 &&
    selectedStations.length === stationOptions.length;
  const allPollutantsSelected = selectedPollutants.length === POLLUTANTS.length;

  const canApply =
    selectedStations.length > 0 &&
    selectedPollutants.length > 0 &&
    (timePeriod === "periodic" ? startDateTime && endDateTime : true);

  async function fetchDailyMonthly(stationId, period) {
    const endpoint = period === "monthly" ? "monthly" : "daily";
    const url = `${apiBaseUrl}/${endpoint}/${encodeURIComponent(stationId)}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json[stationId] || [];
  }

  async function fetchCustom(stationId) {
    const url = `${apiBaseUrl}/periodic/${encodeURIComponent(
      stationId
    )}?start_datetime=${encodeURIComponent(
      format(new Date(startDateTime), "yyyy-MM-dd HH:mm:ss")
    )}&end_datetime=${encodeURIComponent(
      format(new Date(endDateTime), "yyyy-MM-dd HH:mm:ss")
    )}&interval=${interval}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json[stationId] || [];
  }

  async function onApply() {
    try {
      setLoading(true);
      setError(null);
      setSeries([]);

      // Fetch data per station
      const stationData = {};
      for (const id of selectedStations) {
        const rows =
          timePeriod === "periodic"
            ? await fetchCustom(id)
            : await fetchDailyMonthly(id, timePeriod);
        stationData[id] = Array.isArray(rows) ? rows : [];
      }
      setRawRowsByStation(stationData);

      // Build series for each station-pollutant pair
      const built = [];
      let colorIdx = 0;
      for (const pollutant of selectedPollutants) {
        for (const id of selectedStations) {
          const rows = stationData[id];
          const dataPoints = rows
            .map((r) => ({
              x: r.Date_Time ? parseISO(r.Date_Time) : null,
              y: toPlottable(r[pollutant]),
            }))
            .filter((p) => p.x && !isNaN(p.x) && p.y !== null)
            .map((p) => ({ x: p.x, y: p.y }));
          if (dataPoints.length === 0) continue;
          const color = getColor(colorIdx++);
          const stationName = stationLabels[id] || id;
          const pollutantLabel =
            pollutant === "AQI" ? "AQI" : labelWithUnitUI(pollutant, null, stationName);
          const labelName = stationName;
          built.push({
            label: `${labelName} • ${pollutantLabel}`,
            data: dataPoints,
            color,
          });
        }
      }

      setSeries(built);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    return {
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color + "33",
        borderWidth: 1.5,
        pointRadius: 1.5,
        spanGaps: true,
        cubicInterpolationMode: "monotone",
        tension: 0.2,
      })),
    };
  }, [series]);

  const yAxisLabel = useMemo(() => {
    if (selectedPollutants.length === 1) {
      const key = selectedPollutants[0];
      if (key === "AQI") return "AQI";
      // If only one station is selected, use its specific unit
      if (selectedStations.length === 1) {
        const stationName = stationLabels[selectedStations[0]] || selectedStations[0];
        return labelWithUnitUI(key, null, stationName);
      }
      // For multiple stations, use default unit (they should all have the same unit anyway)
      return labelWithUnitUI(key);
    }
    return "Value";
  }, [selectedPollutants, selectedStations, stationLabels]);

  const chartOptions = useMemo(() => {
    const opts = getTimeScaleOptions(
      getChartOptions(darkMode, yAxisLabel),
      timePeriod,
      interval
    );
    // Derive global min/max across all datasets to ensure full range is visible
    let minTs = null;
    let maxTs = null;
    for (const s of series) {
      for (const p of s.data) {
        if (p && p.x instanceof Date && !isNaN(p.x)) {
          const t = p.x.getTime();
          if (minTs === null || t < minTs) minTs = t;
          if (maxTs === null || t > maxTs) maxTs = t;
        }
      }
    }
    if (minTs !== null && maxTs !== null) {
      opts.scales = opts.scales || {};
      opts.scales.x = opts.scales.x || {};
      opts.scales.x.min = new Date(minTs).toISOString();
      opts.scales.x.max = new Date(maxTs).toISOString();
    }
    return opts;
  }, [darkMode, yAxisLabel, timePeriod, interval, series]);

  const tabular = useMemo(() => {
    // Build station-grouped columns: [Time, Station1 • p1, ..., Station1 • Dominant?, Station2 • p1, ...]
    if (!selectedStations.length || !selectedPollutants.length) {
      return { headers: [], rows: [] };
    }

    // Collect union of minute buckets across all selected stations
    const allTimeKeys = new Set();
    selectedStations.forEach((st) => {
      const rows = rawRowsByStation[st] || [];
      rows.forEach((r) => {
        const t = r.Date_Time ? parseISO(r.Date_Time) : null;
        if (!t || isNaN(t)) return;
        allTimeKeys.add(format(t, "yyyy-MM-dd HH:mm"));
      });
    });
    const sortedTimeKeys = Array.from(allTimeKeys).sort();
    if (sortedTimeKeys.length === 0) return { headers: [], rows: [] };

    const includesAQI = selectedPollutants.includes("AQI");

    // Precompute maps per station
    const valueMapByStation = new Map(); // station -> pollutant -> Map(timeKey -> number)
    const statusMapByStation = new Map(); // station -> pollutant -> Map(timeKey -> status string)
    const dpMapByStation = new Map(); // station -> Map(timeKey -> dominant)
    selectedStations.forEach((st) => {
      const rows = rawRowsByStation[st] || [];
      const pollutantMap = new Map();
      const statusMap = new Map();
      selectedPollutants.forEach((p) => {
        pollutantMap.set(p, new Map());
        statusMap.set(p, new Map());
      });
      const dpMap = new Map();
      rows.forEach((r) => {
        const t = r.Date_Time ? parseISO(r.Date_Time) : null;
        if (!t || isNaN(t)) return;
        const key = format(t, "yyyy-MM-dd HH:mm");
        selectedPollutants.forEach((p) => {
          const statusKey = `Status_${p}`;
          const statusVal = r[statusKey];

          if (statusVal && statusVal !== "Valid") {
            statusMap.get(p).set(key, statusVal);
          } else {
            const y = toPlottable(r[p]);
            if (y !== null) pollutantMap.get(p).set(key, y);
          }
        });
        if (includesAQI) dpMap.set(key, r.Dominant_Pollutant || "");
      });
      valueMapByStation.set(st, pollutantMap);
      statusMapByStation.set(st, statusMap);
      if (includesAQI) dpMapByStation.set(st, dpMap);
    });

    // Headers grouped by station
    const normalizeHeader = (h) =>
      String(h).replace("µg/m³", "µg/m3").replace("W/m²", "W/m2");
    const headers = ["Time"];
    selectedStations.forEach((st) => {
      const stationLabel = stationLabels[st] || st;
      selectedPollutants.forEach((p) => {
        const pollutantLabel = p === "AQI" ? "AQI" : labelWithUnitUI(p, null, stationLabel);
        headers.push(normalizeHeader(`${stationLabel} • ${pollutantLabel}`));
        // Don't add Status header for AQI
        if (p !== "AQI") {
          headers.push(`${stationLabel} • Status`);
        }
        if (p === "AQI") headers.push(`${stationLabel} • Dominant`);
      });
    });

    // Rows per time
    const rows = sortedTimeKeys.map((timeKey) => {
      const rowVals = [timeKey];
      selectedStations.forEach((st) => {
        const pollMap = valueMapByStation.get(st);
        const statMap = statusMapByStation.get(st);
        selectedPollutants.forEach((p) => {
          const v = pollMap && pollMap.get(p) && pollMap.get(p).get(timeKey);
          const statusStr =
            statMap && statMap.get(p) && statMap.get(p).get(timeKey);

          rowVals.push(
            v !== undefined && v !== null ? Number(v).toFixed(3) : ""
          );

          // Don't add status column for AQI
          if (p !== "AQI") {
            rowVals.push(statusStr || "");
          }

          if (p === "AQI") {
            const dpMap = dpMapByStation.get(st);
            const dpVal = (dpMap && dpMap.get(timeKey)) || "";
            rowVals.push(
              dpVal && dpVal !== "N/A" ? displayNameForKey(dpVal) : ""
            );
          }
        });
      });
      return rowVals;
    });

    // Append summary rows: Min, MinDate, Max, MaxDate, Avg (numeric columns only)
    const colCount = headers.length;
    const isNumericColumn = (idx) => {
      // Dominant and Status columns should be excluded
      if (idx === 0) return false;
      const h = headers[idx] || "";
      return !/Dominant|Status/.test(h);
    };
    const getNumeric = (s) => {
      if (s === null || s === undefined) return null;
      if (typeof s !== "string") return isNaN(Number(s)) ? null : Number(s);
      const val = parseFloat(s);
      return isNaN(val) ? null : val;
    };

    const minRow = new Array(colCount).fill("");
    const minDateRow = new Array(colCount).fill("");
    const maxRow = new Array(colCount).fill("");
    const maxDateRow = new Array(colCount).fill("");
    const avgRow = new Array(colCount).fill("");
    minRow[0] = "Min";
    minDateRow[0] = "MinDate";
    maxRow[0] = "Max";
    maxDateRow[0] = "MaxDate";
    avgRow[0] = "Avg";

    for (let c = 1; c < colCount; c++) {
      if (!isNumericColumn(c)) continue;
      let minVal = Infinity;
      let maxVal = -Infinity;
      let minTime = null;
      let maxTime = null;
      let sum = 0;
      let count = 0;
      for (let r = 0; r < rows.length; r++) {
        const v = getNumeric(rows[r][c]);
        if (v === null) continue;
        if (v < minVal) {
          minVal = v;
          minTime = rows[r][0];
        }
        if (v > maxVal) {
          maxVal = v;
          maxTime = rows[r][0];
        }
        sum += v;
        count += 1;
      }
      if (count > 0) {
        minRow[c] = minVal.toFixed(3);
        minDateRow[c] = minTime || "";
        maxRow[c] = maxVal.toFixed(3);
        maxDateRow[c] = maxTime || "";
        avgRow[c] = (sum / count).toFixed(3);
      }
    }

    const rowsWithSummary = rows.concat([
      minRow,
      minDateRow,
      maxRow,
      maxDateRow,
      avgRow,
    ]);
    return { headers, rows: rowsWithSummary };
  }, [selectedStations, selectedPollutants, rawRowsByStation, stationLabels]);

  function downloadCSV() {
    if (!tabular.headers.length) return;
    const normalizedRows = tabular.rows.map((r) =>
      r.map((c) => (c === "N/A" ? "" : c))
    );
    const csvData = [tabular.headers, ...normalizedRows];
    const csvContent = csvData
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `graphs_${timePeriod}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Create a light-themed chart image for PDF/print so text is dark on white
  function getLightChartImage() {
    const chart = chartRef.current;
    if (!chart) return null;
    try {
      const originalOptions = structuredClone(chart.options || {});
      const newOptions = structuredClone(chart.options || {});
      // Force light text and subtle grids
      if (!newOptions.plugins) newOptions.plugins = {};
      if (!newOptions.plugins.legend) newOptions.plugins.legend = {};
      if (!newOptions.plugins.legend.labels)
        newOptions.plugins.legend.labels = {};
      newOptions.plugins.legend.labels.color = "#000";
      if (!newOptions.plugins.title) newOptions.plugins.title = {};
      newOptions.plugins.title.color = "#000";
      if (!newOptions.scales) newOptions.scales = {};
      const axes = ["x", "y"];
      axes.forEach((axisKey) => {
        if (!newOptions.scales[axisKey]) newOptions.scales[axisKey] = {};
        const axis = newOptions.scales[axisKey];
        if (!axis.ticks) axis.ticks = {};
        axis.ticks.color = "#000";
        if (!axis.grid) axis.grid = {};
        axis.grid.color = "#e5e5e5";
      });
      chart.options = newOptions;
      chart.update("none");

      // Draw onto a white-backed canvas to avoid transparent background
      const srcCanvas = chart.canvas;
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = srcCanvas.width;
      tmpCanvas.height = srcCanvas.height;
      const ctx = tmpCanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
      ctx.drawImage(srcCanvas, 0, 0);
      const dataUrl = tmpCanvas.toDataURL("image/png", 1.0);

      // Restore original options
      chart.options = originalOptions;
      chart.update("none");
      return dataUrl;
    } catch (e) {
      try {
        return chart.toBase64Image("image/png", 1);
      } catch (_) {
        return null;
      }
    }
  }

  async function renderLightChartImageFromScratch() {
    try {
      // Build a light-themed options clone
      const lightOptions = structuredClone(chartOptions || {});
      // Force non-responsive fixed size for crisp export
      lightOptions.responsive = false;
      lightOptions.maintainAspectRatio = false;
      if (!lightOptions.plugins) lightOptions.plugins = {};
      if (!lightOptions.plugins.legend) lightOptions.plugins.legend = {};
      if (!lightOptions.plugins.legend.labels)
        lightOptions.plugins.legend.labels = {};
      lightOptions.plugins.legend.labels.color = "#000";
      if (!lightOptions.plugins.title) lightOptions.plugins.title = {};
      lightOptions.plugins.title.color = "#000";
      if (!lightOptions.scales) lightOptions.scales = {};
      ["x", "y"].forEach((axisKey) => {
        if (!lightOptions.scales[axisKey]) lightOptions.scales[axisKey] = {};
        const axis = lightOptions.scales[axisKey];
        if (!axis.ticks) axis.ticks = {};
        axis.ticks.color = "#000";
        if (!axis.grid) axis.grid = {};
        axis.grid.color = "#e5e5e5";
      });
      // Disable animations
      lightOptions.animation = false;

      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const tempChart = new ChartJS(ctx, {
        type: "line",
        data: chartData,
        options: lightOptions,
      });

      await new Promise((resolve) => requestAnimationFrame(resolve));
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      tempChart.destroy();
      return dataUrl;
    } catch (e) {
      return getLightChartImage();
    }
  }

  async function downloadPDF() {
    const chartImg = await renderLightChartImageFromScratch();
    const tableHtml = tabular.headers.length
      ? `
      <table style=\"width:100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; color:#000;\">
        <thead>
          <tr>
            ${tabular.headers
              .map(
                (h) =>
                  `<th style=\\"border:1px solid #ccc; padding:4px; text-align:left; background:#f5f5f5; color:#000;\\">${h}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${tabular.rows
            .map(
              (r) =>
                `<tr style=\\"color:#000;\\">${r
                  .map(
                    (c) =>
                      `<td style=\\"border:1px solid #eee; padding:4px; color:#000;\\">${c}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`
      : '<p style="color:#000;">No data available</p>';

    const w = window.open("");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Graphs Export</title>
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        </head>
        <body style=\"margin:16px; background:#fff; color:#000;\">
          ${
            chartImg
              ? `<img src=\"${chartImg}\" style=\"max-width:100%; margin-bottom:16px;\"/>`
              : ""
          }
          ${tableHtml}
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className={`h-100 d-flex flex-column ${darkMode ? "dark-mode" : ""}`}>
      <div className="flex-shrink-0">
        {/* Row 1: Locations & Pollutants */}
        <Row className="g-2 align-items-end">
          <Col xs={12} md={4} lg={3}>
            <Form.Group>
              <Form.Label>Locations</Form.Label>
              <Dropdown autoClose="outside">
                <Dropdown.Toggle
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                  className="w-100 text-truncate"
                >
                  {selectedStations.length > 0
                    ? `${selectedStations.length} selected`
                    : "Select locations"}
                </Dropdown.Toggle>
                <Dropdown.Menu
                  className={darkMode ? "bg-dark text-light" : ""}
                  style={{
                    maxHeight: 260,
                    overflowY: "auto",
                    width: "100%",
                    zIndex: 9000,
                    position: "relative",
                  }}
                >
                  <div className="px-3 py-1 border-bottom">
                    <Form.Check
                      type="checkbox"
                      id={`station-select-all`}
                      label={
                        <span className={darkMode ? "text-light" : ""}>
                          Select All
                        </span>
                      }
                      checked={allStationsSelected}
                      onChange={() =>
                        setSelectedStations((prev) =>
                          prev.length === stationOptions.length
                            ? []
                            : [...stationOptions]
                        )
                      }
                    />
                  </div>
                  {Object.entries(stationCoordinatesByCity).map(
                    ([city, stations]) => {
                      const stationIds = Object.keys(stations).map((key) => {
                        if (city === "Mobile AQMS") {
                          const m = key.match(/Mobile\s*\d+/i);
                          if (m) {
                            return m[0]
                              .replace(/\s+/g, " ")
                              .replace(/\bmobile\b/i, "Mobile");
                          }
                        }
                        return key;
                      });
                      const allCitySelected = stationIds.every((id) =>
                        selectedStations.includes(id)
                      );
                      return (
                        <div
                          key={`city-${city}`}
                          className="px-3 py-2 border-bottom"
                        >
                          <Form.Check
                            type="checkbox"
                            id={`city-${city}`}
                            label={
                              <span className={darkMode ? "text-light" : ""}>
                                {city}
                              </span>
                            }
                            checked={allCitySelected}
                            onChange={() => {
                              setSelectedStations((prev) => {
                                const setPrev = new Set(prev);
                                if (allCitySelected) {
                                  stationIds.forEach((id) =>
                                    setPrev.delete(id)
                                  );
                                } else {
                                  stationIds.forEach((id) => setPrev.add(id));
                                }
                                return Array.from(setPrev);
                              });
                            }}
                          />
                          <div className="mt-1 ms-3">
                            {stationIds.map((s) => (
                              <div key={s} className="py-1">
                                <Form.Check
                                  type="checkbox"
                                  id={`station-${s}`}
                                  label={
                                    <span
                                      className={darkMode ? "text-light" : ""}
                                    >
                                      {stationLabels[s] || s}
                                    </span>
                                  }
                                  checked={selectedStations.includes(s)}
                                  onChange={() =>
                                    setSelectedStations((prev) =>
                                      prev.includes(s)
                                        ? prev.filter((n) => n !== s)
                                        : [...prev, s]
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </Dropdown.Menu>
              </Dropdown>
            </Form.Group>
          </Col>
          <Col xs={12} md={4} lg={3}>
            <Form.Group>
              <Form.Label>Pollutants</Form.Label>
              <Dropdown autoClose="outside">
                <Dropdown.Toggle
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                  className="w-100 text-truncate"
                >
                  {selectedPollutants.length > 0
                    ? `${selectedPollutants.length} selected`
                    : "Select pollutants"}
                </Dropdown.Toggle>
                <Dropdown.Menu
                  className={darkMode ? "bg-dark text-light" : ""}
                  style={{
                    maxHeight: 260,
                    overflowY: "auto",
                    width: "100%",
                    zIndex: 9000,
                    position: "relative",
                  }}
                >
                  <div className="px-3 py-1 border-bottom">
                    <Form.Check
                      type="checkbox"
                      id={`pollutant-select-all`}
                      label={
                        <span className={darkMode ? "text-light" : ""}>
                          Select All
                        </span>
                      }
                      checked={allPollutantsSelected}
                      onChange={() =>
                        setSelectedPollutants((prev) =>
                          prev.length === POLLUTANTS.length
                            ? []
                            : [...POLLUTANTS]
                        )
                      }
                    />
                  </div>
                  {POLLUTANTS.map((p) => (
                    <div key={p} className="px-3 py-1">
                      <Form.Check
                        type="checkbox"
                        id={`pollutant-${p}`}
                        label={
                          <span className={darkMode ? "text-light" : ""}>
                            {p === "AQI" ? "AQI" : displayNameForKey(p)}
                          </span>
                        }
                        checked={selectedPollutants.includes(p)}
                        onChange={() =>
                          setSelectedPollutants((prev) =>
                            prev.includes(p)
                              ? prev.filter((n) => n !== p)
                              : [...prev, p]
                          )
                        }
                      />
                    </div>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Form.Group>
          </Col>
        </Row>
        {/* Row 2: Time Period & Actions (matches InfoPanel periodic styling) */}
        <div className="mt-2">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={8}>
              <Form.Group className="mb-2">
                <Form.Label>Time Period</Form.Label>
                <div>
                  <ToggleButtonGroup
                    type="radio"
                    name="timePeriodOptions"
                    value={timePeriod}
                    onChange={setTimePeriod}
                    size="sm"
                  >
                    <ToggleButton
                      id="tbg-graphs-daily"
                      value={"daily"}
                      variant={darkMode ? "outline-light" : "outline-secondary"}
                    >
                      Daily
                    </ToggleButton>
                    <ToggleButton
                      id="tbg-graphs-monthly"
                      value={"monthly"}
                      variant={darkMode ? "outline-light" : "outline-secondary"}
                    >
                      Monthly
                    </ToggleButton>
                    <ToggleButton
                      id="tbg-graphs-periodic"
                      value={"periodic"}
                      variant={darkMode ? "outline-light" : "outline-secondary"}
                    >
                      Periodic
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>
              </Form.Group>
              {timePeriod === "periodic" && (
                <Row className="g-2">
                  <Col xs={12} md={5}>
                    <Form.Group>
                      <Form.Label>Start Date & Time</Form.Label>
                      <Form.Control
                        type="datetime-local"
                        step="1"
                        value={startDateTime}
                        onChange={(e) => setStartDateTime(e.target.value)}
                        className={darkMode ? "bg-dark text-light" : ""}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={5}>
                    <Form.Group>
                      <Form.Label>End Date & Time</Form.Label>
                      <Form.Control
                        type="datetime-local"
                        step="1"
                        value={endDateTime}
                        onChange={(e) => setEndDateTime(e.target.value)}
                        className={darkMode ? "bg-dark text-light" : ""}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={2}>
                    <Form.Group>
                      <Form.Label>Interval</Form.Label>
                      <Form.Select
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        className={darkMode ? "bg-dark text-light" : ""}
                      >
                        <option value="05">5 min</option>
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="60">Hourly</option>
                        <option value="1440">Daily</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              )}
            </Col>
            <Col
              xs={12}
              md={4}
              className="d-flex flex-wrap gap-2 justify-content-md-end"
              style={{ position: "relative", zIndex: 5000 }}
            >
              <ToggleButtonGroup
                type="radio"
                name="viewModeOptions"
                value={viewMode}
                onChange={setViewMode}
                size="sm"
              >
                <ToggleButton
                  id="tbg-graphs-view-graph"
                  value={"graphical"}
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                >
                  Graphical
                </ToggleButton>
                <ToggleButton
                  id="tbg-graphs-view-table"
                  value={"tabular"}
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                >
                  Tabular
                </ToggleButton>
              </ToggleButtonGroup>
              <DownloadReport
                darkMode={darkMode}
                label="Download"
                size="sm"
                filenamePrefix={`graphs_${timePeriod}`}
                csv={{ headers: tabular.headers, rows: tabular.rows }}
                table={{ headers: tabular.headers, rows: tabular.rows }}
                chartType="line"
                chartData={chartData}
                chartOptions={chartOptions}
              />
              <Button
                size="sm"
                variant={darkMode ? "outline-light" : "primary"}
                onClick={onApply}
                disabled={!canApply || loading}
              >
                {loading
                  ? timePeriod === "periodic"
                    ? "Getting..."
                    : "Applying..."
                  : timePeriod === "periodic"
                  ? "Get Data"
                  : "Apply"}
              </Button>
            </Col>
          </Row>
        </div>
      </div>

      <div
        className="flex-grow-1 position-relative mt-3"
        style={{ overflowX: "hidden", width: "100%" }}
      >
        {loading && (
          <div className="d-flex justify-content-center align-items-center h-100">
            <Spinner
              animation="border"
              variant={darkMode ? "light" : "primary"}
            />
          </div>
        )}
        {!loading && error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && series.length > 0 && viewMode === "graphical" ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <Line ref={chartRef} options={chartOptions} data={chartData} />
          </div>
        ) : !loading &&
          !error &&
          series.length > 0 &&
          viewMode === "tabular" ? (
          <div
            className={`table-responsive w-100 ${darkMode ? "dark-mode" : ""}`}
            style={{ maxHeight: "70vh", overflowY: "auto" }}
          >
            <table
              className={`table table-sm ${
                darkMode ? "table-dark" : "table-light"
              } table-striped table-bordered`}
            >
              <thead
                className="sticky-top"
                style={{ backgroundColor: darkMode ? "#343a40" : "#f8f9fa" }}
                zIndex="1"
              >
                <tr>
                  {tabular.headers.map((h) => (
                    <th key={h} className="border-end">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabular.rows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, i) => (
                      <td key={i} className="border-end">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !loading &&
          !error && (
            <div className="text-center text-muted mt-4">
              Select inputs and click Apply to see graphs.
            </div>
          )
        )}
      </div>
    </div>
  );
}
