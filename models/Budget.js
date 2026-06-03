const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  type: { type: String, enum: ['personal', 'shared'], default: 'personal' },
  limit: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
  category: { type: String } // Optional category specific budget
});

module.exports = mongoose.model('Budget', budgetSchema);
