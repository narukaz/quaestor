const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['family_invite', 'family_accepted', 'family_rejected', 'expense', 'general'],
    required: true
  },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId }, // e.g. invite ID or expense ID
  read: { type: Boolean, default: false },
  // For family_invite notifications, store extra data for accept/reject
  inviteData: {
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
    inviteId: { type: String }, // subdoc _id as string
    invitedByName: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
