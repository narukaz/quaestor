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
  const emails = ['john@quaestor.app', 'mary@quaestor.app', 'david@quaestor.app'];

  // Delete existing data to start clean
  console.log('Cleaning up existing test data...');
  const existingUsers = await User.find({ email: { $in: emails } });
  const userIds = existingUsers.map(u => u._id);
  
  await Expense.deleteMany({ userId: { $in: userIds } });
  await Notification.deleteMany({ userId: { $in: userIds } });
  await Family.deleteMany({ createdBy: { $in: userIds } });
  await User.deleteMany({ email: { $in: emails } });

  console.log('Creating test users...');
  const passwordHash = await bcrypt.hash('password123', 12);

  const john = new User({
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@quaestor.app',
    password: passwordHash
  });

  const mary = new User({
    name: 'Mary Smith',
    username: 'marysmith',
    email: 'mary@quaestor.app',
    password: passwordHash
  });

  const david = new User({
    name: 'David Jones',
    username: 'davidjones',
    email: 'david@quaestor.app',
    password: passwordHash
  });

  await john.save();
  await mary.save();
  await david.save();

  console.log('Creating family...');
  const family = new Family({
    name: 'Doe & Friends Family',
    createdBy: john._id,
    members: [john._id, mary._id, david._id],
    pendingInvites: [
      { userId: mary._id, invitedBy: john._id, status: 'accepted' },
      { userId: david._id, invitedBy: john._id, status: 'accepted' }
    ]
  });
  await family.save();

  // Update users familyId
  john.familyId = family._id;
  mary.familyId = family._id;
  david.familyId = family._id;

  await john.save();
  await mary.save();
  await david.save();

  console.log('Creating transactions...');
  const expenses = [
    // John's expenses
    new Expense({
      description: 'Coffee & Donut',
      amount: 6.50,
      category: 'Food',
      type: 'personal',
      userId: john._id,
      date: new Date(Date.now() - 3600000 * 2) // 2 hours ago
    }),
    new Expense({
      description: 'Weekly Groceries',
      amount: 84.20,
      category: 'Food',
      type: 'shared',
      userId: john._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 24) // 1 day ago
    }),
    
    // Mary's expenses
    new Expense({
      description: 'Book purchase',
      amount: 14.99,
      category: 'Entertainment',
      type: 'personal',
      userId: mary._id,
      date: new Date(Date.now() - 3600000 * 5) // 5 hours ago
    }),
    new Expense({
      description: 'Netflix subscription',
      amount: 19.99,
      category: 'Entertainment',
      type: 'shared',
      userId: mary._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 48) // 2 days ago
    }),

    // David's expenses
    new Expense({
      description: 'Gym Membership',
      amount: 45.00,
      category: 'Health',
      type: 'personal',
      userId: david._id,
      date: new Date(Date.now() - 3600000 * 12) // 12 hours ago
    }),
    new Expense({
      description: 'Electricity Bill',
      amount: 120.50,
      category: 'Utilities',
      type: 'shared',
      userId: david._id,
      familyId: family._id,
      date: new Date(Date.now() - 3600000 * 72) // 3 days ago
    })
  ];

  for (const exp of expenses) {
    await exp.save();
  }

  console.log('Creating notifications for family actions...');
  await Notification.create({
    userId: john._id,
    type: 'family_accepted',
    message: 'Mary Smith accepted your invitation and joined the "Doe & Friends Family" family!',
    relatedId: family._id,
    read: true
  });
  await Notification.create({
    userId: john._id,
    type: 'family_accepted',
    message: 'David Jones accepted your invitation and joined the "Doe & Friends Family" family!',
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
