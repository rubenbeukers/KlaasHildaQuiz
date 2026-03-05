import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center gap-8 p-6">
      {/* Logo */}
      <div className="text-center animate-pop">
        <div className="text-7xl mb-3">🔥</div>
        <h1 className="text-6xl font-black text-white tracking-tight">Quizonaire</h1>
        <p className="text-indigo-300 text-lg mt-2">Real-time multiplayer quiz</p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white py-5 px-8 rounded-2xl text-2xl font-bold shadow-lg hover:shadow-purple-500/30 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
          >
            📋 Mijn Quizzen
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white py-5 px-8 rounded-2xl text-2xl font-bold shadow-lg hover:shadow-purple-500/30 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
          >
            🎮 Quiz maken
          </button>
        )}

        <button
          onClick={() => navigate('/join')}
          className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white py-5 px-8 rounded-2xl text-2xl font-bold shadow-lg hover:shadow-emerald-500/30 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
        >
          🎯 Meedoen aan quiz
        </button>
      </div>

      {!user && (
        <p className="text-indigo-400 text-sm text-center">
          <span
            onClick={() => navigate('/login')}
            className="underline cursor-pointer hover:text-indigo-300"
          >
            Inloggen
          </span>
          {' · '}
          <span
            onClick={() => navigate('/register')}
            className="underline cursor-pointer hover:text-indigo-300"
          >
            Account aanmaken
          </span>
        </p>
      )}

      <p className="text-indigo-600 text-sm text-center">
        Tot 100+ spelers · Live ranglijst · Snelheidsscore
      </p>
    </div>
  );
}
