require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quaestor';
console.log(`Connecting to MongoDB using URI: ${mongoURI}`);
mongoose.connect(mongoURI)
  .then(() => {
    console.log(`[SUCCESS] Connected to MongoDB at: ${mongoURI}`);
  })
  .catch(err => {
    console.error(`[FAILURE] MongoDB connection failed for: ${mongoURI}`);
    console.error(`Error details: ${err.message}`);
  });

// CORS — allow Vite dev server and production deployments with credentials
app.use(cors({
  origin: true, // Dynamically reflects request origin to allow credentials
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

app.get('/dbhealth', async (req, res) => {
  try {
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };

    if (readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        database: states[readyState] || 'Unknown',
        message: 'Database is not connected.'
      });
    }

    // Ping the admin DB to verify active communication
    await mongoose.connection.db.admin().ping();

    res.json({
      status: 'ok',
      database: 'Connected',
      message: 'Database is up and running.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'Error',
      message: 'Failed to communicate with database.',
      details: error.message
    });
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
