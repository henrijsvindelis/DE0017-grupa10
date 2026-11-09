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

app.post('/api/food-items', requireUser, async (request, response) => {
  const body = request.body || {};
  const { type, name } = body;
  if (type === 'food-item' &&
    request.user.role !== 'Admin' &&
    request.user.role !== 'Nutritionist') {
    return response.status(403).json({ error: 'Only admins and nutritionists can add food items.' });
  }
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
  grams: { type: Number, required: true, min: 1, max: 100000 }
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
    fat_100g: p.fat_100g, carbohydrates_100g: p.carbohydrates_100g
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
        kcal_100g: item.kcal_100g, protein_100g: item.protein_100g,
        fat_100g: item.fat_100g, carbohydrates_100g: item.carbohydrates_100g
      };
    });
}

app.get('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  return response.json({ pantry: await loadPantry(request.user._id) });
}));

app.post('/api/pantry', requireUser, asyncRoute(async (request, response) => {
  const foodItemId = String(request.body.foodItemId || '');
  const grams = Number(request.body.grams);
  if (!Number.isFinite(grams) || grams < 1 || grams > 100000) {
    return response.status(400).json({ error: 'Daudzumam jābūt no 1 līdz 100000 gramiem.' });
  }
  const product = await FoodItem.findOne({ id: foodItemId, type: 'food-item' }).lean();
  if (!product) return response.status(404).json({ error: 'Produkts nav atrasts.' });

  await Pantry.findOneAndUpdate(
    { user: request.user._id, foodItemId },
    { $set: { grams: Math.round(grams) } },
    { upsert: true }
  );
  return response.status(201).json({ pantry: await loadPantry(request.user._id) });
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
- Ja produktu pietiek visai dienai, mode = "plan" un aizpildi visas 4 ēdienreizes.
- Ja produktu nepietiek, mode = "recipes" un piedāvā 1–3 receptes, ko var pagatavot.
- Sāli, piparus, ūdeni un garšvielas drīkst minēt pagatavošanas soļos, bet ne sastāvdaļās.
- Grami ir neapstrādāta produkta svars.
- Ja produktu kopā pietiek dienas mērķim, OBLIGĀTI aizpildi visas 4 ēdienreizes (breakfast, lunch, dinner, snack).
- Katras ēdienreizes kalorijām jābūt ±15 % no tās mērķa.
- Katram produktam, kas minēts pagatavošanas soļos, jābūt arī "ingredients" sarakstā.
- Olas norādi veselos gabalos (1 ola ≈ 50 g).
- Centies dažādot ēdienreizes un izmantot dažādus produktus.

Atbildi TIKAI ar JSON šādā formā:
{"mode":"plan","meals":[{"type":"breakfast","name":"...","steps":["...","..."],"ingredients":[{"id":"...","grams":100}]}],"note":"īss komentārs"}
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

function validateMealPlan(raw, pantry, target) {
  const byId = new Map(pantry.map((p) => [p.foodItemId, p]));
  const used = new Map();
  const meals = [];

  for (const meal of Array.isArray(raw?.meals) ? raw.meals : []) {
    if (!mealTypes.includes(meal?.type)) continue;
    const ingredients = [];
    for (const item of Array.isArray(meal.ingredients) ? meal.ingredients : []) {
      const product = byId.get(String(item?.id));
      const grams = Math.round(Number(item?.grams));
      if (!product || !Number.isFinite(grams) || grams <= 0) continue;
      used.set(product.foodItemId, (used.get(product.foodItemId) || 0) + grams);
      ingredients.push({
        foodItemId: product.foodItemId, name: product.name, grams,
        kcal: round(product.kcal_100g * grams / 100),
        protein: round(product.protein_100g * grams / 100, 1),
        fat: round(product.fat_100g * grams / 100, 1),
        carbohydrates: round(product.carbohydrates_100g * grams / 100, 1)
      });
    }
    if (!ingredients.length) continue;
    const steps = Array.isArray(meal.steps) ? meal.steps.map(String) : String(meal.steps || '').split('\n');
    meals.push({
      type: meal.type,
      name: String(meal.name || 'Ēdiens').slice(0, 100),
      steps: steps.map((s) => s.trim()).filter(Boolean).slice(0, 15),
      ingredients,
      kcal: ingredients.reduce((sum, i) => sum + i.kcal, 0),
      protein: round(ingredients.reduce((sum, i) => sum + i.protein, 0), 1),
      targetKcal: target.meals[meal.type]
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

  const prompt = buildMealPlanPrompt(target, pantry);
  let lastError = 'Neizdevās izveidot ēdienkarti.';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const checked = validateMealPlan(await askGemini(prompt), pantry, target);
      if (checked.ok) return response.json(checked.plan);
      lastError = checked.error;
    } catch (error) {
      if (error.retryable && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      if (error.status) return response.status(error.status).json({ error: error.message });
      lastError = 'MI atbilde nebija derīga.';
    }
  }
  return response.status(422).json({ error: lastError + ' Mēģini vēlreiz.' });
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
