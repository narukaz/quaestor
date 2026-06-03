const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

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

// POST /api/budgets - Set or update budget limit (personal or shared)
router.post('/', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { limit, type, category } = req.body;

    if (limit === undefined || limit < 0) {
      return res.status(400).json({ error: "A positive limit is required." });
    }

    const budgetType = type || 'personal';
    let familyId = undefined;

    if (budgetType === 'shared') {
      if (!user.familyId) {
        return res.status(400).json({ error: "You must belong to a family group to set a shared budget." });
      }
      familyId = user.familyId;
    }

    // Try to find existing budget of this type/category
    let query = { type: budgetType };
    if (budgetType === 'personal') {
      query.userId = user._id;
    } else {
      query.familyId = user.familyId;
    }
    if (category) {
      query.category = category;
    } else {
      // Find one without a specific category
      query.category = { $exists: false };
    }

    let budget = await Budget.findOne(query);

    if (budget) {
      // Update existing limit
      budget.limit = limit;
      await budget.save();
    } else {
      // Create new budget
      budget = new Budget({
        type: budgetType,
        limit,
        userId: budgetType === 'personal' ? user._id : undefined,
        familyId: budgetType === 'shared' ? user.familyId : undefined,
        category
      });
      await budget.save();
    }

    res.json({ message: "Budget limit configured successfully", budget });
  } catch (error) {
    res.status(500).json({ error: "Error setting budget limit.", details: error.message });
  }
});

// GET /api/budgets/tracking - Fetch budget status, tracking, and remaining balance
router.get('/tracking', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    // 1. Calculate Personal Spending
    const personalExpenses = await Expense.find({ userId: user._id, type: 'personal' });
    const personalSpent = personalExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const personalBudget = await Budget.findOne({ userId: user._id, type: 'personal', category: { $exists: false } });
    const personalLimit = personalBudget ? personalBudget.limit : 0;

    const personalTracking = {
      limit: personalLimit,
      spent: personalSpent,
      remaining: personalLimit ? Math.max(0, personalLimit - personalSpent) : 0,
      overLimit: personalLimit ? personalSpent > personalLimit : false
    };

    // 2. Calculate Shared Spending
    let sharedTracking = null;
    if (user.familyId) {
      const sharedExpenses = await Expense.find({ familyId: user.familyId, type: 'shared' });
      const sharedSpent = sharedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      const sharedBudget = await Budget.findOne({ familyId: user.familyId, type: 'shared', category: { $exists: false } });
      const sharedLimit = sharedBudget ? sharedBudget.limit : 0;

      sharedTracking = {
        limit: sharedLimit,
        spent: sharedSpent,
        remaining: sharedLimit ? Math.max(0, sharedLimit - sharedSpent) : 0,
        overLimit: sharedLimit ? sharedSpent > sharedLimit : false
      };
    }

    res.json({
      message: "Budget tracking status fetched successfully",
      tracking: {
        personal: personalTracking,
        shared: sharedTracking
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error tracking budgets.", details: error.message });
  }
});

module.exports = router;
