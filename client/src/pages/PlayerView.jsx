import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Timer from '../components/Timer.jsx';
import { getTheme } from '../themes.js';
import { Zap, Droplets, Star, Leaf } from 'lucide-react';

const ANSWERS = [
  { bg: 'bg-red-500',     activeBg: 'bg-red-700',     Icon: Zap,      label: 'A' },
  { bg: 'bg-blue-500',    activeBg: 'bg-blue-700',    Icon: Droplets, label: 'B' },
  { bg: 'bg-yellow-400',  activeBg: 'bg-yellow-600',  Icon: Star,     label: 'C', textDark: true },
  { bg: 'bg-emerald-500', activeBg: 'bg-emerald-700', Icon: Leaf,     label: 'D' },
];

// Rank badge component (replaces Kahoot-style medal emojis)
function RankBadge({ rank, size = 'md' }) {
  const RANK_STYLES = [
    'bg-gradient-to-br from-amber-400 to-yellow-500 text-black',
    'bg-gradient-to-br from-slate-300 to-gray-400 text-black',
    'bg-gradient-to-br from-orange-400 to-amber-600 text-white',
  ];
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'xl' ? 'w-24 h-24 text-4xl' : 'w-8 h-8 text-sm';
  const style = rank <= 3 ? RANK_STYLES[rank - 1] : 'bg-gray-600 text-gray-300';
  return (
    <span className={`${sizeClass} ${style} rounded-full flex items-center justify-center font-black shadow-lg`}>
      {rank}
    </span>
  );
}


