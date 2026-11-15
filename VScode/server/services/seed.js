const fs = require('fs');

const { seedProductsFile } = require('../config');
const { recordPlanRecipes } = require('./recipes');
const { calculateNutritionTarget, withAnalysis } = require('./nutrition');
const { sanitizePlan, validateMealPlan } = require('./mealPlanValidation');
const { hashPassword } = require('./auth');
const User = require('../models/User');
const Pantry = require('../models/Pantry');
const MealPlan = require('../models/MealPlan');
const FoodItem = require('../models/FoodItem');

// Ja datubāzē nav neviena produkta, ielādē visus no seed/products.json kā pārbaudītus
async function seedProducts() {
  if (await FoodItem.exists({ type: 'food-item' })) return;

  const seedFile = seedProductsFile;
  if (!fs.existsSync(seedFile)) {
    console.warn(`Produktu seed fails nav atrasts: ${seedFile}`);
    return;
  }
  const { products = [] } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  await FoodItem.insertMany(products.map((product) => ({
    type: 'food-item',
    name: product.name,
    kcal_100g: product.kcal_100g,
    protein_100g: product.protein_100g,
    fat_100g: product.fat_100g,
    carbohydrates_100g: product.carbohydrates_100g,
    category: product.category,
    vegetarian: product.vegetarian,
    vitamins: product.vitamins_mg_100g,
    minerals: product.minerals_mg_100g,
    price_eur_per_kg: product.price_eur_per_kg,
    source: 'user',
    verified: true
  })));
  console.log(`Ielādēti ${products.length} produkti no seed/products.json`);
}

const demoPassword = 'Demo12345';

const demoPantry = [
  ['Auzu putraimi', 500],
  ['Rīsi', 1000],
  ['Kartupeļi', 2000],
  ['Burkāni', 500],
  ['Vistas gaļa', 800],
  ['Vistas ola', 600],
  ['Govs piens', 1000],
  ['Svaigi āboli', 1000]
];

// Ja nav neviena lietotāja, izveido demo kontus (Admin un User ar aizpildītu profilu un produktiem)
async function seedUsers() {
  if (await User.exists({})) return;

  await User.create({
    email: 'admin@qualityfood.lv',
    username: 'admin',
    usernameKey: 'admin',
    ...(await hashPassword(demoPassword)),
    role: 'Admin'
  });
  const demo = await User.create({
    email: 'demo@qualityfood.lv',
    username: 'demo',
    usernameKey: 'demo',
    age: 30,
    sex: 'male',
    height: 180,
    weight: 80,
    activityLevel: 'moderately-active',
    goal: 'lose',
    ...(await hashPassword(demoPassword)),
    role: 'User'
  });

  const products = await FoodItem.find({ type: 'food-item', name: { $in: demoPantry.map(([name]) => name) } }).lean();
  const idByName = new Map(products.map((product) => [product.name, product.id]));
  const entries = demoPantry
    .filter(([name]) => idByName.has(name))
    .map(([name, grams]) => ({ user: demo._id, foodItemId: idByName.get(name), grams }));
  await Pantry.insertMany(entries);
  console.log(`Izveidoti demo konti admin@qualityfood.lv un demo@qualityfood.lv (${entries.length} produkti sarakstā)`);
}

