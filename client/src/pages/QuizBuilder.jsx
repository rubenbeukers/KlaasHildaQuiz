import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

const EMPTY_OPTION = () => ({ text: '', isCorrect: false });
const EMPTY_QUESTION = () => ({
  text: '',
  type: 'single',
  timeLimit: 20,
  options: [EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION()],
});

const MAX_PLAYERS_OPTIONS = [
  { value: 10, label: '10 spelers', price: 'Gratis' },
  { value: 30, label: '30 spelers', price: '€5' },
  { value: 50, label: '50 spelers', price: '€10' },
  { value: 100, label: '100 spelers', price: '€15' },
  { value: 200, label: '100+ spelers', price: '€20' },
];

export default function QuizBuilder() {
  const { id } = useParams();
  const isEditing = id && id !== 'new';
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [activeQ, setActiveQ] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditing);

  // Load existing quiz for editing
  useEffect(() => {
    if (!isEditing) return;
    fetch(`${SERVER_URL}/api/quizzes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.quiz) {
          setTitle(data.quiz.title);
          setMaxPlayers(data.quiz.maxPlayers);
          setQuestions(
            data.quiz.questions.map(q => ({
              text: q.text,
              type: q.type,
              timeLimit: q.timeLimit,
              options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
            }))
          );
        }
      })
      .catch(() => setError('Quiz niet gevonden'))
      .finally(() => setLoading(false));
  }, [id]);

  const updateQuestion = (index, updates) => {
    setQuestions(qs => qs.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const updateOption = (qIndex, oIndex, updates) => {
    setQuestions(qs =>
      qs.map((q, qi) =>
        qi === qIndex
          ? {
              ...q,
              options: q.options.map((o, oi) => (oi === oIndex ? { ...o, ...updates } : o)),
            }
          : q
      )
    );
  };

  const toggleCorrect = (qIndex, oIndex) => {
    const q = questions[qIndex];
    if (q.type === 'single') {
      // Only one correct - set this one, unset others
      setQuestions(qs =>
        qs.map((q, qi) =>
          qi === qIndex
            ? {
                ...q,
                options: q.options.map((o, oi) => ({ ...o, isCorrect: oi === oIndex })),
              }
            : q
        )
      );
    } else {
      // Multiple correct - toggle
      updateOption(qIndex, oIndex, { isCorrect: !q.options[oIndex].isCorrect });
    }
  };

  const addQuestion = () => {
    setQuestions(qs => [...qs, EMPTY_QUESTION()]);
    setActiveQ(questions.length);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) return;
    setQuestions(qs => qs.filter((_, i) => i !== index));
    if (activeQ >= questions.length - 1) setActiveQ(Math.max(0, questions.length - 2));
  };

  const moveQuestion = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
    setActiveQ(newIndex);
  };

  const validate = () => {
    if (!title.trim()) return 'Geef je quiz een titel';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Vraag ${i + 1}: Voer een vraagtekst in`;
      const filledOptions = q.options.filter(o => o.text.trim());
      if (filledOptions.length < 2) return `Vraag ${i + 1}: Minimaal 2 antwoorden invullen`;
      const hasCorrect = q.options.some(o => o.isCorrect && o.text.trim());
      if (!hasCorrect) return `Vraag ${i + 1}: Selecteer minstens 1 juist antwoord`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    // Filter out empty options
    const cleanQuestions = questions.map(q => ({
      ...q,
      options: q.options.filter(o => o.text.trim()),
    }));

    try {
      const url = isEditing
        ? `${SERVER_URL}/api/quizzes/${id}`
        : `${SERVER_URL}/api/quizzes`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, maxPlayers, questions: cleanQuestions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');

      const savedQuizId = data.quiz?.id;

      // If maxPlayers > 10 and quiz not yet paid, redirect to payment
      if (maxPlayers > 10 && savedQuizId) {
        try {
          const payRes = await fetch(`${SERVER_URL}/api/payments/create-checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ quizId: savedQuizId }),
          });
          const payData = await payRes.json();
          if (payData.url) {
            window.location.href = payData.url;
            return;
          }
          // If free or payment not configured, go to dashboard
        } catch {
          // Payment not available, continue to dashboard
        }
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Quiz laden...</p>
      </div>
    );
  }

  const q = questions[activeQ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-500 hover:text-gray-700 font-medium text-sm"
          >
            ← Terug
          </button>
          <h1 className="font-bold text-gray-900">
            {isEditing ? 'Quiz bewerken' : 'Nieuwe Quiz'}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold px-6 py-2 rounded-xl text-sm transition-colors"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - question list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              {/* Quiz title */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
                  Quiz Titel
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Bijv. Klaas & Hilda Quiz"
                />
              </div>

              {/* Max players */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
                  Max Spelers
                </label>
                <select
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {MAX_PLAYERS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.price})
                    </option>
                  ))}
                </select>
              </div>

              {/* Question list */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">
                  Vragen ({questions.length})
                </label>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveQ(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        i === activeQ
                          ? 'bg-indigo-100 text-indigo-700 font-semibold'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span className="font-mono text-xs mr-2">{i + 1}.</span>
                      {q.text.trim() || 'Nieuwe vraag...'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={addQuestion}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-xl text-sm transition-colors"
              >
                + Vraag toevoegen
              </button>
            </div>
          </div>

          {/* Right - question editor */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">
                  Vraag {activeQ + 1} van {questions.length}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveQuestion(activeQ, -1)}
                    disabled={activeQ === 0}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                    title="Omhoog"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveQuestion(activeQ, 1)}
                    disabled={activeQ === questions.length - 1}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                    title="Omlaag"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => removeQuestion(activeQ)}
                    disabled={questions.length <= 1}
                    className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm font-medium ml-2"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>

              {/* Question text */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Vraag</label>
                <textarea
                  value={q.text}
                  onChange={e => updateQuestion(activeQ, { text: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Typ hier je vraag..."
                />
              </div>

              {/* Question settings row */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                  <select
                    value={q.type}
                    onChange={e => {
                      const newType = e.target.value;
                      updateQuestion(activeQ, { type: newType });
                      // If switching to single, keep only first correct
                      if (newType === 'single') {
                        const firstCorrectIdx = q.options.findIndex(o => o.isCorrect);
                        setQuestions(qs =>
                          qs.map((qq, qi) =>
                            qi === activeQ
                              ? {
                                  ...qq,
                                  type: 'single',
                                  options: qq.options.map((o, oi) => ({
                                    ...o,
                                    isCorrect: oi === (firstCorrectIdx >= 0 ? firstCorrectIdx : 0),
                                  })),
                                }
                              : qq
                          )
                        );
                      }
                    }}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="single">1 goed antwoord</option>
                    <option value="multiple">Meerdere goed</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Tijdlimiet: {q.timeLimit}s
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={q.timeLimit}
                    onChange={e => updateQuestion(activeQ, { timeLimit: parseInt(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>5s</span>
                    <span>60s</span>
                  </div>
                </div>
              </div>

              {/* Answer options */}
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Antwoorden
                <span className="font-normal text-gray-400 ml-1">
                  (klik {q.type === 'single' ? 'het juiste antwoord' : 'de juiste antwoorden'})
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, oi) => {
                  const colors = [
                    { bg: 'bg-red-50', border: 'border-red-200', active: 'bg-red-500', ring: 'ring-red-300' },
                    { bg: 'bg-blue-50', border: 'border-blue-200', active: 'bg-blue-500', ring: 'ring-blue-300' },
                    { bg: 'bg-yellow-50', border: 'border-yellow-200', active: 'bg-yellow-500', ring: 'ring-yellow-300' },
                    { bg: 'bg-green-50', border: 'border-green-200', active: 'bg-green-500', ring: 'ring-green-300' },
                  ];
                  const c = colors[oi];
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        opt.isCorrect
                          ? `${c.bg} ${c.border} ring-2 ${c.ring}`
                          : 'border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCorrect(activeQ, oi)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition-colors ${
                          opt.isCorrect ? c.active : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                      >
                        {opt.isCorrect ? '✓' : String.fromCharCode(65 + oi)}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => updateOption(activeQ, oi, { text: e.target.value })}
                        className="flex-1 bg-transparent border-none outline-none text-sm"
                        placeholder={`Antwoord ${String.fromCharCode(65 + oi)}...`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setActiveQ(Math.max(0, activeQ - 1))}
                  disabled={activeQ === 0}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-30 font-medium text-sm"
                >
                  ← Vorige vraag
                </button>
                {activeQ < questions.length - 1 ? (
                  <button
                    onClick={() => setActiveQ(activeQ + 1)}
                    className="text-indigo-600 hover:text-indigo-500 font-medium text-sm"
                  >
                    Volgende vraag →
                  </button>
                ) : (
                  <button
                    onClick={addQuestion}
                    className="text-indigo-600 hover:text-indigo-500 font-medium text-sm"
                  >
                    + Nieuwe vraag
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
