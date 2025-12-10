import React, { useState, useCallback, memo, useEffect, useMemo } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Button from "react-bootstrap/Button";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import ToggleButton from "react-bootstrap/ToggleButton";
import { PieChartFill, CloudFill, JournalText } from "react-bootstrap-icons";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  OverlayView,
} from "@react-google-maps/api";
import { ArrowCounterclockwise } from "react-bootstrap-icons";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import PollutionRose, { isPollutantAppropriateForRose } from "./PollutionRose";
import { getPollutantColor } from "./Legend.jsx";
import { displayNameForKey } from "../data/units.js";
import "./MapComponent.css";

// Helper function to get marker icon options
const getMarkerOptions = (
  pollutantValue,
  selectedPollutant,
  locationName,
  darkMode,
  isSelected = false
) => {
  // Use the proper color from legend for all pollutants
  const fillColor = getPollutantColor(pollutantValue, selectedPollutant);

  const labelColor = "white"; // Always white for labels
  const nameLabelColor = darkMode ? "white" : "black"; // Dark text for light mode, white for dark mode

  const icon = {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: fillColor,
    fillOpacity: 0.95,
    strokeColor: "#000000",
    strokeWeight: 1,
    scale: isSelected ? 28 : 20,
  };

  // Label for the circle (format numeric values to one decimal, else '?')
  const valueLabel = {
    text:
      pollutantValue !== null && pollutantValue !== undefined
        ? typeof pollutantValue === "number"
          ? pollutantValue.toFixed(2)
          : !isNaN(Number(pollutantValue))
          ? Number(pollutantValue).toFixed(1)
          : "?"
        : "?",
    color: labelColor,
    fontWeight: "bold",
    fontSize: isSelected ? "14px" : "12px",
    className: "aqi-marker-label",
  };

  // Location name label
  const nameLabel = {
    text: locationName,
    color: nameLabelColor,
    fontWeight: "bold",
    fontSize: "12px",
    className: `location-marker-label ${darkMode ? "dark-mode" : "light-mode"}`,
  };

  return { icon, valueLabel, nameLabel };
};

// Standard Google Maps dark style JSON
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

