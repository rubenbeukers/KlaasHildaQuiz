import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setQuizzes(data.quizzes);
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Weet je zeker dat je deze quiz wilt verwijderen?')) return;
    try {
      await fetch(`${SERVER_URL}/api/quizzes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
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
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/history')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Historie
            </button>
            <button
              onClick={() => navigate('/quiz/new')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              + Nieuwe Quiz
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : quizzes.length === 0 ? (
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
        ) : (
          <div className="grid gap-4">
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                  <div className="flex gap-4 mt-1 text-sm text-gray-500">
                    <span>{quiz._count.questions} vragen</span>
                    <span>Max {quiz.maxPlayers} spelers</span>
                    {quiz._count.gameSessions > 0 && (
                      <span>{quiz._count.gameSessions}x gespeeld</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/quiz/${quiz.id}/edit`)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => navigate(`/host?quizId=${quiz.id}`)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    Starten
                  </button>
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
