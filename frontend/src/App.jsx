import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import SafeCommuteDashboard from './pages/SafeCommuteDashboard';
import RouteSetup from './pages/RouteSetup';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/safecommute" replace />} />
      <Route path="/login"       element={<Login />} />
      <Route path="/safecommute" element={<SafeCommuteDashboard />} />
      <Route path="/setup"       element={<RouteSetup />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
