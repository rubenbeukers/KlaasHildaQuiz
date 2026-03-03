import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== password2) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name);
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
          <span className="text-4xl">⚡</span>
          <h1 className="text-2xl font-black text-gray-900 mt-2">Account aanmaken</h1>
          <p className="text-gray-500 text-sm mt-1">Maak een QuizBlast account aan</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Je naam"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none transition-colors"
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
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Minimaal 6 tekens"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Wachtwoord bevestigen</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Herhaal wachtwoord"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Even geduld...' : 'Account aanmaken'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Al een account?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Inloggen
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
