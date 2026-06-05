const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required.' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({ name, username, email, password: hashedPassword });
    await newUser.save();

    // Issue JWT
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        familyId: newUser.familyId || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.', details: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    // Find user by username or email
    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare password (support legacy plaintext for dev convenience)
    let isMatch = false;
    if (user.password.startsWith('$2')) {
      // bcrypt hash
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // legacy plaintext
      isMatch = user.password === password;
      // Upgrade to bcrypt on successful login
      if (isMatch) {
        user.password = await bcrypt.hash(password, 12);
        await user.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Upgrade plaintext password to bcrypt on successful login
    if (!user.password.startsWith('$2')) {
      user.password = await bcrypt.hash(password, 12);
      // If name is missing, set it to username to avoid validation error
      if (!user.name) user.name = user.username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        familyId: user.familyId || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.', details: error.message });
  }
});

// POST /api/auth/logout (stateless JWT — just a courtesy endpoint)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// GET /api/auth/me — get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const token = authHeader.split(' ')[1];
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      user: {
        id: user._id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        familyId: user.familyId || null
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

// GET /api/auth/check-user?email=xxx
// Real-time check: does this email exist, and are they available to invite?
const { authMiddleware } = require('../middleware/auth');
router.get('/check-user', authMiddleware, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('name username email familyId');
    if (!user) {
      return res.json({ exists: false, message: 'No account found with this email.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.json({ exists: true, isSelf: true, message: "That's you!" });
    }

    if (user.familyId) {
      return res.json({
        exists: true,
        inFamily: true,
        name: user.name || user.username,
        message: `${user.name || user.username} is already in a family.`
      });
    }

    return res.json({
      exists: true,
      inFamily: false,
      name: user.name || user.username,
      username: user.username,
      message: `Found: ${user.name || user.username}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
