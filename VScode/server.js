require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

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
  }
}, { timestamps: true });

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

app.get('/api/health', (_request, response) => {
  const databaseStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  response.json({
    status: 'ok',
    database: databaseStates[mongoose.connection.readyState] || 'unknown'
  });
});

app.get('/api/food-items', async (request, response) => {
  const { type } = request.query;
  if (!['food-item', 'recipe'].includes(type)) {
    return response.status(400).json({ error: 'Choose either recipe or food-item.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({ error: 'The database is not connected. Please try again later.' });
  }

  try {
    const items = await FoodItem.find({ type }).sort({ createdAt: -1 }).limit(3).lean();
    const results = items.map((item) => {
      const savedItem = {
        id: item.id,
        type: item.type,
        name: item.name
      };

      if (item.type === 'food-item') {
        Object.assign(savedItem, {
          kcal_100g: item.kcal_100g,
          protein_100g: item.protein_100g,
          fat_100g: item.fat_100g,
          carbohydrates_100g: item.carbohydrates_100g
        });
      } else {
        Object.assign(savedItem, {
          ...(item.description ? { description: item.description } : {}),
          cooking_steps: item.cooking_steps,
          amount_portions: item.amount_portions,
          caloryperportion: item.caloryperportion
        });
      }

      return savedItem;
    });

    return response.json({ items: results });
  } catch (error) {
    console.error(`Food item lookup failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to load menu items. Please try again.' });
  }
});

app.post('/api/food-items', async (request, response) => {
  const body = request.body || {};
  const { type, name } = body;
  const validTypes = ['food-item', 'recipe'];
  const validNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const validName = typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 100;
  const validFoodItem = ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g']
    .every((field) => validNumber(body[field]) && body[field] >= 0);
  const validRecipe = typeof body.cooking_steps === 'string' &&
    body.cooking_steps.trim().length > 0 &&
    Number.isInteger(body.amount_portions) &&
    body.amount_portions > 0 &&
    validNumber(body.caloryperportion) &&
    body.caloryperportion >= 0 &&
    (body.description === undefined ||
      (typeof body.description === 'string' && body.description.length <= 2000));

  if (!validTypes.includes(type) || !validName ||
    (type === 'food-item' && !validFoodItem) ||
    (type === 'recipe' && !validRecipe)) {
    return response.status(400).json({ error: 'Please provide valid values for all required fields.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({ error: 'The database is not connected. Please try again later.' });
  }

  try {
    const data = type === 'food-item'
      ? {
          type,
          name: name.trim(),
          kcal_100g: body.kcal_100g,
          protein_100g: body.protein_100g,
          fat_100g: body.fat_100g,
          carbohydrates_100g: body.carbohydrates_100g
        }
      : {
          type,
          name: name.trim(),
          ...(body.description?.trim() ? { description: body.description.trim() } : {}),
          cooking_steps: body.cooking_steps.trim(),
          amount_portions: body.amount_portions,
          caloryperportion: body.caloryperportion
        };
    const item = await FoodItem.create(data);
    const savedItem = item.toObject({ versionKey: false });
    delete savedItem._id;
    return response.status(201).json({ item: savedItem });
  } catch (error) {
    console.error(`Food item save failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to save this item. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

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

if (process.env.MONGODB_URI) {
  connectToMongoDB();
} else {
  console.warn('MONGODB_URI is not set; starting without a database connection.');
}
