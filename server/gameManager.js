const { defaultQuiz } = require('./quizData');

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

  createGame(hostSocketId) {
    const pin = this.generatePin();
    const game = {
      pin,
      hostSocketId,
      players: new Map(),       // socketId -> player object
      status: 'lobby',          // lobby | active | finished
      currentQuestion: -1,
      quiz: defaultQuiz,
      answers: new Map(),       // questionIndex -> Map(socketId -> answerData)
      questionTimer: null,
      questionEnded: false,
      questionStartTime: null
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
      lastAnswerCorrect: false
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
      score: p.score
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
    if (!answers || answers.has(socketId)) return null; // already answered

    const question = game.quiz.questions[qIndex];
    const player = game.players.get(socketId);
    if (!player) return null;

    const elapsed = (Date.now() - game.questionStartTime) / 1000;
    const timeRatio = Math.max(0, 1 - elapsed / question.timeLimit);
    const isCorrect = answerIndex === question.correct;

    let points = 0;
    if (isCorrect) {
      points = Math.round(1000 * timeRatio);
      player.streak += 1;
      if (player.streak > 1) {
        points += 100 * (player.streak - 1);
      }
      player.score += points;
      player.lastAnswerCorrect = true;
    } else {
      player.streak = 0;
      player.lastAnswerCorrect = false;
    }

    answers.set(socketId, { answerIndex, isCorrect, points });

    return {
      isCorrect,
      points,
      score: player.score,
      streak: player.streak
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
      total: game.players.size
    };
  }

  getQuestionResults(pin) {
    const game = this.games.get(pin);
    if (!game) return { counts: [0, 0, 0, 0], totalAnswers: 0 };
    const answers = game.answers.get(game.currentQuestion);
    if (!answers) return { counts: [0, 0, 0, 0], totalAnswers: 0 };

    const counts = [0, 0, 0, 0];
    answers.forEach(({ answerIndex }) => {
      if (answerIndex >= 0 && answerIndex < 4) counts[answerIndex]++;
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
        streak: player.streak
      }));
  }

  setStatus(pin, status) {
    const game = this.games.get(pin);
    if (!game) return;
    game.status = status;
  }
}

module.exports = GameManager;
