# Quality Food

A React and Tailwind meal-planning website with an Express and MongoDB API for saving food items and recipes.

## Run locally

1. Install Node.js 20 or newer.
2. Go to the `VScode` folder with `cd`
3. In the `VScode` folder, run `npm.cmd install`.
4. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string.
5. Run `npm.cmd run dev`.
6. Open <http://localhost:5173>. The React development server proxies API requests to Express at <http://localhost:3000>.



For a production-style run, use `npm.cmd run build` followed by `npm.cmd start`, then open <http://localhost:3000>.

## Menu API

- `GET /api/food-items?type=recipe` returns the three newest recipes.
- `GET /api/food-items?type=food-item` returns the three newest food items.
- `POST /api/food-items` saves a food item or recipe. IDs are generated as UUID strings by the server.

Food items require `name`, `kcal_100g`, `protein_100g`, `fat_100g`, and `carbohydrates_100g`.

Recipes require `name`, `cooking_steps`, `amount_portions`, and `caloryperportion`. `description` is optional.

## Accounts and roles

- Register at `/register` with an email, username, password, and repeated password. Passwords must be at least 8 characters.
- Log in at `/login`; the profile page is available at `/profile`.
- New accounts always receive the `User` role. Users may add recipes; `Nutritionist` and `Admin` accounts may also add food items. These permissions are enforced by the API, not only hidden in the interface.
- Promote an account to `Nutritionist` or `Admin` through a trusted MongoDB administration tool by changing that user's `role` field. Never allow public registration to choose a privileged role.
- Sessions use an HttpOnly cookie and are stored in MongoDB with a seven-day expiry.
