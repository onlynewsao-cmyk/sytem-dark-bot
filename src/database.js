const mongoose = require('mongoose');
const config = require('./config');

async function connectDB() {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI não foi configurado. Configure MongoDB Atlas antes de iniciar.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 10
  });

  console.log('[MongoDB] conectado');
  return mongoose.connection;
}

module.exports = { connectDB, mongoose };
