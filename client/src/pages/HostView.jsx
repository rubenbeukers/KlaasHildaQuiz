import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../socket.js';
import Timer from '../components/Timer.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import { getTheme } from '../themes.js';
import { Zap, Droplets, Star, Leaf, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

const ANSWERS = [
  { bg: 'bg-red-500',    Icon: Zap,      label: 'A' },
  { bg: 'bg-blue-500',   Icon: Droplets, label: 'B' },
  { bg: 'bg-yellow-400', Icon: Star,     label: 'C', textDark: true },
  { bg: 'bg-emerald-500', Icon: Leaf,    label: 'D' },
];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function HostView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quizId');
  const created = useRef(false);
  const gamePinRef = useRef(null);
  const [error, setError] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');

  // Theme state
  const [themeKey, setThemeKey] = useState('default');
  const theme = getTheme(themeKey);

  // Core state
  const [gameState, setGameState] = useState('creating');
  const [gamePin, setGamePin] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [players, setPlayers] = useState([]);

  // Question state
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answerCount, setAnswerCount] = useState({ count: 0, total: 0 });
  const [countdown, setCountdown] = useState(3);

  // Results state
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);

  // Tussenstand
  const [showMidLeaderboard, setShowMidLeaderboard] = useState(false);

  // Helper: get correct answer indices as array
  const correctIndices = correctAnswer !== null
    ? (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
    : [];

  // ── Create game once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (created.current) return;
    created.current = true;

    const fetchQR = (pin) => {
      const clientHost = window.location.host;
      fetch(`${SERVER_URL}/api/qrcode/${pin}?host=${encodeURIComponent(clientHost)}`)
        .then(r => r.json())
        .then(data => setQrCode(data.qrCode))
        .catch(() => console.warn('QR code fetch failed'));
    };

    const createNewGame = () => {
      if (!quizId) {
        setError('Geen quiz geselecteerd. Ga naar je dashboard om een quiz te starten.');
        return;
      }
      socket.emit('host:create', { quizId: parseInt(quizId) }, (response) => {
        if (response.error) { setError(response.error); return; }
        const pin = response.gamePin;
        setGamePin(pin);
        gamePinRef.current = pin;
        setQuizTitle(response.quizTitle || '');
        if (response.theme) setThemeKey(response.theme);
        setGameState('lobby');
        sessionStorage.setItem('hostSession', JSON.stringify({ gamePin: pin, quizId }));
        fetchQR(pin);
      });
    };

    const savedSession = sessionStorage.getItem('hostSession');
    if (savedSession) {
      try {
        const { gamePin: savedPin, quizId: savedQuizId } = JSON.parse(savedSession);
        if (String(savedQuizId) === String(quizId)) {
          socket.emit('host:rejoin', { gamePin: savedPin }, (res) => {
            if (res?.success) {
              setGamePin(savedPin);
              gamePinRef.current = savedPin;
              setQuizTitle(res.quizTitle || '');
              if (res.theme) setThemeKey(res.theme);
              setPlayers(res.players || []);
              setTotalQuestions(res.totalQuestions || 0);
              setQuestionIndex(Math.max(res.currentQuestion, 0));
              if (res.status === 'lobby') {
                setGameState('lobby');
                fetchQR(savedPin);
              } else {
                setGameState('reconnected');
              }
              return;
            }
            sessionStorage.removeItem('hostSession');
            createNewGame();
          });
          return;
        }
      } catch (e) {
        sessionStorage.removeItem('hostSession');
      }
    }

    createNewGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket event listeners ──────────────────────────────────────────────
  useEffect(() => {
    function onPlayerJoined({ players }) { setPlayers(players || []); }
    function onQuestionShow({ index, total, text, options, timeLimit, background, theme: qTheme }) {
      setQuestion({ text, options, timeLimit });
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCorrectAnswer(null);
      setResults(null);
      setAnswerCount({ count: 0, total: 0 });
      if (qTheme) setThemeKey(qTheme);
      setGameState('question');
    }
    function onAnswerCount({ count, total }) { setAnswerCount({ count, total }); }
    function onQuestionEnd({ correctAnswer: ca, results: r, leaderboard: lb }) {
      setCorrectAnswer(ca ?? null);
      setResults(r || null);
      setLeaderboard(lb || []);
      setGameState('questionEnd');
    }
    function onGameEnd({ finalLeaderboard: flb }) {
      sessionStorage.removeItem('hostSession');
      setFinalLeaderboard(flb || []);
      setGameState('finished');
    }
    function onConnect() {
      if (!gamePinRef.current) return;
      socket.emit('host:rejoin', { gamePin: gamePinRef.current }, (res) => {
        if (res?.error) console.warn('[HOST] Rejoin failed:', res.error);
      });
    }

    socket.on('player:joined', onPlayerJoined);
    socket.on('question:show', onQuestionShow);
    socket.on('answer:count', onAnswerCount);
    socket.on('question:end', onQuestionEnd);
    socket.on('game:end', onGameEnd);
    socket.on('connect', onConnect);

    return () => {
      socket.off('player:joined', onPlayerJoined);
      socket.off('question:show', onQuestionShow);
      socket.off('answer:count', onAnswerCount);
      socket.off('question:end', onQuestionEnd);
      socket.off('game:end', onGameEnd);
      socket.off('connect', onConnect);
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStartGame = () => {
    if (!gamePin || players.length === 0) return;
    socket.emit('game:start', { gamePin });
    setGameState('countdown');
    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) clearInterval(iv);
    }, 1000);
  };

  const handleNextQuestion = () => {
    if (showMidLeaderboard) {
      socket.emit('leaderboard:hide', { gamePin });
      setShowMidLeaderboard(false);
    }
    socket.emit('next:question', { gamePin });
  };

  const handleEndGame = () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    setConfirmEnd(false);
    socket.emit('game:end_early', { gamePin });
  };

  const handleKickPlayer = (playerId) => {
    socket.emit('player:kick', { gamePin, playerId });
  };

  const handleShowMidLeaderboard = () => {
    socket.emit('leaderboard:show', { gamePin });
    setShowMidLeaderboard(true);
  };

  const handleHideMidLeaderboard = () => {
    socket.emit('leaderboard:hide', { gamePin });
    setShowMidLeaderboard(false);
  };

  // Confetti burst for podium
  useEffect(() => {
    if (gameState !== 'finished') return;
    const duration = 4000;
    const end = Date.now() + duration;
    const colors = ['#a855f7', '#ec4899', '#facc15', '#34d399', '#60a5fa'];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [gameState]);

  const gameScreenStyle = theme.gameStyle || {};
  const gameScreenClass = theme.gameBg || 'bg-gray-900';

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Screen theme={theme}>
        <div className="text-red-400 text-xl mb-4">{error}</div>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-indigo-700 hover:bg-indigo-600 text-white px-8 py-3 rounded-full font-bold"
        >
          ← Terug naar Dashboard
        </button>
      </Screen>
    );
  }

  if (gameState === 'creating') {
    return (
      <Screen theme={theme}>
        <div className="text-white text-2xl animate-pulse">Game aanmaken...</div>
      </Screen>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (gameState === 'lobby') {
    return (
      <div
        className={`min-h-screen ${theme.lobbyBg} text-white flex flex-col`}
        style={theme.lobbyStyle || {}}
      >
        {/* Top bar */}
        <div className="flex items-start gap-6 p-6 pb-2">
          {/* QR Code — groot en prominent */}
          <div className="flex-shrink-0">
            {qrCode ? (
              <div className="bg-white p-3 rounded-2xl shadow-2xl">
                <img src={qrCode} alt="QR Code" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-56 h-56 bg-black/20 rounded-2xl animate-pulse" />
            )}
            <p className={`${theme.textMuted} text-xs text-center mt-2`}>📷 Scan om mee te doen</p>
          </div>

          {/* PIN + info */}
          <div className="flex-1">
            <p className={`${theme.textMuted} text-sm uppercase tracking-widest font-semibold mb-1`}>Game PIN</p>
            <p className={`text-8xl font-black tracking-widest ${theme.pinColor}`}>{gamePin}</p>
            <p className={`${theme.textSecondary} mt-2 text-sm`}>
              🌐 <span className="font-mono">{window.location.host}/join</span>
            </p>
            {/* Player count */}
            <p className={`${theme.textSecondary} text-lg mt-4`}>
              <span className="text-4xl font-black text-white">{players.length}</span>
              {' '}speler{players.length !== 1 ? 's' : ''} verbonden
            </p>
          </div>
        </div>

        {/* Players grid */}
        <div className="flex-1 px-6 py-2 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <div
                key={p.id}
                className={`${theme.playerBadge} text-white rounded-full px-4 py-2 font-semibold text-sm animate-pop flex items-center gap-1.5`}
              >
                <span>{p.nickname}</span>
                <button
                  onClick={() => handleKickPlayer(p.id)}
                  className="text-white/40 hover:text-white transition-colors font-black text-base leading-none"
                  title="Verwijder speler"
                >×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        <div className="flex justify-center p-8">
          <button
            onClick={handleStartGame}
            disabled={players.length === 0}
            className={`px-16 py-5 rounded-full text-2xl font-black transition-all shadow-lg
              ${players.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white hover:shadow-emerald-500/40 hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            {players.length === 0 ? 'Wachten op spelers...' : `Start Game (${players.length})`}
          </button>
        </div>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────
  if (gameState === 'countdown') {
    return (
      <Screen theme={theme}>
        <p className={`${theme.textSecondary} text-2xl mb-4 font-semibold`}>Get ready!</p>
        <div className="text-9xl font-black text-white animate-pop" key={countdown}>{countdown || '🚀'}</div>
        <p className={`${theme.textMuted} mt-6`}>{players.length} spelers verbonden</p>
      </Screen>
    );
  }

  // ── QUESTION (projector view) ─────────────────────────────────────────────
  if (gameState === 'question' && question) {
    return (
      <div className={`min-h-screen ${gameScreenClass} flex flex-col`} style={gameScreenStyle}>
        {/* Header bar */}
        <div
          className={`${theme.headerBg || ''} flex items-center justify-between px-6 py-3`}
          style={theme.headerStyle || {}}
        >
          <div className="flex items-center gap-3">
            <div className="text-white font-bold text-lg">
              Vraag <span className="text-purple-400">{questionIndex + 1}</span>
              <span className="text-gray-400"> / {totalQuestions}</span>
            </div>
            {confirmEnd ? (
              <button onClick={handleEndGame} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">
                Zeker?
              </button>
            ) : (
              <button onClick={handleEndGame} className="bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all">
                Stop spel
              </button>
            )}
          </div>
          <Timer duration={question.timeLimit} />
          <div className="text-right">
            <p className="text-white font-bold text-2xl tabular-nums">
              {answerCount.count}
              <span className="text-gray-400 text-base font-normal"> / {answerCount.total}</span>
            </p>
            <p className="text-gray-400 text-xs">antwoorden</p>
          </div>
        </div>

        {/* Answer progress bar */}
        <div className="h-1.5 bg-black/30">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: answerCount.total > 0 ? `${(answerCount.count / answerCount.total) * 100}%` : '0%' }}
          />
        </div>

        {/* Question text */}
        <div className="flex-1 flex items-center justify-center px-8 py-6">
          <div className="bg-white/95 backdrop-blur rounded-3xl px-10 py-8 max-w-4xl w-full text-center shadow-2xl">
            <p className="text-4xl font-black text-gray-900 leading-tight">{question.text}</p>
          </div>
        </div>

        {/* Answer options grid */}
        <div className="grid grid-cols-2 gap-3 p-4">
          {question.options.map((opt, i) => (
            <div
              key={i}
              className={`${ANSWERS[i].bg} rounded-2xl p-5 flex items-center gap-4 shadow-lg`}
            >
              <span className={ANSWERS[i].textDark ? 'text-black' : 'text-white'}>
                {(() => { const Icon = ANSWERS[i].Icon; return <Icon size={28} strokeWidth={2.5} />; })()}
              </span>
              <span className={`text-xl font-bold ${ANSWERS[i].textDark ? 'text-black' : 'text-white'}`}>
                {opt}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── QUESTION END (results) ────────────────────────────────────────────────
  if (gameState === 'questionEnd' && question) {
    return (
      <div className={`min-h-screen ${gameScreenClass} flex flex-col`} style={gameScreenStyle}>
        {/* Correct answer banner — supports multiple correct */}
        <div className="p-4 text-center flex flex-wrap gap-2 justify-center">
          {correctIndices.length > 0 ? correctIndices.map(ci => (
            <span key={ci} className={`${ANSWERS[ci]?.bg || 'bg-gray-700'} px-6 py-3 rounded-xl text-white font-black text-2xl inline-flex items-center gap-2`}>
              ✓ {question.options[ci]}
            </span>
          )) : (
            <span className="bg-gray-700 px-6 py-3 rounded-xl text-white font-black text-2xl">—</span>
          )}
        </div>

        <div className="flex flex-1 gap-4 p-6">
          {/* Answer distribution */}
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-4">Antwoord verdeling</h3>
            <div className="flex items-end gap-3 h-48">
              {question.options.map((opt, i) => {
                const count = results?.counts?.[i] ?? 0;
                const total = results?.totalAnswers || 1;
                const pct = Math.round((count / Math.max(total, 1)) * 100);
                const isCorrect = correctIndices.includes(i);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-white font-bold">{count}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                      <div
                        className={`${ANSWERS[i].bg} w-full rounded-t-lg transition-all duration-700 ${isCorrect ? 'ring-4 ring-white' : 'opacity-70'}`}
                        style={{ height: `${Math.max(pct * 1.4, pct > 0 ? 12 : 0)}px` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{pct}%</span>
                    <span className="flex justify-center text-white">
                      {(() => { const Icon = ANSWERS[i].Icon; return <Icon size={20} strokeWidth={2.5} />; })()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard — vertically centered */}
          <div className="w-80 flex flex-col justify-center">
            <h3 className="text-white font-bold text-lg mb-4">Ranglijst</h3>
            <Leaderboard entries={(leaderboard || []).slice(0, 6)} />
          </div>
        </div>

        {/* Next button */}
        <div className="flex flex-wrap justify-center items-center gap-3 pb-8 px-4">
          {showMidLeaderboard ? (
            <button
              onClick={handleHideMidLeaderboard}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full text-lg font-black transition-all shadow-lg"
            >
              ✕ Verberg Tussenstand
            </button>
          ) : (
            <button
              onClick={handleShowMidLeaderboard}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-6 py-4 rounded-full text-base font-bold transition-all flex items-center gap-2"
            >
              <Trophy size={18} /> Tussenstand
            </button>
          )}
          <button
            onClick={handleNextQuestion}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-14 py-5 rounded-full text-xl font-black transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {questionIndex + 1 >= totalQuestions ? '🏆 Eindresultaten' : 'Volgende Vraag →'}
          </button>
          {confirmEnd ? (
            <button onClick={handleEndGame} className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-full font-bold">
              Zeker stoppen?
            </button>
          ) : (
            <button onClick={handleEndGame} className="bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-white px-5 py-3 rounded-full text-sm font-semibold transition-all">
              Stop spel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── FINISHED (final podium) ───────────────────────────────────────────────
  if (gameState === 'finished') {
    const top3 = (finalLeaderboard || []).slice(0, 3);
    // displayOrder: [2nd, 1st, 3rd] for visual podium layout
    const displayOrder = [
      top3[1] ? { ...top3[1], rank: 2, delay: '0ms',    height: 'h-28', bg: 'bg-gradient-to-t from-slate-500 to-slate-300' } : null,
      top3[0] ? { ...top3[0], rank: 1, delay: '600ms',  height: 'h-44', bg: 'bg-gradient-to-t from-amber-600 to-amber-400' } : null,
      top3[2] ? { ...top3[2], rank: 3, delay: '300ms',  height: 'h-20', bg: 'bg-gradient-to-t from-orange-700 to-orange-500' } : null,
    ];

    return (
      <div
        className={`min-h-screen ${theme.gameBg || 'bg-gray-900'} flex flex-col items-center p-6 overflow-auto`}
        style={theme.gameStyle || {}}
      >
        <h1 className="text-5xl font-black text-white mb-1 mt-4">🏆 Game Over!</h1>
        <p className="text-gray-400 mb-10">Eindresultaten</p>

        {/* Staggered animated podium */}
        <div className="flex items-end gap-3 mb-10">
          {displayOrder.map((entry, di) => {
            if (!entry) return <div key={di} className="w-36" />;
            const rankColors = {
              1: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-black',
              2: 'bg-gradient-to-br from-slate-300 to-gray-400 text-black',
              3: 'bg-gradient-to-br from-orange-400 to-amber-600 text-white',
            };
            return (
              <div
                key={entry.id}
                className="flex flex-col items-center w-36"
                style={{ animation: `slideUp 0.6s ease-out ${entry.delay} both` }}
              >
                {/* Crown for winner */}
                {entry.rank === 1 && (
                  <span className="text-3xl mb-1 animate-bounce">👑</span>
                )}
                <span className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black mb-2 shadow-lg ${rankColors[entry.rank]}`}>
                  {entry.rank}
                </span>
                <div className={`${entry.bg} w-full rounded-t-2xl flex items-center justify-center p-3 text-center shadow-xl ${entry.height}`}>
                  <div>
                    <p className="font-black text-base text-white break-words drop-shadow">{entry.nickname}</p>
                    <p className="font-bold text-sm text-white/80">{entry.score.toLocaleString()} pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full leaderboard */}
        <div className="w-full max-w-lg">
          <Leaderboard entries={finalLeaderboard || []} />
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="mt-8 mb-6 bg-indigo-700 hover:bg-indigo-600 text-white px-10 py-3 rounded-full font-bold transition-all"
        >
          ← Terug naar Dashboard
        </button>
      </div>
    );
  }

  // ── RECONNECTED (after page refresh, awaiting next question:end event) ──────
  if (gameState === 'reconnected') {
    return (
      <Screen theme={theme}>
        <div className="text-emerald-400 text-3xl font-black mb-2">✓ Verbinding hersteld</div>
        <p className="text-white text-xl mb-1">PIN: <span className="font-black text-yellow-300">{gamePin}</span></p>
        <p className="text-gray-400 mb-6">{players.length} spelers · Vraag {questionIndex + 1}/{totalQuestions}</p>
        <p className="text-gray-500 text-sm animate-pulse">Wachten op einde van huidige vraag...</p>
      </Screen>
    );
  }

  return null;
}

// Helper wrapper
function Screen({ theme, children }) {
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center ${theme?.lobbyBg || 'bg-indigo-950'}`}
      style={theme?.lobbyStyle || {}}
    >
      {children}
    </div>
  );
}
