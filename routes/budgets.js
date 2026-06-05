const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Helper: is a budget still editable (same month+year as now)?
function isEditable(budget) {
  const now = new Date();
  return budget.month === now.getMonth() + 1 && budget.year === now.getFullYear();
}

// GET /api/budgets — get current month's budget(s) for the user
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const budgets = await Budget.find({
      $or: [
        { userId: req.user._id },
        ...(req.user.familyId ? [{ familyId: req.user.familyId }] : [])
      ],
      month,
      year
    });

    res.json({
      budgets: budgets.map(b => ({
        ...b.toObject(),
        editable: isEditable(b)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/all — get all budgets (history)
router.get('/all', async (req, res) => {
  try {
    const budgets = await Budget.find({
      $or: [
        { userId: req.user._id },
        ...(req.user.familyId ? [{ familyId: req.user.familyId }] : [])
      ]
    }).sort({ year: -1, month: -1 });

    res.json({
      budgets: budgets.map(b => ({
        ...b.toObject(),
        editable: isEditable(b)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets — set/update budget for current month
router.post('/', async (req, res) => {
  try {
    const { limit, type = 'personal', category } = req.body;
    if (!limit || isNaN(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ error: 'A valid positive budget limit is required.' });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Look for existing budget this month
    const query = {
      type,
      month,
      year,
      ...(category ? { category } : {}),
      ...(type === 'shared' ? { familyId: req.user.familyId } : { userId: req.user._id })
    };

    let budget = await Budget.findOne(query);
    if (budget) {
      // Can only edit if same month+year (i.e., current month)
      if (!isEditable(budget)) {
        return res.status(403).json({ error: 'Budget for a past month cannot be changed.' });
      }
      budget.limit = Number(limit);
      await budget.save();
      return res.json({ budget: { ...budget.toObject(), editable: true }, updated: true });
    }

    // Create new budget for this month
    budget = new Budget({
      limit: Number(limit),
      type,
      month,
      year,
      category: category || undefined,
      ...(type === 'shared' ? { familyId: req.user.familyId } : { userId: req.user._id })
    });
    await budget.save();

    res.status(201).json({ budget: { ...budget.toObject(), editable: true }, created: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/budgets/:id — edit existing budget (only if still current month)
router.patch('/:id', async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found.' });

    if (!isEditable(budget)) {
      return res.status(403).json({ error: 'Budget for a past month cannot be changed.' });
    }

    const { limit } = req.body;
    if (limit !== undefined) budget.limit = Number(limit);
    await budget.save();

    res.json({ budget: { ...budget.toObject(), editable: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
