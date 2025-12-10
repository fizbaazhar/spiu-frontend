import React, { useState, useMemo } from "react";
import ListGroup from "react-bootstrap/ListGroup";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Button from "react-bootstrap/Button";
import Image from "react-bootstrap/Image";
import "./Sidebar.css";
import {
  stationCoordinatesByCity,
  stationIdToLabel,
} from "../data/stationCoordinates.js";

function Sidebar({
  locations,
  onLocationSelect,
  selectedLocationId,
  zoomedLocationId,
  isAuthenticated,
  onLogout,
  darkMode,
  onLogoClick,
  onCityZoom,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openCities, setOpenCities] = useState({});

  // Build a quick lookup from station name -> city
  const stationNameToCity = useMemo(() => {
    const mapping = {};
    Object.entries(stationCoordinatesByCity).forEach(([cityName, stations]) => {
      Object.keys(stations).forEach((displayName) => {
        // Map both display label and backend id to the city for robust grouping
        mapping[displayName] = cityName;
        // Attempt to find a backend id that maps to this label
        const idEntry = Object.entries(stationIdToLabel).find(
          ([id, label]) => label === displayName
        );
        if (idEntry) {
          mapping[idEntry[0]] = cityName;
        }
      });
    });
    return mapping;
  }, []);

  // Group incoming flat locations by city using the mapping above
  const groupedLocations = useMemo(() => {
    const groups = {};
    locations.forEach((loc) => {
      const city = stationNameToCity[loc.name] || "Other";
      if (!groups[city]) groups[city] = [];
      groups[city].push(loc);
    });
    return groups;
  }, [locations, stationNameToCity]);

  // Apply search across cities and station names
  const filteredGroupedLocations = useMemo(() => {
    if (!searchTerm) return groupedLocations;
    const term = searchTerm.toLowerCase();
    const filtered = {};
    Object.entries(groupedLocations).forEach(([city, stations]) => {
      if (city.toLowerCase().includes(term)) {
        filtered[city] = stations;
      } else {
        const subset = stations.filter((s) =>
          s.name.toLowerCase().includes(term)
        );
        if (subset.length > 0) {
          filtered[city] = subset;
        }
      }
    });
    return filtered;
  }, [groupedLocations, searchTerm]);

  const toggleCity = (city) => {
    setOpenCities((prev) => ({ ...prev, [city]: !prev[city] }));
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  return (
    <div className="sidebar-container d-flex flex-column h-100">
      {/* Logo Area */}
      <div className="p-2 text-center border-bottom sidebar-logo-area">
        <Image
          src={darkMode ? "/assets/logo.webp" : "/assets/logo.webp"}
          alt="EnviroCloud Logo"
          fluid
          className="sidebar-logo"
          style={{ cursor: onLogoClick ? "pointer" : undefined }}
          onClick={() => onLogoClick && onLogoClick()}
        />
      </div>

      {/* Search Bar */}
      <div className="p-2 border-bottom">
        {/* Optional Icon: <InputGroup.Text><FaSearch /></InputGroup.Text> */}
        <InputGroup size="sm">
          <Form.Control
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="outline-secondary"
              onClick={handleClearSearch}
              size="sm"
            >
              {/* Optional Icon: <FaTimes /> */} X
            </Button>
          )}
        </InputGroup>
      </div>

      {/* Location List */}
      {/* 'overflow-auto' makes only this part scrollable */}
      {/* 'flex-grow-1' makes it take available space */}
      <ListGroup
        variant="flush"
        className="location-list flex-grow-1 overflow-auto"
      >
        {Object.keys(filteredGroupedLocations).length > 0 ? (
          Object.entries(filteredGroupedLocations).map(([city, stations]) => {
            const isOpen = searchTerm ? true : !!openCities[city];
            return (
              <div key={`city-${city}`}>
                <ListGroup.Item
                  action
                  onClick={() => {
                    if (!searchTerm) toggleCity(city);
                    if (onCityZoom) onCityZoom(city);
                  }}
                  className="sidebar-city-header text-start"
                >
                  <span className="city-caret">{isOpen ? "▾" : "▸"}</span>{" "}
                  {city}
                </ListGroup.Item>
                {isOpen &&
                  stations.map((loc) => (
                    <ListGroup.Item
                      key={loc.id}
                      action
                      active={loc.id === selectedLocationId}
                      className={`sidebar-list-item station-item text-center ${
                        loc.id === zoomedLocationId ? "zoomed" : ""
                      }`}
                      onClick={() => onLocationSelect(loc)}
                    >
                      {loc.name}
                    </ListGroup.Item>
                  ))}
              </div>
            );
          })
        ) : (
          <ListGroup.Item className="text-muted text-center">
            No locations found.
          </ListGroup.Item>
        )}
      </ListGroup>

      {/* Sign Out Button (conditional) */}
      {isAuthenticated && (
        <div className="sidebar-footer p-2 border-top">
          <Button
            variant={
              darkMode ? "outline-danger dark-signout" : "outline-danger"
            }
            size="sm"
            className="w-100"
            onClick={onLogout}
          >
            Sign Out
          </Button>
        </div>
      )}

      {/* Powered By Image */}
      <div className="p-2 text-center">
        <Image
          src={
            darkMode
              ? "/assets/poweredby-darkmode.png"
              : "/assets/poweredby-lightmode.webp"
          }
          alt="Powered By"
          fluid
          className="powered-by-logo"
        />
      </div>
    </div>
  );
}

export default Sidebar;
