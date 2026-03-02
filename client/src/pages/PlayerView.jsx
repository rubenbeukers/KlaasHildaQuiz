import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Timer from '../components/Timer.jsx';

const ANSWERS = [
  { bg: 'bg-red-500',     activeBg: 'bg-red-700',     icon: '▲', label: 'A' },
  { bg: 'bg-blue-500',    activeBg: 'bg-blue-700',    icon: '●', label: 'B' },
  { bg: 'bg-yellow-400',  activeBg: 'bg-yellow-600',  icon: '■', label: 'C', textDark: true },
  { bg: 'bg-emerald-500', activeBg: 'bg-emerald-700', icon: '★', label: 'D' },
];

export default function PlayerView() {
  const { pin: urlPin } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [gameState, setGameState] = useState('join');
  // join | lobby | countdown | question | answered | questionEnd | finished

  const [gamePin, setGamePin]     = useState(searchParams.get('pin') || urlPin || '');
  const [nickname, setNickname]   = useState('');
  const [error, setError]         = useState('');
  const [myScore, setMyScore]     = useState(0);
  const [myRank, setMyRank]       = useState(null);
  const [myStreak, setMyStreak]   = useState(0);

  const [question, setQuestion]         = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [leaderboard, setLeaderboard]   = useState([]);
  const [finalData, setFinalData]       = useState(null);

  const myId = socket.id;
  const joinedRef = useRef(false);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('game:started', () => {
      setGameState('countdown');
    });

    socket.on('question:show', ({ index, total, text, options, timeLimit }) => {
      setQuestion({ text, options, timeLimit, index, total });
      setSelectedAnswer(null);
      setAnswerResult(null);
      setCorrectAnswer(null);
      setGameState('question');
    });

    socket.on('question:end', ({ correctAnswer, leaderboard }) => {
      setCorrectAnswer(correctAnswer);
      setLeaderboard(leaderboard);
      const me = leaderboard.find(p => p.id === socket.id);
      if (me) {
        setMyScore(me.score);
        setMyRank(me.rank);
      }
      setGameState('questionEnd');
    });

    socket.on('game:end', ({ finalLeaderboard }) => {
      const me = finalLeaderboard.find(p => p.id === socket.id);
      setFinalData({ leaderboard: finalLeaderboard, me });
      setGameState('finished');
    });

    socket.on('host:disconnected', ({ message }) => {
      setError(message);
      setGameState('join');
      joinedRef.current = false;
    });

    return () => {
      socket.off('game:started');
      socket.off('question:show');
      socket.off('question:end');
      socket.off('game:end');
      socket.off('host:disconnected');
    };
  }, []);

  // ── Join handler ──────────────────────────────────────────────────────────
  const handleJoin = () => {
    setError('');
    const trimPin  = gamePin.trim();
    const trimName = nickname.trim();
    if (!trimPin)  return setError('Please enter the game PIN.');
    if (!trimName) return setError('Please enter a nickname.');

    socket.emit('player:join', { gamePin: trimPin, nickname: trimName }, (res) => {
      if (res.error) return setError(res.error);
      joinedRef.current = true;
      setGamePin(trimPin);
      setGameState('lobby');
    });
  };

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = (index) => {
    if (selectedAnswer !== null || gameState !== 'question') return;
    setSelectedAnswer(index);

    socket.emit('answer:submit', { gamePin, answerIndex: index }, (result) => {
      if (result && !result.error) {
        setAnswerResult(result);
        setMyScore(result.score);
        setMyStreak(result.streak);
      }
      setGameState('answered');
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'join') {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-slide-up">
          <div className="text-center mb-6">
            <span className="text-5xl">⚡</span>
            <h1 className="text-3xl font-black text-indigo-900 mt-2">Join Quiz</h1>
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

          <label className="block text-gray-700 font-bold mb-1 text-sm">Your nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value.slice(0, 20))}
            placeholder="E.g. SpeedKing99"
            className="w-full border-2 border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-lg text-gray-900 outline-none mb-6 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />

          <button
            onClick={handleJoin}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-4 rounded-2xl text-xl font-black transition-all transform active:scale-95"
          >
            Join Game!
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full text-gray-400 text-sm mt-3 py-2 hover:text-gray-600 transition-colors"
          >
            ← Back to home
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
        <h2 className="text-3xl font-black">You're in!</h2>
        <div className="bg-indigo-800 rounded-2xl px-8 py-4 text-center">
          <p className="text-indigo-300 text-sm">Playing as</p>
          <p className="text-2xl font-black mt-1">{nickname}</p>
        </div>
        <p className="text-indigo-300 text-center">Waiting for the host to start the game...</p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COUNTDOWN (game about to start)
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-2xl font-semibold text-indigo-300">Get ready!</p>
        <div className="text-8xl animate-pulse">🚀</div>
        <p className="text-indigo-400">First question coming up...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'question' && question) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col select-none">
        {/* Header */}
        <div className="bg-gray-800 flex items-center justify-between px-4 py-2">
          <div className="text-gray-400 text-sm font-semibold">
            Q{question.index + 1}/{question.total}
          </div>
          <Timer duration={question.timeLimit} size="small" onExpire={() => setGameState('answered')} />
          <div className="text-right">
            <span className="text-white font-black tabular-nums">{myScore.toLocaleString()}</span>
            <span className="text-gray-400 text-xs ml-1">pts</span>
          </div>
        </div>

        {/* Question text */}
        <div className="flex-1 flex items-center justify-center px-5 py-4">
          <p className="text-white text-2xl font-black text-center leading-snug">{question.text}</p>
        </div>

        {/* 4 Answer buttons */}
        <div className="grid grid-cols-2 gap-3 p-3 pb-5">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selectedAnswer !== null}
              className={`${ANSWERS[i].bg} ${selectedAnswer === null ? 'active:scale-95' : ''} rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-lg transition-transform min-h-[110px]
                ${selectedAnswer !== null && selectedAnswer !== i ? 'opacity-50' : ''}
                ${selectedAnswer === i ? ANSWERS[i].activeBg + ' ring-4 ring-white' : ''}
              `}
            >
              <span className={`text-3xl font-black ${ANSWERS[i].textDark ? 'text-black' : 'text-white'}`}>
                {ANSWERS[i].icon}
              </span>
              <span className={`text-sm font-bold text-center leading-tight ${ANSWERS[i].textDark ? 'text-black' : 'text-white'}`}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANSWERED — waiting for question to end
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'answered') {
    const hasResult = answerResult && !answerResult.error;
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-8 gap-4">
        {hasResult ? (
          <>
            <div className={`text-8xl animate-pop`}>
              {answerResult.isCorrect ? '✅' : '❌'}
            </div>
            <h2 className={`text-4xl font-black ${answerResult.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {answerResult.isCorrect ? 'Correct!' : 'Wrong!'}
            </h2>
            {answerResult.isCorrect && (
              <p className="text-3xl font-black text-yellow-400">+{answerResult.points.toLocaleString()} pts</p>
            )}
            {answerResult.streak > 1 && (
              <p className="text-xl text-orange-400 font-bold">🔥 {answerResult.streak}× streak bonus!</p>
            )}
            <p className="text-gray-500 text-lg mt-2 font-semibold">{myScore.toLocaleString()} pts total</p>
          </>
        ) : (
          <>
            <div className="text-7xl">⏰</div>
            <h2 className="text-3xl font-black text-gray-300">Time's up!</h2>
          </>
        )}
        <p className="text-gray-600 text-sm mt-4 animate-pulse">Waiting for results...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION END — show correct answer + player rank
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'questionEnd') {
    const me = leaderboard.find(p => p.id === socket.id);
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 gap-5">
        {/* Correct answer */}
        {correctAnswer !== null && question && (
          <div className={`${ANSWERS[correctAnswer].bg} rounded-2xl px-6 py-3 text-center w-full max-w-sm`}>
            <p className="text-xs font-semibold opacity-80 uppercase">Correct answer</p>
            <p className={`text-xl font-black mt-0.5 ${ANSWERS[correctAnswer].textDark ? 'text-black' : 'text-white'}`}>
              {question.options[correctAnswer]}
            </p>
          </div>
        )}

        {/* Rank + score */}
        {me && (
          <div className="text-center animate-pop">
            <p className="text-6xl font-black text-yellow-400">
              {medals[me.rank - 1] ?? `#${me.rank}`}
            </p>
            <p className="text-gray-400 text-sm">Your current rank</p>
            <p className="text-3xl font-black text-white mt-2">{me.score.toLocaleString()} pts</p>
          </div>
        )}

        {/* Top 3 mini leaderboard */}
        <div className="w-full max-w-sm space-y-2">
          {leaderboard.slice(0, 3).map((entry, i) => (
            <div key={entry.id} className={`flex items-center justify-between px-4 py-2 rounded-xl ${entry.id === socket.id ? 'bg-indigo-700' : 'bg-gray-800'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[i] ?? `#${i+1}`}</span>
                <span className="font-semibold text-sm">{entry.nickname}</span>
              </div>
              <span className="font-black tabular-nums">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <p className="text-gray-600 text-sm animate-pulse">Waiting for next question...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FINISHED
  // ─────────────────────────────────────────────────────────────────────────
  if (gameState === 'finished' && finalData) {
    const { me, leaderboard: lb } = finalData;
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center text-white p-6 overflow-auto">
        <h1 className="text-4xl font-black mt-6 mb-2">Game Over!</h1>

        {/* My result card */}
        {me && (
          <div className="bg-indigo-800 rounded-3xl p-6 my-6 text-center w-full max-w-xs animate-pop">
            <p className="text-indigo-300 text-sm">You finished</p>
            <p className="text-7xl font-black text-yellow-400 my-1">
              {medals[me.rank - 1] ?? `#${me.rank}`}
            </p>
            <p className="text-3xl font-black">{me.score.toLocaleString()}</p>
            <p className="text-indigo-300 text-sm">points</p>
          </div>
        )}

        {/* Full leaderboard */}
        <div className="w-full max-w-sm space-y-2 mb-6">
          {lb.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-5 py-3 rounded-2xl font-semibold
                ${entry.id === socket.id ? 'bg-indigo-700 ring-2 ring-yellow-400' : 'bg-gray-800'}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center">{medals[i] ?? <span className="text-gray-500">#{i+1}</span>}</span>
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
          ← Back to Home
        </button>
      </div>
    );
  }

  return null;
}
