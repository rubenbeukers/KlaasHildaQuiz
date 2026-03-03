const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// All quiz routes require authentication
router.use(authenticateToken);

// GET /api/quizzes - Get all quizzes for current user
router.get('/', async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { userId: req.user.id },
      include: {
        _count: { select: { questions: true, gameSessions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ quizzes });
  } catch (err) {
    console.error('Get quizzes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quizzes/:id - Get quiz with questions and options
router.get('/:id', async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ quiz });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/quizzes - Create new quiz with questions
router.post('/', async (req, res) => {
  try {
    const { title, maxPlayers, questions } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        maxPlayers: maxPlayers || 10,
        questions: {
          create: questions.map((q, qi) => ({
            text: q.text,
            type: q.type || 'single',
            timeLimit: q.timeLimit || 20,
            sortOrder: qi,
            options: {
              create: q.options.map((opt, oi) => ({
                text: opt.text,
                isCorrect: opt.isCorrect || false,
                sortOrder: oi,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    res.status(201).json({ quiz });
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quizzes/:id - Update quiz (replace all questions)
router.put('/:id', async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const { title, maxPlayers, questions } = req.body;

    // Verify ownership
    const existing = await prisma.quiz.findFirst({
      where: { id: quizId, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required' });
    }

    // Delete old questions (cascade deletes options too)
    await prisma.question.deleteMany({ where: { quizId } });

    // Update quiz + create new questions
    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: title.trim(),
        maxPlayers: maxPlayers || existing.maxPlayers,
        questions: {
          create: questions.map((q, qi) => ({
            text: q.text,
            type: q.type || 'single',
            timeLimit: q.timeLimit || 20,
            sortOrder: qi,
            options: {
              create: q.options.map((opt, oi) => ({
                text: opt.text,
                isCorrect: opt.isCorrect || false,
                sortOrder: oi,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    res.json({ quiz });
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/quizzes/:id - Delete quiz
router.delete('/:id', async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const existing = await prisma.quiz.findFirst({
      where: { id: quizId, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });

    // Delete questions first (cascade handles options), then quiz
    await prisma.question.deleteMany({ where: { quizId } });
    await prisma.quiz.delete({ where: { id: quizId } });

    res.json({ message: 'Quiz deleted' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quizzes/history/all - Get all game sessions for current user
router.get('/history/all', async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { userId: req.user.id },
      include: {
        quiz: { select: { title: true } },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ sessions });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quizzes/history/:sessionId - Get game session results
router.get('/history/:sessionId', async (req, res) => {
  try {
    const session = await prisma.gameSession.findFirst({
      where: {
        id: parseInt(req.params.sessionId),
        userId: req.user.id,
      },
      include: {
        quiz: { select: { title: true } },
        results: { orderBy: { finalRank: 'asc' } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
