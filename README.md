# Quality Food

A meal-planning web app built with React, Tailwind CSS, Express and MongoDB. Users keep a list of the products they have at home, and the app uses AI to build a daily meal plan from those products that matches their calorie target, calculated from their profile (weight, height, age, activity level and goal). Recipes are not entered by hand: they are created from the meal plans users save, and the most popular ones are shown on the home page.

## Run with Docker (recommended)

Docker runs the app and the database with fixed versions (Node.js 22, MongoDB 7), so nothing else needs to be installed.

### 1. Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), started and showing "Engine running".
- Git.

### 2. Download the project

```
git clone https://github.com/henrijsvindelis/DE0017-grupa10.git
cd DE0017-grupa10/VScode
```

### 3. Add the AI keys

Copy `.env.example` to a new file named `.env` in the `VScode` folder and fill in at least one key. Both keys are free and need no payment card:

| Variable | Where to get it |
| --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) → Get API key → Create API key |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com) → API Keys → Create API Key |

Gemini is used first. If it is busy or unavailable, the app automatically falls back to Groq.

`.env` is listed in `.gitignore`. Never commit it or share the keys.

The app works without any keys too; only the "Generate meal plan" button will show an error.

### 4. Start

```
docker compose up --build --no-attach mongo
```

`--no-attach mongo` hides the database messages so the terminal only shows the app. The first start takes a few minutes. When the terminal shows `Connected to MongoDB`, open <http://localhost:3000>.

On the first start with an empty database the app fills it automatically:

- **Products:** 116 food items (nutrition per 100 g, vitamins, minerals, price per kg, category, vegetarian) are loaded from `VScode/seed/products.json` as verified products. This only happens when the database has no food items yet.
- **Demo accounts:** created only when there are no users yet.

### 5. Log in with a demo account

| Email | Password | Role |
| --- | --- | --- |
| `admin@qualityfood.lv` | `Demo12345` | Admin |
| `demo@qualityfood.lv` | `Demo12345` | User |

The demo user already has a filled-in profile (30 years, male, 180 cm, 80 kg, moderately active, goal: lose weight) and 8 products in **My products**, so you can generate a meal plan straight away. If there are no saved meal plans yet, the demo user also gets 2 saved one-day meal plans built from the seed products, so **Popular recipes** on the home page is not empty.

These accounts are for local testing only. Change the passwords or remove the accounts before deploying anywhere public.

To make another account an Admin or Nutritionist, register it and change the role in the database (replace the email), then log out and log in again:

```
docker exec quality-food-mongo-1 mongosh qualityfood --eval 'db.users.updateOne({email:"you@example.com"},{$set:{role:"Admin"}})'
```

### 6. Stop and reset

| Command | What it does |
| --- | --- |
| `Ctrl+C` or `docker compose down` | Stops the app. Data is kept. |
| `docker compose up --no-attach mongo` | Starts it again with the same data. |
| `docker compose down -v` | Stops the app and **deletes all data** (fresh start). On the next start the products and demo accounts are loaded again. |

## Try the meal planner

1. Log in as `demo@qualityfood.lv` (the profile and product list are already filled in), or register your own account and fill in age, sex, height, weight, activity level and goal under **Profile**.
2. Open **Meal planner** and add the products you have and how many grams. Pick a product from the database, or type a new name with the nutrition per 100 g from the package; new products are saved as *Unverified* until an Admin checks them.
3. Press **Generate meal plan**. If your products are enough for a full day, you get breakfast, lunch, dinner and a snack; otherwise you get recipes you can make right now.
4. Press **Save this plan** to keep it. Saved plans appear under **Saved meal plans**, and their dishes become recipes on the home page, ranked by how many users saved them.

The AI suggests the meals, but the server checks every answer: it may only use the user's products, never more grams than available, and all calories and protein are recalculated from our own database.

## Development mode

To have changes applied automatically while editing code:

```
docker compose up --build --watch --no-attach mongo
```

Changes to `server.js` restart the server within seconds; changes in `src/` rebuild the app automatically.

## Run without Docker

1. Install Node.js 22 and MongoDB 7.
2. In the `VScode` folder, run `npm install` (`npm.cmd install` on Windows).
3. Copy `.env.example` to `.env` and set `MONGODB_URI` and the AI keys.
4. Run `npm run dev` and open <http://localhost:5173>.

## How the daily target is calculated

- Basal metabolic rate with the Mifflin–St Jeor formula, multiplied by the activity factor (1.2–1.9).
- Goal adjustment: lose −500 kcal, maintain ±0, gain +300 kcal, with a minimum of 1200 kcal (women) or 1500 kcal (men).
- Protein: 1.8 g/kg for lose and gain, 1.4 g/kg for maintain.
- Split across meals: breakfast 25 %, lunch 35 %, dinner 30 %, snack 10 %.
- If the user enters their own daily calorie goal in the profile, that value is used instead.

The values are guidance only and not medical advice.

## API

| Method and path | Description |
| --- | --- |
| `GET /api/food-items?type=recipe\|food-item` | Newest (or `sort=popular`) recipes or food items. Optional `q` searches by name; `vegetarian=true` shows only vegetarian food items and recipes whose ingredients are all vegetarian |
| `POST /api/food-items` | Add a food item (Admin, Nutritionist) or a recipe (Nutritionist) |
| `PATCH /api/food-items/:id` | Correct an item; an edited food item becomes verified (Admin, Nutritionist) |
| `DELETE /api/food-items/:id` | Delete an item (Admin, Nutritionist) |
| `GET /api/nutrition/target` | The logged-in user's daily calorie and protein target |
| `GET /api/products?q=` | Search food items |
| `GET /api/pantry` | The user's product list |
| `POST /api/pantry` | Add or update a product: `{ foodItemId, grams }` or `{ name, grams, nutrition }` for a new, unverified product |
| `DELETE /api/pantry/:foodItemId` | Remove a product from the list |
| `POST /api/meal-plan/generate` | Generate a meal plan with AI from the user's products |
| `GET /api/meal-plans` | The user's saved meal plans |
| `POST /api/meal-plans` | Save a meal plan |
| `DELETE /api/meal-plans/:id` | Delete a saved meal plan |

## Accounts and roles

- Register at `/register` with an email, username and password (at least 8 characters).
- New accounts always get the `User` role.
- `User`: adds products to **My products**. A product name that is not in the database yet is added as *Unverified*. Users do not write recipes; recipes come from saved meal plans.
- `Admin`: manages the product database. Adds, corrects and deletes food items; correcting a user-added product marks it as verified.
- `Nutritionist`: can do the same with food items and may also add and edit recipes.
- Permissions are enforced by the API, not only hidden in the interface.
- Roles can only be changed directly in the database. Demo accounts and the command are in step 5 above.
- Sessions use an HttpOnly cookie and expire after seven days.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| `port is already allocated` | Another program uses port 3000. In `docker-compose.yml`, change `"3000:3000"` to `"3001:3000"` and open <http://localhost:3001>. |
| "MI pakalpojumi pašlaik nav pieejami" | The free AI service is busy. Wait a minute and try again, or add a `GROQ_API_KEY` as a fallback. |
| Code changes are not visible | Restart with `docker compose up --build --no-attach mongo` (or add `--watch`). |
| `.env` changes are not picked up | Stop with `Ctrl+C` and start again with `docker compose up --build --no-attach mongo`. |