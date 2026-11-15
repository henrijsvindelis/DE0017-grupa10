const mongoose = require('mongoose');

const mealPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const MealPlan = mongoose.model('MealPlan', mealPlanSchema);

module.exports = MealPlan;
