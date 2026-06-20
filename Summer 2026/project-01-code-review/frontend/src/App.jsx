// Root component — sets up routing and the global auth context
// I'm keeping the auth state at the top level so any component can access it
// without prop drilling

import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, createContext, useContext } from "react";
import HomePage from "./pages/HomePage";
import ReviewPage from "./pages/ReviewPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CreatePage from "./pages/CreatePage";
import Navbar from "./components/Navbar";

// Auth context — I export this so any component can call useAuth()
export const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  // Store the token in React state (not localStorage — storing JWTs in localStorage
  // is a security risk because JS can read it, making XSS attacks worse)
  // The downside is the user gets logged out on refresh, which is fine for now
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  function login(newToken, userData) {
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoggedIn: !!token }}>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/new"
            element={token ? <CreatePage /> : <Navigate to="/login" replace />}
          />
          <Route path="/review/:shareId" element={<ReviewPage />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}
