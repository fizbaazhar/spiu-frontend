import React from "react";
import Dropdown from "react-bootstrap/Dropdown";
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

// Ensure the elements needed for exporting charts are registered here as well
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

/**
 * Reusable download component for CSV and PDF (chart + optional table)
 *
 * Props:
 * - darkMode: boolean (used only for toggle variant)
 * - label: string (button text, default "Download")
 * - size: string (bootstrap size, default "sm")
 * - variant: string (bootstrap variant; defaults to outline-light in darkMode, outline-secondary otherwise)
 * - filenamePrefix: string (prefix for filenames; date and extension are appended)
 * - csv: { headers: string[], rows: string[][], filename?: string }
 * - table: { headers: string[], rows: (string|number)[][] }
 * - chartType: string (e.g., "line", "scatter")
 * - chartData: Chart.js data object
 * - chartOptions: Chart.js options object
 * - extraHtmlRef: React ref to an element to serialize into PDF (e.g., calendar grid)
 */
export default function DownloadReport({
  darkMode,
  label = "Download",
  size = "sm",
  variant,
  filenamePrefix = "report",
  csv,
  table,
  chartType,
  chartData,
  chartOptions,
  extraHtmlRef,
  className,
  toggleClassName,
  style,
  toggleStyle,
}) {
  const btnVariant =
    variant || (darkMode ? "outline-light" : "outline-secondary");

  function downloadCSV() {
    if (!csv || !csv.headers || !csv.rows) return;
    const allRows = [csv.headers, ...csv.rows];
    const csvContent = allRows
      .map((row) => row.map((c) => `"${c ?? ""}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    const name = csv.filename || `${filenamePrefix}_${date}.csv`;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildLightOptions(base) {
    const light = structuredClone(base || {});
    light.responsive = false;
    light.maintainAspectRatio = false;
    if (!light.plugins) light.plugins = {};
    if (!light.plugins.legend) light.plugins.legend = {};
    if (!light.plugins.legend.labels) light.plugins.legend.labels = {};
    light.plugins.legend.labels.color = "#000";
    if (!light.plugins.title) light.plugins.title = {};
    light.plugins.title.color = "#000";
    if (!light.scales) light.scales = {};
    ["x", "y"].forEach((axisKey) => {
      if (!light.scales[axisKey]) light.scales[axisKey] = {};
      const axis = light.scales[axisKey];
      if (!axis.ticks) axis.ticks = {};
      axis.ticks.color = "#000";
      if (!axis.grid) axis.grid = {};
      axis.grid.color = "#e5e5e5";
    });
    light.animation = false;
    return light;
  }

  async function renderLightChartImageFromScratch() {
    if (!chartType || !chartData || !chartOptions) return null;
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    const baseW = 1200;
    const baseH = 500;
    canvas.width = Math.round(baseW * dpr);
    canvas.height = Math.round(baseH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseW, baseH);
    const dataClone = structuredClone(chartData);
    const opts = buildLightOptions(chartOptions);
    if (chartType === "scatter") {
      // Ensure linear scales and visible points for scatter exports
      if (!opts.scales) opts.scales = {};
      if (!opts.scales.x) opts.scales.x = {};
      if (!opts.scales.y) opts.scales.y = {};
      opts.scales.x.type = "linear";
      opts.scales.y.type = "linear";
      opts.parsing = false;
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      if (Array.isArray(dataClone.datasets)) {
        dataClone.datasets = dataClone.datasets.map((ds) => {
          const points = Array.isArray(ds.data) ? ds.data : [];
          points.forEach((p) => {
            const x = typeof p.x === "number" ? p.x : Number(p.x);
            const y = typeof p.y === "number" ? p.y : Number(p.y);
            if (!isNaN(x) && !isNaN(y)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          });
          return {
            pointRadius: 4,
            pointHoverRadius: 4,
            pointBorderWidth: 0,
            pointStyle: "circle",
            clip: false,
            borderColor: ds.borderColor || ds.backgroundColor || "#3b82f6",
            backgroundColor: ds.backgroundColor || ds.borderColor || "#3b82f6",
            showLine: false,
            ...ds,
          };
        });
      }
      if (minX !== Number.POSITIVE_INFINITY) {
        const padX = (maxX - minX) * 0.05 || 1;
        const padY = (maxY - minY) * 0.05 || 1;
        opts.scales.x.min = minX - padX;
        opts.scales.x.max = maxX + padX;
        opts.scales.y.min = minY - padY;
        opts.scales.y.max = maxY + padY;
      }
    }
    // Chart.js expects document to exist; ensure an offscreen container
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    document.body.appendChild(container);
    const tempChart = new ChartJS(ctx, {
      type: chartType,
      data: dataClone,
      options: opts,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dataUrl = canvas.toDataURL("image/png", 1.0);
    tempChart.destroy();
    container.remove();
    return dataUrl;
  }

  async function downloadPDF() {
    const chartImg = await renderLightChartImageFromScratch();
    let extraHtml = "";
    if (extraHtmlRef && extraHtmlRef.current) {
      try {
        // Capture any canvases inside the extraHtml so they render in PDF
        const originalCanvases =
          extraHtmlRef.current.querySelectorAll("canvas");
        const canvasDataUrls = Array.from(originalCanvases).map((cnv) => {
          try {
            return cnv.toDataURL("image/png", 1.0);
          } catch (_) {
            return null;
          }
        });

        const clone = extraHtmlRef.current.cloneNode(true);
        clone.style.maxHeight = "none";
        clone.style.overflow = "visible";
        clone.style.width = "100%";
        // Inject minimal print CSS to preserve calendar grid formatting
        const style = document.createElement("style");
        style.innerHTML = `
          .calendar-export { max-height: none !important; overflow: visible !important; }
          .calendar-export .d-grid { display: grid !important; grid-template-columns: repeat(7, 1fr) !important; gap: 6px !important; }
          .calendar-export .cal-cell { display: flex !important; }
          .calendar-export .month { break-inside: avoid; page-break-inside: avoid; }
          .rose-export { height: auto !important; max-height: none !important; overflow: visible !important; display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 auto 16px auto !important; }
          .rose-export canvas, .rose-export img { width: 640px !important; max-width: 100% !important; height: auto !important; display: block !important; }
          .rose-export div[style*="position: fixed"] { position: static !important; }
          .rose-export [style*="pointer-events: none"][style*="position: fixed"] { display: none !important; }
          /* Force readable text colors regardless of dark mode inline styles */
          .rose-export, .rose-export *, .rose-export .legend-text { color: #000 !important; }
        `;
        clone.prepend(style);

        // Replace cloned canvases with images using captured data URLs
        const clonedCanvases = clone.querySelectorAll("canvas");
        clonedCanvases.forEach((cnv, idx) => {
          const data = canvasDataUrls[idx];
          if (!data) return;
          const img = document.createElement("img");
          img.src = data;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          cnv.replaceWith(img);
        });
        extraHtml = clone.outerHTML;
      } catch (_) {
        extraHtml = extraHtmlRef.current.outerHTML;
      }
    }
    const tableContent =
      table && table.headers && table.headers.length
        ? `
      <table style=\"width:100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; color:#000;\">
        <thead>
          <tr>
            ${table.headers
              .map(
                (h) =>
                  `<th style=\\"border:1px solid #ccc; padding:4px; text-align:left; background:#f5f5f5; color:#000;\\">${h}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${(table.rows || [])
            .map(
              (r) =>
                `<tr style=\\"color:#000;\\">${r
                  .map(
                    (c) =>
                      `<td style=\\"border:1px solid #eee; padding:4px; color:#000;\\">${
                        c ?? ""
                      }</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`
        : "";

    const w = window.open("");
    if (!w) return;
    const printCss = `
      @page { size: auto; margin: 16px; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .calendar-export, .calendar-export * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .calendar-export .cal-cell { background-clip: padding-box !important; }
      /* Ensure adequate spacing and readable legend text on white */
      .calendar-export { margin-bottom: 16px; }
      .calendar-export .legend-text { color: #333 !important; }
      .calendar-export .month { margin-top: 8px; margin-bottom: 6px; }
      .rose-export { margin-bottom: 16px; }
      .rose-export * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `;

    w.document.write(`
      <html>
        <head>
          <title>Report</title>
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
          <style>${printCss}</style>
        </head>
        <body style=\"margin:16px; background:#fff; color:#000;\">
          ${
            chartImg
              ? `<img src=\"${chartImg}\" style=\"max-width:100%; margin-bottom:16px;\"/>`
              : ""
          }
          <div style=\"margin-bottom:16px;\">${extraHtml}</div>
          <div style=\"margin-top:16px;\">${tableContent}</div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  const showCsv = Boolean(csv && csv.headers && csv.rows);
  const hasChart = Boolean(chartType && chartData && chartOptions);
  const hasTable = Boolean(
    table && table.headers && table.rows && table.rows.length
  );
  const showPdf = hasChart || hasTable || Boolean(extraHtmlRef);

  if (!showCsv && !showPdf) return null;

  return (
    <Dropdown
      className={className}
      style={{ position: "relative", ...(style || {}) }}
    >
      <Dropdown.Toggle
        size={size}
        variant={btnVariant}
        className={toggleClassName}
        style={{
          position: "relative",
          ...(toggleStyle || {}),
        }}
      >
        {label}
      </Dropdown.Toggle>
      <Dropdown.Menu
        container={typeof document !== "undefined" ? document.body : undefined}
        className={darkMode ? "bg-dark text-light" : ""}
        style={{
          position: "fixed",
          zIndex: 5000,
          maxHeight: "70vh",
          overflowY: "auto",
        }}
        align="end"
        renderOnMount
      >
        {showCsv && (
          <Dropdown.Item
            className={darkMode ? "text-light" : ""}
            onClick={downloadCSV}
          >
            CSV
          </Dropdown.Item>
        )}
        {showPdf && (
          <Dropdown.Item
            className={darkMode ? "text-light" : ""}
            onClick={downloadPDF}
          >
            PDF
          </Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
