const express = require('express');
const router = express.Router();

// POST /api/bank/webhook - Process transaction data sent by bank
// Expects: { name: String, type: String, amount: Number }
router.post('/webhook', (req, res) => {
  const { name, type, amount } = req.body;
  
  if (!name || !type || amount === undefined) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Required fields name, type, and amount are missing or invalid."
    });
  }

  res.json({
    message: "Bank transaction processed successfully",
    processedData: {
      name,
      type,
      amount,
      processedAt: new Date().toISOString()
    }
  });
});

module.exports = router;
