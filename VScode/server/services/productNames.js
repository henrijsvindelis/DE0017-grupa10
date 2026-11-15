// Lietotāju ievadīto produktu nosaukumu pārbaude: atsijā nejaušus burtus un atrod līdzīgus esošos produktus

const vowels = 'aeiouyāēīū';
const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

// Mazie burti bez garumzīmēm, lai "kartupeli" sakristu ar "Kartupeļi"
function foldName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanProductName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function isKeyboardSequence(word) {
  return keyboardRows.some((row) => {
    const reversed = [...row].reverse().join('');
    if (word.length >= 3 && (row.includes(word) || reversed.includes(word))) return true;
    for (let i = 0; i + 5 <= word.length; i += 1) {
      const part = word.slice(i, i + 5);
      if (row.includes(part) || reversed.includes(part)) return true;
    }
    return false;
  });
}

// Vārds izskatās pēc nejaušiem burtiem; null nozīmē, ka vārds ir pieņemams
function wordProblem(word) {
  const letters = word.normalize('NFC');
  if (letters.length < 3) return null;
  const folded = foldName(letters);
  if (/(.)\1\1/u.test(letters)) return 'atkārtoti burti';
  if (/(.{2,3})\1\1/u.test(folded)) return 'atkārtots fragments';
  if (![...folded].some((char) => vowels.includes(char))) return 'nav patskaņu';
  if (new RegExp(`[^${vowels}]{5,}`, 'u').test(folded)) return 'pārāk daudz līdzskaņu pēc kārtas';
  if (isKeyboardSequence(folded)) return 'tastatūras burtu virkne';
  if (letters.length >= 6 && new Set(folded).size <= 2) return 'pārāk maz dažādu burtu';
  return null;
}

// Atgriež kļūdas tekstu vai null, ja nosaukums der jaunam produktam
function productNameError(name) {
  const cleaned = cleanProductName(name);
  if (!/^[\p{L}\d\s%().,'\-/&+]+$/u.test(cleaned)) {
    return 'Produkta nosaukumā drīkst būt burti, cipari, atstarpes un zīmes % ( ) . , - / & +';
  }
  const letters = cleaned.match(/\p{L}/gu) || [];
  if (letters.length < 2) return 'Produkta nosaukumā jābūt vismaz 2 burtiem.';
  for (const word of cleaned.match(/\p{L}+/gu)) {
    const problem = wordProblem(word);
    if (problem) return `"${cleaned}" neizskatās pēc produkta nosaukuma (${problem}). Pārbaudi, vai nosaukums ir uzrakstīts pareizi.`;
  }
  return null;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

// Produkts ar to pašu nosaukumu, ja atšķiras tikai lielie burti, garumzīmes vai atstarpes
function findSameProduct(name, products) {
  const folded = foldName(name);
  return products.find((product) => foldName(product.name) === folded) || null;
}

// Tuvākais produkts, kura nosaukums atšķiras ar 1–2 burtiem (drukas kļūda)
function findSimilarProduct(name, products) {
  const folded = foldName(name);
  const allowed = folded.length <= 4 ? 0 : folded.length <= 7 ? 1 : 2;
  if (!allowed) return null;
  let best = null;
  for (const product of products) {
    const distance = editDistance(folded, foldName(product.name));
    if (distance <= allowed && (!best || distance < best.distance)) best = { product, distance };
  }
  return best?.product || null;
}

// Meklēšanas regex, kurā katrs burts atrod arī savu variantu ar garumzīmi ("tomati" atrod "Tomāti")
const letterVariants = {
  a: 'aā', c: 'cč', e: 'eē', g: 'gģ', i: 'iī', k: 'kķ', l: 'lļ', n: 'nņ', s: 'sš', u: 'uū', z: 'zž'
};
function diacriticInsensitivePattern(query) {
  return [...foldName(query)].map((char) => {
    if (letterVariants[char]) return `[${letterVariants[char]}]`;
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
}

module.exports = { cleanProductName, diacriticInsensitivePattern, findSameProduct, findSimilarProduct, foldName, productNameError };
