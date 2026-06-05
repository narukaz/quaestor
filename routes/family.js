const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Family = require('../models/Family');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

// All routes require auth
router.use(authMiddleware);

// GET /api/family — Get the current user's family details
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    if (!user.familyId) {
      return res.json({ message: 'You are not part of any family group yet.', family: null });
    }

    const family = await Family.findById(user.familyId)
      .populate('members', 'name username email')
      .populate('createdBy', 'name username')
      .populate('pendingInvites.userId', 'name username email')
      .populate('pendingInvites.invitedBy', 'name username');

    if (!family) {
      return res.status(404).json({ error: 'Family group not found.' });
    }

    res.json({ message: 'Family details fetched successfully', family });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching family details.', details: error.message });
  }
});

// POST /api/family/create — Create a new family group
router.post('/create', async (req, res) => {
  try {
    const user = req.user;

    if (user.familyId) {
      return res.status(400).json({ error: 'You already belong to a family group.' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Family name is required.' });
    }

    const family = new Family({
      name: name.trim(),
      createdBy: user._id,
      members: [user._id],
      pendingInvites: []
    });
    await family.save();

    user.familyId = family._id;
    await user.save();

    const populated = await Family.findById(family._id)
      .populate('members', 'name username email')
      .populate('createdBy', 'name username');

    res.status(201).json({ message: 'Family created successfully', family: populated });
  } catch (error) {
    res.status(500).json({ error: 'Error creating family.', details: error.message });
  }
});

// POST /api/family/invite — Invite a user by username or email
router.post('/invite', async (req, res) => {
  try {
    const inviter = req.user;

    if (!inviter.familyId) {
      return res.status(400).json({ error: 'You must create or belong to a family before inviting others.' });
    }

    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) {
      return res.status(400).json({ error: 'usernameOrEmail is required.' });
    }

    // Find target user
    const targetUser = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'No user found with that username or email.' });
    }

    if (targetUser._id.toString() === inviter._id.toString()) {
      return res.status(400).json({ error: "You can't invite yourself." });
    }

    if (targetUser.familyId) {
      return res.status(400).json({ error: 'That user already belongs to a family group.' });
    }

    const family = await Family.findById(inviter.familyId);
    if (!family) {
      return res.status(404).json({ error: 'Your family group was not found.' });
    }

    // Check for existing pending invite
    const alreadyInvited = family.pendingInvites.some(
      inv => inv.userId.toString() === targetUser._id.toString() && inv.status === 'pending'
    );
    if (alreadyInvited) {
      return res.status(400).json({ error: 'This user already has a pending invite from your family.' });
    }

    // Add pending invite
    family.pendingInvites.push({
      userId: targetUser._id,
      invitedBy: inviter._id,
      status: 'pending'
    });
    await family.save();

    // Get the invite subdoc we just created (last one)
    const newInvite = family.pendingInvites[family.pendingInvites.length - 1];

    // Create notification for the target user
    await Notification.create({
      userId: targetUser._id,
      type: 'family_invite',
      message: `${inviter.name || inviter.username} invited you to join the "${family.name}" family group.`,
      relatedId: family._id,
      inviteData: {
        familyId: family._id,
        inviteId: newInvite._id.toString(),
        invitedByName: inviter.name || inviter.username
      }
    });

    res.json({
      message: `Invitation sent to ${targetUser.username}.`,
      inviteId: newInvite._id
    });
  } catch (error) {
    res.status(500).json({ error: 'Error sending invitation.', details: error.message });
  }
});

// POST /api/family/invite/:inviteId/accept — Accept a family invitation
router.post('/invite/:inviteId/accept', async (req, res) => {
  try {
    const user = req.user;
    const { inviteId } = req.params;

    // Find family that has this invite for this user
    const family = await Family.findOne({
      'pendingInvites._id': inviteId,
      'pendingInvites.userId': user._id
    });

    if (!family) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    const invite = family.pendingInvites.id(inviteId);
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'This invitation has already been responded to.' });
    }

    // Accept: add user to family members
    invite.status = 'accepted';
    if (!family.members.includes(user._id)) {
      family.members.push(user._id);
    }
    await family.save();

    // Update user's familyId
    user.familyId = family._id;
    await user.save();

    // Notify the inviter
    await Notification.create({
      userId: invite.invitedBy,
      type: 'family_accepted',
      message: `🎉 ${user.name || user.username} accepted your invitation and joined the "${family.name}" family!`,
      relatedId: family._id
    });

    // Mark the invite notification as read for this user
    await Notification.updateMany(
      { userId: user._id, 'inviteData.inviteId': inviteId },
      { read: true }
    );

    const populated = await Family.findById(family._id)
      .populate('members', 'name username email')
      .populate('createdBy', 'name username');

    res.json({ message: 'You have joined the family!', family: populated });
  } catch (error) {
    res.status(500).json({ error: 'Error accepting invitation.', details: error.message });
  }
});

// POST /api/family/invite/:inviteId/reject — Reject a family invitation
router.post('/invite/:inviteId/reject', async (req, res) => {
  try {
    const user = req.user;
    const { inviteId } = req.params;

    // Find family that has this invite for this user
    const family = await Family.findOne({
      'pendingInvites._id': inviteId,
      'pendingInvites.userId': user._id
    });

    if (!family) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    const invite = family.pendingInvites.id(inviteId);
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'This invitation has already been responded to.' });
    }

    invite.status = 'rejected';
    await family.save();

    // Notify the inviter with a friendly rejection message
    const rejectionMessages = [
      `${user.name || user.username} decided not to join the "${family.name}" family group. Maybe next time! 🙂`,
      `Looks like ${user.name || user.username} doesn't consider themselves part of the "${family.name}" family just yet.`,
      `${user.name || user.username} gracefully declined joining "${family.name}". They're on their own financial journey for now.`
    ];
    const msg = rejectionMessages[Math.floor(Math.random() * rejectionMessages.length)];

    await Notification.create({
      userId: invite.invitedBy,
      type: 'family_rejected',
      message: msg,
      relatedId: family._id
    });

    // Mark the invite notification as read for this user
    await Notification.updateMany(
      { userId: user._id, 'inviteData.inviteId': inviteId },
      { read: true }
    );

    res.json({ message: 'Invitation declined.' });
  } catch (error) {
    res.status(500).json({ error: 'Error rejecting invitation.', details: error.message });
  }
});

// DELETE /api/family/members/:memberId — Remove a member from the family
router.delete('/members/:memberId', async (req, res) => {
  try {
    const user = req.user;
    const { memberId } = req.params;

    if (!user.familyId) {
      return res.status(400).json({ error: 'You are not part of any family group.' });
    }

    const family = await Family.findById(user.familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family group not found.' });
    }

    // Only creator can remove other members; any member can remove themselves
    const isSelf = memberId === user._id.toString();
    const isCreator = family.createdBy.toString() === user._id.toString();

    if (!isSelf && !isCreator) {
      return res.status(403).json({ error: 'Only the family creator can remove other members.' });
    }

    const memberIndex = family.members.findIndex(m => m.toString() === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member is not in your family group.' });
    }

    family.members.splice(memberIndex, 1);
    await family.save();

    // Update removed user's familyId
    const targetUser = await User.findById(memberId);
    if (targetUser) {
      targetUser.familyId = undefined;
      await targetUser.save();
    }

    // If family is empty, delete it
    if (family.members.length === 0) {
      await Family.findByIdAndDelete(family._id);
    }

    res.json({ message: `Member removed from family successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Error removing member.', details: error.message });
  }
});

module.exports = router;