function MapComponent({
  locations,
  onMarkerSelect,
  zoomedLocationId,
  setZoomedLocation,
  zoomToLocations,
  onResetView,
  darkMode,
  showPollutionRoses,
  selectedPollutant,
  roseWindDirection,
  onTogglePollutionRoses,
  onSetSelectedPollutant,
  onToggleDesktopLegend,
  onToggleLegend,
  showDesktopLegend,
  setRoseWindDirection,
  roseTimePeriod,
  setRoseTimePeriod,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [map, setMap] = useState(null);
  // Local state for periodic controls in the Roses dropdown
  const [roseStart, setRoseStart] = useState("");
  const [roseEnd, setRoseEnd] = useState("");
  const [roseIntervalLocal, setRoseIntervalLocal] = useState("60");
  const [roseDataByLocation, setRoseDataByLocation] = useState({});

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const API_KEY = import.meta.env.VITE_API_KEY;

  const formatDateTime = (dt) => {
    const d = new Date(dt);
    if (isNaN(d)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const applyPeriodicRoses = useCallback(
    async ({ start, end, interval }) => {
      if (!start || !end || !interval) return;
      try {
        const startStr = formatDateTime(start);
        const endStr = formatDateTime(end);
        const results = await Promise.all(
          (locations || [])
            .filter((loc) => loc && loc.name)
            .map(async (loc) => {
              const url = `${API_BASE_URL}/periodic/${encodeURIComponent(
                loc.name
              )}?start_datetime=${encodeURIComponent(
                startStr
              )}&end_datetime=${encodeURIComponent(
                endStr
              )}&interval=${interval}`;
              const res = await fetch(url, {
                headers: {
                  "X-API-Key": API_KEY,
                },
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = await res.json();
              return [
                loc.name,
                Array.isArray(json[loc.name]) ? json[loc.name] : [],
              ];
            })
        );
        const byName = {};
        results.forEach(([name, data]) => (byName[name] = data));
        setRoseDataByLocation(byName);
      } catch (err) {
        console.error("Failed to load periodic rose data:", err);
      }
    },
    [locations, API_BASE_URL]
  );

  useEffect(() => {
    function onPeriodicApply(e) {
      const detail = e?.detail || {};
      applyPeriodicRoses({
        start: detail.start || roseStart,
        end: detail.end || roseEnd,
        interval: detail.interval || roseIntervalLocal,
      });
    }
    window.addEventListener("rose:periodic:apply", onPeriodicApply);
    return () =>
      window.removeEventListener("rose:periodic:apply", onPeriodicApply);
  }, [applyPeriodicRoses, roseStart, roseEnd, roseIntervalLocal]);

  const fitBoundsToMarkers = useCallback((mapInstance, locs) => {
    if (!mapInstance || !locs || locs.length === 0) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let validLocations = 0;
    locs.forEach((loc) => {
      if (loc.position) {
        bounds.extend(loc.position);
        validLocations++;
      }
    });

    if (validLocations > 0) {
      mapInstance.fitBounds(bounds);
      window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
        if (validLocations === 1) {
          mapInstance.setZoom(12);
        } else if (mapInstance.getZoom() > 16) {
          mapInstance.setZoom(16);
        }
      });
    }
  }, []);

  const initialCenter = useMemo(() => {
    const firstValidLocation = locations.find((loc) => loc.position);
    return firstValidLocation?.position || { lat: 31.5, lng: 73.0 };
  }, [locations]);

  const onLoad = useCallback(
    (mapInstance) => {
      if (locations && locations.length > 0 && mapInstance) {
        fitBoundsToMarkers(mapInstance, locations);
      } else if (mapInstance) {
        mapInstance.setCenter(initialCenter);
        mapInstance.setZoom(7);
      }
      console.log("Map Loaded");
      setMap(mapInstance);
    },
    [locations, initialCenter, fitBoundsToMarkers]
  );

  const onUnmount = useCallback((mapInstance) => {
    console.log("Map Unmounted");
    setMap(null);
  }, []);

  const handleMarkerClick = (location) => {
    onMarkerSelect(location);
  };

  const [pollutantOpen, setPollutantOpen] = useState(false);
  const [rosesOpen, setRosesOpen] = useState(false);

  const activeHoverStyle = useMemo(
    () =>
      darkMode
        ? { backgroundColor: "#f8f9fa", color: "#000", borderColor: "#f8f9fa" }
        : { backgroundColor: "#6c757d", color: "#fff", borderColor: "#6c757d" },
    [darkMode]
  );

  const controlButtonStyle = useMemo(
    () =>
      darkMode
        ? {
            backgroundColor: "#2d3032",
            color: "#f8f9fa",
            borderColor: "#2d3032",
            boxShadow: "0 1px 2px #2d3032",
          }
        : {
            backgroundColor: "#f8f9fa",
            color: "#212529",
            borderColor: "#ced4da",
            boxShadow: "0 1px 2px #f8f9fa",
          },
    [darkMode]
  );

  useEffect(() => {
    if (map) {
      if (zoomedLocationId) {
        const zoomedLoc = locations.find((loc) => loc.id === zoomedLocationId);
        if (zoomedLoc?.position) {
          map.panTo(zoomedLoc.position);
          map.setZoom(15); // Zoom in on selected marker
        }
      } else if (zoomToLocations && zoomToLocations.length > 0) {
        // Fit bounds to a group of locations (city zoom)
        const bounds = new window.google.maps.LatLngBounds();
        let count = 0;
        zoomToLocations.forEach((loc) => {
          if (loc.position) {
            bounds.extend(loc.position);
            count++;
          }
        });
        if (count > 0) {
          map.fitBounds(bounds);
          window.google.maps.event.addListenerOnce(map, "idle", () => {
            if (count === 1) {
              map.setZoom(12);
            } else if (map.getZoom() > 16) {
              map.setZoom(14);
            }
          });
        }
      } else {
        // If no location is selected, zoom out to fit all markers
        fitBoundsToMarkers(map, locations);
      }
    }
  }, [map, zoomedLocationId, zoomToLocations, locations, fitBoundsToMarkers]);

  const mapOptions = useMemo(() => {
    // Hide POIs/transit/clickable icons to minimize Google overlays (attribution logo will remain per TOS)
    const hiddenOverlays = [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      {
        featureType: "administrative.land_parcel",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road.arterial",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road.local",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
    ];

    const styles = (darkMode ? [...mapDarkStyle] : []).concat(hiddenOverlays);

    return {
      // Remove default UI controls (zoom, mapType, street view, etc.)
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      scaleControl: false,
      rotateControl: false,
      keyboardShortcuts: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      scrollwheel: true,
      draggable: true,
      styles,
    };
  }, [darkMode]); // Recompute options only when darkMode changes

  if (loadError) {
    return (
      <Alert variant="danger">
        Error Loading Maps... Check API Key & Console.
      </Alert>
    );
  }
  if (!isLoaded) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <Spinner animation="border" variant="secondary" />
        <span className="ms-2 text-muted">Loading Map...</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Controls bar moved from Navbar */}
      <div
        className={`d-flex align-items-center justify-content-center px-2 py-1`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          background: "transparent",
          border: "none",
        }}
      >
        <div className="d-flex align-items-center" style={{ minWidth: 44 }}>
          {(zoomedLocationId ||
            (zoomToLocations && zoomToLocations.length > 0)) && (
            <button
              className={`reset-view-btn ${darkMode ? "dark-mode" : ""}`}
              onClick={() => {
                setZoomedLocation && setZoomedLocation(null);
                onResetView && onResetView();
              }}
              title="Reset View"
              style={{ position: "static" }}
            >
              <ArrowCounterclockwise size={28} />
            </button>
          )}
        </div>

        <div className="flex-grow-1 d-flex justify-content-center align-items-center gap-2">
          <Dropdown
            className="me-2"
            onToggle={(s) => setPollutantOpen(Boolean(s))}
          >
            <Dropdown.Toggle
              variant={darkMode ? "outline-light" : "outline-secondary"}
              size="sm"
              style={{
                ...(pollutantOpen ? activeHoverStyle : controlButtonStyle),
              }}
            >
              <CloudFill size={16} className="me-2" />
              {selectedPollutant === "AQI"
                ? "AQI"
                : displayNameForKey(selectedPollutant)}
            </Dropdown.Toggle>
            <Dropdown.Menu className={darkMode ? "bg-dark text-light" : ""}>
              {[
                ["AQI", "AQI"],
                ["O3", "Ozone (O₃)"],
                ["CO", "Carbon Monoxide (CO)"],
                ["SO2", "Sulfur Dioxide (SO₂)"],
                ["NO", "NO"],
                ["NO2", "Nitrogen Dioxide (NO₂)"],
                ["NOX", "Nitrogen Oxides (NOₓ)"],
                ["PM10", "Particulate Matter (PM10)"],
                ["PM25", "Particulate Matter (PM2.5)"],
                ["WS", "Wind Speed"],
                ["WD", "Wind Direction"],
                ["Temp", "Temperature"],
                ["RH", "Relative Humidity"],
                ["BP", "Barometric Pressure"],
                ["Rain", "Rainfall"],
                ["SR", "Solar Radiation"],
              ].map(([val, label]) => (
                <Dropdown.Item
                  key={val}
                  onClick={() =>
                    onSetSelectedPollutant && onSetSelectedPollutant(val)
                  }
                >
                  {label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown className="me-2" onToggle={(s) => setRosesOpen(Boolean(s))}>
            <Dropdown.Toggle
              variant={darkMode ? "outline-light" : "outline-secondary"}
              size="sm"
              style={{
                ...(rosesOpen || showPollutionRoses
                  ? activeHoverStyle
                  : controlButtonStyle),
              }}
            >
              <PieChartFill size={16} className="me-2" />
              Roses
            </Dropdown.Toggle>
            <Dropdown.Menu
              className={darkMode ? "bg-dark text-light" : ""}
              style={{ maxWidth: "92vw", overflowX: "auto" }}
            >
              <div className="p-2">
                <ToggleButtonGroup
                  type="radio"
                  name="windDirectionOptions"
                  value={roseWindDirection}
                  onChange={setRoseWindDirection}
                  size="sm"
                  className="mb-2 d-flex"
                >
                  <ToggleButton
                    id="tbg-rose-from-nav"
                    value={"from"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    From
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-rose-to-nav"
                    value={"to"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    To
                  </ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup
                  type="radio"
                  name="timePeriodOptions"
                  value={roseTimePeriod}
                  onChange={setRoseTimePeriod}
                  size="sm"
                  className="mb-2 d-flex"
                >
                  <ToggleButton
                    id="tbg-rose-daily-nav"
                    value={"daily"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Daily
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-rose-monthly-nav"
                    value={"monthly"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Monthly
                  </ToggleButton>
                  <ToggleButton
                    id="tbg-rose-periodic-nav"
                    value={"periodic"}
                    variant={darkMode ? "outline-light" : "outline-secondary"}
                  >
                    Periodic
                  </ToggleButton>
                </ToggleButtonGroup>
                {roseTimePeriod === "periodic" && (
                  <div
                    className="mb-2"
                    style={{ width: "100%", maxWidth: 260 }}
                  >
                    <div className="d-flex flex-column gap-1">
                      <input
                        type="datetime-local"
                        step="60"
                        value={roseStart}
                        onChange={(e) => setRoseStart(e.target.value)}
                        className={`form-control form-control-sm ${
                          darkMode ? "bg-dark text-light" : ""
                        }`}
                        style={{ width: "100%" }}
                      />
                      <input
                        type="datetime-local"
                        step="60"
                        value={roseEnd}
                        onChange={(e) => setRoseEnd(e.target.value)}
                        className={`form-control form-control-sm ${
                          darkMode ? "bg-dark text-light" : ""
                        }`}
                        style={{ width: "100%" }}
                      />
                      <select
                        className={`form-select form-select-sm ${
                          darkMode ? "bg-dark text-light" : ""
                        }`}
                        value={roseIntervalLocal}
                        onChange={(e) => setRoseIntervalLocal(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="05">5 min</option>
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="60">Hourly</option>
                        <option value="1440">Daily</option>
                      </select>
                      <button
                        className={`btn btn-sm ${
                          darkMode
                            ? "btn-outline-light"
                            : "btn-outline-secondary"
                        }`}
                        disabled={!roseStart || !roseEnd}
                        onClick={() =>
                          applyPeriodicRoses({
                            start: roseStart,
                            end: roseEnd,
                            interval: roseIntervalLocal,
                          })
                        }
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  onClick={onTogglePollutionRoses}
                  variant={showPollutionRoses ? "danger" : "success"}
                  size="sm"
                  className="w-100"
                >
                  {showPollutionRoses ? "Hide Roses" : "Show Roses"}
                </Button>
              </div>
            </Dropdown.Menu>
          </Dropdown>

          <Button
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                onToggleLegend && onToggleLegend();
              } else {
                onToggleDesktopLegend && onToggleDesktopLegend();
              }
            }}
            size="sm"
            variant={darkMode ? "outline-light" : "outline-secondary"}
            title={showDesktopLegend ? "Hide Legend" : "Show Legend"}
            style={{
              ...(showDesktopLegend ? activeHoverStyle : controlButtonStyle),
            }}
          >
            <JournalText size={16} />
          </Button>
        </div>
        <div style={{ minWidth: 44 }} />
      </div>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={initialCenter}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {locations.map((location) => {
          if (!location.position) return null;

          // Get the selected pollutant value for this location (sanitize to number when valid)
          const rawValue = location.latestAqiData
            ? location.latestAqiData[selectedPollutant]
            : null;
          const pollutantValue =
            rawValue !== null &&
            rawValue !== undefined &&
            String(rawValue) !== "-9999.0000000" &&
            !isNaN(Number(rawValue))
              ? Number(rawValue)
              : null;
          const displayValue =
            pollutantValue !== null ? pollutantValue.toFixed(1) : "N/A";

          // Get marker options based on selected pollutant and location name
          const isSelected =
            zoomedLocationId && zoomedLocationId === location.id;
          const markerOptions = getMarkerOptions(
            pollutantValue,
            selectedPollutant,
            location.name,
            darkMode,
            isSelected
          );
          console.log(
            `Rendering marker for ${location.name}: ${selectedPollutant} = ${
              pollutantValue ?? "N/A"
            })`,
            markerOptions.icon,
            "Label:",
            markerOptions.valueLabel
          );

          return (
            <React.Fragment key={location.id}>
              <MarkerF
                position={location.position}
                title={`${location.name} (${
                  selectedPollutant === "AQI"
                    ? "AQI"
                    : displayNameForKey(selectedPollutant)
                }: ${displayValue})`}
                onClick={() => handleMarkerClick(location)}
                icon={markerOptions.icon}
                label={markerOptions.valueLabel}
              />
              <MarkerF
                position={{
                  lat: location.position.lat - 0.001, // Offset slightly below the AQI circle
                  lng: location.position.lng,
                }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 0, // Make the marker invisible
                  fillOpacity: 0,
                  strokeOpacity: 0,
                }}
                label={markerOptions.nameLabel}
              />

              {/* Pollution Rose Overlay */}
              {showPollutionRoses &&
                (roseTimePeriod === "periodic" || location.pollutionData) &&
                isPollutantAppropriateForRose(selectedPollutant) && (
                  <OverlayView
                    position={location.position}
                    mapPaneName={OverlayView.OVERLAY_LAYER}
                  >
                    <div
                      style={{
                        width:
                          zoomedLocationId && zoomedLocationId === location.id
                            ? "260px"
                            : "200px",
                        height:
                          zoomedLocationId && zoomedLocationId === location.id
                            ? "260px"
                            : "200px",
                        transform:
                          zoomedLocationId && zoomedLocationId === location.id
                            ? "translate(-50%, -50%)"
                            : "translate(-50%, -65%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents:
                          zoomedLocationId && zoomedLocationId === location.id
                            ? "auto"
                            : "none",
                      }}
                    >
                      <PollutionRose
                        data={
                          roseTimePeriod === "periodic" &&
                          roseDataByLocation[location.name]
                            ? roseDataByLocation[location.name]
                            : location.pollutionData
                        }
                        pollutant={selectedPollutant}
                        darkMode={darkMode}
                        sectorCount={8}
                        windDirectionType={roseWindDirection}
                        enableTooltip={Boolean(
                          zoomedLocationId && zoomedLocationId === location.id
                        )}
                        hideTitle
                        hideLegend={
                          !(
                            zoomedLocationId && zoomedLocationId === location.id
                          )
                        }
                      />
                    </div>
                  </OverlayView>
                )}
            </React.Fragment>
          );
        })}
      </GoogleMap>
    </div>
  );
}

export default memo(MapComponent);
