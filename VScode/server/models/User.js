const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, maxlength: 254 },
  username: { type: String, required: true, minlength: 2, maxlength: 30 },
  usernameKey: { type: String, required: true, unique: true, select: false },
  age: { type: Number, min: 1, max: 120, validate: (value) => value == null || Number.isInteger(value) },
  sex: { type: String, enum: ['female', 'male'] },
  height: { type: Number, min: 30, max: 300 },
  weight: { type: Number, min: 1, max: 500 },
  activityLevel: { type: String, enum: ['sedentary', 'lightly-active', 'moderately-active', 'very-active', 'extra-active'] },
  goal: { type: String, enum: ['lose', 'gain', 'maintain'] },
  dailyKcalGoal: { type: Number, min: 500, max: 10000, validate: (value) => value == null || Number.isInteger(value) },
  diet: { type: String, enum: ['standard', 'vegetarian'], default: 'standard' },
  passwordSalt: { type: String, required: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['Admin', 'Nutritionist', 'User'], default: 'User', required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
