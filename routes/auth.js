const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: "Username or Email already registered." });
    }

    // Create user (storing password as-is for this simplified stage)
    const newUser = new User({ username, email, password });
    await newUser.save();

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during registration.", details: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username/Email and password are required." });
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid username/email or password." });
    }

    res.json({
      message: "Login successful",
      userId: user._id,
      token: `mock-token-for-user-${user._id}`
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during login.", details: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: "Logout successful" });
});


module.exports = router;
