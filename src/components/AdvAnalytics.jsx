import React, { useMemo, useState, useEffect, useRef } from "react";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import ToggleButton from "react-bootstrap/ToggleButton";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { Line, Scatter, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { parseISO, format } from "date-fns";
import { getPollutantColor, pollutantCategories } from "./Legend.jsx";
import PollutionRose, {
  isPollutantAppropriateForRose,
} from "./PollutionRose.jsx";
import DownloadReport from "./DownloadReport.jsx";
import {
  labelWithUnitUI,
  labelWithUnitExport,
  displayNameForKey,
} from "../data/units.js";
import { toPlottable, isErrorValue } from "../utils/errors.ts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#bcf60c",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#800000",
  "#808000",
  "#000075",
  "#808080",
];

function getColor(i) {
  return COLORS[i % COLORS.length];
}

function getTimeChartOptions(darkMode, yLabel, unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: darkMode ? "#f0f0f0" : "#666" } },
      title: { display: false },
      tooltip: {
        backgroundColor: darkMode ? "#2d3032" : "rgba(0,0,0,.75)",
        titleColor: darkMode ? "#f0f0f0" : "#fff",
        bodyColor: darkMode ? "#f0f0f0" : "#fff",
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit,
          displayFormats:
            unit === "hour" ? { hour: "HH:mm" } : { day: "MMM d" },
        },
        ticks: { color: darkMode ? "#f0f0f0" : "#666" },
        grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
      },
      y: {
        title: {
          display: true,
          text: yLabel,
          color: darkMode ? "#f0f0f0" : "#666",
        },
        ticks: { color: darkMode ? "#f0f0f0" : "#666" },
        grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
        beginAtZero: true,
      },
    },
    parsing: false,
  };
}

