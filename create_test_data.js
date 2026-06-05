require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Family = require('./models/Family');
const Expense = require('./models/Expense');
const Notification = require('./models/Notification');

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quaestor';

async function main() {
  console.log('Connecting to database:', mongoURI);
  await mongoose.connect(mongoURI);
  console.log('Connected.');

  // Emails of test users
  const emails = ['one@gmail.com', 'two@gmail.com', 'three@gmail.com'];

  // Delete existing data to start clean
  console.log('Cleaning up existing test data...');
  const existingUsers = await User.find({ email: { $in: emails } });
  const userIds = existingUsers.map(u => u._id);
  
  await Expense.deleteMany({ userId: { $in: userIds } });
  await Notification.deleteMany({ userId: { $in: userIds } });
  await Family.deleteMany({ createdBy: { $in: userIds } });
  await User.deleteMany({ email: { $in: emails } });

  console.log('Creating test users...');
  const passwordHash = await bcrypt.hash('password', 12);

  const user1 = new User({
    name: 'one',
    username: 'one',
    email: 'one@gmail.com',
    password: passwordHash
  });

  const user2 = new User({
    name: 'two',
    username: 'two',
    email: 'two@gmail.com',
    password: passwordHash
  });

  const user3 = new User({
    name: 'three',
    username: 'three',
    email: 'three@gmail.com',
    password: passwordHash
  });

  await user1.save();
  await user2.save();
  await user3.save();

  console.log('Creating family...');
  const family = new Family({
    name: 'Test Family Group',
    createdBy: user1._id,
    members: [user1._id, user2._id, user3._id],
    pendingInvites: [
      { userId: user2._id, invitedBy: user1._id, status: 'accepted' },
      { userId: user3._id, invitedBy: user1._id, status: 'accepted' }
    ]
  });
  await family.save();

  // Update users familyId
  user1.familyId = family._id;
  user2.familyId = family._id;
  user3.familyId = family._id;

  await user1.save();
  await user2.save();
  await user3.save();

  console.log('Creating transactions...');
  const expenses = [
    // User 1's expenses
    new Expense({
      description: 'Lunch Outing',
      amount: 12.50,
      category: 'Food',
      type: 'personal',
      userId: user1._id,
      date: new Date(Date.now() - 3600000 * 3) // 3 hours ago
    }),
    new Expense({
      description: 'Electricity Bill',
      amount: 90.00,
      category: 'Utilities',
      type: 'shared',
      userId: user1._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 24) // 1 day ago
    }),
    
    // User 2's expenses
    new Expense({
      description: 'Book Store',
      amount: 18.00,
      category: 'Entertainment',
      type: 'personal',
      userId: user2._id,
      date: new Date(Date.now() - 3600000 * 6) // 6 hours ago
    }),
    new Expense({
      description: 'Weekly Groceries',
      amount: 65.00,
      category: 'Food',
      type: 'shared',
      userId: user2._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 48) // 2 days ago
    }),

    // User 3's expenses
    new Expense({
      description: 'Morning Coffee',
      amount: 5.00,
      category: 'Food',
      type: 'personal',
      userId: user3._id,
      date: new Date(Date.now() - 3600000 * 12) // 12 hours ago
    }),
    new Expense({
      description: 'Shared Wi-Fi Plan',
      amount: 45.00,
      category: 'Utilities',
      type: 'shared',
      userId: user3._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 72) // 3 days ago
    })
  ];

  for (const exp of expenses) {
    await exp.save();
  }

  console.log('Creating notifications for family actions...');
  await Notification.create({
    userId: user1._id,
    type: 'family_accepted',
    message: 'two accepted your invitation and joined the "Test Family Group"!',
    relatedId: family._id,
    read: true
  });
  await Notification.create({
    userId: user1._id,
    type: 'family_accepted',
    message: 'three accepted your invitation and joined the "Test Family Group"!',
    relatedId: family._id,
    read: true
  });

  console.log('Done!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
