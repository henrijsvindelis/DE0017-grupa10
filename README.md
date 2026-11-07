# Quality Food

A React and Tailwind meal-planning website with an Express and MongoDB API for saving food items and recipes.

## Run locally

1. Install Node.js 20 or newer.
2. In the `VScode` folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string.
4. Run `npm run dev`.
5. Open <http://localhost:5173>. The React development server proxies API requests to Express at <http://localhost:3000>.

PowerShell users can use `npm.cmd` instead of `npm` if script execution is blocked.

For a production-style run, use `npm run build` followed by `npm start`, then open <http://localhost:3000>.

## Menu API

- `GET /api/food-items?type=recipe` returns the three newest recipes.
- `GET /api/food-items?type=food-item` returns the three newest food items.
- `POST /api/food-items` saves a food item or recipe. IDs are generated as UUID strings by the server.

Food items require `name`, `kcal_100g`, `protein_100g`, `fat_100g`, and `carbohydrates_100g`.

Recipes require `name`, `cooking_steps`, `amount_portions`, and `caloryperportion`. `description` is optional.
