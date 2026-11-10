require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { promisify } = require('util');

const app = express();
const port = process.env.PORT || 3000;
const scrypt = promisify(crypto.scrypt);
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, maxlength: 254 },
  username: { type: String, required: true, minlength: 2, maxlength: 30 },
  usernameKey: { type: String, required: true, unique: true, select: false },
  age: { type: Number, min: 1, max: 120, validate: Number.isInteger },
  sex: { type: String, enum: ['female', 'male'] },
  height: { type: Number, min: 30, max: 300 },
  weight: { type: Number, min: 1, max: 500 },
  activityLevel: { type: String, enum: ['sedentary', 'lightly-active', 'moderately-active', 'very-active', 'extra-active'] },
  goal: { type: String, enum: ['lose', 'gain', 'maintain'] },
  dailyKcalGoal: { type: Number, min: 500, max: 10000, validate: Number.isInteger },
  passwordSalt: { type: String, required: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['Admin', 'Nutritionist', 'User'], default: 'User', required: true }
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);

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
  saves: {
    type: Number,
    default: 0,
    min: 0
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
  }
}, { timestamps: true });

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

function databaseUnavailable(response) {
  return response.status(503).json({ error: 'The database is not connected. Please try again later.' });
}

function sessionCookie(token, maxAgeMs = sessionDurationMs) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

function readSessionToken(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('session='));
  return cookie ? cookie.slice('session='.length) : '';
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    age: user.age,
    sex: user.sex,
    height: user.height,
    weight: user.weight,
    activityLevel: user.activityLevel,
    goal: user.goal,
    dailyKcalGoal: user.dailyKcalGoal
  };
}

const numericProfileFields = {
  age: { min: 1, max: 120, integer: true },
  height: { min: 30, max: 300 },
  weight: { min: 1, max: 500 },
  dailyKcalGoal: { min: 500, max: 10000, integer: true }
};
const enumProfileFields = {
  sex: ['female', 'male'],
  activityLevel: ['sedentary', 'lightly-active', 'moderately-active', 'very-active', 'extra-active'],
  goal: ['lose', 'gain', 'maintain']
};

function parseProfileFields(input) {
  const values = {};
  for (const [field, { min, max, integer }] of Object.entries(numericProfileFields)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const rawValue = input[field];
    if (rawValue === null || rawValue === '') {
      values[field] = null;
      continue;
    }
    const value = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim() !== '' ? Number(rawValue) : NaN;
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      return { error: `Enter a valid ${field} value.`, values: null };
    }
    values[field] = value;
  }
  for (const [field, allowedValues] of Object.entries(enumProfileFields)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = input[field];
    if (value === null || value === '') {
      values[field] = null;
      continue;
    }
    if (typeof value !== 'string' || !allowedValues.includes(value)) {
      return { error: `Choose a valid ${field}.`, values: null };
    }
    values[field] = value;
  }
  return { error: null, values };
}

async function createSession(user, response) {
  const token = crypto.randomBytes(32).toString('base64url');
  await Session.create({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    user: user._id,
    expiresAt: new Date(Date.now() + sessionDurationMs)
  });
  response.setHeader('Set-Cookie', sessionCookie(token));
}

async function requireUser(request, response, next) {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);

  const token = readSessionToken(request);
  if (!token) return response.status(401).json({ error: 'Please log in to continue.' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
      .populate('user', 'email username role age sex height weight activityLevel goal dailyKcalGoal');
    if (!session?.user) return response.status(401).json({ error: 'Your session has expired. Please log in again.' });
    request.user = session.user;
    request.session = session;
    return next();
  } catch (error) {
    console.error(`Session lookup failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to verify your session. Please try again.' });
  }
}

app.post('/api/auth/register', async (request, response) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);
  const { email, username, password, repeatPassword } = request.body || {};
  const profile = parseProfileFields(request.body || {});
  if (profile.error) return response.status(400).json({ error: profile.error });
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const validEmail = normalizedEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const validUsername = typeof username === 'string' && username.trim().length >= 2 && username.trim().length <= 30;
  const validPassword = typeof password === 'string' && password.length >= 8 && password.length <= 128;

  if (!validEmail || !validUsername || !validPassword || password !== repeatPassword) {
    return response.status(400).json({ error: 'Enter a valid email and username, and matching passwords of at least 8 characters.' });
  }

  try {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex');
    const user = await User.create({
      email: normalizedEmail,
      username: username.trim(),
      usernameKey: username.trim().toLowerCase(),
      ...profile.values,
      passwordSalt,
      passwordHash,
      role: 'User'
    });
    await createSession(user, response);
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'That email or username is already in use.' });
    console.error(`Account registration failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to create your account. Please try again.' });
  }
});

