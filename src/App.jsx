import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Offcanvas from "react-bootstrap/Offcanvas";
import "./App.css";
import MapComponent from "./components/MapComponent.jsx";
import Sidebar from "./components/Sidebar.jsx";
import InfoPanel from "./components/InfoPanel.jsx";
import Legend from "./components/Legend.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import AppNavbar from "./components/Navbar.jsx";
import Graphs from "./components/Graphs.jsx";
import AdvAnalytics from "./components/AdvAnalytics.jsx";

// Import the coordinate mapping
import {
  stationCoordinates,
  stationCoordinatesByCity,
  stationIdToLabel,
} from "./data/stationCoordinates.js";

// Define API base URL and API key
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://72.62.21.213:8001';
const API_KEY = import.meta.env.VITE_API_KEY || '7b2f49c1e0e447c6a2bde74b81f51a87';

// Log configuration for debugging
if (!import.meta.env.VITE_API_BASE_URL || !import.meta.env.VITE_API_KEY) {
  console.warn('⚠️ Environment variables not set. Using default values.');
  console.warn('Please create a .env file with VITE_API_BASE_URL and VITE_API_KEY');
}
const AUTH_STORAGE_KEY = "aqiDashboardAuth"; // Key for localStorage
const DARK_MODE_STORAGE_KEY = "aqiDashboardDarkMode"; // Key for dark mode storage

