const router = require('express').Router();
const mongoose = require('mongoose');

// GET /api/health - quick check that the server and database are up.
router.get('/', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    status: 'ok',
    database: states[mongoose.connection.readyState] || 'unknown',
    time: new Date().toISOString(),
  });
});

module.exports = router;
