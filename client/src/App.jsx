import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import HostView from './pages/HostView.jsx';
import PlayerView from './pages/PlayerView.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/host"        element={<HostView />} />
        <Route path="/host/:pin"   element={<HostView />} />
        <Route path="/join"        element={<PlayerView />} />
        <Route path="/play/:pin"   element={<PlayerView />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
