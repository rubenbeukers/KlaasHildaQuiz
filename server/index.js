require('dotenv').config(); // Gemini API key configured

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const GameManager = require('./gameManager');
const prisma = require('./db');
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const paymentRoutes = require('./routes/payments');
const generateRoutes = require('./routes/generate');

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
const hostReconnectTimers = new Map();

app.use(cors());

// Stripe webhook needs raw body - mount before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes/generate', generateRoutes); // Must be before /api/quizzes to avoid /:id conflict
app.use('/api/quizzes', quizRoutes);
app.use('/api/payments', paymentRoutes);

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
  socket.on('host:create', async ({ quizId } = {}, callback) => {
    try {
      if (!quizId) return callback({ error: 'No quiz selected' });

      const dbQuiz = await prisma.quiz.findUnique({
        where: { id: parseInt(quizId) },
        include: {
          user: { select: { isAdmin: true } },
          questions: {
            orderBy: { sortOrder: 'asc' },
            include: { options: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });

      if (!dbQuiz) return callback({ error: 'Quiz not found' });
      if (dbQuiz.questions.length === 0) return callback({ error: 'Quiz has no questions' });

      // Payment enforcement: quizzes with >10 players must be paid (admins bypass)
      const isOwnerAdmin = dbQuiz.user?.isAdmin || false;
      if (dbQuiz.maxPlayers > 10 && !dbQuiz.isPaid && !isOwnerAdmin) {
        return callback({ error: 'Deze quiz vereist betaling voor meer dan 10 spelers. Ga naar de quiz editor om te betalen.' });
      }

      const game = gameManager.createGame(socket.id, dbQuiz);
      socket.join(game.pin);
      socket.data.role = 'host';
      socket.data.gamePin = game.pin;
      console.log(`[GAME] Created: ${game.pin} quiz="${dbQuiz.title}" (host: ${socket.id})`);
      callback({ gamePin: game.pin, quizTitle: dbQuiz.title, maxPlayers: dbQuiz.maxPlayers, theme: dbQuiz.theme || 'default' });
    } catch (err) {
      console.error('host:create error:', err);
      callback({ error: 'Failed to create game' });
    }
  });

  // ── PLAYER: join a game ──────────────────────────────────────────────────
  socket.on('player:join', ({ gamePin, nickname }, callback) => {
    const game = gameManager.getGame(gamePin);

    if (!game) return callback({ error: 'Game not found. Check your PIN.' });
    if (game.status !== 'lobby') return callback({ error: 'This game has already started.' });
    if (!nickname || nickname.trim().length === 0) return callback({ error: 'Please enter a nickname.' });
    if (nickname.trim().length > 20) return callback({ error: 'Nickname too long (max 20 chars).' });

    // Check max players
    if (game.players.size >= (game.maxPlayers || 10)) {
      return callback({ error: `Game is full (max ${game.maxPlayers || 10} players).` });
    }

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
    io.to(gamePin).emit('game:started', { theme: game.quiz?.theme || 'default' });
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

  // ── HOST: rejoin existing game ─────────────────────────────────────────────
  socket.on('host:rejoin', ({ gamePin }, callback) => {
    const game = gameManager.getGame(gamePin);
    if (!game) return callback?.({ error: 'Game niet gevonden' });

    const timer = hostReconnectTimers.get(gamePin);
    if (timer) { clearTimeout(timer); hostReconnectTimers.delete(gamePin); }

    game.hostSocketId = socket.id;
    socket.join(gamePin);
    socket.data.role = 'host';
    socket.data.gamePin = gamePin;

    io.to(gamePin).emit('host:reconnected');
    console.log(`[HOST] Rejoined: ${gamePin}`);
    callback?.({
      success: true,
      status: game.status,
      currentQuestion: game.currentQuestion,
      quizTitle: game.quiz?.title || '',
      theme: game.quiz?.theme || 'default',
      totalQuestions: game.quiz?.questions?.length || 0,
      players: Array.from(game.players.values()).map(p => ({ id: p.id, nickname: p.nickname, score: p.score })),
    });
  });

  // ── PLAYER: rejoin after reconnect ─────────────────────────────────────────
  socket.on('player:rejoin', ({ gamePin, nickname }, callback) => {
    const game = gameManager.getGame(gamePin);
    if (!game) return callback?.({ error: 'Game niet gevonden' });
    if (game.status !== 'active') return callback?.({ error: 'Spel niet actief' });

    const found = gameManager.getPlayerByNickname(gamePin, nickname);
    if (!found) return callback?.({ error: 'Speler niet gevonden' });

    gameManager.updatePlayerSocketId(gamePin, found.socketId, socket.id);
    socket.join(gamePin);
    socket.data.role = 'player';
    socket.data.gamePin = gamePin;
    socket.data.nickname = nickname;

    const player = game.players.get(socket.id);
    console.log(`[REJOIN] ${nickname} rejoined ${gamePin}`);
    callback?.({ success: true, score: player?.score || 0, streak: player?.streak || 0 });
  });

  // ── HOST: end game early ───────────────────────────────────────────────────
  socket.on('game:end_early', ({ gamePin }) => {
    const game = gameManager.getGame(gamePin);
    if (!game || game.hostSocketId !== socket.id) return;
    console.log(`[GAME] Ended early: ${gamePin}`);
    endGame(gamePin);
  });

  // ── HOST: kick a player ────────────────────────────────────────────────────
  socket.on('player:kick', ({ gamePin, playerId }) => {
    const game = gameManager.getGame(gamePin);
    if (!game || game.hostSocketId !== socket.id) return;
    const player = game.players.get(playerId);
    if (!player) return;
    const nickname = player.nickname;
    gameManager.removePlayer(gamePin, playerId);
    io.to(playerId).emit('player:kicked', { message: 'Je bent verwijderd door de host.' });
    const players = gameManager.getPlayers(gamePin);
    io.to(game.hostSocketId).emit('player:joined', { players });
    console.log(`[KICK] ${nickname} from ${gamePin}`);
  });

  // ── Disconnect handling ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const { role, gamePin } = socket.data || {};
    if (!gamePin) return;

    if (role === 'host') {
      const game = gameManager.getGame(gamePin);
      if (!game) return;
      io.to(gamePin).emit('host:reconnecting', { seconds: 10 });
      const timer = setTimeout(() => {
        hostReconnectTimers.delete(gamePin);
        io.to(gamePin).emit('host:disconnected', { message: 'De host heeft de verbinding verbroken. Het spel is beëindigd.' });
        gameManager.deleteGame(gamePin);
        console.log(`[GAME] Deleted after host timeout: ${gamePin}`);
      }, 10000);
      hostReconnectTimers.set(gamePin, timer);
      console.log(`[-HOST] Disconnected, 10s grace: ${gamePin}`);
    } else if (role === 'player') {
      const game = gameManager.getGame(gamePin);
      if (game && game.status === 'active') {
        console.log(`[-PLAYER] Disconnected mid-game: ${socket.data.nickname}`);
      } else {
        gameManager.removePlayer(gamePin, socket.id);
        if (game && game.status === 'lobby') {
          const players = gameManager.getPlayers(gamePin);
          io.to(game.hostSocketId).emit('player:joined', { players });
        }
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
    type: question.type || 'single',
    options: question.options,
    timeLimit: question.timeLimit,
    background: question.background || null,
    theme: game.quiz.theme || 'default',
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

async function endGame(gamePin) {
  const game = gameManager.getGame(gamePin);
  if (!game) return;

  gameManager.setStatus(gamePin, 'finished');
  const finalLeaderboard = gameManager.getLeaderboard(gamePin);

  io.to(gamePin).emit('game:end', { finalLeaderboard });
  console.log(`[GAME] Ended: ${gamePin}`);

  // Save results to database
  if (game.quizId && game.userId) {
    try {
      const results = gameManager.getGameResults(gamePin);
      await prisma.gameSession.create({
        data: {
          quizId: game.quizId,
          userId: game.userId,
          pin: gamePin,
          status: 'finished',
          playerCount: game.players.size,
          startedAt: new Date(),
          endedAt: new Date(),
          results: {
            create: results || [],
          },
        },
      });
      console.log(`[DB] Saved results for game ${gamePin}`);
    } catch (err) {
      console.error('[DB] Failed to save game results:', err);
    }
  }

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
