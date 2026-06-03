const express = require('express');
const router = express.Router();
const User = require('../models/User');
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

// POST /api/expenses - Add expense (personal or shared)
router.post('/', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { description, amount, category, type } = req.body;

    if (!description || amount === undefined || !category) {
      return res.status(400).json({ error: "description, amount, and category are required." });
    }

    const expenseType = type || 'personal';

    let familyId = undefined;
    if (expenseType === 'shared') {
      if (!user.familyId) {
        return res.status(400).json({ error: "You must belong to a family group to add a shared expense." });
      }
      familyId = user.familyId;
    }

    const newExpense = new Expense({
      description,
      amount,
      category,
      type: expenseType,
      userId: user._id,
      familyId
    });

    await newExpense.save();
    res.status(201).json({ message: "Expense added successfully", expense: newExpense });
  } catch (error) {
    res.status(500).json({ error: "Error adding expense.", details: error.message });
  }
});

// GET /api/expenses - List expenses (supports optional type filter: personal/shared)
router.get('/', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { type } = req.query;

    let query = {};
    if (type === 'personal') {
      query = { userId: user._id, type: 'personal' };
    } else if (type === 'shared') {
      if (!user.familyId) {
        return res.json({ message: "You are not part of a family group.", expenses: [] });
      }
      query = { familyId: user.familyId, type: 'shared' };
    } else {
      // Return personal expenses OR shared family expenses
      const orConditions = [{ userId: user._id, type: 'personal' }];
      if (user.familyId) {
        orConditions.push({ familyId: user.familyId, type: 'shared' });
      }
      query = { $or: orConditions };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json({ message: "Expenses fetched successfully", expenses });
  } catch (error) {
    res.status(500).json({ error: "Error fetching expenses.", details: error.message });
  }
});

// GET /api/expenses/search - Search expenses
router.get('/search', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const searchString = req.query.q || req.query.query || '';
    if (!searchString) {
      return res.status(400).json({ error: "Search query 'q' or 'query' parameter is required." });
    }

    // Filter to ensure search returns only accessible expenses
    const accessFilter = [{ userId: user._id, type: 'personal' }];
    if (user.familyId) {
      accessFilter.push({ familyId: user.familyId, type: 'shared' });
    }

    const searchRegex = new RegExp(searchString, 'i');
    const query = {
      $and: [
        { $or: accessFilter },
        {
          $or: [
            { description: searchRegex },
            { category: searchRegex }
          ]
        }
      ]
    };

    const results = await Expense.find(query).sort({ date: -1 });
    res.json({ message: `Search results fetched successfully for query: ${searchString}`, results });
  } catch (error) {
    res.status(500).json({ error: "Error searching expenses.", details: error.message });
  }
});

// PUT /api/expenses/:id - Update an expense
router.put('/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ error: "Expense not found." });
    }

    // Authorization: User can update if it is their personal expense,
    // or if it's shared and they are in the family group that owns it.
    const isOwner = expense.userId.toString() === user._id.toString();
    const isInFamily = expense.familyId && user.familyId && expense.familyId.toString() === user.familyId.toString();

    if (!isOwner && !isInFamily) {
      return res.status(403).json({ error: "Forbidden. You do not have permission to update this expense." });
    }

    const { description, amount, category, type } = req.body;
    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;
    if (category !== undefined) expense.category = category;
    if (type !== undefined) {
      if (type === 'shared') {
        if (!user.familyId) {
          return res.status(400).json({ error: "Cannot convert to shared expense without a family group." });
        }
        expense.familyId = user.familyId;
        expense.type = 'shared';
      } else {
        expense.familyId = undefined;
        expense.type = 'personal';
      }
    }

    await expense.save();
    res.json({ message: "Expense updated successfully", expense });
  } catch (error) {
    res.status(500).json({ error: "Error updating expense.", details: error.message });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ error: "Expense not found." });
    }

    const isOwner = expense.userId.toString() === user._id.toString();
    const isInFamily = expense.familyId && user.familyId && expense.familyId.toString() === user.familyId.toString();

    if (!isOwner && !isInFamily) {
      return res.status(403).json({ error: "Forbidden. You do not have permission to delete this expense." });
    }

    await Expense.findByIdAndDelete(id);
    res.json({ message: `Expense ${id} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: "Error deleting expense.", details: error.message });
  }
});

module.exports = router;
