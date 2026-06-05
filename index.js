const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quaestor';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB at', mongoURI))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// CORS — allow Vite dev server
app.use(cors({
  origin: ['https://quaestor-face.vercel.app/'],
  credentials: true
}));

// Middleware to parse JSON payloads
app.use(express.json());

// Import router modules
const authRouter = require('./routes/auth');
const familyRouter = require('./routes/family');
const expensesRouter = require('./routes/expenses');
const budgetsRouter = require('./routes/budgets');
const bankRouter = require('./routes/bank');
const notificationsRouter = require('./routes/notifications');

// Register API routes
app.use('/api/auth', authRouter);
app.use('/api/family', familyRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/bank', bankRouter);
app.use('/api/notifications', notificationsRouter);

app.get('/health', (req, res) => {
  res.send('Healthy');
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
