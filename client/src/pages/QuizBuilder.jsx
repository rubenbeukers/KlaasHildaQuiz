import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { THEME_LIST, QUESTION_BACKGROUNDS } from '../themes';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Clock,
  Sparkles,
  Settings,
  X,
  Image,
  Users,
  Palette,
  Hash,
  Type,
  Timer,
  Star,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

const EMPTY_OPTION = () => ({ text: '', isCorrect: false });
const EMPTY_QUESTION = () => ({
  text: '',
  type: 'single',
  timeLimit: 20,
  points: 'standard',
  background: null,
  options: [EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION(), EMPTY_OPTION()],
});

const MAX_PLAYERS_OPTIONS = [
  { value: 10, label: '10 spelers', price: 'Gratis' },
  { value: 30, label: '30 spelers', price: '€5' },
  { value: 50, label: '50 spelers', price: '€10' },
  { value: 100, label: '100 spelers', price: '€15' },
  { value: 200, label: '100+ spelers', price: '€20' },
];

const ANSWER_STYLES = [
  { bg: 'bg-red-50', border: 'border-red-200', activeBorder: 'border-red-400', activeBg: 'bg-red-100', badge: 'bg-red-500', letter: 'A', hoverBg: 'hover:bg-red-50/60' },
  { bg: 'bg-blue-50', border: 'border-blue-200', activeBorder: 'border-blue-400', activeBg: 'bg-blue-100', badge: 'bg-blue-500', letter: 'B', hoverBg: 'hover:bg-blue-50/60' },
  { bg: 'bg-amber-50', border: 'border-amber-200', activeBorder: 'border-amber-400', activeBg: 'bg-amber-100', badge: 'bg-amber-500', letter: 'C', hoverBg: 'hover:bg-amber-50/60' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', activeBorder: 'border-emerald-400', activeBg: 'bg-emerald-100', badge: 'bg-emerald-500', letter: 'D', hoverBg: 'hover:bg-emerald-50/60' },
];

export default function QuizBuilder() {
  const { id } = useParams();
  const isEditing = id && id !== 'new';
  const { token, user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [theme, setTheme] = useState('default');
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [activeQ, setActiveQ] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditing);

  // AI generation state
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(10);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const questionListRef = useRef(null);

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
          setTheme(data.quiz.theme || 'default');
          setQuestions(
            data.quiz.questions.map(q => ({
              text: q.text,
              type: q.type,
              timeLimit: q.timeLimit,
              points: q.points || 'standard',
              background: q.background || null,
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
          ? { ...q, options: q.options.map((o, oi) => (oi === oIndex ? { ...o, ...updates } : o)) }
          : q
      )
    );
  };

  const toggleCorrect = (qIndex, oIndex) => {
    const q = questions[qIndex];
    if (q.type === 'single') {
      setQuestions(qs =>
        qs.map((q, qi) =>
          qi === qIndex
            ? { ...q, options: q.options.map((o, oi) => ({ ...o, isCorrect: oi === oIndex })) }
            : q
        )
      );
    } else {
      updateOption(qIndex, oIndex, { isCorrect: !q.options[oIndex].isCorrect });
    }
  };

  const addQuestion = () => {
    setQuestions(qs => [...qs, EMPTY_QUESTION()]);
    setActiveQ(questions.length);
    setTimeout(() => {
      questionListRef.current?.scrollTo({ top: questionListRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
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

    const cleanQuestions = questions.map(q => ({
      ...q,
      options: q.options.filter(o => o.text.trim()),
    }));

    try {
      const url = isEditing ? `${SERVER_URL}/api/quizzes/${id}` : `${SERVER_URL}/api/quizzes`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, maxPlayers, theme, questions: cleanQuestions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');

      const savedQuizId = data.quiz?.id;

      if (maxPlayers > 10 && savedQuizId && !isAdmin) {
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
        } catch {
          // Payment not available
        }
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      setAiError('Vul een onderwerp in');
      return;
    }

    setAiGenerating(true);
    setAiError('');

    try {
      const res = await fetch(`${SERVER_URL}/api/quizzes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topic: aiTopic.trim(), numQuestions: aiNumQuestions }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generatie mislukt');

      if (data.title) setTitle(data.title);
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setActiveQ(0);
      }

      setAiTopic('');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Quiz laden...</span>
        </div>
      </div>
    );
  }

  const q = questions[activeQ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .quiz-builder * { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        .quiz-builder input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          outline: none;
        }
        .quiz-builder input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .quiz-builder input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div className="quiz-builder min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Terug</span>
              </button>
              <div className="w-px h-5 bg-slate-200 hidden sm:block" />
              <span className="text-sm font-semibold text-slate-800 hidden sm:inline">
                {isEditing ? 'Quiz bewerken' : 'Nieuwe Quiz'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center gap-1.5 text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm"
              >
                <Settings size={16} />
                <span>Instellingen</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-300 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all active:scale-95"
              >
                <Save size={15} />
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-3">
            <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[320px] bg-white shadow-xl overflow-y-auto" style={{ animation: 'slideIn 0.2s ease-out' }}>
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <span className="font-semibold text-slate-800 text-sm">Quiz Instellingen</span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <SettingsPanel
                  title={title} setTitle={setTitle}
                  maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers}
                  theme={theme} setTheme={setTheme}
                  isAdmin={isAdmin}
                  aiTopic={aiTopic} setAiTopic={setAiTopic}
                  aiNumQuestions={aiNumQuestions} setAiNumQuestions={setAiNumQuestions}
                  aiGenerating={aiGenerating} aiError={aiError}
                  handleAiGenerate={handleAiGenerate}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main 3-column layout */}
        <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-5">
            {/* LEFT — Quiz Settings (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-[72px]">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 overflow-y-auto max-h-[calc(100vh-100px)]">
                  <SettingsPanel
                    title={title} setTitle={setTitle}
                    maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers}
                    theme={theme} setTheme={setTheme}
                    isAdmin={isAdmin}
                    aiTopic={aiTopic} setAiTopic={setAiTopic}
                    aiNumQuestions={aiNumQuestions} setAiNumQuestions={setAiNumQuestions}
                    aiGenerating={aiGenerating} aiError={aiError}
                    handleAiGenerate={handleAiGenerate}
                  />
                </div>
              </div>
            </aside>

            {/* CENTER — Question Editor (hero) */}
            <section className="min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                {/* Question header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600 text-sm font-bold">
                      {activeQ + 1}
                    </span>
                    <span className="text-sm text-slate-400 font-medium">
                      van {questions.length} {questions.length === 1 ? 'vraag' : 'vragen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveQuestion(activeQ, -1)}
                      disabled={activeQ === 0}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveQuestion(activeQ, 1)}
                      disabled={activeQ === questions.length - 1}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <button
                      onClick={() => removeQuestion(activeQ)}
                      disabled={questions.length <= 1}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Question text — hero */}
                <div className="mb-6">
                  <textarea
                    value={q.text}
                    onChange={e => updateQuestion(activeQ, { text: e.target.value })}
                    className="w-full text-xl sm:text-2xl font-semibold text-slate-800 placeholder:text-slate-300 border-none outline-none resize-none bg-transparent leading-relaxed"
                    rows={2}
                    placeholder="Typ hier je vraag..."
                    style={{ borderBottom: '2px solid transparent', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderBottomColor = '#ddd6fe')}
                    onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
                  />
                  <div className="text-right text-xs text-slate-300 mt-1">{q.text.length} tekens</div>
                </div>

                {/* Answer grid 2x2 */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Type size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Antwoorden</span>
                    <span className="text-xs text-slate-300 font-normal normal-case ml-1">
                      — klik {q.type === 'single' ? 'het juiste antwoord' : 'de juiste antwoorden'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, oi) => {
                      const s = ANSWER_STYLES[oi];
                      const isCorrect = opt.isCorrect;
                      return (
                        <div
                          key={oi}
                          className={`group relative flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-150 hover:scale-[1.01] ${
                            isCorrect
                              ? `${s.activeBg} ${s.activeBorder}`
                              : `bg-white border-slate-200 ${s.hoverBg}`
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCorrect(activeQ, oi)}
                            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold transition-all active:scale-90 ${
                              isCorrect ? s.badge : 'bg-slate-300 hover:bg-slate-400'
                            }`}
                          >
                            {isCorrect ? <Check size={16} strokeWidth={3} /> : s.letter}
                          </button>

                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => updateOption(activeQ, oi, { text: e.target.value })}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-300 font-medium"
                            placeholder={`Antwoord ${s.letter}...`}
                          />

                          {isCorrect && (
                            <span className="absolute top-1.5 right-2 text-emerald-500">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Question settings row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Hash size={12} className="text-slate-400" />
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Type</label>
                    </div>
                    <select
                      value={q.type}
                      onChange={e => {
                        const newType = e.target.value;
                        updateQuestion(activeQ, { type: newType });
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
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-medium focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-100 bg-white transition-colors"
                    >
                      <option value="single">1 goed antwoord</option>
                      <option value="multiple">Meerdere goed</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Timer size={12} className="text-slate-400" />
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tijdlimiet</label>
                    </div>
                    <div className="border border-slate-200 rounded-xl px-3 py-2 bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">5s</span>
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{q.timeLimit}s</span>
                        <span className="text-xs text-slate-400">120s</span>
                      </div>
                      <input
                        type="range" min={5} max={120} step={5}
                        value={q.timeLimit}
                        onChange={e => updateQuestion(activeQ, { timeLimit: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Star size={12} className="text-slate-400" />
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Punten</label>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden flex">
                      {['standard', 'double', 'none'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => updateQuestion(activeQ, { points: mode })}
                          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                            (q.points || 'standard') === mode
                              ? 'bg-violet-600 text-white'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'standard' ? 'Standaard' : mode === 'double' ? 'Dubbel' : 'Geen'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Background picker */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Image size={12} className="text-slate-400" />
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Achtergrond</label>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {QUESTION_BACKGROUNDS.map(bg => (
                      <button
                        key={bg.key}
                        onClick={() => updateQuestion(activeQ, { background: bg.css })}
                        className={`w-12 h-9 rounded-lg transition-all flex items-center justify-center ${
                          (q.background || null) === bg.css
                            ? 'ring-2 ring-violet-500 ring-offset-2 scale-110'
                            : 'hover:scale-105 ring-1 ring-slate-200'
                        }`}
                        style={{ background: bg.preview }}
                        title={bg.label}
                      >
                        {bg.key === 'none' && <X size={12} className="text-slate-400" />}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={q.background && !QUESTION_BACKGROUNDS.some(bg => bg.css === q.background) ? q.background : ''}
                    onChange={e => updateQuestion(activeQ, { background: e.target.value || null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:border-violet-400 focus:outline-none placeholder:text-slate-300 bg-white"
                    placeholder="Of plak een afbeelding-URL (bijv. https://...jpg)"
                  />
                </div>
              </div>

              {/* AI Generate section */}
              <div className="mt-5">
                <div className="relative rounded-2xl p-[1px]" style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                  <div className="bg-white rounded-[15px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-violet-600" />
                      <span className="text-sm font-bold text-slate-800">AI Genereren</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-blue-600 px-2 py-0.5 rounded-full">
                        Beta
                      </span>
                    </div>

                    <textarea
                      value={aiTopic}
                      onChange={e => setAiTopic(e.target.value)}
                      disabled={aiGenerating}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:border-violet-400 focus:outline-none resize-none placeholder:text-slate-300 mb-3"
                      rows={2}
                      placeholder="Beschrijf een onderwerp of plak tekst..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !aiGenerating) {
                          e.preventDefault();
                          handleAiGenerate();
                        }
                      }}
                    />

                    <div className="flex gap-2">
                      <select
                        value={aiNumQuestions}
                        onChange={e => setAiNumQuestions(parseInt(e.target.value))}
                        disabled={aiGenerating}
                        className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:border-violet-400 focus:outline-none bg-white font-medium"
                      >
                        {[5, 10, 15, 20].map(n => (
                          <option key={n} value={n}>{n} vragen</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAiGenerate}
                        disabled={aiGenerating || !aiTopic.trim()}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95"
                      >
                        {aiGenerating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Genereren...
                          </>
                        ) : (
                          <>
                            <Sparkles size={15} />
                            Genereer Quiz
                          </>
                        )}
                      </button>
                    </div>

                    {aiGenerating && (
                      <div className="text-xs text-violet-500 mt-2 animate-pulse">
                        AI genereert vragen over &ldquo;{aiTopic}&rdquo;...
                      </div>
                    )}
                    {aiError && <div className="text-xs text-red-500 mt-2">{aiError}</div>}
                  </div>
                </div>
              </div>
            </section>

            {/* RIGHT — Question List */}
            <aside className="hidden lg:block">
              <div className="sticky top-[72px]">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-[calc(100vh-100px)] flex flex-col">
                  <div className="px-5 pt-5 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Hash size={14} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Vragen</span>
                      </div>
                      <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                        {questions.length}
                      </span>
                    </div>
                  </div>

                  <div ref={questionListRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
                    {questions.map((qi, i) => {
                      const isActive = i === activeQ;
                      const hasContent = qi.text.trim();
                      const answeredCount = qi.options.filter(o => o.text.trim()).length;
                      const hasCorrect = qi.options.some(o => o.isCorrect && o.text.trim());
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveQ(i)}
                          className={`group w-full text-left rounded-xl transition-all duration-150 ${
                            isActive
                              ? 'bg-violet-50 border-l-4 border-l-violet-600 pl-3 pr-3 py-3'
                              : 'hover:bg-slate-50 pl-4 pr-3 py-3 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                              isActive ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {i + 1}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate leading-snug ${
                                isActive ? 'font-semibold text-violet-800' : hasContent ? 'text-slate-700' : 'text-slate-300 italic'
                              }`}>
                                {hasContent ? qi.text : 'Lege vraag...'}
                              </p>
                              <div className="flex items-center gap-2.5 mt-1">
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <Type size={10} /> {answeredCount}/4
                                </span>
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <Clock size={10} /> {qi.timeLimit}s
                                </span>
                                {hasCorrect && (
                                  <span className="text-[10px] text-emerald-500"><Check size={10} /></span>
                                )}
                                {qi.background && (
                                  <span
                                    className="w-3 h-3 rounded-full ring-1 ring-slate-200"
                                    style={{ background: qi.background.startsWith('http') ? '#8b5cf6' : qi.background }}
                                  />
                                )}
                              </div>
                            </div>

                            {questions.length > 1 && (
                              <button
                                onClick={e => { e.stopPropagation(); removeQuestion(i); }}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3 border-t border-slate-100">
                    <button
                      onClick={addQuestion}
                      className="group w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-violet-400 text-slate-400 hover:text-violet-600 font-semibold py-3 rounded-xl text-sm transition-all"
                    >
                      <Plus size={16} className="transition-transform group-hover:rotate-90 duration-200" />
                      Vraag toevoegen
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        {/* Mobile bottom bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-20">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveQ(Math.max(0, activeQ - 1))}
              disabled={activeQ === 0}
              className="text-sm text-slate-500 disabled:opacity-30 font-medium"
            >
              ← Vorige
            </button>
            <div className="flex items-center gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveQ(i)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    i === activeQ
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={addQuestion}
                className="w-7 h-7 rounded-lg text-xs font-bold bg-slate-50 text-violet-500 hover:bg-violet-50 border border-dashed border-slate-300 hover:border-violet-400 transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={() => {
                if (activeQ < questions.length - 1) setActiveQ(activeQ + 1);
                else addQuestion();
              }}
              className="text-sm text-violet-600 font-medium"
            >
              {activeQ < questions.length - 1 ? 'Volgende →' : '+ Nieuw'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* Settings Panel — used in desktop sidebar & mobile drawer */
function SettingsPanel({
  title, setTitle,
  maxPlayers, setMaxPlayers,
  theme, setTheme,
  isAdmin,
  aiTopic, setAiTopic,
  aiNumQuestions, setAiNumQuestions,
  aiGenerating, aiError,
  handleAiGenerate,
}) {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Type size={12} className="text-slate-400" />
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Titel</label>
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-lg font-semibold text-slate-800 placeholder:text-slate-300 border-none outline-none bg-transparent"
          placeholder="Naamloze Quiz"
        />
      </div>

      <div className="h-px bg-slate-100" />

      {/* Max Players */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={12} className="text-slate-400" />
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Max Spelers</label>
        </div>
        <div className="space-y-1">
          {MAX_PLAYERS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMaxPlayers(opt.value)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                maxPlayers === opt.value
                  ? 'bg-violet-50 text-violet-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{opt.label}</span>
              <span className={`text-xs ${maxPlayers === opt.value ? 'text-violet-500' : 'text-slate-300'}`}>
                {isAdmin ? 'Gratis' : opt.price}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Theme */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Palette size={12} className="text-slate-400" />
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Thema</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_LIST.map(t => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`relative rounded-xl p-2 text-center transition-all ${
                theme === t.key
                  ? 'ring-2 ring-violet-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-slate-300'
              }`}
            >
              <div className="w-full h-7 rounded-lg mb-1" style={{ background: t.preview }} />
              <span className="text-[10px] text-slate-500 font-medium leading-none">
                {t.emoji} {t.name}
              </span>
              {theme === t.key && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
