const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