app.post('/api/auth/login', async (request, response) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(response);
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  try {
    const user = await User.findOne({ email }).select('+passwordHash +passwordSalt');
    if (!user || !password || password.length > 128) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const passwordHash = await scrypt(password, user.passwordSalt, 64);
    const storedHash = Buffer.from(user.passwordHash, 'hex');
    if (storedHash.length !== passwordHash.length || !crypto.timingSafeEqual(storedHash, passwordHash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await createSession(user, response);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(`Login failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to log in. Please try again.' });
  }
});

app.get('/api/auth/me', requireUser, (request, response) => {
  return response.json({ user: publicUser(request.user) });
});

app.patch('/api/profile', requireUser, async (request, response) => {
  const profile = parseProfileFields(request.body || {});
  if (profile.error) return response.status(400).json({ error: profile.error });

  try {
    request.user.set(profile.values);
    await request.user.save();
    return response.json({ user: publicUser(request.user) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: 'Enter valid profile details.' });
    }
    console.error(`Profile update failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to save your profile. Please try again.' });
  }
});

app.post('/api/auth/logout', requireUser, async (request, response) => {
  try {
    await request.session.deleteOne();
    response.setHeader('Set-Cookie', sessionCookie('', 0));
    return response.json({ success: true });
  } catch (error) {
    console.error(`Logout failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to log out. Please try again.' });
  }
});

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
    const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 3, 1), 50);
    const sort = request.query.sort === 'popular' ? { saves: -1, createdAt: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      FoodItem.find({ type }).sort(sort).limit(limit).lean(),
      FoodItem.countDocuments({ type })
    ]);
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
          carbohydrates_100g: item.carbohydrates_100g,
          verified: item.verified !== false
        });
      } else {
        Object.assign(savedItem, {
          ...(item.description ? { description: item.description } : {}),
          cooking_steps: item.cooking_steps,
          amount_portions: item.amount_portions,
          caloryperportion: item.caloryperportion,
          saves: item.saves || 0,
          source: item.source || 'user'
        });
      }

      return savedItem;
    });

    return response.json({ items: results, total });
  } catch (error) {
    console.error(`Food item lookup failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to load menu items. Please try again.' });
  }
});

// Pārbauda produkta vai receptes laukus un atgriež saglabājamos datus (vai null, ja nederīgi)
function menuItemData(type, body) {
  const validNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 100) return null;

  if (type === 'food-item') {
    const valid = ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g']
      .every((field) => validNumber(body[field]) && body[field] >= 0);
    if (!valid) return null;
    return {
      name,
      kcal_100g: body.kcal_100g,
      protein_100g: body.protein_100g,
      fat_100g: body.fat_100g,
      carbohydrates_100g: body.carbohydrates_100g
    };
  }

  if (type === 'recipe') {
    const valid = typeof body.cooking_steps === 'string' &&
      body.cooking_steps.trim().length > 0 &&
      Number.isInteger(body.amount_portions) &&
      body.amount_portions > 0 &&
      validNumber(body.caloryperportion) &&
      body.caloryperportion >= 0 &&
      (body.description === undefined ||
        (typeof body.description === 'string' && body.description.length <= 2000));
    if (!valid) return null;
    return {
      name,
      description: body.description?.trim() || '',
      cooking_steps: body.cooking_steps.trim(),
      amount_portions: body.amount_portions,
      caloryperportion: body.caloryperportion
    };
  }

  return null;
}

const isMenuEditor = (user) => user.role === 'Admin' || user.role === 'Nutritionist';

app.post('/api/food-items', requireUser, async (request, response) => {
  const body = request.body || {};
  const { type } = body;
  if (type === 'food-item' && !isMenuEditor(request.user)) {
    return response.status(403).json({ error: 'Only admins and nutritionists can add food items.' });
  }
  if (type === 'recipe' && request.user.role === 'Admin') {
    return response.status(403).json({ error: 'Admins manage the menu. Recipes are added by users and nutritionists.' });
  }

  const data = menuItemData(type, body);
  if (!data) {
    return response.status(400).json({ error: 'Please provide valid values for all required fields.' });
  }

  try {
    const item = await FoodItem.create({ type, ...data, source: 'user', verified: true, createdBy: request.user._id });
    const savedItem = item.toObject({ versionKey: false });
    delete savedItem._id;
    return response.status(201).json({ item: savedItem });
  } catch (error) {
    console.error(`Food item save failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to save this item. Please try again.' });
  }
});

app.patch('/api/food-items/:id', requireUser, async (request, response) => {
  if (!isMenuEditor(request.user)) {
    return response.status(403).json({ error: 'Only admins and nutritionists can edit menu items.' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'Invalid menu item ID.' });
  }

  try {
    const item = await FoodItem.findOne({ id: request.params.id });
    if (!item) return response.status(404).json({ error: 'Menu item not found.' });

    const data = menuItemData(item.type, request.body || {});
    if (!data) {
      return response.status(400).json({ error: 'Please provide valid values for all required fields.' });
    }

    item.set(item.type === 'food-item' ? { ...data, verified: true } : data);
    await item.save();
    const savedItem = item.toObject({ versionKey: false });
    delete savedItem._id;
    return response.json({ item: savedItem });
  } catch (error) {
    console.error(`Menu item update failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to update this menu item. Please try again.' });
  }
});

app.delete('/api/food-items/:id', requireUser, async (request, response) => {
  if (request.user.role !== 'Admin' && request.user.role !== 'Nutritionist') {
    return response.status(403).json({ error: 'Only admins and nutritionists can delete menu items.' });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'Invalid menu item ID.' });
  }

  try {
    const item = await FoodItem.findOneAndDelete({ id: request.params.id });
    if (!item) return response.status(404).json({ error: 'Menu item not found.' });
    return response.json({ success: true });
  } catch (error) {
    console.error(`Menu item deletion failed: ${error.message}`);
    return response.status(500).json({ error: 'Unable to delete this menu item. Please try again.' });
  }
});

const asyncRoute = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

const activityFactors = {
  'sedentary': 1.2,
  'lightly-active': 1.375,
  'moderately-active': 1.55,
  'very-active': 1.725,
  'extra-active': 1.9
};
const goalKcalDelta = { lose: -500, maintain: 0, gain: 300 };
const goalProteinPerKg = { lose: 1.8, maintain: 1.4, gain: 1.8 };
const mealShares = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

function calculateNutritionTarget(user) {
  const required = ['age', 'sex', 'height', 'weight', 'activityLevel', 'goal'];
  const missing = required.filter((field) => user[field] === undefined || user[field] === null);
  if (missing.length) return { error: 'Aizpildi profilu: ' + missing.join(', ') };

  
  const bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + (user.sex === 'male' ? 5 : -161);
  const minimum = user.sex === 'male' ? 1500 : 1200;
  const calculated = Math.round(bmr * activityFactors[user.activityLevel] + goalKcalDelta[user.goal]);
  const dailyKcal = user.dailyKcalGoal || Math.max(calculated, minimum);

  const meals = Object.fromEntries(
    Object.entries(mealShares).map(([meal, share]) => [meal, Math.round(dailyKcal * share)])
  );

  return {
    dailyKcal,
    proteinGrams: Math.round(user.weight * goalProteinPerKg[user.goal]),
    goal: user.goal,
    meals,
    source: user.dailyKcalGoal ? 'user' : 'calculated'
  };
}

app.get('/api/nutrition/target', requireUser, (request, response) => {
  const target = calculateNutritionTarget(request.user);
  if (target.error) return response.status(400).json({ error: target.error });
  return response.json(target);
});

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

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.get('/api/products', requireUser, asyncRoute(async (request, response) => {
  const query = String(request.query.q || '').trim().slice(0, 50);
  const filter = { type: 'food-item' };
  if (query) filter.name = { $regex: escapeRegex(query), $options: 'i' };
  const products = await FoodItem.find(filter).sort({ name: 1 }).limit(50).lean();
  return response.json({ products: products.map((p) => ({
    id: p.id, name: p.name, kcal_100g: p.kcal_100g, protein_100g: p.protein_100g,
    fat_100g: p.fat_100g, carbohydrates_100g: p.carbohydrates_100g, verified: p.verified !== false
  })) });
}));

async function loadPantry(userId) {
  const entries = await Pantry.find({ user: userId }).lean();
  const items = await FoodItem.find({ id: { $in: entries.map((e) => e.foodItemId) } }).lean();
  const byId = new Map(items.map((item) => [item.id, item]));
  return entries
    .filter((entry) => byId.has(entry.foodItemId))
    .map((entry) => {
      const item = byId.get(entry.foodItemId);
      return {
        foodItemId: entry.foodItemId, name: item.name, grams: entry.grams,
        kcal_100g: entry.kcal_100g ?? item.kcal_100g,
        protein_100g: entry.protein_100g ?? item.protein_100g,
        fat_100g: entry.fat_100g ?? item.fat_100g,
        carbohydrates_100g: entry.carbohydrates_100g ?? item.carbohydrates_100g,
        ownValues: entry.kcal_100g !== undefined && entry.kcal_100g !== null
      };
    });
}

app.get('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

const nutritionFields = ['kcal_100g', 'protein_100g', 'fat_100g', 'carbohydrates_100g'];

// Pārbauda uzturvērtību no iepakojuma: vai skaitļi ir iespējami un vai kalorijas sakrīt ar makroelementiem
function parseNutrition(input) {
  const values = {};
  for (const field of nutritionFields) {
    const value = Number(input?.[field]);
    if (!Number.isFinite(value) || value < 0) return { error: 'Uzturvērtībai jābūt skaitļiem, kas nav mazāki par 0.' };
    values[field] = Math.round(value * 10) / 10;
  }
  if (values.kcal_100g > 900) return { error: 'Kalorijas uz 100 g nevar būt vairāk par 900.' };
  if (values.protein_100g + values.fat_100g + values.carbohydrates_100g > 101) {
    return { error: 'Olbaltumvielas, tauki un ogļhidrāti kopā nevar pārsniegt 100 g uz 100 g.' };
  }
  const calculated = 4 * values.protein_100g + 4 * values.carbohydrates_100g + 9 * values.fat_100g;
  if (Math.abs(values.kcal_100g - calculated) > Math.max(40, values.kcal_100g * 0.35)) {
    return { error: `Kalorijas (${values.kcal_100g}) nesakrīt ar olbaltumvielām, taukiem un ogļhidrātiem (~${Math.round(calculated)} kcal). Pārbaudi vērtības uz iepakojuma.` };
  }
  return { values };
}

app.post('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  const grams = Number(request.body.grams);
  if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
    return response.status(400).json({ error: 'Daudzumam jābūt no 1 g līdz 100 kg.' });
  }

  let nutrition = null;
  if (request.body.nutrition) {
    const parsed = parseNutrition(request.body.nutrition);
    if (parsed.error) return response.status(400).json({ error: parsed.error });
    nutrition = parsed.values;
  }

  const name = String(request.body.name || '').trim().slice(0, 100);
  let product = null;
  if (request.body.foodItemId) {
    product = await FoodItem.findOne({ id: String(request.body.foodItemId), type: 'food-item' }).lean();
  }
  if (!product && name) {
    product = await FoodItem.findOne({ type: 'food-item', name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).lean();
  }
  if (!product) {
    if (!name) return response.status(400).json({ error: 'Ievadi produkta nosaukumu.' });
    if (!nutrition) return response.status(400).json({ error: 'Jaunam produktam norādi uzturvērtību uz 100 g.' });
    // Jauns nosaukums nonāk kopīgajā datubāzē kā nepārbaudīts produkts
    const created = await FoodItem.create({
      type: 'food-item', name, ...nutrition, verified: false, source: 'user', createdBy: request.user._id
    });
    product = created.toObject();
  }

  const update = nutrition
    ? { $set: { grams: Math.round(grams), ...nutrition } }
    : { $set: { grams: Math.round(grams) }, $unset: Object.fromEntries(nutritionFields.map((f) => [f, 1])) };
  await Pantry.findOneAndUpdate({ user: request.user._id, foodItemId: product.id }, update, { upsert: true });
  return response.status(201).json({ pantry: await loadPantry(request.user._id) });
}));

