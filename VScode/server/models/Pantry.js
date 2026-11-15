const mongoose = require('mongoose');

const pantrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  foodItemId: { type: String, required: true },
  grams: { type: Number, required: true, min: 1, max: 100000 },
  // Lietotāja paša uzturvērtība (no iepakojuma); ja nav norādīta, izmanto produkta datubāzes vērtības
  kcal_100g: { type: Number, min: 0 },
  protein_100g: { type: Number, min: 0 },
  fat_100g: { type: Number, min: 0 },
  carbohydrates_100g: { type: Number, min: 0 }
}, { timestamps: true });
pantrySchema.index({ user: 1, foodItemId: 1 }, { unique: true });

const Pantry = mongoose.model('Pantry', pantrySchema);

module.exports = Pantry;
