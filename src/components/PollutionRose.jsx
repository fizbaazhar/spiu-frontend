import React, { useEffect, useMemo, useRef, useState } from "react";
import { pollutantCategories } from "./Legend.jsx";

export const isPollutantAppropriateForRose = (pollutant) => {
  const appropriatePollutants = [
    "AQI",
    "O3",
    "CO",
    "SO2",
    "NO",
    "NO2",
    "NOX",
    "PM10",
    "PM25",
    "Temp",
    "RH",
    "BP",
    "Rain",
    "WS",
    "WD",
    "SR",
  ];
  return appropriatePollutants.includes(pollutant);
};

const DIRECTION_LABELS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function getDirectionSector(degrees, sectorCount = 8) {
  const sectorSize = 360 / sectorCount;
  // Center bins on the cardinal directions (no half-sector bias)
  return Math.floor(((degrees + 360) % 360) / sectorSize) % sectorCount;
}

function getPollutantDisplayName(key) {
  const names = {
    AQI: "AQI",
    O3: "Ozone (O₃)",
    CO: "Carbon Monoxide (CO)",
    SO2: "Sulfur Dioxide (SO₂)",
    NO: "Nitric Oxide (NO)",
    NO2: "Nitrogen Dioxide (NO₂)",
    NOX: "Nitrogen Oxides (NOₓ)",
    PM10: "Particulate Matter (PM10)",
    PM25: "Particulate Matter (PM2.5)",
    WS: "Wind Speed",
    WD: "Wind Direction",
    Temp: "Temperature",
    RH: "Relative Humidity",
    BP: "Barometric Pressure",
    Rain: "Rainfall",
    SR: "Solar Radiation",
  };
  return names[key] || key;
}

