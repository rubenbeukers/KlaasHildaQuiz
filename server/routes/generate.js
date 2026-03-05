const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Startup check
if (process.env.GEMINI_API_KEY) {
  console.log('[AI] Gemini API key configured ✓');
} else {
  console.warn('[AI] ⚠ GEMINI_API_KEY not set — AI generation disabled');
}

router.use(authenticateToken);

// POST /api/quizzes/generate - Generate quiz questions with AI
router.post('/', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI generatie is niet geconfigureerd' });
  }

  try {
    const { topic, numQuestions = 10 } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Onderwerp is verplicht' });
    }

    const count = Math.min(Math.max(parseInt(numQuestions) || 10, 1), 30);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Je bent een quiz-maker voor een Kahoot-achtige quiz app. Genereer een quiz over het volgende onderwerp: "${topic.trim()}"

Genereer precies ${count} multiple-choice vragen in het Nederlands.

Regels:
- Elke vraag heeft precies 4 antwoordopties
- Precies 1 antwoord is correct per vraag
- Vragen moeten feitelijk correct zijn
- Varieer in moeilijkheidsgraad (makkelijk, gemiddeld, moeilijk)
- Vragen moeten interessant en gevarieerd zijn
- Antwoorden moeten plausibel zijn (geen overduidelijk foute antwoorden)
- Geef ook een korte, pakkende quiztitel in het Nederlands

Antwoord ALLEEN met geldig JSON in exact dit formaat, geen markdown, geen uitleg:
{
  "title": "Pakkende Quiz Titel",
  "questions": [
    {
      "text": "De vraagtekst?",
      "type": "single",
      "timeLimit": 20,
      "background": null,
      "options": [
        { "text": "Antwoord A", "isCorrect": false },
        { "text": "Antwoord B", "isCorrect": true },
        { "text": "Antwoord C", "isCorrect": false },
        { "text": "Antwoord D", "isCorrect": false }
      ]
    }
  ]
}`;

    console.log(`[AI] Generating ${count} questions about: "${topic.trim()}"`);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Strip markdown fences if Gemini wraps the output
    const cleaned = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[AI] Parse error:', parseErr.message);
      console.error('[AI] Raw response:', responseText.substring(0, 500));
      return res.status(502).json({
        error: 'AI gaf een ongeldig antwoord. Probeer het opnieuw.',
      });
    }

    // Validate structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return res.status(502).json({
        error: 'AI gaf een ongeldig antwoord. Probeer het opnieuw.',
      });
    }

    // Sanitize each question to match the exact client format
    const questions = parsed.questions.map(q => ({
      text: String(q.text || ''),
      type: 'single',
      timeLimit: parseInt(q.timeLimit) || 20,
      background: null,
      options: (q.options || []).slice(0, 4).map(opt => ({
        text: String(opt.text || ''),
        isCorrect: Boolean(opt.isCorrect),
      })),
    }));

    // Ensure each question has exactly 4 options
    questions.forEach(q => {
      while (q.options.length < 4) {
        q.options.push({ text: '', isCorrect: false });
      }
    });

    // Ensure exactly one correct answer per question
    questions.forEach(q => {
      const correctCount = q.options.filter(o => o.isCorrect).length;
      if (correctCount === 0) {
        q.options[0].isCorrect = true;
      } else if (correctCount > 1) {
        let foundFirst = false;
        q.options.forEach(o => {
          if (o.isCorrect && foundFirst) o.isCorrect = false;
          if (o.isCorrect) foundFirst = true;
        });
      }
    });

    console.log(`[AI] Generated ${questions.length} questions: "${parsed.title || topic}"`);

    res.json({
      title: String(parsed.title || topic.trim()),
      questions,
    });
  } catch (err) {
    console.error('[AI] Generation error:', err);

    if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        error: 'AI limiet bereikt. Wacht even en probeer het opnieuw, of probeer het later nog eens.',
      });
    }

    if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('API_KEY_INVALID')) {
      return res.status(401).json({
        error: 'AI API-sleutel is ongeldig of verlopen. Neem contact op met de beheerder.',
      });
    }

    if (err.message?.includes('SAFETY') || err.message?.includes('blocked')) {
      return res.status(400).json({
        error: 'AI kon geen vragen genereren over dit onderwerp. Probeer een ander onderwerp.',
      });
    }

    res.status(500).json({
      error: 'AI generatie mislukt. Probeer het opnieuw.',
    });
  }
});

module.exports = router;
