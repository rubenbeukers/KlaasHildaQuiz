class GameManager {
  constructor() {
    this.games = new Map();
  }

  generatePin() {
    let pin;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.games.has(pin));
    return pin;
  }

  // Convert DB quiz format to game format
  formatQuizForGame(dbQuiz) {
    return {
      id: dbQuiz.id,
      title: dbQuiz.title,
      theme: dbQuiz.theme || 'default',
      questions: dbQuiz.questions.map(q => {
        const correctIndices = q.options
          .map((o, i) => (o.isCorrect ? i : -1))
          .filter(i => i >= 0);

        return {
          id: q.id,
          text: q.text,
          type: q.type || 'single',
          options: q.options.map(o => o.text),
          correct: q.type === 'multiple' ? correctIndices : correctIndices[0],
          timeLimit: q.timeLimit || 20,
          background: q.background || null,
        };
      }),
    };
  }

  createGame(hostSocketId, dbQuiz) {
    const pin = this.generatePin();
    const quiz = dbQuiz ? this.formatQuizForGame(dbQuiz) : null;

    const game = {
      pin,
      hostSocketId,
      quizId: dbQuiz ? dbQuiz.id : null,
      userId: dbQuiz ? dbQuiz.userId : null,
      maxPlayers: dbQuiz ? dbQuiz.maxPlayers : 10,
      players: new Map(),
      status: 'lobby',
      currentQuestion: -1,
      quiz,
      answers: new Map(),
      questionTimer: null,
      questionEnded: false,
      questionStartTime: null,
    };
    this.games.set(pin, game);
    return game;
  }

  getGame(pin) {
    return this.games.get(pin);
  }

  deleteGame(pin) {
    const game = this.games.get(pin);
    if (game && game.questionTimer) clearTimeout(game.questionTimer);
    this.games.delete(pin);
  }

  addPlayer(pin, socketId, nickname) {
    const game = this.games.get(pin);
    if (!game) return null;

    const player = {
      id: socketId,
      nickname,
      score: 0,
      streak: 0,
      lastAnswerCorrect: false,
      correctCount: 0,
    };
    game.players.set(socketId, player);
    return { ...player };
  }

  removePlayer(pin, socketId) {
    const game = this.games.get(pin);
    if (!game) return;
    game.players.delete(socketId);
  }

  getPlayers(pin) {
    const game = this.games.get(pin);
    if (!game) return [];
    return Array.from(game.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
  }

  startGame(pin) {
    const game = this.games.get(pin);
    if (!game) return false;
    game.status = 'active';
    return true;
  }

  setCurrentQuestion(pin, index) {
    const game = this.games.get(pin);
    if (!game) return;
    game.currentQuestion = index;
    game.answers.set(index, new Map());
    game.questionEnded = false;
    game.questionStartTime = Date.now();
  }

  submitAnswer(pin, socketId, answerIndex) {
    const game = this.games.get(pin);
    if (!game || game.status !== 'active') return null;
    if (game.questionEnded) return null;

    const qIndex = game.currentQuestion;
    if (qIndex < 0) return null;

    const answers = game.answers.get(qIndex);
    if (!answers || answers.has(socketId)) return null;

    const question = game.quiz.questions[qIndex];
    const player = game.players.get(socketId);
    if (!player) return null;

    const elapsed = (Date.now() - game.questionStartTime) / 1000;
    const timeRatio = Math.max(0, 1 - elapsed / question.timeLimit);

    let isCorrect;
    if (question.type === 'multiple' && Array.isArray(question.correct)) {
      const submitted = Array.isArray(answerIndex) ? answerIndex.sort() : [answerIndex];
      const correct = [...question.correct].sort();
      isCorrect = submitted.length === correct.length && submitted.every((v, i) => v === correct[i]);
    } else {
      isCorrect = answerIndex === question.correct;
    }

    let points = 0;
    if (isCorrect) {
      points = Math.round(1000 * timeRatio);
      player.streak += 1;
      if (player.streak > 1) {
        points += 100 * (player.streak - 1);
      }
      player.score += points;
      player.lastAnswerCorrect = true;
      player.correctCount += 1;
    } else {
      player.streak = 0;
      player.lastAnswerCorrect = false;
    }

    answers.set(socketId, { answerIndex, isCorrect, points });

    return {
      isCorrect,
      points,
      score: player.score,
      streak: player.streak,
    };
  }

  allPlayersAnswered(pin) {
    const game = this.games.get(pin);
    if (!game || game.players.size === 0) return false;
    const answers = game.answers.get(game.currentQuestion);
    if (!answers) return false;
    return answers.size >= game.players.size;
  }

  getAnswerCount(pin) {
    const game = this.games.get(pin);
    if (!game) return { count: 0, total: 0 };
    const answers = game.answers.get(game.currentQuestion);
    return {
      count: answers ? answers.size : 0,
      total: game.players.size,
    };
  }

  getQuestionResults(pin) {
    const game = this.games.get(pin);
    if (!game) return { counts: [0, 0, 0, 0], totalAnswers: 0 };
    const answers = game.answers.get(game.currentQuestion);
    if (!answers) return { counts: [0, 0, 0, 0], totalAnswers: 0 };

    const counts = [0, 0, 0, 0];
    answers.forEach(({ answerIndex }) => {
      if (Array.isArray(answerIndex)) {
        answerIndex.forEach(i => { if (i >= 0 && i < 4) counts[i]++; });
      } else if (answerIndex >= 0 && answerIndex < 4) {
        counts[answerIndex]++;
      }
    });

    return { counts, totalAnswers: answers.size };
  }

  getLeaderboard(pin) {
    const game = this.games.get(pin);
    if (!game) return [];
    return Array.from(game.players.values())
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        nickname: player.nickname,
        score: player.score,
        id: player.id,
        streak: player.streak,
        correctCount: player.correctCount,
      }));
  }

  getGameResults(pin) {
    const game = this.games.get(pin);
    if (!game) return null;
    const totalQuestions = game.quiz ? game.quiz.questions.length : 0;
    const leaderboard = this.getLeaderboard(pin);
    return leaderboard.map(p => ({
      nickname: p.nickname,
      finalScore: p.score,
      finalRank: p.rank,
      correctCount: p.correctCount,
      totalQuestions,
    }));
  }

  setStatus(pin, status) {
    const game = this.games.get(pin);
    if (!game) return;
    game.status = status;
  }
}

module.exports = GameManager;
