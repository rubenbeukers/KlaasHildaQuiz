import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const isAdmin = user?.isAdmin || false;
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

  const handlePayment = async (quizId) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/payments/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quizId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.free) {
        fetchQuizzes();
      } else {
        alert(data.error || 'Betalingen zijn nog niet geconfigureerd');
      }
    } catch {
      alert('Betaling niet beschikbaar');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const totalQuestions = quizzes.reduce((sum, q) => sum + (q._count?.questions || 0), 0);
  const totalGames = quizzes.reduce((sum, q) => sum + (q._count?.gameSessions || 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .dash * { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>

      <div className="dash min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <span className="text-xl">🔥</span>
              <h1 className="text-lg font-extrabold text-slate-900">Quizonaire</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {(user?.name || user?.email || '?')[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {user?.name || user?.email}
                </span>
                {isAdmin && (
                  <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">ADMIN</span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Hero / Welcome */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 sm:p-8 mb-6 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative">
              <h2 className="text-xl sm:text-2xl font-extrabold mb-1">
                Welkom terug{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
              </h2>
              <p className="text-white/70 text-sm mb-5">
                Beheer je quizzen, start een spel of maak iets nieuws.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/quiz/new')}
                  className="flex items-center gap-2 bg-white text-violet-700 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-white/90 transition-all active:scale-95 shadow-lg shadow-black/10"
                >
                  <span className="text-lg">+</span>
                  Nieuwe Quiz
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="flex items-center gap-2 bg-white/15 backdrop-blur hover:bg-white/25 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  📊 Spelhistorie
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            {[
              { label: 'Quizzen', value: quizzes.length, icon: '📝', color: 'from-violet-500 to-purple-600' },
              { label: 'Vragen', value: totalQuestions, icon: '❓', color: 'from-blue-500 to-cyan-600' },
              { label: 'Gespeeld', value: totalGames, icon: '🎮', color: 'from-emerald-500 to-teal-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{stat.icon}</span>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{stat.label}</span>
                </div>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Quizzes Section */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Mijn Quizzen</h3>
            <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
              {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzen'}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Laden...</span>
              </div>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 sm:p-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Nog geen quizzen</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Maak je eerste quiz aan met de AI-generator of bouw er zelf een. Deel hem daarna met je publiek!
              </p>
              <button
                onClick={() => navigate('/quiz/new')}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-violet-200"
              >
                + Maak je eerste quiz
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {quizzes.map(quiz => {
                const qCount = quiz._count?.questions || 0;
                const gCount = quiz._count?.gameSessions || 0;
                const needsPayment = !isAdmin && quiz.maxPlayers > 10 && !quiz.isPaid;

                return (
                  <div
                    key={quiz.id}
                    className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Left: Quiz Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-base font-bold text-slate-900 truncate">{quiz.title}</h4>
                          {isAdmin && (
                            <span className="flex-shrink-0 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ADMIN
                            </span>
                          )}
                          {needsPayment && (
                            <span className="flex-shrink-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              💳 Niet betaald
                            </span>
                          )}
                          {!isAdmin && quiz.maxPlayers > 10 && quiz.isPaid && (
                            <span className="flex-shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              ✓ Betaald
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                            {qCount} {qCount === 1 ? 'vraag' : 'vragen'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            Max {quiz.maxPlayers} spelers
                          </span>
                          {gCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {gCount}× gespeeld
                            </span>
                          )}
                          {quiz.theme && quiz.theme !== 'default' && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              {quiz.theme}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => navigate(`/quiz/${quiz.id}/edit`)}
                          className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold transition-colors"
                        >
                          ✏️ Bewerken
                        </button>

                        {needsPayment ? (
                          <button
                            onClick={() => handlePayment(quiz.id)}
                            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors"
                          >
                            💳 Betalen
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/host?quizId=${quiz.id}`)}
                            className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors"
                          >
                            ▶ Starten
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(quiz.id)}
                          className="px-2.5 py-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 text-xs transition-colors"
                          title="Verwijderen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