app.patch('/api/pantry/:foodItemId', requireUser, asyncRoute(async (request, response) => {
  const grams = Number(request.body.grams);
  if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
    return response.status(400).json({ error: 'Daudzumam jābūt no 1 g līdz 100 kg.' });
  }
  const result = await Pantry.updateOne(
    { user: request.user._id, foodItemId: request.params.foodItemId },
    { $set: { grams: Math.round(grams) } }
  );
  if (!result.matchedCount) return response.status(404).json({ error: 'Produkts nav tavā sarakstā.' });
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

app.delete('/api/pantry/:foodItemId', requireUser, asyncRoute(async (request, response) => {
  await Pantry.deleteOne({ user: request.user._id, foodItemId: request.params.foodItemId });
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
const lastGenerationByUser = new Map();

function buildMealPlanPrompt(target, pantry) {
  const products = pantry.map((p) => ({
    id: p.foodItemId, name: p.name, availableGrams: p.grams,
    kcal_100g: p.kcal_100g, protein_100g: p.protein_100g
  }));
  return `Tu esi uztura plānotājs. Izveido vienas dienas ēdienkarti latviešu valodā.
Lietotāja mērķis: ${target.goal} (lose = zaudēt svaru, maintain = noturēt, gain = pieņemties).
Dienas kaloriju mērķis: ${target.dailyKcal} kcal, olbaltumvielas: ~${target.proteinGrams} g.
Ēdienreižu mērķi (kcal): ${JSON.stringify(target.meals)}.

Pieejamie produkti (izmanto TIKAI tos, pēc "id", un kopā ne vairāk par availableGrams katram):
${JSON.stringify(products)}

Noteikumi:
- Galvenais ir reālistiski, ikdienišķi ēdieni, ko cilvēki Latvijā tiešām gatavo. Kaloriju precizitāte ir otrajā vietā.
- Katrā ēdienreizē izmanto parasti 1–3 produktus, kas dabiski sader kopā. Nejauc vienā ēdienā produktus, kurus parasti neēd kopā (piemēram, auzu putru ar griķiem vai vistu).
- Brokastis: vienkāršs brokastu ēdiens, piemēram, auzu putra VAI olu ēdiens (omlete, vārītas olas).
- Pusdienas un vakariņas: olbaltumviela (piemēram, vistas fileja vai olas) + piedeva (piemēram, griķi) + dārzeņi, ja ir.
- Uzkoda: viens vienkāršs, neliels ēdiens.
- Nav jāizmanto visi produkti. Izvēlies tos, kas der katrai ēdienreizei.
- Ja produktu kopā pietiek dienas mērķim, mode = "plan" un aizpildi visas 4 ēdienreizes (breakfast, lunch, dinner, snack).
- Ja produktu nepietiek, mode = "recipes" un piedāvā 1–3 receptes, ko var pagatavot.
- Dienas kopējām kalorijām jābūt aptuveni ±10 % no dienas mērķa. Atsevišķa ēdienreize drīkst atšķirties vairāk, ja tā ēdiens ir dabiskāks.
- Porciju lielumus pielāgo kalorijām (piemēram, vairāk griķu vai fileja), nevis pievienojot nesaderīgus produktus.
- Katram produktam, kas minēts nosaukumā vai pagatavošanas soļos, jābūt arī "ingredients" sarakstā ar gramiem.
- Nemini alternatīvas vai produktus, ko neizmanto.
- Sāli, piparus, ūdeni, eļļu un garšvielas drīkst minēt pagatavošanas soļos, bet ne sastāvdaļās.
- Grami ir neapstrādāta (sausa) produkta svars. Olas norādi veselos gabalos (1 ola ≈ 50 g).
- Dažādo ēdienreizes: neizmanto vienu un to pašu ogļhidrātu avotu vairāk kā 2 ēdienreizēs, ja ir citi varianti.
- Receptēm jābūt reālistiskām un tādām, ko cilvēki parasti gatavo.

Atbildi TIKAI ar JSON šādā formā:
{"mode":"plan","meals":[{"type":"breakfast","name":"...","steps":["...","..."],"ingredients":[{"id":"...","name":"...","grams":100}]}],"note":"īss komentārs"}
type ir viens no: breakfast, lunch, dinner, snack.`;
}

const aiProviders = [
  {
    name: 'Gemini',
    key: () => process.env.GEMINI_API_KEY,
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: () => process.env.GEMINI_MODEL || 'gemini-3.8-flash'
  },
  {
    name: 'Groq',
    key: () => process.env.GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  }
];

async function callProvider(provider, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const result = await fetch(provider.url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key()}` },
      body: JSON.stringify({
        model: provider.model(),
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (!result.ok) {
      const details = await result.text();
      console.error(`${provider.name} error`, result.status, details.slice(0, 500));
      const error = new Error(`${provider.name} atbildēja ar kļūdu ${result.status}.`);
      error.status = result.status;
      throw error;
    }
    const data = await result.json();
    const text = data.choices?.[0]?.message?.content || '';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } finally {
    clearTimeout(timer);
  }
}

async function askGemini(prompt) {
  const available = aiProviders.filter((provider) => provider.key());
  if (!available.length) {
    const error = new Error('Nav iestatīta neviena MI atslēga (GEMINI_API_KEY vai GROQ_API_KEY).');
    error.status = 503;
    throw error;
  }
  let lastError;
  for (const provider of available) {
    try {
      const answer = await callProvider(provider, prompt);
      console.log(`Ēdienkarte ģenerēta ar ${provider.name}`);
      return answer;
    } catch (error) {
      lastError = error;
      if (error instanceof SyntaxError) throw error; 
    }
  }
  const error = new Error(lastError?.status === 429
    ? 'MI pieprasījumu limits ir sasniegts. Mēģini pēc brīža.'
    : 'MI pakalpojumi pašlaik nav pieejami. Mēģini pēc brīža.');
  error.status = lastError?.status === 429 ? 429 : 502;
  error.retryable = true;
  return Promise.reject(error);
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeText(text) {
  return String(text || '').toLowerCase().trim();
}

function productStem(name) {
  const longest = normalizeText(name).split(/\s+/).sort((a, b) => b.length - a.length)[0] || '';
  if (longest.length >= 6) return longest.slice(0, -2);
  if (longest.length === 5) return longest.slice(0, -1);
  return '';
}

const mealTypeAliases = {
  breakfast: 'breakfast', brokastis: 'breakfast',
  lunch: 'lunch', pusdienas: 'lunch',
  dinner: 'dinner', vakariņas: 'dinner', vakarinas: 'dinner',
  snack: 'snack', uzkoda: 'snack', launags: 'snack'
};

function normalizeMealType(type) {
  return mealTypeAliases[normalizeText(type)] || '';
}

function validateMealPlan(raw, pantry, target) {
  const byId = new Map(pantry.map((p) => [p.foodItemId, p]));
  const byName = new Map(pantry.map((p) => [normalizeText(p.name), p]));
  const used = new Map();
  const meals = [];
  const warnings = [];

  for (const meal of Array.isArray(raw?.meals) ? raw.meals : []) {
    const type = normalizeMealType(meal?.type);
    if (!type) {
      console.warn('Izlaista ēdienreize ar nezināmu tipu:', meal?.type);
      continue;
    }
    const ingredients = [];
    for (const item of Array.isArray(meal.ingredients) ? meal.ingredients : []) {
      const product = byId.get(String(item?.id)) || byName.get(normalizeText(item?.name));
      const grams = Math.round(Number(item?.grams));
      if (!product) return { ok: false, error: 'MI izmantoja produktu, kura nav sarakstā.' };
      if (!Number.isFinite(grams) || grams <= 0) continue;
      used.set(product.foodItemId, (used.get(product.foodItemId) || 0) + grams);
      ingredients.push({
        foodItemId: product.foodItemId, name: product.name, grams,
        kcal: round(product.kcal_100g * grams / 100),
        protein: round(product.protein_100g * grams / 100, 1),
        fat: round(product.fat_100g * grams / 100, 1),
        carbohydrates: round(product.carbohydrates_100g * grams / 100, 1)
      });
    }
    if (!ingredients.length) {
      console.warn('Izlaista ēdienreize bez sastāvdaļām:', meal?.name);
      continue;
    }
    const steps = Array.isArray(meal.steps) ? meal.steps.map(String) : String(meal.steps || '').split('\n');
    const name = String(meal.name || 'Ēdiens').slice(0, 100);

    const mealText = normalizeText([name, ...steps].join(' '));
    const listed = new Set(ingredients.map((i) => i.foodItemId));
    const missing = pantry.find((p) => !listed.has(p.foodItemId) && productStem(p.name) && mealText.includes(productStem(p.name)));
    if (missing) warnings.push(`"${missing.name}" minēts receptē "${name}", bet nav sastāvdaļās.`);

    meals.push({
      type,
      name,
      steps: steps.map((s) => s.trim()).filter(Boolean).slice(0, 15),
      ingredients,
      kcal: ingredients.reduce((sum, i) => sum + i.kcal, 0),
      protein: round(ingredients.reduce((sum, i) => sum + i.protein, 0), 1),
      targetKcal: target.meals[type]
    });
  }

  for (const [id, grams] of used) {
    if (grams > byId.get(id).grams) {
      return { ok: false, error: `MI izmantoja vairāk produkta "${byId.get(id).name}" nekā ir pieejams.` };
    }
  }
  if (!meals.length) return { ok: false, error: 'MI neizveidoja nevienu derīgu ēdienreizi.' };

  const totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0);
  const coveredTypes = new Set(meals.map((m) => m.type));
  const isFullPlan = mealTypes.every((type) => coveredTypes.has(type));
  return {
    ok: true,
    warnings,
    plan: {
      mode: isFullPlan && raw.mode !== 'recipes' ? 'plan' : 'recipes',
      meals,
      totalKcal,
      totalProtein: round(meals.reduce((sum, m) => sum + m.protein, 0), 1),
      target,
      note: String(raw.note || '').slice(0, 300)
    }
  };
}

app.post('/api/meal-plan/generate', requireUser, asyncRoute(async (request, response) => {
  const userKey = String(request.user._id);
  const now = Date.now();
  if (now - (lastGenerationByUser.get(userKey) || 0) < 10000) {
    return response.status(429).json({ error: 'Pagaidi 10 sekundes pirms nākamās ģenerēšanas.' });
  }
  lastGenerationByUser.set(userKey, now);

  const target = calculateNutritionTarget(request.user);
  if (target.error) return response.status(400).json({ error: target.error });

  const pantry = await loadPantry(request.user._id);
  if (!pantry.length) {
    return response.status(400).json({ error: 'Vispirms pievieno produktus sarakstam "Mani produkti".' });
  }

  const availableKcal = pantry.reduce((sum, p) => sum + p.kcal_100g * p.grams / 100, 0);
  const enoughForFullDay = availableKcal >= target.dailyKcal * 0.9;

  const prompt = buildMealPlanPrompt(target, pantry);
  let lastError = 'Neizdevās izveidot ēdienkarti.';
  let bestPlan = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const attemptPrompt = attempt === 1 ? prompt
        : `${prompt}\n\nTava iepriekšējā atbilde bija nederīga: ${lastError} Izlabo to.`;
      const raw = await askGemini(attemptPrompt);
      console.log(`MI atbilde (${attempt}. mēģinājums): ${(raw?.meals || []).length} ēdienreizes`, (raw?.meals || []).map((m) => m?.type));
      const checked = validateMealPlan(raw, pantry, target);
      if (!checked.ok) {
        lastError = checked.error;
        continue;
      }
      const problems = [...checked.warnings];
      if (checked.plan.mode !== 'plan' && enoughForFullDay) {
        problems.push(`Produktu pietiek visai dienai (${Math.round(availableKcal)} kcal), tāpēc aizpildi visas 4 ēdienreizes.`);
      }
      if (!problems.length) return response.json(checked.plan);
      if (!bestPlan || problems.length <= bestPlan.problems.length) bestPlan = { ...checked.plan, problems };
      lastError = problems.join(' ');
    } catch (error) {
      if (error.retryable && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      if (error.status) return response.status(error.status).json({ error: error.message });
      lastError = 'MI atbilde nebija derīga.';
    }
  }
  if (bestPlan) {
    const { problems, ...plan } = bestPlan;
    return response.json({ ...plan, note: `Piezīme: ${problems.join(' ')} ${plan.note}`.trim() });
  }
  return response.status(422).json({ error: lastError + ' Mēģini vēlreiz.' });
}));

const mealPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });
const MealPlan = mongoose.model('MealPlan', mealPlanSchema);

function sanitizePlan(plan) {
  const meals = (Array.isArray(plan?.meals) ? plan.meals : []).slice(0, 10).map((meal) => ({
    type: mealTypes.includes(meal?.type) ? meal.type : 'snack',
    name: String(meal?.name || '').slice(0, 100),
    steps: (Array.isArray(meal?.steps) ? meal.steps : []).slice(0, 15).map((s) => String(s).slice(0, 500)),
    ingredients: (Array.isArray(meal?.ingredients) ? meal.ingredients : []).slice(0, 20).map((i) => ({
      foodItemId: String(i?.foodItemId || ''), name: String(i?.name || '').slice(0, 100),
      grams: Number(i?.grams) || 0, kcal: Number(i?.kcal) || 0
    })),
    kcal: Number(meal?.kcal) || 0,
    protein: Number(meal?.protein) || 0,
    targetKcal: Number(meal?.targetKcal) || 0
  }));
  return {
    mode: plan?.mode === 'plan' ? 'plan' : 'recipes',
    meals,
    totalKcal: Number(plan?.totalKcal) || 0,
    totalProtein: Number(plan?.totalProtein) || 0,
    target: { dailyKcal: Number(plan?.target?.dailyKcal) || 0 },
    note: String(plan?.note || '').slice(0, 300)
  };
}

function publicMealPlan(doc) {
  return { id: String(doc._id), createdAt: doc.createdAt, plan: doc.plan };
}

app.get('/api/meal-plans', requireUser, asyncRoute(async (request, response) => {
  const plans = await MealPlan.find({ user: request.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  return response.json({ plans: plans.map(publicMealPlan) });
}));

// Saglabātās ēdienkartes ēdienreizes kļūst par receptēm; ja recepte jau ir, palielina tās popularitāti
async function recordPlanRecipes(plan) {
  for (const meal of plan?.meals || []) {
    const name = String(meal.name || '').trim().slice(0, 100);
    const steps = (meal.steps || []).filter(Boolean);
    if (!name || !steps.length) continue;

    const existing = await FoodItem.findOne({
      type: 'recipe',
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    });
    if (existing) {
      await FoodItem.updateOne({ _id: existing._id }, { $inc: { saves: 1 } });
      continue;
    }

    await FoodItem.create({
      type: 'recipe',
      name,
      description: (meal.ingredients || []).map((i) => `${i.name} ${i.grams} g`).join(', ').slice(0, 2000),
      cooking_steps: steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
      amount_portions: 1,
      caloryperportion: Math.round(Number(meal.kcal) || 0),
      source: 'ai',
      saves: 1
    });
  }
}

// Vienreiz pārnes receptes no jau iepriekš saglabātajām ēdienkartēm
async function importSavedPlanRecipes() {
  if (await FoodItem.exists({ source: 'ai' })) return;
  const plans = await MealPlan.find({}).lean();
  for (const doc of plans) await recordPlanRecipes(doc.plan);
  if (plans.length) console.log(`Receptes importētas no ${plans.length} saglabātām ēdienkartēm`);
}

mongoose.connection.on('connected', () => {
  importSavedPlanRecipes().catch((error) => console.error('Recepšu imports neizdevās:', error.message));
});

app.post('/api/meal-plans', requireUser, asyncRoute(async (request, response) => {
  const plan = sanitizePlan(request.body.plan);
  if (!plan.meals.length) return response.status(400).json({ error: 'Ēdienkarte ir tukša.' });
  const saved = await MealPlan.create({ user: request.user._id, plan });
  await recordPlanRecipes(plan).catch((error) => console.error('Receptes saglabāšana neizdevās:', error.message));
  return response.status(201).json({ plan: publicMealPlan(saved) });
}));

app.delete('/api/meal-plans/:id', requireUser, asyncRoute(async (request, response) => {
  if (!mongoose.Types.ObjectId.isValid(request.params.id)) return response.status(404).json({ error: 'Ēdienkarte nav atrasta.' });
  await MealPlan.deleteOne({ _id: request.params.id, user: request.user._id });
  return response.json({ ok: true });
}));

app.get('*', (_request, response) => {
  return response.sendFile(path.join(__dirname, 'dist', 'index.html'));
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