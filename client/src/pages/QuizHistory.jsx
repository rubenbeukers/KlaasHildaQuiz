import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function QuizHistory() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [results, setResults] = useState({});

  useEffect(() => {
    fetch(`${SERVER_URL}/api/quizzes/history/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (sessionId) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);

    if (!results[sessionId]) {
      try {
        const res = await fetch(`${SERVER_URL}/api/quizzes/history/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(prev => ({ ...prev, [sessionId]: data.session?.results || [] }));
      } catch {
        setResults(prev => ({ ...prev, [sessionId]: [] }));
      }
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <span className="text-2xl">🔥</span>
            <h1 className="text-xl font-black text-gray-900">Quizonaire</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-500 hover:text-gray-700 font-medium text-sm"
          >
            ← Terug naar Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-black text-gray-900 mb-6">Quiz Historie</h2>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Laden...</p>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <span className="text-5xl block mb-4">📊</span>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Nog geen gespeelde quizzen</h3>
            <p className="text-gray-500">Start een quiz vanuit je dashboard om hier resultaten te zien.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full text-left p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-gray-900">{s.quiz?.title || 'Onbekende quiz'}</h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500">
                      <span>{formatDate(s.createdAt)}</span>
                      <span>{s.playerCount} spelers</span>
                      <span>PIN: {s.pin}</span>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xl">{expandedId === s.id ? '▲' : '▼'}</span>
                </button>

                {expandedId === s.id && (
                  <div className="border-t border-gray-100 p-5">
                    {!results[s.id] ? (
                      <p className="text-gray-500 text-sm">Laden...</p>
                    ) : results[s.id].length === 0 ? (
                      <p className="text-gray-500 text-sm">Geen resultaten beschikbaar</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-left">
                            <th className="pb-2 font-semibold">#</th>
                            <th className="pb-2 font-semibold">Speler</th>
                            <th className="pb-2 font-semibold text-right">Score</th>
                            <th className="pb-2 font-semibold text-right">Goed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results[s.id].map((r, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="py-2 font-bold text-gray-400">{r.finalRank || i + 1}</td>
                              <td className="py-2 font-semibold text-gray-900">{r.nickname}</td>
                              <td className="py-2 text-right font-mono text-gray-700">{r.finalScore.toLocaleString()}</td>
                              <td className="py-2 text-right text-gray-500">{r.correctCount}/{r.totalQuestions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