export default function PollutionRose({
  data,
  pollutant,
  darkMode,
  sectorCount = 8,
  windDirectionType = "from",
  enableTooltip = true,
  hideTitle = false,
  hideLegend = false,
}) {
  const categories = pollutantCategories[pollutant] || [];
  const directions = DIRECTION_LABELS_8.slice(0, sectorCount);

  const { sectorPercents, totalCategoryCounts } = useMemo(() => {
    const sectorCategoryCounts = Array(sectorCount)
      .fill(0)
      .map(() => ({}));
    const totalCategoryCountsLocal = {};

    data.forEach((row) => {
      let wd = parseFloat(row.WD);
      const value = parseFloat(row[pollutant]);
      if (isNaN(wd) || isNaN(value) || String(value) === "-9999.0000000")
        return;
      if (windDirectionType === "to") wd = (wd + 180) % 360;
      const sector = getDirectionSector(wd, sectorCount);

      const cat = categories.find((c) => {
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
      sectorCategoryCounts[sector][cat.name] =
        (sectorCategoryCounts[sector][cat.name] || 0) + 1;
      totalCategoryCountsLocal[cat.name] =
        (totalCategoryCountsLocal[cat.name] || 0) + 1;
    });

    const sectorPercentsLocal = sectorCategoryCounts.map((counts) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const percs = categories.map((cat) => {
        const c = counts[cat.name] || 0;
        return total > 0 ? (c / total) * 100 : 0;
      });
      // Normalize rounding to sum ~100
      const sum = percs.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        const diff = 100 - sum;
        const maxIdx = percs.findIndex((p) => p === Math.max(...percs));
        percs[maxIdx] += diff;
      }
      return percs;
    });

    return {
      sectorPercents: sectorPercentsLocal,
      totalCategoryCounts: totalCategoryCountsLocal,
    };
  }, [data, pollutant, categories, sectorCount, windDirectionType]);

  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [size, setSize] = useState(420);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    function computeSize() {
      const w = wrapperRef.current?.clientWidth || 520;
      // Prefer width for stable PDF export sizing
      const s = w;
      setSize(Math.min(520, Math.max(260, s)));
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size * 0.42;
    const innerRadius = size * 0.06; // small center hole
    const sectorAngle = (2 * Math.PI) / sectorCount;
    const offsetAngle = -sectorAngle / 2; // rotate left so North is centered

    // Draw stacked sectors
    for (let s = 0; s < sectorCount; s++) {
      const startAngle = -Math.PI / 2 + offsetAngle + s * sectorAngle; // start at north, centered
      const endAngle = startAngle + sectorAngle;
      let cum = innerRadius;
      const percs = sectorPercents[s] || [];
      for (let ci = 0; ci < categories.length; ci++) {
        const pct = percs[ci] || 0;
        if (pct <= 0) continue;
        const add = (pct / 100) * (outerRadius - innerRadius);
        const nextR = cum + add;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, nextR, startAngle, endAngle, false);
        ctx.arc(centerX, centerY, cum, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = categories[ci].color;
        ctx.strokeStyle = darkMode ? "#ffffff" : "#000000";
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        cum = nextR;
      }
      // Direction label at outer
      ctx.save();
      ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
      ctx.font = "12px sans-serif";
      const mid = (startAngle + endAngle) / 2;
      const lx = centerX + (outerRadius + 12) * Math.cos(mid);
      const ly = centerY + (outerRadius + 12) * Math.sin(mid);
      const label = directions[s] || "";
      ctx.textAlign =
        Math.cos(mid) > 0.3
          ? "left"
          : Math.cos(mid) < -0.3
          ? "right"
          : "center";
      ctx.textBaseline =
        Math.sin(mid) > 0.3
          ? "top"
          : Math.sin(mid) < -0.3
          ? "bottom"
          : "middle";
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }
  }, [size, darkMode, categories, sectorCount, sectorPercents, directions]);

  // Hover tooltip (align with rotated sectors)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onMove(e) {
      if (!enableTooltip) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = ((e.clientX - rect.left) * (canvas.width / rect.width)) / dpr;
      const y = ((e.clientY - rect.top) * (canvas.height / rect.height)) / dpr;
      const cx = size / 2;
      const cy = size / 2;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx); // -PI..PI, 0 at east
      // Normalize to 0..2PI with -PI/2 at north and apply offset
      angle = (angle + 2 * Math.PI) % (2 * Math.PI);
      const sectorAngle = (2 * Math.PI) / sectorCount;
      const offsetAngle = -sectorAngle / 2;
      let rel = angle - (3 * Math.PI) / 2 - offsetAngle; // subtract -PI/2 baseline
      rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let sIdx = Math.floor(rel / sectorAngle);
      if (sIdx < 0 || sIdx >= sectorCount) {
        setTooltip(null);
        return;
      }
      const innerRadius = size * 0.06;
      const outerRadius = size * 0.42;
      if (r < innerRadius || r > outerRadius + 2) {
        setTooltip(null);
        return;
      }
      const percs = sectorPercents[sIdx] || [];
      let cum = innerRadius;
      let foundIndex = -1;
      for (let ci = 0; ci < categories.length; ci++) {
        const add = ((percs[ci] || 0) / 100) * (outerRadius - innerRadius);
        const nextR = cum + add;
        if (r >= cum && r <= nextR) {
          foundIndex = ci;
          break;
        }
        cum = nextR;
      }
      if (foundIndex === -1) {
        setTooltip(null);
        return;
      }
      const pct = (percs[foundIndex] || 0).toFixed(2);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        text: `${directions[sIdx]} • ${categories[foundIndex].name}: ${pct}%`,
      });
    }
    function onLeave() {
      setTooltip(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onLeave, true);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onLeave, true);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [
    categories,
    directions,
    sectorCount,
    sectorPercents,
    size,
    enableTooltip,
  ]);

  // Legend from global category counts (sum to 100%)
  const legendItems = useMemo(() => {
    const grand = Object.values(totalCategoryCounts).reduce((a, b) => a + b, 0);
    if (!grand)
      return categories.map((c) => ({ name: c.name, color: c.color, pct: 0 }));
    const base = categories.map((c) => ({
      name: c.name,
      color: c.color,
      pct: Math.floor(((totalCategoryCounts[c.name] || 0) / grand) * 100),
    }));
    let sum = base.reduce((a, b) => a + b.pct, 0);
    // Distribute remainder to largest categories first to reach 100
    if (sum < 100) {
      const sortedIdx = base
        .map((v, i) => ({ i, v: totalCategoryCounts[v.name] || 0 }))
        .sort((a, b) => b.v - a.v)
        .map((x) => x.i);
      let rem = 100 - sum;
      for (const idx of sortedIdx) {
        if (rem <= 0) break;
        base[idx].pct += 1;
        rem -= 1;
      }
    }
    return base;
  }, [categories, totalCategoryCounts]);

  const displayName = getPollutantDisplayName(pollutant);
  const isWind = ["WS", "WD"].includes(pollutant);

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%" }}>
      {!hideTitle && (
        <div
          style={{
            color: darkMode ? "#ffffff" : "#000000",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {isWind ? "Wind" : "Pollution"} Rose: {displayName}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <canvas ref={canvasRef} style={{ width: size, height: size }} />
      </div>
      {!hideLegend && (
        <div
          className="mt-2"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {legendItems.map((item, idx) => (
            <div
              key={`rose-leg-${idx}`}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: item.color,
                  display: "inline-block",
                  border: "1px solid rgba(0,0,0,0.2)",
                }}
              />
              <span
                style={{ fontSize: 12, color: darkMode ? "#f0f0f0" : "#666" }}
              >
                {item.name} — {item.pct}%
              </span>
            </div>
          ))}
        </div>
      )}
      {enableTooltip && tooltip && (
        <div
          style={{
            position: "fixed",
            left: Math.min(tooltip.x + 10, window.innerWidth - 260),
            top: Math.min(tooltip.y + 10, window.innerHeight - 72),
            background: "rgba(0,0,0,0.9)",
            color: "#fff",
            border: "1px solid #000",
            borderRadius: 4,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            zIndex: 2147483000,
            boxShadow: "0 2px 10px rgba(0,0,0,.6)",
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
