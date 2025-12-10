import React, { useState, useEffect, useMemo } from "react";
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
import "chartjs-adapter-date-fns"; // Import adapter
import { parseISO, format } from "date-fns"; // No longer need subHours/subMonths here

import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import CloseButton from "react-bootstrap/CloseButton";
import ToggleButton from "react-bootstrap/ToggleButton";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import Dropdown from "react-bootstrap/Dropdown";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import DownloadReport from "./DownloadReport.jsx";
import {
  labelWithUnitUI,
  labelWithUnitExport,
  normalizeUnitForExport,
  displayNameForKey,
} from "../data/units.js";
import { isErrorValue } from "../utils/errors.ts";

import "./InfoPanel.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale, // For labels if not using time scale strictly
  LinearScale, // For AQI values (Y-axis)
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale // For time-based X-axis
);

// Define available pollutants with units and colors
const pollutantTypes = {
  ALL: {
    label: "All Pollutants",
    color: "rgb(75, 192, 192)",
    unit: "Multiple",
  },
  AQI: { label: "AQI", color: "rgb(75, 192, 192)", unit: "AQI" },
  O3: { label: "Ozone (O₃)", color: "rgb(54, 162, 235)", unit: "µg/m³" },
  CO: {
    label: "Carbon Monoxide (CO)",
    color: "rgb(153, 102, 255)",
    unit: "mg/m³",
  },
  SO2: {
    label: "Sulfur Dioxide (SO₂)",
    color: "rgb(255, 159, 64)",
    unit: "µg/m³",
  },
  NO: { label: "NO", color: "rgb(128, 0, 128)", unit: "µg/m³" },
  NO2: {
    label: "Nitrogen Dioxide (NO₂)",
    color: "rgb(255, 206, 86)",
    unit: "µg/m³",
  },
  NOX: {
    label: "Nitrogen Oxides (NOₓ)",
    color: "rgb(255, 69, 0)",
    unit: "µg/m³",
  },
  PM10: {
    label: "Particulate Matter (PM10)",
    color: "rgb(46, 139, 87)",
    unit: "µg/m³",
  },
  PM25: {
    label: "Particulate Matter (PM2.5)",
    color: "rgb(255, 99, 132)",
    unit: "µg/m³",
  },
  WS: { label: "Wind Speed", color: "rgb(119, 136, 153)", unit: "m/s" },
  WD: { label: "Wind Direction", color: "rgb(128, 128, 128)", unit: "°" },
  Temp: { label: "Temperature", color: "rgb(255, 0, 0)", unit: "°C" },
  RH: { label: "Relative Humidity", color: "rgb(173, 216, 230)", unit: "%" },
  BP: { label: "Barometric Pressure", color: "rgb(165, 42, 42)", unit: "hPa" },
  Rain: { label: "Rainfall", color: "rgb(0, 0, 139)", unit: "mm" },
  SR: { label: "Solar Radiation", color: "rgb(128, 0, 128)", unit: "W/m²" },
};

// Define pollutants array for tabular view (excluding ALL option for individual pollutant selection)
const pollutants = Object.keys(pollutantTypes).filter((key) => key !== "ALL");

// Default chart options (minor tweaks for potentially multiple datasets)
const getChartOptionsBase = (darkMode) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    // Improve tooltip behavior with multiple lines
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      display: false, // Legend less useful for single dataset bar chart
      labels: {
        color: darkMode ? "#f0f0f0" : "#666",
      },
    },
    title: {
      display: true,
      color: darkMode ? "#f0f0f0" : "#666",
      // Title set dynamically based on time view
    },
    tooltip: {
      // Tooltip callbacks can customize display further if needed
      backgroundColor: darkMode ? "#2d3032" : "rgba(0, 0, 0, 0.7)",
      titleColor: darkMode ? "#f0f0f0" : "#fff",
      bodyColor: darkMode ? "#f0f0f0" : "#fff",
      borderColor: darkMode ? "#3a3f42" : "rgba(0, 0, 0, 0.1)",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      type: "time",
      grid: {
        color: darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      },
      time: {
        // Unit and displayFormats are set dynamically below
        tooltipFormat: "Pp", // Format for the tooltip (e.g., Jul 21, 2024, 12:00:00 PM)
      },
      title: {
        display: true,
        text: "Time",
        color: darkMode ? "#f0f0f0" : "#666",
      },
      ticks: {
        // Automatically adapt ticks based on unit and range
        // You could add maxTicksLimit here if needed, e.g., maxTicksLimit: 15
        autoSkip: true,
        maxRotation: 0, // Keep labels horizontal
        minRotation: 0,
        color: darkMode ? "#f0f0f0" : "#666",
      },
    },
    y: {
      grid: {
        color: darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      },
      title: {
        display: true,
        color: darkMode ? "#f0f0f0" : "#666",
        // text set dynamically based on selected pollutant unit
      },
      beginAtZero: true, // Start Y-axis at 0 is often clearer
      ticks: {
        color: darkMode ? "#f0f0f0" : "#666",
      },
    },
  },
  // Performance optimization for large datasets
  parsing: false, // We are providing data in the correct {x, y} format
  // animation: false // Disable animations for performance if needed
});

