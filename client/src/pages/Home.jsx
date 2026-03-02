import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center gap-8 p-6">
      {/* Logo */}
      <div className="text-center animate-pop">
        <div className="text-7xl mb-3">⚡</div>
        <h1 className="text-6xl font-black text-white tracking-tight">QuizBlast</h1>
        <p className="text-indigo-300 text-lg mt-2">Real-time multiplayer quiz</p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
        <button
          onClick={() => navigate('/host')}
          className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white py-5 px-8 rounded-2xl text-2xl font-bold shadow-lg hover:shadow-purple-500/30 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
        >
          🎮 Host a Game
        </button>

        <button
          onClick={() => navigate('/join')}
          className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white py-5 px-8 rounded-2xl text-2xl font-bold shadow-lg hover:shadow-emerald-500/30 hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
        >
          🎯 Join a Game
        </button>
      </div>

      <p className="text-indigo-600 text-sm text-center">
        Up to 100 players · Live leaderboard · Speed scoring
      </p>
    </div>
  );
}
