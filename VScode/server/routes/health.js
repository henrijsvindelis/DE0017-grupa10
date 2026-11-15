const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/api/health', (_request, response) => {
  const databaseStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  response.json({
    status: 'ok',
    database: databaseStates[mongoose.connection.readyState] || 'unknown'
  });
});

module.exports = router;
