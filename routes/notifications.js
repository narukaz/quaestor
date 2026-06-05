const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/notifications — Get all notifications for current user
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notifications.', details: error.message });
  }
});

// PATCH /api/notifications/:id/read — Mark a notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ notification: notif });
  } catch (error) {
    res.status(500).json({ error: 'Error updating notification.', details: error.message });
  }
});

// PATCH /api/notifications/read-all — Mark all as read
router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating notifications.', details: error.message });
  }
});

// DELETE /api/notifications/:id — Dismiss/delete a notification
router.delete('/:id', async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ message: 'Notification dismissed.' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting notification.', details: error.message });
  }
});

module.exports = router;
