const crypto = require('crypto');
const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID()
  },
  type: {
    type: String,
    enum: ['food-item', 'recipe'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  kcal_100g: {
    type: Number,
    min: 0,
    required: function () { return this.type === 'food-item'; }
  },
  protein_100g: {
    type: Number,
    min: 0,
    required: function () { return this.type === 'food-item'; }
  },
  fat_100g: {
    type: Number,
    min: 0,
    required: function () { return this.type === 'food-item'; }
  },
  carbohydrates_100g: {
    type: Number,
    min: 0,
    required: function () { return this.type === 'food-item'; }
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  cooking_steps: {
    type: String,
    trim: true,
    required: function () { return this.type === 'recipe'; }
  },
  amount_portions: {
    type: Number,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Amount of portions must be a whole number.'
    },
    required: function () { return this.type === 'recipe'; }
  },
  caloryperportion: {
    type: Number,
    min: 0,
    required: function () { return this.type === 'recipe'; }
  },
  // Unikālo lietotāju skaits, kuri recepti saglabājuši savā ēdienkartē (= savedBy.length)
  saves: {
    type: Number,
    default: 0,
    min: 0
  },
  // Lietotāji, kuri recepti saglabājuši; privāts lauks, API atbildēs netiek rādīts
  savedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    select: false
  },
  // Receptes sastāvdaļu produktu id (no saglabātās ēdienkartes); vajadzīgs veģetāro recepšu filtram
  ingredientIds: {
    type: [String],
    default: undefined
  },
  source: {
    type: String,
    enum: ['user', 'ai'],
    default: 'user'
  },
  // Admin/Nutritionist pievienotie produkti ir pārbaudīti; lietotāju pievienotie – nē, līdz tos pārbauda
  verified: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Neobligātie produkta lauki no seed/products.json
  category: {
    type: String,
    trim: true,
    maxlength: 50
  },
  vegetarian: Boolean,
  // Vitamīni un minerālvielas mg uz 100 g, piem. { A: 0, B1: 0.6, C: 0 } un { Ca: 75, P: 327, Fe: 4.3 }
  vitamins: {
    type: Map,
    of: Number,
    default: undefined
  },
  minerals: {
    type: Map,
    of: Number,
    default: undefined
  },
  price_eur_per_kg: {
    type: Number,
    min: 0
  }
}, { timestamps: true });

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

module.exports = FoodItem;