export default function PlayerView() {
  const { pin: urlPin } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [gameState, setGameState] = useState('join');
  const [themeKey, setThemeKey] = useState('default');
  const theme = getTheme(themeKey);

  const [gamePin, setGamePin]     = useState(searchParams.get('pin') || urlPin || '');
  const [nickname, setNickname]   = useState('');
  const [error, setError]         = useState('');
  const [myScore, setMyScore]     = useState(0);
  const [myRank, setMyRank]       = useState(null);
  const [myStreak, setMyStreak]   = useState(0);

  const [question, setQuestion]             = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [answerResult, setAnswerResult]     = useState(null);
  const [correctAnswer, setCorrectAnswer]   = useState(null);
  const [leaderboard, setLeaderboard]       = useState([]);
  const [finalData, setFinalData]           = useState(null);

  const myId = socket.id;
  const joinedRef = useRef(false);

  // ── Prefill from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    const session = localStorage.getItem('playerSession');
    if (!session) return;
    try {
      const { pin, nickname: nick } = JSON.parse(session);
      setGamePin(pin);
      setNickname(nick);
    } catch { localStorage.removeItem('playerSession'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-rejoin: on initial connect (page refresh) + reconnects ───────────
  useEffect(() => {
    function onConnect() {
      const session = localStorage.getItem('playerSession');
      if (!session) return;
      let saved;
      try { saved = JSON.parse(session); } catch { localStorage.removeItem('playerSession'); return; }

      socket.emit('player:rejoin', { gamePin: saved.pin, nickname: saved.nickname }, (res) => {
        if (res?.success) {
          if (!joinedRef.current) {
            // Page refresh: restore game state
            setMyScore(res.score || 0);
            setMyStreak(res.streak || 0);
            joinedRef.current = true;
            setGameState('questionEnd');
          }
          // Brief reconnect: transparent, server socket ID is updated
        } else {
          localStorage.removeItem('playerSession');
          if (joinedRef.current) {
            setError('Verbinding verloren. Doe opnieuw mee.');
            setGameState('join');
            joinedRef.current = false;
          }
        }
      });
    }

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('game:started', ({ theme: t } = {}) => {
      if (t) setThemeKey(t);
      setGameState('countdown');
    });

    socket.on('question:show', ({ index, total, text, options, timeLimit, background, theme: qTheme, type }) => {
      setQuestion({ text, options, timeLimit, index, total, type: type || 'single' });
      setSelectedAnswers([]);
      setAnswerResult(null);
      setCorrectAnswer(null);
      if (qTheme) setThemeKey(qTheme);
      setGameState('question');
    });

    socket.on('question:end', ({ correctAnswer: ca, leaderboard: lb }) => {
      setCorrectAnswer(ca ?? null);
      setLeaderboard(lb || []);
      const me = (lb || []).find(p => p.id === socket.id);
      if (me) {
        setMyScore(me.score);
        setMyRank(me.rank);
      }
      setGameState('questionEnd');
    });

    socket.on('game:end', ({ finalLeaderboard }) => {
      localStorage.removeItem('playerSession');
      const lb = finalLeaderboard || [];
      const me = lb.find(p => p.id === socket.id);
      setFinalData({ leaderboard: lb, me: me || null });
      setGameState('finished');
    });

    socket.on('host:disconnected', ({ message }) => {
      localStorage.removeItem('playerSession');
      setError(message);
      setGameState('join');
      joinedRef.current = false;
    });

    socket.on('player:kicked', ({ message }) => {
      localStorage.removeItem('playerSession');
      setError(message || 'Je bent verwijderd door de host.');
      setGameState('join');
      joinedRef.current = false;
    });

    return () => {
      socket.off('game:started');
      socket.off('question:show');
      socket.off('question:end');
      socket.off('game:end');
      socket.off('host:disconnected');
      socket.off('player:kicked');
    };
  }, []);

  // ── Timeout fallback: if stuck in 'answered' for 35s, force transition ──
  useEffect(() => {
    if (gameState === 'answered') {
      const timeout = setTimeout(() => {
        setGameState('questionEnd');
      }, 35000);
      return () => clearTimeout(timeout);
    }
  }, [gameState]);

  // ── Join handler ──────────────────────────────────────────────────────────
  const handleJoin = () => {
    setError('');
    const trimPin  = gamePin.trim();
    const trimName = nickname.trim();
    if (!trimPin)  return setError('Vul de Game PIN in.');
    if (!trimName) return setError('Vul een bijnaam in.');

    socket.emit('player:join', { gamePin: trimPin, nickname: trimName }, (res) => {
      if (res.error) return setError(res.error);
      localStorage.setItem('playerSession', JSON.stringify({ pin: trimPin, nickname: trimName }));
      joinedRef.current = true;
      setGamePin(trimPin);
      setGameState('lobby');
    });
  };

  // ── Answer handler (supports single + multiple) ──────────────────────────
  const handleAnswer = (index) => {
    if (gameState !== 'question') return;

    if (question?.type === 'multiple') {
      // Toggle selection for multiple-choice
      setSelectedAnswers(prev =>
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    } else {
      // Single answer — submit immediately
      if (selectedAnswers.length > 0) return;
      setSelectedAnswers([index]);
      socket.emit('answer:submit', { gamePin, answerIndex: index }, (result) => {
        if (result && !result.error) {
          setAnswerResult(result);
          setMyScore(result.score);
          setMyStreak(result.streak);
        }
        setGameState('answered');
      });
    }
  };

  // ── Submit multiple answers ─────────────────────────────────────────────
  const handleSubmitMultiple = () => {
    if (selectedAnswers.length === 0) return;
    socket.emit('answer:submit', { gamePin, answerIndex: selectedAnswers }, (result) => {
      if (result && !result.error) {
        setAnswerResult(result);
        setMyScore(result.score);
        setMyStreak(result.streak);
      }
      setGameState('answered');
    });
  };

  const qBgStyle = theme.gameStyle || {};
  const qBgClass = theme.gameBg || 'bg-gray-900';

  // Helper: get correct answer indices as array
  const correctIndices = correctAnswer !== null
    ? (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'join') {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-slide-up">
          <div className="text-center mb-6">
            <span className="text-5xl">⚡</span>
            <h1 className="text-3xl font-black text-indigo-900 mt-2">Meedoen</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium animate-shake">
              {error}
            </div>
          )}

          <label className="block text-gray-700 font-bold mb-1 text-sm">Game PIN</label>
          <input
            type="tel"
            inputMode="numeric"
            value={gamePin}
            onChange={e => setGamePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full border-2 border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-3xl font-black tracking-widest text-gray-900 outline-none mb-4 transition-colors"
            maxLength={6}
          />

          <label className="block text-gray-700 font-bold mb-1 text-sm">Bijnaam</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value.slice(0, 20))}
            placeholder="Bijv. SpeedKing99"
            className="w-full border-2 border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-lg text-gray-900 outline-none mb-6 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />

          <button
            onClick={handleJoin}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-4 rounded-2xl text-xl font-black transition-all transform active:scale-95"
          >
            Meedoen!
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full text-gray-400 text-sm mt-3 py-2 hover:text-gray-600 transition-colors"
          >
            ← Terug naar home
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOBBY SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white p-6 gap-6">
        <div className="text-6xl animate-bounce">⏳</div>
        <h2 className="text-3xl font-black">Je bent erin!</h2>
        <div className="bg-indigo-800 rounded-2xl px-8 py-4 text-center">
          <p className="text-indigo-300 text-sm">Je speelt als</p>
          <p className="text-2xl font-black mt-1">{nickname}</p>
        </div>
        <p className="text-indigo-300 text-center">Wachten tot de host het spel start...</p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COUNTDOWN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'countdown') {
    return (
      <div
        className={`min-h-screen ${theme.lobbyBg || 'bg-indigo-950'} flex flex-col items-center justify-center text-white gap-4`}
        style={theme.lobbyStyle || {}}
      >
        <p className={`text-2xl font-semibold ${theme.textSecondary}`}>Maak je klaar!</p>
        <div className="text-8xl animate-pulse">🚀</div>
        <p className={theme.textMuted}>Eerste vraag komt eraan...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'question' && question) {
    const isMultiple = question.type === 'multiple';
    const hasSubmitted = !isMultiple && selectedAnswers.length > 0;

    return (
      <div className={`min-h-screen ${qBgClass} flex flex-col select-none`} style={qBgStyle}>
        {/* Header */}
        <div
          className={`${theme.headerBg || 'bg-gray-800'} flex items-center justify-between px-4 py-2`}
          style={theme.headerStyle || {}}
        >
          <div className="text-gray-300 text-sm font-semibold">
            V{question.index + 1}/{question.total}
            {isMultiple && <span className="ml-2 text-purple-300 text-xs">(meerdere antwoorden)</span>}
          </div>
          <Timer duration={question.timeLimit} size="small" onExpire={() => {
            if (isMultiple && selectedAnswers.length > 0) {
              handleSubmitMultiple();
            } else {
              setGameState('answered');
            }
          }} />
          <div className="text-right">
            <span className="text-white font-black tabular-nums">{myScore.toLocaleString()}</span>
            <span className="text-gray-400 text-xs ml-1">pts</span>
          </div>
        </div>

        {/* Question text */}
        <div className="flex-1 flex items-center justify-center px-5 py-4">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-6 py-4 max-w-lg w-full">
            <p className="text-white text-2xl font-black text-center leading-snug drop-shadow-lg">{question.text}</p>
          </div>
        </div>

        {/* 4 Answer buttons */}
        <div className="grid grid-cols-2 gap-3 p-3 pb-3">
          {question.options.map((opt, i) => {
            const isSelected = selectedAnswers.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={hasSubmitted}
                className={`${ANSWERS[i].bg} ${!hasSubmitted ? 'active:scale-95' : ''} rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-lg transition-all min-h-[110px]
                  ${hasSubmitted && !isSelected ? 'opacity-50' : ''}
                  ${isSelected ? ANSWERS[i].activeBg + ' ring-4 ring-white scale-95' : ''}
                `}
              >
                <span className={ANSWERS[i].textDark ? 'text-black' : 'text-white'}>
                  {(() => { const Icon = ANSWERS[i].Icon; return <Icon size={32} strokeWidth={2.5} />; })()}
                </span>
                <span className={`text-sm font-bold text-center leading-tight ${ANSWERS[i].textDark ? 'text-black' : 'text-white'}`}>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confirm button for multiple-choice */}
        {isMultiple && (
          <div className="px-3 pb-5">
            <button
              onClick={handleSubmitMultiple}
              disabled={selectedAnswers.length === 0}
              className={`w-full py-4 rounded-2xl text-lg font-black transition-all
                ${selectedAnswers.length > 0
                  ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
            >
              Bevestigen ({selectedAnswers.length} geselecteerd)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANSWERED
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'answered') {
    const hasResult = answerResult && !answerResult.error;
    const isCorrect = hasResult && answerResult.isCorrect;

    if (!hasResult) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-8 gap-4">
          <div className="text-7xl">⏰</div>
          <h2 className="text-3xl font-black text-gray-300">Tijd voorbij!</h2>
          <p className="text-gray-500 text-sm mt-4 animate-pulse">Wachten op resultaten...</p>
        </div>
      );
    }

    if (isCorrect) {
      return (
        <div className="min-h-screen bg-emerald-700 flex flex-col items-center justify-center text-white p-8 gap-5">
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center animate-pop">
            <span className="text-6xl">✓</span>
          </div>
          <h2 className="text-5xl font-black tracking-tight">Goed!</h2>
          <p className="text-4xl font-black text-yellow-300">+{answerResult.points.toLocaleString()} pts</p>
          {answerResult.streak > 1 && (
            <div className="bg-orange-500 rounded-2xl px-5 py-2">
              <p className="text-xl text-white font-black">🔥 {answerResult.streak}× streak!</p>
            </div>
          )}
          <p className="text-emerald-200 text-lg font-semibold mt-1">{myScore.toLocaleString()} pts totaal</p>
          <p className="text-emerald-300 text-sm mt-2 animate-pulse">Wachten op resultaten...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-red-700 flex flex-col items-center justify-center text-white p-8 gap-5">
        <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center animate-pop">
          <span className="text-6xl">✕</span>
        </div>
        <h2 className="text-5xl font-black tracking-tight">Fout!</h2>
        <div className="bg-red-900/60 rounded-2xl px-6 py-3 text-center">
          <p className="text-red-200 text-sm font-medium">Totaal score</p>
          <p className="text-3xl font-black">{myScore.toLocaleString()} pts</p>
        </div>
        <p className="text-red-300 text-sm mt-2 animate-pulse">Wachten op resultaten...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION END
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'questionEnd') {
    const me = leaderboard?.find(p => p.id === socket.id);

    return (
      <div
        className={`min-h-screen ${qBgClass} flex flex-col items-center justify-center text-white p-6 gap-5`}
        style={qBgStyle}
      >
        {/* Correct answer(s) banner */}
        {correctIndices.length > 0 && question && (
          <div className="space-y-2 w-full max-w-sm">
            {correctIndices.map(ci => (
              <div key={ci} className={`${ANSWERS[ci]?.bg || 'bg-gray-700'} rounded-2xl px-6 py-3 text-center`}>
                <p className="text-xs font-semibold opacity-80 uppercase">Goed antwoord</p>
                <p className={`text-xl font-black mt-0.5 ${ANSWERS[ci]?.textDark ? 'text-black' : 'text-white'}`}>
                  {question.options[ci]}
                </p>
              </div>
            ))}
          </div>
        )}

        {me && (
          <div className="text-center animate-pop">
            <RankBadge rank={me.rank} size="xl" />
            <p className="text-gray-400 text-sm mt-2">Je huidige positie</p>
            <p className="text-3xl font-black text-white mt-2">{me.score.toLocaleString()} pts</p>
          </div>
        )}

        <div className="w-full max-w-sm space-y-2">
          {(leaderboard || []).slice(0, 3).map((entry, i) => (
            <div key={entry.id} className={`flex items-center justify-between px-4 py-2 rounded-xl ${entry.id === socket.id ? 'bg-indigo-700' : 'bg-gray-800/80'}`}>
              <div className="flex items-center gap-2">
                <RankBadge rank={i + 1} />
                <span className="font-semibold text-sm">{entry.nickname}</span>
              </div>
              <span className="font-black tabular-nums">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <p className="text-gray-500 text-sm animate-pulse">Wachten op volgende vraag...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FINISHED
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'finished' && finalData) {
    const { me, leaderboard: lb } = finalData;

    return (
      <div
        className={`min-h-screen ${theme.gameBg || 'bg-gray-900'} flex flex-col items-center text-white p-6 overflow-auto`}
        style={theme.gameStyle || {}}
      >
        <h1 className="text-4xl font-black mt-6 mb-2">Game Over!</h1>

        {me && (
          <div className={`${theme.playerBadge || 'bg-indigo-800'} rounded-3xl p-6 my-6 text-center w-full max-w-xs animate-pop`}>
            <p className={`${theme.textSecondary || 'text-indigo-300'} text-sm`}>Je eindigde op</p>
            <div className="flex justify-center my-3">
              <RankBadge rank={me.rank} size="xl" />
            </div>
            <p className="text-3xl font-black">{me.score.toLocaleString()}</p>
            <p className={`${theme.textSecondary || 'text-indigo-300'} text-sm`}>punten</p>
          </div>
        )}

        <div className="w-full max-w-sm space-y-2 mb-6 flex-1 flex flex-col justify-center">
          {(lb || []).map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-5 py-3 rounded-2xl font-semibold
                ${entry.id === socket.id ? 'bg-indigo-700 ring-2 ring-yellow-400' : 'bg-gray-800/80'}`}
            >
              <div className="flex items-center gap-3">
                <RankBadge rank={i + 1} />
                <span className="truncate max-w-[140px]">{entry.nickname}</span>
              </div>
              <span className="font-black tabular-nums">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('/')}
          className="bg-indigo-700 hover:bg-indigo-600 text-white px-10 py-3 rounded-full font-bold transition-all mb-8"
        >
          ← Terug naar Home
        </button>
      </div>
    );
  }

  return null;
}
