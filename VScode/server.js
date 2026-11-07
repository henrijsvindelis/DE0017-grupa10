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
