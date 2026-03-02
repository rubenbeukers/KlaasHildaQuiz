const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const GameManager = require('./gameManager');

const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const gameManager = new GameManager();

app.use(cors());
app.use(express.json());

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', games: gameManager.games.size });
});

// Generate QR code for a game PIN
app.get('/api/qrcode/:gamePin', async (req, res) => {
  try {
    const { gamePin } = req.params;
    const clientHost = req.query.host || 'localhost:3000';
    const protocol = clientHost.includes('localhost') ? 'http' : 'https';
    const url = `${protocol}://${clientHost}/join?pin=${gamePin}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#FFFFFF' }
    });
    res.json({ qrCode: qrDataUrl, url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ─── Socket.io ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── HOST: create a new game ──────────────────────────────────────────────
  socket.on('host:create', (callback) => {
    const game = gameManager.createGame(socket.id);
    socket.join(game.pin);
    socket.data.role = 'host';
    socket.data.gamePin = game.pin;
    console.log(`[GAME] Created: ${game.pin} (host: ${socket.id})`);
    callback({ gamePin: game.pin });
  });

  // ── PLAYER: join a game ──────────────────────────────────────────────────
  socket.on('player:join', ({ gamePin, nickname }, callback) => {
    const game = gameManager.getGame(gamePin);

    if (!game) return callback({ error: 'Game not found. Check your PIN.' });
    if (game.status !== 'lobby') return callback({ error: 'This game has already started.' });
    if (!nickname || nickname.trim().length === 0) return callback({ error: 'Please enter a nickname.' });
    if (nickname.trim().length > 20) return callback({ error: 'Nickname too long (max 20 chars).' });

    const existing = gameManager.getPlayers(gamePin);
    if (existing.some(p => p.nickname.toLowerCase() === nickname.trim().toLowerCase())) {
      return callback({ error: 'Nickname already taken. Choose another.' });
    }

    const player = gameManager.addPlayer(gamePin, socket.id, nickname.trim());
    socket.join(gamePin);
    socket.data.role = 'player';
    socket.data.gamePin = gamePin;
    socket.data.nickname = nickname.trim();

    // Notify host of updated player list
    const players = gameManager.getPlayers(gamePin);
    io.to(game.hostSocketId).emit('player:joined', { players });

    console.log(`[JOIN] ${nickname} → game ${gamePin} (${players.length} players)`);
    callback({ success: true, player });
  });

  // ── HOST: start the game ─────────────────────────────────────────────────
  socket.on('game:start', ({ gamePin }) => {
    const game = gameManager.getGame(gamePin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.players.size === 0) return;

    gameManager.startGame(gamePin);
    io.to(gamePin).emit('game:started');
    console.log(`[GAME] Started: ${gamePin}`);

    // Show first question after 3-second countdown
    setTimeout(() => showQuestion(gamePin, 0), 3000);
  });

  // ── PLAYER: submit an answer ─────────────────────────────────────────────
  socket.on('answer:submit', ({ gamePin, answerIndex }, callback) => {
    const result = gameManager.submitAnswer(gamePin, socket.id, answerIndex);
    if (!result) {
      if (callback) callback({ error: 'Answer not accepted.' });
      return;
    }

    if (callback) callback(result);

    // Live answer count → host
    const game = gameManager.getGame(gamePin);
    if (game) {
      const { count, total } = gameManager.getAnswerCount(gamePin);
      io.to(game.hostSocketId).emit('answer:count', { count, total });

      // End question early if everyone answered
      if (gameManager.allPlayersAnswered(gamePin)) {
        clearTimeout(game.questionTimer);
        endQuestion(gamePin);
      }
    }
  });

  // ── HOST: advance to next question ───────────────────────────────────────
  socket.on('next:question', ({ gamePin }) => {
    const game = gameManager.getGame(gamePin);
    if (!game || game.hostSocketId !== socket.id) return;

    const nextIndex = game.currentQuestion + 1;
    if (nextIndex >= game.quiz.questions.length) {
      endGame(gamePin);
    } else {
      showQuestion(gamePin, nextIndex);
    }
  });

  // ── Disconnect handling ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const { role, gamePin } = socket.data || {};
    if (!gamePin) return;

    if (role === 'host') {
      io.to(gamePin).emit('host:disconnected', { message: 'The host disconnected. Game ended.' });
      gameManager.deleteGame(gamePin);
    } else if (role === 'player') {
      gameManager.removePlayer(gamePin, socket.id);
      const game = gameManager.getGame(gamePin);
      if (game && game.status === 'lobby') {
        const players = gameManager.getPlayers(gamePin);
        io.to(game.hostSocketId).emit('player:joined', { players });
      }
    }
  });
});

// ─── Game flow helpers ────────────────────────────────────────────────────────

function showQuestion(gamePin, questionIndex) {
  const game = gameManager.getGame(gamePin);
  if (!game) return;

  gameManager.setCurrentQuestion(gamePin, questionIndex);
  const question = game.quiz.questions[questionIndex];

  io.to(gamePin).emit('question:show', {
    index: questionIndex,
    total: game.quiz.questions.length,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit
  });

  console.log(`[Q${questionIndex + 1}] Shown in game ${gamePin}`);

  // Auto-end after time limit
  game.questionTimer = setTimeout(() => endQuestion(gamePin), question.timeLimit * 1000);
}

function endQuestion(gamePin) {
  const game = gameManager.getGame(gamePin);
  if (!game || game.questionEnded) return;
  game.questionEnded = true;

  const question = game.quiz.questions[game.currentQuestion];
  const results = gameManager.getQuestionResults(gamePin);
  const leaderboard = gameManager.getLeaderboard(gamePin);

  io.to(gamePin).emit('question:end', {
    correctAnswer: question.correct,
    results,
    leaderboard
  });

  console.log(`[Q${game.currentQuestion + 1}] Ended in game ${gamePin}`);
}

function endGame(gamePin) {
  const game = gameManager.getGame(gamePin);
  if (!game) return;

  gameManager.setStatus(gamePin, 'finished');
  const finalLeaderboard = gameManager.getLeaderboard(gamePin);

  io.to(gamePin).emit('game:end', { finalLeaderboard });
  console.log(`[GAME] Ended: ${gamePin}`);

  // Clean up after 10 minutes
  setTimeout(() => gameManager.deleteGame(gamePin), 10 * 60 * 1000);
}

// ─── SPA catch-all (must be after API routes, skip socket.io) ────────────────

app.get('*', (req, res, next) => {
  // Don't intercept socket.io or API requests
  if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) {
    return next();
  }
  const indexPath = path.join(clientBuild, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Quiz App Server running at http://localhost:${PORT}\n`);
});