// Demo ēdienkartes; grami ir neapstrādāta produkta svars, kalorijas aprēķina no produktu vērtībām datubāzē
const demoMealPlans = [
  {
    note: 'Demo ēdienkarte: ikdienas maltītes no produktiem mājās.',
    meals: [
      {
        type: 'breakfast',
        name: 'Auzu putra ar pienu un āboliem',
        steps: ['Uzvāri pienu, pievieno auzu pārslas un šķipsniņu sāls.', 'Vāri 5–7 minūtes, bieži maisot.', 'Pasniedz ar sagrieztu ābolu.'],
        ingredients: [['Auzu putraimi', 80], ['Govs piens', 250], ['Svaigi āboli', 150]]
      },
      {
        type: 'lunch',
        name: 'Vistas gaļa ar griķiem un burkānu salātiem',
        steps: ['Izvāri griķus sālītā ūdenī (1 daļa griķu, 2 daļas ūdens).', 'Vistas gaļu apcep pannā ar nedaudz eļļas, sāli un pipariem līdz gatavībai.', 'Burkānus sarīvē un sajauc ar skābo krējumu.', 'Pasniedz vistu ar griķiem un burkānu salātiem.'],
        ingredients: [['Vistas gaļa', 220], ['Griķu putraimi', 100], ['Burkāni', 150], ['Skābs krējums', 30]]
      },
      {
        type: 'dinner',
        name: 'Omlete ar sieru, vārītiem kartupeļiem un tomātiem',
        steps: ['Novāri kartupeļus sālītā ūdenī.', 'Sakul olas ar pienu, pievieno rīvētu sieru un cep pannā uz lēnas uguns.', 'Pasniedz ar kartupeļiem un sagrieztiem tomātiem.'],
        ingredients: [['Kartupeļi', 300], ['Vistas ola', 150], ['Govs piens', 50], ['Čederas siers', 30], ['Tomāti', 150]]
      },
      {
        type: 'snack',
        name: 'Kefīrs ar ābolu',
        steps: ['Ielej kefīru glāzē.', 'Pasniedz ar sagrieztu ābolu.'],
        ingredients: [['Kefīrs', 250], ['Svaigi āboli', 120]]
      }
    ]
  },
  {
    note: 'Demo ēdienkarte: vairāk olbaltumvielu no zivīm un biezpiena.',
    meals: [
      {
        type: 'breakfast',
        name: 'Olu kultenis ar rudzu maizi un gurķi',
        steps: ['Olas sakul ar sāli un cep pannā uz sviesta, maisot.', 'Pasniedz ar rudzu maizi un sagrieztu gurķi.'],
        ingredients: [['Vistas ola', 150], ['Nesālīts sviests', 10], ['Rudzu maize', 100], ['Svaigi gurķi', 100]]
      },
      {
        type: 'lunch',
        name: 'Vistas rīsi ar burkāniem un sīpoliem',
        steps: ['Vistas gaļu sagriez gabaliņos un apcep katlā ar nedaudz eļļas.', 'Pievieno sakapātu sīpolu un rīvētus burkānus, sautē 5 minūtes.', 'Pieber noskalotus rīsus, ielej divreiz vairāk ūdens, pievieno sāli un vāri zem vāka 20 minūtes.'],
        ingredients: [['Vistas gaļa', 220], ['Rīsi', 120], ['Burkāni', 100], ['Sīpoli', 60]]
      },
      {
        type: 'dinner',
        name: 'Cepta menca ar kartupeļu biezeni un kāpostu salātiem',
        steps: ['Novāri kartupeļus un saspaidi biezenī ar siltu pienu un sviestu.', 'Mencu pārkaisa ar sāli un pipariem un cep pannā 3–4 minūtes no katras puses.', 'Kāpostus smalki sagriez, pievieno sāli un nedaudz eļļas.', 'Pasniedz mencu ar biezeni un salātiem.'],
        ingredients: [['Menca', 200], ['Kartupeļi', 350], ['Govs piens', 100], ['Nesālīts sviests', 10], ['Svaigi kāposti', 150]]
      },
      {
        type: 'snack',
        name: 'Biezpiens ar mellenēm un medu',
        steps: ['Biezpienu liek bļodiņā.', 'Pārliek mellenes un pārlej ar medu.'],
        ingredients: [['Biezpiens (9% tauku)', 100], ['Mellenes', 80], ['Bišu medus', 10]]
      }
    ]
  }
];

// Ja nav nevienas saglabātas ēdienkartes, demo lietotājam saglabā 2 ēdienkartes tāpat kā POST /api/meal-plans
async function seedMealPlans() {
  if (await MealPlan.exists({})) return;
  const demo = await User.findOne({ email: 'demo@qualityfood.lv' });
  if (!demo) return;
  const target = calculateNutritionTarget(demo);
  if (target.error) return;

  const names = [...new Set(demoMealPlans.flatMap((plan) => plan.meals.flatMap((meal) => meal.ingredients.map(([name]) => name))))];
  const products = await FoodItem.find({ type: 'food-item', name: { $in: names } }).lean();
  // validateMealPlan sagaida lietotāja produktu sarakstu; demo ēdienkartēm daudzums nav ierobežots
  const available = products.map((product) => ({
    foodItemId: product.id, name: product.name, grams: Infinity,
    kcal_100g: product.kcal_100g, protein_100g: product.protein_100g,
    fat_100g: product.fat_100g, carbohydrates_100g: product.carbohydrates_100g
  }));

  let saved = 0;
  for (const demoPlan of demoMealPlans) {
    const raw = {
      mode: 'plan',
      note: demoPlan.note,
      meals: demoPlan.meals.map((meal) => ({
        ...meal,
        ingredients: meal.ingredients.map(([name, grams]) => ({ name, grams }))
      }))
    };
    const checked = validateMealPlan(raw, available, target);
    if (!checked.ok) {
      console.warn(`Demo ēdienkarte izlaista: ${checked.error}`);
      continue;
    }
    const plan = sanitizePlan(await withAnalysis(checked.plan));
    await MealPlan.create({ user: demo._id, plan });
    await recordPlanRecipes(plan, demo._id);
    saved += 1;
  }
  if (saved) console.log(`Demo lietotājam saglabātas ${saved} ēdienkartes`);
}

module.exports = { seedMealPlans, seedProducts, seedUsers };
