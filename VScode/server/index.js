require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const { distDir } = require('./config');
const { connectToMongoDB } = require('./db');
const { seedMealPlans, seedProducts, seedUsers } = require('./services/seed');
const { backfillRecipeIngredients, importSavedPlanRecipes } = require('./services/recipes');

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(distDir));

app.use(require('./routes/auth'));
app.use(require('./routes/profile'));
app.use(require('./routes/health'));
app.use(require('./routes/foodItems'));
app.use(require('./routes/nutrition'));
app.use(require('./routes/products'));
app.use(require('./routes/pantry'));
app.use(require('./routes/mealPlan'));
app.use(require('./routes/mealPlans'));

mongoose.connection.on('connected', async () => {
  try {
    await seedProducts();
    await seedUsers();
    await seedMealPlans();
  } catch (error) {
    console.error('Datubāzes sākotnējā aizpilde neizdevās:', error.message);
  }
  importSavedPlanRecipes()
    .then(backfillRecipeIngredients)
    .catch((error) => console.error('Recepšu imports neizdevās:', error.message));
});

app.get('*', (_request, response) => {
  return response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

if (process.env.MONGODB_URI) {
  connectToMongoDB();
} else {
  console.warn('MONGODB_URI is not set; starting without a database connection.');
}
