import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Auto-redirect naar login na succes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Geen token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-2xl font-black text-gray-900 mt-2 mb-3">Ongeldige link</h1>
          <p className="text-gray-500 text-sm mb-6">
            Deze resetlink is ongeldig. Vraag een nieuwe link aan.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Nieuwe link aanvragen
          </Link>
          <div className="mt-4">
            <Link to="/login" className="text-gray-400 text-sm hover:text-gray-600">
              ← Terug naar inloggen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-4xl">🔒</span>
          <h1 className="text-2xl font-black text-gray-900 mt-2">Nieuw wachtwoord</h1>
          <p className="text-gray-500 text-sm mt-1">Kies een nieuw wachtwoord voor je account.</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-4 mb-4 text-sm">
              <p className="font-semibold mb-1">✅ Wachtwoord gewijzigd!</p>
              <p>Je wachtwoord is succesvol gewijzigd. Je wordt doorgestuurd naar de inlogpagina...</p>
            </div>
            <Link
              to="/login"
              className="text-indigo-600 font-semibold hover:underline text-sm"
            >
              Direct naar inloggen →
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nieuw wachtwoord</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none transition-colors"
                  placeholder="Minimaal 6 tekens"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bevestig wachtwoord</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none transition-colors"
                  placeholder="Herhaal je wachtwoord"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? 'Even geduld...' : 'Wachtwoord wijzigen'}
              </button>
            </form>
          </>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-gray-400 text-sm hover:text-gray-600">
            ← Terug naar inloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
