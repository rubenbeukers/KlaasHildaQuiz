import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
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
          <span className="text-4xl">🔥</span>
          <h1 className="text-2xl font-black text-gray-900 mt-2">Login</h1>
          <p className="text-gray-500 text-sm mt-1">Log in op je Quizmaster account</p>
        </div>

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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Even geduld...' : 'Inloggen'}
          </button>
        </form>

        <div className="text-right mt-2">
          <Link to="/forgot-password" className="text-indigo-600 text-sm hover:underline">
            Wachtwoord vergeten?
          </Link>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Nog geen account?{' '}
          <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
            Registreren
          </Link>
        </p>

        <div className="text-center mt-4">
          <Link to="/" className="text-gray-400 text-sm hover:text-gray-600">
            ← Terug naar home
          </Link>
        </div>
      </div>
    </div>
  );
}
