import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Image from "react-bootstrap/Image";
import { Sun, Moon } from "react-bootstrap-icons";
import "./LoginScreen.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function LoginScreen({ onLoginSuccess, darkMode, toggleDarkMode }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Add loading state for feedback

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: username,
          password,
        }
      );
      if (authError) {
        setError(authError.message || "Invalid email or password.");
      } else if (data?.user) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("Login API call failed:", err);
      setError(
        "Login request failed. Please check your connection or contact support."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container
      fluid
      className={`login-container d-flex justify-content-center align-items-center position-relative ${
        darkMode ? "dark-mode" : ""
      }`}
    >
      {/* Dark Mode Toggle Button - positioned absolute in top-right corner */}
      <Button
        variant={darkMode ? "light" : "dark"}
        size="sm"
        onClick={toggleDarkMode}
        className="position-absolute"
        style={{
          top: "20px",
          right: "20px",
          zIndex: 1050,
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </Button>

      <Row>
        <Col md={12} className="text-center">
          <div className="login-box p-4 p-md-5 rounded shadow-sm">
            <Image
              src={darkMode ? "/assets/logo.webp" : "/assets/logo.webp"}
              alt="EnviroCloud Logo"
              className="login-logo mb-4"
            />
            <Form onSubmit={handleLogin}>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form.Group className="mb-3" controlId="formBasicUsername">
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="text-center"
                  disabled={isLoading} // Disable during loading
                />
              </Form.Group>

              <Form.Group className="mb-4" controlId="formBasicPassword">
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-center"
                  disabled={isLoading} // Disable during loading
                />
              </Form.Group>
              <Button
                type="submit"
                className="log-in-button w-100"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default LoginScreen;
