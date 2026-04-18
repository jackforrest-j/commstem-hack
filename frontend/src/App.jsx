import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import AccountSetup from './pages/AccountSetup';
import SafeCommuteDashboard from './pages/SafeCommuteDashboard';
import RouteSetup from './pages/RouteSetup';
import ChildView from './pages/ChildView';

// Wraps the parent dashboard — redirects to login if not authed,
// redirects to account setup if no child profile exists yet.
function RequireSetup({ children }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    supabase.from('children').select('id').eq('parent_id', user.id).then(({ data }) => {
      if (!data?.length) navigate('/account-setup', { replace: true });
      else setReady(true);
    });
  }, [user]);

  if (!ready) return null;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"               element={<Navigate to="/safecommute" replace />} />
      <Route path="/login"          element={<Login />} />
      <Route path="/account-setup"  element={<AccountSetup />} />
      <Route path="/child"          element={<ChildView />} />
      <Route path="/safecommute"    element={<RequireSetup><SafeCommuteDashboard /></RequireSetup>} />
      <Route path="/setup"          element={<RequireSetup><RouteSetup /></RequireSetup>} />
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
