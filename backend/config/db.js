const mongoose = require('mongoose');
const { mongoUri, isProd } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  // In production, build indexes via a migration instead of at boot.
  await mongoose.connect(mongoUri, { autoIndex: !isProd });
  require('../models'); // make sure every model (and its indexes) is registered
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
