

function buildMealPlanPrompt(target, pantry, vegetarian = false) {
  const products = pantry.map((p) => ({
    id: p.foodItemId, name: p.name,
    ...(p.category ? { category: p.category } : {}),
    availableGrams: p.grams,
    kcal_100g: p.kcal_100g, protein_100g: p.protein_100g
  }));
  return `Tu esi uztura plānotājs. Izveido vienas dienas ēdienkarti latviešu valodā.
Lietotāja mērķis: ${target.goal} (lose = zaudēt svaru, maintain = noturēt, gain = pieņemties).${vegetarian ? '\nLietotājs ir veģetārietis: neizmanto un nemini gaļu, zivis un citus dzīvnieku gaļas produktus.' : ''}
Dienas kaloriju mērķis: ${target.dailyKcal} kcal, olbaltumvielas: ~${target.proteinGrams} g.
Ēdienreižu mērķi (kcal): ${JSON.stringify(target.meals)}.

Pieejamie produkti (izmanto TIKAI tos, pēc "id", un kopā ne vairāk par availableGrams katram; "category", ja norādīta, palīdz izvēlēties, kurai ēdienreizei produkts der):
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
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    // gpt-oss ar noklusējuma spriešanu iztērē visus atbildes tokenus domāšanai un atgriež nogrieztu
    // vai tukšu atbildi (json_validate_failed); ar "low" atbilde ir pilna un ātra
    options: (model) => (model.includes('gpt-oss') ? { reasoning_effort: 'low', max_completion_tokens: 6000 } : {})
  }
];

async function callProvider(provider, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const model = provider.model();
    const result = await fetch(provider.url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key()}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        ...(provider.options ? provider.options(model) : {})
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
    // Nogriezta atbilde var būt derīgs JSON ar trūkstošām ēdienreizēm, tāpēc to neizmanto
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.error(`${provider.name} atbilde nogriezta (sasniegts tokenu limits)`);
      const error = new Error(`${provider.name} atbilde bija nepilna.`);
      error.status = 502;
      throw error;
    }
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

module.exports = { askGemini, buildMealPlanPrompt };
