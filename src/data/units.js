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

// Station-specific unit configurations
// If a station is not listed here, it will use the default UNIT_MAP
export const STATION_UNITS = {
  "DC Office Kasur": {
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
  },
  "DC Office Narowal": {
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
  },
  "DC Office Hafizabad": {
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
  },
  "DC Office Gujrat": {
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
  },
  "DC Office Chakwal": {
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
  },
  "DC Office Khanewal": {
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
  },
  "DC Office Muzaffargarh": {
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
  },
  "DC Office Rahim Yar Khan": {
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
  },
};

// Get unit for a pollutant, optionally for a specific station
export function getUnit(key, stationName = null) {
  if (stationName && STATION_UNITS[stationName] && STATION_UNITS[stationName][key]) {
    return STATION_UNITS[stationName][key];
  }
  return UNIT_MAP[key];
}

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

export function labelWithUnitUI(key, displayName, stationName = null) {
  const name = displayName || displayNameForKey(key);
  const unit = getUnit(key, stationName);
  if (unit && unit !== "AQI") return `${name} (${unit})`;
  return name;
}

export function labelWithUnitExport(key, displayName, stationName = null) {
  const name = (displayName || displayNameForKey(key)).replace("µg/m³", "µg/m3");
  const unit = normalizeUnitForExport(getUnit(key, stationName));
  if (unit && unit !== "AQI") return `${name} (${unit})`;
  return name;
}


