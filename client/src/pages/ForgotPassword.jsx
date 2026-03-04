import { useState } from 'react';
import { Link } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-4xl">🔑</span>
          <h1 className="text-2xl font-black text-gray-900 mt-2">Wachtwoord vergeten?</h1>
          <p className="text-gray-500 text-sm mt-1">
            Vul je emailadres in en we sturen je een resetlink.
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-4 mb-6 text-sm">
              <p className="font-semibold mb-1">📧 Email verstuurd!</p>
              <p>Als dit emailadres bij ons bekend is, ontvang je binnen enkele minuten een email met een resetlink.</p>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Geen email ontvangen? Check je spam-map of probeer het opnieuw.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-indigo-600 font-semibold hover:underline text-sm"
            >
              Opnieuw proberen
            </button>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none transition-colors"
                  placeholder="je@email.nl"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? 'Even geduld...' : 'Resetlink versturen'}
              </button>
            </form>
          </>
        )}

        <div className="text-center mt-6 space-y-2">
          <p>
            <Link to="/login" className="text-indigo-600 font-semibold hover:underline text-sm">
              ← Terug naar inloggen
            </Link>
          </p>
          <p>
            <Link to="/" className="text-gray-400 text-sm hover:text-gray-600">
              ← Terug naar home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