function App() {
  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check localStorage on initial load
    return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  });

  // --- Other States ---
  const [initialStations, setInitialStations] = useState([]); // Holds basic station info { id, name, position }
  const [latestData, setLatestData] = useState({}); // Holds { stationName: dataObject } from /latest_hour
  const [pollutionData, setPollutionData] = useState({});
  const [showPollutionRoses, setShowPollutionRoses] = useState(false);
  const [roseWindDirection, setRoseWindDirection] = useState("from");
  const [roseTimePeriod, setRoseTimePeriod] = useState("daily");
  const [selectedPollutant, setSelectedPollutant] = useState("AQI"); // Default to AQI
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [zoomedLocation, setZoomedLocation] = useState(null);
  const [zoomToLocations, setZoomToLocations] = useState([]); // Group zoom targets
  const [loading, setLoading] = useState(!isAuthenticated); // Only load data if authenticated initially
  const [error, setError] = useState(null); // Combined error state
  const [showSidebar, setShowSidebar] = useState(false); // State for off-canvas sidebar
  const [showLegend, setShowLegend] = useState(false); // State for Legend toggle on mobile
  const [showDesktopLegend, setShowDesktopLegend] = useState(false);
  // Removed current date/time display and timer
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage on initial load, default to true (dark mode) if no preference is stored
    const storedPreference = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return storedPreference === null ? true : storedPreference === "true";
  });

  // --- View State (Map | Graphs) ---
  const [activeView, setActiveView] = useState("map");
  const [analyticsView, setAnalyticsView] = useState("2y"); // 2y | xy | calendar

  // Ref to store the timeout ID for the scheduled fetch
  const fetchTimeoutRef = useRef(null);

  // Date/time UI removed

  // --- Authentication Handlers ---
  const handleLoginSuccess = useCallback(() => {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setIsAuthenticated(true);
    setLoading(true); // Start loading data after login
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    // Optionally clear other state if needed
    setInitialStations([]);
    setLatestData({});
    setSelectedLocation(null);
    setError(null);
  }, []);

  // --- Initial Data Fetch & Scheduled Updates ---
  useEffect(() => {
    // Only fetch data if authenticated
    if (!isAuthenticated) {
      setLoading(false); // Ensure loading is false if not authenticated
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current); // Clear any scheduled fetch on logout
        console.log("Cleared scheduled data fetch on logout.");
      }
      return; // Don't fetch data if not logged in
    }

    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      setInitialStations([]);
      setLatestData({});

      try {
        // 1. Fetch initial hourly data for map markers
        console.log("Fetching initial hourly data...");
        console.log("API URL:", `${API_BASE_URL}/latest_hour`);
        const hourlyResponse = await fetch(`${API_BASE_URL}/latest_hour`, {
          headers: {
            "X-API-Key": API_KEY,
          },
        });
        if (!hourlyResponse.ok) {
          const errorText = await hourlyResponse.text();
          console.error("API Error Response:", errorText);
          throw new Error(
            `Hourly data HTTP error! Status: ${hourlyResponse.status} - ${errorText}`
          );
        }
        const hourlyDataResponse = await hourlyResponse.json();
        console.log("API Response received:", hourlyDataResponse);
        
        // Check for top-level error (fatal error like connection failed)
        if (hourlyDataResponse.error) {
          const errorValue = hourlyDataResponse.error;
          const errorMsg = typeof errorValue === 'string' 
            ? errorValue 
            : (typeof errorValue === 'object' ? JSON.stringify(errorValue) : String(errorValue));
          
          // If it's a connection error, that's fatal
          if (errorMsg.includes('connection failed') || errorMsg.includes('Login failed')) {
            console.error("API returned connection error:", errorMsg);
            throw new Error(`Database connection error: ${errorMsg}`);
          }
          
          // If it's just "no data", that's okay - we'll show empty state
          if (errorMsg.includes('no data') || errorMsg === 'no data') {
            console.warn("No data available yet. This is normal if the database is empty or still syncing.");
            if (!isMounted) return;
            setLatestData({});
            setInitialStations([]);
            setError(null); // Don't show error for empty database
            setLoading(false);
            return; // Exit early, but don't throw error
          }
          
          // Other errors are fatal
          console.error("API returned error:", errorMsg);
          throw new Error(`Hourly data API Error: ${errorMsg}`);
        }
        
        if (!isMounted) return; // Check if component is still mounted
        
        // Filter out stations with "no data" errors and only keep stations with actual data
        const validData = {};
        Object.keys(hourlyDataResponse).forEach(stationName => {
          const stationData = hourlyDataResponse[stationName];
          // Only include stations that have actual data (not error objects)
          if (stationData && !stationData.error && stationData.Date_Time) {
            validData[stationName] = stationData;
          }
        });
        
        setLatestData(validData);
        console.log("Initial hourly data fetched.", Object.keys(validData).length, "stations with data");

        // 2. Derive station list from hourly data keys (only stations with valid data)
        const stationNames = Object.keys(validData);
        const combinedStations = stationNames
          .map((id) => ({
            id: id,
            name: stationIdToLabel[id] || id,
            position: stationCoordinates[id] || null,
          }))
          .filter((station) => station.position !== null); // Filter out stations without coordinates
        
        // If no stations have data, show a helpful message instead of error
        if (combinedStations.length === 0) {
          console.warn("No stations with data available. Database may be empty or still syncing.");
          setError(null); // Don't show error - just empty state
        }
        if (!isMounted) return;
        setInitialStations(combinedStations);
        console.log("Initial station list set.");

        // Clear error only if all initial fetches succeed
        setError(null);

        // 3. Schedule the *first* hourly update after initial load
        scheduleNextHourlyFetch();
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        console.error("API_BASE_URL:", API_BASE_URL);
        console.error("API_KEY:", API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT SET');
        if (!isMounted) return;
        const errorMessage = err.message || err.toString() || 'Unknown error occurred';
        setError(`Failed to load initial application data: ${errorMessage}`);
        // Clear potentially partially loaded data on error
        setInitialStations([]);
        setLatestData({});
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // --- Scheduling Logic for Hourly Updates (XX:03) ---
    const scheduleNextHourlyFetch = () => {
      if (!isMounted || !isAuthenticated) return; // Don't schedule if unmounted or logged out

      const now = new Date();
      const nextFetchTime = new Date(now);

      // Set target time to 3 minutes past the *next* hour
      nextFetchTime.setHours(now.getHours() + 1);
      nextFetchTime.setMinutes(3, 0, 0); // 3 minutes, 0 seconds, 0 milliseconds

      // Calculate delay in milliseconds
      const delay = nextFetchTime.getTime() - now.getTime();

      console.log(
        `Scheduling next data fetch for ${nextFetchTime.toLocaleTimeString()} (in ${Math.round(
          delay / 1000 / 60
        )} minutes)`
      );

      // Clear any existing timeout before setting a new one
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(async () => {
        if (!isMounted || !isAuthenticated) return; // Check again before fetching
        console.log(
          `Running scheduled data fetch at ${new Date().toLocaleTimeString()}`
        );
        // Fetch updated hourly data for map markers
        try {
          const hourlyResponse = await fetch(`${API_BASE_URL}/latest_hour`, {
            headers: {
              "X-API-Key": API_KEY,
            },
          });
          if (hourlyResponse.ok) {
            const hourlyDataResponse = await hourlyResponse.json();
            if (!hourlyDataResponse.error && isMounted) {
              setLatestData(hourlyDataResponse);
              console.log("Updated hourly data fetched.");
            }
          }
        } catch (err) {
          console.error("Failed to fetch updated hourly data:", err);
        }
        scheduleNextHourlyFetch(); // Schedule the *next* one after this completes
      }, delay);
    };

    // --- Start Initial Fetch ---
    fetchInitialData();

    // --- Cleanup Function ---
    return () => {
      isMounted = false; // Set flag when component unmounts
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        console.log(
          "Clearing scheduled data fetch timer on component unmount or dependency change."
        );
        fetchTimeoutRef.current = null;
      }
    };

    // Re-run effect if isAuthenticated changes (login/logout)
  }, [isAuthenticated]);

  // Function to fetch pollution data for a specific location
  const fetchPollutionData = async (stationId, timePeriod) => {
    try {
      const endpoint = timePeriod === "monthly" ? "monthly" : "daily";
      const response = await fetch(
        `${API_BASE_URL}/${endpoint}/${encodeURIComponent(stationId)}`,
        {
          headers: {
            "X-API-Key": API_KEY,
          },
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(`API Error: ${data.error}`);
      }

      const locationData = data[stationId];
      if (locationData && Array.isArray(locationData)) {
        return locationData;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch pollution data for ${stationId}:`, error);
      return null;
    }
  };

  // Function to fetch pollution data for all locations
  const fetchAllPollutionData = async () => {
    const pollutionDataMap = {};

    for (const station of initialStations) {
      const data = await fetchPollutionData(station.id, roseTimePeriod);
      if (data) {
        pollutionDataMap[station.id] = data;
      }
    }

    setPollutionData(pollutionDataMap);
  };

  // Effect to fetch pollution data when toggle is enabled
  useEffect(() => {
    if (showPollutionRoses && initialStations.length > 0) {
      fetchAllPollutionData();
    }
  }, [showPollutionRoses, initialStations, roseTimePeriod]);

  // --- Combine station info with hourly data ---
  const locationsWithAqi = useMemo(() => {
    return initialStations.map((station) => {
      const stationData = latestData[station.id];

      // Use AQI directly from the /latest_hour endpoint response
      const aqiValue = stationData ? stationData["AQI"] : undefined;

      // Check if the value is valid before parsing
      const aqi =
        aqiValue !== null && aqiValue !== undefined && !isNaN(aqiValue)
          ? parseInt(aqiValue, 10) // Ensure it's a number
          : null;

      return {
        ...station,
        latestAqi: aqi,
        latestAqiData: stationData || {}, // Include all pollutant data
        pollutionData: pollutionData[station.id] || null,
      };
    });
  }, [initialStations, latestData, pollutionData]);

  // Callback to handle selection from either Map or Sidebar
  const handleLocationSelect = useCallback(
    (location) => {
      // Clear any group zoom when selecting a specific location
      setZoomToLocations([]);
      if (zoomedLocation && zoomedLocation.id === location.id) {
        // If the same location is clicked again, open the info panel
        setSelectedLocation(location);
      } else {
        // Otherwise, just zoom to the location
        setZoomedLocation(location);
        setSelectedLocation(null); // Close info panel if a different location is selected
      }
      if (window.innerWidth < 768) {
        // Close sidebar on mobile after selection (md breakpoint)
        handleCloseSidebar();
      }
    },
    [zoomedLocation]
  );

  // Callback to zoom to a city (fit bounds to its stations)
  const handleCityZoom = useCallback(
    (cityName) => {
      setSelectedLocation(null);
      setZoomedLocation(null);
      const stationNames = Object.keys(
        stationCoordinatesByCity[cityName] || {}
      );
      const group = locationsWithAqi.filter((loc) =>
        stationNames.includes(loc.name)
      );
      setZoomToLocations(group);
    },
    [locationsWithAqi]
  );

  // Callback to handle closing the panel
  const handleClosePanel = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  // Handlers for off-canvas
  const handleCloseSidebar = () => setShowSidebar(false);
  const handleShowSidebar = () => setShowSidebar(true);
  const toggleSidebar = () => setShowSidebar((prev) => !prev);

  // Handler for Legend toggle
  const toggleLegend = () => setShowLegend((prev) => !prev);
  const toggleDesktopLegend = () => setShowDesktopLegend((prev) => !prev);
  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, newValue.toString());
  };

  // Handler for Pollution Rose toggle
  const togglePollutionRoses = () => {
    setShowPollutionRoses((prev) => !prev);
  };

  // --- Render Logic ---

  // 1. Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
    );
  }

  // 2. Render Loading state (while fetching data after login)
  if (loading) {
    // Full-screen modern loader
    return (
      <div className="loader-screen">
        <div className="loader-bar">
          <span></span>
        </div>
      </div>
    );
  }

  // 3. Render Error state
  if (error) {
    return (
      <Alert variant="danger" className="m-3">
        {error}
      </Alert>
    );
  }

  // 4. Render No Data state (could happen if API returns empty after login)
  if (!loading && locationsWithAqi.length === 0) {
    return (
      <Alert variant="warning" className="m-3">
        No station data available or configured.
      </Alert>
    );
  }

  // 5. Render Dashboard if authenticated and data is ready
  return (
    // Use Bootstrap grid for layout: Sidebar | Map Area
    // 'vh-100' ensures the container takes full viewport height
    // 'overflow-hidden' prevents scrollbars on the main container
    <Container
      fluid
      className={`vh-100 d-flex flex-column p-0 overflow-hidden ${
        darkMode ? "dark-mode" : ""
      }`}
    >
      {/* Use Row with no-gutters for edge-to-edge content */}
      {/* 'flex-grow-1' makes the row take available vertical space */}
      <Row className="g-0 flex-grow-1">
        {/* Static Sidebar Column (visible on md and up) */}
        {/* 'd-none d-md-flex' hides it on xs/sm, displays as flex column on md+ */}
        <Col
          md={3}
          lg={2}
          className="sidebar-col bg-light border-end d-none d-md-flex flex-column"
        >
          <Sidebar
            locations={locationsWithAqi}
            onLocationSelect={handleLocationSelect}
            selectedLocationId={selectedLocation?.id}
            zoomedLocationId={zoomedLocation?.id}
            onLogout={handleLogout}
            isAuthenticated={isAuthenticated}
            darkMode={darkMode}
            onLogoClick={() => setActiveView("map")}
            onCityZoom={handleCityZoom}
          />
        </Col>

        {/* Map Column (takes full width on xs/sm, remaining on md+) */}
        {/* 'position-relative' is crucial for InfoPanel and Legend absolute positioning */}
        <Col
          xs={12}
          md={9}
          lg={10}
          className="map-col position-relative d-flex flex-column"
        >
          {/* Navbar - positioned to the right of sidebar */}
          <AppNavbar
            darkMode={darkMode}
            selectedPollutant={selectedPollutant}
            setSelectedPollutant={setSelectedPollutant}
            togglePollutionRoses={togglePollutionRoses}
            showPollutionRoses={showPollutionRoses}
            toggleDesktopLegend={toggleDesktopLegend}
            showDesktopLegend={showDesktopLegend}
            toggleLegend={toggleLegend}
            showLegend={showLegend}
            toggleDarkMode={toggleDarkMode}
            handleShowSidebar={toggleSidebar}
            roseWindDirection={roseWindDirection}
            setRoseWindDirection={setRoseWindDirection}
            roseTimePeriod={roseTimePeriod}
            setRoseTimePeriod={setRoseTimePeriod}
            activeView={activeView}
            setActiveView={setActiveView}
            analyticsView={analyticsView}
            setAnalyticsView={setAnalyticsView}
          />

          {/* Main Content - Map or Graphs */}
          {activeView === "map" ? (
            <div className="flex-grow-1 position-relative">
              <MapComponent
                locations={locationsWithAqi}
                onMarkerSelect={handleLocationSelect}
                selectedLocationId={selectedLocation?.id}
                zoomedLocationId={zoomedLocation?.id}
                setZoomedLocation={setZoomedLocation}
                zoomToLocations={zoomToLocations}
                onResetView={() => {
                  setZoomedLocation(null);
                  setZoomToLocations([]);
                }}
                darkMode={darkMode}
                showPollutionRoses={showPollutionRoses}
                onTogglePollutionRoses={togglePollutionRoses}
                selectedPollutant={selectedPollutant}
                roseWindDirection={roseWindDirection}
                onSetSelectedPollutant={setSelectedPollutant}
                onToggleDesktopLegend={toggleDesktopLegend}
                onToggleLegend={toggleLegend}
                showDesktopLegend={showDesktopLegend}
                setRoseWindDirection={setRoseWindDirection}
                roseTimePeriod={roseTimePeriod}
                setRoseTimePeriod={setRoseTimePeriod}
              />

              {/* Mobile Legend Container */}
              <div
                className={`legend-container d-md-none ${
                  showLegend ? "mobile-visible" : "mobile-hidden"
                }`}
              >
                <Legend selectedPollutant={selectedPollutant} />
              </div>

              {/* Desktop Legend */}
              <div
                className={`d-none ${showDesktopLegend ? "d-md-block" : ""}`}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  zIndex: 1000,
                }}
              >
                <Legend
                  selectedPollutant={selectedPollutant}
                  isDesktop={true}
                />
              </div>

              {/* Conditionally render InfoPanel here, positioned relative to map-col */}
              {selectedLocation && (
                <InfoPanel
                  location={locationsWithAqi.find(
                    (loc) => loc.id === selectedLocation.id
                  )}
                  onClose={handleClosePanel}
                  apiBaseUrl={API_BASE_URL}
                  darkMode={darkMode}
                />
              )}
            </div>
          ) : activeView === "graphs" ? (
            <div className="flex-grow-1 position-relative p-2 p-md-3">
              <Graphs
                darkMode={darkMode}
                stations={locationsWithAqi.map((s) => s.id)}
                stationLabels={Object.fromEntries(
                  locationsWithAqi.map((s) => [s.id, s.name])
                )}
                apiBaseUrl={API_BASE_URL}
                apiKey={API_KEY}
              />
            </div>
          ) : (
            <div className="flex-grow-1 position-relative p-2 p-md-3">
              <AdvAnalytics
                darkMode={darkMode}
                stations={locationsWithAqi.map((s) => s.id)}
                stationLabels={Object.fromEntries(
                  locationsWithAqi.map((s) => [s.id, s.name])
                )}
                apiBaseUrl={API_BASE_URL}
                apiKey={API_KEY}
                analyticsView={analyticsView}
              />
            </div>
          )}
        </Col>
      </Row>

      {/* Off-canvas Sidebar for mobile (visible on xs/sm) */}
      <Offcanvas
        show={showSidebar}
        onHide={handleCloseSidebar}
        placement="start"
        responsive="md"
        className={`d-md-none ${darkMode ? "dark-mode" : ""}`}
      >
        {/* responsive="md" makes it behave like offcanvas below md, and hides it automatically above md */}
        {/* 'd-md-none' ensures this Offcanvas component itself doesn't interfere on larger screens */}
        <Offcanvas.Header closeButton></Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          {/* Pass handleCloseSidebar to potentially close it from within */}
          <Sidebar
            locations={locationsWithAqi}
            onLocationSelect={handleLocationSelect} // Already handles closing
            selectedLocationId={selectedLocation?.id}
            zoomedLocationId={zoomedLocation?.id}
            onLogout={handleLogout} // Consider if logout should close sidebar
            isAuthenticated={isAuthenticated}
            darkMode={darkMode}
            onLogoClick={() => setActiveView("map")}
            onCityZoom={handleCityZoom}
          />
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
  );
}

export default App;
