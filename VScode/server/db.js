const mongoose = require('mongoose');

async function connectToMongoDB() {
  let retryDelayMs = 1000;
  const maxRetryDelayMs = 30000;

  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error(
        `MongoDB connection failed (${error.name}). Retrying in ${Math.round(retryDelayMs / 1000)} seconds.`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, maxRetryDelayMs);
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Mongoose will attempt to reconnect.');
});

module.exports = { connectToMongoDB };
