const mongoose = require('mongoose');

const initDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://root:rootpassword@localhost:27017/taskdb?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
};

module.exports = { initDB };
