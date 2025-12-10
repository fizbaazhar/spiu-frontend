import React from "react";
import "./Legend.css";

export const pollutantCategories = {
  AQI: [
    { name: "Good", color: "#268504", range: "0-50" },
    { name: "Satisfactory", color: "#42e607", range: "51-100" },
    { name: "Moderate", color: "#edcd3e", range: "101-150" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "151-200",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "201-300" },
    { name: "Very Unhealthy", color: "#9307de", range: "301-400" },
    { name: "Hazardous", color: "#910101", range: "401+" },
  ],
  O3: [
    { name: "Good", color: "#268504", range: "0-65 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "65.1-130 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "130.1-195 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "195.1-260 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "260.1-450 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "450.1-550 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "550.1+ µg/m³" },
  ],
  CO: [
    { name: "Good", color: "#268504", range: "0-2.5 mg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "2.6-5 mg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "5.1-7.5 mg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "7.6-10 mg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "10.1-25 mg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "25.1-40 mg/m³" },
    { name: "Hazardous", color: "#910101", range: "40.1+ mg/m³" },
  ],
  SO2: [
    { name: "Good", color: "#268504", range: "0-60 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "60.1-120 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "120.1-220 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "220.1-320 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "320.1-800 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "800.1-1600 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "1600.1+ µg/m³" },
  ],
  NO2: [
    { name: "Good", color: "#268504", range: "0-40 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "40.1-80 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "80.1-130 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "130.1-180 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "180.1-380 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "380.1-580 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "580.1+ µg/m³" },
  ],
  PM10: [
    { name: "Good", color: "#268504", range: "0-75 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "75.1-150 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "150.1-250 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "250.1-350 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "350.1-450 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "450.1-550 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "550.1+ µg/m³" },
  ],
  PM25: [
    { name: "Good", color: "#268504", range: "0-15 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "15.1-35 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "35.1-70 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "70.1-150 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "150.1-250 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "250.1-350 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "350.1+ µg/m³" },
  ],
  Temp: [
    { name: "Cold", color: "#0066cc", range: "< 10°C" },
    { name: "Cool", color: "#0099ff", range: "10-20°C" },
    { name: "Mild", color: "#00ccff", range: "20-25°C" },
    { name: "Warm", color: "#ffcc00", range: "25-30°C" },
    { name: "Hot", color: "#ff6600", range: "30-35°C" },
    { name: "Very Hot", color: "#cc0000", range: "> 35°C" },
  ],
  RH: [
    { name: "Very Dry", color: "#cc6600", range: "< 30%" },
    { name: "Dry", color: "#ff9900", range: "30-50%" },
    { name: "Moderate", color: "#ffff00", range: "50-60%" },
    { name: "Comfortable", color: "#00ff00", range: "60-70%" },
    { name: "Humid", color: "#00ccff", range: "70-80%" },
    { name: "Very Humid", color: "#0066cc", range: "> 80%" },
  ],
  BP: [
    { name: "Low", color: "#cc0000", range: "< 1000 hPa" },
    { name: "Below Normal", color: "#ff6600", range: "1000-1010 hPa" },
    { name: "Normal", color: "#00ff00", range: "1010-1020 hPa" },
    { name: "Above Normal", color: "#0099ff", range: "1020-1030 hPa" },
    { name: "High", color: "#0066cc", range: "1030-1040 hPa" },
    { name: "Very High", color: "#0000cc", range: "> 1040 hPa" },
  ],
  Rain: [
    { name: "None", color: "#ffffff", range: "0 mm" },
    { name: "Light", color: "#00ccff", range: "0.1-2.5 mm" },
    { name: "Moderate", color: "#0099ff", range: "2.6-7.5 mm" },
    { name: "Heavy", color: "#0066cc", range: "7.6-15 mm" },
    { name: "Very Heavy", color: "#0033cc", range: "15.1-30 mm" },
    { name: "Extreme", color: "#0000cc", range: "> 30 mm" },
  ],
  WS: [
    { name: "Calm", color: "#00ff00", range: "0-1 m/s" },
    { name: "Light", color: "#ffff00", range: "1-3 m/s" },
    { name: "Moderate", color: "#ffcc00", range: "3-5 m/s" },
    { name: "Fresh", color: "#ff9900", range: "5-8 m/s" },
    { name: "Strong", color: "#ff6600", range: "8-12 m/s" },
    { name: "Very Strong", color: "#cc0000", range: "> 12 m/s" },
  ],
  WD: [
    { name: "N", color: "#ff0000", range: "0-22.5°" },
    { name: "NE", color: "#ff6600", range: "22.6-67.5°" },
    { name: "E", color: "#ffff00", range: "67.6-112.5°" },
    { name: "SE", color: "#00ff00", range: "112.6-157.5°" },
    { name: "S", color: "#00ccff", range: "157.6-202.5°" },
    { name: "SW", color: "#0066cc", range: "202.6-247.5°" },
    { name: "W", color: "#0000cc", range: "247.6-292.5°" },
    { name: "NW", color: "#6600cc", range: "292.6-337.5°" },
  ],
  NO: [
    { name: "Good", color: "#268504", range: "0-40 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "40.1-80 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "80.1-130 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "130.1-180 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "180.1-380 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "380.1-580 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "580.1+ µg/m³" },
  ],
  NOX: [
    { name: "Good", color: "#268504", range: "0-40 µg/m³" },
    { name: "Satisfactory", color: "#42e607", range: "40.1-80 µg/m³" },
    { name: "Moderate", color: "#edcd3e", range: "80.1-130 µg/m³" },
    {
      name: "Unhealthy for Sensitive Groups",
      color: "#d18306",
      range: "130.1-180 µg/m³",
    },
    { name: "Unhealthy", color: "#e60b0b", range: "180.1-380 µg/m³" },
    { name: "Very Unhealthy", color: "#9307de", range: "380.1-580 µg/m³" },
    { name: "Hazardous", color: "#910101", range: "580.1+ µg/m³" },
  ],
  SR: [
    { name: "Low", color: "#00ff00", range: "0-100 W/m²" },
    { name: "Moderate", color: "#ffff00", range: "100-200 W/m²" },
    { name: "High", color: "#ffcc00", range: "200-400 W/m²" },
    { name: "Very High", color: "#ff6600", range: "400-800 W/m²" },
    { name: "Extreme", color: "#ff0000", range: "800-1200 W/m²" },
    { name: "Dangerous", color: "#cc0000", range: "> 1200 W/m²" },
  ],
};

// Helper function to get category object based on pollutant value
export const getPollutantCategory = (value, pollutant) => {
  const categories = pollutantCategories[pollutant];
  if (!categories) {
    return null; // No categories defined for this pollutant
  }

  for (const category of categories) {
    const range = category.range;
    if (range.includes("-")) {
      const [min, max] = range
        .split("-")
        .map((v) => parseFloat(v.replace(/[^\d.-]/g, "")));
      if (value >= min && value <= max) {
        return category;
      }
    } else if (range.includes("<")) {
      const max = parseFloat(range.replace(/[^\d.-]/g, ""));
      if (value < max) {
        return category;
      }
    } else if (range.includes(">")) {
      const min = parseFloat(range.replace(/[^\d.-]/g, ""));
      if (value > min) {
        return category;
      }
    } else if (range.includes("+")) {
      const min = parseFloat(range.replace(/[^\d.-]/g, ""));
      if (value >= min) {
        return category;
      }
    }
  }

  // If no range matches (e.g., value is higher than the max in a closed range), return the last category.
  return categories[categories.length - 1];
};

// Helper function to get color based on pollutant value and categories
export const getPollutantColor = (value, pollutant) => {
  const category = getPollutantCategory(value, pollutant);
  if (category) {
    return category.color;
  }

  // Default teal gradient for unknown pollutants
  if (value > 0) {
    const intensity = Math.min(value / 100, 1);
    const alpha = 0.3 + intensity * 0.7;
    return `rgba(0, 139, 159, ${alpha})`;
  }
  return "#434786";
};

function Legend({ selectedPollutant = "AQI", isDesktop = false }) {
  // Get the appropriate categories for the selected pollutant
  const categories = pollutantCategories[selectedPollutant] || [];

  // Get pollutant display name
  const getPollutantDisplayName = (pollutant) => {
    const pollutantNames = {
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
    return pollutantNames[pollutant] || pollutant;
  };

  // Add desktop class for specific styling
  const legendClass = `legend ${isDesktop ? "desktop-legend" : ""}`;

  return (
    <div className={legendClass}>
      <h6 className="legend-title">
        {getPollutantDisplayName(selectedPollutant)} Legend
      </h6>
      {categories.map((category) => (
        <div key={category.name} className="legend-item">
          <span
            className="legend-color-circle"
            style={{ backgroundColor: category.color }}
          ></span>
          <span className="legend-text">
            {category.name} ({category.range})
          </span>
        </div>
      ))}
    </div>
  );
}

export default Legend;