export default function AdvAnalytics({
  darkMode,
  stations,
  apiBaseUrl,
  apiKey,
  analyticsView,
  stationLabels = {},
}) {
  const [view, setView] = useState(analyticsView || "2y"); // 2y | xy | calendar | hist
  const [station, setStation] = useState(stations?.[0] || "");
  const [p1, setP1] = useState("AQI");
  const [p2, setP2] = useState("PM25");
  const [stationsMulti, setStationsMulti] = useState([]);
  const [paramsMulti, setParamsMulti] = useState(["AQI"]);
  const [histBins, setHistBins] = useState(20);
  const [timePeriod, setTimePeriod] = useState("daily");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [interval, setInterval] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const calendarRef = useRef(null);
  const [histStationRows, setHistStationRows] = useState({});
  const [parallelStationRows, setParallelStationRows] = useState({});
  const [parallelHour, setParallelHour] = useState("12"); // 0-23
  const [parallelMode, setParallelMode] = useState("graphical"); // graphical | tabular
  const [roseMode, setRoseMode] = useState("graphical"); // graphical | tabular
  const [roseWindDirection, setRoseWindDirection] = useState("from"); // from | to
  const roseRef = useRef(null);

  useEffect(() => {
    setStation(stations?.[0] || "");
    if (
      (!stationsMulti || stationsMulti.length === 0) &&
      stations &&
      stations.length
    ) {
      setStationsMulti([stations[0]]);
    }
  }, [stations]);

  useEffect(() => {
    if (analyticsView && analyticsView !== view) {
      setView(analyticsView);
    }
  }, [analyticsView]);

  async function fetchDailyMonthly(st, period) {
    const endpoint = period === "monthly" ? "monthly" : "daily";
    const url = `${apiBaseUrl}/${endpoint}/${encodeURIComponent(st)}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json[st] || [];
  }
  async function fetchPeriodic(st, forcedInterval) {
    const usedInterval = forcedInterval || interval;
    const url = `${apiBaseUrl}/periodic/${encodeURIComponent(
      st
    )}?start_datetime=${encodeURIComponent(
      format(
        new Date(new Date(startDateTime).setSeconds(0, 0)),
        "yyyy-MM-dd HH:mm:ss"
      )
    )}&end_datetime=${encodeURIComponent(
      format(
        new Date(new Date(endDateTime).setSeconds(0, 0)),
        "yyyy-MM-dd HH:mm:ss"
      )
    )}&interval=${usedInterval}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json[st] || [];
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      let data = [];
      if (view === "calendar") {
        // Calendar uses daily values for a date range → periodic with interval=1440
        data = await fetchPeriodic(station, "1440");
      } else if (view === "hist") {
        if (!startDateTime || !endDateTime) {
          throw new Error(
            "Please provide start and end date/time for histogram"
          );
        }
        const targets =
          stationsMulti && stationsMulti.length
            ? stationsMulti
            : station
            ? [station]
            : [];
        const results = await Promise.all(
          targets.map(async (st) => {
            const r = await fetchPeriodic(st);
            return [st, r];
          })
        );
        const byStation = {};
        results.forEach(([st, r]) => {
          byStation[st] = Array.isArray(r) ? r : [];
        });
        setHistStationRows(byStation);
        data = [];
      } else if (view === "parallel") {
        if (!startDateTime || !endDateTime) {
          throw new Error(
            "Please provide start and end date/time for parallel view"
          );
        }
        const targets =
          stationsMulti && stationsMulti.length
            ? stationsMulti
            : station
            ? [station]
            : [];
        const results = await Promise.all(
          targets.map(async (st) => {
            const r = await fetchPeriodic(st, "60");
            return [st, r];
          })
        );
        const byStation = {};
        results.forEach(([st, r]) => {
          byStation[st] = Array.isArray(r) ? r : [];
        });
        setParallelStationRows(byStation);
        data = [];
      } else {
        data =
          timePeriod === "periodic"
            ? await fetchPeriodic(station)
            : await fetchDailyMonthly(station, timePeriod);
        setHistStationRows({});
        setParallelStationRows({});
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || String(e));
      setRows([]);
      setHistStationRows({});
      setParallelStationRows({});
    } finally {
      setLoading(false);
    }
  }

  const twoYData = useMemo(() => {
    if (rows.length === 0) return { datasets: [] };
    const parseRow = (r, key) => ({
      x: r.Date_Time ? parseISO(r.Date_Time) : null,
      y: toPlottable(r[key]),
    });
    const d1 = rows
      .map((r) => parseRow(r, p1))
      .filter((p) => p.x && !isNaN(p.x) && p.y != null);
    const d2 = rows
      .map((r) => parseRow(r, p2))
      .filter((p) => p.x && !isNaN(p.x) && p.y != null);
    const p1Label = p1 === "AQI" ? "AQI" : displayNameForKey(p1);
    const p2Label = p2 === "AQI" ? "AQI" : displayNameForKey(p2);
    return {
      datasets: [
        {
          label: p1Label,
          data: d1,
          borderColor: getColor(0),
          backgroundColor: getColor(0) + "33",
          borderWidth: 1.5,
          pointRadius: 0,
          parsing: false,
          yAxisID: "y",
        },
        {
          label: p2Label,
          data: d2,
          borderColor: getColor(1),
          backgroundColor: getColor(1) + "33",
          borderWidth: 1.5,
          pointRadius: 0,
          parsing: false,
          yAxisID: "y2",
        },
      ],
    };
  }, [rows, p1, p2]);

  // Enforce expected endpoint meaning: daily=hourly x-axis, monthly=daily x-axis
  const unit = useMemo(() => {
    if (view === "calendar") return "day";
    if (timePeriod === "daily") return "hour";
    if (timePeriod === "monthly") return "day";
    return interval === "60" ? "hour" : "day";
  }, [timePeriod, interval, view]);

  const twoYOptions = useMemo(() => {
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: darkMode ? "#f0f0f0" : "#666" },
          position: "bottom",
        },
        title: { display: false },
        tooltip: {
          backgroundColor: darkMode ? "#2d3032" : "rgba(0,0,0,.75)",
          titleColor: darkMode ? "#f0f0f0" : "#fff",
          bodyColor: darkMode ? "#f0f0f0" : "#fff",
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit,
            displayFormats:
              unit === "hour" ? { hour: "HH:mm" } : { day: "MMM d" },
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
        },
        y: {
          position: "left",
          title: {
            display: true,
            text: p1 === "AQI" ? "AQI" : labelWithUnitUI(p1),
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
          beginAtZero: true,
        },
        y2: {
          position: "right",
          title: {
            display: true,
            text: p2 === "AQI" ? "AQI" : labelWithUnitUI(p2),
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { drawOnChartArea: false },
          beginAtZero: true,
        },
      },
      parsing: false,
    };
    // Derive min/max timestamps across both datasets to ensure full range is visible
    let minTs = null;
    let maxTs = null;
    twoYData.datasets.forEach((ds) => {
      ds.data.forEach((pt) => {
        if (pt && pt.x instanceof Date && !isNaN(pt.x)) {
          const t = pt.x.getTime();
          if (minTs === null || t < minTs) minTs = t;
          if (maxTs === null || t > maxTs) maxTs = t;
        }
      });
    });
    if (minTs !== null && maxTs !== null) {
      opts.scales = opts.scales || {};
      opts.scales.x = opts.scales.x || {};
      opts.scales.x.min = new Date(minTs).toISOString();
      opts.scales.x.max = new Date(maxTs).toISOString();
    }
    return opts;
  }, [twoYData, darkMode, p1, p2, unit]);

  const xyOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: darkMode ? "#f0f0f0" : "#666" },
          position: "bottom",
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: p1 === "AQI" ? "AQI" : labelWithUnitUI(p1),
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: {
            color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)",
          },
        },
        y: {
          title: {
            display: true,
            text: p2 === "AQI" ? "AQI" : labelWithUnitUI(p2),
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: {
            color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)",
          },
        },
      },
    };
  }, [darkMode, p1, p2]);

  const xyData = useMemo(() => {
    if (rows.length === 0) return { datasets: [] };
    const pts = rows
      .map((r) => ({
        x: toPlottable(r[p1]),
        y: toPlottable(r[p2]),
      }))
      .filter((p) => p.x != null && p.y != null);
    return {
      datasets: [
        {
          label: `${p1 === "AQI" ? "AQI" : displayNameForKey(p1)} vs ${
            p2 === "AQI" ? "AQI" : displayNameForKey(p2)
          }`,
          data: pts,
          backgroundColor: getColor(2) + "99",
        },
      ],
    };
  }, [rows, p1, p2]);

  // Histogram calculation across selected stations for a single pollutant
  const histCalc = useMemo(() => {
    if (view !== "hist") {
      return {
        data: { labels: [], datasets: [] },
        options: {},
        table: { headers: [], rows: [] },
      };
    }

    const paramSel = paramsMulti && paramsMulti.length ? paramsMulti[0] : p1;
    const stationList =
      stationsMulti && stationsMulti.length
        ? stationsMulti
        : station
        ? [station]
        : [];

    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;

    const valuesByStation = new Map();
    stationList.forEach((st) => {
      const rowsSt = histStationRows[st] || [];
      const vals = [];
      for (const r of rowsSt) {
        const raw = r[paramSel];
        if (raw != null && String(raw) !== "-9999.0000000") {
          const v = Number(raw);
          if (!isNaN(v)) {
            vals.push(v);
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
          }
        }
      }
      valuesByStation.set(st, vals);
    });

    if (
      globalMin === Number.POSITIVE_INFINITY ||
      globalMax === Number.NEGATIVE_INFINITY
    ) {
      return {
        data: { labels: [], datasets: [] },
        options: {},
        table: { headers: [], rows: [] },
      };
    }

    if (globalMin === globalMax) {
      globalMax = globalMax + 1;
    }

    const binsCount = Math.max(1, Number(histBins) || 20);
    const width = (globalMax - globalMin) / binsCount;
    const edges = Array.from(
      { length: binsCount + 1 },
      (_, i) => globalMin + i * width
    );
    const labels = Array.from({ length: binsCount }, (_, i) => {
      const a = edges[i];
      const b = edges[i + 1];
      return `${a.toFixed(2)} – ${b.toFixed(2)}`;
    });

    const datasets = stationList.map((st, idx) => {
      const vals = valuesByStation.get(st) || [];
      const counts = new Array(binsCount).fill(0);
      vals.forEach((v) => {
        let bi = Math.floor((v - globalMin) / width);
        if (bi < 0) bi = 0;
        if (bi >= binsCount) bi = binsCount - 1;
        counts[bi] += 1;
      });
      return {
        label: stationLabels[st] || st,
        data: counts,
        backgroundColor: getColor(idx) + "99",
        borderColor: getColor(idx),
        borderWidth: 1,
      };
    });

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          backgroundColor: darkMode ? "#2d3032" : "rgba(0,0,0,.75)",
          titleColor: darkMode ? "#f0f0f0" : "#fff",
          bodyColor: darkMode ? "#f0f0f0" : "#fff",
        },
      },
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: `Value bins — ${paramSel}`,
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
          categoryPercentage: 0.8,
          barPercentage: 0.8,
        },
        y: {
          stacked: false,
          title: {
            display: true,
            text: "Count",
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
          beginAtZero: true,
        },
      },
    };

    const headers = [
      "Bin",
      ...stationList.map((st) => stationLabels[st] || st),
    ];
    const rowsTable = labels.map((lab, i) => [
      lab,
      ...datasets.map((ds) => String(ds.data[i] ?? 0)),
    ]);

    return {
      data: { labels, datasets },
      options,
      table: { headers, rows: rowsTable },
    };
  }, [
    view,
    histStationRows,
    stationsMulti,
    station,
    paramsMulti,
    p1,
    histBins,
    darkMode,
  ]);

  // Parallel view: filter the same hour across different days for one or more locations
  const parallelCalc = useMemo(() => {
    if (view !== "parallel") {
      return {
        data: { datasets: [] },
        options: {},
        table: { headers: [], rows: [] },
      };
    }

    const hour = Math.max(0, Math.min(23, parseInt(parallelHour || "0", 10)));
    const stationList =
      stationsMulti && stationsMulti.length
        ? stationsMulti
        : station
        ? [station]
        : [];
    const pollutant = p1;
    const startBound = startDateTime ? new Date(startDateTime) : null;
    const endBound = endDateTime ? new Date(endDateTime) : null;

    // Collect per-station values for the specified clock hour, keyed by date string
    const dateKeyToRow = new Map();
    const datasets = [];
    let colorIdx = 0;

    stationList.forEach((st) => {
      const rowsSt = parallelStationRows[st] || [];
      const points = [];
      rowsSt.forEach((r) => {
        const ts = r.Date_Time ? parseISO(r.Date_Time) : null;
        if (!ts || isNaN(ts)) return;
        if (ts.getHours() !== hour) return;
        const valRaw = r[pollutant];
        if (valRaw == null || String(valRaw) === "-9999.0000000") return;
        const val = Number(valRaw);
        if (isNaN(val)) return;
        const dateOnly = new Date(
          ts.getFullYear(),
          ts.getMonth(),
          ts.getDate()
        );
        if (
          startBound &&
          dateOnly <
            new Date(
              startBound.getFullYear(),
              startBound.getMonth(),
              startBound.getDate()
            )
        )
          return;
        if (
          endBound &&
          dateOnly >
            new Date(
              endBound.getFullYear(),
              endBound.getMonth(),
              endBound.getDate()
            )
        )
          return;
        // Use date at the selected hour so tooltip shows correct time
        const dateAtHour = new Date(
          ts.getFullYear(),
          ts.getMonth(),
          ts.getDate(),
          hour,
          0,
          0,
          0
        );
        points.push({ x: dateAtHour, y: val });
        const key = format(dateOnly, "yyyy-MM-dd");
        if (!dateKeyToRow.has(key))
          dateKeyToRow.set(key, { date: dateOnly, values: {} });
        dateKeyToRow.get(key).values[st] = val;
      });
      if (points.length > 0) {
        const color = getColor(colorIdx++);
        datasets.push({
          label: stationLabels[st] || st,
          data: points.sort((a, b) => a.x - b.x),
          borderColor: color,
          backgroundColor: color + "33",
          borderWidth: 1.5,
          pointRadius: 2,
          parsing: false,
        });
      }
    });

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: darkMode ? "#f0f0f0" : "#666" },
          position: "bottom",
        },
        title: { display: false },
        tooltip: {
          backgroundColor: darkMode ? "#2d3032" : "rgba(0,0,0,.75)",
          titleColor: darkMode ? "#f0f0f0" : "#fff",
          bodyColor: darkMode ? "#f0f0f0" : "#fff",
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            displayFormats: { day: "MMM d" },
            tooltipFormat: "MMM d, HH:mm",
          },
          title: {
            display: true,
            text: `Date @ ${hour.toString().padStart(2, "0")}:00`,
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
          distribution: "linear",
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: pollutant,
            color: darkMode ? "#f0f0f0" : "#666",
          },
          ticks: { color: darkMode ? "#f0f0f0" : "#666" },
          grid: { color: darkMode ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" },
        },
      },
      parsing: false,
    };

    // Set x-axis min/max to encompass all datasets
    let minX = null;
    let maxX = null;
    datasets.forEach((ds) => {
      (ds.data || []).forEach((pt) => {
        if (pt && pt.x instanceof Date && !isNaN(pt.x)) {
          const t = pt.x.getTime();
          if (minX === null || t < minX) minX = t;
          if (maxX === null || t > maxX) maxX = t;
        }
      });
    });
    if (minX !== null && maxX !== null) {
      options.scales.x.min = new Date(minX).toISOString();
      options.scales.x.max = new Date(maxX).toISOString();
    }

    // Build table with union of dates across stations
    const headers = [
      "Date",
      ...stationList.map((st) => stationLabels[st] || st),
    ];
    const rowKeys = Array.from(dateKeyToRow.keys()).sort();
    const tableRows = rowKeys.map((k) => {
      const row = dateKeyToRow.get(k);
      return [
        format(row.date, "yyyy-MM-dd"),
        ...stationList.map((st) =>
          row.values[st] != null ? String(row.values[st]) : ""
        ),
      ];
    });

    return { data: { datasets }, options, table: { headers, rows: tableRows } };
  }, [
    view,
    stationsMulti,
    station,
    p1,
    parallelHour,
    parallelStationRows,
    darkMode,
  ]);

  const calendarCells = useMemo(() => {
    if (rows.length === 0) return [];
    // Expect daily rows (monthly endpoint). Group by date and color by pollutant value bucket
    const items = rows
      .map((r) => ({
        d: r.Date_Time ? parseISO(r.Date_Time) : null,
        v: r[p1] != null ? Number(r[p1]) : null,
      }))
      .filter((x) => x.d && !isNaN(x.d));
    const byDate = new Map();
    items.forEach(({ d, v }) => {
      const key = format(d, "yyyy-MM-dd");
      if (!byDate.has(key)) byDate.set(key, { date: d, value: v });
    });
    return Array.from(byDate.values()).sort((a, b) => a.date - b.date);
  }, [rows, p1]);

  const calendarGroups = useMemo(() => {
    const groups = new Map();
    for (const item of calendarCells) {
      const key = format(item.date, "yyyy-MM");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const ordered = Array.from(groups.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : 1
    );
    return ordered.map(([key, items]) => {
      const first = items[0].date;
      const leading = new Date(
        first.getFullYear(),
        first.getMonth(),
        1
      ).getDay();
      return { label: format(first, "MMMM yyyy"), leading, items };
    });
  }, [calendarCells]);

  return (
    <div className={`h-100 d-flex flex-column ${darkMode ? "dark-mode" : ""}`}>
      <Row className="g-2 align-items-end">
        <Col xs={12} md={4}>
          <Form.Group>
            <Form.Label>
              {view === "hist" || view === "parallel" ? "Locations" : "Station"}
            </Form.Label>
            {view === "hist" || view === "parallel" ? (
              <Dropdown autoClose="outside">
                <Dropdown.Toggle
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                  className="w-100 text-truncate"
                >
                  {stationsMulti && stationsMulti.length
                    ? `${stationsMulti.length} selected`
                    : "Select locations"}
                </Dropdown.Toggle>
                <Dropdown.Menu
                  className={darkMode ? "bg-dark text-light" : ""}
                  style={{ maxHeight: 260, overflowY: "auto", width: "100%" }}
                >
                  {stations.map((s) => (
                    <div key={s} className="px-3 py-1">
                      <Form.Check
                        type="checkbox"
                        id={`hist-st-${s}`}
                        label={
                          <span className={darkMode ? "text-light" : ""}>
                            {stationLabels[s] || s}
                          </span>
                        }
                        checked={stationsMulti.includes(s)}
                        onChange={() =>
                          setStationsMulti((prev) =>
                            prev.includes(s)
                              ? prev.filter((n) => n !== s)
                              : [...prev, s]
                          )
                        }
                      />
                    </div>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Form.Select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className={darkMode ? "bg-dark text-light" : ""}
              >
                {stations.map((s) => (
                  <option key={s} value={s}>
                    {stationLabels[s] || s}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>
        </Col>
        <Col xs={12} md={view === "calendar" || view === "hist" ? 8 : 4}>
          <Form.Group>
            <Form.Label>
              {view === "calendar"
                ? "Parameter"
                : view === "hist"
                ? "Pollutants"
                : view === "parallel"
                ? "Parameter"
                : view === "rose"
                ? "Pollutant"
                : "Parameter"}
            </Form.Label>
            {view === "hist" ? (
              <Dropdown autoClose="outside">
                <Dropdown.Toggle
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                  className="w-100 text-truncate"
                >
                  {paramsMulti && paramsMulti.length
                    ? `${paramsMulti.length} selected`
                    : "Select pollutants"}
                </Dropdown.Toggle>
                <Dropdown.Menu
                  className={darkMode ? "bg-dark text-light" : ""}
                  style={{ maxHeight: 260, overflowY: "auto", width: "100%" }}
                >
                  {POLLUTANTS.map((p) => (
                    <div key={p} className="px-3 py-1">
                      <Form.Check
                        type="checkbox"
                        id={`hist-param-${p}`}
                        label={
                          <span className={darkMode ? "text-light" : ""}>
                            {p === "AQI" ? "AQI" : displayNameForKey(p)}
                          </span>
                        }
                        checked={paramsMulti.includes(p)}
                        onChange={() =>
                          setParamsMulti((prev) =>
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
            ) : view === "rose" ? (
              <Form.Select
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                className={darkMode ? "bg-dark text-light" : ""}
              >
                {POLLUTANTS.filter((p) => isPollutantAppropriateForRose(p)).map(
                  (p) => (
                    <option key={p} value={p}>
                      {p === "AQI" ? "AQI" : displayNameForKey(p)}
                    </option>
                  )
                )}
              </Form.Select>
            ) : (
              <Form.Select
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                className={darkMode ? "bg-dark text-light" : ""}
              >
                {POLLUTANTS.map((p) => (
                  <option key={p} value={p}>
                    {p === "AQI" ? "AQI" : displayNameForKey(p)}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>
        </Col>
        {view !== "calendar" &&
          view !== "hist" &&
          view !== "parallel" &&
          view !== "rose" && (
            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label>Parameter 2</Form.Label>
                <Form.Select
                  value={p2}
                  onChange={(e) => setP2(e.target.value)}
                  className={darkMode ? "bg-dark text-light" : ""}
                >
                  {POLLUTANTS.map((p) => (
                    <option key={p} value={p}>
                      {p === "AQI" ? "AQI" : displayNameForKey(p)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          )}
      </Row>

      {view === "rose" && (
        <Row className="g-2 align-items-end mt-1">
          <Col xs={12} md={12} className="d-flex flex-wrap align-items-end">
            <ToggleButtonGroup
              type="radio"
              name="roseMode"
              value={roseMode}
              onChange={setRoseMode}
              size="sm"
              className="me-2 mb-2"
            >
              <ToggleButton
                id="rose-graph"
                value={"graphical"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                Graphical
              </ToggleButton>
              <ToggleButton
                id="rose-table"
                value={"tabular"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                Tabular
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              type="radio"
              name="roseWind"
              value={roseWindDirection}
              onChange={setRoseWindDirection}
              size="sm"
              className="me-2 mb-2"
            >
              <ToggleButton
                id="rose-from"
                value={"from"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                From
              </ToggleButton>
              <ToggleButton
                id="rose-to"
                value={"to"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                To
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              type="radio"
              name="advRoseTimePeriod"
              value={timePeriod}
              onChange={setTimePeriod}
              size="sm"
              className="mb-2"
            >
              <ToggleButton
                id="adv-rose-daily"
                value={"daily"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                Daily
              </ToggleButton>
              <ToggleButton
                id="adv-rose-monthly"
                value={"monthly"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                Monthly
              </ToggleButton>
              <ToggleButton
                id="adv-rose-periodic"
                value={"periodic"}
                variant={darkMode ? "outline-light" : "outline-secondary"}
              >
                Periodic
              </ToggleButton>
            </ToggleButtonGroup>
          </Col>
        </Row>
      )}

      <Row className="g-2 align-items-end mt-1">
        <Col xs={12} md={8}>
          {view !== "calendar" &&
          view !== "hist" &&
          view !== "parallel" &&
          view !== "rose" ? (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Time Period</Form.Label>
                <div>
                  <ToggleButtonGroup
                    type="radio"
                    name="advTimePeriod"
                    value={timePeriod}
                    onChange={setTimePeriod}
                    size="sm"
                  >
                    <ToggleButton
                      id="adv-daily"
                      value={"daily"}
                      variant={darkMode ? "outline-light" : "outline-secondary"}
                    >
                      Daily
                    </ToggleButton>
                    <ToggleButton
                      id="adv-monthly"
                      value={"monthly"}
                      variant={darkMode ? "outline-light" : "outline-secondary"}
                    >
                      Monthly
                    </ToggleButton>
                    <ToggleButton
                      id="adv-periodic"
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
                        step="60"
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
                        step="60"
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
            </>
          ) : view === "hist" ? (
            <Row className="g-2">
              <Col xs={12} md={4}>
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
              <Col xs={12} md={4}>
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
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label>Interval</Form.Label>
                  <Form.Select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  >
                    <option value="60">Hourly</option>
                    <option value="1440">Daily</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label>Bins</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={200}
                    value={histBins}
                    onChange={(e) => setHistBins(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  />
                </Form.Group>
              </Col>
            </Row>
          ) : view === "parallel" ? (
            <Row className="g-2">
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label>Start Date & Time</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    step="60"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label>End Date & Time</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    step="60"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  />
                </Form.Group>
              </Col>
              <Col xs={6} md={2}>
                <Form.Group>
                  <Form.Label>Hour</Form.Label>
                  <Form.Select
                    value={parallelHour}
                    onChange={(e) => setParallelHour(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={`h-${h}`} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={6} md={2} className="d-flex align-items-end">
                <ToggleButtonGroup
                  type="radio"
                  name="parallelMode"
                  value={parallelMode}
                  onChange={setParallelMode}
                  size="sm"
                >
                  <ToggleButton
                    id="parallel-graph"
                    value={"graphical"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Graph
                  </ToggleButton>
                  <ToggleButton
                    id="parallel-table"
                    value={"tabular"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Table
                  </ToggleButton>
                </ToggleButtonGroup>
              </Col>
            </Row>
          ) : view === "rose" ? (
            <>
              {timePeriod === "periodic" && (
                <Row className="g-2">
                  <Col xs={12} md={5}>
                    <Form.Group>
                      <Form.Label>Start Date & Time</Form.Label>
                      <Form.Control
                        type="datetime-local"
                        step="60"
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
                        step="60"
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
                        <option value="60">Hourly</option>
                        <option value="1440">Daily</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              )}
            </>
          ) : (
            <Row className="g-2">
              <Col xs={12} md={5}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} md={5}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className={darkMode ? "bg-dark text-light" : ""}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
        </Col>
        <Col
          xs={12}
          md={4}
          className="d-flex flex-wrap gap-2 justify-content-md-end"
          style={{ position: "relative", zIndex: 3000 }}
        >
          <Form.Select
            value={view}
            onChange={(e) => setView(e.target.value)}
            className={darkMode ? "bg-dark text-light" : ""}
            style={{ maxWidth: 220 }}
          >
            <option value="2y">2Y Time Plot</option>
            <option value="xy">XY Plot</option>
            <option value="hist">Histogram</option>
            <option value="parallel">Parallel View</option>
            <option value="calendar">Calendar Plot</option>
            <option value="rose">Pollution Rose</option>
          </Form.Select>
          <Button
            size="sm"
            variant={darkMode ? "outline-light" : "primary"}
            onClick={load}
            disabled={
              loading ||
              (view !== "hist" && view !== "parallel" && !station) ||
              (view !== "calendar"
                ? view === "hist"
                  ? !startDateTime || !endDateTime
                  : view === "parallel"
                  ? !startDateTime ||
                    !endDateTime ||
                    !(stationsMulti && stationsMulti.length)
                  : view === "rose"
                  ? timePeriod === "periodic" &&
                    (!startDateTime || !endDateTime)
                  : timePeriod === "periodic" &&
                    (!startDateTime || !endDateTime)
                : !startDateTime || !endDateTime)
            }
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
          <DownloadReport
            darkMode={darkMode}
            label="Download"
            size="sm"
            filenamePrefix={`adv_${view}`}
            csv={{
              headers:
                view === "calendar"
                  ? ["Date", labelWithUnitExport(p1)]
                  : view === "rose"
                  ? [
                      "Direction",
                      ...(pollutantCategories[p1] || []).map((c) => c.name),
                    ]
                  : view === "parallel"
                  ? parallelCalc.table.headers
                  : view === "hist"
                  ? histCalc.table.headers
                  : [
                      "Time",
                      view === "xy"
                        ? `${labelWithUnitExport(p1)} vs ${labelWithUnitExport(
                            p2
                          )}`
                        : `${labelWithUnitExport(p1)}/${labelWithUnitExport(
                            p2
                          )}`,
                      // Don't add Status column if both p1 and p2 are AQI
                      ...(p1 !== "AQI" || p2 !== "AQI" ? ["Status"] : []),
                      ...(view === "2y" && p1 === "AQI"
                        ? ["Dominant Pollutant (Y1)"]
                        : []),
                      ...(view === "2y" && p2 === "AQI"
                        ? ["Dominant Pollutant (Y2)"]
                        : []),
                    ],
              rows:
                view === "calendar"
                  ? calendarCells.map((c) => [
                      c.date ? format(c.date, "yyyy-MM-dd") : "",
                      c.value != null ? String(c.value) : "",
                    ])
                  : view === "rose"
                  ? (() => {
                      const cats = pollutantCategories[p1] || [];
                      const sectorCount = 8;
                      const sectorSize = 360 / sectorCount;
                      const counts = Array(sectorCount)
                        .fill(0)
                        .map(() => ({}));
                      rows.forEach((row) => {
                        let wd = parseFloat(row.WD);
                        const value = parseFloat(row[p1]);
                        if (
                          isNaN(wd) ||
                          isNaN(value) ||
                          String(value) === "-9999.0000000"
                        )
                          return;
                        if (roseWindDirection === "to") wd = (wd + 180) % 360;
                        const sector =
                          Math.floor(((wd + 360) % 360) / sectorSize) %
                          sectorCount;
                        const cat = (cats || []).find((c) => {
                          const r = c.range;
                          if (r.includes("-")) {
                            const [min, max] = r
                              .split("-")
                              .map((v) =>
                                parseFloat(v.replace(/[^\d.-]/g, ""))
                              );
                            return value >= min && value <= max;
                          } else if (r.includes("<")) {
                            const max = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value < max;
                          } else if (r.includes(">")) {
                            const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value > min;
                          } else if (r.includes("+")) {
                            const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value >= min;
                          }
                          return false;
                        });
                        if (!cat) return;
                        counts[sector][cat.name] =
                          (counts[sector][cat.name] || 0) + 1;
                      });
                      return counts.map((obj, i) => {
                        const total =
                          Object.values(obj).reduce((a, b) => a + b, 0) || 1;
                        const percs = cats.map((c) =>
                          Math.round(((obj[c.name] || 0) / total) * 100)
                        );
                        const sum = percs.reduce((a, b) => a + b, 0);
                        if (sum !== 100) {
                          const maxIdx = percs.findIndex(
                            (p) => p === Math.max(...percs)
                          );
                          percs[maxIdx] += 100 - sum;
                        }
                        const label =
                          ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][i] ||
                          String(i);
                        return [label, ...percs.map((v) => `${v}%`)];
                      });
                    })()
                  : view === "parallel"
                  ? parallelCalc.table.rows
                  : view === "hist"
                  ? histCalc.table.rows
                  : rows.map((r) => {
                      const status1 = r[`Status_${p1}`];
                      const status2 = r[`Status_${p2}`];
                      const hasError1 = status1 && status1 !== "Valid";
                      const hasError2 = status2 && status2 !== "Valid";
                      const status =
                        hasError1 || hasError2
                          ? hasError1
                            ? status1
                            : status2
                          : "";
                      const base = [
                        r.Date_Time || "",
                        view === "xy"
                          ? `${r[p1] ?? ""},${r[p2] ?? ""}`
                          : `${r[p1] ?? ""},${r[p2] ?? ""}`,
                      ];
                      // Don't add status if both p1 and p2 are AQI
                      if (p1 !== "AQI" || p2 !== "AQI") {
                        base.push(status);
                      }
                      if (view === "2y" && p1 === "AQI") {
                        base.push(r.Dominant_Pollutant ?? "");
                      }
                      if (view === "2y" && p2 === "AQI") {
                        base.push(r.Dominant_Pollutant ?? "");
                      }
                      return base;
                    }),
            }}
            table={{
              headers:
                view === "calendar"
                  ? ["Date", labelWithUnitUI(p1)]
                  : view === "rose"
                  ? [
                      "Direction",
                      ...(pollutantCategories[p1] || []).map((c) => c.name),
                    ]
                  : view === "parallel"
                  ? parallelCalc.table.headers
                  : view === "hist"
                  ? histCalc.table.headers
                  : [
                      "Time",
                      view === "xy"
                        ? `${labelWithUnitUI(p1)} vs ${labelWithUnitUI(p2)}`
                        : `${labelWithUnitUI(p1)}/${labelWithUnitUI(p2)}`,
                      // Don't add Status column if both p1 and p2 are AQI
                      ...(p1 !== "AQI" || p2 !== "AQI" ? ["Status"] : []),
                    ],
              rows:
                view === "calendar"
                  ? calendarCells.map((c) => [
                      c.date ? format(c.date, "yyyy-MM-dd") : "",
                      c.value != null ? String(c.value) : "",
                    ])
                  : view === "rose"
                  ? (() => {
                      const cats = pollutantCategories[p1] || [];
                      const sectorCount = 8;
                      const sectorSize = 360 / sectorCount;
                      const counts = Array(sectorCount)
                        .fill(0)
                        .map(() => ({}));
                      rows.forEach((row) => {
                        let wd = parseFloat(row.WD);
                        const value = parseFloat(row[p1]);
                        if (
                          isNaN(wd) ||
                          isNaN(value) ||
                          String(value) === "-9999.0000000"
                        )
                          return;
                        if (roseWindDirection === "to") wd = (wd + 180) % 360;
                        const sector =
                          Math.floor(((wd + 360) % 360) / sectorSize) %
                          sectorCount;
                        const cat = (cats || []).find((c) => {
                          const r = c.range;
                          if (r.includes("-")) {
                            const [min, max] = r
                              .split("-")
                              .map((v) =>
                                parseFloat(v.replace(/[^\d.-]/g, ""))
                              );
                            return value >= min && value <= max;
                          } else if (r.includes("<")) {
                            const max = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value < max;
                          } else if (r.includes(">")) {
                            const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value > min;
                          } else if (r.includes("+")) {
                            const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                            return value >= min;
                          }
                          return false;
                        });
                        if (!cat) return;
                        counts[sector][cat.name] =
                          (counts[sector][cat.name] || 0) + 1;
                      });
                      return counts.map((obj, i) => {
                        const total =
                          Object.values(obj).reduce((a, b) => a + b, 0) || 1;
                        const percs = cats.map((c) =>
                          Math.round(((obj[c.name] || 0) / total) * 100)
                        );
                        const sum = percs.reduce((a, b) => a + b, 0);
                        if (sum !== 100) {
                          const maxIdx = percs.findIndex(
                            (p) => p === Math.max(...percs)
                          );
                          percs[maxIdx] += 100 - sum;
                        }
                        const label =
                          ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][i] ||
                          String(i);
                        return [label, ...percs.map((v) => `${v}%`)];
                      });
                    })()
                  : view === "parallel"
                  ? parallelCalc.table.rows
                  : view === "hist"
                  ? histCalc.table.rows
                  : rows.map((r) => {
                      const status1 = r[`Status_${p1}`];
                      const status2 = r[`Status_${p2}`];
                      const hasError1 = status1 && status1 !== "Valid";
                      const hasError2 = status2 && status2 !== "Valid";
                      const status =
                        hasError1 || hasError2
                          ? hasError1
                            ? status1
                            : status2
                          : "";
                      const row = [
                        r.Date_Time || "",
                        view === "xy"
                          ? `${r[p1] ?? ""},${r[p2] ?? ""}`
                          : `${r[p1] ?? ""},${r[p2] ?? ""}`,
                      ];
                      // Don't add status if both p1 and p2 are AQI
                      if (p1 !== "AQI" || p2 !== "AQI") {
                        row.push(status);
                      }
                      return row;
                    }),
            }}
            chartType={
              view === "xy"
                ? "scatter"
                : view === "calendar"
                ? undefined
                : view === "hist"
                ? "bar"
                : view === "parallel"
                ? "line"
                : "line"
            }
            chartData={
              view === "xy"
                ? xyData
                : view === "2y"
                ? twoYData
                : view === "hist"
                ? histCalc.data
                : view === "parallel"
                ? parallelCalc.data
                : undefined
            }
            chartOptions={
              view === "xy"
                ? xyOptions
                : view === "2y"
                ? twoYOptions
                : view === "hist"
                ? histCalc.options
                : view === "parallel"
                ? parallelCalc.options
                : undefined
            }
            extraHtmlRef={
              view === "calendar"
                ? calendarRef
                : view === "rose"
                ? roseRef
                : undefined
            }
          />
        </Col>
      </Row>

      <div
        className="flex-grow-1 position-relative mt-3"
        style={{ overflow: "visible", width: "100%", zIndex: 1 }}
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

        {!loading && !error && view === "2y" && rows.length > 0 && (
          <Line options={twoYOptions} data={twoYData} />
        )}

        {!loading && !error && view === "xy" && rows.length > 0 && (
          <Scatter data={xyData} options={xyOptions} />
        )}

        {!loading &&
          !error &&
          view === "hist" &&
          histCalc.data.labels.length > 0 && (
            <>
              <div style={{ height: "60vh" }}>
                <Bar data={histCalc.data} options={histCalc.options} />
              </div>
              <div
                className="mt-2"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                {histCalc.data.datasets.map((ds, i) => (
                  <div
                    key={`hist-leg-${i}`}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: ds.borderColor,
                        display: "inline-block",
                        border: "1px solid rgba(0,0,0,0.2)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: darkMode ? "#f0f0f0" : "#666",
                      }}
                    >
                      {ds.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

        {!loading &&
          !error &&
          view === "parallel" &&
          (parallelMode === "graphical" ? (
            <div style={{ height: "60vh" }}>
              <Line data={parallelCalc.data} options={parallelCalc.options} />
            </div>
          ) : parallelCalc.table.headers.length ? (
            <div
              className={`table-responsive w-100 ${
                darkMode ? "dark-mode" : ""
              }`}
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
                >
                  <tr>
                    {parallelCalc.table.headers.map((h) => (
                      <th key={h} className="border-end">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parallelCalc.table.rows.map((row, idx) => (
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
          ) : null)}

        {!loading &&
          !error &&
          view === "rose" &&
          (roseMode === "graphical" ? (
            <div
              ref={roseRef}
              className="rose-export"
              style={{ height: "60vh" }}
            >
              <PollutionRose
                data={rows}
                pollutant={p1}
                darkMode={darkMode}
                sectorCount={8}
                windDirectionType={roseWindDirection}
              />
            </div>
          ) : (
            (() => {
              const cats = pollutantCategories[p1] || [];
              const sectorCount = 8;
              const sectorSize = 360 / sectorCount;
              const counts = Array(sectorCount)
                .fill(0)
                .map(() => ({}));
              rows.forEach((row) => {
                let wd = parseFloat(row.WD);
                const value = parseFloat(row[p1]);
                if (
                  isNaN(wd) ||
                  isNaN(value) ||
                  String(value) === "-9999.0000000"
                )
                  return;
                if (roseWindDirection === "to") wd = (wd + 180) % 360;
                const sector =
                  Math.floor(((wd + 360) % 360) / sectorSize) % sectorCount;
                const cat = (cats || []).find((c) => {
                  const r = c.range;
                  if (r.includes("-")) {
                    const [min, max] = r
                      .split("-")
                      .map((v) => parseFloat(v.replace(/[^\d.-]/g, "")));
                    return value >= min && value <= max;
                  } else if (r.includes("<")) {
                    const max = parseFloat(r.replace(/[^\d.-]/g, ""));
                    return value < max;
                  } else if (r.includes(">")) {
                    const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                    return value > min;
                  } else if (r.includes("+")) {
                    const min = parseFloat(r.replace(/[^\d.-]/g, ""));
                    return value >= min;
                  }
                  return false;
                });
                if (!cat) return;
                counts[sector][cat.name] = (counts[sector][cat.name] || 0) + 1;
              });
              const headers = ["Direction", ...cats.map((c) => c.name)];
              const rowsTable = counts.map((obj, i) => {
                const total =
                  Object.values(obj).reduce((a, b) => a + b, 0) || 1;
                const percs = cats.map((c) =>
                  Math.round(((obj[c.name] || 0) / total) * 100)
                );
                const sum = percs.reduce((a, b) => a + b, 0);
                if (sum !== 100) {
                  const maxIdx = percs.findIndex(
                    (p) => p === Math.max(...percs)
                  );
                  percs[maxIdx] += 100 - sum;
                }
                const label =
                  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][i] || String(i);
                return [label, ...percs.map((v) => `${v}%`)];
              });
              return (
                <div
                  className={`table-responsive w-100 ${
                    darkMode ? "dark-mode" : ""
                  }`}
                  style={{ maxHeight: "70vh", overflow: "auto" }}
                >
                  <table
                    className={`table table-sm ${
                      darkMode ? "table-dark" : "table-light"
                    } table-striped table-bordered`}
                  >
                    <thead
                      className="sticky-top"
                      style={{
                        backgroundColor: darkMode ? "#343a40" : "#f8f9fa",
                      }}
                    >
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="border-end">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowsTable.map((row, idx) => (
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
              );
            })()
          ))}

        {!loading && !error && view === "calendar" && (
          <div
            className="w-100 calendar-export"
            style={{ maxHeight: "70vh", overflow: "auto" }}
            ref={calendarRef}
          >
            {calendarGroups.map((g, gi) => (
              <div key={`grp-${gi}`} className="mb-3">
                <div
                  className="month"
                  style={{ fontWeight: 600, marginBottom: 6 }}
                >
                  {g.label}
                </div>
                <div
                  className="d-grid"
                  style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}
                >
                  {Array.from({ length: g.leading }).map((_, i) => (
                    <div key={`pad-${gi}-${i}`}></div>
                  ))}
                  {g.items.map((c, idx) => {
                    const val = c.value;
                    const bg =
                      val != null && !isNaN(Number(val))
                        ? getPollutantColor(Number(val), p1)
                        : "#dee2e6";
                    const displayVal =
                      val != null && !isNaN(Number(val))
                        ? Number(val).toFixed(2)
                        : "";
                    return (
                      <div
                        key={`cell-${gi}-${idx}`}
                        className="text-center cal-cell"
                        style={{
                          background: bg,
                          color: "#000",
                          padding: 10,
                          minHeight: 80,
                          borderRadius: 6,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-start",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {format(c.date, "d MMM")}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11 }}>
                          {displayVal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Minimal legend for calendar */}
            <div
              className="mt-3"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
              }}
            >
              {(pollutantCategories[p1] || []).map((cat, ci) => (
                <div
                  key={`leg-${ci}`}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: cat.color,
                      display: "inline-block",
                      border: "1px solid rgba(0,0,0,0.2)",
                    }}
                  />
                  <span
                    className="legend-text"
                    style={{
                      fontSize: 12,
                      color: darkMode ? "#f0f0f0" : "#666",
                    }}
                  >
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
