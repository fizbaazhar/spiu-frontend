// Centralized units and label helpers

export const UNIT_MAP = {
  AQI: "AQI",
  O3: "µg/m³",
  CO: "mg/m³",
  SO2: "µg/m³",
  NO: "µg/m³",
  NO2: "µg/m³",
  NOX: "µg/m³",
  PM10: "µg/m³",
  PM25: "µg/m³",
  WS: "m/s",
  WD: "Deg",
  Temp: "°C",
  RH: "%",
  BP: "hPa",
  Rain: "mm",
  SR: "W/m²",
};

// Map pollutant keys to user-facing display names
export function displayNameForKey(key) {
  const DISPLAY_NAME_MAP = {
    PM25: "PM2.5",
  };
  return DISPLAY_NAME_MAP[key] || key;
}

export function normalizeUnitForExport(unit) {
  if (!unit) return unit;
  return unit.replace("µg/m³", "µg/m3").replace("W/m²", "W/m2");
}

export function labelWithUnitUI(key, displayName) {
  const name = displayName || displayNameForKey(key);
  const unit = UNIT_MAP[key];
  if (unit && unit !== "AQI") return `${name} (${unit})`;
  return name;
}

export function labelWithUnitExport(key, displayName) {
  const name = (displayName || displayNameForKey(key)).replace("µg/m³", "µg/m3");
  const unit = normalizeUnitForExport(UNIT_MAP[key]);
  if (unit && unit !== "AQI") return `${name} (${unit})`;
  return name;
}


