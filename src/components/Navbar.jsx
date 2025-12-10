import React from "react";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import NavDropdown from "react-bootstrap/NavDropdown";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { useState } from "react";
import { useAlertStream } from "../hooks/useAlertStream";
import { Bell, Download } from "react-bootstrap-icons";
import {
  List as ListIcon,
  GraphDown,
  Sun,
  Moon,
  MapFill,
  BarChartSteps,
} from "react-bootstrap-icons";

function AppNavbar({
  darkMode,
  toggleDarkMode,
  handleShowSidebar,
  activeView,
  setActiveView,
  analyticsView,
  setAnalyticsView,
}) {
  const { alerts, unread, markAllRead } = useAlertStream();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAlerts = async () => {
    if (!startDateTime || !endDateTime) {
      alert("Please select both start and end date/time");
      return;
    }

    setDownloading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const API_KEY = import.meta.env.VITE_API_KEY;

      // Convert from datetime-local format (YYYY-MM-DDTHH:MM) to API format (YYYY-MM-DD HH:MM:SS)
      const formatDateTime = (dt) => dt.replace("T", " ") + ":00";
      const formattedStart = formatDateTime(startDateTime);
      const formattedEnd = formatDateTime(endDateTime);

      const url = `${API_BASE_URL}/alerts/range?start_datetime=${encodeURIComponent(
        formattedStart
      )}&end_datetime=${encodeURIComponent(formattedEnd)}`;

      const response = await fetch(url, {
        headers: {
          "X-API-Key": API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Convert to CSV
      const csvHeader = "Date Time,Alert\n";
      const csvRows = data
        .map((row) => {
          const dateTime = row.Date_Time || "";
          const alert = (row.Alert || "").replace(/"/g, '""'); // Escape quotes
          return `"${dateTime}","${alert}"`;
        })
        .join("\n");

      const csv = csvHeader + csvRows;

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url_obj = URL.createObjectURL(blob);
      link.setAttribute("href", url_obj);
      link.setAttribute(
        "download",
        `alerts_${startDateTime}_to_${endDateTime}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download alerts:", error);
      alert("Failed to download alerts. Please try again.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <Navbar
      className={`${
        darkMode ? "navbar-dark" : "navbar-light bg-light"
      } border-bottom flex-shrink-0`}
      style={{ zIndex: 9000, backgroundColor: darkMode ? "#2d3032" : "" }}
    >
      <Container fluid>
        {/* Left hamburger for Sidebar (mobile only) */}
        <Nav className="me-2 d-lg-none">
          <Nav.Link
            onClick={handleShowSidebar}
            style={{ cursor: "pointer" }}
            aria-label="Open sidebar"
          >
            <ListIcon size={22} />
          </Nav.Link>
        </Nav>

        {/* Main navbar content - always visible */}
        <Nav className="me-auto align-items-center">
          {/* Main Tabs */}
          <Nav.Item className="me-2">
            <Nav.Link
              active={activeView === "map"}
              onClick={() => setActiveView("map")}
              style={{ cursor: "pointer" }}
              aria-label="Map"
            >
              <MapFill size={18} className="me-0 me-md-2" />
              <span className="d-none d-md-inline">Map</span>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item className="me-2 me-md-3">
            <Nav.Link
              active={activeView === "graphs"}
              onClick={() => setActiveView("graphs")}
              style={{ cursor: "pointer" }}
              aria-label="Graphs"
            >
              <GraphDown size={18} className="me-0 me-md-2" />
              <span className="d-none d-md-inline">Graphs</span>
            </Nav.Link>
          </Nav.Item>
          <NavDropdown
            title={
              <>
                <BarChartSteps size={18} className="me-0 me-md-2" />
                <span className="d-none d-md-inline">Advanced Analytics</span>
              </>
            }
            id="adv-analytics-dropdown"
            aria-label="Advanced Analytics"
            className="me-2"
            active={activeView === "advanced"}
            onToggle={(open) => {
              if (!open) return;
              setActiveView("advanced");
            }}
          >
            <NavDropdown.Item
              active={analyticsView === "2y"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("2y");
              }}
            >
              2Y Time Plot
            </NavDropdown.Item>
            <NavDropdown.Item
              active={analyticsView === "xy"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("xy");
              }}
            >
              XY Plot
            </NavDropdown.Item>
            <NavDropdown.Item
              active={analyticsView === "parallel"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("parallel");
              }}
            >
              Parallel View
            </NavDropdown.Item>
            <NavDropdown.Item
              active={analyticsView === "hist"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("hist");
              }}
            >
              Histogram
            </NavDropdown.Item>
            <NavDropdown.Item
              active={analyticsView === "rose"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("rose");
              }}
            >
              Pollution Rose
            </NavDropdown.Item>
            <NavDropdown.Item
              active={analyticsView === "calendar"}
              onClick={() => {
                setActiveView("advanced");
                setAnalyticsView("calendar");
              }}
            >
              Calendar Plot
            </NavDropdown.Item>
          </NavDropdown>

          {/* Pollutant/Roses/Legend controls moved to Map overlay */}
        </Nav>

        {/* Right side items - always visible */}
        <Nav className="ms-auto align-items-center">
          <Nav.Item>
            <Dropdown
              align="end"
              show={alertsOpen}
              onToggle={(open) => {
                setAlertsOpen(open);
                if (open) markAllRead();
              }}
            >
              <Dropdown.Toggle
                as={Nav.Link}
                id="alert-dropdown"
                className="position-relative"
                style={{ cursor: "pointer" }}
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{
                      fontSize: 10,
                      lineHeight: "10px",
                      transform: "translate(-50%, -25%)",
                    }}
                  >
                    {unread}
                  </span>
                )}
              </Dropdown.Toggle>
              <Dropdown.Menu
                style={{
                  maxHeight: 520,
                  overflowY: "auto",
                  width: "min(360px, 90vw)",
                  maxWidth: "90vw",
                  zIndex: 7000,
                }}
                renderOnMount
              >
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {alerts.length === 0 ? (
                    <div className="px-3 py-2 text-muted">No alerts</div>
                  ) : (
                    alerts.map((a, i) => (
                      <Dropdown.Item
                        key={`${a.Date_Time}-${i}`}
                        className="py-2"
                      >
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {a.Date_Time}
                        </div>
                        <div style={{ whiteSpace: "normal" }}>
                          {typeof a.Alert === "string"
                            ? a.Alert.replace(/\bPM25\b/g, "PM2.5")
                            : a.Alert}
                        </div>
                      </Dropdown.Item>
                    ))
                  )}
                </div>
                <Dropdown.Divider />
                <div
                  className="px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: darkMode ? "#f0f0f0" : "inherit" }}
                >
                  <div
                    className="mb-3"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    Download Alerts
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label
                      style={{ color: darkMode ? "#f0f0f0" : "inherit" }}
                    >
                      Start Date & Time
                    </Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className={darkMode ? "bg-dark text-light" : ""}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label
                      style={{ color: darkMode ? "#f0f0f0" : "inherit" }}
                    >
                      End Date & Time
                    </Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className={darkMode ? "bg-dark text-light" : ""}
                    />
                  </Form.Group>
                  <Button
                    variant={darkMode ? "outline-light" : "primary"}
                    className="w-100"
                    onClick={handleDownloadAlerts}
                    disabled={downloading || !startDateTime || !endDateTime}
                  >
                    <Download size={16} className="me-2" />
                    {downloading ? "Downloading..." : "Download CSV"}
                  </Button>
                </div>
              </Dropdown.Menu>
            </Dropdown>
          </Nav.Item>
          {/* Legend toggle moved from Navbar (desktop and mobile) */}

          {/* Dark Mode Toggle */}
          <Nav.Link
            onClick={toggleDarkMode}
            className="me-2"
            style={{ cursor: "pointer" }}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </Nav.Link>
        </Nav>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;