function InfoPanel({ location, onClose, apiBaseUrl, darkMode = false }) {
  const [timeView, setTimeView] = useState("daily");
  const [selectedPollutant, setSelectedPollutant] = useState("AQI");
  const [chartApiData, setChartApiData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [selectedInterval, setSelectedInterval] = useState("60");
  const [viewMode, setViewMode] = useState("graphical"); // 'graphical' or 'tabular'

  // Cache for daily and monthly data with timestamps
  const [dailyDataCache, setDailyDataCache] = useState({});
  const [monthlyDataCache, setMonthlyDataCache] = useState({});
  const [cacheTimestamps, setCacheTimestamps] = useState({});

  // State for visible pollutants when "All" is selected
  const [visiblePollutants, setVisiblePollutants] = useState(
    new Set(pollutants)
  );

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const API_KEY = import.meta.env.VITE_API_KEY;

  // Cache expiration time (1 hour in milliseconds)
  const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

  // Check if cache is expired
  const isCacheExpired = (timestamp) => {
    if (!timestamp) return true;
    return Date.now() - timestamp > CACHE_EXPIRY;
  };

  // Toggle pollutant visibility
  const togglePollutantVisibility = (pollutant) => {
    setVisiblePollutants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pollutant)) {
        newSet.delete(pollutant);
      } else {
        newSet.add(pollutant);
      }
      return newSet;
    });
  };

  // Download data as CSV file
  const downloadCSV = () => {
    if (!chartApiData || chartApiData.length === 0) return;

    // Define the exact order and short names for columns
    const columnOrder = [
      { key: "Date_Time", label: "Date & Time", unit: "" },
      { key: "O3", label: "O3", unit: "ppb" },
      { key: "CO", label: "CO", unit: "ppm" },
      { key: "SO2", label: "SO2", unit: "ppb" },
      { key: "NO", label: "NO", unit: "ppb" },
      { key: "NO2", label: "NO2", unit: "ppb" },
      { key: "NOX", label: "NOX", unit: "ppb" },
      { key: "PM10", label: "PM10", unit: "µg/m3" },
      { key: "PM25", label: "PM2.5", unit: "µg/m3" },
      { key: "WS", label: "WS", unit: "m/s" },
      { key: "WD", label: "WD", unit: "Deg" },
      { key: "Temp", label: "TEMPERAT", unit: "C°" },
      { key: "RH", label: "RH", unit: "%" },
      { key: "BP", label: "BP", unit: "hPa" },
      { key: "Rain", label: "Rain", unit: "mm" },
      { key: "SR", label: "SR", unit: "W/m²" },
      { key: "AQI", label: "AQI", unit: "" },
    ];

    // Prepare headers and units
    const headers = columnOrder.map((col) => col.label);
    const units = columnOrder.map((col) => col.unit);

    // Prepare data rows
    const dataRows = chartApiData.map((row) => {
      return columnOrder.map((col) => {
        if (col.key === "Date_Time") {
          // Format date as DD/MM/YYYY HH:mm
          const d = row.Date_Time ? new Date(row.Date_Time) : null;
          if (!d || isNaN(d)) return "";
          const pad = (n) => n.toString().padStart(2, "0");
          return `${pad(d.getDate())}/${pad(
            d.getMonth() + 1
          )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        let value = row[col.key];
        if (col.key === "PM2.5") value = row["PM25"]; // handle PM2.5 alias
        if (value !== null && value !== undefined) {
          // Always round to 3 decimal places for all pollutants
          return parseFloat(value).toFixed(3);
        } else {
          return "N/A";
        }
      });
    });

    // Combine all rows
    const csvData = [headers, units, ...dataRows];

    // Convert to CSV format (CSV can open CSV files)
    const csvContent = csvData
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${location.name}_ALL_${timeView}_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset visible pollutants when switching to "All"
  useEffect(() => {
    if (selectedPollutant === "ALL") {
      setVisiblePollutants(new Set(pollutants));
    }
  }, [selectedPollutant]);

  // Fetch historical data when location or timeView changes
  useEffect(() => {
    if (!location || timeView === "periodic") return;

    const fetchData = async () => {
      setChartLoading(true);
      setChartError(null);

      // Check if we already have cached data for this location and timeView
      const cacheKey = location.name;
      const timestampKey = `${cacheKey}_${timeView}`;
      const cachedTimestamp = cacheTimestamps[timestampKey];

      // Check if cache exists and is not expired
      if (
        timeView === "daily" &&
        dailyDataCache[cacheKey] &&
        !isCacheExpired(cachedTimestamp)
      ) {
        setChartApiData(dailyDataCache[cacheKey]);
        setChartLoading(false);
        return;
      }
      if (
        timeView === "monthly" &&
        monthlyDataCache[cacheKey] &&
        !isCacheExpired(cachedTimestamp)
      ) {
        setChartApiData(monthlyDataCache[cacheKey]);
        setChartLoading(false);
        return;
      }

      setChartApiData([]); // Clear previous data

      // Use single-station endpoints for better performance
      const endpoint =
        timeView === "daily"
          ? `/daily/${encodeURIComponent(location.id)}`
          : `/monthly/${encodeURIComponent(location.id)}`;
      const url = `${API_BASE_URL}${endpoint}`;

      try {
        const response = await fetch(url, {
          headers: {
            "X-API-Key": API_KEY,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
          throw new Error(`API Error: ${data.error}`);
        }

        // Extract data specifically for the selected location
        const locationData = data[location.id];

        if (
          !locationData ||
          (Array.isArray(locationData) &&
            locationData.length > 0 &&
            locationData[0].error)
        ) {
          throw new Error(
            locationData?.[0]?.error || "No data available for this station."
          );
        } else if (Array.isArray(locationData)) {
          setChartApiData(locationData);

          // Cache the data with current timestamp
          const currentTimestamp = Date.now();
          if (timeView === "daily") {
            setDailyDataCache((prev) => ({
              ...prev,
              [cacheKey]: locationData,
            }));
            setCacheTimestamps((prev) => ({
              ...prev,
              [timestampKey]: currentTimestamp,
            }));
          } else if (timeView === "monthly") {
            setMonthlyDataCache((prev) => ({
              ...prev,
              [cacheKey]: locationData,
            }));
            setCacheTimestamps((prev) => ({
              ...prev,
              [timestampKey]: currentTimestamp,
            }));
          }
        } else {
          throw new Error("Invalid data format received from API.");
        }
      } catch (error) {
        console.error(`Failed to fetch ${timeView} data:`, error);
        setChartError(`Failed to load chart data: ${error.message}`);
      } finally {
        setChartLoading(false);
      }
    };

    fetchData();
  }, [
    location?.id,
    timeView,
    API_BASE_URL,
    location?.name,
    dailyDataCache,
    monthlyDataCache,
    cacheTimestamps,
  ]);

  // Clear cache when location changes
  useEffect(() => {
    if (location) {
      // Clear cache for previous location to prevent memory buildup
      setDailyDataCache({});
      setMonthlyDataCache({});
      setCacheTimestamps({});
    }
  }, [location?.id]);

  // Auto-refresh cache every hour
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (location && timeView !== "periodic") {
        // Force refresh by clearing cache timestamps
        const cacheKey = location.name;
        const dailyTimestampKey = `${cacheKey}_daily`;
        const monthlyTimestampKey = `${cacheKey}_monthly`;

        setCacheTimestamps((prev) => ({
          ...prev,
          [dailyTimestampKey]: null,
          [monthlyTimestampKey]: null,
        }));
      }
    }, CACHE_EXPIRY);

    return () => clearInterval(refreshInterval);
  }, [location?.id, timeView]);

  // New function to fetch periodic data
  const fetchPeriodicData = async () => {
    if (!location || !startDateTime || !endDateTime) return;

    setChartLoading(true);
    setChartError(null);
    setChartApiData([]);

    try {
      // Format the datetime values to match backend's expected format
      const formattedStartDateTime = format(
        new Date(startDateTime),
        "yyyy-MM-dd HH:mm:ss"
      );
      const formattedEndDateTime = format(
        new Date(endDateTime),
        "yyyy-MM-dd HH:mm:ss"
      );

      // Use single-station periodic endpoint
      const url = `${API_BASE_URL}/periodic/${encodeURIComponent(
        location.id
      )}?start_datetime=${encodeURIComponent(
        formattedStartDateTime
      )}&end_datetime=${encodeURIComponent(
        formattedEndDateTime
      )}&interval=${selectedInterval}`;
      const response = await fetch(url, {
        headers: {
          "X-API-Key": API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`API Error: ${data.error}`);
      }

      const locationData = data[location.id];

      if (
        !locationData ||
        (Array.isArray(locationData) &&
          locationData.length > 0 &&
          locationData[0].error)
      ) {
        throw new Error(
          locationData?.[0]?.error || "No data available for this station."
        );
      } else if (Array.isArray(locationData)) {
        setChartApiData(locationData);
      } else {
        throw new Error("Invalid data format received from API.");
      }
    } catch (error) {
      console.error("Failed to fetch periodic data:", error);
      setChartError(`Failed to load chart data: ${error.message}`);
    } finally {
      setChartLoading(false);
    }
  };

  // Memoize chart data structure using fetched chartApiData
  const chartData = useMemo(() => {
    const config = pollutantTypes[selectedPollutant];
    if (!config || !chartApiData || chartApiData.length === 0)
      return { datasets: [] };

    if (selectedPollutant === "ALL") {
      // Create multiple datasets for visible pollutants only
      const allDatasets = pollutants
        .filter((pollutant) => visiblePollutants.has(pollutant))
        .map((pollutant) => {
          const pollutantConfig = pollutantTypes[pollutant];
          const validDataPoints = chartApiData
            .map((d) => ({
              x: parseISO(d.Date_Time),
              y:
                d[pollutant] !== null && d[pollutant] !== undefined
                  ? parseFloat(d[pollutant])
                  : null,
            }))
            .filter((p) => p.y !== null && !isNaN(p.x));

          return {
            label: pollutantConfig.label,
            data: validDataPoints,
            backgroundColor: pollutantConfig.color
              .replace("rgb", "rgba")
              .replace(")", ", 0.7)"),
            borderColor: pollutantConfig.color,
            borderWidth: 1,
          };
        })
        .filter((dataset) => dataset.data.length > 0);

      return { datasets: allDatasets };
    } else {
      // Single pollutant dataset
      const validDataPoints = chartApiData
        .map((d) => ({
          x: parseISO(d.Date_Time),
          y:
            d[selectedPollutant] !== null && d[selectedPollutant] !== undefined
              ? parseFloat(d[selectedPollutant])
              : null,
        }))
        .filter((p) => p.y !== null && !isNaN(p.x));

      return {
        datasets: [
          {
            label: config.label,
            data: validDataPoints,
            backgroundColor: config.color
              .replace("rgb", "rgba")
              .replace(")", ", 0.7)"),
            borderColor: config.color,
            borderWidth: 1,
          },
        ],
      };
    }
  }, [chartApiData, selectedPollutant, visiblePollutants]);

  // Memoize chart options - dynamically set Y-axis label and min/max for X-axis
  const dynamicChartOptions = useMemo(() => {
    const options = structuredClone(getChartOptionsBase(darkMode));
    const pollutantConfig = pollutantTypes[selectedPollutant];

    // --- Disable the chart's internal title ---
    options.plugins.title.display = false;
    // --- Title disabled ---

    // Show legend when ALL pollutants are selected
    options.plugins.legend.display = false; // Disable default legend, use custom checkbox legend instead

    options.scales.x.time.unit = timeView === "daily" ? "hour" : "day";
    options.scales.x.time.displayFormats =
      timeView === "daily" ? { hour: "HH:mm" } : { day: "MMM d" };

    // Set min/max based on the *actual* fetched data range for better fit
    if (chartApiData && chartApiData.length > 0) {
      const timestamps = chartApiData
        .map((d) => parseISO(d.Date_Time))
        .filter((d) => !isNaN(d));
      if (timestamps.length > 0) {
        options.scales.x.min = timestamps[0].toISOString(); // First timestamp (data is reversed in backend)
        options.scales.x.max = timestamps[timestamps.length - 1].toISOString(); // Last timestamp
      }
    }

    options.scales.y.title.text =
      selectedPollutant === "ALL"
        ? "Multiple Pollutants"
        : pollutantConfig?.unit
        ? `${pollutantConfig.label} (${pollutantConfig.unit})`
        : "Value";

    return options;
  }, [timeView, selectedPollutant, chartApiData, darkMode]); // Added darkMode dependency

  // Helpers to format labels with units (shared)
  const formatLabelWithUnitUI = (key) => {
    const cfg = pollutantTypes[key] || {};
    return labelWithUnitUI(key, cfg.label || key);
  };
  const formatLabelWithUnitExport = (key) => {
    const cfg = pollutantTypes[key] || {};
    return labelWithUnitExport(key, cfg.label || key);
  };

  // Prepare tabular data
  const tabularData = useMemo(() => {
    if (!chartApiData || chartApiData.length === 0) return [];

    return chartApiData.map((row) => {
      const tableRow = {
        dateTime: row.Date_Time,
      };

      if (selectedPollutant === "ALL") {
        // Show all pollutants
        pollutants.forEach((pollutant) => {
          const key = pollutant === "PM2.5" ? "PM25" : pollutant;
          const statusKey = `Status_${key}`;
          let value = row[key];
          const statusValue = row[statusKey];

          tableRow[pollutant] =
            value !== null &&
            value !== undefined &&
            String(value) !== "-9999.0000000"
              ? parseFloat(value).toFixed(3)
              : null;

          // Don't show status for AQI
          if (pollutant !== "AQI") {
            tableRow[`${pollutant}_status`] =
              statusValue && statusValue !== "Valid" ? statusValue : null;
          }
        });
        tableRow.Dominant_Pollutant = row.Dominant_Pollutant || null;
      } else {
        // Show only selected pollutant
        const key = selectedPollutant === "PM2.5" ? "PM25" : selectedPollutant;
        const statusKey = `Status_${key}`;
        let value = row[key];
        const statusValue = row[statusKey];

        tableRow[selectedPollutant] =
          value !== null &&
          value !== undefined &&
          String(value) !== "-9999.0000000"
            ? parseFloat(value).toFixed(3)
            : null;

        // Don't show status for AQI
        if (selectedPollutant !== "AQI") {
          tableRow[`${selectedPollutant}_status`] =
            statusValue && statusValue !== "Valid" ? statusValue : null;
        }

        if (selectedPollutant === "AQI") {
          tableRow.Dominant_Pollutant = row.Dominant_Pollutant || null;
        }
      }

      return tableRow;
    });
  }, [chartApiData, selectedPollutant]);

  const downloadData = useMemo(() => {
    if (!chartApiData) return { headers: [], rows: [] };

    const headers = ["Date & Time"];
    if (selectedPollutant === "ALL") {
      pollutants.forEach((p) => {
        headers.push(formatLabelWithUnitExport(p));
        // Don't add Status header for AQI
        if (p !== "AQI") {
          headers.push("Status");
        }
        if (p === "AQI") {
          headers.push("Dominant Pollutant");
        }
      });
    } else {
      headers.push(formatLabelWithUnitExport(selectedPollutant));
      // Don't add Status header for AQI
      if (selectedPollutant !== "AQI") {
        headers.push("Status");
      }
      if (selectedPollutant === "AQI") {
        headers.push("Dominant Pollutant");
      }
    }

    const rows = chartApiData.map((row) => {
      const d = row.Date_Time ? new Date(row.Date_Time) : null;
      const pad = (n) => n.toString().padStart(2, "0");
      const dt =
        d && !isNaN(d)
          ? `${pad(d.getDate())}/${pad(
              d.getMonth() + 1
            )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
          : "";

      const rowData = [dt];
      if (selectedPollutant === "ALL") {
        pollutants.forEach((p) => {
          const key = p === "PM2.5" ? "PM25" : p;
          const statusKey = `Status_${key}`;
          const value = row[key];
          const statusValue = row[statusKey];

          rowData.push(
            value != null && String(value) !== "-9999.0000000"
              ? parseFloat(value).toFixed(3)
              : "N/A"
          );

          // Don't add status column for AQI
          if (p !== "AQI") {
            rowData.push(
              statusValue && statusValue !== "Valid" ? statusValue : ""
            );
          }

          if (p === "AQI") {
            const dp = row.Dominant_Pollutant;
            rowData.push(dp ? displayNameForKey(dp) : "N/A");
          }
        });
      } else {
        const key = selectedPollutant === "PM2.5" ? "PM25" : selectedPollutant;
        const statusKey = `Status_${key}`;
        const value = row[key];
        const statusValue = row[statusKey];

        rowData.push(
          value != null && String(value) !== "-9999.0000000"
            ? parseFloat(value).toFixed(3)
            : "N/A"
        );

        // Don't add status column for AQI
        if (selectedPollutant !== "AQI") {
          rowData.push(
            statusValue && statusValue !== "Valid" ? statusValue : ""
          );
        }

        if (selectedPollutant === "AQI") {
          const dp = row.Dominant_Pollutant;
          rowData.push(dp ? displayNameForKey(dp) : "N/A");
        }
      }
      return rowData;
    });

    return { headers, rows };
  }, [chartApiData, selectedPollutant]);

  if (!location) return null; // Should not happen if rendered conditionally in App

  const selectedPollutantLabel =
    pollutantTypes[selectedPollutant]?.label || "Select Pollutant";
  const timeViewLabel =
    timeView === "daily"
      ? "Last 24 Hours"
      : timeView === "monthly"
      ? "Last Month"
      : "Custom Period";

  // --- Generate the title string for the panel header ---
  const panelTitle = `${location.name} - ${selectedPollutantLabel} (${timeViewLabel})`;
  // --- Panel title generated ---

  return (
    <div className={`info-panel ${darkMode ? "dark-mode" : ""}`}>
      <Container fluid className="h-100 d-flex flex-column">
        {/* Header Row */}
        <Row className="flex-shrink-0 align-items-center border-bottom pb-2 mb-3">
          <Col>
            <h4 className="mt-2 mb-0 panel-title-text">{panelTitle}</h4>
          </Col>
          <Col xs="auto">
            <CloseButton onClick={onClose} title="Close Panel" />
          </Col>
        </Row>

        {/* Controls Row */}
        <div className="mb-3 flex-shrink-0">
          {/* Mobile Layout - Stack controls vertically */}
          <div className="d-md-none">
            <Row className="mb-2">
              <Col xs={12} className="mb-2">
                <ToggleButtonGroup
                  type="radio"
                  name="timeViewOptions"
                  value={timeView}
                  onChange={setTimeView}
                  size="sm"
                  className="w-100"
                >
                  <ToggleButton
                    id="tbg-radio-daily-mobile"
                    value={"daily"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                    className="flex-fill"
                  >
                    Daily
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-radio-monthly-mobile"
                    value={"monthly"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                    className="flex-fill"
                  >
                    Monthly
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-radio-periodic-mobile"
                    value={"periodic"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                    className="flex-fill"
                  >
                    Periodic
                  </ToggleButton>
                </ToggleButtonGroup>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col xs={6} className="pe-1">
                <DownloadReport
                  darkMode={darkMode}
                  label="Download"
                  size="sm"
                  toggleClassName="w-100"
                  filenamePrefix={`${location.name}_${timeView}`}
                  csv={{
                    ...downloadData,
                    filename: `${location.name}_${timeView}_${new Date()
                      .toISOString()
                      .slice(0, 10)}.csv`,
                  }}
                  table={{
                    ...downloadData,
                  }}
                  chartType={"line"}
                  chartData={chartData}
                  chartOptions={dynamicChartOptions}
                />
              </Col>
              <Col xs={6} className="ps-1">
                <ToggleButtonGroup
                  type="radio"
                  name="viewModeOptions"
                  value={viewMode}
                  onChange={setViewMode}
                  size="sm"
                  className="w-100"
                >
                  <ToggleButton
                    id="tbg-radio-graphical-mobile"
                    value={"graphical"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                    className="flex-fill"
                  >
                    Chart
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-radio-tabular-mobile"
                    value={"tabular"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                    className="flex-fill"
                  >
                    Table
                  </ToggleButton>
                </ToggleButtonGroup>
              </Col>
            </Row>
            <Row className="mb-2">
              <Col xs={12}>
                <Dropdown
                  onSelect={setSelectedPollutant}
                  size="sm"
                  style={{ zIndex: 1050 }}
                >
                  <Dropdown.Toggle
                    variant={darkMode ? "outline-light" : "outline-primary"}
                    id="dropdown-pollutant-mobile"
                    className="w-100"
                  >
                    {selectedPollutantLabel}
                  </Dropdown.Toggle>
                  <Dropdown.Menu
                    className={darkMode ? "dark-mode" : ""}
                    style={{ zIndex: 1051 }}
                  >
                    {Object.entries(pollutantTypes).map(([key, config]) => (
                      <Dropdown.Item
                        key={key}
                        eventKey={key}
                        active={selectedPollutant === key}
                      >
                        {config.label}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Col>
            </Row>
          </div>

          {/* Desktop Layout - Keep original horizontal layout */}
          <Row className="d-none d-md-flex align-items-center justify-content-between">
            <Col xs="auto" className="mb-2 mb-md-0">
              <ToggleButtonGroup
                type="radio"
                name="timeViewOptions"
                value={timeView}
                onChange={setTimeView}
                size="sm"
              >
                <ToggleButton
                  id="tbg-radio-daily"
                  value={"daily"}
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                >
                  Daily
                </ToggleButton>
                <ToggleButton
                  id="tbg-radio-monthly"
                  value={"monthly"}
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                >
                  Monthly
                </ToggleButton>
                <ToggleButton
                  id="tbg-radio-periodic"
                  value={"periodic"}
                  variant={darkMode ? "outline-light" : "outline-secondary"}
                >
                  Periodic
                </ToggleButton>
              </ToggleButtonGroup>
            </Col>
            <Col xs="auto" className="mb-2 mb-md-0">
              <div className="d-flex align-items-center">
                <DownloadReport
                  darkMode={darkMode}
                  label="Download"
                  size="sm"
                  toggleClassName="me-2"
                  filenamePrefix={`${location.name}_${timeView}`}
                  csv={{
                    ...downloadData,
                    filename: `${location.name}_${timeView}_${new Date()
                      .toISOString()
                      .slice(0, 10)}.csv`,
                  }}
                  table={{
                    ...downloadData,
                  }}
                  chartType={"line"}
                  chartData={chartData}
                  chartOptions={dynamicChartOptions}
                />
                <ToggleButtonGroup
                  type="radio"
                  name="viewModeOptions"
                  value={viewMode}
                  onChange={setViewMode}
                  size="sm"
                  className="me-2"
                >
                  <ToggleButton
                    id="tbg-radio-graphical"
                    value={"graphical"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Graphical
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-radio-tabular"
                    value={"tabular"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Tabular
                  </ToggleButton>
                </ToggleButtonGroup>
                <Dropdown
                  onSelect={setSelectedPollutant}
                  size="sm"
                  style={{ zIndex: 1050 }}
                >
                  <Dropdown.Toggle
                    variant={darkMode ? "outline-light" : "outline-primary"}
                    id="dropdown-pollutant"
                  >
                    {selectedPollutantLabel}
                  </Dropdown.Toggle>
                  <Dropdown.Menu
                    className={darkMode ? "dark-mode" : ""}
                    style={{ zIndex: 1051 }}
                  >
                    {Object.entries(pollutantTypes).map(([key, config]) => (
                      <Dropdown.Item
                        key={key}
                        eventKey={key}
                        active={selectedPollutant === key}
                      >
                        {config.label}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>
          </Row>
        </div>

        {/* Periodic Date Selection Row */}
        {timeView === "periodic" && (
          <Row className="mb-3 flex-shrink-0 align-items-end">
            <Col xs={12} md={4} className="mb-2 mb-md-0">
              <Form.Group>
                <Form.Label>Start Date & Time</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className={darkMode ? "bg-dark text-light" : ""}
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={4} className="mb-2 mb-md-0">
              <Form.Group>
                <Form.Label>End Date & Time</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  className={darkMode ? "bg-dark text-light" : ""}
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={2} className="mb-2 mb-md-0">
              <Form.Group>
                <Form.Label>Interval</Form.Label>
                <Form.Select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
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
            <Col xs={12} md={2} className="mb-2 mb-md-0">
              <Button
                variant={darkMode ? "outline-light" : "primary"}
                onClick={fetchPeriodicData}
                disabled={!startDateTime || !endDateTime}
                className="w-100"
              >
                Get Data
              </Button>
            </Col>
          </Row>
        )}

        {/* Custom Legend with Checkboxes for "All" pollutants */}
        {selectedPollutant === "ALL" && viewMode === "graphical" && (
          <Row className="mb-3 flex-shrink-0">
            <Col>
              <div
                className={`legend-container ${darkMode ? "dark-mode" : ""}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "10px",
                  border: `1px solid ${darkMode ? "#495057" : "#dee2e6"}`,
                  borderRadius: "5px",
                  backgroundColor: darkMode ? "#343a40" : "#f8f9fa",
                }}
              >
                <span
                  className="legend-title"
                  style={{
                    fontWeight: "bold",
                    marginRight: "10px",
                    color: darkMode ? "#f0f0f0" : "#333",
                  }}
                >
                  Pollutants:
                </span>
                {pollutants.map((pollutant) => {
                  const config = pollutantTypes[pollutant];
                  const isVisible = visiblePollutants.has(pollutant);
                  return (
                    <label
                      key={pollutant}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        backgroundColor: isVisible
                          ? config.color
                              .replace("rgb", "rgba")
                              .replace(")", ", 0.2)")
                          : "transparent",
                        border: `1px solid ${
                          isVisible
                            ? config.color
                            : darkMode
                            ? "#6c757d"
                            : "#adb5bd"
                        }`,
                        color: darkMode ? "#f0f0f0" : "#333",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => togglePollutantVisibility(pollutant)}
                        style={{
                          marginRight: "5px",
                          accentColor: config.color,
                        }}
                      />
                      <span
                        style={{
                          color: isVisible
                            ? config.color
                            : darkMode
                            ? "#6c757d"
                            : "#adb5bd",
                          fontSize: "0.9em",
                        }}
                      >
                        {config.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Col>
          </Row>
        )}

        {/* Chart/Table Area */}
        <Row className="flex-grow-1">
          <Col className="chart-container d-flex justify-content-center align-items-center">
            {chartLoading && (
              <Spinner
                animation="border"
                variant={darkMode ? "light" : "primary"}
              />
            )}
            {!chartLoading && chartError && (
              <Alert variant="danger" className="w-75 text-center">
                {chartError}
              </Alert>
            )}
            {!chartLoading &&
              !chartError &&
              (chartApiData.length > 0 &&
              chartData.datasets.length > 0 &&
              chartData.datasets[0].data.length > 0 ? (
                viewMode === "graphical" ? (
                  <Line options={dynamicChartOptions} data={chartData} />
                ) : (
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
                        style={{
                          backgroundColor: darkMode ? "#343a40" : "#f8f9fa",
                        }}
                      >
                        <tr>
                          <th className="border-end">Date & Time</th>
                          {selectedPollutant === "ALL" ? (
                            pollutants.map((pollutant) => (
                              <React.Fragment key={pollutant}>
                                <th className="border-end">
                                  {formatLabelWithUnitUI(pollutant)}
                                </th>
                                {pollutant !== "AQI" && (
                                  <th className="border-end">Status</th>
                                )}
                                {pollutant === "AQI" && (
                                  <th className="border-end">
                                    Dominant Pollutant
                                  </th>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <th className="border-end">
                                {formatLabelWithUnitUI(selectedPollutant)}
                              </th>
                              {selectedPollutant !== "AQI" && (
                                <th className="border-end">Status</th>
                              )}
                              {selectedPollutant === "AQI" && (
                                <th className="border-end">
                                  Dominant Pollutant
                                </th>
                              )}
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {tabularData.map((row, index) => (
                          <tr key={index}>
                            <td className="border-end">{row.dateTime}</td>
                            {selectedPollutant === "ALL" ? (
                              pollutants.map((pollutant) => (
                                <React.Fragment key={pollutant}>
                                  <td className="border-end">
                                    {row[pollutant] !== null &&
                                    row[pollutant] !== undefined
                                      ? row[pollutant]
                                      : "N/A"}
                                  </td>
                                  {pollutant !== "AQI" && (
                                    <td className="border-end">
                                      {row[`${pollutant}_status`] || ""}
                                    </td>
                                  )}
                                  {pollutant === "AQI" && (
                                    <td className="border-end">
                                      {row.Dominant_Pollutant
                                        ? displayNameForKey(
                                            row.Dominant_Pollutant
                                          )
                                        : "N/A"}
                                    </td>
                                  )}
                                </React.Fragment>
                              ))
                            ) : (
                              <>
                                <td className="border-end">
                                  {row[selectedPollutant] !== null &&
                                  row[selectedPollutant] !== undefined
                                    ? row[selectedPollutant]
                                    : "N/A"}
                                </td>
                                {selectedPollutant !== "AQI" && (
                                  <td className="border-end">
                                    {row[`${selectedPollutant}_status`] || ""}
                                  </td>
                                )}
                                {selectedPollutant === "AQI" && (
                                  <td className="border-end">
                                    {row.Dominant_Pollutant
                                      ? displayNameForKey(
                                          row.Dominant_Pollutant
                                        )
                                      : "N/A"}
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="text-center text-muted mt-4">
                  No data available for the selected criteria.
                </p>
              ))}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default InfoPanel;
