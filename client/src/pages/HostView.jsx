import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Timer from '../components/Timer.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

const ANSWERS = [
  { bg: 'bg-red-500',    icon: '▲', label: 'A' },
  { bg: 'bg-blue-500',   icon: '●', label: 'B' },
  { bg: 'bg-yellow-400', icon: '■', label: 'C', textDark: true },
  { bg: 'bg-emerald-500', icon: '★', label: 'D' },
];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function HostView() {
  const navigate = useNavigate();
  const created = useRef(false);

  // Core state
  const [gameState, setGameState] = useState('creating'); // creating | lobby | countdown | question | questionEnd | finished
  const [gamePin, setGamePin] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [players, setPlayers] = useState([]);

  // Question state
  const [question, setQuestion] = useState(null);   // { text, options, timeLimit }
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answerCount, setAnswerCount] = useState({ count: 0, total: 0 });
  const [countdown, setCountdown] = useState(3);

  // Results state
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);

  // ── Create game once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (created.current) return;
    created.current = true;

    socket.emit('host:create', ({ gamePin: pin }) => {
      setGamePin(pin);
      setGameState('lobby');

      const clientHost = window.location.host;
      fetch(`${SERVER_URL}/api/qrcode/${pin}?host=${encodeURIComponent(clientHost)}`)
        .then(r => r.json())
        .then(data => setQrCode(data.qrCode))
        .catch(() => console.warn('QR code fetch failed'));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket event listeners (separate so StrictMode re-adds them) ──────────
  useEffect(() => {
    function onPlayerJoined({ players }) { setPlayers(players); }
    function onQuestionShow({ index, total, text, options, timeLimit }) {
      setQuestion({ text, options, timeLimit });
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCorrectAnswer(null);
      setResults(null);
      setAnswerCount({ count: 0, total: 0 });
      setGameState('question');
    }
    function onAnswerCount({ count, total }) { setAnswerCount({ count, total }); }
    function onQuestionEnd({ correctAnswer, results, leaderboard }) {
      setCorrectAnswer(correctAnswer);
      setResults(results);
      setLeaderboard(leaderboard);
      setGameState('questionEnd');
    }
    function onGameEnd({ finalLeaderboard }) {
      setFinalLeaderboard(finalLeaderboard);
      setGameState('finished');
    }

    socket.on('player:joined', onPlayerJoined);
    socket.on('question:show', onQuestionShow);
    socket.on('answer:count', onAnswerCount);
    socket.on('question:end', onQuestionEnd);
    socket.on('game:end', onGameEnd);

    return () => {
      socket.off('player:joined', onPlayerJoined);
      socket.off('question:show', onQuestionShow);
      socket.off('answer:count', onAnswerCount);
      socket.off('question:end', onQuestionEnd);
      socket.off('game:end', onGameEnd);
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
    socket.emit('next:question', { gamePin });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────

  if (gameState === 'creating') {
    return (
      <Screen dark>
        <div className="text-white text-2xl animate-pulse">Creating game...</div>
      </Screen>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen bg-indigo-950 text-white flex flex-col">
        {/* Top bar */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div>
            <p className="text-indigo-400 text-sm uppercase tracking-widest font-semibold mb-1">Game PIN</p>
            <p className="text-7xl font-black tracking-widest text-white">{gamePin}</p>
            <p className="text-indigo-300 mt-1 text-sm">
              Or scan the QR code → <span className="font-mono">{window.location.host}/join?pin={gamePin}</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="flex-shrink-0">
            {qrCode ? (
              <div className="bg-white p-3 rounded-2xl shadow-2xl">
                <img src={qrCode} alt="QR Code" className="w-44 h-44" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-indigo-900 rounded-2xl animate-pulse" />
            )}
          </div>
        </div>

        {/* Player count */}
        <div className="px-6 py-2">
          <p className="text-indigo-300 text-lg">
            <span className="text-3xl font-black text-white">{players.length}</span>
            {' '}player{players.length !== 1 ? 's' : ''} joined
          </p>
        </div>

        {/* Players grid */}
        <div className="flex-1 px-6 py-2 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <span
                key={p.id}
                className="bg-indigo-700 hover:bg-indigo-600 text-white rounded-full px-4 py-2 font-semibold text-sm animate-pop"
              >
                {p.nickname}
              </span>
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
            {players.length === 0 ? 'Waiting for players...' : `Start Game (${players.length})`}
          </button>
        </div>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────
  if (gameState === 'countdown') {
    return (
      <Screen dark>
        <p className="text-indigo-300 text-2xl mb-4 font-semibold">Get ready!</p>
        <div className="text-9xl font-black text-white animate-pop" key={countdown}>{countdown || '🚀'}</div>
        <p className="text-indigo-400 mt-6">{players.length} players connected</p>
      </Screen>
    );
  }

  // ── QUESTION (projector view) ─────────────────────────────────────────────
  if (gameState === 'question' && question) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header bar */}
        <div className="bg-gray-800 flex items-center justify-between px-6 py-3">
          <div className="text-white font-bold text-lg">
            Question <span className="text-purple-400">{questionIndex + 1}</span>
            <span className="text-gray-500"> / {totalQuestions}</span>
          </div>
          <Timer duration={question.timeLimit} />
          <div className="text-right">
            <p className="text-white font-bold text-2xl tabular-nums">
              {answerCount.count}
              <span className="text-gray-500 text-base font-normal"> / {answerCount.total}</span>
            </p>
            <p className="text-gray-400 text-xs">answers</p>
          </div>
        </div>

        {/* Answer progress bar */}
        <div className="h-1.5 bg-gray-700">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: answerCount.total > 0 ? `${(answerCount.count / answerCount.total) * 100}%` : '0%' }}
          />
        </div>

        {/* Question text */}
        <div className="flex-1 flex items-center justify-center px-8 py-6">
          <div className="bg-white rounded-3xl px-10 py-8 max-w-4xl w-full text-center shadow-2xl">
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
              <span className={`text-3xl font-black ${ANSWERS[i].textDark ? 'text-black' : 'text-white'}`}>
                {ANSWERS[i].icon}
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
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Correct answer banner */}
        <div className={`${correctAnswer !== null ? ANSWERS[correctAnswer].bg : 'bg-gray-700'} p-4 text-center`}>
          <p className="text-white font-black text-2xl">
            ✓ {correctAnswer !== null ? question.options[correctAnswer] : '—'}
          </p>
        </div>

        <div className="flex flex-1 gap-4 p-6">
          {/* Answer distribution */}
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-4">Answer distribution</h3>
            <div className="flex items-end gap-3 h-48">
              {question.options.map((opt, i) => {
                const count = results?.counts[i] ?? 0;
                const total = results?.totalAnswers || 1;
                const pct = Math.round((count / Math.max(total, 1)) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-white font-bold">{count}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                      <div
                        className={`${ANSWERS[i].bg} w-full rounded-t-lg transition-all duration-700 ${i === correctAnswer ? 'ring-4 ring-white' : 'opacity-70'}`}
                        style={{ height: `${Math.max(pct * 1.4, pct > 0 ? 12 : 0)}px` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{pct}%</span>
                    <span className={`text-2xl ${ANSWERS[i].textDark ? '' : ''}`}>{ANSWERS[i].icon}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="w-80">
            <h3 className="text-white font-bold text-lg mb-4">Leaderboard</h3>
            <Leaderboard entries={leaderboard.slice(0, 6)} />
          </div>
        </div>

        {/* Next button */}
        <div className="flex justify-center pb-8">
          <button
            onClick={handleNextQuestion}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-14 py-5 rounded-full text-xl font-black transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {questionIndex + 1 >= totalQuestions ? '🏆 Show Final Results' : 'Next Question →'}
          </button>
        </div>
      </div>
    );
  }

  // ── FINISHED (final podium) ───────────────────────────────────────────────
  if (gameState === 'finished') {
    const top3 = finalLeaderboard.slice(0, 3);
    const rest = finalLeaderboard.slice(3);
    const podiumConfig = [
      { pos: 1, medal: '🥇', height: 'h-36', bg: 'bg-yellow-400', textColor: 'text-black' },
      { pos: 2, medal: '🥈', height: 'h-24', bg: 'bg-slate-300', textColor: 'text-black' },
      { pos: 3, medal: '🥉', height: 'h-16', bg: 'bg-orange-500', textColor: 'text-white' },
    ];
    // Reorder for display: 2nd, 1st, 3rd
    const displayOrder = [top3[1], top3[0], top3[2]];

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center p-6 overflow-auto">
        <h1 className="text-5xl font-black text-white mb-2 mt-4">Game Over!</h1>
        <p className="text-gray-400 mb-8">Final Results</p>

        {/* Podium */}
        <div className="flex items-end gap-2 mb-10">
          {displayOrder.map((entry, di) => {
            if (!entry) return <div key={di} className="w-32" />;
            const cfg = podiumConfig[di === 0 ? 1 : di === 1 ? 0 : 2];
            return (
              <div key={entry.id} className="flex flex-col items-center w-36 animate-slide-up">
                <span className="text-4xl mb-1">{cfg.medal}</span>
                <div className={`${cfg.bg} w-full rounded-t-xl flex items-center justify-center p-3 text-center ${cfg.height}`}>
                  <div>
                    <p className={`font-black text-base ${cfg.textColor} break-words`}>{entry.nickname}</p>
                    <p className={`font-bold text-sm ${cfg.textColor} opacity-80`}>{entry.score.toLocaleString()} pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full leaderboard */}
        <div className="w-full max-w-lg">
          <Leaderboard entries={finalLeaderboard} />
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-8 bg-indigo-700 hover:bg-indigo-600 text-white px-10 py-3 rounded-full font-bold transition-all"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return null;
}

// Helper wrapper
function Screen({ dark, children }) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${dark ? 'bg-indigo-950' : 'bg-gray-900'}`}>
      {children}
    </div>
  );
}
