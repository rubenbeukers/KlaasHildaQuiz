import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import HostView from './pages/HostView.jsx';
import PlayerView from './pages/PlayerView.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import QuizBuilder from './pages/QuizBuilder.jsx';
import QuizHistory from './pages/QuizHistory.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/quiz/new"    element={<ProtectedRoute><QuizBuilder /></ProtectedRoute>} />
          <Route path="/quiz/:id/edit" element={<ProtectedRoute><QuizBuilder /></ProtectedRoute>} />
          <Route path="/history"     element={<ProtectedRoute><QuizHistory /></ProtectedRoute>} />
          <Route path="/host"        element={<ErrorBoundary><HostView /></ErrorBoundary>} />
          <Route path="/host/:pin"   element={<ErrorBoundary><HostView /></ErrorBoundary>} />
          <Route path="/join"        element={<ErrorBoundary><PlayerView /></ErrorBoundary>} />
          <Route path="/play/:pin"   element={<ErrorBoundary><PlayerView /></ErrorBoundary>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
