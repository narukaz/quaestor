const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Family = require('../models/Family');

// Helper to authenticate caller via x-user-id header
const getAuthenticatedUser = async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Please provide a valid 'x-user-id' in request headers." });
    return null;
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "Authenticated user not found." });
      return null;
    }
    return user;
  } catch (error) {
    res.status(400).json({ error: "Invalid 'x-user-id' format." });
    return null;
  }
};

// GET /api/family - Get family details for the logged-in user
router.get('/', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    if (!user.familyId) {
      return res.json({ message: "You are not part of any family group yet.", family: null });
    }

    const family = await Family.findById(user.familyId).populate('members', 'username email');
    if (!family) {
      return res.status(404).json({ error: "Family group not found." });
    }

    res.json({ message: "Family details fetched successfully", family });
  } catch (error) {
    res.status(500).json({ error: "Error fetching family details.", details: error.message });
  }
});

// POST /api/family/members - Add a user to the caller's family group
// Expects: { userId: String } in body
router.post('/members', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId of the member to add is required." });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user to add not found." });
    }

    let family;
    if (!user.familyId) {
      // Create a new family group if the caller doesn't have one
      family = new Family({
        name: `${user.username}'s Family`,
        members: [user._id, targetUser._id]
      });
      await family.save();

      // Update familyId for both users
      user.familyId = family._id;
      await user.save();

      targetUser.familyId = family._id;
      await targetUser.save();
    } else {
      // Add member to the existing family group
      family = await Family.findById(user.familyId);
      if (!family) {
        return res.status(404).json({ error: "Your family group was not found." });
      }

      if (family.members.includes(targetUser._id)) {
        return res.status(400).json({ error: "User is already a member of your family." });
      }

      family.members.push(targetUser._id);
      await family.save();

      targetUser.familyId = family._id;
      await targetUser.save();
    }

    res.json({
      message: "User added to family successfully",
      family
    });
  } catch (error) {
    res.status(500).json({ error: "Error adding member to family.", details: error.message });
  }
});

// DELETE /api/family/members/:memberId - Remove a user from the family
router.delete('/members/:memberId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { memberId } = req.params;
    if (!user.familyId) {
      return res.status(400).json({ error: "You are not part of any family group." });
    }

    const family = await Family.findById(user.familyId);
    if (!family) {
      return res.status(404).json({ error: "Family group not found." });
    }

    // Remove from members array
    const memberIndex = family.members.indexOf(memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member is not in your family group." });
    }

    family.members.splice(memberIndex, 1);
    await family.save();

    // Update target user's familyId
    const targetUser = await User.findById(memberId);
    if (targetUser) {
      targetUser.familyId = undefined;
      await targetUser.save();
    }

    // If family is now empty, delete it
    if (family.members.length === 0) {
      await Family.findByIdAndDelete(family._id);
    }

    res.json({ message: `User ${memberId} removed from family successfully` });
  } catch (error) {
    res.status(500).json({ error: "Error removing member from family.", details: error.message });
  }
});

module.exports = router;
