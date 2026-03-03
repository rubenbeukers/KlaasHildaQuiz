import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-black text-gray-900">QuizBlast</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">
              {user?.name || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 text-sm font-medium"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-gray-900">Mijn Quizzen</h2>
          <button
            onClick={() => navigate('/quiz/new')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            + Nieuwe Quiz
          </button>
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <span className="text-5xl block mb-4">📝</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Nog geen quizzen</h3>
          <p className="text-gray-500 mb-6">Maak je eerste quiz aan en deel hem met je publiek!</p>
          <button
            onClick={() => navigate('/quiz/new')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Maak je eerste quiz
          </button>
        </div>
      </main>
    </div>
  );
}
