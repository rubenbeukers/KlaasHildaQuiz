const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);

    // Auto-admin for configured admin emails
    const defaultAdmins = 'r.beukers98@gmail.com';
    const adminEmails = (process.env.ADMIN_EMAILS || defaultAdmins).split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(email.toLowerCase());

    const user = await prisma.user.create({
      data: { email, passwordHash, name: name || null, isAdmin },
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is verplicht' });
    }

    // Always return success to prevent email enumeration
    const successMsg = 'Als dit emailadres bij ons bekend is, ontvang je binnen enkele minuten een email met een resetlink.';

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.json({ message: successMsg });
    }

    // Rate limit: max 3 active (unused + not expired) tokens per user
    const activeTokens = await prisma.passwordReset.count({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeTokens >= 3) {
      return res.json({ message: successMsg });
    }

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token in DB (expires in 1 hour)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email async (fire-and-forget)
    sendPasswordResetEmail(user.email, rawToken).catch(err => {
      console.error('Failed to send password reset email:', err);
    });

    res.json({ message: successMsg });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token en wachtwoord zijn verplicht' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens bevatten' });
    }

    // Hash the token and look it up
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Ongeldige of verlopen resetlink. Vraag een nieuwe link aan.' });
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    // Mark this token as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // Invalidate all other active tokens for this user
    await prisma.passwordReset.updateMany({
      where: {
        userId: resetRecord.userId,
        id: { not: resetRecord.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    res.json({ message: 'Wachtwoord succesvol gewijzigd! Je kunt nu inloggen.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
