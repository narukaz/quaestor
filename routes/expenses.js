const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Family = require('../models/Family');
const { authMiddleware } = require('../middleware/auth');

// All routes require auth
router.use(authMiddleware);

// POST /api/expenses - Add expense (personal or shared)
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { description, amount, category, type } = req.body;

    if (!description || amount === undefined || !category) {
      return res.status(400).json({ error: 'description, amount, and category are required.' });
    }

    const expenseType = type || 'personal';

    let familyId = undefined;
    if (expenseType === 'shared') {
      if (!user.familyId) {
        return res.status(400).json({ error: 'You must belong to a family group to add a shared expense.' });
      }
      const familyExists = await Family.exists({ _id: user.familyId });
      if (!familyExists) {
        user.familyId = undefined;
        await user.save();
        return res.status(400).json({ error: 'You must belong to a family group to add a shared expense.' });
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
    res.status(201).json({ message: 'Expense added successfully', expense: newExpense });
  } catch (error) {
    res.status(500).json({ error: 'Error adding expense.', details: error.message });
  }
});

// GET /api/expenses - List expenses (supports optional type filter: personal/shared)
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const { type } = req.query;

    let query = {};
    if (type === 'personal') {
      query = { userId: user._id, type: 'personal' };
    } else if (type === 'shared') {
      if (!user.familyId) {
        return res.json({ message: 'You are not part of a family group.', expenses: [] });
      }
      const familyExists = await Family.exists({ _id: user.familyId });
      if (!familyExists) {
        user.familyId = undefined;
        await user.save();
        return res.json({ message: 'You are not part of a family group.', expenses: [] });
      }
      query = { familyId: user.familyId, type: 'shared' };
    } else {
      const orConditions = [{ userId: user._id, type: 'personal' }];
      if (user.familyId) {
        const familyExists = await Family.exists({ _id: user.familyId });
        if (!familyExists) {
          user.familyId = undefined;
          await user.save();
        } else {
          orConditions.push({ familyId: user.familyId, type: 'shared' });
        }
      }
      query = { $or: orConditions };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json({ message: 'Expenses fetched successfully', expenses });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching expenses.', details: error.message });
  }
});

// GET /api/expenses/search - Search expenses
router.get('/search', async (req, res) => {
  try {
    const user = req.user;
    const searchString = req.query.q || req.query.query || '';
    if (!searchString) {
      return res.status(400).json({ error: "Search query 'q' or 'query' parameter is required." });
    }

    const accessFilter = [{ userId: user._id, type: 'personal' }];
    if (user.familyId) {
      accessFilter.push({ familyId: user.familyId, type: 'shared' });
    }

    const searchRegex = new RegExp(searchString, 'i');
    const query = {
      $and: [
        { $or: accessFilter },
        { $or: [{ description: searchRegex }, { category: searchRegex }] }
      ]
    };

    const results = await Expense.find(query).sort({ date: -1 });
    res.json({ message: `Search results for: ${searchString}`, results });
  } catch (error) {
    res.status(500).json({ error: 'Error searching expenses.', details: error.message });
  }
});

// PUT /api/expenses/:id - Update an expense
router.put('/:id', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const isOwner = expense.userId.toString() === user._id.toString();
    const isInFamily = expense.familyId && user.familyId &&
      expense.familyId.toString() === user.familyId.toString();

    if (!isOwner && !isInFamily) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to update this expense.' });
    }

    const { description, amount, category, type } = req.body;
    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;
    if (category !== undefined) expense.category = category;
    if (type !== undefined) {
      if (type === 'shared') {
        if (!user.familyId) {
          return res.status(400).json({ error: 'Cannot convert to shared expense without a family group.' });
        }
        expense.familyId = user.familyId;
        expense.type = 'shared';
      } else {
        expense.familyId = undefined;
        expense.type = 'personal';
      }
    }

    await expense.save();
    res.json({ message: 'Expense updated successfully', expense });
  } catch (error) {
    res.status(500).json({ error: 'Error updating expense.', details: error.message });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const isOwner = expense.userId.toString() === user._id.toString();
    const isInFamily = expense.familyId && user.familyId &&
      expense.familyId.toString() === user.familyId.toString();

    if (!isOwner && !isInFamily) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to delete this expense.' });
    }

    await Expense.findByIdAndDelete(id);
    res.json({ message: `Expense deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting expense.', details: error.message });
  }
});

module.exports = router;
