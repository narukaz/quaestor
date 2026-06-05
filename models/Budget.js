const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  type: { type: String, enum: ['personal', 'shared'], default: 'personal' },
  limit: { type: Number, required: true },
  month: { type: Number, required: true }, // 1–12
  year: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
  category: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);
