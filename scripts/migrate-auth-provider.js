/**
 * One-time migration: set authProvider to 'email' for existing users missing the field.
 * Run after deploying SSO backend: npm run migrate:auth-provider
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  console.log(`MongoDB Connected: ${mongoose.connection.host}`);
};

const migrate = async () => {
  const result = await User.updateMany(
    { $or: [{ authProvider: { $exists: false } }, { authProvider: null }] },
    { $set: { authProvider: 'email' } }
  );
  console.log('Migration complete.');
  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
};

connectDB()
  .then(migrate)
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    mongoose.disconnect().finally(() => process.exit(1));
  });
