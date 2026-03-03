import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import HostView from './pages/HostView.jsx';
import PlayerView from './pages/PlayerView.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Laden...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<Register />} />
          <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/host"        element={<HostView />} />
          <Route path="/host/:pin"   element={<HostView />} />
          <Route path="/join"        element={<PlayerView />} />
          <Route path="/play/:pin"   element={<PlayerView />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
