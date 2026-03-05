const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Price tiers: maxPlayers -> price in EUR cents
const PRICE_TIERS = [
  { maxPlayers: 10, price: 0, label: '1–10 spelers (Gratis)' },
  { maxPlayers: 30, price: 500, label: '11–30 spelers (€5)' },
  { maxPlayers: 50, price: 1000, label: '31–50 spelers (€10)' },
  { maxPlayers: 100, price: 1500, label: '51–100 spelers (€15)' },
  { maxPlayers: 200, price: 2000, label: '100+ spelers (€20)' },
];

function getPriceForPlayers(maxPlayers) {
  const tier = PRICE_TIERS.find(t => maxPlayers <= t.maxPlayers);
  return tier || PRICE_TIERS[PRICE_TIERS.length - 1];
}

// Only initialize Stripe if key is available
const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (stripeKey) {
  stripe = require('stripe')(stripeKey);
  console.log('[PAYMENTS] Stripe configured ✓');
} else {
  console.warn('[PAYMENTS] ⚠ STRIPE_SECRET_KEY not set — payments disabled');
}

// POST /api/payments/create-checkout - Create Stripe Checkout session
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { quizId, discountCode } = req.body;
    if (!quizId) return res.status(400).json({ error: 'Quiz ID required' });

    const quiz = await prisma.quiz.findFirst({
      where: { id: parseInt(quizId), userId: req.user.id },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Check if user is admin - admins get free access to all tiers
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.isAdmin) {
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: { isPaid: true },
      });
      return res.json({ free: true });
    }

    const tier = getPriceForPlayers(quiz.maxPlayers);
    let finalPrice = tier.price;

    // Apply discount code if provided
    let discount = null;
    if (discountCode && discountCode.trim()) {
      discount = await prisma.discountCode.findUnique({
        where: { code: discountCode.trim().toUpperCase() },
      });

      if (!discount || !discount.active) {
        return res.status(400).json({ error: 'Ongeldige kortingscode.' });
      }
      if (discount.expiresAt && discount.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Deze kortingscode is verlopen.' });
      }
      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        return res.status(400).json({ error: 'Deze kortingscode is al maximaal gebruikt.' });
      }

      finalPrice = Math.round(tier.price * (1 - discount.discountPct / 100));
    }

    if (finalPrice === 0) {
      // Free tier or 100% discount — mark as paid directly (no Stripe needed)
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: { isPaid: true },
      });
      // Increment discount usage
      if (discount) {
        await prisma.discountCode.update({
          where: { id: discount.id },
          data: { usedCount: { increment: 1 } },
        });
      }
      return res.json({ free: true });
    }

    // Only require Stripe when an actual payment is needed
    if (!stripe) {
      return res.status(503).json({ error: 'Betalingen zijn momenteel niet beschikbaar. Neem contact op met de beheerder.' });
    }

    const clientUrl = process.env.CLIENT_URL || req.headers.origin || 'https://klaashildaquiz.onrender.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'ideal'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Quizmaster: ${quiz.title}`,
              description: `Tot ${quiz.maxPlayers} spelers`,
            },
            unit_amount: finalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${clientUrl}/dashboard?paid=true&quizId=${quiz.id}`,
      cancel_url: `${clientUrl}/quiz/${quiz.id}/edit`,
      metadata: {
        quizId: quiz.id.toString(),
        userId: req.user.id.toString(),
        discountCodeId: discount ? discount.id.toString() : '',
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Er ging iets mis bij het aanmaken van de betaling. Probeer het opnieuw.' });
  }
});

// POST /api/payments/webhook - Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).send('Payments not configured');

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const quizId = parseInt(session.metadata?.quizId);
    const discountCodeId = parseInt(session.metadata?.discountCodeId) || null;

    if (quizId) {
      try {
        await prisma.quiz.update({
          where: { id: quizId },
          data: { isPaid: true },
        });
        // Increment discount code usage
        if (discountCodeId) {
          await prisma.discountCode.update({
            where: { id: discountCodeId },
            data: { usedCount: { increment: 1 } },
          });
        }
        console.log(`[PAYMENT] Quiz ${quizId} marked as paid`);
      } catch (err) {
        console.error('[PAYMENT] Failed to update quiz:', err);
      }
    }
  }

  res.json({ received: true });
});

// POST /api/payments/validate-discount - Validate a discount code
router.post('/validate-discount', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Code is verplicht' });
    }

    const discount = await prisma.discountCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!discount || !discount.active) {
      return res.status(404).json({ error: 'Ongeldige kortingscode.' });
    }
    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Deze kortingscode is verlopen.' });
    }
    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      return res.status(400).json({ error: 'Deze kortingscode is al maximaal gebruikt.' });
    }

    res.json({
      valid: true,
      discountPct: discount.discountPct,
      code: discount.code,
    });
  } catch (err) {
    console.error('Discount validation error:', err);
    res.status(500).json({ error: 'Validatie mislukt' });
  }
});

// GET /api/payments/pricing - Get price tiers
router.get('/pricing', (req, res) => {
  res.json({
    tiers: PRICE_TIERS.map(t => ({
      maxPlayers: t.maxPlayers,
      price: t.price / 100,
      label: t.label,
    })),
  });
});

module.exports = router;
